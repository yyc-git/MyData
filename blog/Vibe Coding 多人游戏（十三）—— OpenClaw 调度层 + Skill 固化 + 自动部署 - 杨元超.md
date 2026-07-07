# Vibe Coding 多人游戏（十三）—— OpenClaw 调度层 + Skill 固化 + 自动部署

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

上期讲到，OpenClaw 从全自动（自己做一切）切换到**调度 + OpenCode 编码**的分层模式后，token 消耗大幅下降。

但带来了新问题：**谁来管理流程？**

每次要让 OpenCode 写代码，我需要：

1. 写清楚需求（Brief）
2. 启动 OpenCode 并加载项目上下文
3. 等待结果、检查编译
4. 跑测试、修复 bug
5. 循环直到通过
6. 提交代码、部署

这些步骤如果每一步都要手动做，那分层省下的时间又浪费到手动管理流程上了。

2026 年 6 月 20 日到 22 日这三天，我密集地做了一件事：**把流程固化成 Skill。**

---

## Skill 是怎么来的——一个真实案例

先说个具体的。6 月 20 日那天，我在修一个 bug：多人游戏中 `config` 被逻辑帧的 `writeState` 覆盖。

症状是：我在调试面板上把 `showCollisionBoxes` 从 `true` 改成 `false`，下一秒逻辑帧写回状态时，又把我改的值覆盖回去了。

AI 花了一轮排查：
1. 先看 `DebugPanel.tsx`——嗯，改 config 的代码没问题。
2. 再看 `MultiplayerLoop.ts` 的帧尾持久化——`writeState` 是在用旧的 `mp` 做 `{ ...mp, manageScene }` 写回。
3. 根因找到了：**逻辑帧用的是帧初始的旧 `mp` 引用，而调试面板在帧中间改了 `mp.config`，但帧尾持久化没用最新的。**

修复很简单：`writeState` 前加一行 `let latestConfig = getMultiplayerState(readState()).config`，获取最新的 config 再写入。

但这个排查过程中我意识到一个问题：**相同的修复模式，每次都要重新教 AI。**

"先找根因，再确认范围，再修改，再测试，再部署"——这个流程 AI 不会自动执行的。它擅长的是单点任务，不是多步流程。所以我需要一个东西，能把流程编排成可执行的形式，让 AI 每次自动按流程走。

---

## 三角色架构

最终形成的开发模式是**三个角色分工**：

```
你（产品/决策者）
    ↓ 一句话需求
OpenClaw（调度/管理）
    ↓ Brief + Context
OpenCode（编码/执行）
    ↓ 代码+测试
AI 模型（DeepSeek Flash/Pro）
```

| 角色 | 负责 | 用谁 |
|------|------|------|
| **你** | 定义"做什么" | 一句话描述 |
| **OpenClaw** | 调度、写 Brief、检查结果 | 免费 AI 模型（200k context） |
| **OpenCode** | 写代码、跑测试、修 bug | DeepSeek Flash Free（先尝试免费额度，超了切 Flash，同一模型缓存不丢） |

你只需要说一句"修复退房后 isEnterGame 标志位未重置的 bug"，剩下的 OpenClaw 自动匹配 Skill、读取项目上下文、生成 Brief、调度 OpenCode、检查编译、跑测试、循环直到通过——**全程不需要人干预。**

---

## Skill：可执行的流程化知识

OpenClaw 里的 **Skill** 是这个架构的核心创新——把流程写成可执行的文档。

Skill 不是普通的文档。普通的 `deploy.md` 15 步部署指南，人读了还得自己操作。Skill 不一样——**AI 读它，AI 执行它。**

比如 `gts-dev-fix` Skill（修复 Bug）的核心流程：

