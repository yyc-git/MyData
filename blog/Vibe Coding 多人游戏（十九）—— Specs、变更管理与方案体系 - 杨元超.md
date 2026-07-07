# Vibe Coding 多人游戏（十九）—— Specs、变更管理与方案体系

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

AI 开发的常见问题：**方向错了，跑得越快错得越远。**

我经历过最惨的一次：AI 花了一整天给人游戏加了一个"自动匹配"功能——但需求其实是"优化匹配算法的队列效率"。AI 自己理解错了，我也没有及时发现，等代码写完才发现它走错了方向。那一天烧掉了近 100 元 token，全白费了。

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

### Main Specs

存放在 `笔记/项目文档/specs/` 目录下，项目第一天就定义了 6 个全局场景：

- `collision.md` — 碰撞检测技术方案（AABB → OBB → 凸包，渐进式精度）
- `host-transfer.md` — 主机转移策略
- `match-service.md` — 匹配服务设计
- `multiplayer-sync.md` — 多人同步方案
- `player-lifecycle.md` — 玩家生命周期（进入→就绪→游戏→退出→超时→重连）
- `room-service.md` — 房间服务设计

这些 Specs 几乎不变。AI 只需要知道它们存在，在需要时搜索阅读。不需要每次任务都加载——因为它们是"宪法"，不是"操作手册"。

### Delta Specs

这是每次变更的核心。每次改动前，AI 先输出 Delta Specs → 兄弟确认 → 开工。Delta Specs 里最关键的是"不改的"部分：

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

**关键规则：出方案后必须等兄弟确认才能开工。** AI 说"要记住"或"好的"不等于同意。Delta Specs 没有确认就写代码 = 浪费。

我在这上面吃过亏：有次 AI 发了一段非常详细的方案，我看了觉得挺好，回了"OK"——AI 以为我确认了，直接开写。但实际上我"OK"的意思是"方案我看懂了"，不是"可以开工"。从那以后，我在规则里明确写了一句：**"开工"或"开干"才是批准信号，"好的""明白""OK"都不是。**

### Verify Specs

Delta Specs 确认后，对应的 Verify Specs 决定了什么算"改对了"。BDD 测试场景列表就是 Verify Specs 的具体体现。比如一个退房重置的功能：

```
Feature: Room Exit Reset
  Scenario: Player exits and re-enters
    Given a room is created with player A
    When player A exits
    And player A re-enters
    Then player A should be in the game normally
```

Verify Specs 的好处是：如果 BDD 测试通过了，AI 改的东西就一定是正确的。不用人工再走一遍 E2E 验证。

---

## 真实案例：Specs 如何防止灾难

有一个案例让我至今记忆犹新。需求是"给 room-service 加一个 HTTP 接口查房间状态"。AI 直接开始写——在 room-service 里加 Express 路由、加 HTTP 服务端、改 `package.json`。

写完后才发现：room-service 本身就是 WebSocket 服务（端口 4003），加 HTTP 意味着要维护两个端口、两套鉴权、两套错误处理、两套 keep-alive。而实际上 match-service（端口 3000，HTTP）已经有房间查询接口了——直接在 match-service 扩一个就好。

如果一开始写 Delta Specs，AI 会在"不改的"里写上"不增加新服务端口"——这个灾难就不会发生。

**事后我们加了一条红线：Delta Specs 的"不改的"必须比"改什么"长。** 明确告诉 AI 哪些不要碰，比告诉它要碰什么更重要。

这条规则在后续开发中多次救命。比如一次"修改小兵移动逻辑"的需求，AI 在"不改的"里写了：
- 不改巨大娘的移动逻辑
- 不改碰撞检测算法
- 不改服务端状态同步
- 不改前端渲染管线

结果 AI 真的只改了小兵的 `Movement.res` ——因为边界已经画死了，它没有越界的机会。

---

## 方案文档体系

`packages/room-service/docs/solutions/` 下存放所有技术方案，以及 `笔记/方案/` 目录下的交叉领域方案：

- SCF 部署方案
- 状态同步设计
- WebGPU 迁移分析
- 多线程架构方案

每份方案包含：背景、目标、可选方案（至少 2 个）、选定方案的理由、风险与应对。

印象最深的是 **SCF 部署 Bundle 模块加载方案**。那是一个纯粹的技术决策：room-service 的 dist 代码有直接 `require("meta3d-commonlib-new/src/structure/hash_map/ImmutableHashMap")` 的调用，但这些模块是本地 ReScript 编译产物，不在 npm 上，SCF 部署时 npm install 安装不了。

方案文档里讨论了两个方案：
- **A：Module._load hook** — 在 `txcloud-scf.ts` 启动时拦截 Node.js 的 `Module._load` 方法。优点是不改 zip 结构；缺点是复杂度高、调试困难（WebSocket 连接失败时产生 HTTP 446/443，无有效错误日志）、不安全（全局拦截所有 require 调用）。
- **B：zip 直接注入 node_modules** — 在构建 zip 时将所需模块的 `.js` 文件复制到 zip 的 `node_modules/` 下。zip 仅增加 3KB（从 48KB → 51KB），无需运行时代码。

AI 的方案文档里还分析了风险：方案 A 的 Module._load hook 在不同 Node.js 版本下行为不一致（Node 18 和 Node 20 的 hook 签名不同），这是不可依赖的。最终选了方案 B，一战成功。

---

## 变更管理 SOP

每次变更遵循 **"讨论 → 方案 → 实施"** 三步流程，并且配套了文档规范：

```
Step 1：讨论
├── 确定需求（兄弟提，AI 确认理解）
├── 讨论多方案比较
└── 评估影响面

Step 2：方案
├── 写方案文档到 笔记/方案/
├── 明确技术路线和改动的文件
├── Delta Specs
└── 兄弟确认 → 确认后开工

Step 3：实施
├── 创建变更文档目录 笔记/项目文档/changes/<日期>-<功能名>/
│   ├── spec.md       # 方案拷贝
│   ├── tasks.md      # 任务拆解
│   └── log.md        # 执行日志
├── OpenCode 执行
├── BDD（先 RED 再 GREEN）
└── 提交
```

这个变更管理流程是逐渐演化形成的。一开始我只有 Delta Specs，但发现 AI 执行过程中会偏离方向、会换方案。加了执行日志（`log.md`）后，AI 在日志里记录了"这里的参数签名我改成了 X""这个测试一开始没用，后来发现需要加 mock"，我就能在提交前回顾整个过程，确保没有走偏。

另外，方案确认后是**允许**在实施中微调的——如果 AI 发现原方案有问题，它必须在 `log.md` 里记录"原方案 X 不可行→改为 Y→原因 Z"，而不是悄无声息地换方案。

---

## 最容易被忽视的一环：文档的同步

变更完成后，AI 常常忘记更新相关文档。比如改了 `Movement.res` 的碰撞检测逻辑，但 `collision.md` （Main Specs）没更新。下次 AI 搜索"碰撞检测方案"时，读到的是旧文档，然后基于旧信息做决策。

所以 `gts-save-flow` skill 的流程里专门有一道关卡：**规格同步**。审核 → BDD → 编译 → 规格 → 笔记 → 记忆 → 提交。规格位于笔记之前，就是要确保代码和文档保持同步。

---

下期讲 **P20：决策记录精要（ADR）**——40+ 决策中哪些值得学、哪些是反面教材。

**下一篇：[Vibe Coding 多人游戏（二十）—— 决策记录精要（ADR）](https://www.cnblogs.com/chaogex/p/21195307)**
