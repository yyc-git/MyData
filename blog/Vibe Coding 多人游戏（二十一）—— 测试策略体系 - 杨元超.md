# Vibe Coding 多人游戏（二十一）—— 测试策略体系

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

Vibe Coding 环境下的测试策略和传统开发不太一样。传统开发中，测试通常由 QA 团队编写和维护；Vibe Coding 下，**AI 既要写代码，也要写测试，还要跑测试**。

核心问题是：**怎么让 AI 自己写测试、自己跑测试、自己修复？**

我经历了一个渐进的过程：一开始完全没有测试，手动跑游戏验证；后来加了单元测试，AI 写的，但覆盖率很低；再后来加了 BDD 集成测试，解决了"AI 修了 bug 但产生了回归"的问题；最后加了 E2E 端到端测试，确保用户体验上线前没问题。

---

## 三层测试

### 单元测试（BDD Features · 纯函数路径）

和集成测试一样使用 BDD（Gherkin Feature 文件 + Step Definitions），只是覆盖的路径不同——单元测试覆盖单一纯函数的输入输出，不涉及服务端、网络或 UI。

```
features/unit/logic/
├── collision.feature           # 碰撞检测纯函数
├── movement.feature            # 移动逻辑纯函数  
└── step-definitions/
    ├── collision.steps.ts
    └── movement.steps.ts
```

注意单元测试也是 BDD Feature 文件，不是普通的 `*.test.ts`。因为 AI 在同一套框架下更容易切换视角——写单元测试和写集成测试用的是同一套术语、同一套断言风格、同一个配置。

单元测试的关键策略：**测试纯函数，不需要 mock 外部依赖。** 因为纯函数的输入和输出都是可预测的，AI 写起来不会出错。比如 Movement.res 的转向逻辑，输入一个朝向值，输出一个旋转角度——这是一个纯函数，AI 只需要写"给定输入 x，期望输出 y"就可以了。

相比之下，如果让 AI 写一个包含 side effect（网络请求、DOM 操作）的测试，它就会搞出各种奇怪的 mock——mock 了整个 TSRPC 客户端，或者 mock 了 `window` 对象，这些 mock 本身可能比生产代码还复杂，而且测试的价值极低。

一个典型的单元 BDD 场景：

```gherkin
Feature: 碰撞检测
  Scenario: 直线移动的玩家踩到敌人
    Given 玩家在位置 (0, 0, 0)，面向 Z 轴正方向
    When 玩家持续移动 2 秒
    And 敌人在位置 (0, 0, 10)
    Then 碰撞检测返回 true
```

和集成测试的 Feature 文件格式完全一样。区别只在于：单元测试的是单一逻辑层（ReScript 纯函数），不需要启动服务、不涉及网络 IO。

实际案例：有一回 AI 测 `computeCollisionDamage` 函数，想测试"跑步时踩踏触发伤害"。它一开始想 mock 整个 `State` 对象，我要求它改：直接传入实际数据，不要 mock。改完后测试只有 15 行，且更重要的是——它测试了真正的代码路径。

### 集成测试（BDD Features · 服务端集成路径）

和单元测试一样使用 BDD Feature 文件，覆盖的是服务端集成路径——需要启动 room-service 实例、经过 TSRPC 协议层、测试完整的业务流程。

```
Feature: Room Lifecycle
  Scenario: Player enters and exits room
    Given a room is created
    When player A joins
    And player B joins
    And player A exits
    Then the room should have 1 player
```

BDD 测试的关键点：**不依赖测试夹具中的模拟数据，必须触发真实的生产代码路径。**

我们有一个血淋淋的教训：早期集成测试都是 "mock-only"——比如测试 `disconnect` 逻辑，但 mock 了 `Server.disconnect` 本身。这叫什么测试？只是测试了 Mock 框架能正常工作。

后来在 `workflow-rules.md` 里明确了一条规则：

> **🔴 禁止用模拟函数代替实际代码做集成测试。** 测试不依赖真实 bug 逻辑，没法真正失败——看起来测了但实际没测到点子上。

BDD 测试的命令配置：

```bash
npx jest --config jest.multiplayer.json --silent
npx tsc --noEmit          # jest 用 ts-jest 只转译不做类型检查
```

