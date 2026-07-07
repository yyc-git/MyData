# Vibe Coding 多人游戏（九）—— 迭代开发：Tick Loop、碰撞检测与状态管理演进

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

架构建好了，剩下全是细节。

从 2026-06-10 到 2026-06-28，两周时间没有架构变动，只有功能迭代和 bug 修复。这期把三个核心子系统讲清楚：**Tick Loop（服务端权威）**、**碰撞检测**、**状态管理**。它们不是按先后顺序完成的，而是交织迭代的——改一个往往要连带改另外两个。

---

## Tick Loop 与代次守卫

服务端的核心是一个 `setInterval` 驱动的 tick 循环，每次 tick 执行：收集命令 → 执行逻辑 → 碰撞伤害 → 广播状态。

```typescript
export let startTickLoop = (state: state): state => {
    // 清理旧 loop，防重复
    forEach(existingIntervaler => {
        clearInterval(existingIntervaler)
    }, getState(state).broadcastRegularlyIntervaler)

    // 代次守卫：每次启动新 loop 时递增代次
    let gen = state.room.tickGeneration + 1
    state = { ...state, room: { ...state.room, tickGeneration: gen } }

    let tickInterval = state.config.isDev ? 1000 / 30 : 1000 / 10
    let intervaler = setInterval(() => {
        let s = readState()

        // 代次守卫检测——旧 loop 自毁
        if (s.room.tickGeneration !== gen) {
            clearInterval(intervaler)
            return
        }

        s = _serverTick(s, TICK_INTERVAL_SEC)
        broadcastMsgGameState(s)
    }, tickInterval)
}
```

**代次守卫（Generation Guard）** 解决了 SCF warm container 场景下最恶心的 bug：第一局结束的 tick loop 没被清理，第二局新 loop 启动后两个在跑，玩家位置在两个 loop 之间来回跳变。代次的递增 + 每 tick 检测确保旧 loop 永远在新循环启动后自毁。

每次 tick 用 `readState()` 而非闭包引用——确保 tick 间插入的玩家加入/退出操作不被覆盖。

**绝对状态下发：** 每次 tick 下发全量 `MsgGameState`，客户端收到后直接覆盖所有玩家位置。不做逻辑判断、不合并增量、不回滚。2 人场景下每 tick 约 1-2KB，10fps = 10-20KB/s，完全可接受。

这个阶段没有做插值缓冲或状态预测——客户端收到的就是权威位置，直接 setPosition 覆盖。画面不够平滑？那是视觉效果优先级不够高，后面才回过头来优化的。

---

## 碰撞检测：从 AABB 到凸包

碰撞判断走了三步：

| 阶段 | 方案 | 问题 |
|------|------|------|
| basic1 | AABB（轴对齐包围盒） | 旋转后不准 |
| new_basic2 | OBB（有向包围盒） | 长方体对倾斜物体有空隙 |
| 生产版 | 凸包（Convex Hull + SAT） | 精确，但计算量大 |

生产版用 **SAT（分离轴定理）** 检测两个凸多面体是否重叠。对两个 OBB（每个 6 个面）需要检测 15 条分离轴：A 的 3 个面法向 + B 的 3 个面法向 + 9 个边叉积。全部不分离才判定为碰撞。

凸包算法用纯 ReScript 写在 logic 包里，两端共用：

```rescript
let isHullOverlap = (hullA: hullPart, hullB: hullPart): bool => {
  // 15 条分离轴投影测试
  // 任意轴投影不重叠 → 不碰撞（提前 return false）
  // 所有轴投影都重叠 → 碰撞
}
```

**😤 坑：** AI 巨人寻路卡住整个 tick loop。AI 路径规划在 `setInterval` 里跑，一旦目标不可达导致阻塞，所有人瞬移。解决：路径规划加 200ms 超时兜底，超时后用当前位置做目标，绝不阻塞 tick。

---

## 状态管理四轮重构

从 basic1 到生产版，状态管理重写了四次。不是因为闲得慌，每次都在解决真实问题。

### v1：Immutable.js Map（basic1）

帧同步需要快照回滚，Immutable.js 不可变数据结构天然适合。

