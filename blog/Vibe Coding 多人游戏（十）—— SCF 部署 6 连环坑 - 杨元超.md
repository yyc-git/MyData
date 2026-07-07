# Vibe Coding 多人游戏（十）—— SCF 部署 6 连环坑

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

代码写完了，测试跑通了——然后发现**部署不上去**。

GTS-Play 部署在腾讯云 SCF（Serverless Cloud Function）上。SCF 本身是可靠的，但把 Node.js + WebSocket + TSRPC + ReScript 的 stack 部署上去，我们踩了 6 个连环坑。

---

## 部署迭代史

部署的演化不是一夜之间完成的。从 basic1 时期到生产稳定，我们经历了 5 个版本，每个版本解决一个特定层级的痛点。

### v0：手打 zip + 控制台上传（basic1 时期，2026-05-25 ~ 2026-06-08）

这是最原始的部署方式，也是最痛苦的。

**步骤：**
1. 在本地用 `Compress-Archive` 把 room-service 的 dist/ 打成 zip
2. 打开腾讯云 SCF 控制台
3. 找到对应函数 → 函数代码 → 上传 zip
4. 点击保存
5. 祈祷

**问题：** 每次都挂，无法复现。

症状是同一个 zip 文件，第一次上传能跑，第二次上传同样的文件挂了。后来才明白这是因为两次上传之间的几秒间隔里，SCF 的 warm container 状态不同——第一次可能热实例还存活，第二次可能冷启动了。冷启动时 zip 的解压、npm install、文件权限检查都更严格，更容易暴露问题。

手动部署没有记录——每次要回想的踩坑步骤都不一样。更糟糕的是，每次上传新版本后，如果旧版能跑新版不行，你分不清是代码问题还是部署操作的不同（比如这次忘记勾选某个 SCF 控制台的配置项了）。

这个阶段 deploy 一次大约 10 分钟，其中 8 分钟在找控制台配置页面。

### v1：deploy-scf.js 一键部署（2026-06-09 ~ 2026-06-15）

写一个 Node.js 脚本，用腾讯云 SCF 的 API 自动上传 zip。这是纯 Node.js 实现，只用内置库 `https` + `crypto` 做签名，零 npm 依赖。

```javascript
// scripts/deploy-scf.js — v1 架构（简化）
const https = require('https')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

function deploy(serviceName, zipPath) {
    const zipBuffer = fs.readFileSync(zipPath)
    const action = 'UpdateFunctionCode'
    
    const params = {
        FunctionName: serviceName,
        ZipFile: zipBuffer.toString('base64'),
        InstallDependency: true
    }
    
    return callScfApi(action, params)
}

async function deployAll() {
    await deploy('room-service', './publish/room-service.zip')
    await deploy('match-service', './publish/match-service.zip')
    console.log('✅ 全部部署完毕')
}
```

从命令到部署的延迟从 10 分钟降到 30 秒——改了代码 → `yarn deploy` → 上线测试。

但 v1 没有环境管理——开发、测试、生产全指向同一个 SCF 函数。"上一个版本没问题，新版本挂了"这种场景下，没办法保留旧版本同时验证新版本。每次更新都是直接替换现有函数代码。

**教训：脚本化是第一步。只要部署过程不是手动的，它就变成了可复现的、可审计的过程。** 但一次部署影响全部用户是个更大的问题——需要环境隔离。

### v2：production + test 双环境（2026-06-15 ~ 2026-06-20）

把 SCF 函数拆成 test 和 production 两套，通过 URL 参数 `?isProduction=true` 控制。test 环境始终跑最新代码，production 环境只有验证通过后才更新。

```javascript
// deploy-scf.js — v2 双环境支持
async function deployAll() {
    // 先部署 test 环境
    await deploy('room-service-test', './publish/room-service.zip')
    await deploy('match-service-test', './publish/match-service.zip')
    
    // 运行 BDD 验证（此时还没有 BDD 测试，只是手动检查）
    console.log('✅ test 环境已更新。请在 test URL 上验证：')
    console.log(testUrls)
    
    // 验证通过后部署 production
    const isApproved = await askUser('Production 可以部署吗？')
    if (isApproved) {
        await deploy('room-service', './publish/room-service.zip')
        await deploy('match-service', './publish/match-service.zip')
    }
}
```

这阶段另一个变化是加上了 SCF 返回的错误处理。v1 的 `callScfApi` 不会检查 API 返回码——有一次签名过期了（TC3-HMAC-SHA256 签名的时间戳超过 5 分钟窗口），脚本无脑继续，下次部署时以为是代码问题，排查了 30 分钟才发现是签名时间戳变成了系统时间偏差。

v2 加了 API 返回码和重试逻辑：

```javascript
function callScfApi(action, params, retries = 3) {
    // 第 1 次失败后，等 2 秒重试
    // 第 2 次失败后，等 4 秒重试
    // 第 3 次失败后，抛异常
}
```

