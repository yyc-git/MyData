# Vibe Coding 多人游戏（二十二）—— Token 优化全攻略

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

月费从 3000 元降到几百元——这不是靠砍用量，而是靠优化 token 消耗结构和模型调用策略。

最开始用 AI 做开发时，我毫无节制：所有任务都扔给付费模型、所有上下文都完整粘贴、从来不清理历史对话。第一个月的 API 账单让我瞠目结舌——3000 元，对于一个个人项目来说不是小数目。

后来我花了两周时间系统地优化 token 消耗和模型调用策略，把月费压到了几百元——而且开发效率不降反升。这篇把核心策略全讲出来。

---

## 模型分层：Flash / Flash Free / Pro 调用策略

最核心的策略：**把任务按复杂度分层，用不同的模型处理。** 我们的模型体系有三个梯队：

| 梯队 | 模型标识 | Context | 费用 | 负责任务 |
|------|---------|---------|------|---------|
| 🟢 Free | flash-free | 200k | 0 元 | 调度编排、写 Brief、BDD 测试、跑 lint、小修小改 |
| 🟡 Flash | flash（付费） | 1M | ~0.15 元/次 | 核心代码生成、重构、Bug 修复 |
| 🔴 Pro | pro（付费） | 1M | ~0.3 元/次 | 代码审核、复杂分析、架构方案评估 |

大部分请求（调度、测试、日常维护）只需要免费模型。只有核心逻辑改动才用付费模型，而最为耗时的代码审核和架构分析由最贵的 Pro 集中处理。

**区分原则：** 如果 AI 需要理解整个项目的架构和调用链，用付费模型（Flash）；如果需要评估代码质量和潜在风险，用 Pro；如果只是执行固定模式（写测试、跑 lint、调度编排），免费模型就够了。

### 调用策略

**Flash Free（🟢）做 90% 的活。** 调度编排、检查后台任务、写 BDD 测试、跑 lint——这些都是固定模式的工作，不需要理解项目全貌。免费模型 200k 的 context 完全够用，且每个月贡献的 token 量最大但费用为零。

有一个印象很深的对比：曾经让付费模型去写 BDD 测试，一次写 6-8 个场景，AI 跑完后等了 10 分钟才完成——中间因为 context 过大还报错了。后来改让免费模型写测试，速度差不多（因为 BDD 测试本身就是简单模式匹配），费用直接降为零。

**Flash（🟡）做核心代码生成。** 重构、修复杂 bug、跨文件修改——这些任务需要理解项目结构、调用链、既有测试。付费模型给满 1M context，避免因为 truncation 遗漏关键信息。

有一次我用 200k 的 context 让付费模型写一个重构方案，它读了一半文件就截断了，结果方案里遗漏了对某个 Server.ts 函数的修改，部署后直接崩溃。从那以后，任何涉及跨文件理解的代码生成，我都用 1M context 的 Flash。

**Pro（🔴）做代码审核和复杂分析。** 代码审核需要对照整个代码修改 diff，评估架构影响，识别潜在风险。Pro 模型在这种场景下比 Flash 明显更谨慎——它更善于发现隐藏问题，比如"这个改动看似安全但会影响另一个模块的初始化顺序"。

一个实际数据：有 7 次 Pro 审核发现了我没意识到的潜在问题，平均每月 2-3 次。按每次 ~0.3 元算，一个月不到 10 元——远比出生产事故便宜。

### 模型选择速查

把上面的规则浓缩成一张速查表，调度 OpenCode 时直接套用：

| 任务类型 | 模型 | 备注 |
|----------|------|------|
| 简单修复、常规实现、重构 | Flash | 默认选，不纠结 |
| Verify（场景覆盖检查） | Flash | 枚举型工作，不需要深度推理 |
| 方案设计、架构评估 | Pro + max | `--variant max` 最大 reasoning |
| 复杂 bug 根因分析 | Pro + max | 必须 Pro，Flash 分析方向经常偏 |
| 代码审核 | Pro + max | 发现隐藏问题的关键环节 |
| BDD 测试编写 | Flash Free | 模式匹配工作，给付费模型浪费 |
| 调度编排、通知 | Flash Free | 这些甚至不需要 OpenCode，我直接做 |

---

## Brief 引用 agent-context.md

**不要逐条贴规则。** 共享规约（编码红线、测试命令、BDD 规范、变更要求）统一引用 `agent-context.md`，每条节约 ~600 tokens。

