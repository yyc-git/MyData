# Vibe Coding 多人游戏（三）—— AI 做多人游戏的实操方法论

> 如果你是一个独立开发者，想用 AI 做一个多人线上游戏，从哪里开始？本文整理了当前已知的最佳实践：从 Tejas Kulkarni 的 1v1 FPS 完整复盘，到 Pieter Levels 的多人飞行模拟经验，再到 GitHub 上开源的可复用项目。

---

> 
> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序


## 案例一：Tejas Kulkarni 的 1v1 FPS（完整复盘）

**来源**：[Substack 文章](https://tejaskulkarni.substack.com/p/vibe-coding-a-3d-game-using-ai) | [GitHub 开源 mrkulk/3dfps-vibes](https://github.com/mrkulk/3dfps-vibes)（83.6% HTML + 15.8% JavaScript，运行：`node server.js`）

Tejas Kulkarni（前 MIT 研究员）做了一个实验：**完全用 AI 做一款多人 FPS 游戏，自己不手写一行代码。**

### 第一步：Grok 3 生成初版

他用了 Grok 3 作为首版生成器。原因：Grok 3 的超长上下文窗口和推理能力，让它能一次生成完整的 Three.js 游戏代码。

**实际提示词（按时间顺序）：**

```
阶段 1 — 初始化
"我想做一个 3D 多人 COD 风格的射击游戏"
"要浏览器能跑的"
"先用盒子代替模型，后面再换"
"接下来该加什么功能来迭代构建游戏？"

阶段 2 — 地图
"做一个经典的反恐精英风格地图，让人在浏览器上玩就上瘾"
"玩家高度太高了，看不到墙，有些门过不去"
"现在我没法移动了！"

阶段 3 — 移动
"加跳跃、上下坡移动，加蹲伏。把墙做高一点。"
"好的，但是在方块上走的时候会抖动"
"还是同样的问题！只有方块上会抖"
"把地图做大一点，加点阴影，让墙壁更容易辨别 lol"
"走路的时候要不要轻微的上下晃动？" → 最后设 bobFrequency = 3

阶段 4 — 视觉
"能不能做成白色线条绘画风格？"
"我要黑色边缘 + 白色背景，白色表面上有光照"
"好，视觉可以了，但 WASD 又不能动了……"
"行，好了。阴影能不能让黑色更自然一些？"
"好，在右下角加 logo.png"
"OK 可以了，接下来做什么？"
```

**关键发现**：提示词不写代码细节，而是写"感觉"——"抖了""太高了""过不去"——AI 能理解这种体验式反馈。

### 第二步：Cursor + Sonnet 3.7 迭代

代码量超过 3K 行后，Grok 3 的 UI 变得难以管理，生成速度也跟不上。Tejas 把代码全部复制到 **Cursor Composer + Sonnet 3.7** 中继续迭代。

### 第三步：多人同步——最难的部分

**他指出，多人游戏 debug 是整个流程中最耗时的一步。**

真实的调试提示词：

```
"有个 bug：另一个玩家能看到我，还有另一个我的复制体（同一个 mesh），但我看不到他。请修复多人逻辑中的所有 bug。"
"我有时候能看到对手，有时候射击不了，有时候又能。"
"新玩家加入或旧窗口重连时，加一个帅气的按钮叫'进入游戏世界'——不然太多过期窗口在游戏还在进行时自动重连。"
```

**对于系统性大 bug 的处理流程（他自己总结的）：**

```
1. 把全部代码复制到 Grok 3
2. 用自然语言描述问题
3. Grok 3 输出修复版代码
4. 复制回项目中
5. 测试 → 如不解决回到第 1 步
```

**GitHub 代码结构（3dfps-vibes）：**

| 文件 | 用途 |
|------|------|
| `server.js` | Node.js WebSocket 服务器，管理房间和状态同步 |
| `public/` | 前端静态文件（含所有 HTML + JavaScript + Three.js 代码） |
| `reset_rooms.js` | 房间重置脚本 |
| `reset_rooms_cli.js` | CLI 版本房间重置 |
| 语言占比 | HTML 83.6% + JavaScript 15.8% + Shell 0.6% |

运行方式只需要 `node server.js`。

### 最终产出

- ~5000 行代码（全部 AI 生成）
- 1v1 FPS，Three.js 渲染，WebSocket 多人同步
- 3D 素材来自 CSM.ai（AI 生成头像和个人资料图片）
- 约一个周末完成

**他本人的总结：**

> *"让我惊讶的是，LLM 能通过我的体验反馈（而不是技术规格）来理解和实现游戏机制。我不是在 debug 代码，而是在描述游戏感受——'方块上会抖'、'玩家高度太高'。"*
>
> *"最具挑战性的是多人同步和射击命中检测，这些需要更具体的技术提示词和更多轮迭代。"*
>
> *"当代码超过 3000 行后，Grok 3 的 UI 和生成速度变得无法管理，我只能转到 Cursor Composer。"*

---

## 案例二：Pieter Levels 的多人飞行模拟

详见系列第一篇。这里补充他的开发方法论：

### 工具链

```
Cursor + Claude Sonnet 3.5/3.7 → 前端 Three.js 代码
Grok 3 → Python WebSocket 服务器代码
ChatGPT → 辅助调试和修复
```

### 多人同步频率

**100ms 广播：** 每秒 10 次，接收并广播所有玩家位置。

这是一个很好的经验值：10Hz 的同步频率对于飞行模拟已经足够流畅。对于 FPS 可能是 20Hz。对于策略游戏 5Hz 就够了。

### 安全教训

> *"除非你明确要求它找到每一个 XSS 漏洞，AI 写代码的时候真不关心安全。你要专门让它检查代码，因为说实话，AI 写的代码安全漏洞可以很多。"*

---

## 案例三：其他独立开发者的实践

### Julius 的 Doodely——3 天多人画图猜词游戏

**来源**：[Medium 文章](https://medium.com/@julius.dev/how-i-built-a-multiplayer-drawing-game-in-3-days-as-a-frontend-beginner-using-cursor-62840e7d3f1d)

一个前端新手用 Cursor 在 3 天内完成了多人画图猜词游戏：

- 技术栈：React + Cursor + WebSocket
- 自己制定极简 MVP 范围：不做账号、不下载、不菜单
- 游戏循环：画 → 猜 → 计分 → 重复
- 他认为 AI 辅助开发帮他：速度更快、保持心流、学习新模式

> 虽然 Medium 付费墙挡住了完整内容，但这个案例验证了一个模式：**前端新手也能用 AI 在 3 天做多人游戏。**

---

## 方法论总结：AI 多人游戏的标准化流程

### 阶段 1：首版生成（0-1 小时）

**推荐工具：Grok 3 或 Claude**

提示词结构示例：

```
I want to create a [type] multiplayer [genre] game
It must be browser-based using Three.js
Use WebSocket for multiplayer (Node.js server)
Start with simple geometry (boxes), we'll replace assets later
```

**为什么首版用 Grok 3：**
- 超长上下文窗口，能一次性生成完整的 HTML + JS + 服务器文件
- 推理能力强，理解 3D 游戏的空间逻辑
- 缺点是 UI 大代码量后会卡顿

### 阶段 2：迭代优化（1 小时 - 若干天）

**推荐工具：Cursor + Claude Sonnet 3.5/3.7**

- 代码复制到 Cursor Composer 中
- 用"体验式反馈"描述问题（"太矮了""会不会抖"）
- 每轮迭代玩测试一次
- 代码超过 3K 行后 Cursor 效率最高

### 阶段 3：多人同步调试（最耗时）

**策略：**
1. 真人对战测试——不止一个人，要 3-5 人同时测
2. 问题描述要具体——"我看到复制体""我能射击但没伤害"
3. 系统性 bug → 整段代码喂给 Grok 3 修复
4. 小 bug → Cursor Composer 逐步修复

### 阶段 4：安全审查（容易被忽略）

**必须专门让 AI 检查：**
- XSS（跨站脚本）
- WebSocket 消息注入
- 玩家位置作弊
- 输入验证

### 阶段 5：部署上线

推荐方案（从轻到重）：
1. **最小方案**：1 台 Hetzner VPS + Node.js/Python 直接跑 → 够 1K 同时在线
2. **中型方案**：VPS + Cloudflare 反代 → 够 10K
3. **大型方案**：Multi-VPS + Cloudflare + Pietflare 级防护 → 20K+

---

## 推荐的 GitHub 开源项目

| 项目 | 说明 | 链接 |
|------|------|------|
| **mrkulk/3dfps-vibes** | 完整的 1v1 FPS，Three.js + WebSocket | github.com/mrkulk/3dfps-vibes |
| **[yusufgurdogan/fly_pieter_com](https://github.com/yusufgurdogan/fly_pieter_com)** | fly.pieter.com 的第三方部署镜像，含 Cloudflare 配置 | GitHub |
| **[AidanNelson/threejs-webrtc](https://github.com/AidanNelson/threejs-webrtc)** | Three.js 多人模板（WebRTC） | GitHub |

---

## 资料来源

- [Tejas Kulkarni — Vibe Coding a Multi-player 3D FPS Game using AI](https://tejaskulkarni.substack.com/p/vibe-coding-a-3d-game-using-ai)（Substack, 2025-03-10）
- [GitHub — mrkulk/3dfps-vibes](https://github.com/mrkulk/3dfps-vibes)（代码结构分析）
- [GitHub — yusufgurdogan/fly_pieter_com](https://github.com/yusufgurdogan/fly_pieter_com)（第三方镜像）
- [@levelsio/X — 多人上线成功 (2025-02-25)](https://x.com/levelsio/status/1894429987006288259)
- [Julius — How I Built a Multiplayer Drawing Game in 3 Days](https://medium.com/@julius.dev/how-i-built-a-multiplayer-drawing-game-in-3-days-as-a-frontend-beginner-using-cursor-62840e7d3f1d)（Medium, 2025-07-23，需会员）
- [YouTube — @levelsio made a flying sim with AI so I hacked it with AI](https://www.youtube.com/watch?v=cvtktdSdIrE)

**下一篇：[Vibe Coding 多人游戏（四）—— 从 levelsio 到 GTS-Play — 能抄什么](https://www.cnblogs.com/chaogex/p/21195307)**


---
> 本文由 AI 助手辅助调研写作，基于公开资料整理。