# Vibe Coding 多人游戏（十三）—— OpenClaw 调度层 + Skill 固化 + 自动部署

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

上期讲到，OpenClaw 从全自动（自己做一切）切换到**调度 + OpenCode 编码**的分层模式后，token 消耗大幅下降。

但带来了新问题：**谁来管理流程？**

每次要让 OpenCode 写代码，OpenClaw 需要：

1. 写清楚需求（Brief）
2. 启动 OpenCode 并加载项目上下文
3. 等待结果、检查编译
4. 跑测试、修复 bug
5. 循环直到通过
6. 提交代码、部署

我需要的是指示 OpenClaw 去做这些步骤。如果这些步骤每一步都要我手动管理，那分层省下的时间又浪费到手动管理流程上了。

2026 年 6 月 20 日到 22 日这三天，我密集地做了一件事：**把流程固化成 Skill。**

---

## Skill 是怎么来的

### 新增 Skill 的方式

新增一个 Skill 很简单：我进行口头描述，告诉 OpenClaw 我想要一个什么样的流程，然后由 OpenClaw 去写 SKILL.md 文件。

比如我说：「帮我写一个保存流程的 Skill：每次我说'保存'的时候，你先审核改动、再跑 BDD 测试、然后编译检查、更新 specs、写笔记、更新记忆、最后提交 git」。OpenClaw 就会自动生成 \gts-save-flow/SKILL.md\，包含完整的 Step-by-step 流程、触发词、执行纪律。

新增的 SKILL.md 放入 \skills/<skill-name>/SKILL.md\，OpenClaw 重启后自动识别。不需要额外注册。

### 一个真实案例

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
| **OpenCode** | 写代码、跑测试、修 bug | DeepSeek Flash / Pro（Go 套餐付费模型） |

你需要做的只是调用对应的 Skill——比如在 Webchat 中发一句「`/gts-dev-fix` 修复退房后 isEnterGame 标志位未重置的 bug」，剩下的 OpenClaw 自动匹配 Skill、读取项目上下文、生成 Brief、调度 OpenCode、检查编译、跑测试、循环直到通过——**全程不需要人干预。**

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

核心 Skill 覆盖了从开发到部署的全过程：

| Skill 分组 | 包含 | 说明 |
|-----------|------|------|
| **开发** | gts-dev-feat, gts-dev-fix, gts-dev-refactor | 新功能、修 bug、重构，都引用 gts-dev-workflow |
| **验收** | gts-acceptance | 自动化验收流水线（TDD→E2E→自动部署） |
| **测试** | gts-e2e-test, gts-e2e-auto, gts-e2e-perf | 手动 E2E、全自动 E2E、性能测试 |
| **部署** | gts-deploy, gts-service, gts-logs | 一键部署、服务启停、日志抓取 |
| **维护** | gts-save-flow, gts-save-memory, gts-git-commit | 全流程保存、记忆保存、git 提交 |
| **管理** | opencode-schedule, gts-analysis, gts-code-review, gts-recall, gts-stop | OpenCode 调度协议、架构分析、代码审核、记忆回溯、紧急停止 |

每个 Skill 有自己的 `SKILL.md` 文件，遵循固定格式：触发词、Step-by-step 流程、红线、输出标准。Skill 之间可以互相引用——比如 `gts-dev-fix` 在需要看日志时会调度 `gts-logs`，需要部署时会调度 `gts-deploy`。

**Skill 之间的联动是一个亮点。** 维护的时候不需要人为链式调用——`gts-save-flow` 就串联了：代码审核 → BDD 编译 → 写 specs → 写笔记 → 保存记忆 → 项目提交 → 推送 GitHub，全部自动。

以下是核心 Skill 的快速参考表（完整定义见本文末尾附录）：

| Skill | 功能 | 触发词 |
|-------|------|--------|
| gts-acceptance | 自动化验收流水线 | 验收 |
| gts-dev-feat | 新功能开发 | feat: |
| gts-dev-fix | Bug 修复 | fix: |
| gts-dev-refactor | 代码重构 | refactor: |
| gts-e2e-test | 手动 E2E 测试 | e2e测试 |
| gts-e2e-auto | 全自动 E2E 测试 | e2e自动 |
| gts-deploy | 部署到 SCF | 部署 |
| gts-logs | 服务端日志分析 | 看日志 |
| gts-save-flow | 全流程保存（审核→测试→笔记→提交） | 保存 |
| gts-code-review | 代码审核 | 代码审核 / review |
| opencode-schedule | OpenCode 调度协议（被所有 dev/review skill 引用） | 间接引用 |

其余 Skill（如 gts-e2e-perf、gts-service、gts-save-memory、gts-git-commit、gts-analysis、gts-recall、gts-stop）为辅助性质（gts-e2e-perf 性能测试、gts-service 服务启停、gts-save-memory 记忆保存、gts-git-commit 单独提交、gts-analysis 架构分析、gts-recall 记忆回溯、gts-stop 紧急停止），不单独列出。

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

---

## 附录：核心 Skill 完整定义

以下为 11 个核心 Skill 的完整 `SKILL.md` 文件内容：

### gts-acceptance

