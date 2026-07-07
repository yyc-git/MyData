# Vibe Coding 多人游戏（二十七）—— 前端性能优化（含 AI 素材管线）

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

多人游戏的前端性能优化和单机不太一样——不仅要考虑渲染帧率，还要考虑网络延迟、状态同步、多人场景下的资源管理。

GTS-Play 的前端性能优化没有走"先优化再分析"的激进路线——而是**按需优化**，每次遇到真实瓶颈才动手。这避免了提前优化的陷阱。

---

## SoA 状态管理

Phase 7 的 SoA Store 是性能优化的基础。SoA（Struct of Arrays）是一个数据结构模式——把所有同类数据放在一起而不是每个对象独立存储。

| Store | 数据 | 更新频率 | 映射目标 |
|-------|------|---------|---------|
| TransformStore | positions（Float32Array） | 每帧 | GPU StorageBuffer |
| VisualStore | flags（Uint8Array） | 低频 | SAB 共享 |
| RenderFrameData | 渲染数据 | 每帧 | CPU→GPU |

为什么选 SoA？核心原因是 **Float32Array 连续内存 + 固定 stride（64 字节）**。在 JavaScript GC 中，大量零散的对象会导致频繁的 GC pause（尤其是多人场景下每帧创建大量的 State 对象）。SoA 的数据结构只创建一次数组，之后只修改数组里的值——几乎不产生 GC。

实际效果：切换 SoA 后，前端 GC pause 时间从每帧 3-5ms 降到了不足 0.5ms。3ms 的 GC pause 对于 60fps（16.6ms/帧）来说就是 18% 的帧时被 GC 吃掉了。

SoA 的迁移不是一蹴而就的。一开始用的是 `players: Map<string, PlayerState>`，每帧创建新 Map。60fps 下，GC 频繁触发。切换到 `Float32Array` 后，所有数据在一个连续 buffer 里，GC 几乎为零。代价是代码可读性下降——需要用索引访问数据，而不是 `player.position.y`。但 AI 能适应，它只需要知道 strides 的定义。

---

## 帧管理优化

| 优化 | 效果 |
|------|------|
| 服务端 tick 10fps（生产） | 降低服务端负载 |
| 插值缓冲区 2 帧 | 平滑渲染（前端 60fps） |
| 本地预测 | 消除输入延迟 |
| 服务端修正 | 防止累积误差 |

生产环境服务端 tick 10fps——不是 60fps。因为服务端的碰撞检测、状态广播、命令处理在 60fps 下太耗资源。2 人场景下 10fps 完全够用——人类对延迟的感知阈值在 100ms 以上，10fps 的 tick 间隔是 100ms，刚好在阈值附近。

前端插值缓冲区是 2 帧——服务端每 100ms 发一次状态，前端在两次状态之间做线性插值，让渲染平滑到 60fps。插值逻辑很简单：

```typescript
function interpolatePosition(p0, p1, t) {
    return {
        x: p0.x + (p1.x - p0.x) * t,
        y: p0.y + (p1.y - p0.y) * t,
    }
}
```

没有复杂的贝塞尔曲线、没有自适应插值——就是线性插值。多人游戏里玩家的移动通常不是精密的物理模拟，线性插值在视觉上完全可接受。

---

## 双轨动画性能

MMD（巨人）和 FBX（小人）的动画计算是在不同的路径上跑的。策略：**服务端只下发 `isMoving` 布尔值，前端自己做动画混合。**

服务端不需要知道 VMD 和 FBX 的区别——它只告诉前端"这个角色在不在动"，前端根据模型类型做对应的动画切换。

这条决策是怎么来的？一开始服务端下发了完整的动画状态（`animationName`、`animFrame`、`animProgress` 等）。但这意味着前端和服务端需要同步同一套动画系统——不同模型（MMD vs FBX）的动画帧率和混入方式不同，服务端很难统一处理。

后来改成"服务端只管逻辑，不管表现"：服务端算 `isMoving`，前端根据模型类型（MMD 的 VMD 动画还是 FBX 的动画）做各自的动画混合。这个改动后，动画相关 bug 大幅减少。

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

实际操作中，贴图生成本身并不难——难的是"可用质量"。一开始我用最简单的 prompt（"地面贴图，砖头纹理"），生成了很多高分辨率（4096×4096）的贴图，结果导入 Three.js 后帧率直接降了一半——显存占用太大了。

后来优化成：先低分辨率（1024×1024）生成，确定能用后，再高分辨率（2048×2048）出最终版 + 加载时压缩。AI 生成了大约 15 张贴图，真正用到游戏里的只有 6 张——其他的要么风格不匹配，要么颜色不对。

### FBX 加载的坑

AI 生成或下载的 FBX 文件经常缺少版本信息。`Three.js` 的 `FBXLoader` 在加载时先检查文件头里的版本号——有些 FBX 文件头不完整，导致 `Cannot find version number` 错误。

修复方案（来自 2026-07-01 的 ADR）：在加载前检查 FBX 文件头的前 30 个字节，如果缺少版本信息，手动补一个默认版本号。这个补丁加上后，所有的 FBX 文件都能正常加载了。

---

## WebGPU 就绪

前端优化的最终目标是 WebGPU 就绪。当前 Phase 已通过 IRenderer 抽象隔离了 Three.js 具体实现，切换到 WebGPU 只需改 ~15 行代码。

WebGPU 对多人游戏来说意味着什么？**更低的 CPU 开销**。Three.js 的 WebGL 渲染器在绘制大量对象时，CPU 端的 driver overhead 很大——每个 draw call 都需要 CPU 参与。WebGPU 的 compute shader 可以直接在 GPU 上处理大量数据，CPU 只负责提交命令缓冲区。

不过 WebGPU 的计划目前还停留在"ready 但未启用"的状态——因为移动端 WebGPU 的覆盖还不够（iOS Safari 需要到 iOS 18 才完全支持）。等移动端比例上来后再切。

---

下期讲 **P28：通信可靠性与错误处理模式**——WS 断连、重连、竞态、防御式编程。

**下一篇：[Vibe Coding 多人游戏（二十八）—— 通信可靠性与错误处理模式](https://www.cnblogs.com/chaogex/p/21195307)**
