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
| v2 | production + test 双环境 | 通过 URL 参数 `?isProduction=true` 切换 |
| v3 | room1 + room2 双实例 | 各自独立 warm container，防单点故障 |
| v4 | BDD 测试锁定部署质量 | 部署前自动跑 7 个场景：API可达、函数状态、WS连接 |

部署的演化不是一夜之间完成的。v0 阶段我们在 SCF 控制台手动操作，每次上传 zip 都像开盲盒——有时候能跑，有时候不能，但不知道为什么。v1 阶段写自动化部署脚本后至少能复现问题了（每次跑同样的流程），但随后每次新环境、新参数都会触发新的坑，因为不同 SCF 配置参数组合下会出现不同的运行时行为。v2-v3 是我们看清了生产环境需要什么后做的标准化。v4 是最后一环——让部署可验证，彻底消灭手动检查。

---

## 坑 1：undici@7 File is not defined

### 症状

部署 match-service 后，服务一直启动失败。日志里只有一行：

```
ReferenceError: File is not defined
    at .../undici/lib/web/webidl/webidl.js
```

没有 `File` 这个全局对象？Node 18 里确实没有。但 undici 这个 HTTP 库为什么要用浏览器的 `File` API？

### 排查

第一反应是 `undici` 版本问题。检查 `node_modules/undici/package.json`——v7.28.0。再往下翻 peerDependencies——`node: ">=20.18.0"`。

但我的依赖里没有直接依赖 undici 啊。用 `npm ls undici` 一看，是一条间接依赖链：

```
@cloudbase/functions-framework@1.18.2
  └── @dotenvx/dotenvx@1.75.1
       └── undici@7.28.0
```

`@cloudbase/functions-framework`（简称 tcb-ff）是腾讯云 SCF 官方提供的框架，用来方便地写云函数。我们用它来启动 match-service 的 HTTP 服务。但它的一个深层依赖 `@dotenvx/dotenvx` 用了 undici@7，而 undici@7 需要 Node 20+ 才能提供的 `File` 全局对象（Undici 的 `FormData` 实现引用了 `File`）。

### 根因

SCF 的运行环境是 Node 18，但 tcb-ff 的深层依赖 undici@7 要求 Node 20+。这是一个典型的**依赖版本链断裂**问题——`@cloudbase/functions-framework` 本身没问题，但它的子依赖没有锁版本，结果被安装了与运行时不兼容的 major 版本。

### 修复

最直接的解决方法：**去掉整个 @cloudbase/functions-framework**。

我们仔细检查了代码，发现 match-service 只用 tcb-ff 做了一件事——启动 HTTP 服务。但 TSRPC 内置的 `HttpServer` 完全可以自己启动，不需要这个框架。

原来的代码：

```typescript
// match-service/src/index.ts — 原来的实现
import { createServer } from "@cloudbase/functions-framework"
import { App } from "./app"

const app = new App()
export const server = createServer(app.callback())
```

改成：

```typescript
// match-service/src/scf-server.ts — 直接启动 TSRPC HttpServer
import { HttpServer } from "tsrpc"
import { serviceProto } from "./shared/protocols/serviceProto"

let server = new HttpServer(serviceProto, {
    port: 9000,
    cors: {
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type"]
    }
})

server.autoImplementApi(/*...*/)
server.start()
```

同时从 `package.json` 中去掉 `@cloudbase/functions-framework` 和 `@cloudbase/node-sdk`（后者我们也没直接用）——这两个包去掉后，undici 依赖链不在了，`File` 问题消失。

**教训：对 SCF 来说，框架不是必须的。它只需要一个监听端口的 HTTP Server。** TSRPC 本身就满足，加一层框架反而引入了不必要的版本风险。

---

## 坑 2：zip 目录深度

### 症状

room-service 部署后，启动日志提示：

```
Error: Cannot find module '../../../logic/src'
Require stack:
- /var/user/svc/dist/models/Game.js
```

