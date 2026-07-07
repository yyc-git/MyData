# Vibe Coding 多人游戏（十五）—— 完整 Vibe Coding 工作流全景

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

前 3 篇讲完了工作流进化的各个阶段——从 AI 辅助编程到 OpenClaw 全自动，再到 OpenCode 分层调度，再到 Skill 固化流程和 E2E 自测体系。这篇把整个流程串起来，画一张全景图。

但在给流程图之前，我想先讲一个具体的故事。因为只有理解了"一个完整的迭代长什么样"，你才能体会这张图真正在做什么。

---

## 一个完整迭代：从一句话到生产上线

**2026 年 7 月 5 日。** 用户报告了一个问题：多人游戏从关卡退出后，再次进入时，HUD 不显示了。

**10:00 我发了一条消息：**
> "修复场景重入后 HUD 不显示。症状：退出关卡再进，玩家血条（HP bar）消失了。"

**10:00-10:05 OpenClaw 调度：**

OpenClaw 匹配 `gts-dev-fix` Skill。Skill 的第一步：搜索相关代码。

```
搜索关键词：HUD、HP bar、scene re-enter、showHPBar
匹配文件：
- packages/frontend/src/ui_layer/game/Hud/index.ts (HUD 管理)
- packages/frontend/src/ui_layer/game/HPbar/index.ts (血条组件)
- packages/render/src/hud/createHPBarSprite.ts (血条精灵创建)
- packages/render/src/hud/adjustAllHpBarPositions.ts (血条位置调整)
```

然后 OpenClaw 读取最近的运行日志。日志里发现了一个可疑的警告：

```
[HUD WARN] Sprite.shared.geometry.already.exists.on.scene.re-enter
```

这说明问题出在"共享几何体"上。退出关卡时，HUD 的 Sprite 被销毁了，但 Sprite 共享的几何体还在场景中残留。再次进入时，创建新 Sprite 发现共享几何体还在，就没重建——结果 Sprite 没有几何体，渲染不出来。

**10:05 OpenClaw 生成 Brief：**

```
## 目标
修复场景重入后 HUD 不显示的 bug

## 文件范围
- packages/render/src/hud/createHPBarSprite.ts（共享几何体残留）
- packages/render/src/hud/adjustAllHpBarPositions.ts（距离钩位未重置）
- packages/frontend/src/ui_layer/game/Hud/index.ts（退出清理逻辑）

## 根因分析
退出关卡时 Sprite 销毁但共享几何体未销毁，场景重入时 Sprite 跳过几何体创建。

## 红线
- 改 .ts 再 tsc，不改 .js
- 不改 node_modules
- 不改单机代码

## 测试
- 新增集成测试：场景重入后 HUD 完整渲染
```

**10:05-10:15 OpenCode 编码：**

OpenCode 收到 Brief，开始工作。

第一步：读 `createHPBarSprite.ts`。找到了问题——`initSprite` 函数里有缓存检查"if (existingGeometry) return"，但没有对应的"退出时清除缓存"。

修改：

```typescript
// 修改前
function clearAllHpBarSprites(scene: Scene) {
    hpBarSprites.forEach(sprite => scene.remove(sprite));
    hpBarSprites = [];
    // 缺了一句：清除共享几何体
}

// 修改后
function clearAllHpBarSprites(scene: Scene) {
    hpBarSprites.forEach(sprite => scene.remove(sprite));
    hpBarSprites = [];
    clearAllHpBarGeometries(); // 新增：同时清除共享几何体
}
```

第二步：检查 `adjustAllHpBarPositions`。发现退出时位置的"距离钩位"参数也没重置。修改：`resetHpBarPositions()` 加在退出流程里。

第三步：tsc 编译。有一个类型错误——`clearAllHpBarGeometries` 的函数签名和导入不匹配。自动修复。

第四步：跑 BDD。新增的场景"场景重入后 HUD 完整渲染"先因 bug 真实失败（红），修复后通过（绿）。原有测试全通过。

**10:15-10:16 验收 + 部署：**

BDD 7 场景全通过。`gts-deploy` Skill 自动触发：打包 → zip → 上传 SCF → 发布 → 验证。

