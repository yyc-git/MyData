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

## 多人联网后台管理

游戏上线后，运维问题是另一个层面的事——怎么查玩家状态、怎么强制清房、怎么在不重启服务的情况下维护游戏。GTS-Play 新增了一个 `packages/room-admin` 包，作为独立的 PC 管理面板。

### 为什么要做后台管理？

早期全靠看 SCF 日志来排查问题——玩家说“卡在房间里了”，我查日志找这个房间的 state 数据。但日志是文本格式、没有结构化查询，找一条玩家的连接记录可能要翻 50 条日志。

后来 match-service 已经有了 `getAllRoomData()` 方法（通过 WebSocket 获取所有 room-service 的房间状态数据），但这个数据仅用于匹配逻辑——查找空房间、分配房间号。没有暴露给外部查询。

需要后台管理的场景：
- 玩家反馈“房间卡住了”——管理员查看房间状态，确认是否有人卡在“等待中”
- 某次 E2E 测试后房间状态未清理——管理员手动清空房间
- 想知道当前在线多少人、哪些房间在游戏中——实时查看

### 架构：三层通信

```
┌─────────────────────────────┐
│   room-admin (PC 管理面板)   │  React + Redux + Antd
│   TSRPC HttpClient           │  HTTP 调用 match-service
└──────────────┬──────────────┘
               │ HTTP (ListRooms / ClearRoom)
               ▼
┌─────────────────────────────┐
│   match-service (SCF)        │  中心服务，管理所有 room-service
│   ├── ApiListRooms            │  调用 getAllRoomData()
│   └── ApiClearRoom            │  通过 WsClient 调用 room-service
└──────────────┬──────────────┘
               │ WebSocket
               ▼
┌─────────────────────────────┐
│   room-service (SCF)         │  每个实例管理一个房间
│   └── ApiClearRoom            │  dispose → 清空房间
└─────────────────────────────┘
```

三层设计的原因：room-service 是 WebSocket 服务，不能直接对外暴露 HTTP API。match-service 已经在维护与所有 room-service 的 WebSocket 连接（用于匹配逻辑），所以通过 match-service 做中转是最省事的办法。

### ListRooms API

```typescript
// PtlListRooms
// Req: {}
// Res: { rooms: RoomData[] }
// RoomData: { roomId, userCount, allUserData, isEnterGame }

// 实现：调用现有 getAllRoomData()
function handleListRooms() {
    const rooms = getAllRoomData(state)
    return { rooms: rooms.filter(r => r !== null).map(toRoomData) }
}
```

内置了容错：如果某个 room-service 连接故障，`getAllRoomData()` 会跳过该房间，不会因为一个故障就导致整个列表请求失败。

### ClearRoom API

清空房间是一个多步操作：

```
room-admin              match-service           room-service
    │                       │                       │
    │─── ClearRoom(1) ────→│                       │
    │                       │─── Ws.callApi ──────→│
    │                       │                       │── broadcast Exit
    │                       │                       │    → 所有玩家断开
    │                       │                       │── Manager.dispose()
    │                       │                       │── writeState(清空)
    │                       │←────── succ ─────────│
    │←────── succ ─────────│                       │
```

room-service 侧的 `ApiClearRoom` 实现：先广播 Exit 给所有玩家（使用现有的 `broadcastMsg`），再调用 `Manager.dispose(state)` 重置房间状态，最后 `writeState` 持久化空状态。这是一个幂等操作——清空空房间也会返回 success。

### room-admin 管理面板

`packages/room-admin` 是一个独立的 PC 端包，React + Redux + Antd，通过 TSRPC HttpClient 连接 match-service。

```
packages/room-admin/
├── package.json
├── webpack.config.js
├── index.html
├── src/
│   ├── Main.tsx
│   ├── matchServiceClient.ts    # TSRPC HttpClient 封装
│   ├── ui_layer/
│   │   ├── store/AppStore.ts
│   │   ├── store/RoomStore.ts
│   │   ├── pages/RoomListPage.tsx
│   │   ├── components/RoomTable.tsx
│   │   └── App.tsx
│   └── App.scss
```

页面展示：房间号、状态（等待中/游戏中）、人数（如 2/4）、玩家列表（用户名）、操作（清空按钮）。

### 管理面板的 BDD 测试

match-service 新增了 5 个 BDD 测试场景：

| 场景 | 验证 |
|------|------|
| ListRooms 返回所有房间数据 | room1 有 1 人、room2 有 0 人 → 列出 2 个房间 |
| ListRooms 容错 | room2 故障 → 只返回 room1 |
| ClearRoom 清空指定房间 | 清空后 room1 的 allUserData 为空 |
| ClearRoom 无效房间 | roomId 999 → success=false |
| ClearRoom 清空空房间（幂等） | 空房间再清 → success=true |

room-service 新增 2 个测试场景（清空有玩家的房间 / 清空空房间）。都是通过 BDD（Given-When-Then）来描述的。

---



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


## 通信协议与服务间通信模式

多人联网涉及三个服务的相互通信——每条通信路径（客户端→room、客户端→match、match→room）都有各自的协议模式。

### 通信协议一览

| 服务 | 协议 | 客户端连接方式 | 端口 |
|------|------|--------------|------|
| room-service | TSRPC WebSocket | `wss://url?room-id=1` | 本地 4003 / SCF 9000 |
| match-service | TSRPC HTTP | `https://url` | 本地 3000 / SCF 9000 |
| room-admin | TSRPC HTTP | 通过 HttpClient 调用 match | 本地 8094 / 静态托管 |