### 排查

看一下本地目录结构就知道了。在 monorepo 中，`Game.js` 的路径是：

```
packages/room-service/dist/models/Game.js
```

它里面 `require("../../../logic/src")` 在本地解析为：

```
packages/room-service/dist/models/Game.js
  → ../../../ = packages/
  → logic/src = packages/logic/src ✅
```

但 zip 打包时，我们把 `dist/` 目录打到了 zip 的根目录：

```
dist/
  models/
    Game.js    ← 2 级深度
```

这时候 `../../../logic/src` 会解析到 zip 根目录往上 3 层——根目录之外。Node.js 的模块解析在 `require` 解析路径时不会检查路径合法性，只是往上找，最终找不到。

### 根因

zip 内的目录深度与 monorepo 中的目录深度不一致。`../../../logic/src` 在 monorepo 中正确解析，是因为源码是 `packages/room-service/dist/models/Game.js`（3 级深度 -> 往上 3 层到 `packages/`）。打 zip 后深度变成了 2 级，往上 3 层已经超出 zip 包范围。

### 修复

在 zip 中加一层 `svc/` 子目录做深度补偿：

```
# zip 包结构（修复后）
svc/
├── dist/
│   └── room-service/
│       └── models/
│           └── Game.js      ← 3 级深度：svc/dist/room-service/models/Game.js
├── node_modules/
│   └── logic/
├── scf_bootstrap
```

加上 `svc/` 之后，Game.js 在 zip 内的路径是 `svc/dist/room-service/models/Game.js`（3 级深度），`../../../logic/src` 解析为 `svc/logic/src`。`logic` 包正好在 `svc/node_modules/logic/`，`require("logic/src")` 可以正确找到。

这个修复需要在 gulpfile.js 的打包 task 中动手：

```typescript
// gulpfile.js — 在 _createServiceZip 中加 svc/ 子目录
function _createServiceZip(serviceName, distDir) {
    return gulp.src(`${distDir}/**/*`)
        .pipe(gulp.dest(`publish/svc/dist/${serviceName}/`))  // 包在 svc/ 下
        .pipe(/* ... continue to zip */)
}
```

---

## 坑 3：scf_bootstrap 无执行权限

### 症状

SCF 一直报 `fork/exec /var/user/scf_bootstrap: permission denied`。换个说法：SCF 提示找不到可执行文件 `scf_bootstrap`，或者直接报 `no such file or directory`。

### 排查

本地检查 `scf_bootstrap` 文件 —— 普通文本文件，内容是：

```bash
#!/bin/bash
node /var/user/svc/dist/txcloud-scf.js
```

权限位 `-rw-rw-rw-`（666），没有 `+x`。Windows 文件系统没有 Unix 的可执行权限概念，PowerShell 的 `Compress-Archive` 打包时，不会给文件设 `+x`。

### 根因

SCF 的启动流程是：收到请求 → 寻找 `scf_bootstrap` → `exec` 执行它。但 `exec` 需要文件有可执行权限。Windows zip 上传后面了没 `+x`，`exec` 直接失败。

更隐蔽的问题是 **换行符**。Windows 默认是 `\r\n`（CRLF），但 `scf_bootstrap` 的第一行 `#!/bin/bash` 必须用 `\n`（LF），否则 bash 解析 shebang 时会把 `#!/bin/bash\r` 当作一个不存在的解释器路径。

### 修复

我们需要在打 zip **之后**修改 `scf_bootstrap` 的权限位。但 `Compress-Archive` 生成的 zip 文件是二进制格式，不能直接改。

解决办法是用 .NET 的 `ZipArchive` 类（PowerShell 底层就是 .NET），通过 reflection 设置文件的 Unix 权限位：