```
❌ 在 Brief 里逐条列：
  - 改 .ts 再 tsc
  - 不改 .js
  - 不改 node_modules
  - 改 .res 再 rescript build
  - 改 .gen.tsx 必须同步改 .res
  - 改 dist 必须同步改 src
  - 单机/多人逻辑必须分开处理
  - 禁止 window 全局挂载
  - 发送绝对状态值，不发送变化量
  - ...

✅ 在 Brief 里引用：
  编码规则详见 agent-context.md
  关键红线：
  - 🔴 不改 node_modules
  - 🔴 改 .ts 再 tsc
  - 🔴 不改 packages/scene3d_layer/ 下的单机代码（开闭原则）
```

选 3 条最关键的放 Brief 开头，其他的只引用路径。这样做的好处不只是省 token——当 agent-context.md 更新时，你不需要改任何 Brief。

我估算过每条规则大约 40 tokens，30 条规则是 1200 tokens。假设一天调度层发出 20 个任务（含编排请求），一个月就是 720,000 tokens。如果全用付费模型，每月约 7-10 元。看似不多，但加上其他优化，累积效应很明显。

---

## OpenCode 调度优化

OpenCode 本身提供了一些关键的 token 控制参数，用对它们能让上下文消耗减半。

### --no-replay：跳过回放

`--no-replay` 告诉 OpenCode 不需要把之前的对话回放给模型。如果不加这个参数，OpenCode 默认会加载完整的历史对话——一个修 bug 的 session 可能积累了 80 轮对话历史，全回放给模型，十万 tokens 就没了。

加上 `--no-replay` 后，OpenCode 只传递当前任务上下文（brief + 必要文件），历史对话不传。80 轮 → 1 轮，省掉的 tokens 不是线性的是指数级的——因为回放内容会被模型重新处理。

### --attach：只传必要文件

`--attach` 指定 OpenCode 连接到已有的 Web UI 查看进度，但更重要的是——它配合 `--dir .` 让 OpenCode 只读当前工作目录下的必要文件，而不是扫描整个项目树。

```powershell
type .opencode-brief.md | opencode run -m opencode-go/deepseek-v4-flash --dir . --attach http://localhost:4096 --no-replay
```

这条命令的 token 开销构成：
- brief 文件：~500-1500 tokens
- model 上下文初始化：~200 tokens
- OpenCode 框架开销：~500 tokens
- **总计：~1200-2200 tokens**

对比不加这些优化时的开销：
- 完整项目扫描：~10000+ tokens
- 历史对话回放：~100000+ tokens（80 轮对话）
- OpenCode 框架默认加载：~3000+ tokens
- **总计：~113000+ tokens**

差了两个数量级。

### stdin pipe + .opencode-brief.md

我用的是 `type .opencode-brief.md | opencode run ...` 模式——先写一个独立的 brief 文件，然后用管道传进去。不是让 OpenCode 自己去读某个目录。

这样做的好处：**我的对话上下文和 OpenCode 的上下文是隔离的。** 我和兄弟的讨论（几百轮对话）不会污染 OpenCode 的 context。OpenCode 只看到那几百字的 brief，干净、专注。

---

## 记忆锚点系统

MEMORY.md 是 token 优化的另一个关键——它让 AI 不用每次重新理解项目。

最初我把所有内容都塞进 MEMORY.md：耗时的踩坑、过期的配置、临时的想法。结果 AI 每次加载记忆都要花 3000+ tokens，而且大部分是不相关的内容。

后来我归纳了 33 个核心锚点词，每个词指向不同文件：

| 类别 | 关键词 | 查找位置 |
|------|--------|---------|
| 人格 | SOUL, 风格, 原则 | SOUL.md |
| 执行规则 | 路径, 端口, 命令 | TOOLS.md |
| 项目详情 | GTS-Play, SCF, RoomConfig | 笔记/项目文档/ |
| 历史教训 | 踩坑, 清理, 残留 | MEMORY-ARCHIVE.md（CLI 搜索） |

MEMORY.md 本身只保留索引级信息，正文通过关键词触发 CLI 搜索。每次加载记忆的 token 从 3000+ 降到了 ~300 tokens——不再是完整文件加载，而是按需加载。

**禁用了内置 memory_search 工具**，统一用 CLI：`openclaw memory search "<关键词>" --max-results 3 --json`。原因：内置工具的搜索结果质量不稳定，命令行版本更精确、可控。

### 分层读取入口

最终形成的分层结构：

| 层 | 文件 | 内容 | Token |
|----|------|------|-------|
| 索引层 | MEMORY.md | 33 个锚点词 + 硬性工作协议 | ~300 |
| 配置层 | TOOLS.md | 路径、端口、命令等执行规则 | ~200 |
| 解析层 | SOUL.md | 人格身份 | ~100 |
| 详情层 | MEMORY-ARCHIVE.md | 历史教训、重要决策 | 按需搜索，不预加载 |
| 日志层 | HEARTBEAT.md | 运行时状态、上次保存 | ~50 |

