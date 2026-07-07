# Vibe Coding 多人游戏（三十三）—— 教训、反模式与设计模式

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

整个系列到这篇，大部分坑都讲过了。这篇把它们归成几类，再加 13 个可复用的设计模式。

---

## 6 类坑的 Root Cause

**1. 选型类**
- 帧同步很美但不适合 2 人场景
- Immutable.js 太重 → 自制 HashMap 有 bug → Js.Dict 够用
- Module._load hook 太复杂 → 直接注入 node_modules

**2. 部署类（6 连环）**
- undici@7 Node 18 vs Node 20 兼容
- zip 扁平结构路径解析不到
- scf_bootstrap 无执行权限
- ESM 与 CJS 的冲突
- Hook API 版本不一致
- Warm container 定时器残留

**3. AI 协作类**
- 偷换方案：AI 发现问题不汇报，自己换方案
- 拍脑袋修 bug：不看日志直接改代码
- 提前抽象：一个场景搞出全套设计模式
- 重复造轮：不知道已有工具函数

**4. 测试类**
- 集成测试 mock 假代码（测不到实际路径）
- E2E 前不重启（WS 断连卡死）
- HMR 断 WS（webpack 热更新导致退房）

**5. 工具类**
- Tool loop 不 yield（118 轮 → context overflow 炸 session）
- Socket hang up 误判（以为卡住其实在等输出）
- Object.keys(Immutable.Map()) 永远为真
- 状态重置遗漏（gameStop 未重置 flag）

**6. 状态管理类**
- AABB 不够 → OBB → 凸包
- Immutable.js → HashMap hash 冲突
- Js.Dict 类型不安全 → SoA

---

## 13 个可复用设计模式

| 模式 | 一句话 |
|------|--------|
| **服务端权威 + 绝对状态** | 最简多人同步方案 |
| **开闭原则** | AI 协作的第一架构约束 |
| **纯函数共享层** | ReScript + bundle，两端行为一致 |
| **渐进式碰撞精度** | AABB → OBB → 凸包，每步只解决当前痛点 |
| **代次守卫** | generation++ 乐观锁防定时器残留 |
| **SoA 状态管理** | 纯数据架构，WebGPU 就绪 |
| **事件驱动** | 新行为 = 新 handler，不改现有逻辑 |
| **防御式编程** | 参数必传、尽早 throw |
| **Test-as-documentation** | BDD + Specs = 活的文档 |
| **隔离层设计** | business_layer/multiplayer/ 安全沙箱 |
| **先跑通再工程化** | basic1 → new_basic2 → monorepo |
| **先状态同步再优化** | 不做 rollback、不做增量、不做预测 |
| **Skill 化流程** | 可执行的流程化知识 |

---

## 一句话总结

> **先把 demo 跑通，再想架构；先用状态同步，再想优化；先定义 Specs，再让 AI 干活。**

---

下期 **最后一篇：给下一个 Vibe Coder 的起步指南。**

**下一篇：[Vibe Coding 多人游戏（三十四）—— 给下一个 Vibe Coder 的起步指南](https://www.cnblogs.com/chaogex/p/21195307)**