```powershell
# scripts/zip-chmod.ps1 — .NET ZipArchive 权限修复
param(
    [Parameter(Mandatory=$true)]
    [string]$ZipPath
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
$entry = $zip.GetEntry("scf_bootstrap")

# Unix 权限位: rwxr-xr-x (755) = 0x1ED
# ExternalAttributes 高 16 位存 Unix 权限
$entry.ExternalAttributes = 0x81ED0000

$zip.Dispose()
```

`0x81ED0000` 的组成：
- `0x1ED`（低 16 位的外部属性）= Unix 755
- `0x81ED`（高 16 位）= 文件类型（常规文件）+ 权限
- 完整的 `ExternalAttributes` = `(fileType << 16) | (permissions & 0xFFFF)`

同时，写 `scf_bootstrap` 时要确保 LF 换行：

```javascript
// 在 deploy-scf.js 中
fs.writeFileSync("scf_bootstrap", 
    "#!/bin/bash\nnode /var/user/svc/dist/txcloud-scf.js\n", 
    { encoding: "utf8" }
)
```

---

## 坑 4：ESM vs CJS 冲突

### 症状

room-service 启动时，WebSocket 连接直接返回 HTTP 443 错误。日志里只有一行关键信息：

```
Error [ERR_REQUIRE_ESM]: require() of ES Module /var/user/svc/node_modules/@rescript/runtime/lib/js/Js_dict.js
```

### 排查

`@rescript/runtime` 是 ReScript 的运行时库，我们的 ReScript 代码编译后需要它提供 `Js.Dict`、`Primitive_option` 等基础函数。room-service 的 `Game.js` 里有 `require("meta3d-commonlib-new/src/structure/hash_map/ImmutableHashMap")`，而 `ImmutableHashMap.js` 的内部又 require 了 `@rescript/runtime`。

问题出在 `@rescript/runtime/package.json` 里的一行：

```json
{
    "name": "@rescript/runtime",
    "type": "module",     // ← 这行！
    "version": "12.0.0-alpha.2"
}
```

有 `"type": "module"` 的 `package.json` 在 Node.js 中会把所有同目录的 `.js` 文件当作 ES Module 处理。ES Module 不允许用 `require()` 加载，必须用 `import`。但我们的代码（CommonJS 格式）用 `require()` 加载 `@rescript/runtime` 的文件，Node 就报 `ERR_REQUIRE_ESM`。

### 根因

ReScript v12 的 npm 包 `@rescript/runtime` 的 `package.json` 设置了 `"type": "module"`，但它的运行时文件本身是 CommonJS 格式的（没有 `import/export`）。这个 `"type": "module"` 标记导致 Node.js 误判了模块格式。

### 修复

解决方案简单到让人哭笑不得：**在 zip 中不复制 `@rescript/runtime/package.json`**。

```javascript
// scripts/bundle-logic.js — 在打包过程中跳过 @rescript/runtime/package.json

function readEntryText(entry) {
    // ... 读取 zip 中文件内容的代码
}

// 遍历 zip 条目时：
if (entry.name.endsWith("package.json")) {
    let content = JSON.parse(readEntryText(entry))
    if (content.type === "module") {
        // 删掉 type: module，或者直接跳过这个文件
        delete content.type
        updateEntryText(entry, JSON.stringify(content))
    }
}
```

因为我们只依赖 `@rescript/runtime/lib/js/Js_dict.js` 和 `Primitive_option.js` 这两个文件。Node.js 的模块解析**不依赖 `package.json` 来确定文件路径**——文件在相应目录下，`require()` 就可以找到。去掉 `package.json` 后，Node会把 `.js` 文件当作 CommonJS 处理，问题消失。

---

## 坑 5：Module._load hook 不可靠

### 症状

room-service 启动后，`Game.js` 报 `Cannot find module 'meta3d-commonlib-new/src/structure/hash_map/ImmutableHashMap'`。

### 排查

`Game.js` 里的 `require("meta3d-commonlib-new/...")` 是 Node.js 原生模块解析——它会在 `node_modules/meta3d-commonlib-new/` 下找。但我们的 zip 包里没有这个目录。

