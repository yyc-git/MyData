# Vibe Coding 多人游戏（二十八）—— 通信可靠性与错误处理模式

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

多人游戏最头疼的问题：**网络不可靠。** 无论 WS 还是 HTTP，断连、延迟、竞态——总会出现。GTS-Play 经历了大量通信相关 bug，以下是最重要的模式和解决方案。

---

## WS 断连与重连

WebSocket 断连在 SCF 环境下尤其频繁——warm container 回收、实例迁移、部署更新都可能导致断连。我做 E2E 测试时就遇到过：玩家正在游戏，我部署了一个更新，room-service 重启，所有 WS 连接断开——前端卡在"正在游戏中"页面，然后超时。

### 断连检测：TSRPC 的 heartbeat 机制

```typescript
// 客户端配置
heartbeat: {
    interval: 2000,   // 生产 2s
    timeout: 5000     // 5s 没回应算断
}

// 服务端配置
heartbeatWaitTime: 60000  // 60s 无心跳断开
```

客户端 2s 心跳、5s 超时——这个配置不是随便选的。2s 意味着玩家最多 2s 后才能发现自己断连——对于要求极低延迟的 FPS 游戏来说太慢，但对于我们的 PvE 多人游戏来说刚好。太短的心跳（比如 500ms）在网络抖动时会频繁误报断连。

### 重连策略：指数退避 + 最大重试次数

```
第 1 次重连：等 1 秒
第 2 次重连：等 2 秒
第 4 次重连：等 4 秒
...
最多重试：8 次
超过 → 提示"连接已断开，请刷新页面"
```

指数退避的策略很朴素：第一次断连可能是网络抖动，等短时间快速重连；如果连续断连，说明问题严重，延长重连间隔避免继续失败。

最大 8 次重试——约累计 255 秒（4 分钟）的重连窗口期。超过这个时间还没连上，大概率是服务端挂了或者客户端网络有问题，提示用户刷新页面而不是继续徒劳重连。

### beforeunload disconnect

还有一个很重要的设计：**页面关闭时不发送 exit 请求，而是直接断开连接。** 

之前的实现是 `sendExit` → 服务端处理退出。但问题来了：如果页面关闭时请求还没有发出（浏览器关闭 tab 时异步请求可能被取消），服务端永远收不到 exit 信号——玩家的状态一直留在"游戏中"。

2026-06-25 的 ADR 记录了修复过程：`beforeunload` 不调用 `sendExit`，而是直接用 `disconnect()` 断开 WebSocket。服务端在 `on('close')` 事件中处理退出逻辑——这个事件 100% 被触发，不会被浏览器关闭 tab 取消。

---

## 竞态问题

最隐蔽的一类 bug：**两个操作在不同时间点到达服务端，导致状态不一致。**

### 案例 1：移动 + 攻击

玩家 A 发送"移动"命令，同时发送"攻击"命令。服务端先处理了"攻击"（因为它在队列前面），然后处理"移动"——结果是：玩家在攻击状态中移动了。

**解决：** 所有命令打包在一起发，服务端按帧号顺序执行：

```typescript
// 客户端：每个逻辑帧只发一次
function sendFrameCommands(inputs: Input[]) {
    sendCommands({
        logicFrameIndex: currentFrame,
        commands: inputs,
    })
}

// 服务端：按帧号排队执行
function processCommands(commands) {
    commands.sort((a, b) => a.logicFrameIndex - b.logicFrameIndex)
    for (const frame of commands) {
        state = executeCommands(state, frame.commands)
    }
}
```

命令打包发送 + 按帧号排序 = 确定性执行。不管命令到达顺序如何，服务端始终按帧号顺序执行。

### 案例 2：倒计时乐观锁写反

2026-06-28，发现"倒计时结束后游戏不启动"：

```typescript
// ApiPlayerReady.ts
// 悲观锁比较
if (currentGen !== countdownGen) {
    return  // 永远 return 了
}
// 但 startCountdown 已把 generation 从 0 变为 1
// currentGen 拿到的是旧值 0，不等于 countdownGen + 1 = 2
```

根因：乐观锁比较写反了。应该检查 `currentGen === countdownGen + 1` 而不是 `!==`。这个 bug 修复后，还专门加了一条 BDD 测试场景"倒计时结束后游戏启动"。

### 案例 3：obbArray 数据洪流

这是 2026-06-28 集中修复中最严重的一个竞态问题。