```
1. 读取 issue 描述或用户提的 bug
2. 搜索相关代码（搜类名、文件名、关键词）
3. 查看最近的运行日志（调度 gts-logs）
4. 提出根因分析 → 等我确认
5. 我确认后写 OpenCode Brief：
   - 项目上下文（文件范围、依赖关系）
   - 编码红线（改 .ts 再 tsc，不改 .js，不改 node_modules）
   - 测试要求（新增集成测试锁定 bug）
6. 调度 OpenCode 执行
7. 检查编译 → 有错循环修复
8. 运行测试 → 新增的失败 → 继续修
9. BDD 测试全部通过 → 完成
```

第三行"查看最近的运行日志"是关键——一般的 AI 代码修复只读代码不看日志，但很多 bug 从代码上是看不出来的，必须结合运行时日志。比如我们遇到的一个 `ApiFinished` 守卫问题：`Object.keys(state.serverState.players).length > 0` 这个条件，在 `players` 是 `Immutable.Map()` 的时候永远返回 true（因为 `Object.keys(Map())` 返回 5 个内部属性 `size`、`_root`、`__ownerID`、`__hash`、`__altered`），这个从代码上看不出来，但从日志里一眼就能发现——`_handleFinished` 从未执行。

**这个 Skill 固化有什么好处？** 最大的好处是：菜鸟和老手效果一样差——不，菜鸟和老手效果一样好。因为流程是写死的，AI 按照流程走，不会跳过关键步骤。

---

## Skill 全家桶

我们一共写了 16 个 Skill，覆盖了从提交代码到部署上线的全过程：

| Skill 分组 | 包含 | 说明 |
|-----------|------|------|
| **开发** | gts-dev-feat, gts-dev-fix, gts-dev-refactor | 新功能、修 bug、重构，都引用 gts-dev-workflow |
| **测试** | gts-e2e-test, gts-e2e-auto, gts-e2e-perf | 手动 E2E、全自动 E2E、性能测试 |
| **部署** | gts-deploy, gts-service, gts-logs | 一键部署、服务启停、日志抓取 |
| **维护** | gts-save-flow, gts-save-memory, gts-git-commit | 全流程保存、记忆保存、git 提交 |
| **管理** | gts-analysis, gts-code-review, gts-recall, gts-stop | 架构分析、代码审核、记忆回溯、紧急停止 |

每个 Skill 有自己的 `SKILL.md` 文件，遵循固定格式：触发词、Step-by-step 流程、红线、输出标准。Skill 之间可以互相引用——比如 `gts-dev-fix` 在需要看日志时会调度 `gts-logs`，需要部署时会调度 `gts-deploy`。

**Skill 之间的联动是一个亮点。** 维护的时候不需要人为链式调用——`gts-save-flow` 就串联了：代码审核 → BDD 编译 → 写 specs → 写笔记 → 保存记忆 → 项目提交 → 推送 GitHub，全部自动。

---

## 自动部署闭环

Skill 流程的最后一步通常是部署。`gts-deploy` Skill 的部署流程是这样的：

```
AI 自动开发 → AI 自动验收 → AI 自动部署 → E2E 验证
```

具体来说，`gts-deploy` 做的事情：

1. **打包**：`packages/meta3d-platform-publish` 下的 `gulpfile.js` 统一调度
   - `bundle-logic.js` 把 logic/ + meta3d-commonlib-new/ + @rescript/runtime/ 递归打包成单文件 ~49KB
   - 注意修复了一个模板字面量 `\\` 转义 bug（踩了一天的坑）
2. **压缩**：`gulp zip_all_services` 同时打 room1、room2、match1 三个 zip
   - zip 内结构：svc/ 子目录做深度补偿，避免 require 路径解析到 zip 外
   - `zip-chmod.ps1` 处理 Windows 压缩丢失 Unix 执行权限的问题