我们用了一个 `bundle-logic.js` 打包脚本，把 `logic/` + `meta3d-commonlib-new/` + `@rescript/runtime/` 的所有依赖递归打包成一个 ~49KB 的 IIFE（立即执行函数）。这个 IIFE 是闭包——内部模块的 `exports` 在函数作用域里，外部 `require()` 无法访问。

我之前尝试的做法是：用 Node.js 的 `Module._load` hook 拦截每个 `require()` 调用：

```typescript
// txcloud-scf.ts — 首次尝试：Module._load hook（已放弃）
import Module from "module"

const originalLoad = Module._load
Module._load = function(request, parent, isMain) {
    // 如果是 meta3d-commonlib-new 的 require，从 bundle 闭包中找
    if (request.startsWith("meta3d-commonlib-new/")) {
        const mod = __bundleModules[request]
        if (mod) return mod
    }
    return originalLoad.apply(this, arguments)
}
```

### 根因

hook 的思路是对的——拦截 `require()`，从 bundle 闭包里取模块。但问题是：

1. **复杂度高**：需要同时修改 `txcloud-scf.ts`（启动脚本）和 `bundle-logic.js`（打包脚本），两个地方配合才能工作
2. **调试困难**：SCF 环境不像本地可以打 console 看流程。WebSocket 连接失败时只返回 HTTP 446/443，没有有效错误日志（后来才知道 Web 函数的日志走 CLS，不走 `GetFunctionLogs`）
3. **不安全**：全局拦截所有 `require()` 调用，会不会影响其他 npm 模块？Node 版本不同时的行为差异？
4. **SFC 环境不确定**：Node 18 和 Node 20 的 `Module._load` 签名有微妙差异，hook 在某些版本下不生效

最终我们在大约 3 小时的尝试后决定放弃 hook。

### 修复

**直接注入 node_modules 目录**。在 gulpfile.js 的 `_createServiceZip` 中，构建 zip 时把需要的模块文件直接复制到 `svc/node_modules/` 下：

```javascript
// gulpfile.js — 在 build zip 时注入 node_modules
function _injectNodeModules() {
    const deps = [
        // meta3d-commonlib-new
        { from: "../meta3d-commonlib-new/src/structure/hash_map/ImmutableHashMap.js", to: "svc/node_modules/meta3d-commonlib-new/src/structure/hash_map/ImmutableHashMap.js" },
        { from: "../meta3d-commonlib-new/package.json", to: "svc/node_modules/meta3d-commonlib-new/package.json" },
        // @rescript/runtime（跳过 package.json 避免 ESM 冲突）
        { from: "../node_modules/@rescript/runtime/lib/js/Js_dict.js", to: "svc/node_modules/@rescript/runtime/lib/js/Js_dict.js" },
        { from: "../node_modules/@rescript/runtime/lib/js/Primitive_option.js", to: "svc/node_modules/@rescript/runtime/lib/js/Primitive_option.js" },
    ]
    
    for (const dep of deps) {
        fs.copyFileSync(dep.from, dep.to)
    }
}
```

zip 大小从 48KB 只增加到 51KB（+3KB），但 `require("meta3d-commonlib-new/...")` 直接通过 Node.js 原生模块解析找到文件。**简单可靠，不修改运行时代码，不需要 hook。**

---

## 坑 6：warm container 定时器残留

### 症状

在生产环境测试时，第二局游戏开始后，玩家的位置出现跳变。日志显示 `_serverTick` 函数每帧跑了两次——有两个 tick loop 同时在跑。

### 排查

SCF 有 **warm container** 机制：函数执行完一个请求后，容器不会立即销毁，会保持 15 分钟左右的空闲等待时间。下一个请求进来时，**复用同一个容器进程**，这就是所谓的「冷启动 vs 热启动」——热启动快，因为 Node.js 进程已经启动好了。

