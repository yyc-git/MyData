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

### 函数配置

| 参数 | room1 / room2 | match1 | 说明 |
|------|--------------|--------|------|
| 函数类型 | Web 函数 | Web 函数 | 支持 WebSocket 协议（控制台需勾选「WebSocket 支持」） |
| 运行时 | Node.js 18 | Node.js 18 | SCF 最高支持到 Node 18 |
| 端口 | 9000 | 9000 | scf_bootstrap 中监听 9000 端口 |
| 内存 | 512MB | 256MB | room 需要维持 WS+游戏状态，256MB 时 Full GC 频繁 |
| 超时 | 900s（15 分钟） | 60s | room 是长连接，match 是短请求 |
| 自定义静态并发 | 10 | 10 | 设为 >4 以容纳 3 个客户端 + 匹配服务的连接 |
| WebSocket 空闲超时 | 3600s（1 小时） | 不适用 | 1 小时后主动断开空闲连接 |
| 公网访问 | 开启 | 开启 | 函数 URL 配置中开启公网访问 |
| 日志投递 | CLS（默认） | CLS（默认） | 日志投递到腾讯云日志服务，用于 gts-logs 查询 |
| InstallDependency | TRUE（配置）/ FALSE（部署时） | 同上 | 首次部署时开启，后续依赖不变可关闭 |

三个函数独立部署、独立计费：

| 函数名 | 实际作用 | 冷启动时间 |
|--------|---------|-----------|
| room1 | 处理 2 个玩家的 WebSocket 连接、游戏状态、碰撞检测 | ~3-5s |
| room2 | 同上，负载均衡副本 | ~3-5s |
| match1 | 房间路由、匹配队列、心跳保活 | ~1-2s |

### scf_bootstrap 入口文件

每个 SCF 函数需要一个 `scf_bootstrap` 入口文件，内容示例：

```bash
#!/bin/bash
node app.js
```

三个关键要求：
- **Unix 格式（LF）**：Windows CRLF 会导致 SCF 找不到文件
- **可执行权限**：zip 中必须是 755（`+x`），Windows 打包会丢失 Unix 权限位
- **端口 9000**：SCF Web 函数默认监听 9000 端口，代码中的 HTTP 服务器必须绑定 `process.env.PORT || 9000`

### 为什么只能连 2 个人？

这个问题经常被问到，根源不在代码，在腾讯云 SCF 的调度模型。

**核心原因：SCF Web 函数的 WebSocket 模式下，每个 WebSocket 连接默认独占一个函数实例。**

SCF 对 Web 函数（开启 WebSocket）使用**基于会话的调度模式**——每个 WebSocket 连接建立时触发一个新实例启动，该连接的生命周期绑定到这个实例。这意味着：

- 第 1 个客户端连接 → 实例 A
- 第 2 个客户端连接 → 实例 B（新的实例）
- 第 3 个客户端连接 → 实例 C（又一个新实例）

不同实例之间**内存不共享**——实例 A 里的游戏状态（`State.ts`）在实例 B 里不存在。3 个玩家各连了不同的房间实例，他们"互相看不见"。

这不是免费套餐的限制，是 SCF Web 函数的设计机制。参考腾讯云官方文档的说明：

