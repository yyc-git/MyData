# Vibe Coding 多人游戏（十五）—— WebGPU 与多线程调研与架构就绪

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

2026 年 6 月，Three.js 0.184 的 WebGPU 支持达到可用状态（iOS Safari 26+ / Chrome Android 149+）。

渲染路径一直是 Three.js WebGL，但单机版有 GPU Skin 的成功经验，多人版应该提前准备 WebGPU + 多线程就绪架构。

这篇是调研，不是实施。文章记录了我们怎么分析"要不要上 WebGPU"、"怎么渐进式地迁移"。

---

## 迁移成本分析

最大惊喜：**迁移只需要改 ~15 行代码**。

```typescript
// 原来（WebGL）
import { WebGLRenderer } from "three"
let renderer = new WebGLRenderer({ canvas })

// 以后（WebGPU）
import { WebGPURenderer } from "three"
let renderer = new WebGPURenderer({ canvas })

// 原来（ShaderMaterial）
new THREE.ShaderMaterial({ vertexShader: vertGLSL, fragmentShader: fragGLSL })

// 以后（TSL）
new THREE.ShaderMaterial({ vertexShader: vertTSL, fragmentShader: fragTSL })
```

为什么这么少？因为早在 Phase 9 我们就做了 IRenderer 抽象层：

```
ThreeRenderer.ts  ← 所有 Three.js 调用集中在这里
                    ├── 类型（WebGLRenderer → WebGPURenderer）
                    ├── 构造函数（new WebGLRenderer → new WebGPURenderer）
                    └── dispose 守卫
```

其他所有文件引用 IRenderer 接口，不直接引用 Three.js 具体实现。换后端只需要改 `ThreeRenderer.ts` 一个文件。

**迁移成本：~15 行。** 不是 15 个文件，是 15 行代码。

---

## GPU-Driven Pipeline

WebGPU 的真正价值不是"换一个渲染后端"，而是**GPU-Driven Pipeline**——用 Compute Shader 在 GPU 上做 CPU 的工作：

| 阶段 | 技术 | 就绪度 |
|------|------|--------|
| GPU LOD（距离筛选） | Compute Shader 裁剪不可见 lod | 85% |
| Instance Frustum Cull | GPU 裁剪不可见实例 | 75% |
| GPU 碰撞检测 | Compute Shader 并行碰撞判定 | 75% |
| Hi-Z 遮挡剔除 | Depth Pyramid 快速剔除 | 55% |
| Meshlet Triangle Cull | Nanite 风格的 Mesh Shader | 25%（研究级） |

三人场景下不需要这些优化。但单机版角色数量多时，GPU-Driven 是从 30fps 到 60fps 的关键。

**TSL（Three.js Shader Language）积木盒**

WebGPU 下，后处理不用 EffectComposer（不可用），改用 TSL：

```javascript
// EffectComposer（WebGL 专用）→ TSL
const pass = new THREE.FilmPass()
pass.setSize(width, height)

// → 改为
const filmEffect = tsl.film({ intensity: 0.5 })
```

TSL 的优势：积木式组合、类型安全、自动适配 WebGPU/WebGL。

---

## 多线程三线程架构

多人场景下，多线程是比 WebGPU 更紧迫的需求——**Logic Worker** 把碰撞计算从主线程卸掉：

```
┌─────────────────────────────────────┐
│          主线程（Main Thread）        │
│  Game Logic + 渲染同步 + ECS 状态管理 │
│  ——写 EntityStore                    │
└──────────┬──────────────────────────┘
           │ SAB
           ▼
┌─────────────────────────────────────┐
│   Logic Worker                      │
│   凸包碰撞（SAT）+ MMD/FBX 动画      │
│   ← 不依赖 WebGPU，近期可做          │
└─────────────────────────────────────┘
           │ SAB（远期）
           ▼
┌─────────────────────────────────────┐
│   Render Worker                     │
│   OffscreenCanvas + WebGPURenderer  │
│   角色 >20 个时才需要               │
└─────────────────────────────────────┘
```

**SAB 共享内存架构：**

```
Header (64B) + FrameA (~256KB) + FrameB (~256KB) + Result (~1KB)
```

- Header：帧号、写锁状态、标志位
- Frame A/B：双缓冲，主线程写 A 时 Worker 读 B，交替避免锁竞争
- Result：Worker 计算结果写入，主线程读取

**核心障碍：Three.js Scene 不能跨线程**

WebWorker 无法访问 DOM，Three.js 的 Scene 对象不可序列化。解法是 SAB 存纯数据——TransformStore 的 Float32Array 直接映射到 SAB，Worker 维护独立 Scene + 对象池。

---

## SOA 架构的真正目标

Phase 7 的 SoA Store 设计时，有人问"搞这么复杂干嘛"——因为目标不是"更好的状态管理"，而是为这里铺路：

| SoA 组件 | 映射目标 |
|---------|---------|
| TransformStore.positions（Float32Array） | GPU Compute Shader input |
| VisualStore.flags（Uint8Array bitfield） | SAB 低频同步 |
| 固定 64 字节实体槽 | 切 SAB 只需改一行构造函数参数 |
| IRenderer.syncFromEntityStore() | Worker 批量同步 |

**如果当初选了 Immutable.js 或者简单 Js.Dict，现在迁移到 WebGPU + 多线程就需要重写整个渲染管线。**

---

## 实施路线图

```text
Phase 1（已做完）：EntityStore 基建
  ├── TransformStore + VisualStore + 对象池
  └── IRenderer 抽象

Phase 2（近期）：Logic Worker
  ├── MMD/FBX 动画计算卸到 Worker
  └── 凸包碰撞在 Worker 中并行计算

Phase 3（中期）：WebGPU 切换
  ├── ThreeRenderer 双后端（WebGL/WebGPU）
  └── TSL 后处理

Phase 4（后期）：GPU-Driven
  ├── GPU 碰撞 → LOD → Frustum Cull
  └── Compute Shader 管线

Phase 5（远期）：Render Worker
  ├── OffscreenCanvas + SAB
  └── 角色 >20 自动启用
```

每步都可独立交付，不阻塞。做不了四就停在 Phase 3，已经比纯 WebGL 快了一大截。

---

## 零成本省钱原则

> **现在克制 = 将来迁 WebGPU 1 周 + 加多线程 2-3 周**

原则：
- 后处理走 TSL，不走 EffectComposer（WebGPU 下不可用）
- 不用 `getContext()` / `getExtension()` / `onBeforeCompile`
- 不加新的 WebGL 专用 API
- 现在复刻全部单机功能 → 将来还债 9-14 周

不是不做事，而是做事的方式要确保未来可迁移。

---

下期进入**工作流进化**板块——讲 Vibe Coding 本身的工作流怎么从手动复制粘贴进化到全自动 AI 调度。

**下一篇：[Vibe Coding 多人游戏（十六）—— 纯 AI 对话时代 → OpenCode 引入](https://www.cnblogs.com/chaogex/p/21195307)**
