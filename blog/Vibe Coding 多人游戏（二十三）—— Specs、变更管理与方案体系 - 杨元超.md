# Vibe Coding 多人游戏（二十三）—— Specs、变更管理与方案体系

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

AI 开发的常见问题：**方向错了，跑得越快错得越远。**

Specs 和变更管理就是"方向校验器"——在 AI 开始写代码之前，先确定要做什么、怎么做。

---

## 三层 Specs 体系

```
Main Specs（主规格）
├── 描述项目整体架构（很少变更）
├── 技术栈、通信方式、部署方案
└── 架构决策记录

Delta Specs（增量规格）
├── 针对当前需求的规格说明
├── "这次要改什么"
└── 代码审计通过后才开始写

Verify Specs（验证规格）
├── 验收标准
├── 测试场景（BDD）
└── 通过/失败判定规则
```

**Main Specs** — 项目的宪法，几乎不变
**Delta Specs** — 当前变更的范围，必须确认后才能开工
**Verify Specs** — 验收标准，写完就知道对不对

---

## 变更管理流程

每次变更遵循 **"讨论 → 方案 → 实施"** SOP：

```
Step 1：讨论
├── 确定需求
├── 讨论方案（多方案比较）
└── 评估影响面

Step 2：方案
├── 写方案文档（solutions/）
├── 明确技术路线
├── 列出改动的文件和范围
└── 确认测试策略

Step 3：实施
├── 写 Delta Specs
├── OpenCode 执行
├── 测试验证
└── 提交
```

**如果开干前没有写方案文档，这个变更大概率会跑偏。**

---

## 方案文档体系

`packages/room-service/docs/solutions/` 下存放所有技术方案：

- SCF 部署方案
- 状态同步设计
- WebGPU 迁移分析
- 多线程架构方案
- ...

每份方案包含：背景、目标、可选方案（至少 2 个）、选定方案的理由、风险与应对。

---

## Delta Specs 样例

```
## Delta Specs: 退房后 isEnterGame 重置

### 背景
游戏退出后 isEnterGame 标志位未重置，导致下一局无法进入

### 改动范围
- packages/room-service/src/models/Game.ts: dispose() 中重置标志位
- packages/room-service/src/state/State.ts: 确认标志位定义

### 不改的
- 前端代码（无关）
- 匹配逻辑（无关）

### 测试
- 新增集成测试：退出房间后 isEnterGame = false
- BDD 验证：7 个场景全部通过
```

Delta Specs 写清楚"改什么"和"不改什么"——后者和前者同等重要。AI 知道了边界才不会越界。

---

下期讲 **P24：决策记录精要（ADR）**——40+ 决策中哪些值得学、哪些是反面教材。

**下一篇：[Vibe Coding 多人游戏（二十四）—— 决策记录精要（ADR）](https://www.cnblogs.com/chaogex/p/21195307)**