> Web 函数的 WebSocket 支持中，**每个 WebSocket 连接会独占一个函数实例**。当第 3 个客户端连接时，系统会自动启动一个新的实例来处理该连接，因此前两个连接与第 3 个连接的数据不会共享。
> — [腾讯云 SCF 文档 - WebSocket 支持](https://cloud.tencent.com/document/product/583/63406)

**那为什么 room1 + room2 能分别接 2 个人（共 4 人），而不是 2+2=4 个实例？**

因为我们做了两件事：

1. **设置自定义静态并发为 10** — SCF 默认的静态并发是 1（每个实例一次只能处理 1 个请求），设为 10 后，一个实例可以同时处理多个请求（包括 2 个 WebSocket 连接 + 匹配服务的通信）。但 SCF 的并发策略对 WebSocket 仍然有限制——超过一定连接数（实测 2 个）后，新连接会被分配到新实例。

2. **匹配服务不走 WebSocket 连接房间服务** — 匹配服务和房间服务之间的通信改为读写数据库，而不是 WebSocket 直连。因为 SCF 的 WebSocket 限制不仅影响客户端到房间，也影响服务端之间的 WebSocket 通信。

所以当前架构的实际容量是：**每个 room 实例最多 2 个客户端 WS 连接，room1 + room2 共 4 人上限**。为什么生产环境只写"支持 2 人"？因为 room1 和 room2 做负载均衡，一局游戏只在一个 room 里跑，所以一局游戏最多 2 人。

详细记录见：[多人联网部署记录 - 关于 WebSocket 连接有 >=3 个客户端后实例不共享的问题](https://cloud.tencent.com/document/product/583/123888)

### 以后怎么改进多人支持？

**短期方案（等腾讯云内测）：** 腾讯云提供了**基于会话的并发模式**（内测功能），开启后可以让多个 WebSocket 连接绑定到同一个实例。配置方式：

- 在函数配置中选择"单实例并发模式"为「基于会话」
- 设置会话 Key 来源（如 HTTP Header、Cookie）
- 设置单实例最大并发会话数（默认 20）

但这个功能目前处于内测阶段，需要提交[内测申请](https://cloud.tencent.com/apply/p/uik82ruqyem)才能使用。如果申请通过，一个 room 实例理论上可以支持 20 个 WebSocket 连接。

**中期方案（改状态管理）：** 把游戏状态从内存移到 Redis 或 TDS-C（腾讯云 Serverless 数据库）。这样即使不同实例也可以共享游戏状态——实例之间通过数据库同步，而不是靠绑定到同一个实例。这是更通用的方案，不依赖 SCF 的单实例会话调度。

**长期方案（架构重构）：** 放弃 SCF，迁移到 TKE（Serverless Kubernetes）或 CVM。SCF 的 warm container 方案在长连接场景下有天然劣势——实例回收后玩家要重新连接。对于真正的多人实时游戏（王者荣耀级别），SCF 不够用。不过对于个人开发者的 2 人小游戏，SCF 的免费额度完全够用。

### 内存分配经验

room-service 的 512MB 不是随便定的。最开始用 256MB，打了几局后 GC 日志显示频繁的 Full GC——每次 GC 耗时 200ms+，导致游戏卡顿。换到 512MB 后 Full GC 几乎消失，Minor GC 稳定在 10ms 以内。

match-service 只需要 256MB，它的主要工作是房间路由和匹配队列，不存游戏状态。即使 2 个 room 同时 ping 过来，它的 CPU 使用率也不到 10%。

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

---

## 附录 A：deploy-scf.js 完整代码

```javascript
/**
 * 部署 zip 到腾讯云 SCF（云函数）
 * 使用原生 SCF API（TC3-HMAC-SHA256 签名），不依赖额外 SDK
 *
 * 用法:
 *   node deploy-scf.js room1     # 部署 room1
 *   node deploy-scf.js all       # 并行部署全部
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

// ---- 配置 ----
const SECRET_ID = 'AKIDdL16e8c2KOWccglputqiU8cO5fMYlhcM';
const SECRET_KEY = 'a1GJHNZntyxojls2Galt8FHSp5A1g8Ul';
const REGION = 'ap-shanghai';
const DESKTOP = path.join(os.homedir(), 'Desktop');

const SERVICES = [
    {
        name: 'room1',
        zip: 'room-service-1.zip',
        // SCF API 配置参数
        // 注: ProtocolType/Type 是创建时参数，不可更新
        //     TraceEnable 通过 UpdateFunctionConfiguration 设置会报错，需在控制台手动开启
        config: {
            ProtocolParams: { WSParams: { IdleTimeOut: 3600 } },
            InstanceConcurrencyConfig: { MaxConcurrency: 10, DynamicEnabled: 'FALSE' },
            InstallDependency: 'TRUE',
            Timeout: 900,
            MemorySize: 512,
            // Bug 1 修复: 设置 ROOM_ID=1 让 room-service 通过环境变量识别自己是 room1
            Environment: { Variables: [{ Key: 'ROOM_ID', Value: '1' }] },
        },
    },
    {
        name: 'room2',
        zip: 'room-service-2.zip',
        config: {
            ProtocolParams: { WSParams: { IdleTimeOut: 3600 } },
            InstanceConcurrencyConfig: { MaxConcurrency: 10, DynamicEnabled: 'FALSE' },
            InstallDependency: 'TRUE',
            Timeout: 900,
            MemorySize: 512,
            // Bug 1 修复: 设置 ROOM_ID=2 让 room-service 通过环境变量识别自己是 room2
            Environment: { Variables: [{ Key: 'ROOM_ID', Value: '2' }] },
        },
    },
    {
        name: 'match1',
        zip: 'match-service.zip',
        config: {
            InstallDependency: 'TRUE',
            Timeout: 60,
            MemorySize: 256,
        },
    },
];

// ================================================================
// TC3-HMAC-SHA256 签名 (腾讯云 API V3)
// 参考: https://www.tencentcloud.com/document/product/1278/61860
// ================================================================

function sha256(message) {
    return crypto.createHash('sha256').update(message).digest('hex');
}

function hmacSha256(key, message) {
    return crypto.createHmac('sha256', key).update(message).digest();
}

/**
 * 生成腾讯云 API v3 签名头
 */
function sign(action, payload, timestamp) {
    const date = new Date(timestamp * 1000);
    const dateStr = date.toISOString().slice(0, 10);  // YYYY-MM-DD（CredentialScope 和 HMAC 都用这个格式）
    const service = 'scf';

    // 1. CanonicalRequest
    const httpMethod = 'POST';
    const canonicalUri = '/';
    const canonicalQuery = '';
    const contentType = 'application/json; charset=utf-8';
    const canonicalHeaders =
        'content-type:' + contentType + '\n' +
        'host:scf.tencentcloudapi.com\n';
    const signedHeaders = 'content-type;host';
    const hashedRequestPayload = sha256(payload);
    const canonicalRequest =
        httpMethod + '\n' +
        canonicalUri + '\n' +
        canonicalQuery + '\n' +
        canonicalHeaders + '\n' +
        signedHeaders + '\n' +
        hashedRequestPayload;

    // 2. StringToSign
    const algorithm = 'TC3-HMAC-SHA256';
    const credentialScope = dateStr + '/' + service + '/tc3_request';
    const stringToSign =
        algorithm + '\n' +
        timestamp + '\n' +
        credentialScope + '\n' +
        sha256(canonicalRequest);

    // 3. Signing key
    const secretDate = hmacSha256('TC3' + SECRET_KEY, dateStr);
    const secretService = hmacSha256(secretDate, service);
    const secretSigning = hmacSha256(secretService, 'tc3_request');
    const signature = hmacSha256(secretSigning, stringToSign).toString('hex');

    // 4. Authorization header
    const authorization =
        algorithm + ' ' +
        'Credential=' + SECRET_ID + '/' + credentialScope + ', ' +
        'SignedHeaders=' + signedHeaders + ', ' +
        'Signature=' + signature;

    return authorization;
}

/**
 * 调用 SCF API
 */
function callScfApi(action, params) {
    return new Promise((resolve, reject) => {
        const timestamp = Math.floor(Date.now() / 1000);
        const payload = JSON.stringify(params);
        const authorization = sign(action, payload, timestamp);

        const options = {
            hostname: 'scf.tencentcloudapi.com',
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Host': 'scf.tencentcloudapi.com',
                'X-TC-Action': action,
                'X-TC-Version': '2018-04-16',
                'X-TC-Region': REGION,
                'X-TC-Timestamp': String(timestamp),
                'Authorization': authorization,
                'Content-Length': Buffer.byteLength(payload),
            },
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.Response && parsed.Response.Error) {
                        reject(new Error(parsed.Response.Error.Message));
                    } else {
                        resolve(parsed.Response);
                    }
                } catch (e) {
                    reject(new Error('Parse response failed: ' + body.slice(0, 200)));
                }
            });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

/**
 * 部署一个函数
 */
async function deployOne(svc) {
    const zipPath = path.join(DESKTOP, svc.zip);
    if (!fs.existsSync(zipPath)) {
        throw new Error('zip not found: ' + zipPath);
    }

    const zipBuffer = fs.readFileSync(zipPath);
    const base64Code = zipBuffer.toString('base64');

    process.stdout.write('  [1/3] uploading code... ');
    // InstallDependency: FALSE — node_modules 已打包进 zip，不需要 SCF 安装
    // 如果以后手动更新函数时可能需要安装依赖，保留配置中的 InstallDependency: 'TRUE' 作为默认配置
    await callScfApi('UpdateFunctionCode', {
        FunctionName: svc.name,
        Code: { ZipFile: base64Code },
        InstallDependency: 'FALSE',
    });
    console.log('OK');

    process.stdout.write('  [2/3] waiting for activation... ');
    // 轮询直到函数状态 active（npm install 可能需 2-3 分钟，给 240s）
    for (let i = 0; i < 120; i++) {
        await sleep(2000);
        const res = await callScfApi('GetFunction', { FunctionName: svc.name });
        if (res.Status === 'Active') {
            console.log('OK');
            break;
        }
        if (i === 119) console.log('(timeout, continuing)');
    }

    process.stdout.write('  [3/3] configuring... ');
    // 逐项配置，每项之间等待函数 Active
    // fix-batchC: 收集配置失败项，最后累计报错
    let configFailures = [];
    const configEntries = Object.entries(svc.config);
    for (let i = 0; i < configEntries.length; i++) {
        const [key, value] = configEntries[i];
        if (i > 0) {
            // 等待上一项配置生效
            for (let j = 0; j < 30; j++) {
                await sleep(2000);
                const res = await callScfApi('GetFunction', { FunctionName: svc.name });
                if (res.Status === 'Active') break;
            }
        }
        try {
            await callScfApi('UpdateFunctionConfiguration', {
                FunctionName: svc.name,
                [key]: value,
            });
            process.stdout.write(key + ' ');
        } catch (e) {
            // fix-batchC: 不静默跳过，记录失败项
            process.stdout.write(key + '(FAIL:' + e.message + ') ');
            configFailures.push({ key, error: e.message });
        }
    }
    console.log('');

    // fix-batchC: 如果有配置失败，输出汇总
    if (configFailures.length > 0) {
        console.error('  ⚠ ' + svc.name + ' config failures: ' + configFailures.map(f => f.key).join(', '));
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- main ----
async function main() {
    const target = process.argv[2];
    const targets = target === 'all' ? SERVICES : SERVICES.filter((s) => s.name === target);

    if (targets.length === 0) {
        console.error('Usage: node deploy-scf.js <room1|room2|match1|all>');
        process.exit(1);
    }

    console.log('Deploying ' + targets.length + ' function(s): ' + targets.map((s) => s.name).join(', '));

    // 并行部署：SCF 是独立函数，各自上传+激活+配置，互不影响
    let ok = 0,
        fail = 0;
    const results = await Promise.all(targets.map(async (svc) => {
        console.log('');
        console.log('--- ' + svc.name + ' ---');
        try {
            await deployOne(svc);
            return true;
        } catch (e) {
            console.error('  ✗ ' + svc.name + ': ' + e.message);
            return false;
        }
    }));
    ok = results.filter(Boolean).length;
    fail = results.filter((r) => !r).length;

    console.log('');
    console.log('Done: ' + ok + ' OK, ' + fail + ' failed');
    // fix-batchC: 全局失败时 exit 1
    if (fail > 0) {
        process.exit(1);
    }
}

main().catch((e) => {
    console.error('Fatal:', e.message);
    process.exit(1);
});

```

---

## 附录 B：gts-logs Skill

```markdown
---
name: "gts-logs"
description: "抓取并分析GTS-Play SCF服务端日志（room1/room2/match1）"
---

# gts-logs — 抓取并分析 SCF 服务端日志

## 触发词
- `看日志`
- `查日志`
- `日志`
- `logs`

## 前置条件
- 工作目录：`D:\Github\GTS-Play\packages\meta3d-platform-publish`
- 日志来源：腾讯云 CLS（日志服务），通过 `logs-scf.js` 脚本查询
- 三个服务共用同一个 CLS 日志主题：`806996fb-c4fc-4de3-8fc6-41c0cdab83f2`

## 流程

### Step 1: 问兄弟看哪个服务的日志
> 看哪个服务的日志？room1 / room2 / match1

可加参数：
- `--limit N`：返回条数（默认 20）
- `--hours N`：最近 N 小时（默认 1）

示例：`看 room1 最近2小时的50条日志`

### Step 2: 执行日志抓取
```bash
# room1
yarn logs_room1           # 默认 20 条 × 最近 1 小时

# 带参数（通过 gulp task 不支持直接传参，改用直接调脚本）
node scripts/logs-scf.js room1 --limit 50 --hours 2
```

### Step 3: 分析日志内容
抓取后自动分析以下内容：

| 分析项 | 说明 |
|--------|------|
| 错误（Error/ERR/Exception） | 代码执行错误，标注行数 + 错误类型 |
| 警告（Warning/WARN） | 潜在问题的警告信息 |
| 模块加载失败 | `Cannot find module`、`ERR_REQUIRE_ESM` 等 |
| 连接异常 | WebSocket 断开、超时等 |
| 崩溃重启 | `exit`、`OOM`、`timeout` 等 |

### Step 4: 输出分析报告
**不贴原始日志**，只给分析结果：

```
[room1 日志分析] 最近1小时 × 20条

⚠️ 警告: 2 条
  - "WebSocket idle timeout" × 2（正常行为，空闲连接超时断开）

✅ 正常: 18 条
  - 连接建立/断开、心跳、消息处理
```

如有错误/异常，附上处理方案：
- `Cannot find module` → 检查 zip 是否缺少 node_modules，重新打包部署
- `ERR_REQUIRE_ESM` → 检查 `@rescript/runtime` 的 package.json 是否被复制进 zip
- `WebSocket timeout` → 正常行为，非错误
- `OOM / timeout` → 考虑增大 SCF 内存或超时配置

### Step 5: 通知兄弟
- **双通道通知**：桌面消息 + 飞书通知（≤10字）
- 告知日志分析结论，如有问题问兄弟是否处理

## 注意事项
- 日志通过 CLS `SearchLog` API 查询，端点 `cls.tencentcloudapi.com`
- 不支持查看实时流式日志（SCF Web 函数不走 `GetFunctionLogs` API）
- 日志可能有几分钟延迟（CLS 投递延迟）
- 如查询返回空结果，尝试加大 `--hours` 参数

## 参考
- 日志脚本：`packages/meta3d-platform-publish/scripts/logs-scf.js`
- CLS 日志主题 ID: `806996fb-c4fc-4de3-8fc6-41c0cdab83f2`
- 日志集 ID: `f55dcb46-e178-4ecb-8443-3ad42d323040`

```

---
下期讲 **P26：OpenClaw 工具链全景**——16 个 Skill 全家桶。

**下一篇：[Vibe Coding 多人游戏（二十六）—— OpenClaw 工具链全景](https://www.cnblogs.com/chaogex/p/21195307)**
