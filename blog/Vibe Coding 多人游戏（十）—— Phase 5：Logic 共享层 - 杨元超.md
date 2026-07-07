# Vibe Coding 多人游戏（十）—— Phase 5：Logic 共享层

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

双服务架构定型了，但有个问题一直没解决：**前端和服务端的逻辑怎么保持一致？**

碰撞检测、移动速度、伤害计算——这些代码如果在两端各写一份，迟早会不同步。basic1 的帧同步已经证明：浮点数不一致只是表象，更深层的问题是"同一份逻辑没有单一的来源"。

---

## 方案：纯函数共享层

答案是**把核心逻辑抽成纯函数包，两端各加载一份**。

```
┌─────────────────────┐
│    logic 包          │  ← ReScript 纯函数
│    (bundle-logic.js) │     无网络、无 IO、无状态
└────────┬────────────┘
         │
    ┌────┴────┐
    ↓         ↓
room-service  frontend
(服务端加载)   (浏览器加载)
```

关键设计约束：
- **纯函数**：输入 → 输出，无副作用。同样的输入永远得到同样的输出
- **无 IO**：不碰网络、不碰文件、不碰 DOM
- **无状态**：全局状态由外层管理，logic 只看当前帧的数据

---

## 为什么用 ReScript

ReScript（前身是 BuckleScript/ReasonML）是 TypeScript 的超集，编译为干净高效的 JavaScript。

**选 ReScript 的理由：**

1. **纯函数天然友好**：ReScript 默认 immutable，变量不可 reassign，模式匹配（pattern matching）优雅
2. **编译产物极小**：`bundle-logic.js` 只有 49KB（gzip 后 ~15KB），浏览器加载无负担
3. **类型双向导出**：`@genType` 注解让 ReScript 的类型自动生成 `.gen.tsx`，TypeScript 可以直接 import 类型安全的函数

```rescript
/* Movement.res — 移动逻辑（纯 ReScript）*/

let computeSpeed = (characterType: string): float => {
  let speed = if characterType === "giantess" { 3.0 } else { 1.0 }
  speed
}

let clampToBounds = (x: float, z: float): (float, float) => {
  let clampedX = if x < Config.boundaryMin { Config.boundaryMin }
                 else { if x > Config.boundaryMax { Config.boundaryMax } else { x } }
  let clampedZ = if z < Config.boundaryMin { Config.boundaryMin }
                 else { if z > Config.boundaryMax { Config.boundaryMax } else { z } }
  (clampedX, clampedZ)
}
```

编译后的 bundle `index.js` 是一个对象，导出的就是这些纯函数：

```javascript
// 编译产物
let Movement = require("./logic/Movement.js")

let computeSpeed = Movement.computeSpeed
let executeCommand = Movement.executeCommand
let computeCollisionDamage = Movement.computeCollisionDamage

exports.computeSpeed = computeSpeed
exports.executeCommand = executeCommand
exports.computeCollisionDamage = computeCollisionDamage
```

**两端调用完全一样**：

```typescript
// room-service（服务端）
import { executeCommand, computeCollisionDamage } from "logic"

function tick(state) {
    state = executeCommand(state)
    state = computeCollisionDamage(state)
    broadcastMsgGameState(state)
}
```

```typescript
// frontend（客户端）
import { executeCommand } from "logic"

// 用于本地预测
let predictedState = executeCommand(currentState, localInput)
```

---

## Logic 包里有什么

```
packages/logic/src/
├── index.js              ← 编译入口，re-export 所有公共函数
├── index.res             ← ReScript 源入口（type exports）
├── logic/
│   ├── Movement.res      ← 移动逻辑、速度计算
│   ├── CameraManager.res ← 相机控制
│   └── ...
├── types/
│   ├── CommandType.res   ← 命令类型定义
│   ├── GameState.res     ← 游戏状态类型
│   └── ...
├── config/
│   ├── ModelConfig.res   ← 模型配置（碰撞盒、默认朝向）
│   └── ...
└── index.d.ts           ← TypeScript 类型定义
```

核心函数一览（从 `index.js` 导出）：

| 函数 | 输入 → 输出 | 用途 |
|------|------------|------|
| `computeSpeed` | characterType → speed | 巨人和小人不同移动速度 |
| `executeCommand` | state + command → state | 执行移动、攻击等命令 |
| `isCollision` | 两个碰撞盒 → boolean | 碰撞检测 |
| `computeCollisionDamage` | state → state | 碰撞伤害计算 |
| `getCollisionBox` | modelConfig → collisionBox | 获取当前动画帧的碰撞盒 |
| `getMaxHp` | characterType → number | 获取最大血量 |
| `getCommandName` | commandType → string | 命令类型 → 可读名 |

**凸包碰撞检测也在这里**：`Movement.res` 里有完整的 SAT（分离轴定理）实现，用纯 ReScript 写的，两端共用。

---

## 部署时的关键细节

logic 包编译为 JS 后，room-service 通过 `bundle-logic.js` 加载：

```
# room-service 的 zip 包结构
svc/
├── index.js                ← 服务端入口
├── node_modules/
│   └── logic/
│       ├── index.js        ← bundle-logic.js（49KB）
│       └── logic/
│           ├── Movement.js
│           └── ...
└── scf_bootstrap
```

前端通过 Webpack 打包时，`import { executeCommand } from "logic"` 会被解析到本地包，直接打包进 bundle。

**😤 坑：bundle 闭包暴露问题**

logic 的编译产物是一个 CommonJS 包。但在 SCF 上，`require("logic")` 时由于 `node_modules` 目录深度和 `package.json` 的 `"type": "module"` 冲突，第一次部署时死活加载不了。

解决方式：在 zip 打包前把 logic 包的 `package.json` 中的 `"type": "module"` 删掉，或者直接注入 `node_modules/logic/` 目录。

---

## 阶段总结

Logic 共享层是整套架构里**性价比最高**的设计：

- 编写一次 → 两端跑同样的代码
- 浮点数问题变服务端问题（只有一份计算，不需要同步）
- 测试只需要测 logic 包（纯函数，输入输出明确）
- 碰撞检测、移动逻辑、伤害计算——所有游戏核心逻辑都在这里

> **纯函数共享层 = AI 协作时代的"宪法"。** 前端和服务端都不需要理解完整逻辑，它们只需要遵守同一个输入输出契约。

---

下期讲 **Phase 6：服务端权威完整实现**——Tick Loop、代次守卫、绝对状态、双轨动画，服务端怎么把整个游戏跑起来。

**下一篇：[Vibe Coding 多人游戏（十一）—— Phase 6：服务端权威完整实现](https://www.cnblogs.com/chaogex/p/21195307)**
