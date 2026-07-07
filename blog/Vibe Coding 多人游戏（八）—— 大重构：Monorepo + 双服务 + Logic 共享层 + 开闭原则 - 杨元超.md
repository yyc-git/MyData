# Vibe Coding 多人游戏（八）—— 大重构：Monorepo + 双服务 + Logic 共享层 + 开闭原则

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

P6 和 P7 我们用两个原型（basic1 帧同步、new_basic2 状态同步）证明了多人联机能跑。代码结构却惨不忍睹：

```
demos/
├── basic1/            ← 跨目录 ../../../ 引用服务端类型
├── new_basic2/        ← 同样混乱
packages/
├── room-service/      ← 游戏+匹配混在一个服务里
├── match-service/     ← 雏形
└── frontend/          ← 单机代码和多人代码混在一起
```

跨目录 import、职责混在一起、单机多人互相污染——不改不行了。

## 2026-06-09：一天重构

所有架构决策发生在**同一天**（2026-06-09）：

1. **Monorepo**：Lerna + Yarn Workspaces 统一管理所有包
2. **双服务**：room-service（游戏循环）和 match-service（房间匹配）职责分离
3. **Logic 共享层**：ReScript 纯函数包，前后端加载同一份代码
4. **开闭原则**：多人代码独立目录，单机代码一行不改

这四个决策不是四个步骤——它们是同一个架构方案的不同侧面。一天内全部落地。

---

## 1. Monorepo：Lerna + Yarn Workspaces

核心问题：多个包之间的类型怎么共享？demos 阶段用 `../../../` 跨目录引用，每次改目录结构就断一片。

**方案：** Lerna monorepo + yarn workspaces 本地包链接。

```json
// lerna.json
{
    "packages": [
        "asset-lib/*", "packages/*", "demos/*",
        "mods/*", "defaults/*"
    ],
    "npmClient": "yarn", "useWorkspaces": true
}
```

四包结构：

```
packages/
├── frontend/        ← Three.js + React 前端
├── room-service/    ← 游戏服务端（WebSocket, 4003）
├── match-service/   ← 匹配服务端（HTTP, 3000）
└── logic/           ← 共享逻辑包（ReScript 纯函数）
```

跨包引用用包名而非相对路径：

```typescript
// 以前
import { MsgGameState } from "../../../room-service/src/..."

// 以后
import { MsgGameState } from "room-service/src/shared/protocols/MsgGameState"
```

借助 yarn workspaces，`packages/room-service/` 自动链接到 `node_modules/room-service/`。TypeScript 通过 `tsconfig paths` 别名理解这种引用：

```json
{
    "paths": {
        "room-service/*": ["packages/room-service/*"],
        "match-service/*": ["packages/match-service/*"],
        "logic/*": ["packages/logic/*"]
    }
}
```

**😤 坑：循环依赖。** 初始化时几个包互相引用形成了环。解决方式是画依赖图，强制单向链：

```
logic（最底层，零依赖）
    ↑
room-service（依赖 logic 纯函数）
    ↑
frontend（依赖 room-service 协议类型）
    ↑
match-service（最上层，依赖 room-service 房间状态）
```

---

## 2. 双服务：room-service + match-service

重构之前，room-service 既管游戏循环又管房间匹配——一个 God Object，改匹配得重启游戏。

**拆开：** 

| 服务 | 协议 | 职责 |
|------|------|------|
| room-service | WebSocket（4003） | 游戏循环、状态广播、碰撞检测 |
| match-service | HTTP（3000） | 房间创建/匹配/列表查询 |

通信链路：

```
浏览器
  ├── WS → room-service（实时游戏状态）
  └── HTTP → match-service（创建/查找房间）
               │
           WS 监听 room-service 状态
```

match 通过 WebSocket 连到 room-service 获取房间状态。这有一个坑——**room 重启后 match 的 WS 断开，必须重启 match 才能重连。** 后来改为 match 每次请求实时查询，不缓存状态。

全链路类型安全靠 TSRPC 的 `serviceProto.ts` 维持——改一个协议文件，所有引用端 TypeScript 编译全崩，问题在部署前就暴露了。

---

## 3. Logic 共享层：ReScript 纯函数

双服务拆开后出现一个新问题：**碰撞检测、移动速度、伤害计算在 room-service 写一份，frontend 预测要再写一份？** 两边的代码迟早不一致。

**方案：** 抽成纯函数包 `packages/logic/`，两端加载同一份。

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

ReScript（前身 BuckleScript/ReasonML）默认不可变，模式匹配优雅，编译产物极小。`@genType` 注解自动生成 `.gen.tsx` 类型定义，TypeScript 可以直接 import。

```rescript
/* Movement.res — 纯 ReScript 写的移动逻辑 */
let computeSpeed = (characterType: string): float => {
  characterType === "giantess" ? 3.0 : 1.0
}

let executeCommand = (state: gameState, command: command): gameState => {
  // 模式匹配处理不同类型命令
  switch command.cmdType {
  | Move => { ...state, position: computeNewPosition(state, command) }
  | Attack => { ...state, hp: state.hp - computeDamage(state, command) }
  }
}
```

编译产物仅 **49KB**（gzip ~15KB），前端打包无负担。

**logic 包包含的核心函数：**

| 函数 | 用途 |
|------|------|
| `executeCommand` | 执行移动/攻击等命令 |
| `isCollision` | 碰撞检测（SAT 凸包算法） |
| `computeSpeed` | 不同角色类型速度计算 |
| `computeCollisionDamage` | 碰撞伤害计算 |
| `getCollisionBox` | 模型碰撞盒配置 |
| `getMaxHp` | 角色最大血量 |

**😤 坑：bundle 闭包暴露问题。** 在 SCF 上 `require("logic")` 时因为 `node_modules` 目录深度和 `package.json` 的 `"type": "module"` 冲突，首次部署死活加载不了。解决方式是 zip 打包前注入 `node_modules/logic/` 目录并删掉冲突的 module type。

---

## 4. 开闭原则：单机零改动

架构定型了，但还有一个架构层面的约束没解决：**单机版「巨大娘的玩耍」已经是一个成熟的商业产品，不能因为多人功能去改它。**

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
| Monorepo | 跨包类型共享 | Lerna + yarn workspaces |
| 双服务 | God Object 拆分 | WS + HTTP 双模通信 |
| Logic 共享层 | 前后端逻辑一致 | ReScript 纯函数 49KB |
| 开闭原则 | 单机多人共存 | 隔离目录 + dispose |

2026-06-09 这一天奠定了整个项目接下来所有迭代的架构基础。后面几周干的全是"在这个架子上加功能"，没有再动过架构本身。

接下来是漫长的 **迭代开发阶段**——Tick Loop、凸包碰撞、状态管理演进、BDD 测试体系，持续了整整两周。

**下一篇：[Vibe Coding 多人游戏（九）—— 迭代开发：Tick Loop、碰撞检测与状态管理演进](https://www.cnblogs.com/chaogex/p/21195307)**