模型每天启动时先读索引层（300 tokens），需要细节时才触发搜索（平均 ~150 tokens/次）。之前是直接完整加载所有记忆文件（~5000 tokens），优化后每天节省 ~4500 tokens 的固定开销。

---

## 记忆分层：MEMORY / MEMORY-ARCHIVE / HEARTBEAT

在三层记忆体系里（详见 P23 记忆管理），每一层都有具体的 token 优化策略：


### QMD（Query Markdown）索引系统

QMD 是支撑 CLI 搜索的底层引擎。当记忆写入 `memory/*.md` 或 `笔记/` 时，QMD 自动建立三层索引：

| 层级 | 匹配范围 | Token 消耗 |
|------|---------|-----------|
| 标题索引 | 文档标题、H1-H6 | ~20 tokens/次 |
| 关键词索引 | 锚点词、代码标识符 | ~50 tokens/次 |
| 全文索引 | 所有正文 | ~200 tokens/次 |

搜索按"标题 → 关键词 → 全文"三级优先级匹配，95% 的请求在前两步完成，不需要触发全文扫描。这套机制让记忆搜索的 token 消耗从 5000+ 降到了 300-500 tokens/次。详见 P23。

### MEMORY.md（核心索引）
- 只保留索引级信息 + 硬性规则
- 不再重复贴项目配置、端口、路径等细节（放 TOOLS.md）
- 对历史教训只保留关键词触发词，正文走 CLI 搜索

### MEMORY-ARCHIVE.md（历史教训）
- 用 🔴🔴🔴 标记最关键的教训，优先搜索
- 定期清理过期的教训（比如已修复再也不会发生的环境问题）

### HEARTBEAT.md（运行时状态）
- 只记录最近一次保存
- 不写重复的日常状态（比如"服务正在运行"这种每轮对话都变的信息）

---

## OpenCode contextWindow

OpenCode 本身支持 context window 配置。付费模型设置 1M，免费模型保持 200k：

```yaml
# opencode.yml
models:
  deepseek-v4-flash:
    contextWindow: 1000000  # 付费
  deepseek-v4-flash-free:
    contextWindow: 200000    # 免费
  deepseek-v4-pro:
    contextWindow: 1000000   # 代码审核
```

为什么付费模型给 1M？因为核心代码生成需要理解大量上下文（项目结构、调用链、既有测试）。如果 context window 太小，AI 会遗漏关键信息。

一个惨痛案例：我曾经用 200k 的 context 让 Flash 修一个跨文件 bug，结果它只读了前 150k 就截断了——正好跳过了 Player.ts 里最关键的 gameState 监听逻辑。修出来的方案只解决了表象，没解决根因。换 1M context 后，AI 读完了所有相关文件，一次性找到了根因。

---

## Compaction 阈值

OpenClaw 的 compaction（上下文压缩）阈值设为 200k 的 85%（170k）。之前 70%（140k）太激进，对话经常被压缩丢失上下文。

```yaml
# gateway config
reserveTokens: 30000   # 200k - 30k = 170k 触发 compaction
```

compaction 阈值直接影响对话质量。设得太低（比如 140k），对话到一半时上下文突然被压缩，AI 会忘记前面的讨论内容——"刚才我们分析的 Bug 根因是什么来着？" 设得太高，context 快满了才触发压缩，对话体验流畅但 token 消耗大。

85% 是一个非常平衡的点——对话过程中感觉不到压缩，但 token 消耗控制在合理范围。

---

## Sub-agent 隔离

大任务（跨文件重构、大规模代码阅读）用 sessions_spawn 拆成子 session。子 session 独立上下文，爆了不影响主 session。

一次"跨文件重构 + BDD 测试 + 编译"的大任务，如果全在主 session 里跑，对话轮次超过 60 轮，context 突破 800k——即使付费模型也扛不住。

拆成子 session 后，主 session 只需要几千 token（调度指令），子 session 各自处理自己的部分。最关键的是子 session 的返回格式约束：

```
返回格式约束：摘要（2-3 行）+ 文件列表 + 测试结果摘要
```

不要子 session 返回 1000 行代码原文——父 session 的 context 会再次炸掉。只返回"发生了什么 + 改了哪些文件 + 测试是否通过"。

实际数据对比：

| 方式 | 主 session tokens | 子 session tokens | 总 tokens |
|------|------------------|-------------------|-----------|
| 不拆分 | 800k | — | 800k |
| 拆分子 session | 3k（调度） | 150k（阅读）+ 200k（重构） | 353k |
| 节省 | | | **56%** |

