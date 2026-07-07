# Vibe Coding 多人游戏（二十六）—— Token 优化全攻略

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

月费从 2000 元降到不到 100 元——这不是靠砍用量，而是靠优化 token 消耗结构。

---

## 模型分层

最核心的策略：**把任务按复杂度分层，用不同的模型处理。**

| 任务 | 模型 | Context | 费用 |
|------|------|---------|------|
| 调度、编排、写 Brief | 免费模型 | 200k | 0 元 |
| 核心代码生成、重构 | 付费模型 | 1M | ~0.15 元/次 |
| 测试、lint、小修小改 | 免费模型 | 200k | 0 元 |
| 代码审核 | 付费模型（按次） | 1M | ~0.3 元/次 |

大部分请求（调度、测试、日常维护）只需要免费模型。只有核心逻辑改动才用付费模型。

---

## Brief 引用 agent-context.md

**不要逐条贴规则。** 共享规约（编码红线、测试命令、BDD 规范）统一引用 `agent-context.md`，每条节约 ~600 tokens。

```
❌ 在 Brief 里逐条列：
  - 改 .ts 再 tsc
  - 不改 .js
  - 不改 node_modules
  - ...

✅ 在 Brief 里引用：
  编码规则详见 agent-context.md
```

---

## OpenCode 的 contextWindow

OpenCode 本身支持 context window 配置。付费模型设置 1M，免费模型保持 200k：

```yaml
# opencode.yml
models:
  deepseek-v4-flash:
    contextWindow: 1000000  # 付费
  deepseek-v4-flash-free:
    contextWindow: 200000    # 免费
```

---

## compaction 阈值

OpenClaw 的 compaction（上下文压缩）阈值设为 200k 的 85%（170k）。之前 70%（140k）太激进，对话经常被压缩丢失上下文。

```yaml
# gateway config
reserveTokens: 30000   # 200k - 30k = 170k 触发 compaction
```

---

## Sub-agent 隔离

大任务（跨文件重构、大规模代码阅读）用 sessions_spawn 拆成子 session。子 session 独立上下文，爆了不影响主 session。

返回格式约束：摘要（2-3 行）+ 文件列表 + 测试结果摘要。

---

## Tool Loop 主动 yield

单回合 tool call 超过 20-30 轮时，主动输出进度文本结束当前回合，让下一个回合 compaction 压缩上下文。

避免 118 轮 tool call 不 yield → context overflow 炸 session。

---

下期讲 **P27：记忆管理体系**——33 个锚点词怎么帮 AI 回忆项目细节。

**下一篇：[Vibe Coding 多人游戏（二十七）—— 记忆管理体系](https://www.cnblogs.com/chaogex/p/21195307)**
