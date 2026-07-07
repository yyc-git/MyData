# Vibe Coding 多人游戏（九）—— Phase 4：双服务架构

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

Monorepo 搞定了代码组织，但有个架构问题还没解决：**谁来管房间匹配？**

Phase 3 之前，room-service 既管游戏循环又管房间分配。一个服务干两件事：

```
room-service
├── 游戏循环（setInterval tick, 状态广播, 碰撞检测）
├── 房间管理（创建/销毁/用户进出）
├── 匹配（谁跟谁一队）
└── 房间列表查询
```

这就是个 God Object——每个功能改了都要重新部署整个服务。匹配逻辑出 bug，连累游戏也重启。

---

## 为什么拆

拆成两个服务的理由很直接：

**1. 职责分离**

| 服务 | 做什么 | 不做什么 |
|------|--------|---------|
| room-service | 游戏循环、状态广播、碰撞伤害 | 不管谁进哪个房间 |
| match-service | 房间分配、匹配算法、房间列表 | 不管游戏逻辑 |

**2. 独立扩缩容**

多人游戏瓶颈通常是 room（游戏实例），不是 match（匹配查询）。如果未来用户量大了，可以加 room 不加 match。

**3. 部署互不影响**

改匹配算法不用重启游戏，修游戏 bug 不用影响匹配。

---

## 架构图

```
                浏览器（Three.js 前端）
                /                     \
          WS 连 room              HTTP 连 match
               |                        |
        room-service              match-service
        (WebSocket, 4003)         (HTTP, 3000)
               |                        |
               |--- WS 取房间状态 ----→|
               |                        |
          游戏循环 + 状态广播        匹配分配 + 房间查询
```

前端有两条通信路径：

- **连 room-service**：WebSocket 长连接，实时收发游戏状态
- **连 match-service**：HTTP 短连接，查询房间列表、创建/加入房间

---

## room-service（WS, 4003）

核心职责是**游戏循环**：

```typescript
// 入口
import { createServer, init, server } from "./models/Server";

async function main() {
    createServer(getDebugPort())
    await init()
    await server.start()
}
main()
```

内部包含：
- `Game.ts` — tick 循环、executeCommand、碰撞检测、状态广播
- `Server.ts` — TSRPC WsServer 启动，heartbeat 管理
- `Room.ts` — 房间生命周期、用户管理
- `Manager.ts` — dispose、清理、状态重置

所有游戏相关的协议都定义在 `shared/protocols/` 下，frontend 通过 monorepo 引用共享类型。

---

## match-service（HTTP, 3000）

核心职责是**匹配分配**：

```typescript
// 入口
import { createServer, init, server } from "./models/Server";

async function main() {
    createServer(3000)
    setIsOnlyNeedTwo(true)
    await init()
    await server.start()
}
main()
```

它做的事情：

1. **创建房间**：`ApiCreateRoom` — 分配 roomId，返回 room-service 的 WS URL
2. **查找可用房间**：`ApiFindValidRoom` — 遍历所有房间，找到有人但未满员的

```typescript
export let findValidRoom = (allRoomData, fullUserCount) => {
    return allRoomData.find(
        d => d.allUserData.length > 0
            && d.allUserData.length < fullUserCount
            && !d.isEnterGame
    )
}
```

3. **查询房间数据**：`ApiGetRoomData` — 前端展示了需要房间状态

**match 怎么知道 room 的状态？**

match 通过 WebSocket 连到 room-service，监听房间变化。这也带来了一个坑——room 重启后 match 的 WS 连接断开，必须重启 match 才能重连。

---

## 全链路类型安全

双服务拆分后，类型安全反而更严格了。TSRPC 的 `serviceProto.ts` 统一管理所有 API 定义：

```
room-service/src/shared/protocols/
├── serviceProto.ts      ← 所有 API 和消息类型注册
├── MsgGameState.ts      ← 游戏状态推送（房间→前端）
├── MsgAddUser.ts        ← 用户加入通知
├── MsgAllCommands.ts    ← 命令接收（前端→房间）
├── PtlAddUser.ts        ← 加入房间 API
├── PtlEnterGame.ts      ← 开始游戏 API
├── PtlExit.ts           ← 退出 API
└── ...                  ← 总共 15+ 协议文件
```

改一个协议，所有引用它的一端 TypeScript 编译全崩——保证了前后端协议永远一致。

---

## 😤 坑

**坑 1：包间共享类型的引用策略**

room-service 的 `MsgGameState` 被 frontend 引用，同时它还引用了 logic 包的类型。跨包引用链长了之后，编译速度下降，而且 `tsconfig paths` 配置偶尔不稳定。

**解决：** `shared/protocols/` 下定义纯接口类型（interface），避免引入具体实现。类型共享归类型共享，实现代码各自独立。

```typescript
// shared/protocols/MsgGameState.ts
export interface playerState {
    username: string,
    positionX: number,
    positionY: number,
    positionZ: number,
    isCollision: boolean,
    isMoving: boolean,
    // ... 纯 Schema，无函数、无实现
}
```

**坑 2：room 重启 match 不知道**

room-service 重启后 WS 连接断开，match-service 还记录着旧的连接状态，会返回"可用房间"给用户——实际上那个房间已经不存在了。

**解决：** match 不缓存 room 状态，每次请求实时查询。room 重启后在 match 侧表现为"断连"，下次 match 访问时会自动重新连接。

---

## 阶段总结

拆成两个服务是架构上的一次关键收敛：

| 职责 | room-service | match-service |
|------|-------------|---------------|
| 协议 | WebSocket（长连接） | HTTP（短连接） |
| 生命周期 | 房间关闭即销毁 | 常驻 |
| 部署粒度 | 可独立更新 | 可独立更新 |
| 故障域 | 游戏崩溃不影响匹配 | 匹配挂了不影响游戏 |

**双服务架构看似多了"复杂度"，实际上降低了"认知负载"**——每个服务只关心一件事，改代码的时候不需要考虑"这个改动会影响匹配吗？"

---

下期讲 **Phase 5：Logic 共享层**——用 ReScript 纯函数包让前端和服务端执行同一套逻辑。

**下一篇：[Vibe Coding 多人游戏（十）—— Phase 5：Logic 共享层](https://www.cnblogs.com/chaogex/p/21195307)**
