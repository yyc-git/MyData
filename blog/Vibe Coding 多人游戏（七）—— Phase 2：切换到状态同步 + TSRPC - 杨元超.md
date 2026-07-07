# Vibe Coding 多人游戏（七）—— Phase 2：切换到状态同步 + TSRPC

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

上期说了 basic1 用 Lockstep 帧同步踩的坑——我手写四天，被浮点数精度、回滚代码复杂度、跨平台不一致三个问题折磨到放弃。

但放弃帧同步不等于放弃多人联机。只是换条路走。

**2026 年 6 月 8 日，一整天，从 basic1 到 new_basic2。** 这是这个项目里**第一次让 AI 深度参与多人联机编码**——我从"纯手写"进入了"AI 辅助编程"阶段。

---

## 从 basic1 到 new_basic2

改动看起来不大，但是质变：

```
basic1（Meta3D + 帧同步）→ new_basic2（Three.js + 状态同步 + TSRPC）
```

内核变化就一行：**服务器角色从"命令中继"变成了"状态权威"**。

带来的连锁反应：
- **去掉 Meta3D 引擎** → 引擎包袱剥离，包体积从 20.6MB 降到 7.95MB
- **引入 Three.js** → 标准的 WebGL 渲染管线，文档多、社区大
- **引入 TSRPC** → 全链路 TypeScript 类型安全，不再裸写 WebSocket 协议
- **引入 AI** → 这次 AI 不再只是聊天采纳建议，而是真正参与写代码

---

## 10:30 - 13:10：状态同步 MVP

一上午的产出：

**服务端（demos/room-service/）**
- 基于 TSRPC 的 WebSocket 服务
- 15 FPS authoritative tick 循环
- `executeCommand` 处理移动指令
- `broadcastMsgGameState` 广播全量玩家状态

```typescript
// 服务端 tick 循环 — Game.ts
setInterval(() => {
  state = executeCommand(state)         // 执行所有玩家命令
  state = computeCollisionDamage(state) // 碰撞检测
  broadcastMsgGameState(state)          // 广播全量状态
}, 1000 / 15)                           // 15 FPS
```

**客户端（demos/new_basic2/）**
- Three.js 渲染场景（天空 + 网格地面 + 两个方块表示玩家）
- TSRPC `WsClient` 连接服务端
- `onGameState` 接收状态 → 更新方块位置
- 两个玩家在屏幕上移动成功，碰撞变红 ✅

这里有个关键细节：**我没有用 AI 直接生成 new_basic2 的全部代码**，而是在 basic1 的基础上，让 AI 辅助修改——告诉 AI "把帧同步改成状态同步""引入 TSRPC""替换引擎"。AI 不是从零开始的建筑师，而是高效的改造工。

---

## 15:10 - 16:20：小人模型 + 动画

MVP 跑通后，接下来的改造重点是视觉。

**Step 1：FBX 模型替换方块**
- 模型选用经典的小人模型 `Infantry.fbx`
- 每个玩家独立加载 FBX 实例（不 clone，避免 SkinnedMesh 骨骼共享问题）
- 缩放 4 倍便于观察

**Step 2：Idle / Running 动画**
- `Idle.fbx`（54 track，2 秒循环）
- `Running.fbx`（54 track，0.83 秒循环）
- 用 Three.js `AnimationMixer` 管理每个玩家的动画状态机

**😤 坑：FBX 动画 Clip 名冲突**

所有从 Mixamo 导出的 FBX 动画，clip 名字都叫 `'mixamo.com'`。`mixer.clipAction('mixamo.com')` 永远返回同一个 action 实例——意味着一改 idle，running 也跟着变。

解法：创建 clip 时用 `clip.clone()` 重命名为唯一名（`username_idle` / `username_run`）。

**😤 坑：按钮只触发一次指令**

方向按钮按一次，`sendMoveState` 只发一条命令，服务端执行一次就停了。表现为点一下走一步。

解法：长按时用 `setInterval` 持续发命令，松开时 `clearInterval`。

这两个坑都是典型的前后端分离认知偏差——单机游戏是事件驱动的“点击→响应”，网络游戏需要持续的状态流。

---

## 16:26 - 16:50：WASD 控制 + 摄像头 + 客户端预测

**CameraController.ts**
- 第三人称跟随，鼠标左键拖拽旋转，滚轮缩放
- 初始半径 360 单位，far plane 1000
- 自动跟随本地玩家位置（`camera.position.lerp(target, 0.05)`）

**WASD 键盘控制**
- `keydown` / `keyup` 监听
- 按住时 200ms 向服务端发一次移动指令

**客户端预测——试了三个版本**

状态同步最大的用户体验问题是延迟：你的输入到服务端，服务端踢回来，一个来回至少 50-100ms。本地角色不立刻响应的话，手感会像在沼泽里走路。

