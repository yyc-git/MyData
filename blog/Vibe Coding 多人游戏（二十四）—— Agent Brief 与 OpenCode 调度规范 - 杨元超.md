# Vibe Coding 多人游戏（二十四）—— Agent Brief 与 OpenCode 调度规范

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

OpenCode 调度中最关键的环节是写 **Brief**——给 AI 的任务说明书。

Brief 写得好，AI 一次过，15 分钟搞定。Brief 写得差，AI 来回改 5 轮，一个小时还在原地打转——而且每次改完可能引入新 bug。

GTS-Play 的 Brief 模板和调度规范经历了大量迭代。我从"兄弟式随手写"进化到了"标准模板 + 引用规范 + 模型选择"的完整体系。

---

## Brief 标准模板

```
## 修复
- 现象（体验式反馈）：玩家退房后下一局进不去
- 根因分析：gameStop 未重置 isEnterGame 标志位
- 验收标准：退房后重新匹配能正常进入

## 格式要求
- 改 .ts 再 tsc，不改 .js
- 新增集成测试覆盖，禁 mock
- 编码规则详见 agent-context.md
```

模板的核心是：**现象用体验式反馈（"退房后进不去"），根因用技术分析（"未重置标志位"），验收用可验证的标准。**

我最早写 Brief 时是这样的：

```
修改 State.ts 的 dispose 函数，在最后加一行 
this.isEnterGame = false
```

这是一个典型的"技术 spec"式 Brief。AI 照做了，但第二天的测试发现 bug 还在——因为 `State.ts` 的 `dispose` 还忘了清 `gameStartStartedRef` 和 `gameOverTriggeredRef`。一个问题修了 3 次才真正解决。

换用"体验式反馈"后，Brief 变成了：

```
退房后重新匹配进不去游戏。服务端日志显示 "already in game"。
检查哪些标志位在退出时没重置，全部清掉。
```

结果 AI 排查了 `isEnterGame`、`gameStartStartedRef`、`gameOverTriggeredRef`、`isConnected` 四个标志位，一次性全修了。为什么？因为它理解了"退房后进不去"这个症状，自己去查调用链，发现了所有关联的状态。

---

## 体验式反馈 > 技术 spec

这是最重要的一条原则：给 AI 写"为什么"比写"怎么做"更有效。

```
❌ 技术 spec：
把 State.position.y 改为 State.position.y + 0.5

✅ 体验式反馈：
角色太矮了，看起来像陷在地里
```

我自己经历过后者效果惊人：AI 理解了"太矮了"，自己查了 `position`、`camera` 的 follow 逻辑，找到了真正的根因——不是 position 不够高，而是 camera 的 offset 在新场景中没有重置。如果我只给"y + 0.5"的 spec，AI 改了但看起来还是不对——因为 camera 的 offset 没同步调整。

另一个例子：

```
❌：在 MultiplayerHall.tsx 的 onEnterGame 回调中加一行
    setInGame(true)

✅：玩家点击"进入游戏"后页面一直显示"加载中..."，没有跳转到游戏场景
```

AI 收到第二个 Brief 后，排查了 `onEnterGame` → 发现 `sendFinished` 没有 await → Promise rejection 未处理 → 服务端收不到 Finished → `setInGame` 没被调用。一个完整的排查链路，而第一个 Brief 只让 AI 加了一行代码——根本没有解决真正的问题。

---

## 引用规范

```
agent-context.md：只引用路径，不逐条复制（省 ~600 tokens）
代码审核 brief：必须贴完整 🐛🔴🟡🟢 规则
Delta Specs：先确认再开工
```

一个常见的错误：把 `agent-context.md` 全文逐条贴进 Brief。每条规则 ~40 tokens，30 条就是 1200 tokens。对于一次简单的"修注释"任务，加载 1200 tokens 的规则完全是浪费。

引用有三档：
- **低复杂度任务**（修注释、改名、加测试）：只引用 `agent-context.md` 路径
- **中复杂度任务**（改一个函数、修一个 bug）：Brief 开头列出 3-5 条关键红线
- **高复杂度任务**（跨文件重构、架构调整）：除了 Brief，还要单独加载完整规则文件

