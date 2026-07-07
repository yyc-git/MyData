# Vibe Coding 多人游戏（十三）—— OpenClaw 调度层 + Skill 固化 + 自动部署

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

上期讲到，OpenClaw 从全自动（自己做一切）切换到**调度 + OpenCode 编码**的分层模式后，token 消耗大幅下降。

但带来了新问题：**谁来管理流程？**

每次要让 OpenCode 写代码，需要：

1. 写清楚需求（Brief）
2. 启动 OpenCode 并加载项目上下文
3. 等待结果、检查编译
4. 跑测试、修复 bug
5. 循环直到通过
6. 提交代码、部署

这些步骤如果每一步都要手动做，那么分层省下的时间又浪费回去了。

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
AI 模型（GPT/Claude/DeepSeek）
```

| 角色 | 负责 | 用谁 |
|------|------|------|
| **你** | 定义"做什么" | 一句话描述 |
| **OpenClaw** | 调度、写 Brief、检查结果 | 免费 AI 模型（200k context） |
| **OpenCode** | 写代码、跑测试、修 bug | DeepSeek Flash Free（有免费额度，超了切 Flash，同一模型缓存不丢） |

你只需要说一句"修复退房后 isEnterGame 标志位未重置的 bug"，剩下的 OpenClaw 和 OpenCode 自己搞定。

---

## Skill：可执行的流程化知识

OpenClaw 里的 **Skill** 是核心创新——把流程写成可执行的文档。

比如 `gts-dev-fix` Skill（修复 Bug）：

```
1. 读取 issue 描述或用户提的 bug
2. 搜索相关代码
3. 写 OpenCode Brief：
   - 项目上下文
   - 编码红线（改 .ts 不碰 .js）
   - 测试要求（新增集成测试）
4. 调度 OpenCode 执行
5. 检查编译 → 有错循环修复
6. 运行测试 → 新增的失败 → 继续修
7. BDD 测试全部通过 → 完成
```

Skill 本质上是一个**可执行的 SOP**——AI 读它，AI 执行它。不需要人教。

我们一共写了 16 个 Skill，覆盖了从提交代码到部署上线的全过程：

| Skill 分组 | 包含 |
|-----------|------|
| 开发 | gts-dev-feat, gts-dev-fix, gts-dev-refactor |
| 测试 | gts-e2e-test, gts-e2e-auto, gts-e2e-perf |
| 部署 | gts-deploy, gts-service, gts-logs |
| 维护 | gts-save-flow, gts-save-memory, gts-git-commit |
| 管理 | gts-analysis, gts-code-review, gts-recall, gts-stop |

---

## 自动部署闭环

Skill 最后一步通常是部署：

```
AI 自动开发 → AI 自动验收 → AI 自动部署 → E2E 验证
```

具体 `gts-deploy` Skill 做的事情：

1. 运行 deploy-scf.js
2. 打包 → zip → 上传 SCF → 发布
3. BDD 测试验证（7 个场景覆盖）
4. 通过 → 通知"部署完成"
5. 失败 → 自动回滚，报告失败原因

全程不需要进 SCF 控制台。

---

## 三角色的关键：Brief

Brief 是 OpenClaw 和 OpenCode 之间的"契约"。一个好的 Brief 包含：

```
## 目标
修复游戏结束后 isEnterGame 标志位未重置的 bug

## 文件范围
- packages/room-service/src/models/Game.ts（dispose 逻辑）
- packages/room-service/src/state/State.ts（标志位定义）

## 测试验证
- 新增集成测试：验证退房后 isEnterGame 为 false
- 运行 BDD 测试确认

## 红线
- 改 .ts 再 tsc，不改 .js
- 不改单机代码
- 不引入新依赖
```

Brief 不用逐条手写——OpenClaw 从 Skill 模板 + 项目上下文自动生成，只需要确认一下。

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

---

Skill 流程自动化后，最缺的是**质量保障**。下一期讲 E2E 自测——怎么让 AI 自己测自己修的 bug。

**下一篇：[Vibe Coding 多人游戏（十四）—— E2E 自测与根因修复](https://www.cnblogs.com/chaogex/p/21195307)**
