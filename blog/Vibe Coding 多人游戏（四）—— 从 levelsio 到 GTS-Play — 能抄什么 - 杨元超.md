# 从 levelsio 到 GTS-Play — 能抄什么

> 在 AI 时代，一个人做多人游戏已经不再是天方夜谭。Pieter Levels 的 fly.pieter.com 单人 3 天上线、17 天 $1M ARR；Tejas Kulkarni 的 1v1 FPS 用 AI 一行行写出来；Vibe Jam 2026 的 Top 12 几乎全是多人游戏。
>
> 这篇回到我的项目 GTS-Play，看看从他们身上能偷师什么。
> 
> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

## GTS-Play 的技术栈现状

| 模块 | GTS-Play 当前方案 | 行业标准方案 |
|------|-------------------|-------------|
| 渲染引擎 | Three.js + React | Three.js（主流） |
| 多人通信 | TSRPC（WebSocket） | Python/Node WebSocket |
| 代码工具 | OpenCode 辅助 | Cursor / Claude Code |
| 部署 | SCF 无服务器 | Hetzner VPS + Cloudflare |
| 工程化 | Lerna monorepo | 简单结构 / monorepo 均可 |
| 美术资源 | 待完善 | Tripo3D / CSM.ai |
| 音乐/音效 | 待完善 | Suno / ElevenLabs |

坦白讲，GTS-Play 的技术选型在方向上是对的——Three.js + WebSocket 是行业标准。差异在工程复杂度和打法上。

---

## 维度对比

| 维度 | Pieter Levels | GTS-Play | 能抄的 |
|------|--------------|----------|--------|
| 团队 | 1人 | 1人 | 战略层面一样 |
| 开发周期 | 3天上线 | monorepo 持续开发 | Pieter 赢 |
| 代码规模 | 1个HTML文件 | 多 package | 各有利弊 |
| 多人 | Python WebSocket 100ms | TSRPC | GTS 更结构化 |
| 变现 | 广告牌 $5K/月 | 未确定 | Pieter 赢 |
| 部署 | VPS + Cloudflare | SCF 无服务器 | 各有优劣 |
| Build in Public | 全程直播 | 未公开 | Pieter 赢 |
| 美术素材 | 暂无（基本盒子） | 暂无 | 平手 |
| 3D模型 | 未使用 | 需要参考 | Tripo3D |

---

## 能直接抄的 6 件事

### 1️⃣ 加速上线：MVP 思维

Pieter 的整个游戏 = 1 个 HTML 文件。Tejas 的 FPS = `node server.js` 就能跑。

GTS-Play 的 monorepo 是 Lerna 管理，用了 React、TSRPC、分房间/匹配服务。工程化是好事，但也意味着**发布迭代慢**。

**建议：**
- 保持 monorepo 的结构，但内部搞一条"快速发布通道"
- 核心功能模块化，不阻塞发布流程
- 每个小功能不经过完整的 CI/CD 全流程，fast track

### 2️⃣ 变现模式：广告牌 > 卖游戏

Pieter 的广告牌 $5K/月，几十个品牌排队买。他还卖 F-16 升级 $29.99，以及 UFO 品牌广告。

与之对比，大部分独立游戏走的是买断制 → 收入一把清，推广成本高。

**建议落地到 GTS-Play：**
- 游戏内广告牌/场地冠名（虚拟世界的摩天楼、广告墙）
- 品牌定制道具（某某航空的定制飞机）
- 开放给独立开发者/小团队做低成本推广
- 价格可以从 $100/周 到 $5K/月 分级

### 3️⃣ Build in Public

这是 Pieter 最核心的流量密码。他不是做完游戏再推广，而是一边做一边推。

**建议在 GTS 上也做：**（如果兄弟有空）
- 在 X/微博/B站 直播开发过程
- 每次修 bug、加功能、部署都发一条
- 用 GTS-Play 自己的游戏做展示
- 记录技术选型、踩坑过程——这些本身就是内容

### 4️⃣ 多人游戏的同步策略

