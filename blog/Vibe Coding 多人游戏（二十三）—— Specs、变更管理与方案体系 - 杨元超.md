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

**Main Specs** — 项目的宪法，几乎不变。GTS-Play 的 Main Specs 包含 6 个全局场景：collision、host-transfer、match-service、multiplayer-sync、player-lifecycle、room-service，每个描述技术选型和架构边界。

**Delta Specs** — 当前变更的范围。每次改动前，AI 先输出 Delta Specs → 兄弟确认 → 开工。关键字段是"不改的"——AI 越界 90% 是因为没告诉它边界在哪。

**Verify Specs** — 验收标准。Delta Specs 确认后，对应的 Verify Specs 决定了什么算"改对了"。比如 BDD 测试场景列表。

---

## 变更管理 SOP

每次变更遵循 **"讨论 → 方案 → 实施"** 三步流程：

```
Step 1：讨论
├── 确定需求（兄弟提，AI 确认理解）
├── 讨论多方案比较
└── 评估影响面

Step 2：方案
├── 写方案文档
├── 明确技术路线和改动的文件
├── Delta Specs
└── 兄弟确认 → 确认后开工

Step 3：实施
├── OpenCode 执行
├── BDD（先 RED 再 GREEN）
└── 提交
```

**关键规则：出方案后必须等兄弟确认才能开工。** AI 说"要记住"或"好的"不等于同意。Delta Specs 没有确认就写代码 = 浪费。

---

## 真实案例：Specs 如何防止灾难

有一次需求是"给 room-service 加一个 HTTP 接口查房间状态"。AI 直接开始写——在 room-service 里加 Express 路由、加 HTTP 服务端、改 package.json。

写完后才发现：room-service 本身就是 WebSocket 服务，加 HTTP 意味着要维护两个端口、两套鉴权、两套错误处理。而实际上 match-service（HTTP 3000）已经有房间查询接口了——直接在 match 扩一个就行。

如果一开始写 Delta Specs，AI 会在"不改的"里写上"不增加新服务端口"——这个灾难就不会发生。

事后我们加了一条红线：**Delta Specs 的"不改的"必须比"改什么"长。** 明确告诉 AI 哪些不要碰，比告诉它要碰什么更重要。

---

## 方案文档体系

`packages/room-service/docs/solutions/` 下存放所有技术方案：

- SCF 部署方案
- 状态同步设计
- WebGPU 迁移分析
- 多线程架构方案

每份方案包含：背景、目标、可选方案（至少 2 个）、选定方案的理由、风险与应对。

---

## Delta Specs 样例

```
## Delta Specs: 退房后 isEnterGame 重置

### 背景
游戏退出后 isEnterGame 标志位未重置，导致下一局无法进入

### 改动范围
- room-service/src/models/Game.ts: dispose() 中重置标志位
- room-service/src/state/State.ts: 确认标志位定义

### 不改的
- 前端代码（无关）
- 匹配逻辑（无关）
- 不增加新服务端口

### 测试
- 新增集成测试：退出房间后 isEnterGame = false
- BDD 验证：7 个场景全部通过
```

Delta Specs 写清楚"改什么"和"不改什么"——后者和前者同等重要。AI 知道了边界才不会越界。

---

下期讲 **P24：决策记录精要（ADR）**——40+ 决策中哪些值得学、哪些是反面教材。

**下一篇：[Vibe Coding 多人游戏（二十四）—— 决策记录精要（ADR）](https://www.cnblogs.com/chaogex/p/21195307)**
