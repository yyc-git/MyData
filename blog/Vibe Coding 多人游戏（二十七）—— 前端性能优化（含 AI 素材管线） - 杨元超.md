# Vibe Coding 多人游戏（二十七）—— 前端性能优化（含 AI 素材管线）

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

多人游戏的前端性能优化和单机不太一样——不仅要考虑渲染帧率，还要考虑网络延迟、状态同步、多人场景下的资源管理。

GTS-Play 的前端性能优化没有走"先优化再分析"的激进路线——而是**按需优化**，每次遇到真实瓶颈才动手。这避免了提前优化的陷阱。

---

## SoA 状态管理

### 迁移过程

Phase 7 的 SoA Store 是性能优化的基础。SoA（Struct of Arrays）是一个数据结构模式——把所有同类数据放在一起而不是每个对象独立存储。

| Store | 数据 | 更新频率 | 映射目标 |
|-------|------|---------|---------|
| TransformStore | positions（Float32Array） | 每帧 | GPU StorageBuffer |
| VisualStore | flags（Uint8Array） | 低频 | SAB 共享 |
| RenderFrameData | 渲染数据 | 每帧 | CPU→GPU |

### GC 优化前后

SoA 的迁移不是一蹴而就的。一开始用的是 `players: Map<string, PlayerState>`，每帧创建新 Map。60fps 下，GC 频繁触发，Performance Tab 里能看到每过几帧就有一个 GC 尖峰。

切换到 `Float32Array` 后，GC pause 显著下降——从 Chrome DevTools Performance Tab 看，GC 标记从"肉眼可见的周期性尖峰"变成了"几乎看不到的底噪"。之前多人同时在线（3-4人）时偶尔掉帧，切 SoA 后基本稳定在 60fps。没有精确记录数值，但"之前会卡，现在不卡"的体验差异是明显的。

估算一下：如果 GC pause 从 ~3ms 降到 <1ms，对于 60fps（16.6ms/帧）来说，每帧可用的 JS 执行时间增加了约 13%（从 ~13.6ms 到 ~15.6ms）。实际上因为 GC 频率也降低了，收益更大。

### 实现细节

SoA 的数据结构只创建一次数组，之后只修改数组里的值：

```typescript
// 之前：每帧创建新对象
const positions = players.map(p => ({ x: p.x, y: p.y, z: p.z }))

// 之后：原地修改 Float32Array
const stride = 3  // x, y, z
const buffer = new Float32Array(maxPlayers * stride)
// 每帧只修改 buffer 中的值，不创建新对象
buffer[playerIndex * stride] = p.x
buffer[playerIndex * stride + 1] = p.y
buffer[playerIndex * stride + 2] = p.z
```

代价是代码可读性下降——需要用索引访问数据，而不是 `player.position.y`。但 AI 能适应，它只需要知道 strides 的定义。我们在 agent-context.md 中写明了 SoA 的 strides 定义，OpenCode 调度时自动注入。

```typescript
// agent-context.md 中的 SoA strides 定义
// Transform: stride=6 (pos.x, pos.y, pos.z, rot.x, rot.y, rot.z)
// Render: stride=4 (color.r, color.g, color.b, alpha)
```

### SoA 的隐藏好处

SoA 除了降低 GC，还顺便解决了两个问题：

1. **共享内存**：Float32Array 可以直接放在 SharedArrayBuffer（SAB）中，用于多线程。如果将来要用 Web Workers 做动画计算，数据可以直接共享。
2. **GPU 上传**：连续的 Float32Array 可以直接上传到 GPU 的 StorageBuffer，不需要再做 AoS→SoA 的转换。Three.js 在渲染大量实例时，需要上传 transform 数据——AoS 结构需要重新打包，SoA 结构直接复用。

这两个好处是迁移前没预料到的——属于"做了才知道"的收益。

---

## 帧管理优化

| 优化 | 效果 |
|------|------|
| 服务端 tick 10fps（生产） | 降低服务端负载 |
| 插值缓冲区 2 帧 | 平滑渲染（前端 60fps） |
| 本地预测 | 消除输入延迟 |
| 服务端修正 | 防止累积误差 |

生产环境服务端 tick 10fps——不是 60fps。因为服务端的碰撞检测、状态广播、命令处理在 60fps 下太耗资源。2 人场景下 10fps 完全够用——人类对延迟的感知阈值在 100ms 以上，10fps 的 tick 间隔是 100ms，刚好在阈值附近。

### 10fps 的决定

为什么选 10fps 而不是更高的 tick rate？经验判断：10fps 对应的 tick 间隔 100ms 刚好在人的延迟感知阈值附近。20fps 的 50ms 间隔收益不明显——因为网络延迟本身就有 20-50ms，50ms 的 tick 间隔相对于网络延迟来说边际收益递减。

