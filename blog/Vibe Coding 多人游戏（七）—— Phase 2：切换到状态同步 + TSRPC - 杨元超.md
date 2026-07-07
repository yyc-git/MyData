# Vibe Coding 多人游戏（七）—— Phase 2：切换到状态同步 + TSRPC

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

上一期说了 basic1 用 Lockstep 帧同步踩的坑：浮点数各平台不一致、回滚代码难以维护、调试复杂到怀疑人生。

到 new_basic2，我们做了一个关键决定：**放弃帧同步，切换到状态同步。**

这是整个项目最重要的架构决策，没有之一。

---

## 转变动机：为什么放弃帧同步

帧同步的核心理念很美：服务端只当中继，客户端执行相同的指令序列——理应得到相同结果。

但在实践中，它有三个致命问题：

**1. 浮点数不一致**
服务端（Node 18）、客户端 A（Chrome Windows）、客户端 B（Safari macOS），同一个数学运算（比如 `position.x += velocity * deltaTime`）得到三个不同的结果。偏差一开始是 0.0001，几秒后变成 1 个身位，然后就穿模了。

**2. 回滚代码难以维护**
每个逻辑帧的流程：存储快照 → 执行服务端命令 → 对比差异 → 回滚 → 重放本地离线命令。这套 predict-reconcile-correct-resimulate 的代码堆了 300+ 行，每次改移动逻辑都要同步改回滚逻辑。AI 生成的代码在这种模式下特别容易崩——改一个地方忘了改快照，就会在某个帧上状态爆炸。

**3. Debug 极其困难**
A 看到 B 瞬移了——是 A 算错了还是 B 算错了还是服务端中继丢包了？没有权威参考系，每个人都只能猜。

**关键认知转变：项目只有 2 个玩家，不是 8 个人的星际争霸。** 带宽不是瓶颈，代码可维护性才是。

帧同步的带宽优势在这个场景用不上，反而被它的代码复杂度拖死。所以——**状态同步**。

---

## 服务端权威模型

状态同步的思路完全不同：**服务端计算一切，客户端只管展示。**

```
每个 tick（30fps 调试 / 10fps 生产）：
  服务端收集所有玩家的输入
  执行 executeCommand → 凸包碰撞检测 → 计算伤害
  生成全量 MsgGameState（position, rotation, hp, collision, animation...）
  广播给所有客户端
  客户端收到 → 线性插值 → 渲染
```

服务端不再是中继，而是权威。`Game.ts` 管理核心游戏循环：

```typescript
// 伪代码示意
setInterval(() => {
  if (currentGen !== generation) { clearInterval(timer); return }
  state = executeCommand(state)        // 执行所有玩家命令
  state = computeCollisionDamage(state) // 碰撞伤害计算
  broadcastMsgGameState(state)          // 广播全量状态
}, interval)
```

客户端不再做任何逻辑计算，只做三件事：
- 用 `sendMoveState` 把自己的输入发给服务端
- 用 `onGameState` 监听服务端下发的 `MsgGameState`
- 展示 + 插值

```typescript
// 客户端：只管发输入
export let sendMoveState = (state, isLeft, isRight, isForward, isBackward) => {
    let anyDir = isLeft || isRight || isForward || isBackward
    if (anyDir) {
        return addCommand(state, commandType.Move, { ... })
    } else {
        return addCommand(state, commandType.Move, { /* not moving */ })
    }
}

// 客户端：接收服务端权威状态
client.listenMsg('GameState', (msg) => {
    NullableUtils.forEach(handler => {
        handler(msg.players)   // 更新插值缓冲区
    }, _onGameStateHandler)
    if (msg.enemies) {
        setEnemyState(msg.enemies)  // AI 巨人状态
    }
})
```

---

## TSRPC 引入

要实现服务端权威，需要一套可靠的通信框架。我们用了 **TSRPC**——TypeScript 全链路 RPC 框架。

**为什么选 TSRPC：**

1. **全链路类型安全**：一个 `serviceProto.ts` 定义所有 API 和消息类型。改一端，TS 编译全崩——不存在"前端以为发 string 服务端以为发 number"的问题。
2. **WsClient + HttpClient 一体化**：room-service 用 WebSocket（实时推送），match-service 用 HTTP（请求-响应），共用同一套 proto 定义。
3. **请求-响应 + 消息推送双模**：不需要手动解析 JSON，不需要自己写 WS 消息路由。`client.callApi('AddUser', {...})` 和 `client.listenMsg('GameState', handler)` 就够了。

```typescript
// 创建 room 服务客户端
let client = new WsClient(serviceProto, {
    server: getUrlById(getIsDebug(state), roomId),
    json: true,
    heartbeat: {
        interval: getIsDebug(state) ? 200000 : 2000,
        timeout: getIsDebug(state) ? 500000 : 5000
    }
})

// 创建 match 服务客户端
let matchClient = new HttpClient(mathServiceServiceProto, {
    server: getIsDebug(state) ? "http://127.0.0.1:3000" : getMatchServiceUrl(),
    json: true,
})
```

