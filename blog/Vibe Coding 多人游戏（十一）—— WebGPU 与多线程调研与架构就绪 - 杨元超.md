# Vibe Coding 多人游戏（十一）—— WebGPU 与多线程调研与架构就绪

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

2026 年 6 月，Three.js 0.184 的 WebGPU 支持终于来到了可用状态（iOS Safari 26+ / Chrome Android 149+）。

渲染路径一直是 Three.js WebGL，但单机版有 GPU Skin 和 EffectComposer 后处理管线的成功经验，多人版应该提前准备 WebGPU + 多线程就绪架构。

这篇是调研，不是实施。文章记录了我们在 2026 年 6 月 20 日前后，作为一个独立游戏开发者团队（就是我和 AI 两个），如何分析"要不要上 WebGPU"、"怎么渐进式地迁移"、"多线程架构怎么落"。

---

## 为什么要在现阶段做这件事

2026 年 6 月，GTS-Play 多人版还处于极早期——只有两个玩家在网格平面上走路、碰撞、切换动画。连真实的游戏循环都没有跑通。

为什么要在 MVP 还没完全跑通的时候就开始调研 WebGPU 和 Worker 线程？

答案很简单：**游戏本来就要支持 WebGPU 和多线程。** 从单机版开始这个规划就在路线图上——单机版有 GPU Skin 和 EffectComposer 后处理管线的成功经验，多人版不可能永远停留在 WebGL。这次趁着重写的机会一步到位做好架构准备。

调研的目的不是现在实现，而是现在就进行架构的相关设计和准备，便于在将来零成本地快速迁移，无需再重写。这不是一个「要不要做」的判断，而是一个「什么时候做最划算」的判断。

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

为什么这么少？因为在 Phase 8（大重构）的时候，我就坚持做了一件事——**IRenderer 抽象层**。

IRenderer 是所有 Three.js 调用的唯一入口。它的设计是这样的：

```
ThreeRenderer.ts  ← 所有 Three.js 调用集中在这里
                    ├── 类型（WebGLRenderer → WebGPURenderer）
                    ├── 构造函数（new WebGLRenderer → new WebGPURenderer）
                    └── dispose 守卫
```

其他所有文件（`ManageScene.ts`、`MultiplayerRender.ts`）只引用 `IRenderer` 接口，不直接引用 Three.js 的任何具体类。接口方法都是纯数据操作：

```typescript
// IRenderer.ts — 抽象接口（节选）
export interface IRenderer {
    init(canvas: HTMLCanvasElement): Promise<RenderContext>
    dispose(): void
    
    loadFbxModel(url: string): Promise<FbxModelHandle>
    addEntity(id: string, modelHandle: FbxModelHandle): EntityHandle
    setPosition(id: string, position: [number, number, number]): void
    setRotationY(id: string, angle: number): void
    
    createMixer(entityId: string): MixerHandle
    createAction(mixer: MixerHandle, modelHandle: FbxModelHandle, clipIndex: number): ActionHandle
    
    render(): void
    
    // WebGPU/multi-thread 预留接口
    getBackendCapabilities?(): BackendCapabilities
    syncFromEntityStore?(transformStore: TransformStore, visualStore: VisualStore, slots: Map<string, number>): void
    createComputePass?(name: string, computeNode: any): void
    setPostProcessing?(pipeline: any): void
}
```

**迁移成本：~15 行。** 不是 15 个文件，是 15 行代码——就在 `ThreeRenderer.ts` 这一个文件里改。

---

## GPU-Driven Pipeline

WebGPU 的真正价值不是"换一个渲染后端"，而是**GPU-Driven Pipeline**——用 Compute Shader 在 GPU 上做 CPU 的工作。

以 GTS-Play 的场景为例：单机版里巨大娘一个人对几百个小人，GPU 蒙皮把动画计算搬到 GPU 后帧率从 30fps 提升到了 60fps。如果多人版里每局有 4 个巨大娘 + 几十个小人，CPU 的计算量会爆炸。WebGPU 的 Compute Shader 正好做这个事。

