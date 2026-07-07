# Vibe Coding 多人游戏（十四）—— E2E 自测与根因修复

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

OpenCode 写代码很快——5 分钟生成 200 行代码，编译通过，看起来完美。

但 **修 bug** 是另一个故事。

在 OpenCode 引入初期，我观察到了一个令人沮丧的现象：OpenCode 写代码 5 分钟，修 bug 可能 5 个小时——特别是多人同步类的 bug，涉及前后端状态不一致，OpenCode 经常越修越错。有时候修好了 A 问题，引入了 B 问题，再修 B 又带回了 A 问题。

为什么会这样？

---

## 传统 Debug 流程的致命缺陷

OpenCode 发现 bug 后，典型的修复流程：

```
OpenCode：编译报错，让我看看
→ 看报错信息 → 觉得是问题 A → 改代码
→ 跑测试 → 还是报错
→ 觉得是问题 B → 改代码
→ 跑测试 → 又出新错
→ 无限循环...
```

这个模式的问题在哪？**OpenCode 修 bug 不看运行时日志。**

我坦白说，我第一次意识到这个问题是在 6 月 20 日。那天 OpenCode 修一个穿梭 bug 来回折腾了 7 轮，每轮我都在看它的分析——全是"我觉得是 X 问题"。没有任何一轮它去读服务端日志或者客户端控制台日志。

**纯靠"读代码"来修 bug，就像蒙眼修车。** 你能摸到引擎盖，能想象里面是什么结构，但你不点火听听声音，永远不知道是气缸漏气还是火花塞坏了。

2026 年 6 月 20 日，我建立了一个专门调试工具：WebGL E2E 调试体系。

在一开始，我尝试过直接用 **Spector.js**——Google 的 WebGL 调试器，Chrome 扩展，能录制每一帧的所有 WebGL 调用。Spector.js 界面漂亮、功能强大，录制后能可视化查看 draw call 列表、shader 源码、uniform 值。但问题来了：

1. **它是手动工具**——需要人打开 DevTools、点录制、互动、再停止。没法嵌入自动化流程。
2. **录制数据量太大**——一帧 2600+ 个 draw calls，人类根本看不过来。而 OpenCode 要看需要我手动导出 JSON，再手动喂给 OpenCode，不是按需的。
3. **扩展模式局限**——Chrome Extensions 的权限模型和 Playwright 自动化不兼容。

所以我把 Spector.js 定位为"初步调查工具"——先用 Spector.js 手动确认问题出在渲染层，然后自己写了一套可被 OpenCode 调用的 WebGL 调试层，嵌入到游戏运行时代码中。

最终的四层调试体系：

| 层 | 能力 | 实现方式 | 替代对象 |
|----|------|---------|---------|
| L1 | 每帧 drawCalls/triangles/textures/programs | `renderer.info` → `window.__GL_STATS__` | Spector.js 概览面板 |
| L2 | GLSL 编译错误自动捕获 | `compileShader` 包装 → `window.__SHADER_ERRORS__` | DevTools Console |
| L3 | DC 按 Mesh/Line/Sprite/SkinnedMesh 分桶 | scene.traverseVisible 分析 | 自定义 |
| L4 | 逐条 GL 命令 + shader 源码 | 包装 drawArrays/drawElements/useProgram | Spector.js 详细录制 |

最狠的是 L4——安装 GLTracer 后 2 秒能捕获 2662 个 draw calls，8 个 programs，逐条显示 mode/count/programId。这个数据量对人类来说太多了，但对 OpenCode 正好——它在日志里能找到"这个 shader 应用了 200 次但只绘制了 1 个三角形"这种问题，从代码上看不出来的。Spector.js 也能录这个级别的数据，但它的 JSON 导出格式要清洗才能喂给 OpenCode，而 GLTracer 输出就是纯文本日志，OpenCode 直接 grep 就能分析。

---

## E2E 自测设计

解决方案是**让 OpenCode 能在真实环境中观测效果**。

```
1. 启动 room-service 和 match-service
2. 启动 Playwright Chromium 打开两个浏览器窗口
3. 窗口 A 创建房间 → 窗口 B 加入
4. 窗口 A 移动 → 检查窗口 B 是否同步
5. 关掉窗口 A → 检查窗口 B 是否收到退房通知
6. 检查服务端日志有无异常
```

