# Vibe Coding 多人游戏（八）—— Phase 3：Monorepo 重构

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

前两期我们做了两个原型：basic1（帧同步）和 new_basic2（状态同步）。代码长什么样？

```
demos/
├── basic1/        ← 直接引用 room-service/src/
├── new_basic2/    ← 同样跨目录引用
packages/
├── room-service/   ← 游戏服务端
├── match-service/  ← 匹配服务端
├── .../            ← 其他独立包
```

demos 里的前端代码通过 `../../../room-service/src/shared/protocols/...` 引用服务端类型。跨目录 import 到处都是，每次重构类型路径就断一片。

**Phase 3 要解决的核心问题：代码怎么组织，才能让多个包共享类型而不乱？**

---

## 为什么需要 Monorepo

在 new_basic2 阶段，三个问题已经很疼了：

**1. 类型共享靠「运气」**

前端要引用 `MsgGameState`（服务端的全量状态协议），写的是：

```typescript
import { playerState } from "room-service/src/shared/protocols/MsgGameState"
```

这个路径依赖 `tsconfig paths` 的别名，更糟的是 basic1 直接用 `../../../` 相对路径。前端改一下目录结构，所有 import 全断。

**2. 构建配置各自为政**

- 前端用 Webpack + tsc
- room-service 用 TSRPC CLI
- match-service 用 tsrpc-cli + mocha
- logic 用 ReScript + rescript build

四个不同的构建脚本、四个不同的测试框架、四个不同的 tsconfig。改一个公共接口要在四个地方同步改。

**3. 没有"改一端全崩"的保障**

前端改了 `MsgGameState` 里 `positionX` 的类型——room-service 还在发旧的 int，编译不会报错，上线后才会发现类型对不上。

> **Monorepo 的核心价值不是"代码放一起"，而是"类型共享 + 统一构建 + 变更影响立即可见"。**

---

## Lerna + Yarn Workspaces 配置

我们用 Lerna 管理 monorepo，yarn workspaces 做本地包链接。

```json
// lerna.json
{
    "packages": [
        "asset-lib/*",
        "packages/*",
        "demos/*",
        "mods/*",
        "defaults/*"
    ],
    "npmClient": "yarn",
    "useWorkspaces": true,
    "version": "0.0.1"
}
```

工作区覆盖了整个项目结构——不只是 `packages/`，还有 `demos/`、`asset-lib/`、`mods/` 等。每个子目录下的 `package.json` 都通过 yarn workspace 互相感知。

---

## 四包结构设计

原来的 demos 拆成了 4 个核心包：

```
packages/
├── frontend/          ← Three.js + React 前端渲染与交互
│   ├── src/
│   │   ├── business_layer/   ← 多人业务逻辑（隔离层）
│   │   ├── render/           ← Three.js 渲染
│   │   └── ui/               ← React UI 组件
│   └── package.json      → 包名 "frontend"
│
├── room-service/       ← 游戏服务端（WebSocket, 4003）
│   ├── src/
│   │   ├── models/           ← Game.ts, Server.ts
│   │   ├── shared/           ← 协议定义（全包共享）
│   │   └── state/            ← 服务端状态管理
│   └── package.json      → 包名 "room-service"
│
├── match-service/      ← 匹配服务端（HTTP, 3000）
│   ├── src/
│   │   ├── room/             ← 房间管理逻辑
│   │   └── shared/           ← 匹配协议
│   └── package.json      → 包名 "match-service"
│
└── logic/              ← 前后端共享逻辑（ReScript）
    ├── src/
    │   ├── GameState.res      ← 游戏状态类型
    │   ├── ExecuteCommand.res ← 命令执行
    │   └── ...
    └── package.json      → 包名 "logic"
```

**每个包的关键职责：**

| 包 | 运行时 | 通信方式 | 核心功能 |
|----|--------|---------|---------|
| frontend | 浏览器 | WebSocket 连 room | 渲染、输入、插值 |
| room-service | SCF | WebSocket 4003 | 游戏循环、状态广播 |
| match-service | SCF | HTTP 3000 | 匹配分配、房间管理 |
| logic | 两端复用 | 纯函数（无 IO） | executeCommand、碰撞检测 |

最妙的设计是 `logic` 包：用 ReScript 写成纯函数，编译后生成 `bundle-logic.js`（仅 49KB），frontend 和 room-service 各加载一份，保证两端执行相同逻辑——这期先不展开，Phase 5 专门讲。

---

## 从 demos/ 到 packages/ 迁移

迁移最核心的变化是：**跨包引用不再用相对路径，用包名。**

```typescript
// 以前（demos/basic1）
import { MsgGameState } from "../../../room-service/src/shared/protocols/MsgGameState"

// 以后（packages/frontend）
import { MsgGameState } from "room-service/src/shared/protocols/MsgGameState"
```

借助 yarn workspaces，`packages/room-service/` 链接到了 `node_modules/room-service/`。前端 import `room-service` 时，yarn 知道指向本地包。

**但 tsconfig 仍然需要 paths 别名才能让 TypeScript 理解这种引用：**

```json
{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "room-service/*": ["packages/room-service/*"],
            "match-service/*": ["packages/match-service/*"],
            "logic/*": ["packages/logic/*"]
        }
    }
}
```

---

## 😤 坑

**坑 1：循环依赖**

monorepo 刚初始化时，几个包互相 import 转一圈：

```
logic → room-service → frontend → logic
```

TypeScript 会报 circular dependency，构建也会无限递归。

**解决：** 画依赖图，找到循环。最终约束为单向依赖链：

```
logic（最底层，无依赖）
    ↑
room-service ← 依赖 logic 的纯函数
    ↑
frontend ← 依赖 room-service 的协议类型
    ↑
match-service（最上层，依赖 room-service 获取房间状态）
```

**坑 2：类型引用路径混乱**

迁移初期，新旧两种路径风格并存：

```typescript
// 旧风格（basic1 遗留）
import { ... } from "../../../room-service/src/..."

// 新风格（monorepo 规范）
import { ... } from "room-service/src/..."
```

重构时两个都要改，漏一个就编译不过。解决方式是**先加 tsconfig paths，再批量替换旧路径**，最后删掉旧路径的可用性。

---

## 阶段总结

Monorepo 重构没有引入任何新功能，但为后续的所有开发铺平了路：

| 迁移前 | 迁移后 |
|--------|--------|
| 跨目录 import，路径随便断 | 包名引用，yarn workspace 管理 |
| 类型改一处崩四处 | 类型改一处，TS 编译全崩（发现即修复） |
| 各自构建配置 | 统一 tsc + jest + rescript build |
| basic1/new_basic2 两套前端分开 | 一个 frontend 包统一管理 |

**Monorepo 不是锦上添花——它是"代码能持续演进"的前提。** 没有它，后面 7 个 Phase 的迭代会在类型混乱中寸步难行。

---

下期讲 **Phase 4：双服务架构**——为什么要把 room-service 和 match-service 拆成两个独立部署的服务，以及 WS + HTTP 双模通信怎么设计。

**下一篇：[Vibe Coding 多人游戏（九）—— Phase 4：双服务架构](https://www.cnblogs.com/chaogex/p/21195307)**
