# Vibe Coding 多人游戏（二十三）—— 记忆管理体系

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

Vibe Coding 项目持续开发几个月后，AI 需要记住大量的项目细节——昨天的修复方案、上周的技术决策、一个月前的版本号。

记忆管理体系就是解决"AI 记不住怎么办"的问题。

---

## 记忆结构

```
MEMORY.md（核心索引）
├── 33 个锚点词（快速定位到对应文档）
├── 检索协议（怎么查）
└── 分层读取入口（去哪找什么）

memory/
├── 2026-06-07-log.md     ← 每日记录（35+ 篇）
├── 2026-06-08-log.md
└── ...

笔记/
├── 项目文档/             ← 规格、规则、方案
├── 决策记录/             ← ADR（40+ 条）
├── 代码笔记/             ← 代码层面的发现
└── daily/                ← 每日日志摘要
```

---

## 33 个锚点词

记忆检索的核心策略是用**锚点词**快速定位。这些锚点词是项目里的关键概念：

```
GTS-Play, OpenCode, E2E, BDD, SCF, TSRPC
room-service, match-service, webpack-dev-server
token-opt, gts-skill, MEMORY-ARCHIVE
重构规则, 代码审核, 验收, gts-acceptance
通知, 飞书, 部署, deploy-scf
状态同步, 绝对状态, 保存, 提交
```

搜索时按优先级：锚点词精确命中 > 关键词语义搜索 > 全文搜索。如果搜"部署"，先精确匹配锚点词 deploy-scf，再语义搜索，最后扫全文。

---

## 检索协议

```
统一命令：openclaw memory search "<关键词>" --max-results 3 --json

规则：
1. 先匹配锚点词 → 精确命中（优先）
2. 再匹配关键词 → 扫描索引
3. 最后语义搜索 → 回退方案
```

---

## 保存规则与入库标准

记忆只在明确指令下保存——兄弟说"保存"或"提交"时才写 daily log。不自动保存、不自动提交。

一条信息是否值得记入 MEMORY.md？满足以下**至少 2 条**：
- 会影响未来决策（>2 周有效期）
- 会被重复使用（流程/偏好/规则）
- 会造成明显损失（忘了会踩坑）
- 可操作、可验证（不是情绪感受）

**Daily Log 格式**：

```
日期 + 分类标题 + 结果（✅/❌）
├── 根因分析
├── 修复文件列表
├── 优化入库标记
└── 待继续事项
```

## 保存流程三件套

| 操作 | 做什么 | 推送？ |
|------|--------|--------|
| gts-save-flow | 审核→BDD→编译→规格→笔记→记忆→提交 | GitHub 两段同步 |
| gts-save-memory | daily log + commit + 笔记 + commit | 不 push |
| gts-submit-save | git commit + 记忆保存 | 不 push |

---

下期讲 **P24：Agent Brief 与 OpenCode 调度规范**——怎么写一个让 AI 不出错的 Brief。

**下一篇：[Vibe Coding 多人游戏（二十四）—— Agent Brief 与 OpenCode 调度规范](https://www.cnblogs.com/chaogex/p/21195307)**