```markdown
---
name: "gts-acceptance"
description: "循环改→测→验直到通过或超时，支持多问题顺序修复，TDD集成+E2E验收，通过后自动部署"
---

# 验收流程（硬性操作规程）

> 触发词：兄弟说「验收：<标准>」或「验收」。
> 自动循环模式：Specs 发现 → 逐个问题走 TDD 修复（注入 Specs）→ 全量集成测试 → Specs 覆盖验证 → E2E 自动验收 → 自动部署 → 双通道通知（含覆盖统计）。
> 全程自动化：执行 `gts-dev-fix` 时不需要兄弟确认。
> ⚠️ 验收结束时必须执行双通道通知，禁止只跑完不说话。

---

## 🔴 两级测试流程规则（本 Skill 所有步骤共用）

### 区分

| 层级 | 工具 | 成本 | 验证内容 |
|------|------|------|---------|
| 集成测试 | BDD / jest | 低（秒级） | 代码层逻辑，纯函数/逻辑层/API 流程 |
| 自动测试 | E2E Playwright | 高（分钟级） | 浏览器层完整渲染 + 用户交互 |

### 流程纪律

**集成测试 > E2E 自动测试** — 因为集成测试成本更低，应优先使用。

```
Bug → 加日志 → 写/改集成测试复现 bug → 收集数据 → 调度 OpenCode Pro 分析根因
→ 修改测试使其按根因场景真实失败（RED）
→ 调度 OpenCode 修复代码 → 集成测试全绿（GREEN）
→ 调度 OpenCode 写 E2E 测试脚本 → 跑 E2E
→ ✅ E2E 通过 → 自动部署 → 双通道通知
→ ❌ E2E 失败 → 调度 OpenCode Pro 分析原因 → 修 → 重测
```

### 线上 bug 的特殊处理

E2E 只跑线上环境，本地不跑。

| 类型 | 处理 |
|------|------|
| 线上 bug | 线上 E2E 复现 → 截图+日志 → 调度 OpenCode Pro 分析 |
| 本地 bug | 本地 E2E 复现 |
| 线上部署/环境 bug | 线上 E2E |

## 通知协议（本 Skill 所有步骤共用）

验收结束时执行**双通道通知**：

### 1️⃣ 桌面通知
```bash
msg * "<30字摘要>"
```

### 2️⃣ 飞书通知（可选，仅在线 bug 或部署时）
```json
{
  "kind": "agentTurn",
  "message": "<通知内容（≤10字）>",
  "delivery": { "mode": "announce", "channel": "feishu", "to": "user:ou_..." }
}
```

### 通知纪律
- 飞书通知内容 **≤10 字**
- 桌面通知必须调用 `msg *`
- 结果通知在验收结束或部署完成时发送

---

## E2E 验收协议

### 适用的测试脚本

- E2E headless（CI 用）：`test/e2e/auto/*.cjs`
- E2E headful（眼睛看）：用 Playwright `headless: false`
- 验收流程 **优先用 headless**，不打断不确认

### 脚本结构

```
登录 → 创建房间 → 加入 → 准备 → 开始游戏 → 操作 → DebugEndGame → 验证 UI 元素
→ 关闭弹窗 → 返回房间 → 再次进入 → 截图
```

---

## 🔴🔴🔴 TDD 纪律 — 先让测试失败（2026-07-06 新增）

验收流程中必须先让集成测试因 bug 真实失败，再修复代码使其通过。

- **禁止用模拟函数代替实际代码做集成测试**
- **正确做法**：测试必须直接调用被测试的实际代码/组件，在不修复时因 bug 真实 ❌ 失败
- 跟「先汇报再继续」「等确认发通知」「入口检查」同级最高优先级

---

## 流程（流水线 — 自动执行，不需要兄弟确认）

### Step A: 识别问题
- 区分场景：本地验收 / 线上 bug
- 依据 bug 类型决定测试策略

### Step B: 集成测试（RED）
- 根因分析 → 调度 OpenCode Pro（根因分析交给 OpenCode Pro）
- 创建/修改 BDD 集成测试（.feature + .steps.ts），调用实际代码
- 确认测试因 bug 真实失败（RED ❌）

### Step C: 修复（GREEN）
- 调度 OpenCode 修复代码
- 集成测试全绿 ✅

### Step D: E2E 自动验收
- 运行 Playwright headless E2E 脚本
- 验证用户可见的 UI 行为
- E2E 失败 → 分析原因 → 修 → 重测

### Step E: 自动部署（2026-07-06 新增）
- E2E 本地通过后 → **自动部署**，不询问兄弟
- 部署失败 → 报错，问兄弟要不要修
- 规则来源：兄弟明确说「以后本地e2e测试通过后，自动去部署，不要问我」

### Step F: 输出结果 + 双通道通知

**通知时机：** 验收结束时立即执行。

| 结果 | 桌面消息 | 飞书通知（≤10字） |
|------|---------|-----------------|
| E2E 全绿 + 部署成功 | ✅ ✅ | `验收通过+已部署` |
| E2E 失败 | ❌ | `验收未通过` |
| 部署失败 | ⚠️ 部署失败 | `部署失败` |

通知内容必须包含：
- E2E 结果（全绿/失败）
- 测试文件/功能
- 部署结果

---

## 验收优化记录

### 历史教训（重要！）
1. **不要模拟**：集成测试不要 mock 实际代码（replayState / MockWsClient），必须调用 `readState` / `writeState` 真实操作
2. **验收流程全程自动化**：E2E 期间不打断不确认，不要问「我要跑了哦？」
3. **验收结束必须通知**：禁止只跑完不说话（2026-06-26 规则收紧）
4. **TDD 纪律**：必须先 RED 失败再 GREEN，禁止跳过（2026-07-06 新增）
5. **根因分析交给 OpenCode Pro**：不自己分析根因（2026-07-06 新增）
6. **E2E 通过后自动部署**：不询问，直接部署（2026-07-06 兄弟要求）

---

## 附录：多 bug 顺序修复

如果兄弟报告了多个 bug，用一个验收流程按顺序逐个修复：

1. 所有 bug 列清单
2. 按兄弟指定的顺序逐个走 Step B→C→D→E
3. 修复完最后一个再通知

## 附录：参考文件
- E2E helper: `test/e2e/e2e-helpers.cjs`
- 现有 E2E: `test/e2e/auto/*.cjs`

```

### gts-dev-feat

```markdown
---
name: "gts-dev-feat"
description: "新功能开发：feat:触发。调度OpenCode Pro/Flash写代码，我只管验证和提交。"
---

# gts-dev-feat — 新功能开发

> 当兄弟对话中包含 `feat:` 时触发。

## 流程

直接走 **[gts-dev-workflow](skills/gts-dev-workflow/SKILL.md)**，所有确认环节都在 workflow 中处理。

- `feat:` **架构级/复杂** → 调度 OpenCode Pro + max reasoning
- `feat:` **常规功能** → 调度 OpenCode Flash

```

### gts-dev-fix

```markdown
---
name: "gts-dev-fix"
description: "Bug修复：fix:触发。调度OpenCode修复，完成后新增集成测试。E2E步骤在workflow Step 4，每步先问兄弟"
---

# gts-dev-fix — Bug 修复

> 兄弟对话中包含 `fix:` 时触发。
> 走 **gts-dev-workflow** 完整流程（出方案→实现→审核→通知），但 Step 2（实现）的 brief 中已包含「新增集成测试覆盖修复场景」的指令。

## 流程

直接委托 **gts-dev-workflow** 处理：
1. Step 1：出方案（复杂 bug 才走）
2. Step 2：实现（含新增集成测试）
3. Step 3：代码审核
4. Step 4：验证 + 部署 + E2E（含加日志、复现定位、修复到通过——**每步先问兄弟**）

> gts-dev-workflow Step 2 的 brief 模板中已为 fix 场景内置「修复后新增集成测试覆盖修复场景」的指令，OpenCode 会一并完成。
> gts-dev-workflow Step 4 包含完整的 E2E 验收流程（加诊断日志→自动测试复现定位→修复到通过），**每步都先问兄弟**。

## 🔴🔴🔴 根因分析纪律

- 遇到 bug → 加诊断日志 → **收集运行数据**（服务端/E2E/前端日志）
- 数据收集完 → 写 brief → 调度 **OpenCode Pro** 分析根因
- **不自己 trace 代码路径分析根因**
- 这步之后才调度 OpenCode Flash 修复

## 🔴 验收触发时的 Specs 注入

当 `gts-acceptance` 触发 fix 时，验收流程会在调用本 skill 前将相关 Specs 内容附到 brief 末尾。此时 dev-workflow 的 OpenCode brief 构造会自动（通过 Step 1/2 的 specs 读取指令）包含这些 Specs，无需额外操作。

> 验收触发 → acceptance 注入 Specs 到 brief → dev-workflow 的 specs 读取指令自动生效 → OpenCode 修复时知道完整场景边界

## 模型选择

与 gts-dev-workflow 一致，具体命令模板见 `skills/opencode-schedule/SKILL.md`：

| 任务 | 模型 |
|------|------|
| 复杂bug修复 | Pro + max |
| 简单修复 | Flash |

```

### gts-dev-refactor

```markdown
---
name: "gts-dev-refactor"
description: "代码重构：refactor:触发。调度OpenCode Pro/Flash重构，我只管验证和提交。"
---

# gts-dev-refactor — 代码重构

> 当兄弟对话中包含 `refactor:` 时触发。

## 流程

直接走 **[gts-dev-workflow](skills/gts-dev-workflow/SKILL.md)**，所有确认环节都在 workflow 中处理。

- `refactor:` **架构级** → 调度 OpenCode Pro + max reasoning
- `refactor:` **常规重构** → 调度 OpenCode Flash

```

### gts-e2e-test

```markdown
---
name: "gts-e2e-test"
description: "兄弟说「e2e测试」时触发。手动双窗口，列出可选 scenarios 供选择。线上测试跳过本地服务。"
---

# E2E 手动测试（硬性操作规程）

> 触发词：兄弟说「e2e测试」/「e2e」/「e2e test」，可附带操作描述和验证目标。
> 双窗口手动操作，可选注入专用日志，停止后抓数据验证。

---

## 步骤

### Step 0：判断环境 + 重启服务 + 部署检查

**先判断测试目标：**

#### SCF 线上环境（脚本含 `scf`、URL 以 `.tcloudbaseapp.com` 结尾等）

1. **跳过本地服务重启**
2. **检查部署状态**：运行 `git diff HEAD -- packages/frontend/src/ packages/room-service/src/ packages/match-service/src/ packages/logic/src/` 检查是否有未部署的生产代码改动
   - 如有改动 → 询问兄弟：「有 N 个生产文件待部署，要先部署再测吗？」
   - 如兄弟说「部署」→ 走 gts-deploy skill 部署对应服务
   - 如兄弟说「不用」→ 跳过，直接测线上现有版本
3. **继续 Step 1**

#### 本地环境

先确认「是 webpack dev server 还是本地 prod」→ 按以下步骤重启：

**前置检查 — 前端服务：**
1. 检查 webpack-dev-server 是否在运行：`Get-Process -Name node | Where-Object { $_.CommandLine -match 'webpack' }`
2. 如未运行 → `cd D:\Github\GTS-Play\packages\frontend && yarn webpack:dev-server` 启动，等启动完成
3. 如已运行 → 跳过，保留现有 webpack 进程

**重启核心服务：**
4. Kill 现有 room (4003) + match (3000) 进程
5. 启动 room-service（`yarn dev`），等启动完成
6. 启动 match-service（`yarn dev`），等连接成功

不重启会导致 match-service WS 失连，游戏卡在"查找房间中"。

### Step 1：解析输入 + 明确验证目标

兄弟可选择指定 scenarios 或附带验收标准。

**每次测试前必须先明确验证目标**：
- 兄弟说清楚要验证什么、预期行为是什么、怎么算通过
- 如果本次测试是在某个功能变更（`feat:/fix:/refactor:`）流程中触发的，验证目标以 `笔记/项目文档/changes/<日期>-<功能名>/spec.md` 中的验证策略为准
- 如果兄弟没有说验证目标，主动问：「这次 E2E 要验证什么？预期行为是什么？」

**无指定时：** 默认跑 `scenarios/perf-scene3.json`。

**指定场景时：** 列出可选 scenarios 供兄弟选择（**动态读取 `test/e2e/scenarios/*.json`**）：

```
=== 可用 Scenarios ===

[1]  两轮胜利弹窗         — scenarios/gameover-twocycle.json (46块, auto)
[2]  SCF 双窗口             — scenarios/scf-twowin.json (22块, manual)
[3]  性能录制              — scenarios/perf-scene3.json (24块, perf)

运行方式：node e2e-runner.cjs scenarios/<name>.json
```

所有 scenarios 路径相对于 `packages/frontend/test/e2e/`。

> **每次列出时动态读取** `packages/frontend/test/e2e/scenarios/*.json`。上面的列表是示例，以实际文件为准。

**有验收标准时：** 在选定 scenario 基础上修改或新增 scenario JSON。
**无验收标准时：** 直接跑选定 scenario。

### Step 2：生成并启动测试

**有验收标准：** 以选定的 scenario 为模板修改或新增 JSON，保存到 `test/e2e/scenarios/`。

**无验收标准：** 直接跑选定的 scenario：
```
node e2e-runner.cjs scenarios/<name>.json
```

以 background 模式运行，**记录 session ID**。`process(action=list)` 确认进程已在运行，然后告知兄弟「开搞」。

> ⚠️ poll 只做状态检查，不拉日志数据。跑完再一次性拉日志分析。

### Step 3：不阻塞等待

- **启动后告知兄弟，不持续等待**
- **兄弟发新消息时**：
  - 判断消息是否与当前测试相关（如看日志、分析结果等）→ **保留测试进程**，直接处理
  - 与当前测试无关（让我干别的事）→ 先 `process(action=kill, sessionId=<记录id>)` 精准 kill 测试进程，再处理新请求
- **如果测试自然退出（收到 completion event）** → 输出结果分析 + 发通知

### Step 4：结果分析

场景退出后：

1. **日志已自动保存** — saveLogs block 或 saveE2EData 已在停止时自动保存日志
2. **简要分析** — 在会话中输出关键结论
3. **写入变更文档（如当前有变更流程）** — 如果本次测试是在某个功能变更流程中触发的，将测试结论写入对应 `log.md`：
   ```
   ## E2E 手动验证
   - 时间：<日期>
   - 验证目标：<什么行为>
   - 结论：通过/失败
   - 失败原因：<如有>
   ```

### Step 5：双通道通知

分析后发飞书通知（≤10字）+ 桌面消息告知兄弟。

---

## 索引维护规则

> Scenarios 新增/移动/重命名后，**必须同步更新本 SKILL.md 的场景索引表**。
> 运行方式统一为：`node e2e-runner.cjs scenarios/<name>.json`

## 执行纪律

1. **判断测试环境** — SCF 线上跳过 Step 0 服务重启，但需做部署检查
2. Scenarios 在 `test/e2e/scenarios/` 目录下查找（JSON 文件）
3. 默认无指定时跑 perf-scene3
4. 有验收标准时基于 template 修改或新增 scenario JSON
5. 测试过程不阻塞等兄弟
6. 跑完后双通道通知

```

### gts-e2e-auto

```markdown
---
name: "gts-e2e-auto"
description: "兄弟说「e2e自动」触发。先列功能点等确认，再顺序执行自动 scenarios。线上跳过本地服务。"
---

# E2E 自动测试（硬性操作规程）

> 触发词：兄弟说「e2e自动」/「e2e auto」/「自动测试」。
> 重启服务 → 列出功能点等确认 → 顺序执行 → 通知。

---

## 步骤

### Step 0：判断环境 + 重启服务 + 部署检查

**先判断测试目标：**

#### SCF 线上环境（脚本名含 `scf`、URL 以 `.tcloudbaseapp.com` 结尾等）

1. **跳过本地服务重启**
2. **检查部署状态**：运行 `git diff HEAD -- packages/frontend/src/ packages/room-service/src/ packages/match-service/src/ packages/logic/src/` 检查是否有未部署的生产代码改动
   - 如有改动 → 询问兄弟：「有 N 个生产文件待部署，要先部署再测吗？」
   - 如兄弟说「部署」→ 走 gts-deploy skill 部署对应服务
   - 如兄弟说「不用」→ 跳过，直接测线上现有版本
3. **继续 Step 1**

#### 本地环境

1. Kill 现有 room (4003) + match (3000) 进程
2. 启动 room-service（`yarn dev`），等启动完成
3. 启动 match-service（`yarn dev`），等连接成功
4. 确认 webpack-dev-server (8093) 已在运行

不重启会导致 match-service WS 失连，游戏卡在"查找房间中"。

### Step 1：列出可自动测试的功能点，等兄弟确认

在会话中输出以下功能点列表：

```
=== 自动 E2E 功能点列表 ===

=== 核心流程 ===
[x] 正常联机双用户 — scenarios/gameover-twocycle.json ✅
[ ] 独立验证
[ ] 自动退出

=== 碰撞检测 ===
[ ] 巨大娘碰撞小人
[ ] 多个角色碰撞
[ ] 碰撞不致死
[ ] 碰撞特效
[ ] 断线碰撞

=== 游戏机制 ===
[ ] 退出通知弹窗
[ ] 断线重连(跳转大厅)
[ ] 主机转移(断开房间)

=== 多人模式 ===
[ ] 群组通信(群聊)
[ ] 单聊
[ ] 好友添加

=== HUD ===
[ ] 巨大娘血条
[ ] 小人血条
[ ] 伤害数字
[ ] 视角切换

=== 性能 ===
[ ] 渲染器
[ ] 插值效果
```

等兄弟确认勾哪些功能点后，按顺序逐个执行。

### Step 2：判断环境 + 选择 scenarios

- **线上环境**：跳过 Step 0，直接用 SCF 适配 scenario
- **本地环境**：已重启服务后，用常规 scenario
- 运行方式统一：`node e2e-runner.cjs scenarios/<name>.json`
- 支持 headless 模式的 scenario 可直接自动跑

### Step 3：按顺序执行

每个功能点用对应 scenario，background 模式启动，`process(action=list)` 确认进程已在运行后继续下一个。

> ⚠️ poll 只做进程状态检查，不拉日志数据。所有场景跑完后一次性汇总结果。

### Step 4：结果汇总

全部完成后汇总通过/失败结果，发双通道通知。

## 执行纪律

1. **判断测试环境** — SCF 线上跳过 Step 0 服务重启，但需做部署检查
2. 自动 scenarios 在 `test/e2e/scenarios/` 目录查找（JSON 文件）
3. 测试过程不阻塞等兄弟
4. 跑完后双通道通知

```

### gts-deploy

```markdown
---
name: "gts-deploy"
description: "部署GTS-Play服务（room1/room2/match1/frontend/all）到SCF或静态托管。E2E通过后自动部署不询问"
---

# gts-deploy — 部署 GTS-Play 服务到线上

## 触发词
- `部署`
- `发布`
- `deploy`
- 本地 E2E 测试通过后自动触发（不需要确认）

## 前置条件
- 工作目录：`D:\Github\GTS-Play\packages\meta3d-platform-publish`
- 部署到腾讯云 SCF（服务端）或 CloudBase 静态托管（前端）
- 生产 URL：
  - room1: `wss://1302358347-75c0pmliik.ap-shanghai.tencentscf.com?room-id=1`
  - room2: `wss://1302358347-ezkijqoed2.ap-shanghai.tencentscf.com?room-id=2`
  - match: `https://1302358347-392p0efafm.ap-shanghai.tencentscf.com`

## 🔴 规则

### 规则1：不要问部署什么服务
- **从改动文件判断受影响的服务**，不询问兄弟

判断逻辑：

| 改动的目录 | 必须部署的服务 |
|-----------|---------------|
| `packages/room-service/` | room1 + room2（两个 SCF 函数都跑同一份代码） |
| `packages/match-service/` | match1 |
| `packages/frontend/` | frontend（CloudBase 静态托管） |
| `packages/logic/` | room1 + room2 + match1（所有服务端） |
| 只改 `packages/room-service/` | room1 + room2 |
| 同时改 `room-service` + `frontend` | room1 + room2 + frontend |
| 同时改 `match-service` + `frontend` | match1 + frontend |
| 同时改所有 | 全部 |

**只部署受影响的**，不多部署不必要的。

### 🔴 规则2：E2E 通过后自动部署，不问兄弟

本地 E2E 测试通过后，**立即自动调用 deploy 流程**，不再问兄弟「要不要部署」。

- 流程：E2E 全绿 ✅ → 自动进入 Step 3（执行部署）
- 部署完成后发桌面通知告知结果
- 若部署失败 → 报错并问兄弟是否要修
- 此规则优先于 Step 2 的「等兄弟确认」（自动触发时跳过 Step 2）

## 流程

### Step 1: 判断部署目标
> 不询问，自动判断。

### Step 2: 确认部署（仅手动触发时执行）
- 当兄弟明确说「部署」「发布」「deploy」时 → 直接部署不询问
- 当自动触发时（E2E 通过后）→ **跳过此步**
- **双通道通知**：桌面消息 + 飞书通知（≤10字）

### Step 3: 按目标执行

#### 服务端部署（room1 / room2 / match1）
```bash
# room1
yarn deploy_room1    # build_logic → build_room1 → zip_room1 → deploy-scf.js room1

# room2
yarn deploy_room2    # build_logic → build_room2 → zip_room2 → deploy-scf.js room2

# match1
yarn deploy_match1   # build match-service → zip_match → deploy-scf.js match1
```

`deploy-scf.js` 自动做：
1. 读取桌面上的对应 zip 文件
2. base64 编码后调用 SCF `UpdateFunctionCode` API
3. 等待函数状态变为 Active
4. 调用 `UpdateFunctionConfiguration` 设置并发/超时/内存等

#### 前端部署（frontend）
```bash
yarn publish_multiplayer_demo_static_test
```

gulp task 自动执行：
1. `mark_test` — 标记测试环境
2. `update_config` — 写入生产配置到 `ConfigUtils.ts`
3. `update_multiplayer_config` — 设置 `Config.ts` 为 isProduction:true
4. `build_multiplayer_test` — webpack_origin 构建前端
5. `delete_platform_code_static` — 删除 CloudBase 旧文件
6. `update_platform_code_static` — 上传新文件

### Step 4: 验证部署

#### 服务端验证
- **检查 exit code**：gulp task exit code = 0 才算成功
- **检查 SCF 状态**：可通知兄弟要不要跑 BDD 测试（`yarn test`）验证
- **检查错误输出**：如果有 stderr，分析错误原因，给处理方案

#### 前端验证
- **检查 webpack 构建**：exit code = 0，无编译错误
- **检查上传**：`update_platform_code_static` 成功
- **前端配置还原**：部署后 Config.ts 变为 isProduction:true，如需本地开发则改回 false
- **快速验证**：问兄弟是否需要在浏览器打开确认

### Step 5: 通知结果
- **桌面通知**（必须）：`msg * "<30字摘要>"`
- **飞书通知**（可选）：channel=feishu，≤10字
- 告知部署成功/失败、验证结论
- 同时告知 Config.ts 是否被设为 isProduction:true

## 注意事项
- 部署前无需重启任何服务（SCF 部署新版本后自动切换）
- 部署 room 后如需验证，建议跑 BDD 测试但先问兄弟
- 前端部署后 Config.ts 变成 isProduction:true，若后续本地开发需改回 false
- 部署失败 → 汇报错误信息，问兄弟是否调度 OpenCode 修复
- 🔴 不询问兄弟部署什么服务，从改动文件自动判断
- 🔴 E2E 通过后自动部署，不询问确认（2026-07-06 新增）

## 参考
- gulpfile：`packages/meta3d-platform-publish/gulpfile.js`
- 部署脚本：`packages/meta3d-platform-publish/scripts/deploy-scf.js`
- 配置参考：`frontend/src/logic_layer/MultiplayerUrlConfig.ts`

```

### gts-logs

```markdown
---
name: "gts-logs"
description: "抓取并分析GTS-Play SCF服务端日志（room1/room2/match1）"
---

# gts-logs — 抓取并分析 SCF 服务端日志

## 触发词
- `看日志`
- `查日志`
- `日志`
- `logs`

## 前置条件
- 工作目录：`D:\Github\GTS-Play\packages\meta3d-platform-publish`
- 日志来源：腾讯云 CLS（日志服务），通过 `logs-scf.js` 脚本查询
- 三个服务共用同一个 CLS 日志主题：`806996fb-c4fc-4de3-8fc6-41c0cdab83f2`

## 流程

### Step 1: 问兄弟看哪个服务的日志
> 看哪个服务的日志？room1 / room2 / match1

可加参数：
- `--limit N`：返回条数（默认 20）
- `--hours N`：最近 N 小时（默认 1）

示例：`看 room1 最近2小时的50条日志`

### Step 2: 执行日志抓取
```bash
# room1
yarn logs_room1           # 默认 20 条 × 最近 1 小时

# 带参数（通过 gulp task 不支持直接传参，改用直接调脚本）
node scripts/logs-scf.js room1 --limit 50 --hours 2
```

### Step 3: 分析日志内容
抓取后自动分析以下内容：

| 分析项 | 说明 |
|--------|------|
| 错误（Error/ERR/Exception） | 代码执行错误，标注行数 + 错误类型 |
| 警告（Warning/WARN） | 潜在问题的警告信息 |
| 模块加载失败 | `Cannot find module`、`ERR_REQUIRE_ESM` 等 |
| 连接异常 | WebSocket 断开、超时等 |
| 崩溃重启 | `exit`、`OOM`、`timeout` 等 |

### Step 4: 输出分析报告
**不贴原始日志**，只给分析结果：

```
[room1 日志分析] 最近1小时 × 20条

⚠️ 警告: 2 条
  - "WebSocket idle timeout" × 2（正常行为，空闲连接超时断开）

✅ 正常: 18 条
  - 连接建立/断开、心跳、消息处理
```

如有错误/异常，附上处理方案：
- `Cannot find module` → 检查 zip 是否缺少 node_modules，重新打包部署
- `ERR_REQUIRE_ESM` → 检查 `@rescript/runtime` 的 package.json 是否被复制进 zip
- `WebSocket timeout` → 正常行为，非错误
- `OOM / timeout` → 考虑增大 SCF 内存或超时配置

### Step 5: 通知兄弟
- **双通道通知**：桌面消息 + 飞书通知（≤10字）
- 告知日志分析结论，如有问题问兄弟是否处理

## 注意事项
- 日志通过 CLS `SearchLog` API 查询，端点 `cls.tencentcloudapi.com`
- 不支持查看实时流式日志（SCF Web 函数不走 `GetFunctionLogs` API）
- 日志可能有几分钟延迟（CLS 投递延迟）
- 如查询返回空结果，尝试加大 `--hours` 参数

## 参考
- 日志脚本：`packages/meta3d-platform-publish/scripts/logs-scf.js`
- CLS 日志主题 ID: `806996fb-c4fc-4de3-8fc6-41c0cdab83f2`
- 日志集 ID: `f55dcb46-e178-4ecb-8443-3ad42d323040`

```

### gts-save-flow

```markdown
---
name: "gts-save-flow"
description: "兄弟说「保存」时触发。审核→BDD→编译→规格→笔记→记忆→项目提交推送→GitHub两段同步"
---

# gts-save-flow — 保存协议（硬性操作规程）

> 触发词：兄弟说「保存」（仅二字）。
> ⚠️ git 命令在 `.openclaw/` 根目录执行（不是 workspace 子目录），明确标注目录的除外。

---

## 流程（8+1 步）

兄弟说「保存」后，严格按以下顺序执行每一步：

### Step 0：改动总结

1. 获取上次保存到现在的改动清单：
   - 读取 `笔记/决策记录/.last-save` 获取上次保存的 commit SHA
   - `git log --oneline <last-save-sha>..HEAD` 列出所有中间 commit
   - `git diff <last-save-sha>..HEAD --stat` 列出文件改动统计
   - 生成简洁的 **改动摘要**

2. **问题分析**：
   - 是否改了服务端代码 → 是否重启了服务？
   - 是否改动了 `node_modules` → 是否经兄弟确认？

3. 在会话中输出改动摘要 + 问题预警，不需要发飞书通知

> ⏸️ 等兄弟确认「继续」才走下一步

### Step 1：快速审核改动

- `git status` 看改动文件
- 快速过一遍改动的合理性（防止意外改动混入）
- 有问题 → 通知兄弟确认

### Step 2：跑 BDD 测试

- 如果 `packages/frontend/test/` 或 `packages/frontend/src/` 有改动：
  - `cd packages/frontend && npx jest --config jest.multiplayer.json --silent`
- 如果 `packages/room-service/test/` 或 `packages/room-service/src/` 有改动：
  - `cd packages/room-service && npx jest --config jest.json --silent`
- 如果 `packages/match-service/test/` 或 `packages/match-service/src/` 有改动：
  - `cd packages/match-service && npx jest --config jest.json --silent`
- 测试失败 → 修到全绿再继续

### Step 2.5：编译检查

- 如果 TypeScript 文件有改动，BDD 全绿后追加 `npx tsc --noEmit`
- ⚠️ jest（ts-jest）只转译不做类型检查，必须靠 `tsc` 暴露
- 有错误 → 修到零错误，回头再跑 BDD 确认

### Step 3：规格同步（Specs 文件）

检查本次改动的业务逻辑与 `.feature` 规格文件是否一致：

1. 查看 `笔记/项目文档/changes/` 下活跃变更目录的 specs 文件
2. 对比 git diff 中改动的业务行为与 specs 描述是否匹配
3. 如果新增了业务场景/状态机转换/消息逻辑但无 specs 覆盖 → 新增场景
4. 如果 specs 与实际实现不一致 → 更新 specs
5. 同步更新对应的 `.steps.ts` 测试步骤文件（如需新步骤定义）
6. 如果需要新的状态类型 → 检查 `state/StateType.ts` 是否有对应类型

> 只在改动涉及业务逻辑时执行此步骤，纯文档/配置改动跳过。
> 更新 specs 后重新跑一遍 BDD（Step 2）确认规格与代码一致。

### Step 4：更新笔记

- 看情况更新 `笔记/` 中对应目录：
  - 架构级/决策 → `项目文档/` + `决策记录/`
  - 重构/功能实现 → `方案/` + `代码笔记/`
  - 日常调试 → `讨论记录/`

### Step 5：更新持久记忆

- 更新 `workspace/memory/` 对应日期的文件
- 如果 `MEMORY.md` 中的配置/规则/教训需要更新 → 同时更新

### Step 6：GitHub 同步（三段提交）

> 📣 push 步骤可能需翻墙，如果失败通知兄弟手动推。

#### Part 0：提交并推送 GTS-Play 项目代码（在项目根目录执行）

```powershell
Set-Location D:\Github\GTS-Play
git add -A
git commit -m "feat|fix|refactor: <改动摘要>"
git push origin dev
```

- 推送前检查 `git status --short` 确保没有意外文件混入
- `webpack.log`、截图 PNG、`node_modules` 等已 gitignore 的不应被包含
- 如有未跟踪文件混入 → 告知兄弟确认是否加 gitignore

#### Part 1：last-save（.openclaw 仓库本地提交）

**⚠️ 顺序不可错：先写 `.last-save`，再 `git add`，确保包含在 commit 中。**

```powershell
Set-Location C:\Users\Administrator\.openclaw

# 1. 获取当前 HEAD SHA
$SHA = git rev-parse HEAD

# 2. 先写入 .last-save（路径：workspace/笔记/决策记录/.last-save）
Set-Content -Path workspace/笔记/决策记录/.last-save -Value $SHA -NoNewline

# 3. 再 stage（此时 .last-save 已在工作区）
git add -A

# 4. 提交
git commit -m "save: <日期> <改动摘要>"
```

#### Part 2：push 到 GitHub

```powershell
Set-Location C:\Users\Administrator\.openclaw
git push origin main
```

如果 push 失败（网络/翻墙问题）→ 通知兄弟手动推。

---

## 提交纪律

1. 所有 step 串行执行，不能跳步
2. Step 2 测试不过必须修，不能跳过
3. Step 6 三段提交不合并，确保：
   - GTS-Play 项目先 commit + push（Part 0）
   - `.last-save` 留在本地（Part 1）
   - `.openclaw` push 到 GitHub（Part 2）
4. **必须先写 `.last-save` 再 `git add -A`**，否则 `.last-save` 不会被包含在保存提交中

### last-save 更新机制

- 保存成功后，将**当前 HEAD 的完整 SHA** 写入 `workspace/笔记/决策记录/.last-save` 文件
- ⚠️ 必须在 `git add -A` **之前**写入
- 下次「保存」时读取此文件确定上次保存点
- ⚠️ 不要用 `git tag` 或 `git stash` 记录 last-save，只用 `.last-save` 文本文件

```

### gts-code-review

```markdown
---
name: "gts-code-review"
description: "代码审核：调度OpenCode Pro审查代码+测试脚本，转达结果，含specs/记忆/笔记审核步骤"
---

# gts-code-review — 代码审核

> 兄弟说「代码审核」「审核」时触发此流程。
> 调度 OpenCode Pro 审查代码，我把结果完整转达给兄弟，兄弟决定怎么修。

> ⚠️ **默认审核范围检查 `.last-review`**，包含测试和脚本文件。
> ⚠️ **所有层级（🐛🔴🟡🟢）默认全部要修**，只有兄弟说「不处理」「跳过」「忽略」才不修。

> ℹ️ 审核标准完整版维护在 `笔记/项目文档/rules/workflow-rules.md`（流程层/重构规则），此 Skill 的 brief 模板与之同步。

## 流程

### Step 1：确认范围

问兄弟审核范围：

1. **指定文件/目录** → 只审指定范围
2. **指定 commit hash** → `git diff <hash>..HEAD`
3. **未指定** → 默认读取 `笔记/决策记录/.last-review` 获取上次审核位置，核对后确认：

   ```
   git diff $(cat 笔记/决策记录/.last-review)..HEAD
   ```

   审核范围**默认包含测试和脚本文件**（`test/`、`scripts/`、`e2e/`、`*.steps.ts`、`*.spec.ts`、`*.test.ts` 等），不限于生产代码。
   **也默认包含规格文件**：`笔记/项目文档/changes/<活跃变更>/specs/*.feature` 和 `笔记/项目文档/changes/<活跃变更>/*.md`（含 spec.md/tasks.md/log.md 等）。

> 如果 `.last-review` 不存在或为空，回退到 `git diff HEAD~1`，并告知兄弟。

### Step 2：审核记忆和笔记（新增）

在审核代码前，先检查本次改动的相关记忆和笔记是否需要同步更新：

1. **检查 daily log**：查看 `~/.openclaw/workspace/memory/<当天>-log.md`，确认是否有本次改动的记录。如果审核涉及新的经验/教训/决策，在 daily log 末尾追加。
2. **检查项目笔记**：查看 `D:\Github\GTS-Play\笔记\项目文档\changes\<活跃变更>` 下的 `log.md` 和 `solution.md`，确认是否需要更新改动描述、根因分析、修复方案。
3. **检查 lessons 目录**：如果本次发掘了新的踩坑经验/重要教训，确认 `笔记/项目文档/lessons/` 下是否有对应的总结笔记需要更新。
4. **列出需要更新的记忆/笔记列表**（不自己改，等兄弟确认）。

> 不要遍历所有笔记，只查：
> - `~/.openclaw/workspace/memory/<当天>-log.md`
> - `D:\Github\GTS-Play\笔记\项目文档\changes/<活跃变更>/log.md`（如有）
> - `D:\Github\GTS-Play\笔记\项目文档\changes/<活跃变更>/solution.md`（如有）
> - `D:\Github\GTS-Play\笔记\项目文档\lessons/`（扫一眼，有匹配的才更新）

### Step 3：审核 Specs 规格文件

在审核代码前，先审核本次改动相关的规格文件（`.feature` + `.md`）：

1. 读取活跃变更的规格文件：`笔记/项目文档/changes/<活跃变更>/specs/*.feature` 和 `笔记/项目文档/changes/<活跃变更>/*.md`（spec.md/tasks.md/log.md 等）
2. **审核规格内容**（非仅检查同步）：
   - 场景是否完整：`.feature` 的 Given-When-Then 是否覆盖了所有关键业务路径？
   - 描述是否清晰：能被不熟悉的人理解业务行为？
   - 是否存在冗余/重复的场景或描述？
   - 状态机转换是否有对应的场景？
   - spec 是否与项目实际的业务逻辑和状态定义一致？
   - 每个场景是否有实际的 `.steps.ts` 步骤定义？
   - `.md` 文档（spec.md/tasks.md/log.md）是否与最新实现一致？
3. **对比代码行为**（对照 git diff）：
   - 改动的业务逻辑是否在 specs 中有对应场景？
   - 新增的行为是否有 specs 覆盖？无 → 标注为缺失
   - specs 描述与实际实现是否一致？不一致 → 列出需要更新的地方
4. 列出审核结果（不自己改，等兄弟确认后再 Step 6 处理）

> 不需要遍历整个仓库的 specs，只查 `笔记/项目文档/changes/<活跃变更>/specs/` 和 `笔记/项目文档/changes/<活跃变更>/` 下的文件。

### Step 4：生成审核 brief + 调度 OpenCode Pro

生成 brief（含审核标准），然后调度。**brief 开头自动注入 `笔记/项目文档/project-context.md` 的项目上下文内容。**

按照 `skills/opencode-schedule/SKILL.md` 的标准方式调度（Pro + max）：
```
# 1. 写 brief 文件
write <审核brief> → .opencode-brief-review.md

# 2. 调度（模板见 skills/opencode-schedule/SKILL.md）
cd D:\Github\GTS-Play
exec(background=true, timeout=0) → type .opencode-brief-review.md | opencode run -m opencode-go/deepseek-v4-pro --variant max --dir . --attach http://localhost:4096 --no-replay
```
通过 web UI（localhost:4096）监控审核进度。

**brief 模板（git diff 放 ```diff 区块里）：**

> 请审查以下 git diff 范围内的代码和规格文件，从以下维度找问题。
>
> ```diff
> GIT_DIFF_HERE
> ```
>
> **注意：审核范围已包含测试文件、脚本文件和规格文件（`.feature` 和 `.md`），请一并审查。**
>
> ### 🐛 Bug 检查（必须查）
> - **逻辑与竞态**：空指针/undefined 访问、边界条件遗漏、异步竞态条件（Promise 时序）、条件分支覆盖不全、状态更新逻辑错误
> - **类型安全**：`as any` 硬转是否存在、可选链（`?.`）遗漏、函数签名不匹配、类型断言风险
> - **内存泄漏**：Three.js 对象（geometry/material/texture）是否 dispose、事件监听器是否 cleanup、setTimeout/setInterval 是否清除
> - **改动影响**：回归风险分析、接口签名是否同步、被引用代码被删除是否影响其他调用方
> - **改动真正生效了吗？**：变更是否真的跑起来了？AI 可能改了一堆代码但实际没执行到。检查关键策略是否真正被调用/生效，而非仅看代码是否写得对。**特别关注测试**：检查测试是否真正覆盖了真实代码路径，避免 mock-only 的假测试
> - **End 逻辑重置检查**：在结束/销毁/dispose/stop 等 End 逻辑中，检查是否已经重置干净了。gameStop 未重置 gameStartStartedRef、onGameStarted 未重置 gameOverTriggeredRef 等跨轮状态残留是高频 bug 源。**每个 end/stop/destroy/dispose 函数都必须遍历清理所有关联的 ref/flag/state**
>
> ### 🔴 清理项（必须修）
> - 测试代码残留：`window.__xxx`、`[DBG]`、`__` 前缀全局变量、调试用 `console.log`
> - 未使用的 import 语句
> - 多余文件/代码：无引用文件、死代码块、被注释掉的旧实现
>
> ### 🟡 重构项（出方案等确认后改）
>
> **架构与结构**
> - 检查是否符合开闭原则：新增功能时是否扩展现有架构（新文件/新模块），而非修改现有单机代码路径
> - 优先使用事件驱动而非 if-else 条件分支/轮询/回调传递：事件注册/订阅替代长条件链和主动轮询，新行为 = 新 handler，不改现有逻辑
> - 不要在中间 `require`/`import` 文件，统一在最开头引入
> - 文件 >500 行 → 按 export 拆文件
> - 函数 >100 行 → 提子函数
> - 重复代码 ≥3 处 → 提公共函数
> - 避免硬编码：magic number、inline string、硬编码路径/URL → 抽为常量/枚举/配置对象
> - **警惕不必要的抽象/过度设计**：AI 喜欢提前抽象，一个使用场景搞出接口/工厂/策略模式全套。没有第二个使用场景就不需要抽象
> - **代码是否太长/复杂？**：AI 常把简单事情复杂化，两行判断拆成三个函数加一个类。警惕大段新增代码
> - **有没有产生重复代码？**：AI 不知道项目里已有的工具函数/组件，经常自己重新实现一遍。检查是否和现有util重复
> - **有没有破坏已有的代码风格？**：AI 每次生成的写法可能不一致，同一个项目出现多种风格混搭
> - **改动范围是否合理？**：一个简单需求，AI 可能顺手改了十个不相关文件。确认每个改动都是必要且合理的
>
> **测试质量**
> - BDD 测试必须测试实际代码，避免只测模拟逻辑。不能有假测试（mock-only、无断言的空测试等）
> - 集成测试要覆盖尽可能多的真实流程，减少纯 mock 测试，优先走完整管线入口
> - 测试 mock 过多 → 重构生产函数（避免测试大量 `any` 或巨型 mock）
> - 如果测试不方便或 mock 太多，考虑将被测试的函数改为纯函数（入参出结果，不引用外部状态/副作用），降低测试成本
>
> **类型与命名**
> - `any` 类型 → 替换为具体类型
> - 名字与实际用途不符 → 重命名变量/函数/类型/枚举
>
> **职责与依赖**
> - 单一职责原则：一个模块/类/函数只有一个职责、一个修改理由
> - 非纯函数混入副作用：应纯化的函数访问了全局状态/模块级变量/DOM
> - 层间职责越界：任何层做了不该它做的事
> - 接口隔离原则：接口不应包含调用者不用的方法，避免臃肿接口
> - 依赖倒置原则：依赖抽象而非具体实现
> - 最少知识原则：只和直接朋友通信，不跨层访问不相关对象
> - 源文件不同步：改 `.gen.tsx` 未同步 `.res`、改 `dist` 未同步 `src`
>
> **状态管理**
> - 禁止 `window` 全局挂载，所有数据放入 state 统一管理
> - 模块级变量未移入 state：`let` 变量场景重入时手动清空易遗漏
> - 函数隐式调 readState/writeState：应通过参数传入 state/mp
> - 函数修改 state/mp 后必须返回，禁止仅靠引用修改隐式生效
>
> **安全与可靠**
> - 使用项目自定义 Three.js class，禁止直接 `new THREE.Sprite` 等
> - setTimeout/异步过多 → 替换为 deltaTime/rAF 定时
> - 防御式编程：参数尽量必传，不满足条件尽早 throw
> - 减少可选参数，用必传 + 默认值工厂代替
>
> **状态同步子规则（仅多人联网代码）**
> - 客户端不得擅自修改权威状态（server 回包前改 hp/position/score）
> - 发送绝对值而非变化量
> - 服务端必须校验输入（速度上限/冷却/移动范围检查）
> - 断线状态保留：玩家断开不清 state，支持重连恢复
>
> ### 🟢 关注项（默认也要修）
> - 条件嵌套 >3 层 → 加 `// TODO: 降低复杂度`
> - 导出函数缺 JSDoc → 补占位注释
> - 空 catch 块静默吞错
> - 未清理的 event listener/timer/全局对象（内存泄漏风险）
> - 异步调用无超时/错误处理
>
> ### 📋 Specs 审核（必须审）
> 审核 `.feature` 和 `.md` 规格文件的内容质量：
> - **场景完整性**：`.feature` 的 Given-When-Then 是否覆盖了所有关键业务路径和边界情况？
> - **场景清晰度**：描述是否明确，能让不熟悉的人理解业务行为？
> - **冗余检查**：是否存在重复或多余的场景或描述？
> - **代码一致性**：spec 描述与 git diff 中改动的实际代码行为是否一致？
> - **状态机覆盖**：状态机转换和关键业务规则是否有对应的 spec 场景？
> - **步骤定义**：每个场景是否有对应的 `.steps.ts` 步骤定义？
> - **规范符合**：`.feature` 是否使用了正确的关键字（Feature/Scenario/Given/When/Then），格式是否正确？
> - **.md 文档同步**：spec.md/tasks.md/log.md 是否与最新实现和改动一致？
>
> 格式要求：
> - 按 🐛🔴🟡🟢📋 五级分类输出
> - 每条给出：问题描述 + 文件 + 行号 + 建议修复方式
> - 没内容写的类别直接为空 \( e.g. 「🐛 Bug 检查\n\n（无）」\)，不要保留空白条目
> - 不用 E2E 相关操作

### Step 5：转达审核结果给兄弟

1. 先 2-3 行摘要，再贴原始完整审核报告
2. 每条建议问兄弟要不要修
3. 兄弟说「修」→ 列进 fix brief；兄弟说「不处理」「跳过」「忽略」→ 跳过
4. **空项直接不显示**，不要保留空标题行

### Step 6：Specs 整理

在开始修复前，根据 Step 3 的 specs 审核结果，一步步整理 specs：

1. **列出需要更新的规格文件**（基于 Step 3 发现的规格问题）
2. **逐条确认兄弟要改哪些**（不要一次全推过去，一条一条问）
3. 兄弟说「改」→ 按以下顺序操作：
   - a. 读现有文件，确认当前内容
   - b. 按 Cukes 规范更新 `.feature`（Given-When-Then）
   - c. 同步更新 `.steps.ts`（如需新步骤定义）
   - d. 更新 `.md` 文档（spec.md/tasks.md/log.md）
   - e. 如果涉及新的状态机转换 → 检查 `state/StateType.ts` 是否有对应类型
   - f. 如果需要，新增状态值到 `StateType.res`
4. 兄弟说「不改」→ 跳过，记一下后续可能补
5. 所有规格整理完毕后 → 跑 BDD 测试确认 specs 与代码一致

> Specs 位置约定：`笔记/项目文档/changes/<活跃变更>/specs/*.feature` + `笔记/项目文档/changes/<活跃变更>/*.md`
> Spec 命名规范：业务行为缩写，用连字符分隔（如 `pos-reset-detection.feature`）
> 每个 spec 对应一个场景清单（Main Specs），可被后续变更引用（Delta Specs）

### Step 7：更新记忆和笔记（新增 — 修复后更新）

在修复完成、验证通过后，同步更新相关记忆和笔记：

1. **更新 daily log**：`~/.openclaw/workspace/memory/<当天>-log.md` 追加本次审核的摘要：
   - 审核范围（git diff 范围）
   - 发现的问题数量（按 🐛🔴🟡🟢📋 分级统计）
   - 修复的文件和主要内容
   - 新的经验/教训/决策（如果有的话）

2. **更新项目笔记**：`D:\Github\GTS-Play\笔记\项目文档\changes\<活跃变更>\log.md` 追加本次审核记录：
   - 审核结论
   - 修复摘要
   - 测试结果（BDD + tsc）
   - 如果是 lessons 级别的重要经验 → 写到 `笔记/项目文档/lessons/` 下独立文件

3. **更新决策记录**：如果本次审核产生了新的工作协议/规则/红线 → 更新对应的规则文档（如 `workflow-rules.md`），并在 daily log 中标注

> 只有 1 和 2 是必做。3 只在产生了可重复使用的规则时才做。
> 更新时间在修复验证之后、写入 `.last-review` 之前。

### Step 8：调度 OpenCode Flash 修复

把所有要修的内容收集成 brief，使用 exec + pipe 调度 OpenCode Flash：

```
# 1. 写 brief 文件
write <fix brief> → .opencode-brief-fix.md

# 2. 调度
cd D:\Github\GTS-Play
exec(background=true, timeout=0) → type .opencode-brief-fix.md | opencode run -m opencode-go/deepseek-v4-flash --dir . --attach http://localhost:4096 --no-replay
```

**fix brief 模板（开头自动注入 project-context.md）：**
> 请在以下文件中修复代码审核指出的问题。
>
> 改动列表：
> 1. [问题描述]
> 2. [问题描述]
> ...
>
> 修改要求：
> - 每个问题精确对应修复，不要引入无关改动
> - 保持代码风格一致
> - 不需要代码审核，代码审核是单独步骤
> - 不需要 E2E 相关操作

### Step 9：验证修复

1. 检查 git diff 确认改动范围合理
2. 跑 BDD 测试：`npx jest --config jest.multiplayer.json --silent`
3. 跑类型检查：`npx tsc --noEmit`
4. 检查 specs 与代码行为是否一致（对照 Step 6 整理的 specs）
5. 如果 specs 有改动 → 跑一遍 BDD 确认规格与代码完全一致
6. 问兄弟要不要跑 E2E 验证
7. 跑 E2E 需要：确认服务端已部署（线上）或启动本地服务（room + match + webpack）
8. E2E 发现问题 → 调度 OpenCode 诊断修复

### Step 10：写入 .last-review

```bash
cd D:/Github/GTS-Play/
git rev-parse HEAD > 笔记/决策记录/.last-review
```

> `.last-review` 文件只由本 Skill 修改，其他 skill 不得读取或写入。

### Step 11：通知兄弟提交

代码审核修复完成，飞书通知（≤10字）+ 桌面消息，等兄弟说「提交」或继续后续步骤。

```

### opencode-schedule

```markdown
---
name: "opencode-schedule"
description: "OpenCode 调度方式：写 .opencode-brief.md → type pipe → opencode run --attach --no-replay"
---

# opencode-schedule — OpenCode 调度协议

> 所有调度 OpenCode 的 skill 统一引用本协议。
> 不可单独使用，只能被 gts-dev-workflow / gts-dev-fix / gts-dev-feat / gts-dev-refactor / gts-code-review / gts-analysis 等 skill 引用。

## 调度方式（标准模板）

### 1️⃣ 写 brief 文件

```markdown
**文件路径：** `<projectDir>/.opencode-brief.md`
**内容要求：**
- 自动在开头注入 `笔记/项目文档/project-context.md` 的内容（bot 拼接，OpenCode 不自己读）
- 包含方案内容（如有）
- 包含 Delta Specs（如有）
- 包含 TDD 模板（先写测试、再实现）
- 包含集成测试纪律（🔴🔴🔴 先让测试因 bug 真实失败，禁止 mock 函数替代）
- 末尾写「不需要代码审核，代码审核是单独步骤」
```

### 2️⃣ 调度命令

```powershell
# 简单修复 / 常规功能 / 重构 / Verify — Flash
exec(
  command="cd <projectDir> && type .opencode-brief.md | opencode run -m opencode-go/deepseek-v4-flash --dir . --attach http://localhost:4096 --no-replay",
  background=true,
  timeout=0
)

# 方案 / 架构 / 复杂bug根因分析 — Pro + max
exec(
  command="cd <projectDir> && type .opencode-brief.md | opencode run -m opencode-go/deepseek-v4-pro --variant max --dir . --attach http://localhost:4096 --no-replay",
  background=true,
  timeout=0
)

# 纯方案（plan agent，禁止改代码）
exec(
  command="cd <projectDir> && type .opencode-brief.md | opencode run --agent plan -m opencode-go/deepseek-v4-pro --variant max --dir . --attach http://localhost:4096 --no-replay",
  background=true,
  timeout=0
)
```

### 3️⃣ 参数说明

| 参数 | 说明 |
|------|------|
| `type .opencode-brief.md \|` | stdin pipe 传入 brief（PS 不支持 `<` 重定向） |
| `-m opencode-go/deepseek-v4-*` | 模型名必须带 provider 前缀 `opencode-go/` |
| `--variant max` | Pro 专用，最大 reasoning |
| `--agent plan` | Pro 专用，plan agent 模式（物理禁止改代码） |
| `--dir .` | 工作目录 |
| `--attach http://localhost:4096` | 连接到已有 web UI 查看进度 |
| `--no-replay` | 不需要回放 |

### 🔴🔴🔴 4️⃣ poll 步骤（同一回合内连续 poll，不 yield，不等兄弟消息）

**调度 OpenCode 后，第一件事是立即开始 poll 循环**，不是等兄弟发消息再看。

**核心原则：不 yield 等兄弟消息。在同一回合内连续 poll，直到完成或达到工具调用上限。**

```text
Step 1: dispatch OpenCode (background=true)

Step 2: process(action=list) 确认启动，拿到 sessionId
        → 找到 "gentle-haven"，状态为 "running"

Step 3: 同一回合内连续 poll 循环:
        pollCount = 0
        WHILE pollCount < 40:
            process(action=poll, sessionId=gentle-haven, timeout=30000)
            → 等 30 秒
            → 如果 completed：break，进 Step 4
            → 如果仍 running：
                pollCount += 1
                每 10 次输出一次进度
                （如「OpenCode 还在跑，已等 X 分钟」）
                → 继续下一轮 poll（不 yield，不等用户消息）

        IF pollCount >= 40 仍未完成（超过 20 分钟）:
            输出「任务超过 20 分钟，设置 cron 继续监控」
            → 设置 cron job 每 30s 自动醒来检查
            → YIELD 结束当前回合
            后续由 cron 自动唤醒，不再等兄弟消息

Step 4: 任务完成 → 拉完整日志
        process(action=log, sessionId=<sessionId>)

Step 5: 分析结果 → 汇报给兄弟
        （按 MEMORY.md → 先汇报再继续 规则）
```

**关键规则：**
- **不 yield，不依赖兄弟消息作为触发条件** — 同一回合内连续 poll
- 单次 poll 等 30 秒，OpenCode 有输出时可能提前返回（不用等满 30s）
- 每 10 轮输出一次进度文本，避免 silent tool loop
- 40 轮 = 20 分钟上限（保守值）。超过后退化为 cron+yield 兜底
- 大部分 OpenCode 任务（修复/审核）在 3-15 分钟内完成
- 每次 poll 约消耗 ~200 tokens，40 轮 = ~8k tokens，在 1M 上下文中可控
- **禁止先告诉兄弟「去看 web UI」再 poll** — dispatch 后就静默 poll，不出声
- 完成后再主动汇报结果，不需要用户来问进度

> 只有耗时超过 20 分钟的任务才用 cron+yield 兜底。绝大部分任务在这个时间前完成。

**对照 MEMORY.md 的 token 优化规则：**
- `tool-loop-yield`：单回合 >30 轮 tool call 时主动输出进度。这里每 10 轮输出一次，符合规则
- `spawn-subagent`：超过 20 分钟的复杂任务可以考虑 spawn 子 session 独立监控

### 5️⃣ 硬性规则

- **🔴🔴🔴 调度 OpenCode 时禁止自己改代码/停 OpenCode**
  - **不能自己改代码** — 调度了 OpenCode 就让它改，我不碰
  - **不能擅自停 OpenCode** — 我根本停不了 OpenCode（杀进程/重启服务都没用）
  - **后果：** 旧 OpenCode 还在跑 → 下次调度时两个 OpenCode 抢文件 → 冲突爆炸 → 兄弟发现
  - **正确做法：** dispatch → poll 等完成 → 出结果汇报。旧进程的 uncommitted 改动不影响新调度
- **🔴 统一用 `exec(background=true) + stdin pipe`**，禁止 sessions_spawn
- **🔴 先写 `.opencode-brief.md`**，再用 `type` 管道传
- **🔴 遇代码修改必须调度 OpenCode** — 不改代码自己手写
- **🔴 `timeout=0` 不限时** — OpenCode 做复杂改动跑 15-30 分钟很正常
- **🔴 优先选 Flash** — 只有复杂逻辑/架构/审核才用 Pro
- **🔴 brief 末尾必须写「不需要代码审核，代码审核是单独步骤」**
- **🔴 禁止让 OpenCode 做 E2E 相关工作**（重启服务、启动脚本、截图、抓日志）
- **🔴 不擅自判断 OpenCode 卡住** — poll 没输出 ≠ 卡住，至少等 1 小时
- **🔴🔴🔴 dispatch后必须立即开始 poll** — 不是先告诉兄弟去看 web UI。先 poll 拿到 sessionId 再说话。违反后果：兄弟需要连催 3 次
- **🔴 [兄弟指令完整传达] OpenCode brief 不能挑重点、不能合并概括、不能省略任何条目**
- **🔴🔴🔴 [根因分析交给 OpenCode Pro] — 不自己分析根因**
  - 遇到 bug 需要分析根因时，只做数据收集，不 trace 代码路径分析根因
  - 数据收集包括：服务端日志、E2E 运行日志、关键代码路径文件列表、问题现象描述
  - 数据收集完 → 写 brief → 调度 OpenCode Pro（plan agent）分析根因
  - 违反后果：自己分析了一堆却分析错方向，兄弟还要纠正
- **🔴 brief 必须包含 specs + TDD 模板** — 参照 gts-dev-workflow 的 brief 模板
- **🔴 模型选择：兄弟指定模型时按兄弟说的执行，不判断**

### 6️⃣ 模型选择速查

| 任务类型 | 模型 | 额外参数 |
|----------|------|---------|
| 简单修复 / 常规实现 / 重构 | Flash | 无 |
| Verify（场景覆盖检查） | Flash | 无 |
| 代码审核 | Pro + max | `--variant max` |
| 方案 / 架构设计 | Pro + max, plan agent | `--agent plan --variant max` |
| 复杂bug根因分析 | Pro + max | `--variant max` |
| 兄弟指定模型 | 按兄弟说的 | 不判断 |

```

