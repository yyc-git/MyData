# Vibe Coding 多人游戏（五）—— 实战总览：从 0 到 1 的时间线地图

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

> 从《Pieter Levels 一个人的游戏帝国》到《从 levelsio 到 GTS-Play》，前 4 篇从外部视角讲完了 Vibe Coding 多人游戏的案例、行业和方法论。从这一篇开始，我们进入 GTS-Play 的内部实战——一个真实项目的完整演进过程。
>
> **本文是这个系列的时间线地图。读完这篇，你就能知道后续每篇讲什么、值不值得看。**

## 一句话说清整个系列

**9 个阶段 × 6 步工作流进化 × 13 个知识主题 = 从 0 到 1 做一个 AI 驱动的多人游戏需要知道的一切。**

我用自己的项目 GTS-Play（巨大娘主题，单机产品「巨大娘的玩耍」已发布 v1.0，多人在线版基于 Three.js + React，Lerna monorepo）从单机改多人的真实经历，把每个决策、每次踩坑、每次重构都记下来。

---

## 时间线速览：9 个阶段

```
                        basic1                         new_basic2
                 帧同步（Lockstep）              切换到状态同步
                        ↓                              ↓
P6 ─── 帧同步方案详解 ──────→ P7 ─── 状态同步 + TSRPC ──────→ P8 ─── Monorepo ───→ P9 ─── 双服务架构
                                                                                        ↓
                                                                              P10 ─── Logic 共享层
                                                                                        ↓
                                                                              P11 ─── 服务端权威完整实现
                                                                                        ↓
              P12 ─── 状态管理演进 ←──── P13 ─── SCF 部署 ←──── P14 ─── 开闭原则重构
```

| 阶段 | 核心内容 | 最深的坑 |
|------|---------|---------|
| **P6 帧同步** | 第一个多人原型 basic1，Lockstep 方案，服务端是中继 | 浮点数各平台不一致 |
| **P7 状态同步** | 服务端权威，引入 TSRPC | bigint 传不了 |
| **P8 Monorepo** | demos/ → packages/，Lerna | 循环依赖 |
| **P9 双服务** | room（WS）+ match（HTTP）拆分 | match 断 WS 重连 |
| **P10 Logic 层** | ReScript + bundle-logic.js | bundle 闭包暴露 |
| **P11 服务端权威** | Tick Loop + 代次守卫 | warm container 残留 |
| **P12 状态管理** | Immutable.js → SoA | HashMap hash 冲突 |
| **P13 SCF 部署** | 6 个部署连环坑 | undici@7 需要 Node 20 |
| **P14 开闭原则** | 单机代码 zero-touch | 退房状态残留 |

---

## 工作流进化：6 步从手动到全自动

```
AI 辅助编程 → OpenClaw 全自动 → 引入 OpenCode → TDD + Skill + 自动部署 + E2E + Specs
  (DeepSeek网页)  (0代码指挥)    (调度分离降本)     (流程标准化闭环)
```

### Step 1：AI 辅助编程（最早阶段）

用 DeepSeek 网页版做优化、算法实现等局部功能的处理。用 Trae VSCode 插件做代码补全。

痛点：每次改代码要在网页和 IDE 之间反复切换，上下文也带不过去。

### Step 2：OpenClaw 全自动写代码（零代码指挥阶段）

引入 OpenClaw 后，工具链升级了一大截：

- OpenClaw 接入飞书接收指令、接入搜索抓取资料、直接写代码
- 兄弟完全不再写代码，只是指挥 OpenClaw——告诉它架构怎么设计、单机逻辑在哪个位置、要转换成什么多人逻辑
- OpenClaw 自动去读单机代码、理解逻辑、写出多人版本

**痛点：token 消耗极高，平均每天花费 100 多元。** OpenClaw 做所有事情（调度 + 分析 + 写代码 + 测试），上下文里夹带了很多调度和记忆相关的资产，token 利用率不高。

### Step 3：引入 OpenCode 写代码（调度分离）

问题清楚了：OpenClaw 适合做调度层（管记忆、管流程），写代码交给专门干这个的工具。