为什么 room-service 用 WebSocket 而 match-service 用 HTTP？

- **room-service** 需要维持长连接——游戏中每帧发送命令、服务端广播状态、实时的 `broadcastState` 和 `broadcastGameEvent`。如果用 HTTP 轮询，延迟高（每个请求建立连接/TLS 握手 + 服务端处理 + 响应返回），而且状态同步做不到帧级实时。
- **match-service** 的请求是离散的——创建房间、查找有效房间、获取房间数据、清空房间。这些请求可以走 HTTP（TSRPC 的 HttpClient 模式），不需要维持长连接。请求来就处理、处理完就断开，对 SCF 的按量计费更加友好。

### 服务间通信：match → room

match-service 通过 WebSocket 与所有 room-service 保持连接。连接在 match 启动时建立：

```typescript
// match-service 启动时连接所有 room
const connections = [
    createWsClient('wss://room1-url?room-id=1'),  // room1
    createWsClient('wss://room2-url?room-id=2'),  // room2
]

// 通过连接调用 room-service 的 API
async function callRoomApi(roomId, apiName, params) {
    const conn = connections[roomId - 1]
    return conn.callApi(apiName, params)
}
```

### 服务间通信：room-admin → match

room-admin 通过 TSRPC HttpClient（HTTP 协议）调用 match-service。因为 match-service 是 HTTP 函数，每个请求独立实例，不需要维持连接。

```typescript
// room-admin 中的客户端封装
import { HttpClient } from 'tsrpc-browser'

const client = new HttpClient(matchServiceProtocol, {
    server: 'https://match-service-url',
    json: true
})

// 调用 API
async function listRooms() {
    const res = await client.callApi('ListRooms', {})
    return res.rooms
}

async function clearRoom(roomId) {
    const res = await client.callApi('ClearRoom', { roomId })
    return res.success
}
```

### 通信协议命名规范

TSRPC 的协议定义文件使用 `Ptl`（Protocol）前缀，格式为：

```typescript
// shared/protocols/matchServer/PtlListRooms.ts
export type ReqListRooms = {}
export type ResListRooms = { rooms: RoomData[] }
```

room-service 现有 13 个协议：

| 协议 | 功能 |
|------|------|
| AddUser | 玩家加入房间 |
| AllCommands | 发送/接收所有帧命令（核心协议） |
| ClearRoom | 管理员清空房间 |
| DebugEndGame | 调试结束游戏 |
| EnterGame | 进入游戏 |
| Exit | 玩家退出 |
| Finished | 游戏结束 |
| GetDebugRoomData | 调试数据获取 |
| GetRoomData | 房间数据获取 |
| KickPlayer | 踢出玩家 |
| LoadData | 加载房间数据 |
| PlayerReady | 玩家准备 |
| SetConfig | 设置配置 |

match-service 现有 6 个协议：

| 协议 | 功能 |
|------|------|
| CreateRoom | 创建房间 |
| FindValidRoom | 查找有效房间 |
| GetRoomData | 获取房间数据 |
| GetDebugRoomData | 调试数据获取 |
| ListRooms | 房间列表（管理用） |
| ClearRoom | 清空房间（管理用） |

协议集中在 3 个 shared 目录下：`roomServer/`、`matchServer/`、`roomAdmin/`。所有协议文件的改动都有对应的 BDD 测试——新增协议 + 新增 .steps.ts + 跑通全部场景。

### 通信中的实际问题

**问题 1：OPTIONS 请求（跨域）**

match-service 部署到 SCF 后，前端（包括 room-admin）通过 HTTPS 调用时，浏览器会先发一个 OPTIONS 预检请求（CORS）。SCF Web 函数默认不处理 OPTIONS——导致预检失败，真正的 API 请求被浏览器拦截。

解决：在 match-service 的入口处增加 OPTIONS 处理：

```typescript
// 在 HTTP 请求入口判断 method
if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.status(200).end()
    return
}
```

**问题 2：SCF 单实例并发限制**

SCF Web 函数的自定义静态并发设为 10，但并发模型仍然有限制——多个 API 请求同时到达同个实例时，如果 API 内部存在异步操作（如 `callApi` 到其他服务），可能出现请求间相互干扰。

解决：关键 API（如 Exit、PlayerReady）内部做幂等处理——即使被重复调用，也不会产生副作用。加上代次守卫（generation guard）确保过期的请求不会影响当前状态。

**问题 3：serviceProto 重新生成的风险**

TSRPC 每次新增/修改 API 后需要 `yarn proto` 重新生成 `serviceProto.ts`。如果忘记生成，旧版 serviceProto 不包含新 API——编译不报错（因为 serviceProto 是生成的类型文件），但运行时调用新 API 会失败。

解决：在 BDD 测试流程中加入 `yarn proto` 检查——测试前先跑 proto 生成，确保 serviceProto 与协议定义一致。同时 CI 流程中增加 `npx tsc --noEmit` 检查类型错误。

**问题 4：进程残留**

本地开发时最常见的通信问题——room-service 进程没有完全关闭就重启新实例。新实例绑 4003 端口失败，而旧进程其实已经没响应（比如连不上 match、发不了消息）。

解决：`gts-service` skill 在启动前先 `Get-Process -Name node` 过滤端口号对应的进程精确杀掉。早期用 `taskkill /F /IM node.exe` 杀所有 node 进程——结果把自己（OpenClaw）也杀了。

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