这些步骤由 OpenClaw 的 `gts-e2e-test` / `gts-e2e-auto` Skill 自动执行，但手动跑一遍踩了不少坑。

用两个浏览器窗口模拟两个玩家的行为，检查状态是否同步。如果 bug 真实存在，E2E 测试会失败，错误信息会暴露根因。

**但 E2E 自测最大的坑，是在"启动"这一步。**

2026 年 6 月 24 日我踩了一个下午的坑，就是因为 `Start-Process` 的模式选择不对：

1. ❌ `yarn dev` 前台启动 → timeout 自动杀进程，服务还没跑起来就被宰了
2. ❌ `Start-Process -NoNewWindow` → 共享控制台，子进程 crash 连带杀死 OpenCode 进程，全军覆没
3. ✅ `Start-Process -WindowStyle Hidden` + 端口轮询 → 完全隔离，互不影响

端口检测也踩了坑：

1. ❌ `netstat -ano | Select-String ":4003 "` → 匹配 ESTABLISHED 也匹配，误杀了 Chrome 和 OpenCode
2. ✅ `netstat -ano | Select-String ":4003 .*LISTENING"` → 只匹配服务端监听端口

最终的 `Wait-Port` 函数用 `node net.connect` 探活（<10ms/次，比 netstat 快 10 倍），200ms 间隔轮询。

---

## 三天一个最难同步 Bug

GTS-Play 开发中最难的一个 bug：**玩家 A 在窗口 A 移动，窗口 B 中看到的是瞬移而非平滑移动。**

这个 bug 从 6 月 11 日开始排查，到 6 月 14 日才修好，OpenCode 花了 3 天定位。整个过程非常典型，值得拆解：

**Day 1：怀疑插值缓冲区**
症状：窗口 B 的玩家 A 不是一步一步移动的，而是每隔几帧跳一下。

OpenCode 的第一反应："肯定是插值缓冲区长度不对，或者插值算法有问题。"

改了三轮插值逻辑：调整插值缓冲区大小（从 5 帧改为 10 帧）、换插值算法（从线性插值改成球面线性插值用于旋转）、补了缺失的边界情况——都没解决。窗口 B 还是在瞬移。

**Day 1 晚：怀疑服务端 tick 频率**
OpenCode 觉得是服务端广播频率太低，导致客户端插值的"原材料"不够多。

把广播频率从 10fps 调到 30fps，再调到 60fps。60fps 时稍微好点了——跳动的距离变短了——但本质问题还在：位置不是连续的，是跳跃的。

**Day 2：怀疑 WS 消息乱序**
OpenCode 认为可能是 WebSocket 消息到达顺序不对，客户端用了旧的位置覆盖新的。

加序列号检测：每个 GameState 消息带 `seqId`，客户端收到后按 `seqId` 排序。折腾了几个小时，打印日志一看——没有乱序，消息都是按顺序到达的。排除。

**Day 2 晚：终于开始看数据**
OpenCode 打印了每 tick 的状态比对。把服务端下发的 `position` 和客户端收到的 `position` 对比——发现不一样。

```
服务端下发: position = { x: 10.530, z: -3.142 }
客户端收到: position = { x: 10.530, z: -3.142 }
                (相等)
服务端下发: position = { x: 10.531, z: -3.143 }
客户端收到: position = { x: 10.530, z: -3.142 }
                (不相等，少更新了一次)
```

差值只有 0.001 个单位，但每次少更新一次，累积下来就变成跳跃。

**Day 3：根因**
深入后发现，`prepareBroadcastPlayers` 里剥离 OBB 数据时，做了一层深拷贝。但深拷贝函数没处理 Position 字段的浮点数精度——深拷贝出的位置和原位置有细微差异，导致服务端下发的位置被"污染"了。

**最终修复：一行代码。**
在深拷贝函数里加上 `Position: { ...obj.Position }`，再做一次浅拷贝保证字段引用不共享。

但找到这一行花了 3 天。如果当初有 E2E 自测能够自动比对"服务端下发的数据"和"客户端收到的数据"，这个 bug 一小时就能找到。

---

## 根因修复流程

E2E 自测发现问题后，修复流程应该是：