方案：**OpenClaw 调度 OpenCode 来写代码。**

- OpenCode 用 Go 套餐，很便宜
- OpenCode 写代码的 token 消耗低——一次只做一件事，没有不相关的上下文
- OpenClaw 的记忆等资产可以继续使用（调度时传给 OpenCode）
- OpenClaw 在调度 OpenCode 时会自动做一些分析和处理，比直接使用 OpenCode 更高效

模型选择上，OpenClaw 使用 OpenCode 的 DeepSeek Flash Free 模型（每天有免费额度）。超出免费额度就切换为 DeepSeek Flash——两者是同一个模型，缓存命中率不受影响。

### Step 4-6：TDD + Skill 固化 + 自动部署 + E2E 自测 + Specs

后面几步是把流程标准化：

- **TDD 流程**：先写 BDD 测试让 bug 真实 RED → 再修复让测试 GREEN
- **Skill 固化**：把固定流程写成 SKILL.md，AI 严格执行不走样
- **自动部署**：deploy-scf.js 一键部署，BDD 验证
- **E2E 自测 + 根因修复**：让 AI 自己复现 bug → 打日志定位 → 修复 → 验证
- **Specs**：先出规格再开工，Delta Specs 确认后写代码

每一步的详细过程在 **P16-P20 工作流进化** 篇展开。

---

## 知识管理速览（后续 13 篇文章讲什么）

| 主题 | 一句话说清 |
|------|-----------|
| 编码规则体系 | 基础/模块/流程三层规则 + agent-context.md 宪法机制 |
| 重构标准 | 🐛🔴🟡🟢 审查清单——最高频 bug 是 End 逻辑重置 |
| Specs 体系 | Main Specs + Delta Specs + 变更管理 |
| 决策记录 | 40+ ADR 精选——还有反面决策（选了后悔的） |
| 测试体系 | 单元 AI 自动，集成半自动，E2E 手动辅助 |
| Token 优化 | 月费大幅下降的实操方案 |
| 记忆管理 | 33 个锚点词，检索协议 |
| Agent Brief | 体验式反馈 > 技术 spec |
| 部署管理 | SCF 双环境双实例 |
| 工具链 | 十余个 Skill 全家桶 |
| 前端性能 | SoA、帧管理、MMD+FBX 双轨 |
| 通信可靠性 | WS 断连、重连、竞态、防御式编程 |
| 反模式与设计模式 | 6 类坑 root cause + 13 个可复用模式 |

---

## 坑的速览清单

### 选型坑
- 帧同步很美，但状态同步更适合 AI 协作
- Immutable.js 太重，最终回归原生

### 部署坑（6 个）
- undici@7 需要 Node 20（SCF 只有 18）
- Windows zip 不保留 Unix 权限
- ESM/CJS 混合导致 require 崩溃
- warm container 定时器残留

### AI 协作坑
- AI 偷换方案不告诉你
- AI 拍脑袋修 bug（不结合日志）
- AI 一个场景抽象出全套设计模式
- AI 不知道已有工具函数，自己重新实现

### 测试坑
- 集成测试用 mock = 假测试
- E2E 前不重启 = WS 断连卡死
- HMR 断 WS = 测试期间退房

### 常见的痛点
- Tool loop 不 yield = 炸 session（工具循环时间太长）
- 状态重置遗漏（End 逻辑未遍历清理）

---

## 后续每篇的推荐阅读顺序

- **想了解全貌：** P5（这篇）→ 挑感兴趣的时间线篇 → 挑感兴趣的知识篇
- **想上手实操：** P5 → P34 起步指南 → P16-P20 工作流 → P25 测试 → P26 Token → P21 规则
- **想避坑：** P5 → P13 部署 → P33 反模式 → P22 重构标准
- **时间线通读：** P5 → P6→P7→P8→P9→P10→P11→P12→P13→P14

---

**下一篇：[Vibe Coding 多人游戏（六）—— Phase 1：basic1 帧同步（Lockstep）](https://www.cnblogs.com/chaogex/p/21195307)**
