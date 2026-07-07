# Vibe Coding 多人游戏（三十一）—— Loop Engineering：我们的实践与改进方向

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

2026 年 6 月，Anthropic Claude Code 负责人 Boris Cherny 说了一句话——"我已经不给 Claude 写 prompt 了。我有一堆循环在跑，它们去给 Claude 写 prompt、自己琢磨该干什么。我的工作就是写循环。"

7 月，我在知乎读到 茜布 的《AI Coding 正在重新发明 Kubernetes：从 Loop Engineering 到下一代软件工程》，一口气读完，脑子里不断冒出同一个词：**这不就是我们一直在做的事吗？**

从 P12（AI 辅助到全自动）到 P13（Skill 固化 + 调度层）到 P14（E2E 自测）到 P15（完整工作流），从 P17（编码规则体系）到 P21（测试策略）到 P22（Token 优化）到 P23（记忆管理）到 P24（Agent Brief 规范）——我们一直在往同一个方向迭代，只是没有一个统一的框架来描述它。

那篇文章给了我这个框架：**Loop Engineering**。

所以这篇不做新话题，而是用这面镜子照一下我们的项目——看我们走到哪了、差距在哪、下一步该怎么走。

---

## 一、我们的 Loop 长什么样

茜布在文章里总结了 Loop Engineering 的五块积木：**Automations、Worktrees、Skills、Plugins/MCP、Sub-agents**，再加一层 **Memory**。

把我们的实践逐个映射过去：

### Automations（自动触发）—— 我们有

- **cron 定时器**：后台任务超 20 分钟后用 cron 自动唤醒继续 poll
- **webhook + 通知**：GTS-Play SCF 部署完成自动通知
- **心跳机制**：AGENTS.md 定义的心跳协议，定时检查后台任务状态
- **Skill 触发词匹配**：兄弟说「修复」「保存」「部署」自动匹配对应 Skill 并启动流程

### Worktrees（Git 工作树）—— ❌ 没有

我们目前没有用 git worktree。并行子 Agent（比如同时做 bug fix 和 feature dev）都工作在同一个工作目录下，文件冲突风险是真实存在的。

**对应文章里说的**：K8s 社区很早就知道并发 controller 会互相踩踏——多个 controller 同时修改同一个资源会导致 reconcile storm。而我们正在手动管理这种风险。

### Skills（SKILL.md）—— ✅ 强项

这是我们最成熟的维度。目前 16 个 gts-\* skill：

| Skill | 对应 Loop 概念 |
|-------|---------------|
| gts-dev-fix / gts-dev-feat / gts-dev-refactor | 核心迭代循环（maker） |
| gts-acceptance | 验收循环（checker） |
| gts-code-review | 审核循环（reviewer） |
| gts-e2e-test / gts-e2e-auto | E2E 验证循环 |
| gts-deploy | 部署循环 |
| gts-save-flow / gts-save-memory / gts-submit-save | 状态持久化循环 |
| gts-service | 服务管理循环 |
| gts-git-commit / gts-git-pull | 版本同步循环 |

茜布说的没错——Skill 的本质就是把人类的 prompt 技巧固化进系统，让每轮循环都能读到项目知识和编码规范。这正是 P13 的核心收获。

### Plugins / MCP（连接器）—— 部分有

- **SCF 部署脚本**：`deploy-scf.js` 自动上传 ZIP 到腾讯云
- **飞书通知** + **ClickClack**：双通道反馈
- **msg \* 桌面通知**：等确认时必须通知
- **ImageMagick**：截图压缩

但缺少 **Issue System 集成**、**CI/CD 管线自动触发**（目前是手动部署）。

### Sub-agents（子 Agent）—— ✅ 有，但待进化

- **sessions_spawn**：拆独立子 session 做批量代码阅读/复杂多步操作
- **OpenCode 调度**：OpenClaw 是调度层，OpenCode 是执行层
- **三层架构**：兄弟（决策者）→ OpenClaw（调度/管理）→ OpenCode（编码/执行）

但我们的 Maker 和 Checker **用的是同一模型**（deepseek-v4-flash），文章特别强调的 **"独立模型做 checker"** 我们没有做到。

### Memory / State（记忆）—— ✅ 强项

