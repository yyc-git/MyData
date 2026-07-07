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

### 单元测试（Jest）

全部由 AI 自动编写，每次修改核心逻辑后自动运行。

```
packages/logic/test/      ← ReScript 纯函数测试
packages/room-service/test/ ← 服务端测试
```

单元测试的关键策略：**测试纯函数，不需要 mock 外部依赖。** 因为纯函数的输入和输出都是可预测的，AI 写起来不会出错。比如 Movement.res 的转向逻辑，输入一个朝向值，输出一个旋转角度——这是一个纯函数，AI 只需要写"输入 x 期望输出 y"就可以了。

相比之下，如果让 AI 写一个包含 side effect（网络请求、DOM 操作）的单元测试，它就会搞出各种奇怪的 mock——mock 了整个 TSRPC 客户端，或者 mock 了 `window` 对象，这些 mock 本身可能比生产代码还复杂，而且测试的价值极低。

实际案例：有一回 AI 测 `computeCollisionDamage` 函数，想测试"跑步时踩踏触发伤害"。它 mock 了整个 `State` 对象、mock 了 `players` Map、mock 了 `hull` 数组——mock 了 60 行，测试逻辑只有 5 行。我在代码审核里看到这条，要求它改：直接传入实际数据，不要 mock。改了之后测试从 65 行变成 15 行，且更重要——它测试了真正的代码路径。

### 集成测试（BDD Cucumber）

用真实的服务实例测试。不 mock，不 stub。

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

下期讲 **P22：Token 优化全攻略**——月费从 2000 到 100 的实操方案。

**下一篇：[Vibe Coding 多人游戏（二十二）—— Token 优化全攻略](https://www.cnblogs.com/chaogex/p/21195307)**