但 warm container 有一个关键特性：它**不会清理**上一个请求创建的资源。`setInterval`、`setTimeout`、全局变量——只要没有显式清理，全都保留。

我们的 room-service 用 `setInterval` 驱动 tick loop：

```typescript
// room-service/src/models/Game.ts — tick loop
function startTickLoop(state: ServerState, interval: number) {
    // 每次新游戏进来就启动一个新的 tick loop
    const intervalId = setInterval(() => {
        _serverTick(state)
        broadcastMsg("MsgGameState", state.players)
    }, interval)
    
    // 但根本没有清理旧 loop 的代码！
    state.intervalId = intervalId
}
```

第一局游戏结束后，warm container 保留了第一个 `setInterval`。第二局游戏启动后又创建了第二个 `setInterval`。两个 loop 同时跑同一个 `_serverTick`，但 `state.players` 是数组引用——两个 loop 都在修改同一个数组。所以在某些 tick 里，两个 loop 先后修改同一条数据，导致位置跳变。

### 修复

**代次守卫（Generation Guard）**——每个 tick loop 创建时都有一个唯一的代次编号。每次 tick 检查当前代次是否匹配，不匹配就 `clearInterval` 自毁。

```typescript
// room-service/src/models/Game.ts — 带代次守卫的 tick loop
function startTickLoop(state: ServerState, interval: number) {
    // 每次启动新 loop 前增加代次
    state.tickGeneration = (state.tickGeneration || 0) + 1
    const myGen = state.tickGeneration
    
    const intervalId = setInterval(() => {
        // 代次守卫：检查是否被后续 loop 取代
        if (state.tickGeneration !== myGen) {
            clearInterval(intervalId)  // 自毁！
            return
        }
        
        // 正常 tick 逻辑
        _serverTick(state)
        broadcastGameState(state)
    }, interval)
}
```

这个模式的巧妙之处在于：**不需要专门写 `stopTickLoop` 函数**。旧的 loop 在下一轮 tick 时检测到代次不匹配，自动清理自己。

与 warm container 相关的还有一个保活问题：SCF 实例有 15 分钟空闲回收机制。冷启动约 1-3 秒，影响第一局体验。所以我们生产环境用 2 秒一次心跳（API 调用）保活，避免回收：

| 参数 | 调试 | 生产 |
|------|------|------|
| Tick 频率 | 30fps (33ms) | 10fps (100ms) |
| 心跳间隔 | 200s | 2s |
| 实例并发 | 1 | room1 + room2 |

---

## 自动化部署流程

这些坑全踩过一轮后，我们把部署做成了全自动化。核心脚本 `deploy-scf.js` 是纯 Node.js 实现（零 npm 依赖，只用内置 `https` + `crypto`）：

```bash
# 一键部署全部服务
cd packages/meta3d-platform-publish
yarn deploy_all  # build → zip → upload → configure → BDD verify

# 或部署单个服务
yarn deploy_room1
yarn deploy_match1
```

自动化部署脚本的核心逻辑：

```javascript
// deploy-scf.js 核心流程（简化版）
async function deployService(serviceName) {
    // Step 1: 构建 & 打包
    const zipBuffer = await buildZip(serviceName)
    
    // Step 2: TC3-HMAC-SHA256 签名
    const authHeaders = signRequest({
        secretId: process.env.TC_SECRET_ID,
        secretKey: process.env.TC_SECRET_KEY,
        service: "scf",
        region: "ap-shanghai",
        action: "UpdateFunctionCode",
        payload: {
            FunctionName: serviceName,
            ZipFile: zipBuffer.toString("base64"),
            InstallDependency: true,  // 关键！放在 UpdateFunctionCode 中
            EnvId: "gts-play-env"
        }
    })
    
    // Step 3: 上传代码
    await callScfApi("UpdateFunctionCode", authHeaders)
    
    // Step 4: 等函数状态变为 Active
    await waitFunctionActive(serviceName)
    
    // Step 5: 更新配置（并发、超时等）
    await callScfApi("UpdateFunctionConfiguration", {
        FunctionName: serviceName,
        InstanceConcurrencyConfig: {
            DynamicEnabled: true,
            MaxConcurrency: 10
        },
        Timeout: 30
    })
    
    // Step 6: BDD 验证
    const result = await runBddTest(serviceName)
    if (!result.passed) {
        console.error(`❌ 部署验证失败: ${result.failures.join(", ")}`)
        process.exit(1)
    }
    console.log(`✅ ${serviceName} 部署成功，7 项 BDD 测试全部通过`)
}
```

