# Vibe Coding 多人游戏（七）—— Phase 2：切换到状态同步 + TSRPC

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

上期说了 basic1 用 Lockstep 帧同步踩的坑——我手写两周，被浮点数精度和调试困难折磨到放弃。

但放弃帧同步不等于放弃多人联机。只是换条路走。

**故事从这里开始进入 AI 阶段。** 我犯的第二个错误（或者说是正确的决策）是：没有从零开始写状态同步，而是**让 AI 参考 basic1 的代码，直接改出一个状态同步版本**——我管它叫 new_basic1。这是这个项目里第一次让 AI 深度参与多人联机编码。

然后，**2026 年 6 月 8 日**，我站在 new_basic1 的基础上，花了一整天时间把它迭代为 new_basic2——加入了模型、动画、摄像机、碰撞系统。

---

## 从 basic1 到 new_basic1：AI 改造

改动看起来不大，但是质变：

```
basic1（Meta3D + 帧同步）

  ↓ AI 改造：把服务端从"命令中继"改成"状态权威"
  ↓ 替换引擎：Meta3D → Three.js
  ↓ 保留通信层：TSRPC

new_basic1（Three.js + 状态同步 + TSRPC）
```

内核变化就一行指令：**服务器角色从"命令中继"变成了"状态权威"**。

我没让 AI 从零写——它太贵也太慢。我直接把 basic1 的代码丢给 AI，告诉它：
- "删除帧同步的回滚逻辑"
- "服务端加一个 tick 循环，每帧执行命令、广播状态"
- "客户端不执行逻辑，只展示服务端发来的位置"

结果令人惊讶：半天不到，状态同步就跑通了。AI 对 existing codebase 的理解比预期好得多。

带来的连锁反应：
- **去掉 Meta3D 引擎** → 包体积从 20.6MB 降到 7.95MB
- **引入 Three.js** → 标准的 WebGL 渲染管线，文档多、社区大
- **服务端代码量翻倍**（要跑游戏循环 + 碰撞检测），但客户端代码量骤降

---

## 10:30 - 13:10：new_basic2 MVP

一上午，在 new_basic1 的基础上继续迭代，我把产物目录改叫 new_basic2：

**服务端（demos/room-service/）**
- TSRPC WebSocket 服务
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

两个玩家在屏幕上移动成功，碰撞变红 ✅

---

## 15:10 - 16:20：小人模型 + 动画

**Step 1：FBX 模型替换方块**
- 经典小人模型 `Infantry.fbx`
- 每个玩家独立加载 FBX 实例（不 clone，避免 SkinnedMesh 骨骼共享问题）

**Step 2：Idle / Running 动画**
- `Idle.fbx`（54 track，2 秒循环），`Running.fbx`（54 track，0.83 秒循环）
- Three.js `AnimationMixer` 管理每个玩家的动画状态机

**😤 坑：FBX 动画 Clip 名冲突**

所有从 Mixamo 导出的 FBX，clip 名都叫 `'mixamo.com'`。`mixer.clipAction('mixamo.com')` 永远返回同一个 action——改 idle 时 running 也跟着变。

解法：`clip.clone()` 重命名为唯一名。

**😤 坑：按钮只触发一次指令**

方向按钮按一次，`sendMoveState` 只发一条命令。表现为点一下走一步。

解法：长按时 `setInterval` 持续发，松开时 `clearInterval`。

---

## 16:26 - 16:50：WASD + 摄像头 + 客户端预测

**CameraController.ts**
- 第三人称跟随，鼠标左键拖拽旋转，滚轮缩放
- 自动跟随本地玩家位置（`camera.position.lerp(target, 0.05)`）

**客户端预测——试了三个版本**

状态同步的痛点：你的输入→服务端→回来，至少 50-100ms。不立刻响应的话手感像在沼泽里走路。

- **尝试 1（时间锚点）**：`pos = anchor + speed * (now - anchorTime)` → 各窗口漂移
- **尝试 2（deltaTime + 3% 修正）**：60FPS 移动 + 每帧拉向服务端 → 拉扯感
- **最终方案（deltaTime 预测 + 服务端覆盖）**：本地即时响应，服务端 GameState 直接覆盖全部 ✅

```typescript
// 本地：60FPS 即时移动
mesh.position.x += dirX * speed * deltaTime

// 收到服务端 GameState → 直接覆盖
onGameState(msg):
  msg.players.forEach(p => {
    playerMeshes.get(p.username).position.set(p.x, p.y, p.z)
  })
```

核心思路：**自己按 60FPS 跑着爽，服务端按 15FPS 纠正。** 每秒 60 帧本地响应 + 15 次服务端纠正，体感完全平滑。

---

## 17:00 - 17:45：MMD 巨大娘 + 碰撞系统

**第一版角色区分**
- 房主（Creator）→ 巨大娘模型（PMX）
- 成员（Member）→ 小人模型（FBX）

PMX 用 Three.js 的 `MMDLoader` + `CCDIKSolver`（脚部 IK），idle/walk 各一套 VMD 动画。

**碰撞系统（终于放服务端了）**

```typescript
// 服务端：检测两玩家 XZ 距离
function _isCollision(p1, p2) {
  let dx = p1.x - p2.x, dz = p1.z - p2.z
  return Math.sqrt(dx*dx + dz*dz) < 1.0
}
```

- 碰撞盒尺寸：巨大娘 4×8×3，小人 0.8×1.8×0.5
- 服务端算结果 → `MsgGameState` 广播 → 客户端渲染绿/红

---

## 17:50 - 18:00：AI 巨大娘

让一个 MMD 巨大娘在地图上追玩家：

```typescript
function _updateAI(enemy, players) {
  let target = players[0]
  let dx = target.x - enemy.x, dz = target.z - enemy.z
  enemy.x += normalize(dx, dz) * 0.8
  enemy.z += normalize(dz, dx) * 0.8
}
```

10 分钟写完。证明了服务端可以同时处理玩家 + AI 的状态同步。

---

## 当天总结：第一次 AI 辅助编码

| 时段 | 内容 | 方式 |
|------|------|------|
| 上午（~3h） | new_basic2 MVP | AI 改造 new_basic1 |
| 下午前半（~1h） | FBX 模型 + 动画 | AI 辅助 + 我修坑 |
| 下午中段（~1h） | Camera + WASD + 预测 | 我定方向 + AI 实现 |
| 下午后段（~1h） | MMD 巨大娘 + 碰撞 | AI 辅助 |
| 傍晚（~10min） | AI 巨大娘 | AI 生成 |

basic1 我一个人手写了两周。从 new_basic1（AI 状态同步改造）到 new_basic2（完整可玩的 Demo），**核心功能不到两天完成**。

这就是 Vibe Coding 的威力——不是让 AI 从零写，而是**让 AI 站在已有代码的肩膀上改**。

代价也很明显：**AI 留下了大量隐性技术债**——服务端更新后必须手动重启（debug 半小时才发现）、TSRPC 的 `serviceProto.ts` 不会自动同步、FBX 同名 clip 需要人工查文档才发现……basic1 里这些问题不会出现（我自己写的，每行都清楚），但在 AI 辅助模式下面，它们会静悄悄地累积。

两天后，我们就面临了下一个决断——代码结构已经撑不住了。

**下一篇：[Vibe Coding 多人游戏（八）—— 大重构：Monorepo + 双服务 + Logic 共享层 + 开闭原则](https://www.cnblogs.com/chaogex/p/21195307)**
