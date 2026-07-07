# Vibe Coding 多人游戏（十八）—— 重构标准 🐛🔴🟡🟢 逐条拆解

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

AI 重构代码很勤快，但有时候也让人头疼——它可能把一个函数从 10 行改成 5 行的同时，顺手改了 3 个不相关的文件。我就遇到过 AI 修一个 `isEnterGame` 标志位 bug，结果把 `handlePlayerMove` 的签名也改了，还加了个 `lodash.cloneDeep` 依赖。

GTS-Play 建立了一套 **🐛🔴🟡🟢 审查清单**，每次重构后自动检查。这套清单不是拍脑袋想出来的，而是从项目开发的 40 多个 bug 修复记录里提取的——每一条都对应某个真实踩坑。

---

## 审查标准

| 等级 | 含义 | 处理方式 |
|------|------|---------|
| 🐛 Bug | 影响功能的错误 | 必须修，不改不能提交 |
| 🔴 严重 | 违反红线/架构 | 必须修，但可讨论方案 |
| 🟡 警告 | 代码质量问题 | 修更好，可暂缓 |
| 🟢 建议 | 可优化但非必须 | 记在 TODO，择机处理 |

一开始只有 🐛 和 🟢 两级，但用起来发现不够：有些代码质量问题影响面很大——比如 `any` 类型的使用、`window` 全局挂载——它们不是 bug，但不修后面会爆。所以加了 🔴 级别。🟡 则是后面加上的——因为 AI 的一些抽象过度问题虽不是即时危险，但会逐渐拖慢项目。

---

## 最高频 Bug：End 逻辑重置

这是 GTS-Play 里最频繁的 bug 类型，没有之一。**游戏结束时某标志位未重置。**

### 具体症状

**第一次出现（2026-06-11）：** 玩家退房后重新匹配，显示"查找房间中..."，然后一直转圈。查了 E2E 日志，看到 `onEnterGame` 没有被调用。检查 `disconnect()` 函数，发现它重置了 `isConnected`，但没重置 `isEnterGame`——第二局进入时 `isEnterGame` 还是 `true`，服务端认为"已经在游戏中"，拒绝了新的进入请求。

**第二次出现（2026-06-18）：** 修完 `isEnterGame` 后，场景重入又出了问题。玩家退出房间，重新匹配进入游戏，发现：血条不见了、OBB（碰撞检测线框）残留着一套旧的。排查了一下午，发现 `disconnect()` 重置了 `isConnected`/`isEnterGame`/`gameOverShown`，但没重置：
- `mp.hud` — 含有第一局已 `deepDispose` 的 Sprite 引用
- `mp.players` — 含有旧玩家数据  
- `mp.manageScene` — 含有旧渲染句柄

**第三次出现（2026-06-29）：** `computeCollisionDamage` 检查 `animationName === "running"` 决定是否触发伤害。`handlePlayerNotMove` 无条件设置 `animationName = "idle"`，顺带重置了 `walkAnimTime = 0`。结果跑步的碰撞减血永远不触发，因为 `walkAnimTime` 被清空了。

### 根因分析

多人游戏涉及多个模块（Room、Game、Server、Manager），每个模块都有自己的状态。`dispose` 时只清了主模块，忘了关联模块。更具体地说，问题往往出在"**层次**"上：

```
Room.dispose()
├── Game.dispose()        ← 这部分重置了
├── Server.handleDisconnect()  ← 这部分也重置了
└── State 的某些字段     ← 这部分忘了
```

AI 修了 A 位置的 flag，漏了 B 位置——因为它在不同的层级文件里各有一次改 flag 的路径。

### 解决方案

**第一层防御：维护一份"退出时需重置的 flag 清单"。** 这份清单在 `workflow-rules.md` 的 🐛 检查项中：

> **End 逻辑重置检查**：在结束/销毁/dispose/stop 等 End 逻辑中，检查是否已经重置干净了。gameStop 未重置 gameStartStartedRef、onGameStarted 未重置 gameOverTriggeredRef 等跨轮状态残留，是高频 bug 源。**每个 end/stop/destroy/dispose 函数都必须遍历清理所有关联的 ref/flag/state。**