代码审核的 Brief 比较特殊——必须贴完整的 🐛🔴🟡🟢 规则，因为审核项目很多，AI 需要每条确认。但如果每次审核都贴，token 消耗很大。后来优化成：审核 Brief 里只贴"比上次审核新增"的规则，旧规则引用路径。

---

## 模型选择速查

### 速查表

| 任务类型 | 模型 | 额外参数 | 原因 |
|---------|------|---------|------|
| 新功能开发 | Flash | default | 需要理解和生成大量代码 |
| Bug 修复 | Flash | default | 需要追踪调用链 |
| 重构 | Flash | default | 涉及多文件同步修改 |
| 方案设计 / 架构评估 | Pro | `--variant max` | 需要最大推理深度 |
| 复杂 bug 根因分析 | Pro | `--variant max` | 分析方向必须准确 |
| Code Review | Pro | `--variant max` | 需要评估架构影响 |
| Verify（场景覆盖检查） | Flash | default | 枚举型工作，不需要深度推理 |
| 测试编写（BDD） | Flash | default | 模式固定 |
| 小修小改 | Flash | default | 改动小，Context 够 |

关键区别：
- **Pro → 必加 `--variant max`**：Pro 模型默认不启用最大推理，不加 max 等于没用到 Pro 的深度分析能力
- **Flash → 用 default**：Flash 的 default 已经够用，不需要加 variant

### 实战案例对比

有一次 Bug 修复用了 Flash default——AI 确实修好了 bug，但修完之后又顺手改了 3 个不相关的文件（Flash default 200k context 不够，没读完所有文件就开工了，不知道哪些文件不该动）。从那以后，涉及多文件改动的任务一律用 Flash（1M context）。

相反，测试编写用 Flash default 完全没问题——BDD 测试的 pattern 非常固定，AI 不需要理解项目全局，只需要按 Feature 文件写步骤定义。

### 调度命令

上述速查表映射到实际的调度命令：

```powershell
# 简单修复 / 常规功能 / 重构 → Flash default
type .opencode-brief.md | opencode run -m opencode-go/deepseek-v4-flash --dir . --attach http://localhost:4096 --no-replay

# 方案 / 架构 / 复杂bug根因分析 → Pro + max
type .opencode-brief.md | opencode run -m opencode-go/deepseek-v4-pro --variant max --dir . --attach http://localhost:4096 --no-replay

# 纯方案（plan agent，物理禁止改代码）→ Pro + max, plan agent
type .opencode-brief.md | opencode run --agent plan -m opencode-go/deepseek-v4-pro --variant max --dir . --attach http://localhost:4096 --no-replay

# Verify / 测试编写 → Flash Free
type .opencode-brief.md | opencode run -m opencode-go/deepseek-v4-flash-free --dir . --attach http://localhost:4096 --no-replay
```

四个命令的差别只有一个地方：`-m` 后面的模型名和 `--variant` 参数。模型名必须带 provider 前缀 `opencode-go/`。

参数说明：

| 参数 | 说明 |
|------|------|
| `type .opencode-brief.md |` | stdin pipe 传入 brief |
| `-m opencode-go/deepseek-v4-*` | 模型名带 provider 前缀 |
| `--variant max` | Pro 专用，最大 reasoning |
| `--agent plan` | Pro 专用，plan agent 模式 |
| `--dir .` | 工作目录 |
| `--attach http://localhost:4096` | 连接 Web UI 查看进度 |
| `--no-replay` | 跳过历史回放 |

---

## 调度规范：入口检查协议

每次收到消息后，第一件事：检查后台任务是否完成。有已完成任务先汇报，再接新活。

这是最高频的违规项——但也是最容易记住的：**先查后做，先汇报再接。**

有一次，AI 正在做一个"修倒计时 bug"的任务，我同时发了一条"改一个 css 样式"的小需求。AI 直接中断了倒计时任务开始改 CSS——结果倒计时的修改变动丢失了，因为 context 被 CSS 任务覆盖了。

后来加入了入口检查协议：每次收到新任务，先检查是否有 running 的子 session 或后台进程。有的话，先汇报当前进度，再决定是等它完成还是切过去。

这条协议被编码进了 `gts-conversation-end` skill 的初始化流程——每次对话结束时，检查是否有未完成任务，如果有，记入 daily log 再清理。

---

## 调度系统的迭代

OpenCode 调度规范也不是一天形成的。我经历了三个阶段：

