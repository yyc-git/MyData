# Vibe Coding 多人游戏（十一）—— Phase 6：服务端权威完整实现

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

Phase 2 切换到状态同步时，服务端已经做了简单的游戏循环。但当时只是 demo——真正的生产级实现还有一堆细节要填。

Phase 6 把服务端从"能跑的 demo"升级为"完整的游戏服务器"。核心变化：

---

## 1. Tick Loop 与代次守卫

服务端的核心是一个 `setInterval` 驱动的 tick 循环：

```typescript
export let startTickLoop = (state: state): state => {
    // 清理已有 tick loop，防止重复调用
    forEach(existingIntervaler => {
        clearInterval(existingIntervaler)
    }, getState(state).broadcastRegularlyIntervaler)

    // 代次守卫：每次启动新 loop 时递增代次
    let gen = state.room.tickGeneration + 1
    state = { ...state, room: { ...state.room, tickGeneration: gen } }

    let tickInterval = state.config.isDev ? 1000 / 30 : 1000 / 10
    let intervaler = setInterval(() => {
        let s = readState()

        // 🔴 代次守卫检测
        if (s.room.tickGeneration !== gen) {
            clearInterval(intervaler)  // self-kill
            return
        }

        s = _serverTick(s, TICK_INTERVAL_SEC)
        let players = prepareBroadcastPlayers(s)
        broadcastMsgGameState(s, players)
    }, tickInterval)
}
```

**代次守卫（Generation Guard）** 解决了 warm container 场景下最恶心的 bug：

SCF 的 warm container 机制会导致定时器残留。假设：
1. 第一局游戏启动 tick loop（gen=1）
2. 玩家退出，tick loop 在清理前又收到一次 tick
3. 第二局新玩家进入，启动新 tick loop（gen=2）
4. **两个 tick loop 同时跑**，都在广播状态——玩家位置在两个 loop 之间来回跳变

代次的递增 + 检测逻辑确保了旧 loop 的 setInterval 永远不会污染新游戏：

```typescript
// 旧 loop（gen=1）检测到 gen 不匹配，自毁
if (s.room.tickGeneration !== gen) {
    clearInterval(intervaler)  // 我没有死，只是被替代了
    return
}
```

---

## 2. 核心循环：收集 → 执行 → 广播

每个 tick，服务端依次执行：

```typescript
let _serverTick = (state, deltaTime) => {
    // 1. 收集未处理的命令
    let pendingCommands = state.room.pendingCommands

    // 2. 执行所有命令
    pendingCommands.forEach(command => {
        if (!isDefeated(state, command.username)) {
            serverState = executeCommand(serverState, command)
        }
    })

    // 3. 碰撞伤害计算
    serverState = computeCollisionDamage(serverState, deltaTime)

    // 4. 检测击败/游戏结束
    //    所有小人 HP ≤ 0 → 巨大娘胜利
    //    超时 → 小人胜利

    // 5. 广播全量状态
    let players = prepareBroadcastPlayers(s)
    server.broadcastMsg('GameState', { players })
}
```

关键细节：**每次 tick 重新读 state（readState()）**，而非用闭包中的旧引用。这是为了确保 tick 间插入了其他操作（如玩家加入/退出）时不会被覆盖。

---

## 3. 凸包碰撞检测

碰撞检测是服务端最重的计算。从 basic1 的 AABB（轴对齐包围盒），到 new_basic2 的 OBB（有向包围盒），Phase 6 升级到了**凸包（Convex Hull）**。

凸包碰撞用 SAT（分离轴定理）检测两个凸多面体是否重叠：

```rescript
/* Movement.res — 纯 ReScript 实现的 SAT 碰撞检测 */

let isHullOverlap = (hull: hullPart, aabb: collisionBox): bool => {
  let ocx = hull.centerX, ocy = hull.centerY, ocz = hull.centerZ
  let ohw = hull.halfW, ohh = hull.halfH, ohd = hull.halfD
  let qx = hull.quatX, qy = hull.quatY, qz = hull.quatZ, qw = hull.quatW
  // 计算 hull 的局部轴
  // 用 15 条分离轴（OBB 的 3 个面法向 + AABB 的 3 个面法向 + 9 个边叉积）做投影测试
  // 所有轴都不分离才判定为碰撞
}
```