### Three.js 0.184 的积木盒

Three.js 0.184 的 WebGPU 实现提供了一组 TSL（Three.js Shader Language）积木，可以拼出 GPU-Driven 管线：

| 积木 | 用途 | GTS-Play 多人适用性 |
|------|------|:---:|
| ComputeNode | Compute Shader | ✅ |
| StorageBufferNode | GPU 读写 buffer | ✅ |
| IndirectStorageBufferAttribute | drawIndirect | ✅ |
| AtomicFunctionNode | GPU 原子计数器 | ✅ |
| BarrierNode | Compute 同步屏障 | ✅ |
| SkinningNode | 内置 GPU 蒙皮 | ✅ |
| BatchNode + BatchedMesh | GPU 批次合并 | ✅ |
| ViewportDepthTextureNode | Hi-Z 基础 | 🟡 |

### 各项技术的把握度分析

我们逐项分析了每条 GPU-Driven 技术在 GTS-Play 上的落地难度：

| 技术 | 把握度 | 预估工期 | 分析过程 |
|------|:------:|:--------:|----------|
| **GPU LOD（距离筛选）** | 85% | 1-2周 | 逻辑简单——Compute Shader 里比较距离，写入 LOD 等级。积木齐全（ComputeNode + StorageBuffer），唯一风险是 TSL 的文档覆盖不够 |
| **Instance Frustum Cull** | 75% | 2-3周 | 成熟模式，three.js 社区的 GpuParticles 里有参考。风险在集成——需要改渲染循环，把原来的 forEach draw 改为 Indirect Draw |
| **GPU 碰撞检测** | 75% | 2周 | 逻辑简单——比较 AABB/OBB 的分离轴，所有数据已在 GPU。瓶颈在 Readback——计算结果要从 GPU 读回 CPU（碰撞需要触发游戏逻辑，必须在 CPU 处理） |
| **Hi-Z 遮挡剔除** | 55% | 4-6周 | 多 pass 调度不确定——需要先渲染 Depth Pyramid → Compute Shader 剔除 → 再渲染可见物体。Three.js 的 DepthTextureNode 可用，但多 pass 的编排依赖还不成熟 |
| **Meshlet Triangle Cull** | 25% | 研究级 | 需要 Mesh Shader + 离线工具生成 meshlet。three.js 没开箱支持，属于研究阶段。三人场景不需要这么极端的优化 |

结论很明确：**三人场景不需要 GPU-Driven。** 当下的服务器（15FPS tick）和客户端（60FPS 渲染）负载极低，WebGPU 的价值是"为未来做准备"——如果以后要在单机场景里加大量 NPC 或者扩大多人房间人数时，GPU-Driven 是从 30fps 到 60fps 的关键。

---

## TSL：从 EffectComposer 到积木式后处理

WebGPU 下，EffectComposer 不可用。它是 WebGL 专用的——内部依赖 `readPixels` 和 `Framebuffer Texture`，WebGPU 的架构不同。

替代方案是 **TSL（Three.js Shader Language）**。TSL 是 Three.js 0.184+ 引入的积木式 Shader 构建系统，运行在 WebGPU 和 WebGL 2 两套后端上。

```javascript
// WebGL 旧做法（不可迁移到 WebGPU）
const composer = new EffectComposer(renderer)
const filmPass = new FilmPass(0.5, false)
composer.addPass(filmPass)

// WebGPU 新做法（TSL）
import { film } from "three/tsl"
const filmEffect = film({ intensity: 0.5 })
renderer.outputNode = filmEffect
```

TSL 的优势是积木式组合——把不同效果像搭积木一样串起来。比如加一个 bloom 效果：

```javascript
import { bloom } from "three/tsl"

const sceneColor = renderer.outputNode
const bloomEffect = bloom({ intensity: 1.5, radius: 0.4 })
renderer.outputNode = sceneColor.mix(bloomEffect, 0.3)
```

