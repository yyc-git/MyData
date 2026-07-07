# Vibe Coding 多人游戏（一）—— Pieter Levels 一个人的游戏帝国

> 一个荷兰独立开发者，用 AI 代码生成器在 3 天内做了一个浏览器多人飞行模拟器。第 17 天，ARR 突破 100 万美元。Elon Musk 转发，26,000 人同时在线，广告牌 5,000 美元 / 月售罄。没有团队，没有融资，100% AI 写代码。

> 
> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序


---


## 他们是谁：Pieter Levels 和 levelsio

Pieter Levels（@levelsio）是独立开发者圈子里最传奇的人物之一。荷兰人，数字游民，一个人运营着 nomads.com（数字游民社区）、photoai.com（AI 照片编辑）、remoteok.com（远程工作招聘）等多款产品，全部盈利，全部单人操作。

2025 年 2 月之前，他做的产品都是"传统 SaaS"。然后他发现了 AI 代码生成。

> **背景**：2025 年初，Andrej Karpathy 提出了 "Vibe Coding" 这个概念——"让 AI 写代码，你只管感受氛围，忘记代码的存在。"

Pieter 把这句话当真了。

---

## 第一章：一次偶然的尝试（2025-02-22）

2025 年 2 月 22 日，Pieter 发了一条推文：

> *"想做一个 3D 飞行游戏，带摩天楼，浏览器就能玩。不知道能不能做出来。"*

他用 Cursor（AI 代码编辑器）写了几行提示词。三小时后，第一个可玩版本跑起来了。

当天的进展速度令人咋舌：

| 时间 | 做了什么 |
|------|---------|
| 第一条推 | 想做 3D 飞行游戏 |
| +3 小时 | Cursor 生成，可玩了 |
| 当日内 | 加射击、手机控制（nippleJS）、爆炸效果 |
| +1 天 | 想加多人模式，先用 PeerJS（WebRTC），但只支持 2 人对战 |
| +2 天 | Cursor 联合创始人 Michael Truell 亲自帮他 debug 路由问题 |
| +3 天 | **Python WebSocket 服务器**搞定真多人联网 |

