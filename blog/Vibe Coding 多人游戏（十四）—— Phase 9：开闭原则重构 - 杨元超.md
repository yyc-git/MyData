# Vibe Coding 多人游戏（十四）—— Phase 9：开闭原则重构

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

前面的 8 个 Phase 都在"搭架子"——状态同步、Monorepo、双服务、Logic 层、SCF 部署。到了 Phase 9，架子搭完了，剩下一个关键问题：

**单机版的代码怎么和多人版的代码共存而不冲突？**

单机版「巨大娘的玩耍」是个成熟的商业产品，不能因为多人功能去改它的代码。每一次修改都可能引入 regression——玩家在单机模式下因为多人代码的改动而崩溃，那才是最大的灾难。

---

## 开闭原则

**对扩展开放，对修改关闭**——这是面向对象设计的原则，在 AI 协作时代变得尤其重要。

```
单机代码（核心游戏）
    ↑ 零改动
    │
多人代码（business_layer/multiplayer/）
    ↑ 只新增
    │
渲染层（render_layer/）
    ↑ 只新增
    │
共享逻辑（logic_layer/）
    ↑ 纯函数
```

核心规则：**单机代码文件一行不改。** 所有多人功能都放在新增的目录里。

---

## 目录隔离：business_layer/multiplayer/

```
frontend/src/
├── scene3d_layer/          ← 单机代码（零改动）
│   ├── state/
│   ├── type/
│   └── ...
│
├── business_layer/
│   └── multiplayer/        ← 多人代码（独立目录）
│       ├── ManageScene.ts    ← 多人场景管理
│       ├── MultiplayerLoop.ts← 多人循环（rAF + 状态同步）
│       └── ...
│
├── render_layer/           ← 渲染层（部分新增多人渲染器）
│   ├── Render.ts             ← 单机渲染
│   ├── MultiplayerRender.ts  ← 多人渲染（新增）
│   └── ThirdPersonCamera.ts
│
├── render_interface/       ← IRenderer 抽象层
│   └── ThreeRenderer.ts
│
└── logic_layer/            ← 共享逻辑
    ├── CommandManager.ts     ← 命令管理
    ├── InterpolationBuffer.ts← 插值缓冲区
    ├── PredictionSystem.ts   ← 预测+修正
    └── OBBComputer.ts        ← 凸包碰撞计算
```

`MultiplayerLoop.ts` 是多人版的入口：

```typescript
// MultiplayerLoop — 完全在 business_layer/multiplayer/ 内
// 不修改任何单机代码文件

export function initForMultiplayer() {
    // 初始化多人渲染器、场景、WS 连接
}

export function loopForMultiplayer(usedFPS) {
    // 1. 读取输入 → 发送到服务端
    // 2. 接收 GameState → 更新插值缓冲区
    // 3. 本地预测 + 服务端修正
    // 4. 渲染
    requestAnimationFrame(() => loopForMultiplayer(usedFPS))
}

export function stopMultiplayerLoop() {
    // 清理 keyboard listener、rAF、WS 连接
    // 确保回到单机模式时没有残留
}
```

---

## 状态隔离

单机和多人共用 `scene3d_layer/state/State.ts`，但通过 `getMultiplayerState` 区分：

```typescript
// State.ts 中
export function getMultiplayerState(state) {
    return state.multiplayer
}

export function setMultiplayerState(state, mpState) {
    return { ...state, multiplayer: mpState }
}
```

多人状态全部放在 `state.multiplayer` 这个子字段下。单机代码根本不看这个字段——不会冲突、不会污染。

---

## 渲染隔离

多人版需要一个独立的渲染器实例。我们抽象了 IRenderer 接口：

```typescript
// render_interface/ThreeRenderer.ts
export class ThreeRenderer {
    constructor(canvas) { /* 初始化 Three.js WebGLRenderer */ }
    render(scene, camera) { this._renderer.render(scene, camera) }
    dispose() { this._renderer.dispose() }
}
```

单机模式下用默认的 Render，多人模式下用 MultiplayerRender。两者共享同一套 IRenderer 接口，但实现完全独立。

---

## 多人退房清理

开闭原则最难的地方不是"加"而是"删"。两个玩家退出房间后，必须把多人状态清干净，回到单机模式：

```typescript
// Manager.ts — dispose
export let dispose = (state) => {
    state = Game.dispose(state)     // 清理 tick loop
    state = Room.dispose(state)     // 清理房间状态
    return state
}
```

每个模块的 dispose 负责清理自己的资源：
- clearInterval 定时器
- 断开 WS 连接
- 清空插值缓冲区
- 销毁多人渲染器
- 恢复单机键盘绑定

**😤 坑：退房状态残留**

有一个 bug 反复出现——`gameStop` 后某个 flag 没重置。下一局时，`isEnterGame` 还是 true，玩家进不了游戏。

**解决：** 维护了一张"退出时需重置的 flag 清单"，dispose 时逐项清空。

---

## 为什么开闭原则对 AI 协作特别重要

传统开发中，开闭原则是"好代码"的标志之一。但在 AI 协作中，它是**必需品**：

1. **AI 不知道什么不能改**：给它一个 5000 行的文件让它"加一个功能"，它很可能把不相干的地方改出 bug。隔离之后，AI 只能在 `business_layer/multiplayer/` 里写代码，单机文件它碰不到。

2. **归因清晰**：出现 bug，先定位是单人还是多人。多人 bug 只在 multiplayer 目录里找，不会怀疑到单机代码。

3. **测试范围明确**：单机测试不需要重新跑，多人测试只覆盖 `business_layer/`。

> **开闭原则 = AI 协作时代的第一架构约束。**

---

## 阶段总结

Phase 9 没有引入新功能，但给所有后续开发上了"保险"：

| 要求 | 实现 |
|------|------|
| 单机代码不修改 | `business_layer/multiplayer/` 隔离 |
| 状态不冲突 | `state.multiplayer` 子字段 |
| 退出后无残留 | 模块级 dispose + flag 重置清单 |
| AI 不污染 | 改代码范围限定在隔离目录内 |

**这就是为什么我敢让 AI 持续修改多人代码——因为它改错了也影响不了单机版。**

---

下期开始转入另一个话题：**WebGPU 与多线程调研方案**——SOA 架构的真正目标？

**下一篇：[Vibe Coding 多人游戏（十五）—— WebGPU 与多线程调研与架构就绪](https://www.cnblogs.com/chaogex/p/21195307)**