TSL 的另一个优势是类型安全——在 TypeScript 中能检查出错误参数，而 EffectComposer 的 `addPass` 是运行时才能发现的类型不匹配。

但 TSL 的缺点也明显：**文档太少**。Three.js 0.184 的 TSL API 还没有完整的文档，主要靠阅读源码和官方示例学习。

---

## 多线程三线程架构

多人场景下，多线程是比 WebGPU 更紧迫的需求。

单机版的场景里，碰撞检测和动画更新量不大，主线程扛得住。但多人版里每帧要做：N 个玩家的位置插值 + 动画混合 + 碰撞检测 + HUD 更新 + 相机跟随 + 渲染提交。而且 WebSocket 消息处理的回调也在主线程。

**Logic Worker** 是把碰撞计算从主线程卸掉的第一步——这部分不依赖 WebGPU，现在就能做。

### 三线程架构设计

```
┌─────────────────────────────────────┐
│          主线程（Main Thread）        │
│  Game Logic + 渲染同步 + ECS 状态管理 │
│  ── 写 EntityStore（纯数据）          │
│  ── 真正的游戏逻辑（指令处理）         │
└──────────┬──────────────────────────┘
           │ SharedArrayBuffer
           ▼
┌─────────────────────────────────────┐
│   Logic Worker                      │
│   凸包碰撞（SAT 分离轴定理）          │
│   MMD/FBX 动画骨骼矩阵计算           │
│   ← 不依赖 WebGPU，近期可做          │
└─────────────────────────────────────┘
           │ SAB（SharedArrayBuffer）
           ▼
┌─────────────────────────────────────┐
│   Render Worker （远期）             │
│   OffscreenCanvas + WebGPURenderer  │
│   角色 >20 个时才需要               │
└─────────────────────────────────────┘
```

### SAB 共享内存架构的设计

SAB（SharedArrayBuffer）是核心。每个 Worker 通过 SAB 读写同一块内存，零拷贝，不经过 `postMessage` 序列化。

我们设计的 EntityStore 的数据布局：

```typescript
/**
 * EntityStore — 纯数据的内存布局
 * 
 * 单槽位 64 字节（缓存行对齐，避免 false sharing）
 * 最大 64 个实体
 * 
 * 当前在普通 ArrayBuffer 上，将来切 SAB 只改一行：
 *   new EntityStore() → new EntityStore(new SharedArrayBuffer(...))
 */

const ENTITY_STRIDE = 64   // 字节（每个实体）
const MAX_ENTITIES = 64

// 字段偏移（bytes）
const OFF_POS_X    = 0   // f32 — 位置 X
const OFF_POS_Y    = 4   // f32
const OFF_POS_Z    = 8   // f32
const OFF_ROT_Y    = 12  // f32 — 绕 Y 轴旋转
const OFF_SCALE    = 16  // f32 — 缩放
const OFF_VISIBLE  = 20  // u8  — 0=隐藏, 1=可见
const OFF_LOD      = 21  // u8  — 0=高, 1=中, 2=低
const OFF_COLLISION= 22  // u8  
const OFF_MODEL    = 23  // u8  — 0=MMD, 1=FBX, 2=swarm
const OFF_ANIM_ID  = 24  // u8  — 当前动画索引
const OFF_ANIM_TGT = 25  // u8  — 过渡目标动画索引
const OFF_ANIM_CF  = 28  // f32 — 动画过渡进度 0-1
// 32 bytes 预留扩展空间

type EntityStore = {
    buffer: ArrayBuffer
    f32: Float32Array    // 4字节对齐读取 f32
    u8: Uint8Array       // 1字节对齐读取 u8
}

// 创建 EntityStore —— 纯函数，无副作用
function createEntityStore(sharedBuffer?: ArrayBuffer): EntityStore {
    const buf = sharedBuffer ?? new ArrayBuffer(ENTITY_STRIDE * MAX_ENTITIES)
    return { buffer: buf, f32: new Float32Array(buf), u8: new Uint8Array(buf) }
}

// set / get 都是纯函数——state in, state out
// 虽然是 in-place 写 typed array（性能必须），但接口设计是函数式的
function setPosition(store: EntityStore, slot: number, x: number, y: number, z: number): void {
    const off = slot * (ENTITY_STRIDE / 4)
    store.f32[off + OFF_POS_X/4] = x
    store.f32[off + OFF_POS_Y/4] = y
    store.f32[off + OFF_POS_Z/4] = z
}
    
function getPosition(store: EntityStore, slot: number): [number, number, number] {
        const off = slot * (ENTITY_STRIDE / 4)
        return [this.f32[off], this.f32[off+1], this.f32[off+2]]
    }
}
```