Pieter 的经验值：**10Hz（100ms）** 广播玩家位置。

对于 GTS-Play：
- **绝对状态同步**——当前的做法方向正确
- 同步频率可以根据游戏类型调整：动作类 20Hz，策略类 5Hz
- 不需要实时广播全部数据，按需增量同步

### 5️⃣ 安全防护提前想

Pieter 的教训：AI 写的代码安全漏洞多，必须专门让 AI 做安全审查。

GTS-Play 作为大型多人游戏，安全问题更复杂：
- TSRPC 的输入校验和鉴权
- 玩家位置/状态校验（防止外挂）
- WebSocket 消息大小限制
- DDoS 防护（Cloudflare）

建议尽早把安全审查加入 CI 流程中，不要等上线再处理。

### 6️⃣ AI 素材管线

Vibe Jam 金奖的游戏用了 Tripo3D 生成 3D 素材 + Suno 做音乐。一个人搞定了原本需要建模师 + 作曲师的工作。

**建议评估的工具（全部 AI 生成，无版权问题）：**
- **Tripo3D**：文本 → 3D 模型，适合做角色、道具、建筑
- **CSM.ai**：图片 → 3D 模型
- **Suno**：文本 → 音乐（背景音乐、主题曲）
- **ElevenLabs**：文本 → 语音（角色配音、音效）

---

## GTS-Play 相比 Pieter 的优势

不是只有 Pieter 的经验能抄，GTS-Play 在某些方面比他的方案更好：

| 方面 | Pieter 的方案 | GTS-Play 的优势 |
|------|-------------|----------------|
| 通信协议 | 原始 WebSocket | TSRPC 带类型安全、请求-响应模式 |
| 前后端 | 1个HTML文件 | React 组件化，可维护性高 |
| 房间管理 | 在内存中 | room-service 有状态管理 |
| 匹配系统 | 无 | match-service 专门匹配 |
| 部署 | 手动 VPS | SCF 自动扩缩容 |
| 代码组织 | 单体文件 | monorepo 按功能分包 |

**GTS-Play 的工程化是防守优势（好维护、好扩展），Pieter 的简单是进攻优势（上线快、迭代快）。**

---

## 实操行动清单

按优先级排列：

### 🔴 P0 — 立刻做
- 用 Tripo3D 生成一批 3D 素材替换占位模型
- 用 Suno 生成游戏背景音乐
- 评估广告牌变现方案（先想好价格和展示位置）

### 🟡 P1 — 近期做
- 抽出"快速发布通道"（不经过完整流程也能推小更新）
- 写一份 AI 安全审查 check-list 加入 CI
- 开始 Build in Public（至少每周发一条进展）

### 🟢 P2 — 长远规划
- 对比 TSRPC 和原始 WebSocket 的多人同步性能差异
- 调研 Pietflare 方案，考虑 GTS-Play 的防 DDoS 策略
- 评估 Vibe Jam 2027 参赛的可能性

---

## 最后说两句

Pieter Levels 的 fly.pieter.com 为什么成功？不是技术好（AI 写的代码安全漏洞一堆），不是画面好（基本只有盒子和飞机），不是玩法特别创新（就是飞+射）。

**成功的原因是：他做出来了，上线了，并且全程在直播。**

在 2025-2026 这个时间点，AI 已经把做多人游戏的门槛降到了一个人 + 一个周末。剩下的就是：开始做、做出来、让人知道。

GTS-Play 已经在路上了。🤜

---

## 研究方法说明

本文的结论基于以下研究素材：
- Pieter Levels 的 fly.pieter.com 故事及技术架构（P1）
- Vibe Jam 2026 的技术栈全景分析（P2）
- AI 做多人游戏的 5 阶段实操方法论（P3）

> *本文写于 2026-07-06，基于当时可获取的资料。Vibe Coding 领域发展很快，结论可能随时过时。*

---

**下一篇：[实战总览：从 0 到 1 的时间线地图](https://www.cnblogs.com/chaogex/p/21195307)**
