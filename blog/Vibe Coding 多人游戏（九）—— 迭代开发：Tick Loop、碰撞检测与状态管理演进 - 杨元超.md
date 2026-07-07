# Vibe Coding 多人游戏（九）—— 迭代开发：Tick Loop、碰撞检测与状态管理演进

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

架构建好了，剩下全是细节。

从 2026-06-10 到 2026-06-28，两周时间没有架构变动，只有功能迭代和 bug 修复。这期把迭代阶段的几个核心子系统讲清楚：**Tick Loop（服务端权威）**、**碰撞检测**、**状态管理四轮重构**、**动画同步**、**MMD 接入踩坑**、**架构打磨**。

它们不是按先后顺序完成的，而是交织迭代的——改一个往往要连带改另外两个。

---

## Tick Loop 与代次守卫

服务端的核心是一个 `setInterval` 驱动的 tick 循环。说出来好笑，这行代码我们写了三遍才写对。

### v1：闭包直接引用

最初 service 启动时创建一个 setInterval，闭包里直接引用 loop 函数里的状态变量。

```typescript
let state = createInitialState()
let intervaler = setInterval(() => {
  state = serverTick(state)
  broadcast(state)
}, 100)
```

问题暴露在第一个玩家进入后退出再进入的场景——`state` 在 setInterval 闭包里捕获的是初始引用，后续玩家加入时 `state` 被外部代码修改，但 interval 里的 `state` 还是旧的。更致命的是，新开一局时旧 loop 还在跑，跟新 loop 同时广播状态，客户端在两个世界之间来回跳。

### v2：readState + 清理旧 loop

修复方式：每次 tick 从全局读取最新 state，开新 loop 前清理旧的。

```typescript
const startTickLoop = (state) => {
    // 清理旧 loop
    forEach(existingIntervaler => {
        clearInterval(existingIntervaler)
    }, state.broadcastRegularlyIntervaler)

    let intervaler = setInterval(() => {
        let s = readState()  // 读最新 state
        s = serverTick(s)
        broadcast(s)
    }, tickInterval)
}
```

这版在本地测试没问题。但部署到 SCF warm container 后 bug 复现了——第一局的 tick loop 因为异步时序没被清理干净，第二局的 loop 启动后两个 loop 共存。

### v3：代次守卫（最终方案）

```typescript
export let startTickLoop = (state: state): state => {
    // 清理旧 loop
    forEach(existingIntervaler => {
        clearInterval(existingIntervaler)
    }, getState(state).broadcastRegularlyIntervaler)

    // 代次守卫：每次启动新 loop 时递增代次
    let gen = state.room.tickGeneration + 1
    state = { ...state, room: { ...state.room, tickGeneration: gen } }

    let tickInterval = state.config.isDev ? 1000 / 30 : 1000 / 10
    let intervaler = setInterval(() => {
        let s = readState()

        // 代次守卫检测——旧 loop 自毁
        if (s.room.tickGeneration !== gen) {
            clearInterval(intervaler)
            return
        }

        s = _serverTick(s, TICK_INTERVAL_SEC)
        broadcastMsgGameState(s)
    }, tickInterval)
}
```

**代次守卫（Generation Guard）** 的思路很简单：每次启动新 loop 时递增一个代次号，每个 tick 循环的第一件事就是检查当前代次是否还是自己启动时的代次。如果不是，说明有更新的 loop 启动了，自己立刻自毁。

这个 bug 是典型的 warm container 问题——进程不重启，所以旧的 setInterval 不会因为"关服"而被清理。在传统一次性部署里不存在，但在 Serverless 场景下反复出现。

**生产 vs 开发不同频率：** 开发环境 30fps（方便观察实时变化），生产环境 10fps（省成本、省带宽）。这个区分也是踩了坑才加的——一开始统一 30fps，发现 SCF 资源消耗比预期高 3 倍。换成 10fps 后体感无差别（因为客户端 60fps 渲染 + 服务端 10fps 推送，用户感知的是 60fps 的流畅度）。

---

## 碰撞检测：从 AABB 到凸包

碰撞检测是迭代期间改动最多的模块，没有之一。

### Stage 1：AABB（basic1 时期）

最初的碰撞盒是轴对齐包围盒（Axis-Aligned Bounding Box），就是那种跟坐标系平行的方盒子。画面里两个方块做碰撞检测时没问题，但一旦角色**旋转**——AABB 不会跟着转，碰撞盒要么太大（包住旋转后的模型），要么太小（模型肢体露出盒子）。