> **关键推文 [@levelsio 2025-02-25](https://x.com/levelsio/status/1894429987006288259)**
> "IT WORKS!!!!! A FULL multiplayer with Python websockets server that receives and broadcasts all player positions every 100ms (10 times per second). All code written almost 100% by AI with Cursor and Grok 3 wrote the server code."
>
> "每个红色飞机都是真人玩家在飞。之前不动是因为那些是已经退出游戏的旧玩家，位置数据还留在服务器上。"
>
> 点赞 15,483 | 转发 1,154

整个游戏的代码 = **1 个 HTML 文件**。

前端用 Three.js 渲染 3D 场景。多人联网用 Python WebSocket 服务器，每 100ms（每秒 10 次）接收并广播所有玩家的位置。代码 100% AI 编写——Cursor 写前端，Grok 3 写服务器。

---

## 第二章：病毒传播（2025-02-25 ~ 2025-03-11）

游戏上线后，Pieter 在 X（Twitter）上直播开发过程——这就是他后来反复强调的 **Build in Public** 策略。

几件事助推了传播：

**1. Elon Musk 转发**
Elon Musk 看到了这个游戏并转发，峰值同时在线人数直接冲到 **26,000 人**。

**2. 游戏体验本身就是话题**
一个全部由 AI 编写的浏览器飞行模拟器——这本身就足够成为一个媒体爆点。Indie Hackers、Hacker News、各种 AI 新闻站都有报道。

**3. 游戏内广告牌变现**
Pieter 没有做内购、没有卖 VIP、没有开箱。他的变现方案极其简单：

- **广告牌**：5,000 美元 / 月，在游戏里的摩天楼上展示你的品牌
- **F-16 战斗机升级**：29.99 美元，一次性付费解锁 F-16 机型
- 后面还加了飞船（UFO）广告位，Basecamp 花 $5K/月买了一个 UFO 广告

广告牌在几周内售罄。

---

## 第三章：第 17 天，$1M ARR（2025-03-11）

2025 年 3 月 11 日，Pieter 发布了一条[推文](https://x.com/levelsio/status/1899596115210891751)：

> *"fly.pieter.com 从零到 100 万美元 ARR，只用了 17 天！"*
>
> **营收数据：87,000 美元 / 月 MRR（折合 104 万美元 / 年 ARR）**
>
> **玩家数据：320,000 人已经开过飞机**
>
> "这是我所有项目里增长最快的，没有之一。"
>
> 点赞 3,654 | 转发 153

他的原始推文还提到了当时的维护和开发状态：

> "我这些天正在法国和瑞士旅行，大部分时间都和女朋友在一起（本来就该这样），然后每天晚上挤出一小时（比如现在），手忙脚乱地修 bug、加功能。如果没有 AI，这根本不可能——没有 AI 的话，同样的工作量需要多花 10-100 倍的时间。"

> "我还在用 @cursor_ai + @AnthropicAI Claude 3.5，也在试 3.7。"

他也坦承了一些问题：

> "修了一些 XSS 问题——说实话，除非你明确要求 AI 检查每一个 XSS 漏洞，AI 写代码的时候不太关心安全问题。所以你真的得专门让它特别去检查代码，因为说实话，AI 写的代码安全漏洞可能很多。"

也有人在评论区质疑他：

> @capncleaver: "我为你的成功高兴，但你能不能别把它叫 ARR/MRR？游戏上线不到一个月。你得先有 **Recurring**（持续性收入）才行。"

---

## 第四章：技术架构详解

经过多方资料（Pieter 的推文、IndieHackers 博客、知乎文章）交叉验证，以下是 fly.pieter.com 的完整技术栈：

### 前端：Three.js
- 3D 游戏渲染引擎，浏览器直接运行
- 用 Cursor（AI 编辑器）和 Claude Sonnet 3.5/3.7 生成
- 加入 nippleJS 支持手机触控
- 1 个 HTML 文件包含全部代码

### 后端：Python WebSocket 服务器
- 用 Grok 3 写服务器代码
- 每 100ms（10 次/秒）接收并广播所有玩家位置
- 轻量级——没有数据库，所有状态在内存中

### 服务器部署
- Pieter 用的是 **Hetzner VPS 集群**
- 前面套了 Cloudflare
- 没有 Kubernetes，没有 Docker，没有复杂部署

### DDoS 防护
由于游戏玩家太多，被各种攻击是家常便饭。Pieter 的应对很有意思：

**最外层：Cloudflare**
游戏在 Cloudflare 背后，由 Cloudflare 吸收大部分 DDoS 流量。

**Pietflare（2026-06-27）** [[推文链接](https://x.com/levelsio/status/2070870006204694547)]
后来 Pieter 干脆自己写了一套防护系统，命名为 **Pietflare**：

> "我做了自己的小 Cloudflare，叫 Pietflare。它是一个 DDoS 和探针检测器，用 AI 识别，带中央 IP / ASN / 国家黑名单。"
>
> "每个 VPS 把可疑访问日志上报到中央管理后台，所有服务器每分钟拉取中央黑名单，然后在 Nginx 层拦截。"
>
> "它有一个中央仪表盘，我可以看到任何威胁并即时拦截，但最好让 AI 自己拦截。"
>
> "哦对了，最重要的一点——只要你攻击了我任何一个网站，你就自动被我所有网站拉黑了。"

不过他也承认：

> "好吧，它不能真正阻挡 DDoS（那必须 Cloudflare 级别才行，前面还是有 Cloudflare 的，所以不能直接用 iptables），但它能有效阻止那些使劲打服务器的人（比如爬虫）。"
>
> "加上 Cloudflare API key 的话，也可以在 Cloudflare 层面直接拉黑，不用进他们的后台。"

### 技术架构全景图

```
用户浏览器 (Three.js)
    ↕ WebSocket (100ms 广播位置)
Python WebSocket Server (Grok 3 生成)
    ↕ Nginx (Pietflare 黑名单拦截)
Cloudflare (DDoS 防护)
    ↕
Hetzner VPS 集群
```

---

## 第五章：同款续作——Apocalypse Drone

fly.pieter.com 成功后，Pieter 又做了一个类似的多人游戏：**Apocalypse Drone**（drone.pieter.com / dronesim.com）。

这是多人 FPV 无人机战斗模拟器：
- 同样是 vibe coding，从头到尾 AI 写
- 新增 AI 生成音乐（东欧战争风格）
- 玩家从士兵开始 → 按 F 切换到无人机 → 从背包发射 3 种无人机攻击
- 地面 + 空中双模式，比飞行模拟玩法更丰富

这种模式他后来几乎变成了模板：AI 写多人游戏 → 免费玩 → 广告牌变现 → 改功能加新游戏。

---

## 第六章：对个人开发者的启示

### 1. Build in Public 比游戏本身更值钱

Pieter 的火爆，不是因为 fly.pieter.com 画面多好、玩法多创新。是因为他在 X 上**直播了整个过程**——从"能不能做出来"到"第 17 天 $1M ARR"。

每一行代码的诞生、每次 bug、每次服务器被攻击——他都在推特上即时分享。这本身就是内容产品。

### 2. 广告牌 > 内购

他没有做开箱、月卡、皮肤商城。单纯卖广告牌 $5K/月，几十个品牌排队买。Basecamp 买 UFO 广告位给这游戏做了二次传播。

### 3. AI 写多人游戏的效率革命

3 天从零到 26k 人在线。如果没有 AI，同样的工作量（多人同步、射击系统、UI、地图、触控适配）一个人至少需要几个月。

但他自己也说了：**安全漏洞多，AI 不会主动防 XSS。**

### 4. 技术越简单越好

1 个 HTML 文件。Python WebSocket。每 100ms 广播。没有数据库。没有消息队列。没有容器化。没有微服务。

在 26,000 人同时在线的场景下，这些"简单"的东西完全够用。

---

## 资料来源

- [Lex Fridman Podcast #440 — Pieter Levels](https://lexfridman.com/podcast-440-pieter-levels/) (2025)
- 知乎专栏 — 《[一个人月入170万，他用AI做游戏、找机会的完整方法论](https://zhuanlan.zhihu.com/p/1893241127082766590)》
- [IndieHackers — Pieter Levels 博客](https://levels.io/blog/)
- [Pieter 的项目列表](https://levels.io/projects/)
- [@levelsio/X — 多人上线成功 (2025-02-25)](https://x.com/levelsio/status/1894429987006288259)
- [@levelsio/X — $1M ARR (2025-03-11)](https://x.com/levelsio/status/1899596115210891751)
- [@levelsio/X — Pietflare DDoS 防护 (2026-06-27)](https://x.com/levelsio/status/2070870006204694547)
- [fly.pieter.com — 游戏本体](https://fly.pieter.com/)
- [drone.pieter.com — 同款续作](https://drone.pieter.com/)
- [domaingang.com — 域名被 squat 报道](https://domaingang.com/domain-news/fly-pieter-com-popular-ai-coded-fly-game-now-squatted/)

**下一篇：[Vibe Coding 多人游戏（二）—— Vibe Jam 2026 技术地图](https://www.cnblogs.com/chaogex/p/21195307)**


---
> 本文由 AI 助手辅助调研写作，基于公开资料整理。