BDD 测试的配置文件是独立的 `jest.multiplayer.json`，不和其他测试混在一起。这样做的好处是：多人游戏的 BDD 测试可以单独跑，不用等全部单元测试完成。

这里有个坑：`ts-jest` 默认不做类型检查，只做转译。所以需要在 BDD 测试之后额外跑 `tsc --noEmit` 来暴露类型错误。有一次 AI 改了一堆 `.ts` 文件，BDD 测试全通过了，但 `tsc` 报了一堆类型错误——因为 `ts-jest` 绕过了一些类型检查。从那之后，我把 `tsc --noEmit` 写进了每个测试流程的前置条件。

### E2E 测试（Playwright）

双窗口模拟两个玩家的真实交互。手动触发，不自动跑。

E2E 测试比较重：需要先重启 room-service 和 match-service（避免 WS 失连），打开两个浏览器窗口，手动输入相同的房间，然后验证各种交互。因为 E2E 测试的维护成本高，我们没有跑在 CI 上，而是作为上线的最终关口。

最重要的一条 E2E 规则：**E2E 测试前必须先重启 room-service + match-service。** 我第一次做 E2E 测试时，没重启服务端，结果连接了之前的 WebSocket 会话——服务端以为玩家还在上一个游戏里，一直报 "already in game"。排查了半小时才发现是会话残留。

---

## E2E 积木化重构

初期 E2E 测试是一个巨长的 Playwright 脚本：打开浏览器 → 登录 → 创建房间 → 等待匹配 → 进入游戏 → 移动 → 攻击 → 退出。跑一次十几分钟，中间任何一步挂了都要从头来——从头再来十几分钟。

重构思路：把 E2E 场景拆成独立的 **积木（blocks）**，每个积木验证一个原子场景。

### 积木结构

两层：

- **积木（blocks）** — 原子操作，每个是独立的 Playwright block，如 room-join、move、collision-damage
- **场景 JSON（scenarios）** — 配置层，用 JSON 描述要组合哪些积木和参数

```
test/e2e/
├── blocks/                          # 积木实现
│   ├── room-join.block.ts
│   ├── move.block.ts
│   ├── collision-damage.block.ts
│   └── sync-accuracy.block.ts
└── scenarios/                       # 场景配置（JSON）
    ├── gameover-twocycle.json
    ├── empty-room-join.json
    └── scf-twowin.json
```

一个场景 JSON 示例如下：

```json
{
  "name": "双人联机到结束",
  "blocks": [
    { "name": "room-join", "players": 2 },
    { "name": "move", "direction": "forward", "duration": 3 },
    { "name": "collision-damage", "target": "player2" },
    { "name": "exit", "player": "player2" }
  ],
  "env": "local"
}
```

Runner（`e2e-runner.cjs`）读取 JSON → 按顺序调用积木执行。想加一个新场景，不用写一行代码——从已有积木里挑几个拼成 JSON 就行。

这种组合方式在传统测试里很难做到：传统测试每个场景是一个独立的脚本文件，有 setup/teardown/assert 的完整代码。但在我们的体系里，**脚本（积木）和场景是分离的**——积木提供能力，JSON 决定测什么。


### 积木化的三个核心收益

**1. 可组合。** 这才是积木化最大的价值——**不用为每个测试场景写脚本**。已有积木：

- room-join、room-exit-reenter、move、collision-damage、sync-accuracy、reconnect

任意组合这些积木就是一个新场景。Runner 会自动编排执行、状态隔离、截图记录。

实际案例：发现"退出后移动键无响应"的 bug，当场写了个 JSON：`[room-join, move, exit, reenter, move]`——5 分钟就验证了问题。如果用传统 E2E 脚本，至少要花 2 小时写完整的 Playwright 代码。

**2. 快速反馈。** 原来跑一次 E2E > 10 分钟，现在单个积木 30 秒到 1 分钟。AI 修 bug 后可以快速验证，不用等整套流程。

**3. AI 可写。** 积木模板固定 `setup → action → assert → cleanup`，AI 只要填空。而且 AI 生成新场景的成本几乎为零——它不写代码，只组装 JSON。

积木化的核心原则：**一个积木只验证一个场景，退出即清理，不依赖兄弟积木。**

---

## 验收流程（gts-acceptance）

测试的终点不是"代码通过"，而是"兄弟确认能上线"。GTS-Play 的验收流程分成五步：

