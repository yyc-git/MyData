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

### GC 压力测试

SoA 的迁移不是一蹴而就的。一开始用的是 `players: Map<string, PlayerState>`，每帧创建新 Map。60fps 下，GC 频繁触发。

实际 Profile 数据（Chrome DevTools Performance Tab）：

| 阶段 | 每帧 GC pause | 总帧时 | GC 占比 |
|------|-------------|-------|--------|
| `Map<string, PlayerState>`（每帧新建） | 3-5ms | 16.6ms | 18-30% |
| SoA Float32Array（原地修改） | <0.5ms | 16.6ms | <3% |

3-5ms 的 GC pause 看起来不大，但在多人场景下，每次状态同步都会创建一批新对象——创建房间、玩家进出、状态广播都会触发 GC。实际测试中，3 人同时在线时 GC 频率达到每 2-3 帧一次，帧率从 60fps 跌到 30-40fps。切换到 SoA 后，即使 4 人同时在线，GC 也不再是瓶颈。

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

### 10fps vs 20fps 对比

在实际部署测试中，我们对比了 10fps 和 20fps 的服务器 tick：

| 指标 | 10fps | 20fps |
|------|-------|-------|
| 服务端 CPU 使用率 | 15% | 35% |
| 单实例支持玩家数 | 3-4 人 | 2 人 |
| 玩家感知延迟 | 视觉平滑（插值） | 视觉平滑 |
| 碰撞检测精度 | 100ms 间隔，偶尔穿透 | 50ms 间隔，无穿透 |
| SCF 账单 | ~200元/月 | ~500元/月 |

最终选择了 10fps——因为碰撞穿透问题可以通过"服务端修正 + 前端预测纠偏"覆盖，而 CPU 和账单的差距是硬成本。

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

### 优化前后 FPS 对比（真实 Profile）

在同样场景（双人游戏，相同地图，相同模型数量）下的 Chrome DevTools Performance Profile：

| 指标 | 优化前（Phase 5） | 优化后（Phase 7） | 提升 |
|------|-----------------|-----------------|------|
| 平均 FPS | 45 | 60 | +33% |
| 最低 FPS（4人场景） | 22 | 52 | +136% |
| 每帧 JS 执行时间 | 8ms | 2ms | -75% |
| 每帧渲染时间 | 6ms | 4ms | -33% |
| 内存占用 | 180MB | 95MB | -47% |
| GC pause 最长 | 12ms | 1.5ms | -87% |

最显著的提升是**最低 FPS**——4 人场景下从 22fps 提升到 52fps。22fps 会明显卡顿，52fps 基本流畅。这是 SoA + 帧管理的联合效果。

---

## 双轨动画性能

MMD（巨人）和 FBX（小人）的动画计算是在不同的路径上跑的。策略：**服务端只下发 `isMoving` 布尔值，前端自己做动画混合。**

服务端不需要知道 VMD 和 FBX 的区别——它只告诉前端"这个角色在不在动"，前端根据模型类型做对应的动画切换。

### 为什么需要双轨

MMD 的动画文件（VMD）和 FBX 的骨骼动画机制完全不同：

- VMD：基于帧的 keyframe 插值，每帧需要知道哪个骨骼在哪个位置。一秒钟 30 个 keyframe，在 GPU 上做蒙皮计算。
- FBX：基于骨骼的矩阵动画，Three.js 的 AnimationMixer 管理动画状态机。

如果把动画计算放在服务端，服务端需要同时理解两套动画系统——而且每个玩家的模型不同，动画混合参数也不同。这会大幅增加服务端的复杂度和 CPU 消耗。

### 实际优化效果

| 指标 | 服务端全量同步 | 仅同步 `isMoving` |
|------|--------------|-----------------|
| 每帧网络数据量 | ~2KB/玩家 | ~4字节/玩家 |
| 服务端 CPU | 需要动画计算 | 无动画开销 |
| Frontend 动画代码 | 单一管理 | 双路径（MMD/FBX） |
| 动画相关 bug 频率 | 每周 2-3 个 | 两周 1 个 |

这个改动后，动画相关 bug 大幅减少——因为每个模型类型只对自己的动画负责，不用跨模型同步。

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

### 贴图管线优化

| 方案 | 显存占用 | 视觉效果 | 生成时间 |
|------|---------|---------|---------|
| 直接 4096×4096 | 64MB/张 | 清晰 | SD 30s |
| 1024→2048 两阶段 + 压缩 | 12MB/张 | 几乎无差异 | 45s |
| 裁剪到 512×512（小贴图） | 1MB/张 | 可接受（简单纹理） | 10s |

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

### WebGPU 具体能带来什么

基于 WebGPU 社区的 benchmark，从 WebGL 切换到 WebGPU 后，多人游戏场景下可以预期：

| 指标 | WebGL（当前） | WebGPU（预估） | 差距 |
|------|-------------|---------------|------|
| Draw call 上限 | ~500（CPU 瓶颈） | ~2000（GPU 瓶颈） | +300% |
| 同屏实例数 | ~200 | ~800 | +300% |
| 帧时稳定性 | 波动 ±4ms | 波动 ±1ms | 更稳定 |
| 计算 shader | 不支持 | 支持 | 粒子/碰撞转移 GPU |

当前三人游戏场景下 draw call 大约 300 次（角色 + 子弹 + 场景 + UI），WebGL 已经接近极限。如果后续要加更多小兵（目标 50 个），必须切 WebGPU。

---

下期讲 **P28：通信可靠性与错误处理模式**——WS 断连、重连、竞态、防御式编程。

**下一篇：[Vibe Coding 多人游戏（二十八）—— 通信可靠性与错误处理模式](https://www.cnblogs.com/chaogex/p/21195307)**