- **尝试 1（时间锚点预测）**：`pos = anchor + dir * speed * (now - anchorTime)` → 各窗口漂移不一致
- **尝试 2（每帧 deltaTime + 3% 修正）**：60FPS 本地移动 + 每帧 3% 拉向服务端位置 → 有拉扯感，速度变慢
- **最终方案（deltaTime 预测 + 服务端覆盖）**：本地即时响应按键移动，服务端 GameState 回来时直接覆盖所有玩家的位置。效果平滑 ✅

```typescript
// 客户端：本地即时移动（60FPS）
Scene.tsx:
  mesh.position.x += dirX * speed * deltaTime
  mesh.position.z += dirZ * speed * deltaTime

// 客户端：收到服务端 GameState 直接覆盖
onGameState(msg):
  msg.players.forEach(p => {
    let mesh = playerMeshes.get(p.username)
    mesh.position.set(p.x, p.y, p.z)
  })
```

核心思路：**自己按 60FPS 跑着爽，服务端按 15FPS 纠正。** 用户每秒看到 60 帧的本地响应 + 15 次服务端纠正，体感完全平滑。

---

## 17:00 - 17:45：MMD 巨大娘 + 碰撞系统

**第一版角色区分**
- 房主（Creator）→ 巨大娘模型（PMX 格式）
- 成员（Member）→ 小人模型（FBX 格式）

**PMX 模型加载**用了 Three.js 的 `MMDLoader`，配合 `CCDIKSolver` 处理脚部 IK：
- idle 动画：`idle.vmd`（1.4MB，54 bone tracks）
- walk 动画：`walk.vmd`
- MMDPhysics 关闭，IK 由 Loader 自动处理

**碰撞系统（服务端实现）**

终于吸取了 basic1 的教训——碰撞检测放**服务端**：

```typescript
// 服务端 Game.ts：检查两玩家 XZ 距离
function _isCollision(p1, p2) {
  let dx = p1.x - p2.x
  let dz = p1.z - p2.z
  return Math.sqrt(dx * dx + dz * dz) < 1.0
}
```

服务端算出碰撞状态后，通过 `MsgGameState` 的 `isCollision` 字段广播到客户端。客户端只负责渲染碰撞盒颜色（绿色正常 / 红色碰撞）。

碰撞盒尺寸按角色类型不同：
- 巨大娘：4×8×3（宽×高×深）
- 小人：0.8×1.8×0.5

用 `EdgesGeometry` + `LineSegments` 替代 `BoxHelper`，实现自定义尺寸。

---

## 17:50 - 18:00：AI 巨大娘（第一版）

这可能是最有趣的功能——用一个 MMD 巨大娘在地图上自动追玩家：

```typescript
// 服务端：每 tick 向目标玩家移动
function _updateAI(enemyState, players) {
  if (players.length === 0) return
  let target = players[0]
  // 计算朝向，speed=0.8 向目标移动
  let dx = target.x - enemyState.x
  let dz = target.z - enemyState.z
  enemyState.x += normalize(dx, dz) * 0.8
  enemyState.z += normalize(dz, dx) * 0.8
}
```

出生位置 (0, 0, -30)，向第一个玩家方向缓慢移动。客户端收到 `enemies` 数据后更新 MMD 模型的动画状态切换（idle ↔ walk）。

这个功能虽然简单，但意义很大——**证明了服务端可以同时处理玩家 + AI 的状态同步**，为后来大型 AI 系统打下基础。

---

## 当天总结：从手写做人到 AI 辅助

6 月 8 日的产出：

| 时段 | 内容 | 参与方式 |
|------|------|---------|
| 上午（~3h） | 状态同步 MVP（TSRPC + Three.js） | AI 辅助改造 basic1 |
| 下午前半（~1h） | FBX 模型 + 动画系统 | AI 辅助 + 我修复 AI 坑 |
| 下午中段（~1h） | Camera + WASD + 预测方案迭代 | 我主导方向 + AI 实现 |
| 下午后段（~1h） | MMD 巨大娘 + 碰撞系统 | AI 辅助 |
| 傍晚（~10min） | AI 巨大娘 | AI 生成 |

这是**第一次真正尝到 AI 辅助编程的甜头**。basic1 我一个人写了四天，new_basic2 的核心功能在一天内完成。

但代价也很明显——**AI 生成的代码留下了大量的隐性技术债**：服务端代码更新后必须手动重启（我 debug 半小时才发现）、TSRPC 的 `serviceProto.ts` 不会自动同步协议修改、FBX 动画同名 clip 的坑……这些坑在 basic1 里不会出现（我自己写的，每行都清楚），但在 AI 辅助模式下面，它们会静悄悄地累积。

从 new_basic2 到 Lerna Monorepo 四包结构，中间只隔了一天。下期讲 **P8：大重构**——Monorepo + 双服务 + Logic 共享层 + 开闭原则，一天内全部落地。

**下一篇：[Vibe Coding 多人游戏（八）—— 大重构：Monorepo + 双服务 + Logic 共享层 + 开闭原则](https://www.cnblogs.com/chaogex/p/21195307)**