### Step 1：审核
AI 代码审核检查 🐛🔴🟡🟢，确认没有红线违规、没有越界改动、没有假测试。

### Step 2：BDD 先 RED 再 GREEN
集成测试先在未修复的代码上跑，确认因 bug 真实 ❌ 失败（锁定问题），再修复代码 ✅ 通过（确认修复生效）。

### Step 3：E2E 自动测试
用积木和场景 JSON 组合执行 E2E 测试（积木和 JSON 的具体设计见上方"E2E 积木化重构"章节）。根据测试目标选择环境：

- **本地环境**：重启 room-service + match-service → 启动 webpack-dev-server → 运行 E2E 场景
- **线上环境（SCF）**：检查是否有未部署的改动 → 若有则先部署到对应服务 → 运行 E2E 验证线上版本

E2E 同时支持本地和在线的场景验证，用哪个环境由场景 JSON 里的 `env` 字段决定。一次全量 E2E（所有场景）大约 5 分钟。

### Step 4：兄弟玩一次
走到这一步，代码层面已经全通过了。但 UI/UX 的问题测试测不出来——比如按钮位置不对、反馈不够清晰、动画卡顿。我会上线（或本地运行）玩一局，确认一切正常。

这个流程看似复杂，但实际走一遍只需要 5-10 分钟。而且一旦有一步卡住，AI 会自动修复（OpenCode）然后重跑。如果重跑三次仍然失败，系统会停下来问我"还要继续修吗"。

---

## E2E 自动测试实坑

三层测试体系的顶层是 E2E 自动测试。我们有专用的 Skill 来跑它——`gts-e2e-test`（手动双窗口）和 `gts-e2e-auto`（自动化 scenarios）。这些 Skill 本身就是在踩坑中迭代出来的。

### 坑 1：Playwright 时序不稳定

Playwright 的 `click()` 和 `hover()` 是带自动等待的，但它等的只是"元素出现"，不是"元素可以交互"。比如：

```typescript
// 坑：元素出现了但定位动画还没完
await page.click('.join-button')  // Playwright 算点击到元素了
// 实际上 .join-button 还在做位置动画，点击被接收但位置不对
```

**修复**：改为 `waitForSelector` + `waitForFunction` 双保险，确认元素可见且可交互后再操作。

```typescript
await page.waitForSelector('.join-button', { state: 'visible' })
await page.waitForFunction(() => {
    const btn = document.querySelector('.join-button')
    return btn && btn.getBoundingClientRect().width > 0
})
await page.click('.join-button')
```

### 坑 2：双窗口同步

多人游戏的 E2E 测试需要两个浏览器窗口——一个创建房间，一个加入。两个窗口的操作时序问题是最大的坑。

```
窗口 A：创建房间 → 等待匹配
窗口 B：刷新房间列表 → 加入 → 准备
问题：窗口 B 的"刷新"操作发生在窗口 A "创建成功"之前 → 房间列表为空 → 测试失败
```

**修复**：在 scenarios JSON（积木系统的场景层）中，每个场景的 blocks 执行顺序加上显式的 `afterBlock` 依赖声明：

```json
{
    "name": "双人正常匹配进入游戏",
    "blocks": ["loginAsCreator", "loginAsJoiner"],
    "dependencies": {
        "loginAsJoiner": { "after": "loginAsCreator" }
    }
}
```

执行器按依赖拓扑排序 blocks，确保时序正确。

### 坑 3：本地通过，SCF 不通过

最常见的 E2E 坑——本地测试一切正常，部署到 SCF 线上就挂了。原因一般是：

- **冷启动**：SCF 实例第一次被唤醒时，WebSocket 建立比本地慢几百毫秒（容器初始化 + 网络路由）。Playwright 的等待时间没考虑到这个延迟。
- **网络延迟**：本地 WS 延迟 <1ms，线上可能 30-50ms。帧同步的 tick 间隔本地没问题，线上就会丢包。

**修复**：E2E 测试脚本区分本地/线上模式。线上模式增加 2x 的等待超时，关键操作（如"进入游戏"）用轮询等待而非固定 timeout。

```typescript
const IS_SCF = process.env.TEST_TARGET === 'scf'
const TIMEOUT = IS_SCF ? 10000 : 5000  // SCF 线上翻倍
```