选择 10fps 的另一个原因是 SCF 的计费模式——CPU 时间按毫秒计费。tick rate 翻倍意味着服务端 CPU 消耗也翻倍（甚至更多，因为碰撞检测和状态广播的计算量是线性的）。而 10fps 下，前端插值到 60fps 后，玩家感知不到区别。没有做精确的 A/B 对比测试，但这个判断基于实际部署后的稳定表现——部署了就是没出问题。

### 插值实现

前端插值缓冲区是 2 帧——服务端每 100ms 发一次状态，前端在两次状态之间做线性插值，让渲染平滑到 60fps。

```typescript
// 实际使用的插值器
class InterpolationBuffer {
    private buffer: StateSnapshot[] = []
    private readonly MAX_BUFFER = 4  // 2帧 + 安全余量

    push(snapshot: StateSnapshot) {
        this.buffer.push(snapshot)
        if (this.buffer.length > this.MAX_BUFFER) {
            this.buffer.shift()  // 丢弃旧帧
        }
    }

    interpolate(timestamp: number): StateSnapshot {
        if (this.buffer.length < 2) {
            return this.buffer[this.buffer.length - 1]
        }
        // 找到前后两帧
        const next = this.buffer.find(f => f.timestamp >= timestamp)
        const prev = this.buffer[this.buffer.length - 2]
        if (!next) return prev
        // 计算插值因子
        const t = (timestamp - prev.timestamp) / 
                  (next.timestamp - prev.timestamp)
        return this.lerp(prev, next, Math.min(Math.max(t, 0), 1))
    }

    private lerp(a: StateSnapshot, b: StateSnapshot, t: number) {
        return {
            positions: a.positions.map((pos, i) => ({
                x: pos.x + (b.positions[i].x - pos.x) * t,
                y: pos.y + (b.positions[i].y - pos.y) * t,
            }))
        }
    }
}
```

没有复杂的贝塞尔曲线、没有自适应插值——就是线性插值。多人游戏里玩家的移动通常不是精密的物理模拟，线性插值在视觉上完全可接受。

### 本地预测 vs 网络延迟

本地预测是"先执行再修正"——玩家按 W 键时，前端立即移动角色，同时把移动命令发送给服务端。服务端验证后广播新状态，前端收到服务端状态后修正自己的位置。

这个方案最大的坑是**修正闪烁**——前端预测的位置和服务端修正的位置不一致时，角色会"闪一下"。解决：用指数平滑（lerp 系数 0.8）做修正，不直接跳转：

```typescript
// 修正时不做 snap，做平滑
correction.x += (serverPos.x - predictedPos.x) * 0.8
correction.y += (serverPos.y - predictedPos.y) * 0.8
```

0.8 的系数意味着每帧修正 80% 的误差，剩下的 20% 下一帧继续修正。人眼几乎察觉不到。

### FPS 优化感受

没有做精确的 FPS Profile 对比。感受上：优化前多人场景（3-4人同时在线 + 频繁进出房间）会明显卡顿，优化后基本流畅。Performance Tab 里能看到的主要改善是 GC 尖峰消失了、JS 执行时间更稳定了。

优化是**累积效果**：SoA 减少了 GC、插值平滑了渲染、本地预测消除了输入延迟、双轨动画减轻了服务端压力。每个优化单独可能只提升 5-10%，加起来就让体验从"会卡"变成了"流畅"。精确的量化数据没有保留，但体验上的分界线是很明确的——优化前不好意思给别人看，优化后可以随便演示。

---

## 双轨动画性能

MMD（巨人）和 FBX（小人）的动画计算是在不同的路径上跑的。策略：**服务端只下发 `isMoving` 布尔值，前端自己做动画混合。**

服务端不需要知道 VMD 和 FBX 的区别——它只告诉前端"这个角色在不在动"，前端根据模型类型做对应的动画切换。

### 为什么需要双轨

MMD 的动画文件（VMD）和 FBX 的骨骼动画机制完全不同：

- VMD：基于帧的 keyframe 插值，每帧需要知道哪个骨骼在哪个位置。一秒钟 30 个 keyframe，在 GPU 上做蒙皮计算。
- FBX：基于骨骼的矩阵动画，Three.js 的 AnimationMixer 管理动画状态机。

如果把动画计算放在服务端，服务端需要同时理解两套动画系统——而且每个玩家的模型不同，动画混合参数也不同。这会大幅增加服务端的复杂度和 CPU 消耗。

这个改动后，动画相关 bug 大幅减少——因为每个模型类型只对自己的动画负责，不用跨模型同步。没有精确统计 bug 数量，但从开发感受看：之前每次改动画都要考虑"MMD 那边会不会受影响"，之后基本不用操心了。

