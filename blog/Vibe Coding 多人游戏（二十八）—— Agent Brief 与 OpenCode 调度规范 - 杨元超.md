# Vibe Coding 多人游戏（二十八）—— Agent Brief 与 OpenCode 调度规范

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

OpenCode 调度中最关键的环节是写 **Brief**——给 AI 的任务说明书。

Brief 写得好，AI 一次过，15 分钟搞定。Brief 写得差，AI 来回改 5 轮，一个小时还在原地打转。

---

## Brief 标准模板

```
## 修复
- 现象（体验式反馈）：玩家退房后下一局进不去
- 根因分析：gameStop 未重置 isEnterGame 标志位
- 验收标准：退房后重新匹配能正常进入

## 格式要求
- 改 .ts 再 tsc，不改 .js
- 新增集成测试覆盖，禁 mock
- 编码规则详见 agent-context.md
```

模板的核心是：**现象用体验式反馈（"退房后进不去"），根因用技术分析（"未重置标志位"），验收用可验证的标准。**

---

## 体验式反馈 > 技术 spec

这是最重要的一条原则：给 AI 写"为什么"比写"怎么做"更有效。

```
❌ 技术 spec：
把 State.position.y 改为 State.position.y + 0.5

✅ 体验式反馈：
角色太矮了，看起来像陷在地里
```

AI 理解了"太矮了"，自己会去查 position 和 camera 的关系，找到 y 轴偏移量，有时还会顺便修 camera 的 follow 逻辑。"

反过来，你给了 exact spec 说"y + 0.5"，AI 照做了但看起来还是不对——因为问题是 camera 的 offset 没同步调整。

---

## 引用规范

```
agent-context.md：只引用路径，不逐条复制（省 ~600 tokens）
代码审核 brief：必须贴完整 🐛🔴🟡🟢 规则
Delta Specs：先确认再开工
```

一个常见错误：把 agent-context.md 全文逐条贴进 Brief。每条规则 ~40 tokens，30 条就是 1200 tokens。引用路径 `详见 agent-context.md`，省下了而且更新规则时不需要改所有 Brief。

---

## 模型选择速查

| 任务类型 | 模型 | 原因 |
|---------|------|------|
| 新功能开发 | 付费 1M | 需要理解和生成大量代码 |
| Bug 修复 | 付费 1M | 需要追踪调用链 |
| 重构 | 付费 1M | 涉及多文件同步修改 |
| 小修小改 | 免费 200k | 改动小，Context 够 |
| 测试编写 | 免费 200k | 模式固定 |
| Code Review | 付费 1M | 需要理解大范围上下文 |

---

下期讲 **P29：部署与服务管理**——deploy-scf.js、双环境、日志抓取。

**下一篇：[Vibe Coding 多人游戏（二十九）—— 部署与服务管理](https://www.cnblogs.com/chaogex/p/21195307)**