**教训：** 对旋转敏感的游戏角色，AABB 是错误的基础假设。它只适合不旋转的物体或者四叉树空间分区。

### Stage 2：OBB（new_basic2）

改成有向包围盒（Oriented Bounding Box），盒子跟着角色旋转。实现用了 Separating Axis Theorem（SAT）做碰撞检测——投影到一个轴上判断是否重叠。

**新问题：** OBB 是完美的长方体，而巨大娘的骨骼模型轮廓不是长方体——腋下、裙摆、头部的空隙全都算作"碰撞体内部"。两个巨大娘还没碰到，碰撞检测就触发了。

### Stage 3：凸包（Convex Hull + SAT，最终方案）

**凸包（Convex Hull）** 是把模型的外轮廓包裹成最小凸多面体。SAT 检测两个凸多面体是否重叠。对两个 OBB（每个 6 个面）需要检测 15 条分离轴：

- A 的 3 个面法向
- B 的 3 个面法向  
- 9 个边叉积（3 × 3）

全部 15 条轴投影都重叠才算碰撞，任意一条不重叠→不碰撞。

凸包用纯 ReScript 写在 logic 包里：

```rescript
let isHullOverlap = (hullA: hullPart, hullB: hullPart): bool => {
  // 15 条分离轴投影测试
  // 任意轴投影不重叠 → 不碰撞（提前 return false）
  // 所有轴投影都重叠 → 碰撞
}
```

**😤 坑：AI 巨人寻路阻塞 tick loop**

AI 的路径规划跟玩家命令处理在同一个 `setInterval` 里跑。某次测试发现：AI 巨人开始走向一个目标点，如果目标点恰好被障碍物挡住（比如另一个玩家站在门口），路径规划就会陷入死循环——尝试所有方向都找不到可达路径。

症状：**所有玩家同时瞬移**。因为 tick loop 被阻塞了，队列里堆积的命令一次性全部执行完。

解决：路径规划加 200ms 硬超时兜底。超时后用当前位置做目标，绝不阻塞 tick：

```typescript
let pathfindWithTimeout = (start, end, timeout = 200): Path => {
    return Promise.race([
        pathfind(start, end),
        sleep(timeout).then(() => [start])
    ])
}
```

---

## 动画同步：三小时 debug 实录

2026-06-11 下午，我花了一整个下午修复角色动画同步问题。这个过程最能体现 AI 协作下的 debug 模式：

### Round 1：旋转方向 + 动画同步（14:00~14:30）

症状：本地玩家移动时旋转方向正确，但远程玩家看到的本地玩家朝向不对。同时，远程玩家的动画状态（idle/running）跟实际移动不匹配。

排查过程：
1. 本地移动用了 `computeFaceAngle(dx, dz, facing)` 补偿 BackwardZ 朝向
2. 远程玩家 `rotationY` 没用这个补偿——同一个函数，两端执行路径不同
3. 最终定位：`animationName` 字段不在服务端广播的 schema 里→客户端各自本地推断→推断逻辑不一样→同步失败

修复：
- `playerState` 加 `animationName` 字段
- 远程玩家动画用服务端推送的 animationName，不用本地推断
- 区分 idle/running 分别处理旋转补偿

### Round 2：重构到服务端处理（14:30~14:50）

刚修完 Round 1，感觉补偿逻辑放客户端不够干净。决定把所有旋转补偿放到 `Movement.res`（logic 包）：

```rescript
// Movement.res — 统一处理
let computeRotation = (state, command) => {
  if (isMoving(command)) {
    // 移动时：用移动方向算朝向
    atan2(moveX, moveZ)
  } else {
    // 空闲时：保持最后一次移动朝向 + PI 补偿
    lastRotation + PI
  }
}
```

客户端只渲染，零补偿逻辑。

### Round 3：ModelConfig 移到 logic/（14:50~15:05）

补偿逻辑里的 `DefaultFacing`（默认朝向配置）还留在前端 `ModelConfig.ts` 里。`Infantry.fbx` 默认朝向 -Z（BackwardZ），`Cube` 默认 +Z（ForwardZ）。logic 包没有这个配置。

把 `ModelConfig` 也搬到 logic/ 里，用 `@genType` 导出类型给 TS 用。

三小时修了三轮，每一轮都在把边界推到更接近底层的位置。AI 在这个过程中负责执行具体的代码改动，每一轮的方向都是我根据测试结果定。