**阶段 1（手动调度）**：兄弟说"修这个 bug"→ 我手动把 Brief 写给 AI → AI 跑 → 我手动检查。效率低，一天最多处理 4-5 个任务。

**阶段 2（Skill 半自动调度）**：把常见任务写成 Skill（gts-dev-fix、gts-dev-feat 等），AI 自动选择 Skill 执行。效率提升，但偶尔选错 Skill。

**阶段 3（入口检查 + 模型选择 + 引用规范 的完整体系）**：AI 收到消息后先检查入口，再根据任务类型选择 Skill 和模型，最后按标准模板写 Brief。全自动调度，一天处理 15+ 个任务。

目前 GTS-Play 的调度系统在阶段 3 运行。每加入一个 Skill 或者优化一条规则，调度系统的决策质量就提升一点。对比阶段 1，现在的开发效率提升了 4-5 倍，而且出错率更低。

---

下期讲 **P25：部署与服务管理**——deploy-scf.js、双环境、日志抓取。

**下一篇：[Vibe Coding 多人游戏（二十五）—— 部署与服务管理](https://www.cnblogs.com/chaogex/p/21195307)**


---

## 附录：OpenCode 调度 Skill

调度规范最终固化成了一个可复用的 Skill。以下是完整内容（摘自 `opencode-schedule/SKILL.md`）：

### 调度流程

**Step 1：写 brief 文件** → `<projectDir>/.opencode-brief.md`
- 自动在开头注入 `project-context.md` 内容
- 包含方案内容（如有）
- 包含 Delta Specs（如有）
- 包含 TDD 模板（先写测试、再实现）
- 包含集成测试纪律（🔴🔴🔴 先让测试因 bug 真实失败，禁止 mock）
- 末尾写「不需要代码审核，代码审核是单独步骤」

**Step 2：调度命令**（按上述模型选择速查执行）

**Step 3：poll 循环** — dispatch 后立即在同一回合内连续 poll：

```
pollCount = 0
WHILE pollCount < 40:
    process(action=poll, sessionId=xxx, timeout=30000)
    等 30 秒
    如果 completed：break，进 Step 4
    如果仍 running：pollCount += 1

IF pollCount >= 40（超过 20 分钟）:
    设置 cron job 每 30s 自动醒来检查
    → YIELD 结束当前回合
```

**Step 4：任务完成** → 拉完整日志 → 分析结果 → 汇报

### 硬性规则

- 🔴🔴🔴 **禁止自己改代码** — 调度了 OpenCode 就让它改
- 🔴🔴🔴 **不擅自停 OpenCode** — 旧进程残留不影响新调度
- 🔴 **每个改动必须走 OpenCode** — 不改代码自己手写
- 🔴 **优先选 Flash** — 只有复杂逻辑/架构/审核才用 Pro
- 🔴 **brief 末尾写"不需要代码审核"**（审核是单独步骤）
- 🔴 **禁止让 OpenCode 做 E2E 相关工作**（重启服务、启动脚本、截图、抓日志）
- 🔴 **不擅自判断 OpenCode 卡住** — 至少等 1 小时
- 🔴 **dispatch 后必须立即 poll** — 不是先告诉兄弟去看 web UI
- 🔴 **兄弟指令完整传达** — Brief 不挑重点、不合并概括
- 🔴🔴🔴 **根因分析交给 OpenCode Pro** — 只做数据收集，不自己 trace 代码路径

### 模型选择速查（调度层）

| 任务类型 | 模型 | 额外参数 |
|----------|------|---------|
| 简单修复 / 常规实现 / 重构 | Flash | 无 |
| Verify（场景覆盖检查） | Flash | 无 |
| 代码审核 | Pro + max | `--variant max` |
| 方案 / 架构设计 | Pro + max, plan agent | `--agent plan --variant max` |
| 复杂 bug 根因分析 | Pro + max | `--variant max` |
| 兄弟指定模型 | 按兄弟说的 | 不判断 |

这个 Skill 被 GTS-Play 的多个工作流 Skill 引用：`gts-dev-workflow`、`gts-dev-fix`、`gts-dev-feat`、`gts-dev-refactor`、`gts-code-review`、`gts-analysis`。每个工作流 Skill 只需要在自己的 Brief 模板中引用本 Skill 的调度命令和硬性规则，不需要重复编写。