- MEMORY.md + memory/*.md：索引 + 详细内容
- QMD 5 collections + 33 锚点词
- 笔记/项目文档/ + 笔记/daily/
- `.last-save` / `.last-review` 文件
- 状态外置纪律：不信任对话历史，信任仓库

茜布文章里说的 "Agent 会忘，仓库不会忘"——我们用 K8s 式的 level-triggered reconcile 理念做了这件事。

---

## 二、Maker/Checker 分离：我们有，但不够深

文章指出一个关键设计：**写代码的 Agent 和判断'是否完成'的 Agent 必须是不同的模型。**

核心原因：模型给自己打分太宽容。Claude 说"任务完成"不等于真的完成了。

### 我们的现状

```
Maker（OpenCode 写代码）
    ↓
Checker（测试套件 → 编译 → 测试运行）
    ↓
Reviewer（gts-code-review → 代码审核）
    ↓
Human（兄弟确认）
```

分层是对的。但问题在于：

1. **Maker 和 Checker 同模型**：OpenCode 用 DeepSeek Flash 写代码，测试也是同样的模型写的和跑的。这意味着"测自己写的代码，给自己打分"。
2. **Checker 只有测试这一层**：缺少文章说的多层 Evaluation——性能基准、安全扫描、架构检查。
3. **Reviewer 需要更强的模型**：目前代码审核用同一模型，文章建议的"给 checker 换一个比 maker 更强的模型"在我们这还没做。

**文章里的一个观点我特别认同**：Maker-Checker 本质上是 **Admission Controller**——不要相信执行器。K8s 有 Validating Webhook，我们有代码审核流程。但 K8s 的 webhook 是独立进程，而我们的是同模型自判。

---

## 三、Goal & Evaluation：我们最大的差距

茜布文章的第三层洞察让我反复回看——也是我觉得最有价值的部分：

> Loop Engineering 的本质不是设计 Loop，而是设计 Goal 和 Evaluation。
> 
> Agent Capability = Model × Context × Loop × **Evaluation**
> 
> 真正的天花板不在 Loop，在 Evaluation。

### 我们的 Goal 定义

目前的 brief 是自然语言写的：

```
修复场景重入后 HUD 不显示
```

这种目标只有"改好才算好"——而什么叫"好"？没有精确定义。

对比 K8s 的 `replicas: 3`——完成没有歧义：`actual_replicas == 3`，结束。我们的"修复 HUD"没有这种判断标准。

### 我们的 Evaluation

目前只有测试套件这一层硬门槛：

- ✅ 单元测试（纯函数）
- ✅ 集成测试（BDD Cucumber）
- ✅ E2E 测试（手动辅助）

缺少：

- ❌ 性能基准（latency_p99 / FPS / 内存）
- ❌ 安全扫描
- ❌ 静态分析规则检查
- ❌ 架构约束验证（有没有绕过开闭原则？有没有在 UI 层引用逻辑层？）

**最关键的**：我们没有 Termination Condition——循环什么时候停？"测试通过"可以，但谁知道测试覆盖了所有场景？

文章里提到一种典型的 Agent 死法：

> 要么修好了继续修，最后修坏了；要么根本没修好，却说完成了。

我们遇到过这个问题。P14 里那个三天才修好的 bug，原因之一就是 Agent 经常"宣称完成"但实际没修对。

---

## 四、五个关键差异对照

茜布在文章里列举了 Loop Engineering 和 K8s Operator 的五组差异，我拿我们的项目逐一对照：

### 差异一：执行器确定性 vs 随机性 ✅ 有意识到

LLM 非幂等给了我们一个血淋淋的教训：同样一句话让 AI 修复 bug，今天和明天可能给出完全不同的方案。P14 的根因分析里多次提到这个问题。

文章中说的 **"不信任易失的对话历史，只信任可重新观测的持久状态"** ——我们已经在实践了，MEMORY.md 和笔记系统就是这个工程的体现。

### 差异二：收敛保证 🔴 无保证

K8s controller 可以证明收敛，我们的验收循环不行。Maker-Checker 同模型 + Evaluation 单层 = 收敛完全凭运气。

### 差异三：完成判定不可机器判定 🔴 核心痛点

K8s 的 desired state 是精确 spec，diff 几乎零成本。我们的"完成"判断要靠：
- 测试通过（但可能覆盖不全）
- 人工确认（瓶颈）

文章里说了一个哲学问题：**谁来监督监督者？** 我们的答案目前是"兄弟监督"——Human in Loop。但这不是工程方案，这是人力兜底。

### 差异四：动作空间无界 ⚠️ 已意识到

文章说"一个跑飞的编码循环可能把你的代码库、甚至生产环境推下悬崖"。我们在规则里有限制——"改 .ts 再 tsc，不改 .js"、"不改 node_modules"——但这只是文件级别的约束，不是架构级的约束。

**重构标准（P18）中的 🐛🔴🟡🟢 分层本质上就是在做这个事**：让动作空间分层化，高风险的必须经过更多检查点。但够不够？不够。因为 AI 可以写一个"测试全通过但架构崩了"的代码——我们已经遇到过。

### 差异五：人在环 ⚠️ 中间态

文章说 K8s Operator 一旦被信任就全自主运行，AI Coding 还做不到。我们目前是：

```
小型修复 → 全自动（不需要兄弟确认）
中型改动 → 自动运行 + 兄弟最终确认
大型重构 → 兄弟全程在环
```

这和文章说的"还没挣到自主权的 Operator 模式"一致。

---

## 五、改进方向

基于上面的差距分析，下面是我打算逐步推进的改进方向，按优先级排列：

### 短期（现在就能做）

**1. Goal 加量化指标**

Brief 里不再只写自然语言目标，加一层可校验的完成标准：

```
目标：修复场景重入后 HUD 不显示

完成标准：
- 测试通过率：100%（单元 + 集成）
- 无新增 lint error
- 场景重入 3 次后 HUD 仍然显示
- 性能不退步（FPS 不低于当前基准）
```

这不复杂，在 brief 模板里加一个 `## 完成标准` 段落就行。

**2. 独立 Checker 模型**

验收流程中，test/check 环节切换到更强模型。不需要全局改，只要在 gts-acceptance 的 checker 步骤里指定模型切换。

**3. 明确的 Termination Condition**

验收循环加上：
- `max_iterations: 10`（超过 10 轮没通过 → 挂起等人处理）
- 三态结果：`通过` / `失败` / `超时`
- 失败后指数退避，避免空转

### 中期（1-2 周）

**4. Evaluation 扩充**

在测试基础上加：
- 性能基准步（每次修改后跑性能快照，diff 太大直接标记 regression）
- 架构规则检查（用自动化脚本验证分层约束：UI 层不得 import 逻辑层等）
- 静态分析增强（TypeScript 严格模式检查 + dead code 检测）

**5. Worktree 隔离**

并行子 Agent 用 `git worktree add` 创建独立工作空间。互不踩踏。

### 长期

**6. Goal Engineering 化**

这是最远但也最有价值的方向。把 goal 写成可机器校验的 spec：

```yaml
goal:
  description: "修复支付系统的并发问题"
  metrics:
    correctness:
      unit_test_pass_rate: "100%"
      integration_test_pass_rate: "100%"
    performance:
      latency_p99: "< 100ms"
      throughput: ">= 1000 tps"
    safety:
      critical_vulnerability: 0
      data_race: 0

evaluation:
  layers:
    - unit_test
    - integration_test
    - e2e_test
    - benchmark
    - static_analysis
    - security_scan
  judge:
    model: "independent-checker"
    threshold: "all_layers_pass"

loop:
  max_iterations: 20
  strategy: "exponential_backoff"
```

这看起来很遥远。但茜布文章说了一句话让我印象很深：**"如果你观察 Claude Code、Codex、OpenHands、OpenAI Agent SDK、Anthropic Harness、Trellis 这些项目，会发现行业已经在朝这个方向移动。"**

而我现在就在移动的路上。

---

## 六、一句话总结

拿茜布文章的四个层次对照我们的项目：

| 层次 | 理解 | 我们 |
|------|------|------|
| 第一层 | Loop ≈ Operator（结构相似） | ✅ 已有验收循环、开发循环、部署循环 |
| 第二层 | Agent ≈ Controller（实现相似） | ✅ 三层架构已成型 |
| 第三层 | Goal ≈ Spec, Evaluation ≈ Status（本质相似） | 🔴 最大差距，Goal 自然语言，Evaluation 单层 |
| 第四层 | AI Coding 不是自动化写代码，而是自动化逼近目标 | 🟡 有意识，但距离"可证明收敛"还差很远 |

**我们已经在 Loop Engineering 的路上了。** 只是一直没有一个框架来描述它。这篇文章让我看清了我们在哪、下一步该踩哪里——也让我确认了一件事：

AI Coding 的未来不是写更好的 Prompt，而是设计更好的 Loop。而我们正在设计的，是一个从"一个人 + AI 做多人游戏"进化到"一个人 + 一堆循环做多人游戏"的控制系统。

> *这篇文章中引用的观点出自 茜布 的《AI Coding 正在重新发明 Kubernetes：从 Loop Engineering 到下一代软件工程》，发布于知乎。如果你也在研究 Loop Engineering，强烈推荐原文。*

---

**系列上一篇 → [（三十）给下一个 Vibe Coder 的起步指南](...)**
