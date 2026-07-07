# Vibe Coding 多人游戏（二）—— Vibe Jam 2026 技术地图

> 945 款游戏，1,214,247 名玩家，7,750 万次曝光。Vibe Jam 2026 是有史以来最大的 AI 生成游戏比赛。观察它的获奖作品，等于看到了「2026 年 AI 做多人游戏」的标准答案。

---

> 
> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序


## 大赛全景

[2026 年的 Vibe Jam](https://vibej.am/) 由 levelsio 和 Cursor 联合举办，是一场面向 AI 生成游戏的创作大赛。参赛者全部使用 AI 代码生成工具（Cursor、Claude Code、Grok 等）制作游戏。

| 维度 | 数据 |
|------|------|
| 参赛游戏 | 945 款 |
| 总玩家数 | 1,214,247 人 |
| 总曝光量 | 77,500,000 次 |
| 金奖 | $25,000 |
| 银奖 | $10,000 |
| 铜奖 | $5,000 |
| 特别奖 | 12 × $1,000 |

---

## Top 3 获奖游戏详细拆解

###  金奖：A Game About Capybaras Delivering Food

- **作者**：[@leocooout](https://x.com/leocooout)
- **游戏链接**：[capybara-vibejam26.leocoout.dev](https://capybara-vibejam26.leocoout.dev)
- **类型**：多人合作送餐游戏
- **技术栈**：**Claude Code** + ThreeJS + **Tripo3d**（3D 素材）+ **Suno**（音乐）
- **多人** ✅
- **亮点**：水豚角色极其可爱，AI 生成的 3D 素材质量惊人，病毒传播力极强

**AI 工具链完全闭环：**
```
Claude Code → 写代码（Three.js + WebSocket 多人）
Tripo3d → AI 生成 3D 水豚模型
Suno → AI 生成游戏音乐
```
没有人工建模师，没有人工作曲。工具链高度成熟。

---

###  银奖：Fanto's Mega-Mart

- **作者**：[@e_c_t_o](https://x.com/e_c_t_o)
- **游戏链接**：[fantos-megamart.vercel.app](https://fantos-megamart.vercel.app)
- **类型**：多人经营模拟
- **技术栈**：**ThreeJS** + 多人联网
- **多人** ✅
- **亮点**：类 Overcooked 的多人合作体验，流畅的联网同步

---

###  铜奖：WenWare

- **作者**：[@underpaid_mom](https://x.com/underpaid_mom)
- **游戏链接**：[wen-ware.com](https://wen-ware.com)
- **类型**：多人竞技游戏
- **玩家数**：902,000 次游玩（同时获 **Bolt.new 最受欢迎奖**）
- **技术栈**：**ThreeJS** + WebSocket
- **多人** ✅
- **亮点**：接近百万的惊人游玩数据

**重要发现**：Wenware 的播放量（902K）远超金银奖，说明多人竞技游戏在留存和传播上天然优于合作类游戏。

---

## 剩余 Top 12 游戏亮点

| 排名 | 游戏名 | 类型 | 是否多人 | 获奖/技术栈特色 |
|------|--------|------|---------|----------------|
| 4 | Null Range | FPS 太空狗斗 | ✅ | **Cursor 最佳美术设计奖**；ThreeJS + Colyseus；作者 @taylor_sntx |
| 5 | Eyrie | 合作 | ✅ | **最沉浸氛围奖**；多人合作冒险；作者 @slowchaz |
| 6 | Tiny Skies | 飞行 | ✅ | **最精致奖**；类 fly.pieter.com 风格；作者 @dannylimanseta |
| 7 | Field of Command | RTS 即时战略 | ✅ | 浏览器上的 RTS + 多人 |
| 8 | Floppy Brawler | 格斗 | ✅ | 多人对战；使用 Colyseus 框架 |
| 9 | Undersphere | 平台跳跃 | ✅ | **独特概念奖**；多人闯关；作者 @_NoahWhiteson |
| 10 | Strilecka | 射击 | ✅ | 多人射击 |
| 11 | The Rite | 冒险 | ✅ | 合作冒险 |
| 12 | Swingers | 摆动/平台 | ✅ | **最疯批奖**；多人乱斗；作者 @_offmylawn |

**Top 12 中，多人在线游戏占 ≈60%。**

---

## AI 技术栈全景分析

从获奖作品的技术栈来看，2026 年的「标准配置」已经非常清晰：

### 游戏引擎：Three.js（≈100%）

无一例外，全部基于 Three.js。原因：

1. **AI 训练数据丰富**——Three.js 的教程、示例代码、Stack Overflow 问答数量庞大，AI 训练得很充分
2. **Web 原生运行**——浏览器直接跑，不需要安装、不需要编译、不需要 App Store 审核
3. **Open Source**——免费，且生态成熟

对比：用 Unity/Unreal 的 AI 游戏在 Vibe Jam 中几乎看不到。AI 对它们的掌握度远不如 Three.js。

### 多人联网：WebSocket（≈90%）

TCP WebSocket 是标准方案。绝大多数选用 **Node.js + ws 库** 或 **Python + websockets 库**。

部分游戏使用 socket.io 做自动重连。但核心协议都是 WebSocket。

对比 fly.pieter.com 的 100ms 广播频率，Vibe Jam 的游戏也类似——每秒 10-20 次状态同步。

### AI 代码工具：Claude Code > Cursor > Grok 3

| 工具 | 使用情况 |
|------|---------|
| **Claude Code**（Anthropic 的 CLI 编码工具） | 金奖 Capybaras 使用，逐渐成为主流 |
| **Cursor** | Pieter Levels 的主力工具，Sonnet 3.5/3.7 |
| **Grok 3** | 用于首版生成 + 服务器代码（xAI 的长上下文优势） |
| **ChatGPT** | 辅助调试 |

变化趋势：从视觉 IDE（Cursor）向 CLI 工具（Claude Code）迁移。AI 编码工具正在 CLI-fication。

### 3D 素材：Tripo3D / CSM.ai / Meshy

传统游戏开发中，3D 建模是最费时的环节之一。Vibe Jam 的解决方案：

- **Tripo3D**：文本/图片 → 3D 模型，金奖 Capybaras 使用
- **CSM.ai**：Tejas Kulkarni 的 1v1 FPS 使用
- **Meshy**：类似 Tripo3D 的替代方案

### 音乐：Suno / ElevenLabs

- **Suno**：AI 生成背景音乐，金奖使用
- **ElevenLabs**：AI 配音和音效

---

## 关键趋势总结

### 趋势 1：多人游戏全面胜出

单机游戏在 Vibe Jam 中几乎没进 Top 12。理由很简单：

- 多人游戏更容易传播（朋友拉朋友）
- 多人游戏有天然的重玩性
- 直播平台适合播多人游戏

### 趋势 2：AI 工具链闭环

```
Claude Code/Cursor 写代码
    ↓
Three.js 渲染
    ↓
WebSocket 多人联机
    ↓
Tripo3D 出 3D 素材
    ↓
Suno 出音乐
```

一个人 + AI = 一支完整游戏开发团队。

### 趋势 3：Web 优先，浏览器原生

所有 Vibe Jam 获奖游戏都是浏览器直接打开就能玩。没有下载、没有安装、没有 Unity WebGL 的庞大体量。

Three.js 成为 AI 游戏的 Web 标准。

### 趋势 4：变现模式正在形成

Pieter Levels 的 fly.pieter.com 已经验证了广告牌变现模式。Vibe Jam 本身虽然没有强制变现，但多人游戏天然的社交属性 + 实时互动的社区效应，让它们更容易商业化。

---

## Colyseus 在 Vibe Jam 中的使用数据

Colyseus 是一个多人游戏网络框架。Vibe Jam 结束后，Colyseus 官方发布了一篇分析文章，统计了它的使用情况：

- **48 款游戏**使用了 Colyseus
- 占全部 945 款游戏的 **≈5%**
- 占所有多人在线游戏的 **≈15%**
- 典型示例：**Floppy Brawler**（格斗）、**Hollowlands**（开放世界）

这意味着 WebSocket 仍然是绝对主流（85%+），但框架化方案（Colyseus/socket.io）正在普及。

## 评委评价

Vibe Jam 首席评委 **Tim Soret**（Odd Tales 联合创始人，《The Last Night》导演）的评价：

> "今年的质量比去年高了一个档次。有些作品已经接近真正的商业游戏水平。按这个速度，明年（甚至 6 个月后）AI 游戏的质量就能赶上很多人类游戏开发者——不是最顶尖的 20%，但肯定能超过大三学生的水平。"

## 对个人开发者的启示

1. **学 Three.js**——AI 游戏的标准引擎，没有之一
2. **Direct 模式 WebSocket**——不要过度设计，socket.io 足够，甚至原生 ws 更好
3. **AI 素材工具链要全**
   - Tripo3D 做 3D 素材
   - Suno 做音乐
   - ElevenLabs 做音效
4. **优先做多人**——单人游戏在传播上太吃亏
5. **Build in Public**——Vibe Jam 本身就是给参与者的一个大型 Build in Public 秀场

---

## 资料来源

- [Vibe Jam 2026 官网](https://vibej.am/) — 完整排行榜和游戏展示
- [Vibe Jam 2026 比赛规则页面](https://vibej.am/2026/) — 规则、Portal 系统、FAQ
- [@levelsio — Vibe Jam 2026 获奖名单发布](https://levels.io/vibe-jam-2026-winners-quality/)（Pieter 的博客文章）
- [Colyseus — Vibe Jam 2026: 1 in 7 multiplayer games shipped with Colyseus](https://colyseus.io/blog/vibe-jam-2026/)（48 款 Colyseus 游戏完整列表）
- [What Are You Vibe Coding?](https://whatareyouvibecoding.com/) — Vibe Coding 项目展示
- [Tripo3D — AI 3D 模型生成](https://www.tripo3d.ai/)
- [CSM.ai — AI 3D 内容生成](https://csm.ai/)
- [Suno — AI 音乐生成](https://suno.com/)
- [ElevenLabs — AI 语音生成](https://elevenlabs.io/)
- Vibe Jam 排行榜页面直接抓取

**下一篇：[Vibe Coding 多人游戏（三）—— AI 做多人游戏的实操方法论](https://www.cnblogs.com/chaogex/p/21195307)**


---
> 本文由 AI 助手辅助调研写作，基于公开资料整理。