---

## MMD 接入：三套方案两轮重构

### 第一次接入：MMDManager + addMeshToScene

MMD 巨大娘模型跟 FBX 小人模型是完全不同的加载管线：

- FBX：`FBXLoader.load` → `AnimationMixer` → `crossFade`
- PMX：`MMDLoader.loadWithAnimation2` → `CCDIKSolver` → 专用 `update` 循环

第一版简单粗暴：在 `logic_layer/` 新建 `MMDManager.ts`，里面直接 import Three.js。`ManageScene.ts` 调用它。

**问题：** `logic_layer/` 本来承诺零渲染依赖，结果 MMDManager 直接 import three。测试没法写，要 mock 整个 MMDLoader 链。

### 第二次重构：MMD 下沉到 ThreeRenderer

把 `createMMDCharacter`、`updateMMDAnimations` 等方法加到 `IRenderer` 接口，`ThreeRenderer` 实现。logic_layer 只通过接口操作。

**问题：** ThreeRenderer 变得臃肿——它本是原子渲染器，却要理解 MMD 动画状态机。职责不单一。

### 第三次重构：MultiplayerRender 模块函数

最终架构：

```
ThreeRenderer (IRenderer)     ← 原子操作：addEntity/setPosition/fadeOutAction
MultiplayerRender (模块函数)   ← 编排：组合原子操作实现 MMD 跨淡
ManageScene/MultiplayerLoop   ← 编排逻辑层+调用 MR 模块函数
```

`MultiplayerRender` 不是 IRenderer，不实现接口——它是模块函数的集合，直接 import 调用。这样 logic_layer 不会直接操作 Three.js，但 MultiplayerRender 又不受 IRenderer 接口的束缚。

**MMDLoader Mock 排坑**

测试时 mock `loadWithAnimation2`，签名必须精确匹配 8 个参数：

```typescript
loadWithAnimation2(pmx, loadBuffer, loadVmdBuffer, loadTexture, vmdData, 
                   onComplete, onProgress, onError)
```

之前 mock 只传了 3 个参数，resolve 永远不触发→测试挂死。这也是 AI 写的 mock——它看到 TypeScript 类型签名只声明了必选参数，没注意到实际调用传了 8 个。

### 脚部 IK 的坑

PMX 模型的脚部 IK（逆向运动学）解算在 MMDLoader 内部自动处理，但有一个前提——**骨骼的 matrixWorld 必须是最新的**。

症状：MMD 模型走起来脚陷进地板。

排查了三套方案都失败：

1. **Group 套一层** → 无效，bone.updateWorldMatrix 走父链包含 Group 变换
2. **MMDManager.update 归零** → 第一帧 IK 就错
3. **_animatePMXMesh 归零但不更新 matrixWorld** → 骨骼 matrixWorld 不一致

最终修复：修改 `_animatePMXMesh`，在循环 IK 前保存 mesh.transform → 归零 → 强制 `mesh.updateMatrixWorld(true)` → 跑 IK → 恢复。

关键发现：meta3d 把 `mesh.updateMatrixWorld(true)` 替换成只更新左右脚的 `_updateBoneMatrixWorldForIK`，其他骨骼的 matrixWorld 可能是 stale 值。

---

## 状态管理四轮重构

从 basic1 到生产版，状态管理重写了四次。不是因为闲得慌，每次都在解决真实问题。

### v1：Immutable.js Map（basic1 时期）

帧同步需要快照回滚，Immutable.js 不可变数据结构天然适合。

```typescript
let state = Map({
    players: Map({
        user_1: Map({ x: 0, y: 0, hp: 100 }),
    })
})
let newState = state.setIn(["players", "user_1", "x"], 1)
```

**问题：** 包体积 ~50KB，API 学习成本高，类型推导体量爆炸。`setIn` 每次创建新对象树增大 GC 压力。在多人高频更新的场景下，几千个 Immutable 对象在堆上快速创建-销毁，GC 一卡就是几十毫秒。

### v2：自制 ImmutableHashMap

去掉 Immutable.js，自建轻量 HashMap。用开放寻址法 + 平方探测，性能不错。

**问题：** 自制 hash 实现有冲突 bug——某些 key 组合下 `set("player_1", data)` 会把 `player_2` 的数据覆盖掉。玩家 HP 突然变成别人的。Zero 依赖但也 zero QA。手写哈希表没有经过验证，这个项目也不需要。

### v3：Js.Dict

回归 JavaScript 原生对象，最低成本方案。