**10:16 通知：**
> "修复完成，已部署上线。修改了 3 个文件：createHPBarSprite.ts（+
> 共享几何体清理）、adjustAllHpBarPositions.ts（位置重置）、Hud/index.ts（退出清理流程）。新增 1 个 BDD 场景覆盖。生产环境验证通过 ✅"

全程 16 分钟。其中我说了一句话 30 秒，AI 写了 15 分钟代码。

---

## 完整工作流

```
你（一句话需求）
    │
    ▼
┌────────────────────────────────────────────┐
│            OpenClaw 调度层                  │
│                                            │
│  1. 接收需求（飞书/微信）                    │
│  2. 匹配 Skill（gts-dev-fix/feat/refactor） │
│  3. 搜决策记录 + 记忆（memory_search）       │
│  4. 读项目 context（agent-context.md）       │
│  5. 读相关代码 + 日志                        │
│  6. 生成 Brief（需求 + 根因 + 红线 + 测试）  │
│  7. 💬 等确认（"Brief 可以吗?"）            │
│  8. 调度 OpenCode                            │
│                                            │
└─────────────┬──────────────────────────────┘
              │ Brief
              ▼
┌────────────────────────────────────────────┐
│            OpenCode 编码层                  │
│                                            │
│  1. 读文件 → 理解代码（read）               │
│  2. 改代码（edit/write）                    │
│  3. tsc / rescript build（编译检查）         │
│  4. 发现错误 → 自修                          │
│  5. 跑 BDD 测试 → 失败 → 继续修             │
│  6. 新增测试（红 → 绿 → 锁定）              │
│  7. 全部通过 → 输出修改报告                  │
│                                            │
└─────────────┬──────────────────────────────┘
              │ 代码 + 测试通过
              ▼
┌────────────────────────────────────────────┐
│            验收 + 部署                      │
│                                            │
│  1. BDD 测试（7 场景全覆盖）                 │
│  2. E2E 双窗口验证（如需）                   │
│  3. deploy-scf.js（打包→zip→上传→发布）      │
│  4. 部署后自动日志检查（gts-logs）            │
│  5. 💬 通知完成（"已上线，验证通过"）          │
│                                            │
└────────────────────────────────────────────┘
```

这个流程里有两个关键节点被标注了 "💬 等确认"。一个是 **Brief 出方案后**，一个是 **部署完成后**。这两个确认节点是我坚持保留的——**AI 可以写代码、跑测试、部署上线，但最终决策权在我手上。**

---

## 治理制度

流程跑起来后，需要一些制度让它不掉链子。这些制度不是一次性的，是在实操中逐步建立起来的。

**1. 入口检查**：每次收到新消息先检查后台任务是否完成。OpenClaw 处理一个任务时，如果兄弟又发了新消息，可能直接接新活而忘了后台还有任务在跑。所以加了一条规则：每条消息进入后先跑 `process(list)`，有已完成的任务先汇报再处理新消息。

**2. 先汇报再继续**：OpenCode 出结果后，必须出声总结再下一步。OpenClaw 默认是先干活不出声直到完成，但兄弟需要过程可见性。所以规则是：OpenCode 出结果后 OpenClaw 立刻给摘要，然后再继续下一步。

**3. 等确认发通知**：需要我决策时，发桌面通知 + 飞书消息双重通知。如果兄弟在飞书上发完消息就切去看别的窗口了，飞书通知不一定能立即看到。所以加了桌面弹窗 `msg * "请确认部署方案"`，确保即使不在聊天工具面前也不会错过决策请求。

**4. 双通道通知**：重要事件走两个通道：
   - 桌面弹窗：`msg * "<消息>"`，确保即使我没看聊天工具也能被提醒
   - 聊天工具补充：通过 cron announce 的 feishu 或 clickclack 通道

**5. 保存节奏**：每完成一个迭代，自动触发 `gts-save-flow`——git commit + 记忆保存。不 push（push 是手动触发的，因为线上部署需要谨慎）。记忆保存包括：daily log、决策记录（ADR）、修改文件清单。这些记忆在下次搜索时就会用到。

---

## 工作流的关键参数

