# Vibe Coding 多人游戏（三十一）—— 前端性能优化（含 AI 素材管线）

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

多人游戏的前端性能优化和单机不太一样——不仅要考虑渲染帧率，还要考虑网络延迟、状态同步、多人场景下的资源管理。

---

## SoA 状态管理

Phase 7 的 SoA Store 是性能优化的基础：

| Store | 数据 | 更新频率 | 映射目标 |
|-------|------|---------|---------|
| TransformStore | positions（Float32Array） | 每帧 | GPU StorageBuffer |
| VisualStore | flags（Uint8Array） | 低频 | SAB 共享 |
| RenderFrameData | 渲染数据 | 每帧 | CPU→GPU |

Float32Array 连续内存 + 固定 stride（64 字节）→ Cache locality 极高，GC 压力极低。

---

## 帧管理优化

| 优化 | 效果 |
|------|------|
| 服务端 tick 10fps（生产） | 降低服务端负载 |
| 插值缓冲区 2 帧 | 平滑渲染（前端 60fps） |
| 本地预测 | 消除输入延迟 |
| 服务端修正 | 防止累积误差 |

生产环境 tick 10fps，每次广播 1-2KB，带宽消耗约 10-20KB/s——2 人场景下完全可接受。

---

## 双轨动画性能

MMD（巨人）和 FBX（小人）的动画计算是在不同的路径上跑的。策略：**服务端只下发 isMoving 布尔值，前端自己做动画混合。**

服务端不需要知道 VMD 和 FBX 的区别——它只告诉前端"这个角色在不在动"，前端根据模型类型做对应的动画切换。

---

## AI 素材管线

3D 游戏缺不了素材（模型、动画、贴图）。GTS-Play 的素材来源：

| 素材 | 来源 | 格式 | AI 参与 |
|------|------|------|---------|
| 巨人模型 | PMX 模型 | MMD | MMDLoader |
| 小兵模型 | FBX 模型 | FBX | FBXLoader |
| 场景 | Procedural 生成 | Three.js | 算法生成 |
| 贴图 | AI 生成 | PNG | Stable Diffusion |

AI 生成贴图的流程：写 prompt → SD 出图 → 压缩 → 导入 Three.js。一次生成可能要 5-10 次才能达到可用质量。

---

## WebGPU 就绪

前端优化的最终目标是 WebGPU 就绪。当前 Phase 已通过 IRenderer 抽象隔离了 Three.js 具体实现，切换到 WebGPU 只需改 ~15 行代码。

---

下期讲 **P32：通信可靠性与错误处理模式**——WS 断连、重连、竞态、防御式编程。

**下一篇：[Vibe Coding 多人游戏（三十二）—— 通信可靠性与错误处理模式](https://www.cnblogs.com/chaogex/p/21195307)**