3. **上传**：`deploy-scf.js` 通过腾讯云 SCF API v3 上传 zip
   - TC3-HMAC-SHA256 签名（纯 Node.js 实现，零 npm 依赖）
   - 流程：`UpdateFunctionCode`（含 `InstallDependency`）→ `waitFunctionActive` → `UpdateFunctionConfiguration`
   - **关键踩坑**：`InstallDependency` 必须在 `UpdateFunctionCode` 请求中携带，单独 `UpdateFunctionConfiguration` 不触发 npm install
4. **发布**：设置环境变量 `NODE_ENV=production`，更新配置
5. **验证**：BDD 测试套件（7 个场景覆盖）
   - SCF API 可达性 → 函数状态 → HTTP 响应 → WebSocket 连接 → ESM 模块无错误
   - **曾经踩坑的一个场景**：`@rescript/runtime/package.json` 有 `"type": "module"`，导致 Node.js 把 `.js` 当 ES Module 处理，CommonJS `require()` 报 `ERR_REQUIRE_ESM`——修复方案是不复制该 package.json
6. **通过** → 通知"部署完成"
7. **失败** → 自动回滚，报告失败原因

全程不需要进 SCF 控制台手动操作。我之前手动部署的时候经常忘了一步：设环境变量。有了 `deploy-scf.js` 后，`NODE_ENV=production` 和 `IS_DEBUG=false` 这些配置被固化在脚本里，永远不会忘。

---

## 三角色的关键：Brief

Brief 是 OpenClaw 和 OpenCode 之间的"契约"。一个好的 Brief 是什么样的？

我举个例子。2026 年 7 月 5 日，我们遇到一个 bug：`ApiFinished.ts` 的守卫 `Object.keys(state.serverState.players).length > 0` 永远返回 true。OpenClaw 生成的 Brief 是这样的：

```
## 目标
修复 ApiFinished.ts 守卫中 Object.keys 对 Immutable.Map 永远返回 true 的 bug

## 文件范围
- packages/room-service/src/api/ApiFinished.ts（守卫逻辑）
- packages/room-service/src/models/Room.ts（stopCountdown 逻辑）
- packages/room-service/src/api/ApiFinished.ts（_handleFinished 调用 stopCountdown）

## 根因说明
初始 players 是 Immutable.Map()，Object.keys(Map()) 永远返回 5 个内部属性
（size、_root、__ownerID、__hash、__altered），守卫永远通过，
导致 _handleFinished 从未执行 → startTickLoop 不启动 → GameState 不广播

## 测试验证
- 新增集成测试：验证 Immutable.Map 时守卫返回 false
- 运行 BDD 测试确认：需要全部 7 个场景通过

## 红线
- 改 .ts 再 tsc，不改 .js
- 不改单机代码（packages/logic/src/）
- 不引入新依赖
- 守卫用 .size 区分 Immutable.Map 和普通对象
```

Brief 不用逐条手写——OpenClaw 从 Skill 模板 + 项目上下文自动生成，我只需要确认一下。确认时间大概 30 秒。如果不完美，稍微调整几句话。

---

## 从 Builder 到 Conductor

工作流进化的本质是角色转变：

| 阶段 | 你的角色 | AI 的角色 |
|------|---------|-----------|
| AI 辅助编程（网页+补全） | 编码者 | 代码生成器 |
| OpenClaw 全自动 | 指挥者 | 全栈开发者（代价高） |
| **OpenClaw 调度 + OpenCode 编码** | **指挥者** | **开发者（降本提效）** |

你不是在写代码，你是在指挥 AI 写代码。就像管弦乐队的指挥——不拉小提琴，但决定整首曲子的走向。

> **Vibe Coding 的终点不是"不用写代码"，而是"用自然语言编程"。**

不过，流程自动化之后，最缺的就是**质量保障**。AI 自动写代码很快，但如果写出来的代码有 bug，而且 AI 自己发现不了呢？

这就是下一期的问题。

**下一篇：[Vibe Coding 多人游戏（十四）—— E2E 自测与根因修复](https://www.cnblogs.com/chaogex/p/21195307)**