---

## Tool Loop 主动 yield

单回合 tool call 超过 20-30 轮时，主动输出进度文本结束当前回合，让下一个回合 compaction 压缩上下文。

有一个惨痛教训：AI 一次修 bug，在单回合里连续做了 118 轮 tool call（读文件、改代码、跑测试、再读、再改……）。最终 context overflow，整个 session 炸了，前面的所有工作全部丢失。那次我损失了大约 2 个小时的工作成果。

解决方案很朴素：Tool Loop 达到 20-30 轮时，AI 输出"正在修复 XX 功能，已完成文件 A 和 B 的修改，剩余 C 和 D"，主动结束当前回合。这样 compaction 可以压缩上一个回合的上下文，释放 context 空间。

100 多轮拆成 4-5 个回合，每个回合 20-30 轮，context 始终在可控范围。

compaction 只在回合间运行——tool loop 中间不触发。所以如果一直不 yield，compaction 永远不跑，context 只会单向增长直到溢出。

---

## 工具调用优化

**三步法：Select-String → read → edit。** 查找代码时不先读整个文件，而是先用 Select-String 搜索关键词定位行号，再用 read 读精确行，最后 edit 修改。三步加起来 ~50 tokens，比读整个文件（~2000 tokens）省 40 倍。

**搜索合并：多个 pattern 一次搜完。** 如果同时要找多个关键词，一次性搜完而不是分开搜。分开搜意味着每次搜索都要读一遍文件系统缓存——虽然文件系统 I/O 本身不消耗 token，但每次搜索结果的上下文处理和展示会叠加。一次搜 5 个 pattern 和分 5 次搜 1 个 pattern，后者 token 消耗是前者的 3-5 倍。

**减少 exec 非必要命令：用 process(log) 代替 exec。** 查看进程日志时，用 process(action=log) 而不是 exec(cat logfile)。因为 log 返回的是结构化文本，exec 返回的是完整的 shell 输出（包含不必要的转义、编码信息、环境变量等）。

**改 .ts 再 tsc，不改 .js：** AI 改源文件（.ts），不改编译产物（.js）。因为 tsc 只编译改动的部分。如果 AI 直接改 .js，tsc 不知道有改动，不重新生成——最终部署用的还是旧代码，token 全白花了。

---

## 截图 Token 优化

AI 分析截图时，原始截图可能很大（1920x1080 PNG 动辄 2-3MB）。直接塞给视觉模型，token 消耗不说，经常因为尺寸超限被拒绝。

解决：先压缩再分析。

```bash
magick convert <input> -resize 800x -quality 70% jpg:<output>
```

1920x1080 PNG（2.5MB）→ 800x 压缩 JPG（~100KB），token 消耗降到原来的 1/20。而且视觉模型对这种分辨率的截图完全能识别关键 UI 元素。

流程图：复杂截图 → OpenCode K2.7 多模态先看 → 再走 Kimi K2.7 问具体问题。先问后图，节省 token。

---

## 后台任务兜底策略

后台任务（OpenCode / E2E / 部署）超过 20 分钟还没完，设置 cron job 每 30 秒唤醒继续 poll。为什么要这么做？

如果不设 cron 兜底，AI 只能一直 poll 到工具调用上限（~30 轮 = 15 分钟）。超过后 context 快满了还在 poll，浪费大量 token。设置 cron 后：

1. 第一轮 poll 15 分钟（30 轮 × 30 秒/轮），正常任务在这里就完成了
2. 超时 → 输出进度文本 → 设置 cron → yield 结束回合
3. cron 每 30 秒唤醒一次，进下一轮 poll
4. 每次唤醒只在 session 增加 ~300 tokens（硬性规则 + 唤醒消息）

对比不设 cron 的 case：AI 死磕 poll 直到 context overflow（800k+ tokens），session 炸掉，任务重来。

---

## 省钱不是最终目的

优化 token 消耗的目的不是"省钱"——几百元和 3000 元对个人项目来说虽然差很多，但这不是最重要的事。

**真正重要的是：token 优化 = 效率优化。**

当 context 不过载、compaction 不丢失信息、模型分配合适时，AI 的产出质量更高、速度更快、回归更少。token 优化本质上是对"AI 怎么思考"的理解——知道它在什么时候需要什么信息，知道什么该放、什么不该放。

用好每一分 token，AI 才能给你最好的答案。

---

下期讲 **P23：记忆管理体系**——33 个锚点词怎么帮 AI 回忆项目细节。

**下一篇：[Vibe Coding 多人游戏（二十三）—— 记忆管理体系](https://www.cnblogs.com/chaogex/p/21195307)**
