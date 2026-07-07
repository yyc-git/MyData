# Vibe Coding 多人游戏（二十九）—— 部署与服务管理

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

代码写完了、测试跑过了——怎么部署上线？GTS-Play 的部署方案围绕腾讯云 SCF（Serverless Cloud Function）展开，核心是一个由 AI 编写的 `deploy-scf.js` 脚本。

---

## deploy-scf.js

纯 Node.js、零 npm 依赖。一句话触发部署全流程：

```
打包 → zip（带 svc/ 子目录） → 上传 SCF → 发布 → BDD 验证
```

脚本内部处理了之前踩过的 6 个坑：
- undici@7 依赖冲突 → 去掉 functions-framework
- zip 深度 → 加 `svc/` 子目录
- 权限 → .NET ZipArchive 修复 +x
- ESM 冲突 → 删 override `type: module`
- Module._load → 直接注入 node_modules
- 定时器残留 → 代次守卫

---

## 双环境双实例

| 环境 | URL 参数 | 用途 |
|------|---------|------|
| production | 无 | 正式游戏 |
| test | `?isDebug=true` | AI 开发测试 |

每个环境独立部署 room1 + room2 两个实例，互不影响。

---

## 服务端口

| 服务 | 端口 | 协议 |
|------|------|------|
| room-service | 4003 | WebSocket |
| match-service | 3000 | HTTP |
| webpack-dev-server | 8093 | 开发用 |

重启顺序：先 room，再 match（room 重启断开 match 的 WS 连接）。

---

## SCF 配置

| 参数 | 值 |
|------|----|
| 运行时 | Node.js 18 |
| 内存（room） | 512MB |
| 内存（match） | 256MB |
| 并发 | 10 |
| 空闲超时 | 15 分钟 |

生产环境每 2 秒心跳保活，避免 warm container 回收。

---

## 生产运维

- **日志**：gts-logs 自动拉取 SCF 日志，按 room/match 过滤
- **告警**：SCF 自带实例崩溃恢复 + 冷启动超时告警
- **热修复**：发现 bug → AI 改代码 → 秒级部署（不进控制台）
- **版本管理**：deploy-scf.js 支持版本号标注，可回退

---

下期讲 **P30：OpenClaw 工具链全景**——16 个 Skill 全家桶。

**下一篇：[Vibe Coding 多人游戏（三十）—— OpenClaw 工具链全景](https://www.cnblogs.com/chaogex/p/21195307)**
