# Vibe Coding 多人游戏（二十五）—— 部署与服务管理

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

代码写完了、测试跑过了——怎么部署上线？

GTS-Play 的部署方案围绕腾讯云 SCF（Serverless Cloud Function）展开。选择 SCF 而不是传统云服务器的原因：按量付费、自动扩缩容、不需要 7×24 小时开一台机器只服务 2 个人的测试。对于个人开发的多人游戏来说，SCF 的费用几乎为零。

但 SCF 部署 WebSocket 服务并不是装上去就能跑的——我踩了 6 个连环坑才稳定下来。

---

## deploy-scf.js

核心是一个由 AI 编写的 `deploy-scf.js` 脚本，纯 Node.js、零 npm 依赖。一句话触发部署全流程：

```
打包 → zip（带 svc/ 子目录） → 上传 SCF → 发布 → BDD 验证
```

脚本内部处理了之前踩过的 6 个坑（详见 P10）：

### 1. undici@7 依赖冲突 → 去掉 functions-framework

Room-service 最开始用 `@google-cloud/functions-framework` 框架来承载 HTTP 函数，但这个框架的底层依赖 `undici@7` 在 Node 18 下行为不一致。Node 18 内置的是 undici@5，Node 20 才包含 undici@7。SCF 的运行时是 Node 18，所以 `undici@7` 的 API 根本不存在。去掉 functions-framework 后一切正常。

### 2. zip 深度 → 加 `svc/` 子目录

SCF 要求代码入口在 zip 的根目录或者 `svc/` 子目录下。第一次部署时，我把整个 dist 目录压缩进去，结果 SCF 启动时找不到 `app.js` —— 因为它在 `dist/svc/app.js` 而 SCF 期望的是 `./app.js`。后来在 zip 里加了一层 `svc/` 目录结构。

### 3. 权限 → .NET ZipArchive 修复 +x

SCF 的 `scf_bootstrap` 文件需要可执行权限。但是在 Windows 上用 ZIP 工具打包时，文件的 Unix 权限位丢失了。SCF 下载 zip 后，`scf_bootstrap` 是 644（不可执行），导致容器启动时提示"Permission denied"。修复方式是在打包脚本中执行 `.NET ZipArchive` 设置权限位，或者在 Linux 环境重新设置 +x。

### 4. ESM 冲突 → 删 override `type: module`

项目在 `package.json` 里有 `"type": "module"` 配置（为了支持 ESM），但 `scf_bootstrap` 是用 CommonJS（require）启动的。Node.js 会尝试用 ESM 方式解析 CJS 文件，导致 `require` 不被识别为函数。修复：在 SCF 部署包的 `package.json` 中 override 去掉 `type: module`。

### 5. Module._load → 直接注入 node_modules

Room-service 的 dist 代码有直接 `require("meta3d-commonlib-new/...")` 的调用，这些模块是本地 ReScript 编译产物不在 npm 上。最初用 `Module._load` hook 来拦截 require 调用，但不同 Node.js 版本的 hook API 签名不一致。最终方案：在构建 zip 时把所需模块的 `.js` 文件直接复制到 `node_modules/` 下，zip 仅增加 3KB。

### 6. 定时器残留 → 代次守卫

这是最隐蔽的坑。SCF 的 warm container 会复用实例——前一个请求的 `setInterval`/`setTimeout` 在下一个请求进来时还跑着。如果新请求又创建了新的定时器，就会出现两个定时器同时运行的奇怪状态。

解决：使用"代次守卫"（generation guard）——每次请求开始 generation++，定时器回调里检查 generation 是否匹配，不匹配就跳过。这个模式后来被应用到很多地方，包括倒计时超时逻辑和广播节流。

---

## 双环境双实例

| 环境 | URL 参数 | 用途 |
|------|---------|------|
| production | 无 | 正式游戏 |
| test | `?isDebug=true` | AI 开发测试 |

双环境是怎么来的？一开始只有 production，但 AI 在开发时直接部署到 production——结果兄弟用着正式版突然代码变了，产生了一次"版本混乱"的事故。后来加了一个 test 环境，AI 的自动部署只到 test，兄弟手动确认后再部署到 production。

每个环境独立部署 room1 + room2 两个实例，互不影响。room1 和 room2 做负载均衡，也提供了容灾——一个实例挂了另一个还在。生产环境每 2 秒心跳保活，避免 warm container 回收。

---

## 服务管理

### 本地服务端口

| 服务 | 端口 | 协议 | 启动命令 |
|------|------|------|---------|
| room-service | 4003 | WebSocket | `yarn dev` (tsrpc-cli dev) |
| match-service | 3000 | HTTP | `yarn dev` (tsrpc-cli dev) |
| webpack-dev-server | 8093 | HTTP 开发用 | `yarn webpack:dev-server` |

### 重启顺序

最重要的一条规则：**先 room，再 match。** room 重启会断开 match 的 WS 连接，如果先重启 match，room 的 WS 连接找不到 match，所有与 match 相关的操作（匹配、房间路由）都会失败。

具体的重启流程由 `gts-service` skill 管理：

```
gts-service restart room1
→ 等待 room1 ready（health check 200）
gts-service restart room2
→ 等待 room2 ready
gts-service restart match
→ 等待 match ready
```

### 测试/E2E 前后

- 测试后 → 重启服务端清除脏数据
- **E2E 测试前必须先重启 room-service + match-service**（避免 WS 失连卡在"查找房间中"）

有一次我跑 E2E 测试，玩家卡在"查找房间中"转了 10 分钟。排查发现是上一次 E2E 测试的 WS 连接没完全断开，服务端认为玩家还在游戏中——每一次新建房间都给了同一个"already in game"的玩家。从那以后，E2E 前重启服务端成了硬性规定。

---

## SCF 配置

| 参数 | 值 |
|------|----|
| 运行时 | Node.js 18 |
| 内存（room） | 512MB |
| 内存（match） | 256MB |
| 并发 | 10 |
| 空闲超时 | 15 分钟 |

内存的分配不是拍脑袋的。room-service 需要 512MB 是因为它要维持多个 WebSocket 连接、缓存游戏状态、每 tick 执行碰撞检测——256MB 时频繁触发 GC。match-service 只需要 256MB，因为它的计算量小（主要是房间路由和匹配队列）。

---

## 生产运维

### 日志管理

`gts-logs` skill 自动拉取 SCF 日志，按 room/match 过滤。这是排查 bug 的最主要手段——通过日志里的 "executeCommand"、"computeCollisionDamage"、"handlePlayerMove" 等输出，能直接定位到问题。

有一次排查碰撞减血不触发的 bug，就是通过 SCF 日志发现 `animationName` 始终为 `"idle"`，然后顺藤摸瓜找到了根因：`handlePlayerNotMove` 无条件覆盖了 `animationName`。如果没有日志，这种时序问题几乎不可能定位到。

### 热修复

发现 bug → AI 改代码 → 秒级部署（不进控制台）。从看到 bug 到修复上线，最快的一次是 3 分钟——用 `gts-deploy` skill 一键覆盖。

### 版本管理

`deploy-scf.js` 支持版本号标注。每次部署自动打版本标签，可回退到稳定的旧版本。有一次新版本上线后，玩家反馈"角色不动了"——回退到旧版本花了 30 秒。排查后发现是 `Movement.res` 的某次重构改变了朝向计算的默认值。

---

下期讲 **P26：OpenClaw 工具链全景**——16 个 Skill 全家桶。

**下一篇：[Vibe Coding 多人游戏（二十六）—— OpenClaw 工具链全景](https://www.cnblogs.com/chaogex/p/21195307)**