双缓冲设计避免读写冲突：

```
Header (64B)    ├── 帧号 (u32)
                ├── 写锁状态 (u8: 0=Free, 1=Writing, 2=Dirty)
                └── 标志位 (u8 bitfield)
                
Frame A (~256KB) ← 主线程写入
Frame B (~256KB) ← Worker 读取

Result (~1KB)    ← Worker 写入碰撞结果
```

主线程写 Frame A 时，Worker 读 Frame B。下一帧交换（ping-pong），主线程写 Frame B，Worker 读 Frame A。不需要锁——用帧号确保双方读写的 buffer 不同。

### 核心障碍：Three.js Scene 不能跨线程

三线程架构最大的难点不是 SAB 的设计，而是 **Three.js Scene 不能跨线程**。

WebWorker 无法访问 DOM，无法操作 `HTMLCanvasElement`。Three.js 的 `THREE.Scene`、`THREE.Mesh`、`THREE.Skeleton` 都是不可序列化的对象——它们内部持有大量 WebGL 资源（VAO、Buffer、Texture），这些资源在 WebWorker 中无法访问。

折中方案是 SAB 存纯数据，Render Worker 维护独立的 Scene + 对象池：

```
主线程:
  更新 TransformStore.positions（Float32Array）
  → 同步到 SAB

Render Worker:
  读 SAB → 更新本地对象池的 position / rotation
  → 调用 renderer.render(scene, camera)
  使用 OffscreenCanvas（可被 Worker 控制）
```

对象池是一块预分配的 `THREE.Object3D` 数组。主线程在 WebWorker 之外创建好，Workers 通过 `transferControlToOffscreen` 获取 Canvas 控制权，然后从 SAB 读数据更新对象池的位置。

但这里有一个遗留问题没有完全解决：**MMD 的 SkinnedMesh 骨骼矩阵计算能否在 Worker 中做？** Three.js 的 `MMDLoader` 和 `MMDAnimationHelper` 内部操作了大量 DOM 和纹理，不一定能在 Worker 中直接运行。这部分我们评估为"需要原型验证"。

---

## SOA 架构的真正目标

P8 重构后 EntityStore 已经采用了 SoA（Struct of Arrays）布局——`TransformStore.positions` 是 Float32Array，`VisualStore.flags` 是 Uint8Array。这个设计不是为了单纯调性能，更深层的原因是——**SoA 是为即将到来的多线程 + WebGPU 架构铺路的**。

| SoA 组件 | 映射目标 | 为什么重要 |
|---------|---------|-----------|
| `TransformStore.positions`（Float32Array） | GPU Compute Shader input | GPU 不吃对象，吃连续内存。Float32Array 直接做 Storage Buffer |
| `VisualStore.flags`（Uint8Array bitfield） | SAB 低频同步 | 布尔值用 bitfield 压缩，一批 64 个实体只要 8 字节 |
| 固定 64 字节实体槽 | 切 SAB 只改一行构造函数参数 | `new ArrayBuffer(4096)` → `new SharedArrayBuffer(4096)` |
| `IRenderer.syncFromEntityStore()` | Worker 批量同步 | 替代逐个 `setPosition()`，一次调用同步全部实体 |

