# Vibe Coding 多人游戏（二十八）—— 通信可靠性与错误处理模式

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

多人游戏最头疼的问题：**网络不可靠。** 无论 WS 还是 HTTP，断连、延迟、竞态——总会出现。

---

## WS 断连与重连

WebSocket 断连在 SCF 环境下尤其频繁——warm container 回收、实例迁移、部署更新都可能导致断连。

**断连检测：** TSRPC 的 heartbeat 机制

```typescript
// 客户端配置
heartbeat: {
    interval: 2000,   // 生产 2s
    timeout: 5000     // 5s 没回应算断
}

// 服务端配置
heartbeatWaitTime: 60000  // 60s 无心跳断开
```

**重连策略：** 指数退避 + 最大重试次数

```
第 1 次重连：等 1 秒
第 2 次重连：等 2 秒
第 4 次重连：等 4 秒
...
最多重试：8 次
超过 → 提示"连接已断开，请刷新页面"
```

---

## 竞态问题

最隐蔽的一类 bug：**两个操作在不同时间点到达服务端，导致状态不一致。**

典型场景：
1. 玩家 A 发送"移动"命令
2. 玩家 A 同时发送"攻击"命令
3. 服务端先处理了"攻击"（因为它在队列前面），然后处理"移动"
4. 结果是：玩家在攻击状态中移动了——不应该发生

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

规则：
- 参数必传（不能传 undefined）
- 不处理的值尽早 throw
- 状态不合法时拒绝操作，不静默修复

---

## 部署过程中的通信错误

部署更新时 room-service 重启，所有 WS 连接断开。必须保证：

1. 前端自动重连
2. 重连后同步最新状态（不是旧状态）
3. match-service 更新 room 状态（room 重启后 match 的路由表已过时）

**重启顺序：** 先 room 再 match（room 重启会断开 match 的 WS 连接）。

---

下期讲 **P29：教训、反模式与设计模式**——6 类坑 root cause + 13 个可复用模式。

**下一篇：[Vibe Coding 多人游戏（二十九）—— 教训、反模式与设计模式](https://www.cnblogs.com/chaogex/p/21195307)**
