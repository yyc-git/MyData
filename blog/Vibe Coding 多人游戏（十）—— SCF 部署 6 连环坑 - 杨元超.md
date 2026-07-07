# Vibe Coding 多人游戏（十）—— SCF 部署 6 连环坑

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

代码写完了，测试跑通了——然后发现**部署不上去**。

GTS-Play 部署在腾讯云 SCF（Serverless Cloud Function）上。SCF 本身是可靠的，但把 Node.js + WebSocket + TSRPC + ReScript 的 stack 部署上去，我们踩了 6 个连环坑。

---

## 部署迭代史

| 版本 | 做法 | 问题 |
|------|------|------|
| v0 | 手动打 zip + 控制台上传 | 每次都挂，无法复现 |
| v1 | deploy-scf.js 一键部署 | 但只有单环境 |
| v2 | production + test 双环境 | 参数 `?isDebug=true` 切换 |
| v3 | room1 + room2 双实例 | 各自独立 warm container |
| v4 | BDD 测试锁定部署质量 | 部署前自动跑 7 个场景 |

---

## 坑 1：undici@7 File is not defined

**现象**：部署后服务启动失败，报 `File is not defined`

**根因**：`@cloudbase/functions-framework`（SCF 的官方框架）链式依赖 `undici@7`。undici@7 需要 Node 20+ 的 `File` 全局对象，但 SCF 的运行环境是 Node 18。

**解决**：去掉整个 framework，直接启动 TSRPC HttpServer。

```typescript
// 原来
import { createServer } from "@cloudbase/functions-framework"
createServer(app)

// 后来
import { createServer } from "tsrpc"
let server = new WsServer(serviceProto, { port: 4003 })
```

SCF 不需要 functions-framework，它只需要一个能监听端口的 HTTP Server。TSRPC 本身就满足。

---

## 坑 2：zip 目录深度

**现象**：服务端报 `MODULE_NOT_FOUND`，提示 `../../../logic/src` 路径不存在

**根因**：zip 包里的目录结构是扁平的，但 `room-service` 的 `../../../logic/` 引用在 zip 里解析到了根目录之外。

**解决**：zip 内加一层 `svc/` 子目录做深度补偿：

```
# zip 包结构
svc/
├── index.js                ← 入口
├── node_modules/
│   └── logic/              ← logic 包
├── dist/
│   └── room-service/
└── scf_bootstrap
```

有了 `svc/` 后，`require("logic")` 的路径从 `./node_modules/logic/` 解析，不再受扁平结构影响。

---

## 坑 3：scf_bootstrap 无执行权限

**现象**：部署后 SCF 一直报 `permission denied`

**根因**：Windows 上 `Compress-Archive`（PowerShell）打包 zip 时不保留 Unix 的 `+x` 权限。`scf_bootstrap` 文件在 Linux 环境下没有执行权限。

**解决**：在部署脚本里用 .NET 的 `ZipArchive` reflection 手动设置 ExternalAttributes：

```javascript
// deploy-scf.js 中的权限修复
let entry = zip.GetEntry("scf_bootstrap")
entry.ExternalAttributes = (entry.ExternalAttributes & ~0x1FF) | 0x1ED  // rwxr-xr-x
```

---

## 坑 4：ESM vs CJS 冲突

**现象**：部署后 `require()` 报 `ERR_REQUIRE_ESM`

**根因**：`@rescript/runtime` 的 `package.json` 有 `"type": "module"`。当 zip 中扫描到这个字段时，Node 会认为整个包是 ESM 模块，`require()` 方式加载导致冲突。

**解决**：打包时检测并删掉有 `"type": "module"` 的 package.json：

```javascript
// deploy-scf.js 中的 ESM 修复
if (entry.name.endsWith("package.json")) {
    let content = JSON.parse(readEntryText(entry))
    if (content.type === "module") {
        delete content.type  // 删掉 type: module
        updateEntryText(entry, JSON.stringify(content))
    }
}
```

---

## 坑 5：Module._load hook 不可靠

**现象**：logic 包的 bundle 闭包暴露不出来

**根因**：想用 Node.js 的 `Module._load` hook 来拦截 `require("logic")` 的加载路径，把 bundle 闭包里面的模块暴露出去。但这个 hook 在不同 Node 版本下行为不一致（Node 18 和 Node 20 的处理不同）。

**解决**：不玩 hook——把 logic 包直接注入 `node_modules/logic/` 目录。简单粗暴，但可靠：

```javascript
// 打包前
fs.cpSync("packages/logic", "dist/node_modules/logic", { recursive: true })
```

---

## 坑 6：warm container 定时器残留

**现象**：第二局游戏的玩家看到位置在跳变，日志显示两个 tick loop 同时在跑

**根因**：SCF 的 warm container 不会 kill 旧的 `setInterval`。第一局游戏结束后 tick loop 没被清理，第二局启动新 loop 后两个都在跑。

**解决**：代次守卫（Generation Guard）——每个 tick loop 启动时记录代次，每次 tick 检查代次是否匹配，不匹配则 `clearInterval` 自毁。

```typescript
let gen = state.room.tickGeneration + 1

setInterval(() => {
    let s = readState()
    if (s.room.tickGeneration !== gen) {
        clearInterval(intervaler)  // 自毁
        return
    }
    // ... tick logic
}, interval)
```

---

## 自动化部署流程

这些坑全踩过一轮后，我们把部署做成了全自动化：

```javascript
// deploy-scf.js（纯 Node.js，零 npm 依赖）
// 一行命令完成：
//   1. 打包 + zip（带 svc/ 子目录修复）
//   2. 上传 SCF（Tencent Cloud API）
//   3. 发布版本
//   4. BDD 验证（7 个场景覆盖）
```

之后每次部署只需要一句话，AI 自动执行整套流程。全程不需要进 SCF 控制台。

---

## Warm Container 生命周期

SCF 实例有 15 分钟空闲回收机制。冷启动约 1-3 秒，影响第一局体验。我们用生产环境 2 秒一次心跳保活，避免回收。

| 参数 | 调试 | 生产 |
|------|------|------|
| Tick 频率 | 30fps | 10fps |
| 心跳间隔 | 200s | 2s |
| 实例并发 | 1 | room1 + room2 |

---

下期讲 **P11：WebGPU 与多线程调研与架构就绪**——为未来三线程架构铺路。

**下一篇：[Vibe Coding 多人游戏（十一）—— WebGPU 与多线程调研与架构就绪](https://www.cnblogs.com/chaogex/p/21195307)**