### 坑 4：截图对比不可靠

早期 E2E 测试用截图对比来验证 UI 状态——测试先截一张"期望图"，运行时再截一张对比，像素 diff。

问题是：Three.js 渲染的帧率不稳定——同一场景在不同机器上截图可能有几像素的差异。10px 的 diff 就报失败，但实际上功能是对的。

**修复**：放弃截图对比，改用 DOM 状态断言：

```typescript
// 截图对比（放弃）
// await expect(page).toHaveScreenshot('game-view.png')

// DOM 状态断言（采用）
const hudText = await page.textContent('.hud-health')
expect(hudText).toBe('100')
const gameState = await page.evaluate(() => window.__GAME_STATE__)
expect(gameState.isPlaying).toBe(true)
```

状态断言比截图可靠得多，而且运行时开销更小。

不过截图对比也并非完全没用——当分析 AI 的操作结果时（比如 OpenCode 改完代码，要看界面变化），截图仍然是传达视觉信息的最直接方式。截图对比的不可靠性促成了另一个方向的 Skill——**截图分析优化**（`gts-screenshot-optimize`）：截图自动降质到 800px 宽、70% quality 节省 token，必要时截局部而非全屏，关键分析调度 OpenCode Pro + Kimi K2.7 Code 多模态模型来解读


## 测试的 AI 适配

为了让 AI 能自己写和跑测试，测试框架必须满足：

### 1. 命名规则一致

`*.test.ts` 文件命名。AI 搜索时不会漏。不能有 `*.spec.ts`、`*.test.js`、`*.test.tsx` 等变种。有一次 AI 在 `packages/frontend/test/` 下写了一个 `collision-damage.spec.ts`，和既有的 `*.steps.ts`、`*.feature` 风格不一致。另一个 AI 在搜索测试文件时用了 `*.test.ts` pattern，直接漏掉了这个文件。

### 2. 配置简单

Jest 配置 10 行以内，不需要复杂 mock。过多的 mock 配置会增加 AI 的认知负担。我们的 `jest.multiplayer.json` 保持精简，只包含必要的 moduleNameMapper（用于 mock antd、SCSS 等非测试必要的大段依赖）。

### 3. 输出可解析

测试失败时打印清晰的行号和 stack trace。这是为了 AI 能自己定位问题。有一次测试失败，输出只有 `FAIL` 没有具体信息——AI 完全不知道错在哪。加了 `--verbose` 和详细的 test name 后，AI 可以根据失败信息直接找到对应的步骤定义。

---

## TDD 纪律

验收流程严格执行：

1. **先写测试** → 测试因 bug 真实失败（红色）
2. **修复代码** → 测试通过（绿色）
3. **重构** → 测试保持绿色

TDD 的 "先 RED 再 GREEN" 在 AI 环境下特别重要。因为 AI 如果没有看到 RED，它可能直接跳过测试写的阶段，或者写一个"永远 GREEN"的测试——比如 mock 了全部依赖。

我有次发现 AI 提交的测试全部通过——但我确认功能还没实现。原来 AI 先写了测试，发现不通过，但它不是去修代码，而是去**修改了测试**——把测试的断言从 `expect(x).toBe(true)` 改成了 `expect(x).toBe(false)`。这叫什么 TDD？这是 AI 在"骗"自己。

从那以后，BDD 测试的验收条件里加了一条：**测试在修复代码前必须真实失败。**

---

## 测试覆盖率的真实意义

GTS-Play 的测试量大约 260 个测试、42 个测试套件。但覆盖率的数字（比如 80%）并不重要。

真正重要的是：
- 每个 bug 修复都新增了对应的测试（避免回归）
- 每个 BDD 场景都覆盖了完整的业务路径（不是只测了一个函数）
- 集成测试不 mock 核心逻辑

一个真实数据：在增加 BDD 集成测试前，我有一个 bug 在一个月内出现了 3 次回归——都是"修好 → 过两周又出现 → 再修"。加了对应的 BDD 测试后，同样的 bug 再也没有回归过。

---

下期讲 **P22：Token 优化全攻略**——月费从 3000 到几百的实操方案。

**下一篇：[Vibe Coding 多人游戏（二十二）—— Token 优化全攻略](https://www.cnblogs.com/chaogex/p/21195307)**