**第二层防御：BDD 测试覆盖 End→Start 路径。** 我们增加了一个"退房后重新进入"的 BDD 场景，确保端到端的流程能走通。

**第三层防御：代码审核中专门检查 End 逻辑。** 每次代码审核的 🐛 项里，"End 逻辑重置检查"是第一条。

用了这三层防御后，类似的 bug 频率从每周 3-4 次降到了差不多一个月一次。

---

## 其他高频 🐛 项

### 竞态条件

多人游戏中最隐蔽的 bug。典型场景：玩家同时发送"移动"和"攻击"命令，服务端先处理了"攻击"再处理了"移动"——结果角色在攻击动画中水平位移了。

**解决**：所有命令按帧号打包发送，服务端按帧号顺序执行。不要依赖消息到达顺序。

### 类型安全

AI 特别喜欢用 `as any`。我见过 AI 写 `const timer: any = setInterval(...)`。在代码审核里，这被标记为 🔴 级别——必须修。

有次审核发现 `Server.ts` 里有 3 个 `any` 类型：
1. `(timer: any)` → 改为 `ReturnType<typeof setInterval>`
2. `null as any` → 改为正确类型
3. `(client as any).close()` → 保留并加注释（因为 tsrpc-browser 的 WsClient 类型不暴露 `close()`，但底层有）

第三项很典型——不是所有 `any` 都是代码质量差，有的确实是类型系统不够。所以规则里写的是"减少 `any`"，不是"消灭 `any`"。

### 内存泄漏：Three.js 对象未 dispose

AI 用 `new THREE.Sprite()` 创建血条 Sprite，场景切换时没 dispose。第二局重入时，血条不显示——因为 `updateHPBar` 判断 `if (existing && existing.material && existing.material.map)`，旧 sprite 的 material 虽 dispose 但对象仍存在（非 null），走了"更新旧 sprite"路径，不创建新 sprite。旧 sprite 不在新场景中，所以看不见。

**解决**：项目自定义 Three.js class，禁止直接 `new THREE.Sprite`，统一用工厂函数管理生命周期。

---

## 审查流程

重构后自动过三轮：

**1. 编译检查（自动）**
- `tsc` 无错误
- `rescript build` 无错误
- webpack 构建通过

**2. 测试检查（自动）**
- BDD 集成测试全过
- 新增测试覆盖重构路径
- 检查有无"假测试"——mock-only、无断言的空测试

**3. 人工重点检查**
- 改了不该改的文件？（越界重构）
- 新增了不必要的依赖？
- 重构是否可逆？（要不要退回去）

第三轮是我最在意的一轮。有一次 AI 重构了 `Server.ts` 的 `_handlePlayerDisconnect` 函数，顺手把主机转移的逻辑也改了——加了一个广播副作用混入纯函数。代码审核里发现了，标记为 🔴：广播逻辑从纯数据转换中分离出来，由调用方负责。

---

## 一条最重要的规则

> **重构和修 bug 分开。改代码时不修不相关的 bug，修 bug 时不顺手重构。**

AI 容易把两者混在一起——重构时发现一个 bug 顺手修了，结果 bug 复现时不知道是重构引入的还是原来就有。这条规则写在 `workflow-rules.md` 的顶部，每次代码审核时都会检查。

有一次 AI 修一个 "OBB 残留" 的 bug，发现 `clearAllOBBDebugBoxes` 函数在 MultiplayerLoop 里定义了但没在重入时调用——它在修 bug 的同时，顺手把函数的参数签名从无参改成了带参。修完 bug 后，另一个调用的地方忘了更新签名，直接挂了。那个下午我花了两个小时定位"为什么突然编译不过"。

所以我现在严格执行：**修 bug 的 PR 里一行重构代码都没有，重构的 PR 里一个 bug 也不修。**

---

下期讲 **P19：Specs、变更管理与方案体系**——怎么让 AI 在"做之前"先规划清楚。

**下一篇：[Vibe Coding 多人游戏（十九）—— Specs、变更管理与方案体系](https://www.cnblogs.com/chaogex/p/21195307)**
