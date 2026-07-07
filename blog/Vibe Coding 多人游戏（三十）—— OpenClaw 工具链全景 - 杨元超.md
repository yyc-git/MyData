# Vibe Coding 多人游戏（三十）—— OpenClaw 工具链全景

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

OpenClaw 是一个 AI 网关/代理平台，GTS-Play 用它做开发流程的调度层。全套工具链包含 16 个 Skill。

---

## 16 个 Skill 全家桶

**开发类：**
| Skill | 作用 |
|-------|------|
| gts-dev-feat | 新功能开发——调度 OpenCode 生成代码 |
| gts-dev-fix | Bug 修复——分析日志 + 锁定测试 + 修复 |
| gts-dev-refactor | 代码重构——不改变行为只改结构 |

**测试类：**
| Skill | 作用 |
|-------|------|
| gts-e2e-test | 手动 E2E 测试（双窗口） |
| gts-e2e-auto | 自动化 E2E scenarios |
| gts-e2e-perf | 性能测试（FPS/CPU 热点） |
| gts-test | BDD 集成测试 |

**部署运维类：**
| Skill | 作用 |
|-------|------|
| gts-deploy | 部署到腾讯云 SCF |
| gts-service | 启动/重启/停止本地服务 |
| gts-logs | 自动抓取 SCF 日志 |

**代码管理类：**
| Skill | 作用 |
|-------|------|
| gts-save-flow | 审核→BDD→编译→规格→笔记→记忆→提交 |
| gts-save-memory | 保存 daily log + commit |
| gts-git-commit | git add → commit（或 push） |
| gts-git-pull | 从 GitHub 拉取更新 |

**辅助类：**
| Skill | 作用 |
|-------|------|
| gts-analysis | 分析需求/方案，输出报告 |
| gts-code-review | 代码审查（调度 OpenCode 审） |
| gts-recall | 查记忆+近对话，分析工作进展 |

---

## 通知通道

| 通道 | 用途 | 优先级 |
|------|------|--------|
| 桌面通知（msg *） | 需要兄弟确认时 | 最高 |
| 聊天工具 | 日常通知 | 正常 |

规则：需要兄弟决策时，**必须发桌面通知**。不能假设对方在聊天工具前。

---

## 入口检查协议

每次收到消息后，第一件事：检查后台任务是否完成。有已完成任务先汇报，再接新活。

这是最高频的违规项——但也是最容易记住的：**先查后做，先汇报再接。**

---

下期讲 **P31：前端性能优化（含 AI 素材管线）**——SoA、帧管理、MMD+FBX、AI 生成 3D。

**下一篇：[Vibe Coding 多人游戏（三十一）—— 前端性能优化](https://www.cnblogs.com/chaogex/p/21195307)**