凸包相比 OBB 的优势：OBB 是长方体的朝向对齐，对倾斜/细长物体仍有空隙。凸包用物体实际轮廓的点集构造，碰撞判定更精确。

---

## 4. 绝对状态下发

每次 tick，服务端下发全量 `MsgGameState`：

```typescript
export interface playerState {
    username: string,
    positionX: number,
    positionY: number,
    positionZ: number,
    isCollision: boolean,
    isMoving: boolean,
    rotationY: number,
    hp: number,
    maxHp: number,
    // ...
}
```

**客户端不做任何逻辑判断**——只做两件事：
1. 收到 `GameState`，更新插值缓冲区
2. 每帧从缓冲区线性插值出渲染位置

这就是 **"绝对状态"** 策略：服务端下发的是"绝对真相"，不是"增量差异"。客户端不需要合并、不需要回滚、不需要任何状态推理。

**代价**：带宽更大（全量状态每 tick 下发）。但 2 人场景下全量约 1-2KB，10fps 就是 10-20KB/s——完全可接受。

---

## 5. 双轨动画管理

两种模型格式共存的解决方案 Phase 5 就确定了，Phase 6 是完整实现：

```typescript
// MMD 巨人动画
let mmdAnimations = {
    idle: loadMMDAnimation('idle.vmd'),
    walk: loadMMDAnimation('walk.vmd'),
}

// FBX 小人动画
let fbxAnimations = {
    idle: loadFBXAnimation('idle.fbx'),
    walk: loadFBXAnimation('walk.fbx'),
}

// 动画状态机
function setPlayerAnimationState(username, isMoving) {
    let anim = _playerAnimations.get(username)
    if (anim) {
        anim.crossFade(isMoving ? 'walk' : 'idle', 0.1)
    }
}
```

动画状态切换放在前端，服务端只通过 `isMoving` 布尔值控制——状态同步的最大好处：动画是纯渲染层问题，服务器不需要知道 VMD 和 FBX 的区别。

---

## 😤 坑

**🕳️ warm container 定时器残留** → 代次守卫解决（上文已详述）

**🕳️ AI giantess 寻路卡死**：AI 巨人的路径规划在服务端 `setInterval` 里跑。如果路径规划阻塞（比如目标不可达），整个 tick loop 被卡住，所有人都会瞬移。

**解决：** 路径规划加上超时兜底，200ms 内找不到路径就用当前位置做目标，绝不阻塞 tick。

**🕳️ 位置跳变检测**：我们在服务端加了位置跳变检测——如果某个 tick 发现玩家位置突然跳回出生点，打印诊断日志：

```typescript
// [Server] WARNING: Position reset detected for user_42 (0.0 → -12.5)
```

这在调试阶段救了无数次——很多 bug 在日志里就被发现了，不用等玩家报告。

---

## 阶段总结

Phase 6 完成了服务端权威的完整闭环：

| 组件 | 职责 | 关键设计 |
|------|------|---------|
| Tick Loop | 10fps 定频运行 | 代次守卫 self-kill |
| 凸包碰撞 | 服务端判定碰撞伤害 | SAT 分离轴定理 |
| 绝对状态 | 全量下发，客户端只展示 | 不增量、不回滚 |
| 双轨动画 | MMD + FBX 各自管理 | isMoving 布尔控制 |
| 位置检测 | 诊断日志捕获异常跳变 | 纯防御性编程 |

下一期讲一个截然不同的话题——**Phase 7：状态管理演进**。从 Immutable.js 到自制 HashMap 到 Js.Dict 到最终的 SoA Store，四次重构揭示了同一个经验：**「够用」比「好用」重要**。

**下一篇：[Vibe Coding 多人游戏（十二）—— Phase 7：状态管理演进](https://www.cnblogs.com/chaogex/p/21195307)**
