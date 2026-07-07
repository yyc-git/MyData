# Vibe Coding 多人游戏（八）—— 大重构：Monorepo + 双服务 + Logic 共享层 + 开闭原则

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

P6 和 P7 我们用两个原型（basic1 帧同步、new_basic2 状态同步）证明了多人联机能跑。代码结构却撑不住了。

basic1 和 new_basic2 都还在 `demos/` 目录下，而 `packages/frontend/`（单机版的正式生产代码）还没碰多人。new_basic2 实现后，还没有加入到 frontend 中——也就是说，**多人功能跑在 Demo 目录里，跟真正的生产前端是两支独立的代码**。

这个状态不能上线。必须把多人代码迁移进正式的项目结构。

## 2026-06-09：一天重构

所有架构决策发生在**同一天**（2026-06-09）——经过前面 basic1（两周手写）和 new_basic2（一天 AI 改造）的验证，代码结构已经到了不改不行的临界点。

1. **Logic 共享层**：ReScript 纯函数包，把碰撞检测、移动逻辑抽成独立包，前后端共用
2. **双服务架构奠基**：basic1 时期就已经是双服务（room + match），这次把职责整理干净，搬进 packages/ 结构
3. **Monorepo 进化**：原本单机时期就在用 Lerna monorepo，这次加入多人包，完善依赖图
4. **开闭原则**：多人代码独立目录，单机代码一行不改

这四个决策不是四个步骤——它们是同一个架构方案的不同侧面。一天内全部落地。

---

## 1. Logic 共享层：ReScript 纯函数

重构前最大的痛点：碰撞检测、移动速度计算、伤害公式，在 room-service 里有一份，在 new_basic2 的客户端里也有一份。两边代码早晚不一致。

**方案：** 把纯逻辑抽出来，做成独立的 `packages/logic/` 包。

```
       logic 包（ReScript 纯函数）
      /          \
room-service   frontend
（服务器加载）  （浏览器加载）
```

关键约束：
- **纯函数**：输入 → 输出，无副作用
- **无 IO**：不碰网络、不碰文件、不碰 DOM
- **无状态**：全局状态外层管理，logic 只看当前帧数据

**为什么用 ReScript？**

ReScript（前身 BuckleScript/ReasonML）默认不可变，模式匹配优雅，编译产物极小（49KB，gzip ~15KB）。`@genType` 注解自动生成 `.gen.tsx` 类型定义，TypeScript 可以直接 import。

```rescript
/* Movement.res — 纯 ReScript 写的移动逻辑 */
let computeSpeed = (characterType: string): float => {
  characterType === "giantess" ? 3.0 : 1.0
}

let executeCommand = (state: gameState, command: command): gameState => {
  switch command.cmdType {
  | Move => { ...state, position: computeNewPosition(state, command) }
  | Attack => { ...state, hp: state.hp - computeDamage(state, command) }
  }
}
```

**logic 包包含的核心函数：**

| 函数 | 用途 |
|------|------|
| `executeCommand` | 执行移动/攻击等命令 |
| `isCollision` | 碰撞检测 |
| `computeSpeed` | 不同角色类型速度计算 |
| `computeCollisionDamage` | 碰撞伤害计算 |
| `getCollisionBox` | 模型碰撞盒配置 |
| `getMaxHp` | 角色最大血量 |

这些函数在服务端是权威计算，在前端是本地预测的参考——两端用**完全同一份代码**，不存在"服务端和客户端算法不一致"的问题。

---

## 2. 双服务架构：basic1 时期就有的设计

早在 basic1 阶段，多人联机就已经是**双服务架构**——不是说到了重构才拆出来的。

basic1 的时期服务端是 `demos/backend/`，里面包含了：
- **room-service 角色**：处理游戏循环、状态同步、碰撞检测（对应 `packages/room-service/`）
- **match-service 角色**：处理房间创建、匹配、列表查询（对应 `packages/match-service/`）

为什么这么早就是双服务？因为这两个服务的生命周期和协议不同：
- 游戏服务需要 WebSocket **长连接**，实时推送状态
- 匹配服务只需要 HTTP **请求-响应**，不需要保持连接

混在一起会让两个职责互相干扰——改匹配逻辑要重启游戏服务、游戏服务的 WebSocket 连接数影响匹配查询性能。所以从一开始就分开了。

这次重构做的事情，是把 `demos/backend/` 中已有的职责拆成两个独立包：