### v3：room1 + room2 双实例（2026-06-20 ~ 2026-06-30）

之前 room-service 只有一个实例（SCF 的一个函数），最多同时 2 人在线。但如果 2 个人在一个房间里玩，另 2 个人想开另一个房间就没地方了。

解决方案：创建 room1 和 room2 两个 SCF 函数，各自独立。前端在匹配服务中随机或按负载选择一个 room 实例。

```javascript
// match-service — 分配房间给合适的 room 实例
async function findRoom(playerId) {
    const rooms = [
        { id: 'room1', capacity: 2, players: [] },
        { id: 'room2', capacity: 2, players: [] }
    ]
    
    // 找有空位的 room
    for (const room of rooms) {
        if (room.players.length < room.capacity) {
            room.players.push(playerId)
            return { roomId: room.id, wsUrl: getWsUrl(room.id) }
        }
    }
    
    throw new Error('所有房间已满')
}
```

双实例带来的好处不只是多一个房间。room1 和 room2 各自独立 warm container，一个回收了不影响另一个。如果一个 room 出了 bug（比如 tick loop 挂死），只有这个 room 受影响，另一个还能正常玩。

但双实例也暴露了新的问题：匹配服务的 WS 连接管理变得更复杂。匹配服务需要知道每个 room 的实时状态（剩余空位、是否活跃），但 room 实例 SCF 函数的生命周期是独立的——warm container 可能某个时刻被回收，匹配服务还在用旧的状态。

**修复：匹配服务每次查询时向 room 实例发实时请求，不缓存 room 状态。** 如果 room 实例已回收，请求返回超时，匹配服务就把这个 room 标记为不可用。

### v4：BDD 测试锁定部署质量（2026-06-30 ~ 之后）

双环境、双实例、自动部署都有了，但「部署后服务是否正常」还要手动检查——打开 URL、看有没有启动成功、建个房间测试一下。

手动检查的问题：
1. **记不住要检查什么**——每次部署后检查的项目不一致，有时漏了 WebSocket 连接测试
2. **不够快**——手动检查 2 分钟，比部署本身还慢
3. **不可重复**——怀疑某个房间有问题时，没法快速说「这个房间再测一遍」

解决方案：**BDD 测试覆盖部署验证**。部署完成后自动跑 7 个 Gherkin 场景：

```gherkin
Feature: SCF 部署验证
  Scenario: 函数状态可达
    Given 调用 GetFunctionLogs API
    Then 返回状态为 Active

  Scenario: WebSocket 连接正常
    Given 创建新游戏
    And 玩家 A 加入（WS 连接）
    Then WS 连接成功，MSGTYPE 为 MsgGameState
    
  Scenario: 房间创建成功    
    Given 调用创建房间接口
    Then 返回 roomId 不为空
    
  Scenario: 玩家加入游戏
    Given 房间已创建
    When 玩家 A 加入房间
    Then 服务端返回玩家列表，含 1 人
```

这些 BDD 测试并不是完整的 E2E 测试（不打开浏览器、不渲染 3D），只是验证服务端部署后的健康状态。它们跑得很快——整个套件 ~30 秒，因为只有 API 调用和 WS 握手，没有 UI 渲染。

```bash
# package.json 中的部署命令
"deploy_all": "yarn deploy_room1 && yarn deploy_room2 && npx jest --config jest.multiplayer.json test/features/scf-deploy.feature --silent"
```

BDD 测试锁定后，出现过一次部署失败的场景：部署脚本成功上传了 zip，但 SCF 的 npm install 失败了（网络波动，npm registry 超时），函数状态变成了 Active（SCF 显示函数代码已更新但依赖没装全）。没有 BDD 验证的话，这个错误要等到用户进来玩才被发现。BDD 测试在部署完成后 30 秒内就报告了 WS 连接失败，触发了回退——自动恢复到上一个稳定版本。

### v5：部署全程 AI 自动化（2026-07-05 之后）

到 v4 阶段所有部署基础设施已经齐备，最后的改进是把它接入到 AI 工作流中。

现在部署只需要一句话：

> 兄弟说：「部署」

OpenClaw 收到后：
1. 检查当前代码是否通过了 BDD 测试
2. 如果没有，先调 OpenCode 修好测试
3. 运行 `yarn deploy_all`
4. 等待部署完成
5. 运行 BDD 验证测试
6. 如果有问题，自动回滚并通知

这个流程固化在 `gts-deploy` skill 中。部署脚本不再是开发者的工具，而是 AI 工作流的一环。

从 v0 到 v5，每一次迭代不是因为「想升级」，而是因为当前版本出了问题。手动太麻烦 → 写脚本；没环境隔离 → 拆双环境；不够用 → 双实例；不可靠 → BDD 锁定；手动作业 → AI 接管。**每个版本的驱动力都是真实的痛。**

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