```
1. 复现 bug（E2E 测试天然做这件事）
2. 定位根因（看**专门注入的日志** → 缩小范围 → 看代码）
3. 写测试锁定 bug（红 → 绿 → 锁定）
4. 修复代码
5. 跑所有测试（确保没 regression）
6. 部署
```

其中第二步最关键——**OpenCode 必须学会先看日志再改代码。**

OpenCode 的 `gts-dev-fix` Skill 被设计为分两步走：

```
1. 读 bug 描述
2. 搜相关代码（搜类名、变量名、文件名）
3. 看最近的运行日志（调度 gts-logs）——这些日志是我们**特意为根因分析设计的**：每个关键节点都有独立的 log 语句（比如 "ApiFinished guard check: players.size=5, Object.keys=5"），这样当 bug 触发时，日志直接告诉你守卫条件被哪个错误判断卡住了，不用对着代码猜。
4. 提出根因分析 → 由 OpenClaw 转达给兄弟，等确认
5. 确认后，OpenClaw 调度 OpenCode 修代码
6. 跑测试 → 循环直到通过
```

第 3 步和第 4 步是核心差异。传统的 OpenCode 修 bug 直接跳到第 5 步"开始修代码"，结果就是反复试错。而这套流程的核心支撑就是日志是**专门为根因分析设计的**——不是 random console.log，而是每个关键决策点都有格式化的、grep 友好的日志输出，一眼就能看出"守卫条件竟然永远返回 true"这种从代码上根本看不出来的问题。

**7 月 3 日的一个真实案例完美展示了这个流程的价值。**

`listenGameState` 函数里有一段条件：`if (mp.multiplayerMode === MULTIPLAYER_SINGLE || !mp.isHost)`。意思是"单机模式或者非主机玩家才执行"。但主机玩家（`isHost=true`）也收不到 GameState 了——因为条件判断排除了主机。

被 E2E 测试发现后，OpenCode 走了完整流程：
1. E2E 测试失败：host 角色的 mp.players 始终为空
2. 看日志：发现了条件判断
3. 提出根因：条件判断错误，host 被排除
4. 修复：去掉条件，改为「服务端权威：所有客户端都推 snapshot」
5. BDD 新增场景验证：isHost=true 时 snapshotBuffer 长度增加
6. 5/5 测试通过

这个修复本身很简单，但关键是 E2E 测试暴露了问题。如果没有 E2E 自测，这个 bug 可能在生产环境运行一周都没人发现——因为单机模式下一切正常，只有多人联机时 host 才会遇到问题。

---

## BDD 测试的进化（SCF 服务端集成测试）

这里的 BDD 测试是**针对 SCF 云函数的集成测试**——测试线上部署的服务端代码是否正常。不是本地的单元测试，而是真·部署后的 API 可达性验证。BDD 测试从最初 3 个场景一路增长到 7 个。每个场景对应一个真实踩过的坑：

| # | 场景 | 对应踩坑 |
|---|------|---------|
| 1 | SCF API 可达性和认证 | 部署后 API 不可达 |
| 2 | match1 函数状态（Active + Available） | 部署成功但未激活 |
| 3 | match1 HTTP 响应（200 + 无崩溃错误） | 返回 500 但日志不可见 |
| 4 | room1 函数状态 + WebSocket 支持 | WebSocket 部署后不工作 |
| 5 | room2 函数状态 + WebSocket 支持 | 同 4 |
| 6 | room1 WebSocket 连接 + 无 ESM 模块错误 | ERR_REQUIRE_ESM |
| 7 | room2 WebSocket 连接 + 无 ESM 模块错误 | 同 6 |

场景 6 和 7 来自一个毕生难忘的踩坑：`@rescript/runtime/package.json` 带有 `"type": "module"`，Node.js 把整个运行时包当作 ESM 加载，而我们的代码是 CommonJS `require()`，直接报 `ERR_REQUIRE_ESM`。**不跑 BDD 集成测试永远发现不了这个问题。** 单元测试里的 mock 不会真的去 `require` 这个包。

---

## 测试金字塔

最终测试体系分成三层——注意单元测试和集成测试都采用 BDD（行为驱动开发）格式编写，只是测试范围和工具不同：

```
     /\
    /E2E\          ← 双窗口模拟，手动/自动触发
   /集成 \
  /测试   \        ← Jest + Cucumber，覆盖后端 SCF + 前端业务逻辑
 /______\
/ 单元测试\       ← Jest + Cucumber（.feature），覆盖纯函数/逻辑层
/________\
```