| 阶段 | 典型耗时 | 谁来监督 | 谁在执行 |
|------|---------|---------|---------|
| 需求描述 | 30 秒 - 2 分钟 | 你 | 你 |
| 匹配 Skill | 1 秒 | 自动 | OpenClaw |
| 读记忆 + 搜索代码 | 3-10 秒 | 自动 | OpenClaw |
| Brief 生成 | 5-10 秒 | 自动→你确认 | OpenClaw |
| OpenCode 编码 | 3-15 分钟 | OpenClaw（连续 poll） | OpenCode |
| 编译测试 | 自动 | OpenCode | OpenCode |
| BDD 验收 | 30 秒 - 2 分钟 | 自动化 | 自动化脚本 |
| 部署 | 10-30 秒 | deploy-scf.js | 自动化 |
| 部署后验证 | 10-30 秒 | BDD 场景 | 自动化 |

从需求到上线，最慢 20 分钟，最快 5 分钟。

**但这里面有一个隐形成本——"确认等待"。** 如果我在开会或者睡觉，流程就卡住了。对于小型改动（比如改个配置属性、修复一个不影响流程的日志级别），会尽量缩短 Brief，但确认步骤不绕过——决策权在我手上是底线。

---

## 为什么不是全自动化

你可能想问：为什么不把"你"也去掉？让 AI 自己提需求、自己开发、自己上线？

说实话，我也想过这个问题。2026 年 6 月加入 OpenCode 调度模式后，有好几次我忍不住想："我干脆消失一周，让 AI 自己迭代得了。"

但理性告诉我：不行。

答案：**因为"做什么"比"怎么做"难一万倍。**

AI 目前能做的很好的是"怎么做"——写代码、跑测试、部署。但"做什么"需要深刻理解用户想什么、判断哪些功能有价值、权衡短期收益和长期架构成本。

举个例子：GTS-Play 里有个讨论——要不要引入 WebGPU 渲染管线？

从技术角度看，WebGPU 的 draw calls 效率比 WebGL 高 10 倍，未来是趋势。从 AI 角度，它可能会说"当然要上，性能提升 10 倍"。

但我判断：不对。WebGPU 浏览器覆盖率不到 40%，而且我们的用户来自移动端，移动端 WebGPU 还没普及。投入 3 个月时间做 WebGPU 管线，意味着 3 个月忽略核心游戏机制改进——这个 trade-off AI 算不出来。

所以，我的决定是：**短期用 WebGL，WebGPU 作为调研跟踪项目。** 这个决定不是因为 AI 做不了，而是因为 AI 没有"商业感觉"。它在信息不完整的情况下做出的决策，可能技术上最优但产品上最糟。

> **Vibe Coding 不是"不用人编程"，而是"人做决策，AI 做执行"。**

对于纯技术性的决策——比如"用状态同步还是帧同步"、"Immutable.Map 还是普通对象"——AI 的判断比我准。但对于"做不做这个功能"、"什么时候做"、"做到什么程度"——这些东西只有做产品的人才知道。

---

## 全景图之外：Skill 的进化

工作流建成后，我花了大量时间在另一件事上：**Skill 的持续迭代。**

最好的例子是 E2E 流程 Skill 的演进。

2026 年 6 月 20 日，`gts-e2e-test` Skill 的第一个版本只有 3 步：

1. 启动 room-service + match-service
2. 启动 frontend
3. 在浏览器里手动测试

一周后，加入自动化测试场景。

两周后，加入性能录制。

三周后，加入 WebSocket 就绪检查、端口 LISENING 匹配的精确检测、`-WindowStyle Hidden` 的进程隔离。

**Skill 是有生命力的。** 它不是写一次就用到底的文档，而是在每次踩坑后持续迭代的流程。

我们用 `决策记录/` 来管理 Skill 的变更历史。每次踩坑出对策，先更新决策记录，再更新 Skill。所以这里有一个完整的链条：

```
踩坑 → 决策记录（ADR）→ Skill 更新 → 下次不会再犯
```

链条是双向的：AI 修 bug 时先去决策记录里搜"有没有类似的修法"，如果有，顺着记录找到对应的 Skill。如果没有，修好后补新的决策记录。

---

工作流讲完了。从下期开始转入**知识管理和经验教训**板块——项目运行中积累的经验教训怎么被体系化保存下来，以及最重要的：踩过的坑怎么保证永远不踩第二次。

**下一篇：[Vibe Coding 多人游戏（十六）—— Vibe Coding 经验和教训合集](https://www.cnblogs.com/chaogex/p/21195307)**