```typescript
let players: { [username: string]: playerState } = {}
players["user_1"] = { x: 0, y: 0, hp: 100 }
```

**问题：** `players["nonexistent"]` 返回 `undefined` 但 TypeScript 不强制检查，忘掉空值判断就崩。深拷贝也得自己写——`JSON.parse(JSON.stringify(obj))` 把 `undefined` 值全丢了。

### v4：SoA Store（最终版）

彻底重构——按职责拆 Store，按数据性质拆 Layout。

```typescript
// AoS 模式（之前）
players = {
    user_1: { position: {x,y,z}, visual: {}, hp: 100 },
}

// SoA 模式（之后）
TransformStore.positions = Float32Array([x1,y1,z1, x2,y2,z2, ...])
VisualStore.flags = Uint8Array([moving_bit | collision_bit, ...])
```

| 版本 | 体积增加 | GC 压力 | 类型安全 | WebGPU 就绪 |
|------|---------|---------|---------|------------|
| v1 Immutable.js | ~50KB | ❌ 高 | ✅ | ❌ |
| v2 自建 HashMap | 0 | ❌ 高 | ⚠️ | ❌ |
| v3 Js.Dict | 0 | ✅ 低 | ⚠️ | ❌ |
| **v4 SoA** | **0** | **✅ 零** | **✅** | **✅** |

SoA 的优势不只在性能，更在**组织代码的方式**——TransformStore 只管变换，VisualStore 只管渲染标记，互不污染。单个 Store 文件小，AI 改代码时不容易误伤不相干逻辑。

---

## BDD 测试体系建立

迭代期间同步建立了 BDD 测试体系。到 2026-06-10 已有 **37 个场景全部通过**：

| 模块 | 场景数 | 测试内容 |
|------|--------|---------|
| frontend: CameraManager | 10 | 第三人称跟随、旋转、缩放、边界限制 |
| frontend: InputManager | 6 | WASD 按键、方向组合、长按 |
| frontend: MultiplayerHelpers | 4 | 状态解析、玩家列表排序 |
| logic: Movement | 5 | 移动速度、碰撞边界、旋转补偿 |
| room-service: Game | 4 | tick 循环、状态广播、玩家加入/退出 |
| match-service: FindRoom | 8 | 房间创建、查找、满员拒绝、超时清理 |

每个场景都是先写 feature 文件（Cucumber Gherkin 语法），再写 step-definitions，最后跑它实实在在地失败一次，才写实现代码。

为什么强调「实实在在地失败一次」？

因为 AI 经常写一个「永远不会 RED」的测试。我遇到过好几次：AI 写了一整版 BDD 测试，跑它全部通过——但我知道对应功能还没实现。检查后发现 AI 的 step-definition 里调用了 mock 函数而不是实际的服务端 API。测试在「测 mock」不是「测代码」，所以永远 GREEN。

修正策略：**测试必须用真实的服务实例。** BDD 测试启动一个本地的 room-service Server 实例，直接通过 TSRPC 客户端连接。不 mock 网络层、不 mock TSRPC、不 mock Game 对象。

到迭代结束时，测试总数已增长到 50+ 场景、6 个测试套件全部通过。后续每修一个 bug、每加一个功能，都先补测试再改代码——这个纪律从 BDD 测试建立后一直坚持到了项目结束。有些 bug 修复后的测试只增加 1 个场景，但只要有这个场景在，类似的问题就永远不会回归。

---

## 总结

两周迭代，从"能跑的原型"到"能玩的联机游戏"：

- **Tick Loop** 写了三版才稳定——闭包引用→ readState→代次守卫
- **碰撞检测** 走了三步——AABB→OBB→凸包，每个阶段只解决当前最痛的问题
- **状态管理** 重构四轮——Immutable.js→自建HashMap→Js.Dict→SoA
- **动画同步** 三轮修复——全部指向同一个根因：两端逻辑不一致
- **MMD 接入** 三轮重构——logic_layer直引Three→IRenderer→MultiplayerRender模块函数
- **BDD 测试** 37→50+ 场景，覆盖核心链路

每一轮都不是"代码不好看"式的重构——是 bug 逼出来的、测试挂死的、体验差的。

下面进入实战最痛苦的环节：**部署到 SCF Serverless，6 个连环坑。** 

**下一篇：[Vibe Coding 多人游戏（十）—— SCF 部署 6 连环坑](https://www.cnblogs.com/chaogex/p/21195307)**
