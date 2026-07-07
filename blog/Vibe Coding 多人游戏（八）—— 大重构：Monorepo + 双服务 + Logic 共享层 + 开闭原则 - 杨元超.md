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

### 插曲：函数式编程在多人联网中的应用

logic/ 包用 ReScript（函数式语言）写的，这不是偶然——**多人共享逻辑天然适合函数式范式，面向对象是反模式的。**

多人联网的核心问题是：**同一份代码在两个不同的运行时（Node + 浏览器）里跑，结果必须一致。**

#### 纯函数

```rescript
/* ✅ 纯函数：输入 → 输出，无副作用 */
let isCollision = (a: player, b: player): bool => {
  let dx = a.x -. b.x
  let dz = a.z -. b.z
  sqrt(dx *. dx +. dz *. dz) < 1.0
}
```

```typescript
/* ❌ 面向对象：方法依赖对象内部状态，外部不可控 */
class CollisionSystem {
  private players: Player[]
  checkCollision(a: Player, b: Player): boolean {
    // this.players 可能在调用间被修改！
  }
}
```

纯函数的好处：给定同样的输入（两个玩家坐标），永远返回同样的输出（是否碰撞）。不依赖 `this`、不依赖全局变量、不依赖时间——这些正是帧同步出问题的根源（同一个函数在不同客户端跑出不同结果）。

#### 接受和返回 State

面向对象传递状态的方式是 `this.state = newState`——方法不返回值，只改变内部状态。多人联网里这条路走不通：服务端改了状态，客户端怎么同步？

```rescript
/* ✅ FP 风格：接受 state，返回新 state */
let executeCommand = (state: gameState, cmd: command): gameState => {
  switch cmd.cmdType {
  | Move => { ...state, position: computeNewPosition(state, cmd) }
  | Attack => { ...state, hp: state.hp -. computeDamage(state, cmd) }
  }
}

// 调用方管理状态流转
let newState = executeCommand(oldState, moveCommand)
broadcastMsgGameState(newState)
```

```typescript
/* ❌ OOP 风格：方法不返回值，直接改内部状态 */
class Game {
  private state: GameState
  executeCommand(cmd: Command) {
    if (cmd.type === 'Move') {
      this.state.position = computeNewPosition(cmd)  // 改了内部
    }
  }
}
```

FP 模式的关键优势：**state 在每次调用后被显式返回，调用方可以自由决定是否广播、是否持久化、是否做快照。** 服务端可以在每帧打包 state 广播给所有客户端——因为在纯函数式模型里，state 就是数据，不是一个对象的私有财产。

#### 不可变数据

多人状态经过网络传输后是“拍平”的 JSON 对象。如果某个玩家改了状态后原地 mutate，其他端收到的就是脏数据。

FP 用不可变数据天然解决了这个问题——每次变更都产生新对象，旧状态作为历史快照自动保留。这在回滚（rollback）、重放（replay）、断线重连场景下极为省心。

```rescript
/* ✅ 不可变：... 扩展语法创建新状态 */
{ ...state, position: newPos }

/* ❌ 可变：直接改，其他引用全崩 */
state.position = newPos  // 别的地方还在用 oldState！
```

#### 函数组合

多人联网的逻辑是一个流水线：接收入站命令 → 执行 → 碰撞检测 → 伤害计算 → 广播。FP 用函数组合天然表达这个流程：

```rescript
/* ✅ 函数组合：流水线清晰可见 */
let tick = (state: gameState, commands: list<command>): gameState => {
  state
  |> executeAllCommands(commands)
  |> detectCollisions
  |> applyDamage
  |> cleanupDeadPlayers
}
```

如果用 OOP，同样的流程会散落在多个 manager 类的方法里，调用关系靠事件监听和回调串联，代码逻辑的流转路径肉眼难以追踪。

#### 柯里化

柯里化（Currying）在配置函数时特别有用：

```rescript
/* 柯里化：先把固定参数绑定好 */
let computeSpeed = (characterType: string): (float) => float => {
  let baseSpeed = characterType === "giantess" ? 3.0 : 1.0
  // 返回新函数，只需要移动距离这一个参数
  (distance) => baseSpeed *. distance
}

let giantessSpeed = computeSpeed("giantess")
let littlemanSpeed = computeSpeed("littleman")

// 使用：只需要传入当前帧的距离
giantessSpeed(0.5)  // 1.5
littlemanSpeed(0.5) // 0.5
```

在 OOP 里这通常要用策略模式或者工厂模式来实现——类+接口+多态，复杂度指数级上升。

#### 为什么 OOP 在多人共享逻辑里不好用

不是说 OOP 不好，而是**多人共享逻辑的核心需求恰好是 OOP 的弱点**：