**😤 坑：bigint 传不了**

TypeScript 的 `bigint` 在编译到 JavaScript 时变成 `BigInt` 对象。TSRPC 的 `encodeJSON` 又做了一层序列化——结果 bigint 在传输链上经历了 `bigint → BigInt → string` 的两层转换，服务端收到的是字符串而不是数字。

解决很简单：不用 bigint，直接用 `number`。多人场景下 2 个玩家，`number` 的 53 位精度足够。

---

## 客户端渲染：插值 + 预测 + 修正

状态同步下，客户端每 tick 收到一次服务端快照（生产环境 10fps，即 100ms 一次）。直接赋值位置会看到"瞬移"，所以需要平滑：

**1. 线性插值（Interpolation）**

每收到一个 GameState，存到缓冲区。渲染帧之间用前后两帧做线性插值：

```typescript
let _interp: ImmutableMap<string, InterpEntry> = ImmutableMap()

// 每帧调用
function getInterpolatedPlayers(currentTime) {
    _interp.forEach((entry, username) => {
        let t = (currentTime - entry.prevTime) / (entry.nextTime - entry.prevTime)
        let x = entry.prevPos.x + (entry.nextPos.x - entry.prevPos.x) * t
        // 对 y, z 做同样计算...
        return { x, y, z }
    })
}
```

**2. 本地向前预测（Prediction）**

自己的输入不需要等服务端确认——本地立刻响应。按下 W，自己的角色立刻向前走，不等 100ms 后的 GameState 回来。

```typescript
// 键盘事件直接影响本地位置
let _predictionDir = { x: 0, z: 0 }
// ManageScene 每帧读取按键状态，更新本地位置
```

**3. 服务端修正（Correction）**

当服务端 GameState 回来发现和预测位置不一致时，平滑拉回到服务端认定的位置：

```typescript
let _correctionTarget = null  // 由 GameState handler 设置

// 渲染循环中做平滑拉回
if (_correctionTarget) {
    // lerp 到目标位置
    currentPos.x += (_correctionTarget.x - currentPos.x) * 0.1
    currentPos.z += (_correctionTarget.z - currentPos.z) * 0.1
}
```

这套"预测 + 修正"不需要 rollback，因为不做服务端模拟，只修正自己的位置。

---

## 双轨动画系统

由于模型来源不同，前端需要同时加载两种格式的角色：

| 角色 | 格式 | 加载器 | 动画类型 |
|------|------|--------|---------|
| 巨大娘（Giantess） | PMX + VMD | MMDLoader | MMD 烘焙动画（Idle/Running） |
| 小人（Little Man） | FBX | FBXLoader | 骨骼动画（Idle, Walk, Run...） |

各自的动画状态机独立管理：

```typescript
// MMD 巨人走 Idle → Walk 切换
// FBX 小人有完整的 Blend Tree

let _playerAnimations = new Map<string, AnimationState>()

function setPlayerAnimationState(username, isMoving) {
    let anim = _playerAnimations.get(username)
    if (anim) {
        anim.crossFade(isMoving ? 'walk' : 'idle', 0.1)
    }
}
```

两种格式共存带来的额外复杂性，在 Phase 6（服务端权威完整实现）中得到了统一处理——这部分后面 P11 会细讲。

---

## 阶段总结

从 basic1 到 new_basic2，核心的变化只有一行，但影响深远：

> **服务器角色从"中继"变成了"权威"。**

带来的收益：
- ✅ 客户端代码大幅简化（300+ 行回滚代码 → 50 行插值）
- ✅ Debug 有参考系（服务端状态 = 标准答案）
- ✅ AI 编写更容易（没有"保持一致"的隐性需求）
- ✅ 浮点问题归服务端（只有 1 个浮点数来源）
- ✅ 防作弊天然支持（服务端说了算）

代价：
- ❌ 带宽增大了（全量状态每 tick 广播，而不是几条指令）
- ❌ 服务端成本增加了（要跑游戏循环 + 碰撞检测）
- ❌ 响应延迟增加（自己的输入要等服务端确认才能在其他玩家处看到）

**但在 2 人场景下，这三条代价几乎可以忽略。** 带宽多几十字节、服务器多跑一个 setInterval、100ms 延迟——都比帧同步的维护成本低了一个数量级。

---

从 new_basic2 的状态同步 Demo 到 Lerna Monorepo 四包结构，中间只隔了一周。下期讲 **P8：大重构**——Monorepo + 双服务 + Logic 共享层 + 开闭原则，一天内全部落地。

**下一篇：[Vibe Coding 多人游戏（八）—— 大重构：Monorepo + 双服务 + Logic 共享层 + 开闭原则](https://www.cnblogs.com/chaogex/p/21195307)**
