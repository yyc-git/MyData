# Vibe Coding 多人游戏（二十七）—— 记忆管理体系

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

Vibe Coding 项目持续开发，AI 需要记住大量的项目细节。记忆管理体系就是解决"AI 记不住怎么办"的问题。

---

## 记忆结构

```
MEMORY.md（核心索引）
├── 33 个锚点词（快速定位）
├── 检索协议（怎么查）
└── 分层读取入口

memory/
├── 2026-07-07-log.md      ← 每日记录
├── 2026-07-06-log.md
└── ...

笔记/
├── 项目文档/               ← 规格、规则、方案
├── 决策记录/               ← ADR
├── 代码笔记/               ← 代码层面的发现
└── daily/                  ← 每日日志
```

---

## 33 个锚点词

记忆检索的核心策略——用**锚点词**快速定位：

```
GTS-Play, OpenCode, E2E, BDD, SCF, TSRPC
room-service, match-service, webpack-dev-server
token-opt, gts-skill, MEMORY-ARCHIVE
重构规则, 代码审核, 验收, gts-acceptance
通知, 飞书, 部署, deploy-scf
状态同步, 绝对状态, 保存, 提交
```

搜索时按优先级：锚点词精确搜索 > 关键词语义搜索 > 全文搜索。

---

## 检索协议

```
统一命令：openclaw memory search "<关键词>" --max-results 3 --json

规则：
1. 先匹配锚点词 → 精确命中
2. 再匹配关键词 → 扫描索引
3. 最后语义搜索 → 回退方案
```

---

## 保存规则

记忆只在明确指令下保存——兄弟说"保存"或"提交"时才写 daily log。

不自动保存、不自动提交——避免频繁写入导致索引膨胀。

---

## 入库标准

一条信息是否值得记入 MEMORY.md？满足以下**至少 2 条**：
- 会影响未来决策（>2 周有效期）
- 会被重复使用（流程/偏好/规则）
- 会造成明显损失（忘了会踩坑）
- 可操作、可验证（不是情绪感受）

---

下期讲 **P28：Agent Brief 与 OpenCode 调度规范**——怎么写一个让 AI 不出错的 Brief。

**下一篇：[Vibe Coding 多人游戏（二十八）—— Agent Brief 与 OpenCode 调度规范](https://www.cnblogs.com/chaogex/p/21195307)**