| 维度 | FP 做法 | OOP 做法 | 多人场景的影响 |
|------|--------|---------|-------------|
| 状态管理 | 输入 state → 输出 state | 方法修改内部状态 | FP 模式下 state 可以直接序列化广播 |
| 无副作用 | 纯函数，不碰外部 | 方法依赖 this/成员变量 | FP 保证两端执行结果一致 |
| 可测试性 | 给输入测输出，零 mock | 需要 mock 对象/模拟 DI | FP 测试代码量少 3-5 倍 |
| 并发安全 | 不可变数据天然安全 | 锁 + 互斥 | 多人服务端高并发天然利好 FP |
| 跨运行时 | 数据是普通 JSON/Record | 对象序列化麻烦（循环引用） | FP 状态直接 JSON.stringify 就能发 |

最实际的差异体现在测试上。测试一个 FP 的 `executeCommand`：

```typescript
// FP 测试：造输入 → 调函数 → 断言输出
test('move command updates position', () => {
  const state = createInitialState()
  const cmd = { type: 'Move', x: 10, z: 10 }
  const newState = executeCommand(state, cmd)
  expect(newState.position.x).toBe(10)
})
```

如果要测试同功能的 OOP 版本，需要：实例化 Game 对象 → 可能 mock 数据库 → 可能 mock 网络层 → 调用方法 → 再读出内部 state 验证。

引用一句社区经验：**"FP 让不可能的事变得困难，让困难的事变得可能。"** 在多人共享逻辑这个领域，函数式范式不只是一个风格选择，而是直接解决了面向对象解决不了的问题——让同一份代码在两个不同的运行时产生完全相同的结果。

### FP 的连锁效应：为多线程、WebGPU 和 SoA 铺路

函数式设计的影响不止于共享逻辑。后面几期会详细讲到的三个方向，它们的可实行性都跟这一天的 FP 决策直接相关：

#### 多线程（Worker）

FP 加不可变数据最被低估的价值是**天然线程安全**。每个 worker 拿到自己的 state 快照，处理后返回新 state，主线程合并。零锁、零竞态、零数据竞争。

换成 OOP：每个线程里都有一个 Game 对象，方法改了内部 `this.state`。不加锁数据坏掉，加了锁性能回到单线程。FP 零锁的原因是：数据是值（value），不是可变的共享引用。

#### WebGPU Compute Shader

WebGPU 的 compute shader 本质上是**纯函数**：输入一个 buffer，输出一个 buffer。读取输入数组，写入输出数组——跟 FP 的 `state -> newState` 一模一样。

如果逻辑层已经是 FP 风格，迁移到 GPU 并行计算的难度大幅降低：`players.map(updateOnePlayer)` → `dispatchWorkgroups(positionsBuffer)`。对象继承树和虚函数表无法映射到 GPU。

```
FP 风格：  state |> computePhysics |> computeCollisions |> broadcast
GPU 映射： buffer |> computeShader0 |> computeShader1 |> copyToCPU
```

#### SoA（Structure of Arrays）

FP 的不可变数据天然符合 **SoA 内存布局**：

```typescript
// AoS（Array of Structures）— OOP 风格
interface Player {
  position: { x: number, y: number, z: number }
  velocity: { x: number, y: number, z: number }
  hp: number
}
let players: Player[] = [...]

// SoA（Structure of Arrays）— FP 风格，纯数据
let positions   = new Float32Array(playerCount * 3)  // 连续内存
let velocities  = new Float32Array(playerCount * 3)  // 连续内存
let hp          = new Float32Array(playerCount)       // 连续内存
```

SoA 的好处：
- **Cache locality**：处理 position 时只遍历 position 数组，不踩到 hp/velocity 的缓存行
- **零 GC**：TypedArray 不在堆上分配，不触发 GC
- **GPU 就绪**：Float32Array 可以直接上传到 GPU StorageBuffer，无需转换格式
- **分支预测**：计算 hp 时不混入 position 的读取

FP 让 SoA 变得自然，因为 FP 里数据是纯值（value），不是封装了方法的高耦合对象（object）。把一个 `Player` 对象的字段拆成几个 TypedArray，在 OOP 里需要大改——方法怎么调？封装在哪？FP 里本来就是 `executeCommand(state, cmd)`，`state` 是 `{positions, velocities, hp}` 几个数组，SoA 跟 FP 风格天然相容。

> 这三件事——多线程、WebGPU、SoA——在 P8 阶段一个都没做，但这一天的 FP 决策让它们全部变成了「只要想做就能做」。相反，如果在 06-09 选了 OOP + 可变状态，后面任何一个方向的迁移都会需要「全部重写」。

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

多人退房时，模块级 `dispose` 负责清理所有资源：clearInterval、WS 连接、多人渲染器。

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
