# Vibe Coding 多人游戏（二十一）—— 测试策略体系

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

Vibe Coding 环境下的测试策略和传统开发不太一样。核心问题是：**怎么让 AI 自己写测试、自己跑测试、自己修复？**

---

## 三层测试

**单元测试（Jest）**

全部由 AI 自动编写，每次修改核心逻辑后自动运行。

```
packages/logic/test/      ← ReScript 纯函数测试
packages/room-service/test/ ← 服务端测试
```

关键：单元测试测试纯函数，不需要 mock 外部依赖。

**集成测试（BDD Cucumber）**

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

**E2E 测试（Playwright）**

双窗口模拟两个玩家的真实交互。手动触发，不自动跑。

---

## 测试的 AI 适配

为了让 AI 能自己写和跑测试，测试框架必须满足：

1. **命名规则一致**：`*.test.ts` 文件命名，AI 搜索时不会漏
2. **配置简单**：Jest 配置 10 行以内，不需要复杂 mock
3. **输出可解析**：测试失败时打印清晰的行号和 stack trace

---

## TDD 纪律

验收流程中必须：

1. 先写测试 → 测试因 bug 真实失败（红色）
2. 修复代码 → 测试通过（绿色）
3. 重构 → 测试保持绿色

**🔴 禁止用模拟函数代替实际代码做集成测试。** 测试不依赖真实 bug 逻辑，没法真正失败——看起来测了但实际没测到点子上。

---

下期讲 **P22：Token 优化全攻略**——月费从 2000 到 100 的实操方案。

**下一篇：[Vibe Coding 多人游戏（二十二）—— Token 优化全攻略](https://www.cnblogs.com/chaogex/p/21195307)**