```typescript
let state = Map({
    players: Map({
        user_1: Map({ x: 0, y: 0, hp: 100 }),
    })
})
let newState = state.setIn(["players", "user_1", "x"], 1)
```

**问题：** 包体积 ~50KB，API 学习成本高，类型推导体量爆炸，`setIn` 每次都创建新对象树增大 GC 压力。

### v2：自制 ImmutableHashMap

去掉 Immutable.js，自建轻量 HashMap。

**问题：** 自制 hash 实现有冲突 bug——某些 key 组合下数据丢失，玩家 HP 变成别人的。Zero 依赖但也 zero QA。

### v3：Js.Dict

回归 JavaScript 原生对象，最低成本方案。

```typescript
let players: { [username: string]: playerState } = {}
players["user_1"] = { x: 0, y: 0, hp: 100 }
```

**问题：** `players["nonexistent"]` 返回 `undefined` 但 TypeScript 不强制检查，深拷贝得自己写。

### v4：SoA Store（最终版）

彻底重构——按职责拆 Store，按数据性质拆 Layout。

```typescript
// AoS 模式（之前）
players = {
    user_1: { position: {x,y,z}, visual: {}, hp: 100 },
}

// SoA 模式（之后）
TransformStore.positions = Float32Array([x1,y1,z1, x2,y2,z2, ...])
VisualStore.flags = Uint8Array([moving_bit | collision_bit, ...])
```

**优点：** 连续内存提升 cache locality，TypedArray 零 GC，TransformStore 和 VisualStore 分离减少互相污染，Float32Array 直接映射 GPU StorageBuffer 为 WebGPU 做好准备。

| 版本 | 体积 | GC | 类型安全 | WebGPU 就绪 |
|------|------|----|---------|------------|
| v1 Immutable.js | ~50KB | ❌ | ✅ | ❌ |
| v2 自建 HashMap | 0 | ❌ | ⚠️ | ❌ |
| v3 Js.Dict | 0 | ✅ | ⚠️ | ❌ |
| **v4 SoA** | **0** | **✅** | **✅** | **✅** |

唯一的教训：**别在运行时容器上过度抽象。** Immutable.js 漂亮但太重，自建 HashMap 太脆弱，原生对象最稳。SoA 不是为性能而性能，是为了 WebGPU 就绪——但大部分时间 Js.Dict 就够了。

---

## 双轨动画

两种模型格式（MMD + FBX）在这个阶段自然共存，各有独立的加载器和动画管理器：

MMD 巨大娘（PMX + VMD 动画）和 FBX 小人（FBX + mixamo 动画）各自有自己的加载器和动画管理器。前端通过 `isMoving` 布尔值切换 idle/walk 动画——状态同步的最大好处：动画是纯渲染层问题，服务端不需要知道 VMD 和 FBX 的区别。

**😤 坑：动画 clip 重名。** FBX 动画 clip 都叫 `'mixamo.com'`，`mixer.clipAction` 按名字返回同一个 action。解决：加载后重命名为 `idle`/`run`。

---

## BDD 测试体系建立

迭代期间同步建立了 BDD 测试体系。到 2026-06-10 已有 **37 个场景全部通过**：

| 模块 | 场景数 |
|------|--------|
| frontend: CameraManager | 10 |
| frontend: InputManager | 6 |
| frontend: MultiplayerHelpers | 4 |
| logic: Movement | 5 |
| room-service: Game | 4 |
| match-service: FindRoom | 8 |

后续每修一个 bug、每加一个功能，都先补测试再改代码——这是项目质量从不失控的根本原因。

---

## 总结

架构搭建之后，真正的工作是**在约束内做迭代**：

- 单机代码不改（开闭原则）
- 纯函数 logic 包两端复用
- BDD 测试先写后改
- 绝对状态下发，客户端不推理

两周时间，从"能跑的原型"变成了"能玩的联机游戏"。

下一期讲实战中最痛苦的部分——**SCF 部署 6 连环坑**。

**下一篇：[Vibe Coding 多人游戏（十）—— SCF 部署 6 连环坑](https://www.cnblogs.com/chaogex/p/21195307)**