```
# 之前
demos/backend/（room 逻辑 + match 逻辑混在 Main.ts 里）

# 之后
packages/room-service/（WebSocket, 4003）
packages/match-service/（HTTP, 3000）
```

通信链路：

```
浏览器
  ├── WS → packages/room-service（实时游戏状态）
  └── HTTP → packages/match-service（创建/查找房间）
               │
           WS 监听 room-service 状态
```

全链路类型安全靠 TSRPC 的 `serviceProto.ts` 维持——改一个协议文件，所有引用端 TypeScript 编译全崩，问题在部署前就暴露了。

---

## 3. Monorepo：本来就是 monorepo

GTS-Play 在单机时期就已经是 Lerna monorepo 结构了——多个包（frontend、mods、defaults、asset-lib……）放在同一个仓库里，用 yarn workspaces 统一管理依赖。这不是为多人联机新引入的架构，而是给已有的 monorepo **新加了几个包**。

之前 `demos/basic1/` 和 `demos/new_basic2/` 靠 `../../../` 跨目录引用类型，改了目录结构就断一片。搬进 packages/ 之后：

```typescript
// 以前
import { MsgGameState } from "../../../packages/room-service/src/..."

// 以后
import { MsgGameState } from "room-service/src/shared/protocols/MsgGameState"
```

借助 yarn workspaces，`packages/room-service/` 自动链接到 `node_modules/room-service/`。

```
packages/
├── frontend/        ← 单机版前端（零改动）
├── room-service/    ← 游戏服务端（WebSocket, 4003）
├── match-service/   ← 匹配服务端（HTTP, 3000）
└── logic/           ← 共享逻辑包（ReScript 纯函数）
```

**😤 坑：循环依赖。** 初始化时几个包互相引用形成了环。解决方式是画依赖图，强制单向链：

```
logic（最底层，零依赖）
    ↑
room-service（依赖 logic 纯函数）
    ↑
frontend（依赖 room-service 协议类型 + logic 类型）
    ↑
match-service（最上层，依赖 room-service 房间状态）
```

---

## 4. 开闭原则：单机零改动

架构定型了，但还有一个约束没解决：**单机版「巨大娘的玩耍」已经是一个成熟的商业产品，不能因为多人功能去改它。**

**开闭原则——对扩展开放，对修改关闭。**

```
frontend/src/
├── scene3d_layer/           ← 单机代码（零改动！）
├── business_layer/
│   └── multiplayer/         ← 多人代码（只新增）
├── render_layer/
│   ├── Render.ts            ← 单机渲染
│   └── MultiplayerRender.ts ← 多人渲染（新增）
├── render_interface/        ← IRenderer 抽象层
└── logic_layer/             ← 共享逻辑
```

核心规则：**单机代码文件一行不改。** 所有多人功能放在 `business_layer/multiplayer/` 目录下。多人状态全部放在 `state.multiplayer` 子字段——单机代码不看这个字段，不会冲突。

多人退房时，模块级 `dispose` 负责清理所有资源：clearInterval、WS 连接、插值缓冲区、多人渲染器。

这个约束在 AI 协作时代尤其重要。传统开发中开闭原则是"好代码"的加分项，在 AI 协作中它是**必需品**——因为 AI 不确定什么不能改，给它一个 5000 行的大文件，它很可能把不相干的地方改出 bug。目录隔离之后，AI 只能在 `business_layer/multiplayer/` 里写代码，单机代码它碰不到。

> **开闭原则 = AI 协作时代的第一架构约束。**

---

## 总结

| 决策 | 解决什么问题 | 关键要点 |
|------|------------|---------|
| Logic 共享层 | 前后端逻辑不一致 | ReScript 纯函数 49KB |
| 双服务拆分 | 职责清晰化 | WS + HTTP 双模通信，从 demos/backend 拆出 |
| Monorepo 扩展 | 已有结构加新包 | Lerna + yarn workspaces |
| 开闭原则 | 单机多人共存 | 隔离目录 + dispose |

2026-06-09 这一天奠定了整个项目接下来所有迭代的架构基础。后面几周干的全是"在这个架子上加功能"，没有再动过架构本身。

接下来是漫长的 **迭代开发阶段**——Tick Loop、凸包碰撞、状态管理演进、BDD 测试体系，持续了整整两周。

**下一篇：[Vibe Coding 多人游戏（九）—— 迭代开发：Tick Loop、碰撞检测与状态管理演进](https://www.cnblogs.com/chaogex/p/21195307)**