IRenderer 接口也预置了批量同步方法：

```typescript
// IRenderer.ts 中预留
syncFromEntityStore?(
    transformStore: TransformStore, 
    visualStore: VisualStore, 
    slots: Map<string, number>
): void
```

这个方法的作用是：从 TransformStore（Float32Array 结构）批量读取所有实体的位置/旋转/可见性，然后一次更新 Three.js 渲染对象池。这样渲染循环只需要调用 `syncFromEntityStore` 一次，不需要逐个 `setPosition`。

**如果当初选了 Immutable.js 或者简单 Js.Dict，现在迁移到 WebGPU + 多线程就需要重写整个渲染管线。** SoA 设计的价值在当下看不明显，但在跨架构迁移时体现出来了。

---

## WebGPU 与 WebGL 自动回退

WebGPU 还没有得到所有浏览器支持（QQ/UC/百度浏览器不支持）。所以我们的设计里必须有回退机制。

Three.js 0.184 的 `WebGPURenderer` 内置了自动回退：

```typescript
// 自动回退：如果浏览器不支持 WebGPU，降级到 WebGL2
const renderer = new WebGPURenderer({ antialias: true, canvas })

// 在不支持 WebGPU 的浏览器中：
// WebGPURenderer 内部检测到 GPU 不可用 → 自动创建 WebGLRenderer
// 零代码改动
```

但我们不会只依赖 Three.js 内置的回退。IRenderer 接口里有 `getBackendCapabilities()` 方法，前端可以主动检测，选择不同的渲染策略：

```typescript
const caps = renderer.getBackendCapabilities()

if (caps.type === 'webgpu') {
    // 用 TSL 后处理
    renderer.outputNode = film({ intensity: 0.5 })
} else {
    // 回退到 EffectComposer（WebGL 模式）
    const composer = new EffectComposer(renderer)
    // ...
}
```

移动端的 WebGPU 支持情况（2026年6月）：
- Chrome Android 149+ → ✅ 
- Safari iOS 26.0+ → ✅
- QQ/UC/百度浏览器 → ❌ 走 WebGL2 回退

估计 45-65% 移动用户能用 WebGPU。随着浏览器版本升级，这个比例还会上升。

---

## 零成本省钱原则

> **现在克制 = 将来迁 WebGPU 1 周 + 加多线程 2-3 周**
> 
> **现在复刻全部单机功能（EffectComposer + GLSL 蒙皮）= 将来还债 9-14 周**

```text
现在克制（不碰 WebGL 专用 API）:
  将来迁 WebGPU:  1周
  将来加多线程:   2-3周
  总债务:        ~3-4周

现在复刻全部单机功能（EffectComposer + GLSL 蒙皮）:
  现在投入:       4-6周（做单机移植）
  将来迁 WebGPU:  6-9周（重写后处理+蒙皮）
  将来加多线程:   3-5周  
  总债务:        ~9-14周

规律: 现在每加一个 WebGL 专用 API → 将来还 2-3 倍利息
```

基于这个分析，我们定了几条**铁律**：

- 🟢 **后处理走 TSL，不走 EffectComposer**——EffectComposer 是 WebGL 专用的，写了以后必须重写
- 🟢 **不用 `getContext()` / `getExtension()`**——这些是 WebGL 的上下文方法，WebGPU 不提供
- 🟢 **不用 `onBeforeCompile`**——Three.js 内置 shader hook，在 WebGPU 下不再可用
- 🔴 **不加新的 WebGL 专用 API**——任何对特定渲染后端的硬依赖都会增加未来迁移成本
- 🔴 **不碰 WebGL context API**——`gl.getParameter()`、`gl.createBuffer()` 等直接操作