这条决策是怎么来的？一开始服务端下发了完整的动画状态（`animationName`、`animFrame`、`animProgress` 等）。但这意味着前端和服务端需要同步同一套动画系统——不同模型（MMD vs FBX）的动画帧率和混入方式不同，服务端很难统一处理。

---

## AI 素材管线

3D 游戏缺不了素材（模型、动画、贴图）。GTS-Play 的素材来源：

| 素材 | 来源 | 格式 | AI 参与 |
|------|------|------|---------|
| 巨人模型 | PMX 模型 | MMD | MMDLoader |
| 小兵模型 | FBX 模型 | FBX | FBXLoader |
| 场景 | Procedural 生成 | Three.js | 算法生成 |
| 贴图 | AI 生成 | PNG | Stable Diffusion |

AI 生成贴图的流程：写 prompt → SD 出图 → 压缩 → 导入 Three.js。

贴图尺寸从 4096 降到 2048 甚至 1024，Three.js 端的性能压力明显减轻——特别是移动端，大贴图会快速涨满显存。没有精确记录每张贴图的尺寸和帧率关系，但策略是：先最低分辨率出图，确认可用后再出高分辨率版。2048×2048 已经足够游戏使用了。

### 素材利用率

AI 生成了大约 15 张贴图，真正用到游戏里的只有 6 张——其他的要么风格不匹配，要么颜色不对。素材利用率的低谷不是因为 AI 质量低，而是**人审美不一致**——AI 出的图在"技术正确"上没问题，但"看着对不对"是主观的。

### FBX 加载的坑

AI 生成或下载的 FBX 文件经常缺少版本信息。`Three.js` 的 `FBXLoader` 在加载时先检查文件头里的版本号——有些 FBX 文件头不完整，导致 `Cannot find version number` 错误。

修复方案（来自 2026-07-01 的 ADR）：在加载前检查 FBX 文件头的前 30 个字节，如果缺少版本信息，手动补一个默认版本号。这个补丁加上后，所有的 FBX 文件都能正常加载了。

```typescript
// FBX 版本补丁
const FBX_MAGIC = 'Kaydara FBX Binary'
const DEFAULT_VERSION = 7400  // FBX 7.4

function patchFBXVersion(buffer: ArrayBuffer): ArrayBuffer {
    const header = new TextDecoder().decode(buffer.slice(0, 30))
    if (!header.includes(FBX_MAGIC)) {
        // 不是标准 FBX 头，可能是简化版本
        // 补一个默认版本号
        const patched = new Uint8Array(buffer.byteLength + 4)
        patched.set(new Uint8Array(buffer))
        const version = new DataView(new ArrayBuffer(4))
        version.setUint32(0, DEFAULT_VERSION, false)  // big-endian
        patched.set(new Uint8Array(version.buffer), buffer.byteLength)
        return patched.buffer
    }
    return buffer
}
```

---

## WebGPU 就绪

前端优化的最终目标是 WebGPU 就绪。当前 Phase 已通过 IRenderer 抽象隔离了 Three.js 具体实现，切换到 WebGPU 只需改 ~15 行代码。

### 为什么现在不切

WebGPU 对多人游戏来说意味着更低的 CPU 开销。Three.js 的 WebGL 渲染器在绘制大量对象时，CPU 端的 driver overhead 很大——每个 draw call 都需要 CPU 参与。WebGPU 的 compute shader 可以直接在 GPU 上处理大量数据，CPU 只负责提交命令缓冲区。

不过 WebGPU 的计划目前还停留在"ready 但未启用"的状态——因为移动端 WebGPU 的覆盖还不够（iOS Safari 需要到 iOS 18 才完全支持）。等移动端比例上来后再切。

WebGPU 能带来几个实际收益：draw call 数量不再受 CPU driver overhead 限制（WebGPU 的 CPU 端开销远低于 WebGL）、compute shader 可以将粒子物理和碰撞检测放在 GPU 上做。当前场景下，WebGL 的性能瓶颈还没触发——三人游戏的 draw call 量在合理范围内。但如果后续要加更多小兵（目标 50 个），WebGPU 会是必要的升级。基于 WebGPU 社区公开的 benchmark 数据，多人场景下从 WebGL 到 WebGPU 的 CPU 端 draw call 开销大约是 3-5 倍的提升——不是我的测试结果，是行业共识。

---

下期讲 **P28：通信可靠性与错误处理模式**——WS 断连、重连、竞态、防御式编程。

**下一篇：[Vibe Coding 多人游戏（二十八）—— 通信可靠性与错误处理模式](https://www.cnblogs.com/chaogex/p/21195307)**