**几个关键发现**（这些在腾讯云文档里都没写清楚，踩坑才总结出来的）：

1. `ProtocolType` / `Type` 是创建时参数，无法通过 `UpdateFunctionConfiguration` 更改。如果 SCF 创建时没选 WebSocket 支持，只能重建函数
2. `InstallDependency: true` 必须放在 `UpdateFunctionCode` 的请求参数里（触发部署阶段 npm install），不能通过单独的 `UpdateFunctionConfiguration` 去开
3. Web 函数的日志查 CLS（`cls.tencentcloudapi.com`，`SearchLog` API，Version `2020-10-16`），不是 SCF 的 `GetFunctionLogs`（该 API 对 Web 函数返回空数组）
4. TC3-HMAC-SHA256 签名日期用 `YYYY-MM-DD`（带连字符）——同时用于 CredentialScope 和 HMAC key 派生，格式必须一致

---

## Warm Container 生命周期

```
┌─────────────┐      idle > 15min       ┌─────────────┐
│  Active      │ ─────────────────────→ │  Recycled    │
│  (热实例)     │                        │  (已回收)     │
│  2s 心跳保活  │ ←────── 新请求触发 ────│ 冷启 1-3s    │
│              │                        │             │
│  tick loop   │                        │  tick loop   │
│  代次守卫     │                        │  不存在      │
└─────────────┘                        └─────────────┘
```

## 最终部署架构

```
浏览器 → match-service (SCF HTTP)  → room-service (SCF WebSocket) × 2
        端口 9000, 64MB              端口 9000, 256MB, 静态并发=10
        └─ 查/创建房间                └─ 游戏逻辑、帧同步

| 服务 | 类型 | URL |
|------|------|------|
| room1 | WebSocket SCF | `wss://1302358347-75c0pmliik.ap-shanghai.tencentscf.com?room-id=1` |
| room2 | WebSocket SCF | `wss://1302358347-ezkijqoed2.ap-shanghai.tencentscf.com?room-id=2` |
| match | HTTP SCF | `https://1302358347-392p0efafm.ap-shanghai.tencentscf.com` |
```

之后每次部署只需要一句 `yarn deploy_all`，AI 自动执行整套流程。全程不需要进 SCF 控制台。

---

## 踩坑规律总结

回看这 6 个坑，有几个共同模式：

1. **本地==生产是幻觉**：Windows 和 Linux 的文件权限、换行符、路径解析都在坑你。部署前先问自己：我的代码依赖了哪些本地环境特性？
2. **间接依赖是惊喜**：undici@7 不是自己装的，是三层以外的子依赖。SCF 的 node_modules 中每个依赖都可能带来运行时问题。
3. **Warm container 是双刃剑**：热启动快，但引入了「状态残留」这个类 bug。代次守卫是必写的防御式代码。
4. **兜底方案应该更早尝试**：Module._load hook 想法很炫，但花了 3 小时调试失败。最终方案是直接注入文件——简单到难以置信，但真的管用。

---

下期讲 **P11：WebGPU 与多线程调研与架构就绪**——为未来三线程架构铺路。

**下一篇：[Vibe Coding 多人游戏（十一）—— WebGPU 与多线程调研与架构就绪](https://www.cnblogs.com/chaogex/p/21195307)**