| 层 | 工具 | 范围 | 执行者 | 覆盖率 |
|----|------|------|--------|--------|
| 单元测试 | Jest + Cucumber（.feature） | 纯函数、逻辑层（Movement / EntityStore） | AI 自动 | 核心逻辑 90%+ |
| 集成测试 | Jest + Cucumber（BDD .feature） | **后端** SCF API + WebSocket 可达性；**前端** MultiplayerManager + ManageScene 业务流 | AI 自动 | 服务端 7+ / 前端 3+ |
| E2E 测试 | Playwright | 完整用户交互：创建房间→加入→移动→退房 | 手动/自动触发 | 关键路径 |

三个要点：

1. **单元测试和集成测试用的是同一套工具、同一套语法**——都是 Jest + Cucumber 的 `.feature` 文件，用 Gherkin 的 Given/When/Then 描述行为。区别只是覆盖的路径不同：单元测试聚焦纯函数和逻辑层，集成测试覆盖得更全面（包括 SCF 部署可达性、前端业务流等）。执行者都是 AI，跑完就是一份报告。

2. **集成测试两端都有**——后端测试 SCF 部署可达性（这里的 7 个场景），前端测试业务逻辑流程（如 `MultiplayerManager` 的退房流程、`ManageScene` 的组件生命周期）。最初只写了后端集成测试，后来发现前端的一些状态 bug（比如弹窗未关闭就切换页面）也得靠集成测试捕获。

3. **TDD 纪律：必须先让测试因 bug 真实失败，再修复。** 不准用 mock 函数绕过疑似失败路径。mock 过的测试永远测不到真实路径——那个 `Object.keys(Immutable.Map())` 的 bug 如果用 mock 模拟一个普通对象，测试会通过，但生产环境还是崩。

---

## 验收自动化

`gts-acceptance` Skill 实现了验收的全自动化：

```
循环：改 → 测 → 验 → 通过 → 部署
```

每次循环：
1. OpenCode 修改代码
2. 编译检查（tsc 0 errors）
3. 运行集成测试（BDD 7 场景）
4. 如果失败 → 查看日志 → 定位 → 继续改
5. 全部通过 → 自动部署（deploy-scf.js）
6. 部署后自动验证（再次跑 BDD 测试）

**但要注意：** 验收自动化不是 CI 那样无脑跑。这个循环不会因为某次失败而卡死——每次失败都是看一眼 log 就能定位的问题，而且 OpenCode 自己也能处理大多数。真正让循环卡住的只有一种情况：**编译通过了、测试通过了、但 bug 还在**——这通常意味着测试没写好。

所以我们有个硬性规则：**每次新增 bug 修复，必须先补一份集成测试，让测试因 bug 真实失败一次，再修。** 这叫"先让子弹飞，再挡子弹"。

---

## E2E 自测尚未解决的问题

当然，E2E 自测也不是万能药。我现在还有几个没完全解决的问题：

1. **WebSocket 连接时序问题**：自动化 E2E 场景中，浏览器窗口打开后到 WebSocket 建立有延迟，OpenCode 在 WS 就绪前就开始发送命令，导致大量 `WS_NOT_OPEN` 错误。手动玩是正常的，但自动化就不行。

2. **悬浮层跨页面持久化**：停止按钮的悬浮层在 React SPA 导航后会丢失。OpenClaw 的修复是把停止状态存 `localStorage`，然后 `while` 循环中自动检测重建 `ensureOverlay`。但自动化测试里还是偶尔出现。

3. **Playwright 的 Pointer Lock 限制**：`requestPointerLock()` 在 Playwright Chromium 里返回 resolved OK，但 `pointerlockchange` 事件中 `document.pointerLockElement=null`。这不是代码问题，是自动化工具的固有限制。

这些问题目前靠人工兜底——每次部署完成后手动在浏览器里跑一遍关键路径。但我的目标是逐步消灭这些手动环节。

下一期讲 **完整 Vibe Coding 工作流全景**——把前三篇串起来，画一张完整的图。

**下一篇：[Vibe Coding 多人游戏（十五）—— 完整 Vibe Coding 工作流全景](https://www.cnblogs.com/chaogex/p/21195307)**