OBB（Oriented Bounding Box）碰撞模型数据是客户端调试渲染用的——但它被错误地放进了网络协议。每次命令携带 15-20KB 的 obbArray 数据，广播给其他玩家时又是 20-50KB × 10-30fps。结果：
- V8 GC 频繁触发
- GPU 驱动由于数据处理不过来产生 TDR（Timeout Detection & Recovery）
- Chrome 崩溃重启

修复方式：
- `CommandManager.ts` 移除 obbArray 参数
- `Game.ts` 始终剥离 obbArray 再发送
- 客户端 OBB 本地计算（不依赖网络数据）

**教训：** 网络协议里只传输必要的游戏状态，**不要把调试数据也加进去**。obbArray 是碰撞线框的顶点数据，只在本地调试渲染时有用，其他玩家不需要知道。

---

## 防御式编程

错误处理的最佳策略不是"try 一切"，而是**"尽早失败、明确错误"**：

```typescript
// ❌ 隐性失败
function getPlayer(username) {
    return players[username]  // 可能 undefined，调用者不知道
}

// ✅ 尽早失败
function getPlayer(username) {
    let player = players[username]
    if (!player) throw new Error(`Player ${username} not found`)
    return player
}
```

防御式编程的核心规则写入了 `basic-rules.md`：
- 参数尽量必传，不满足条件尽早 throw
- 减少可选参数，用必传 + 默认值工厂代替
- 状态不合法时拒绝操作，不静默修复

### 实际案例

**2026-06-27 代码审核**发现的 `_handlePlayerDisconnect` 问题：在移除用户后调用 `getUserRoomRole`，但因为用户已经被移除，传入的 `username` 不在玩家列表里——返回 `undefined`。如果这时再去基于 `undefined` 做条件判断，会产生不可预期的行为。

修复：在移除用户之前捕获 `userRoomRole`，之后再用。而不是先移除再查询——这个顺序问题在 AI 代码里很常见。

还有一个经典的防御式编程改进：`Server.ts` 的 `_cleanupOnDisconnect` 函数没有超时保护——如果清理逻辑卡住了（比如某个 flus 写操作等待锁），整个函数永远不结束。修复方式：

```typescript
// 加 30s 超时保护
const CLEANUP_TIMEOUT = 30000
const cleanupPromise = _doCleanup(connId)
const result = await Promise.race([
    cleanupPromise,
    new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Cleanup timeout")), CLEANUP_TIMEOUT)
    )
])
```

---

## 部署过程中的通信错误

部署更新时 room-service 重启，所有 WS 连接断开。必须保证：

1. **前端自动重连**（指数退避，最大 8 次）
2. **重连后同步最新状态**——不是旧状态。所以每次重连后，前端会请求一次全量状态同步。
3. **match-service 更新 room 状态**——room 重启后 match 的路由表已过时，需要重新注册。

**重启顺序：** 先 room 再 match（room 重启会断开 match 的 WS 连接）。这个顺序问题我在部署文档里用了加粗和红色标注——因为它出错的概率太高了。

有一个具体问题：如果重启顺序搞反了——先重启 match 再重启 room——match 重启后尝试连接 room，但 room 还没启动。match 尝试连接 → 失败 → 标记 room 不可用 → 再尝试 → 又失败 → room 终于启动但 match 已经标记 room 为不可用。要手动清 match 的缓存才能修复。**所以重启顺序一定要对。**

---

## 一个通用的错误处理模式

多人联网的错误处理最终抽象成了一个统一的模式（来自 2026-06-24 的 ADR）：

```
错误触发 → stopLoop → hide canvas → disconnect → setError → 显示错误页
```

所有错误（网络断连、WebSocket 异常、游戏逻辑异常）都走这个统一路径，而不是在各自的代码里 try/catch 后静默恢复。这种"统一失败"的好处是：错误不会被隐蔽，玩家和开发者都知道出问题了。

同时这个模式也遵循了开闭原则：错误处理逻辑放在 `MultiplayerErrorHandle.tsx`（新建的文件），不修改单机的 `ErrorHandle.tsx`。

---

下期讲 **P29：教训、反模式与设计模式**——6 类坑 root cause + 13 个可复用模式。

**下一篇：[Vibe Coding 多人游戏（二十九）—— 教训、反模式与设计模式](https://www.cnblogs.com/chaogex/p/21195307)**
