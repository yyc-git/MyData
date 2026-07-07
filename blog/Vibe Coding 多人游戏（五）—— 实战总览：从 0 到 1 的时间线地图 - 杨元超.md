# Vibe Coding 多人游戏（五）—— 实战总览：从 0 到 1 的时间线地图

> 从《Pieter Levels 一个人的游戏帝国》到《从 levelsio 到 GTS-Play》，前 4 篇从外部视角讲完了 Vibe Coding 多人游戏的案例、行业和方法论。从这一篇开始，我们进入 GTS-Play 的内部实战——一个真实项目的完整演进过程。
>
> **本文是这个系列的时间线地图。读完这篇，你就能知道后续每篇讲什么、值不值得看。**
> 
> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

## 一句话说清整个系列

**9 个阶段 × 1 次工作流进化 × 13 个知识主题 = 从 0 到 1 做一个 AI 驱动的多人游戏需要知道的一切。**

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
| **P13 SCF 部署** | 6 个部署连环坑（看下面） | undici@7 需要 Node 20 |
| **P14 开闭原则** | 单机代码 zero-touch | 退房状态残留 |

---

## 工作流进化：从手动到 AI 全自动

```
纯 AI 对话 ──→ OpenCode 引入 ──→ OpenClaw 调度 ──→ Skill 固化 ──→ 自动部署 ──→ E2E 自测+根因修复
  (手动复制)    (AI 接管终端)     (三角色分工)      (流程化)       (CI 闭环)      (三天最难 bug)
```

**月费从 2000 元 → 不到 100 元。** 关键转折是让免费模型管调度、付费模型管编程。

---

## 知识管理速览（后续 13 篇文章讲什么）

| 主题 | 一句话说清 |
|------|-----------|
| 编码规则体系 | 基础/模块/流程三层规则 + agent-context.md 宪法机制 |
| 重构标准 | 🐛🔴🟡🟢 审查清单——最高频 bug 是 End 逻辑重置 |
| Specs 体系 | Main Specs + Delta Specs + 变更管理 |
| 决策记录 | 40+ ADR 精选——还有反面决策（选了后悔的） |
| 测试体系 | 单元 AI 自动，集成半自动，E2E 手动辅助 |
| Token 优化 | 月费 2000→100 的实操方案 |
| 记忆管理 | QMD 5 collections，33 个锚点词 |
| Agent Brief | 体验式反馈 > 技术 spec |
| 部署管理 | SCF 双环境双实例 |
| 工具链 | 16 个 Skill 全家桶 |
| 前端性能 | SoA、帧管理、MMD+FBX 双轨 |
| 通信可靠性 | WS 断连、重连、竞态、防御式编程 |
| 反模式与设计模式 | 6 类坑 root cause + 12 个可复用模式 |

---

## 设计思想一句话速览

1. **服务端权威 + 绝对状态** = 最简多人同步方案
2. **开闭原则** = AI 时代最重要的架构约束
3. **纯函数共享层** = 前端和服务端行为完全一致
4. **代次守卫** = 防 warm container 残留的通用模式
5. **SoA 状态管理** = cache locality 友好的数据布局
6. **事件驱动替代 if-else** = 新行为 = 新 handler
7. **Test-as-documentation** = BDD + Specs = 活的文档
8. **先跑通再工程化** = 不要一开始就 monorepo

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

### 工具坑
- Tool loop 不 yield = 118 轮炸 session
- `Object.keys(Immutable.Map())` 永远为真
- 状态重置遗漏（End 逻辑未遍历清理）

---

## 后续每篇的推荐阅读顺序

- **想了解全貌：** P5（这篇）→ 挑感兴趣的时间线篇 → 挑感兴趣的知识篇
- **想上手实操：** P5 → P33 起步指南 → P15-P19 工作流 → P24 测试 → P25 Token → P20 规则
- **想避坑：** P5 → P13 部署 → P32 反模式 → P21 重构标准
- **时间线通读：** P5 → P6→P7→P8→P9→P10→P11→P12→P13→P14

---

**下一篇：[Vibe Coding 多人游戏（六）—— Phase 1：basic1 帧同步（Lockstep）](https://www.cnblogs.com/chaogex/p/21195307)——第一个多人 Demo，WebSocket + Immutable.js + 浮点数噩梦**