执行这些原则的过程中也有纠结。比如多人版里要不要加一个发光边框效果，我知道 WebGL 下可以用 EffectComposer 的 `OutlinePass` 做，3 天就能搞定。但如果做了，将来切换到 WebGPU 后还得重写。最后决定**先不做**——等 WebGPU 切换后再用 TSL 做。

---

## 实施路线图

```text
Phase 1（已做完 2026年6月）：EntityStore 基建
  ├── TransformStore + VisualStore + 对象池
  │   └── 格式已设计为 SOA（Struct of Arrays），直接映射 SAB
  ├── IRenderer 抽象
  │   └── 预留 syncFromEntityStore / BackendCapabilities
  └── IRenderer.ts 中有 GET / SET 纯函数
      └── 所有多人代码不直接操作 Three.js

Phase 2（近期 1-2周）：Logic Worker
  ├── MMD/FBX 动画计算卸到 Worker
  │     └── 骨骼矩阵在 Worker 中计算，写回 SAB
  └── 凸包碰撞在 Worker 中并行计算
        └── SAT 分离轴定理，可并行处理多个碰撞对

Phase 3（中期 1周）：WebGPU 切换
  ├── ThreeRenderer 双后端（WebGL/WebGPU）
  │     └── ~15 行代码改动
  ├── 自动回退（不支持 WebGPU 的浏览器自动走 WebGL2）
  └── TSL 后处理
        └── 替代 EffectComposer

Phase 4（后期 2-3周）：GPU-Driven
  ├── GPU 碰撞检测（第一优先级）
  │     └── Compute Shader 并行碰撞 + Readback 到 CPU
  ├── GPU LOD（距离筛选）
  │     └── Compute Shader 比较距离 → 写入 LOD level
  └── Instance Frustum Cull
        └── 串在 GPU LOD 后面，用 Indirect Draw

Phase 5（远期 4-6周）：Render Worker
  ├── OffscreenCanvas + WebGPURenderer
  │     └── 需要 SAB 双缓冲架构就绪
  │     └── 角色 >20 自动启用，否则走主线程渲染
  └── MMD 动画在 Worker 中的验证
        └── 需要原型验证 SkinnedMesh 是否可跨线程
```

每步都可独立交付，不阻塞。做不了四就停在 Phase 3，已经比纯 WebGL 快了一大截。做不了五就停在 Phase 3，主线程渲染在三人场景下完全够用。

---

## 从调研到行动：写在最后的反思

这次调研花费了大约一周时间（2026年6月13-20日），产出是四份文档：
- `多人联网架构改造-WebGPU多线程就绪.md`（36KB，最详细的技术方案）
- `WebGPU与多线程迁移分析.md`（7KB，成本收益分析）
- IRenderer 接口的扩展
- EntityStore 的原型代码

最大的收获不是技术细节，而是**一个判断框架**：现在写的每一行代码，将来是加班费还是折旧费？

- **折旧费**：IRenderer 抽象、SoA 数据层、纯函数状态管理——这些代码在迁移到 WebGPU 后仍然有用
- **加班费**：EffectComposer 后处理、WebGL 上下文操作、直接操作 Three.js 对象的代码——写在当下，活在当下，WebGPU 一来就废了

这其实也是 Vibe Coding 的一个核心观点：AI 特别擅长堆积代码，但不擅长判断架构决策的长期影响。如果没有人把关架构方向，AI 会沿着"先在 WebGL 上跑起来再说"的路径越走越远，欠下一堆技术债。

P11 就是这个把关联的案例——**一个好的架构决策，在看得见的未来里能省掉几个月的工作量。**

---

下期进入**工作流进化**板块——讲 Vibe Coding 本身的工作流怎么从手动复制粘贴进化到全自动 AI 调度。

**下一篇：[Vibe Coding 多人游戏（十二）—— AI 辅助编程 → OpenClaw 全自动 → OpenCode 引入](https://www.cnblogs.com/chaogex/p/21195307)**

