# Vibe Coding 多人游戏系列 — 详细大纲

> 系列作者：杨元超
> 共 35 篇（含 P0 目录 + 4 篇已发布 + 30 篇待写）
> 最后更新：2026-07-07

---

## 推荐阅读顺序

- **想了解全貌**：P5 总览 → 挑感兴趣的时间线篇 → 挑感兴趣的知识篇
- **想上手实操**：P5 → P34 起步指南 → P16→P20 工作流 → P25 测试 → P26 Token → P21 规则
- **想避坑**：P5 → P13 部署 → P33 反模式 → P22 重构标准
- **时间线通读**：P5 → P6→P7→P8→P9→P10→P11→P12→P13→P14

---

## P0 — 目录

**字数：** 500-5000（代码不计入）

- 系列总索引
- 每篇 2-3 行摘要
- 推荐阅读顺序（见上）

---

## 已发布（P1-P4）

### P1 — Pieter Levels 一个人的游戏帝国

**状态：** 已发布
**摘要：** Pieter Levels 用 AI 3 天上线多人飞行模拟，17 天做到 100 万美金 ARR。他做对了什么？

### P2 — Vibe Jam 2026 技术地图

**状态：** 已发布
**摘要：** Vibe Jam 2026 Top 12 技术栈全景：为什么 80% 的获奖作品都是多人游戏？Three.js + WebSocket 成为事实标准。

### P3 — AI 做多人游戏的实操方法论

**状态：** 已发布
**摘要：** 从 Tejas Kulkarni 的 1v1 FPS 完整复盘，到 Pieter 的经验，再到开源项目，总结出 AI 做多人游戏的 5 阶段标准化流程。

### P4 — 从 levelsio 到 GTS-Play — 能抄什么

**状态：** 已发布
**摘要：** 回到自己的项目，对比 Pieter Levels 和 GTS-Play 的差异化优势，列出 6 件可以直接抄的事情。

---

## 总览

### P5 — 实战总览：从 0 到 1 的时间线地图

**字数：** 500-5000（代码不计入）

**内容清单：**
- 一张时间线图：9 个阶段 + 工作流进化 + 知识管理
- 每个阶段一句话定位：
  - basic1 帧同步 → 切换到状态同步 → Monorepo → 双服务 → Logic 层 → 服务端权威 → 状态管理 → SCF 部署 → 开闭原则
- 设计思想速览（10 个，一句话一个）
- 坑的速览清单（按类别分，只列标题）
- 推荐阅读路径

---

## 时间线

### P6 — Phase 1：basic1 帧同步（Lockstep）

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **帧同步原理**
   - 什么是 Lockstep：服务端是命令中继，不参与计算
   - 所有 Client 执行相同的指令序列 → 确定性输出
   - 帧号对齐 + 偏移补偿
2. **basic1 实现**
   - `MultiPlayerManager.ts` — WS 连接、命令收发、MsgAllCommands 协议
   - `LogicManager.syncServer()` — 回滚预测数据 → 执行服务端命令 → 重放本地离线命令
   - `PredictImmutableDataForRollback.ts` — 快照式回滚，存上一个服务端快照后反算
   - Immutable.js 全程不可变数据
   - Tween.js 插值——非本人移动用缓动补间
   - 碰撞检测在客户端（Box3）
3. **帧同步 VS 状态同步详细对比表**
   - 服务器角色（中继 vs 权威）
   - 客户端工作量（大 vs 小）
   - 防作弊（弱 vs 强）
   - 带宽（低 vs 高）
   - 浮点确定性（头疼 vs 不依赖）
   - AI 编写难度（复杂 vs 简单）
4. **坑**
   - 🕳️ **浮点数确定性问题**：JS 浮点各平台不一致，渲染结果不同
   - 🕳️ **rollback + reapply 状态机边界 bug**：回滚代码逻辑复杂，AI 写的常有 bug
   - 🕳️ **客户端 vs 服务端碰撞检测不一致**
5. **为什么放弃**：帧同步看起来很美（带宽小），但在 AI 时代不是最优解。状态同步每个端各自为政，AI 理解和维护都简单得多。

---

### P7 — Phase 2：切换到状态同步 + TSRPC

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **转变动机**
   - commit：`feat: add new_basic2/ for state sync`
   - 放弃帧同步原因：AI 写不来浮点数问题、debug 困难、rollback 代码难以维护
2. **服务端权威模型**
   - Server 不再只是中继，而是权威计算
   - `Game.ts` + `Loop.ts` 负责核心游戏循环
   - `sendMoveState` 替代 `addCommand`——客户端只管传输入不做逻辑
   - `onGameState handler` 接收服务端下发的 `MsgGameState`
3. **TSRPC 引入**
   - 全链路类型安全（`serviceProto.ts` — 改一端 TS 编译全崩）
   - WsClient + HttpClient 一体化
   - 请求-响应 + 消息推送双模，不需要手动解析 JSON
   - 🕳️ **bigint 传不了的坑**：TS 编译 bigint→string，TSRPC encodeJSON 又做一层
4. **客户端实现**
   - `getInterpolatedPlayers()` — 快照缓冲区线性插值
   - `predictMove()` — 本地向前预测
   - `applyCorrection()` — 服务端权威拉回
5. **MMD 巨人 + FBX 小人双轨动画**
   - MMDLoader 加载 giantess（giantess.pmx）
   - FBXLoader 加载 little man（little-man.fbx）
   - 各自的动画状态机（Idle/Running vs VMD 烘焙）
6. **坑**
   - 🕳️ `setTimeout` + `clearTimeout` 做命令防抖——先开枪后瞄准的循环

---

### P8 — Phase 3：Monorepo 重构

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **为什么 Monorepo**
   - 多 package 共享类型（room-service 和 frontend 共用 MsgGameState 协议）
   - 统一构建（tsc、rescript build、jest 共用配置）
2. **Lerna + yarn workspace 配置**
   - lerna.json 配置
   - 目录结构：frontend / room-service / match-service / logic
3. **四包结构设计**
   - `packages/frontend/` — Three.js + React 前端
   - `packages/room-service/` — 游戏服务端（TSRPC 4003）
   - `packages/match-service/` — 匹配服务端（TSRPC 3000）
   - `packages/logic/` — 共享逻辑（ReScript）
4. **从 demos/ 到 packages/ 迁移**
   - 原来 `demos/basic1/` 直接引用 `room-service/src/` — 跨目录 import
   - tsconfig paths 配置
5. **坑**
   - 🕳️ **循环依赖**：monorepo 初始化时包间互相引用
   - 🕳️ **类型引用路径混乱**：relative path 太长，改用 tsconfig paths

---

### P9 — Phase 4：双服务架构

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **为什么拆**
   - 原本房间管理 + 匹配逻辑混在一起 → God Object
   - 职责分离：room 管游戏、match 管匹配分配
   - 可以独立扩缩容（人多加 match，不加 room）
2. **架构图**
   ```
   match-service（HTTP, 3000）
       ↑↓ WS 取房间状态
   room-service（WS, 4003）
       ↑↓
   浏览器（Three.js 前端）
   ```
3. **room-service（WS, 4003）** — 游戏循环、状态广播、房间生命周期、玩家管理
4. **match-service（HTTP, 3000）** — 匹配算法、房间分配、房间列表查询
5. **TSRPC 全链路类型定义**
   - `serviceProto.ts` + `shared/protocols/`
   - `State.ts` + `StateType.ts` 统一状态入口
6. **坑**
   - 🕳️ **包间共享类型的引用策略**：两个包都 import 同一份 types
   - 🕳️ **match 断 WS 重连 room 的容错**：room 重启 match 不知道

---

### P10 — Phase 5：Logic 共享层

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **为什么抽 logic 包**
   - 前端 + 服务端共用同一套碰撞、血量、移动逻辑
   - 不然有两份实现，bug 频发
2. **ReScript 纯函数**
   - `executeCommand` — 执行玩家命令（移动、旋转）
   - `getCollisionBox` — 获取碰撞箱数据
   - `computeCollisionDamage` — 计算碰撞伤害
   - 纯函数 + 无副作用 = 前端和服务端行为完全一致
3. **bundle-logic.js**
   - 问题：服务端不能直接 import ReScript（25MB node_modules）
   - 方案：esbuild --bundle → 单文件 49KB
   - 流程：Rescript 编译 → esbuild --bundle → 注入服务端
4. **坑**
   - 🕳️ **bundle 闭包模块的暴露方式**：尝试 Module._load hook → 太复杂 → 改为直接注入 node_modules
   - 🕳️ **ReScript index.res 接口设计改来改去**：返回值类型调整多次

---

### P11 — Phase 6：服务端权威完整实现

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **10Hz Tick Loop 实现**
   ```typescript
   let generation = 0
   let startGameLoop = (state) => {
     let currentGen = ++generation
     let interval = state.config.isDebug ? 33 : 100
     let timer = setInterval(() => {
       if (currentGen !== generation) { clearInterval(timer); return }
       state = executeCommand(state)
       state = computeCollisionDamage(state)
       broadcastMsgGameState(state)
     }, interval)
   }
   ```
   - 代次守卫（generation++）：防 warm container 定时器残留
   - 调试 30fps / 生产 10fps
2. **核心循环**
   - 收集玩家命令 → executeCommand → 凸包碰撞检测 → 计算伤害 → 检查游戏状态 → 广播 MsgGameState
3. **AI giantess 行为逻辑**
   - 自动移动路径规划
   - 玩家碰撞判定
   - 踩踏伤害计算
4. **绝对状态下发**
   - `MsgGameState` 含全量字段（position, rotation, hp, collision, animation 等）
   - 客户端不做计算，只展示 + 插值
5. **碰撞检测：OBB → 凸包（Convex Hull）**
   - v1：AABB（Axis-Aligned Bounding Box）——最简单但旋转物体不准
   - v2：OBB（Oriented Bounding Box，有向包围盒）——支持旋转物体的精确碰撞
   - v3：凸包（Convex Hull）——在 OBB 基础上进一步优化，用物体实际轮廓的点集构造凸包，碰撞判定更精确
   - 凸包 vs OBB：OBB 对倾斜/细长物体仍有空隙区域，凸包贴合实际形状，碰撞反馈更自然
   - 实现：服务端用凸包点集做分离轴测试（SAT），前端同样实现在 Logic 共享层
6. **双轨动画管理**
   - MMD + FBX 分开的动画状态机
   - 每类模型有自己的 Idle → Walk 切换逻辑
7. **坑**
   - 🕳️ **warm container 定时器残留** → 代次守卫解决
   - 🕳️ **AABB 碰撞不够** → 升级到 OBB → 再升级到凸包
   - 🕳️ **OBB 仍有空隙** → 凸包消除误判
   - 🕳️ **AI giantess 寻路卡死**：路径规划在服务端 setInterval 里阻塞后续 tick

---

### P12 — Phase 7：状态管理演进

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **v1：Immutable.js Map**
   - 函数式不可变状态，回滚友好
   - 但体积大（~50KB gzip）
   - 全套 Immutable API 学习成本
2. **v2：自制 ImmutableHashMap**
   - 去 Immutable.js 依赖
   - HashMap 类型实现
   - 🕳️ **hash 冲突 bug**：自制实现不完善
3. **v3：回归 Js.Dict**
   - 原生对象，性能够用
   - 代码更简单
   - 🕳️ **类型安全性不够** → 包装函数
4. **v4（最终）：TransformStore + VisualStore + RenderFrameData**
   - 按职责拆 store
   - SoA（Struct of Arrays）布局：改善 cache locality，减少 GC 压力
   - **设计目标：为 WebGPU + 多线程就绪**
     - TransformStore 的 Float32Array 直接映射 GPU StorageBuffer
     - VisualStore 的 flags Uint8Array 位字段低频同步
     - 固定 stride（64 字节实体槽）→ 一键切换 SharedArrayBuffer
     - IRenderer.syncFromEntityStore() 批量同步，Worker 可用
   - 适合前端每帧遍历更新大量对象的场景
5. **每次演进的原因和决策过程**（表）

---

### P13 — Phase 8：SCF 部署 6 连环坑

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **部署迭代 v0-v4**
   - v0：basic1 时代——手打 zip + 控制台上传（总挂）
   - v1：deploy-scf.js 一键部署脚本
   - v2：production + test 双环境（url 参数控制）
   - v3：room1 + room2 双实例并发（各 2 人，共 4 人）
   - v4：BDD 测试锁定部署质量
2. **6 个部署坑（这是核心内容）**
   - 🕳️ **坑1：undici@7 File is not defined**
     - 根因：`@cloudbase/functions-framework` 链式依赖 undici@7，需要 Node 20，SCF 只有 Node 18
     - 解决：去掉整个框架，直接启动 TSRPC HttpServer
   - 🕳️ **坑2：zip 目录深度**
     - 根因：zip 中扁平结构导致 `../../../logic/src` 解析到根目录外
     - 解决：zip 内加 `svc/` 子目录做深度补偿
   - 🕳️ **坑3：scf_bootstrap 无执行权限**
     - 根因：Windows `Compress-Archive` 不保留 Unix `+x`
     - 解决：.NET `ZipArchive` reflection 设 ExternalAttributes
   - 🕳️ **坑4：ESM vs CJS 冲突**
     - 根因：`@rescript/runtime` 的 package.json 有 `"type": "module"` → require() 报 ERR_REQUIRE_ESM
     - 解决：复制时删掉该文件
   - 🕳️ **坑5：Module._load hook 不可靠**
     - 根因：想用 hook 拦截 require 暴露 bundle 闭包模块
     - 解决：改为直接注入 node_modules
   - 🕳️ **坑6：warm container 定时器残留**
     - 根因：冷启动后旧 setInterval 继续跑
     - 解决：代次守卫 generation++
3. **每个坑的 E2E 测试锁定**
   - 7 场景 BDD 覆盖：服务可达、WS 连接、无 ESM 错误等
   - 每次部署前自动运行
4. **Warm Container 生命周期**
   - SCF 空闲 15 分钟回收实例（可配），下次请求冷启动
   - 冷启动耗时 ~1-3 秒，影响第一局匹配体验
   - **热保活策略**：心跳 keep-alive 请求每 2s 发一次（生产），避免回收
   - 双实例（room1 + room2）各自独立 warm，一个回收不影响另一个
   - 🕳️ **冷启动瞬间并发**：两个玩家同时连入 → 两个新实例同时初始化 → 可能冲突 → 需排队锁
5. **生产运维与监控**
   - **日志策略**：SCF 自带日志服务，CLS 采集 stdout/stderr，保留 7 天
   - **实时调试**：gts-logs 自动拉取最近 100 条日志，按 room/match 过滤
   - **告警规则**：实例崩溃自动重启（SCF 自带），无玩家时自动缩容
   - **版本回退**：deploy-scf.js 支持指定版本号回退，一键还原旧版本
   - **room→match 重启依赖**：room 重启后 match 的 WS 连接断开，必须连带重启 match

---

### P14 — Phase 9：开闭原则重构

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **核心约束（🟢 通行标准）**
   - 多人功能不能改动任何单机代码路径
   - 新增多人功能 = 扩展现有架构（新文件/新模块），不做"if 多人 else 单机"
2. **实现方式**
   - `frontend/src/business_layer/multiplayer/` — 多人专属业务逻辑
   - `MultiplayerLoop.ts` + `ManageScene.ts`
   - 入口通过 URL 参数决定加载哪个路径
3. **开闭原则在 AI 协作中的价值**
   - AI 改别人代码容易"不知深浅地破坏"
   - 单机路径 zero-touch = 给 AI 一个安全的操作空间
   - 这是 AI 时代架构设计的核心思想
4. **mpFrameSkip 隔帧多人更新**
   - 多人逻辑 15fps，渲染 60fps
   - state.multiplayer 统一管理多人帧率
5. **坑**
   - 🕳️ **多人组件和单机组件同场景渲染冲突**
   - 🕳️ **多人退房后状态残留**：`dispose()` 未遍历清理所有 ref/flag

---

### P15 — Phase 10：WebGPU 与多线程调研方案

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **为什么做这个调研**
   - 项目从 basic1 帧同步一路走到服务端权威状态同步，渲染路径一直是 Three.js WebGL
   - 2026 年 6 月，Three.js 0.184 的 WebGPU 支持达到可用状态（iOS Safari 26+ / Chrome Android 149+）
   - 同时单机版有 GPU Skin 的成功经验，多人版应该提前准备 WebGPU + 多线程就绪架构
2. **WebGPU 迁移分析**
   - Three.js 0.184 WebGPU 成熟度：75%，多人路径够用
     - 核心渲染 ✅、标准材质 ✅、后处理 ❌、Compute ✅、间接绘制 ✅
   - **迁移成本：~15 行代码**（全靠 IRenderer 抽象层隔离了 Three.js 实现）
     - ThreeRenderer.ts 改类型 + 构造函数 + dispose 守卫
     - 其他所有文件 0 行改动
   - 自动回退：WebGPURenderer 内部静默回退 WebGL2
3. **GPU-Driven Pipeline 调研**
   - Three.js TSL 积木盒：ComputeNode / StorageBufferNode / IndirectDraw / SkinningNode
   - **SOA 布局的最终目标**：TransformStore 的 Float32Array 直接映射 GPU StorageBuffer
   - 各项把握度：
     - GPU LOD（距离）：85%
     - Instance Frustum Cull：75%
     - GPU 碰撞检测：75%
     - Hi-Z 遮挡剔除：55%
     - Meshlet Triangle Cull：25%（研究级）
4. **多线程架构分析**
   - SAB（SharedArrayBuffer）双缓冲架构：~512KB，Header + Frame A/B + Result
   - **三线程分工**：
     - 主线程：Game Logic + 渲染同步 + ECS 状态管理（写 EntityStore）
     - Logic Worker：MMD 动画 + FBX 动画 + 凸包碰撞（~1-2周可做，不依赖 WebGPU）
     - Render Worker（远期）：OffscreenCanvas + WebGPURenderer（角色 >20 时才需要）
   - 核心障碍：Three.js Scene 不能跨线程
     - 解法：SAB 存纯数据（transform/anim/boneMats），Render Worker 维护独立 Scene + 对象池
     - 双缓冲 + AtomicNotify 同步
5. **SOA 架构——为 WebGPU 多线程而生**
   - 这不是巧合，v4 SOA 从设计第一天就在为这个目标铺路：
     - TransformStore.positions（Float32Array）→ 直接映射 GPU Compute Shader input
     - VisualStore.flags（Uint8Array bitfield）→ 低频同步，不浪费带宽
     - 固定 64 字节实体槽 → EntityStore 切到 SAB 只需改一行构造函数参数
     - IRenderer.syncFromEntityStore() → 批量同步，Worker 中也能用
   - 对应 IRenderer 新增接口：BackendCapabilities / dispatchCompute / renderIndirect / syncFromEntityStore
6. **实施路线图**
   - Phase 1（已做完）：EntityStore 基建（TransformStore + VisualStore + 对象池）
   - Phase 2（近期）：Logic Worker（MMD+FBX 动画 + 凸包碰撞，不依赖 WebGPU）
   - Phase 3（中期）：WebGPU 切换（ThreeRenderer 双后端，~1周）
   - Phase 4（后期）：GPU-Driven（GPU 碰撞 → LOD → Frustum Cull）
   - Phase 5（远期）：Render Worker（OffscreenCanvas + SAB，角色 >20 个）
7. **零成本省钱原则**
   - 后处理走 TSL，不走 EffectComposer（WebGPU 下不可用）
   - 不用 getContext() / getExtension() / onBeforeCompile
   - 不加新的 WebGL 专用 API → 将来迁 WebGPU 成本加倍
   - 现在克制 → 将来迁 WebGPU 1周 + 加多线程 2-3周
   - 现在复刻全部单机功能 → 将来还债 9-14周

---

## 工作流进化

### P16 — 纯 AI 对话时代 → OpenCode 引入

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **纯 AI 对话时代**
   - 每次改代码直接把 prompt 输入给 AI（ChatGPT / Claude / DeepSeek）
   - AI 输出代码 → 手动复制粘贴到 IDE
   - 测试也手动跑、手动检查
   - 问题：聊天窗口随代码量爆炸（2K→100K）、上下文浪费严重
   - 每次改代码要重新贴整个文件
2. **OpenCode 引入**
   - AI 接管终端、文件读写、浏览器
   - 从"写代码"变成"执行任务"
   - feat:/fix:/refactor: 前缀触发自动调度
   - 定位：OpenClaw 管调度（免费 Flash Free）、OpenCode 管编程（付费 Flash）
   - **月费从 2000 元降到不到 100 元**
3. **token 利用率质变**
   - 不用贴上下文了——OpenCode 自己看文件
   - 上下文窗口 1M（付费 Flash）vs 200k（免费 Flash Free）
4. **关键对话摘录**
   - "我完全不用写代码"（06-15）
   - "只当顾问"（06-17）

---

### P17 — OpenClaw 调度层 + Skill 固化 + 自动部署

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **三角色分工**
   - OpenClaw（调度层）：免费 Flash Free，接收任务、调度、验证、提交
   - OpenCode Pro：付费 Pro，架构/方案/顽固 bug/审核
   - OpenCode Flash：付费 Flash，常规功能/普通 bug/重构
2. **Skill 化严守流程**
   - gts-dev-workflow 诞生：feat:/fix:/refactor: 触发 OpenCode
   - gts-acceptance：BDD 先 RED → AI 修复 → GREEN 全自动
   - 把"固定流程"做成 Skill → AI 严格执行步骤
   - "编程流程固化为 skill 后，ai 就能严格执行流程步骤了"（06-17）
3. **自动部署 + 日志（06-30）**
   - deploy-scf.js（纯 Node.js，零 npm 依赖）由 AI 编写
   - 日志抓取脚本也由 AI 开发
   - 实现：AI 自动开发 → 自动验收 → 自动部署 → 自动日志分析
   - 全程不需要进 SCF 控制台
4. **关键对话摘录**
   - "以后再也不需要写代码了"（06-17）
   - "以前我还要进控制台一个一个地部署，现在都不需要了"（06-30）

---

### P18 — E2E 自测与根因修复

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **三天一个最难同步 Bug（07-05 前后）**
   - 问题：位置同步异常
   - AI 拍脑袋修复 → 每次看起来对但实际没解决
   - 根因：没有结合日志定位根因，只靠"看起来"修复
2. **解法：让 AI 自测自修**
   - E2E 自动测试 → AI 自己复现问题 → 打日志 → 定位根因 → 修复 → 通过自测
   - 全程不需要手动测试
   - "让 ai 自己复现该问题，并通过打日志来定位根因->然后去修复到通过自动测试为止"（07-05）
3. **Specs（场景清单）引入**
   - AI 产出 Main Specs / Delta Specs
   - 先让 AI 出规格 → 兄弟确认 → 再开工
   - 来源：知乎文章"如何引入 Spec"
4. **TDD 纪律成型**
   - 测试必须直接调真实代码——禁 mock-only
   - 先因 bug 真实 RED → 再修复 GREEN
   - 每个修复新增集成测试锁定

---

### P19 — 完整 Vibe Coding 工作流全景

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **工作流总图**
   ```
   兄弟说 "fix:xxx" → OpenClaw 收到
     → 调度 OpenCode → AI 写代码+测试
     → gts-acceptance（BDD RED→GREEN）
     → git commit → 通知
   ```
2. **E2E 自动化（CDP 双窗口 + blocks 积木系统）**
   - CDP WebSocket 控制 Playwright Chromium
   - 双窗口并行（room1 + room2）
   - 6 阶段积木：初始化 → 创建房间 → 加入 → 匹配 → 游戏 → 结束
   - 每个 block 独立验证（截图 + DOM 检查 + 服务端日志）
   - blocks 切换独立 Tab 类型，不混用
3. **Agent Brief 写法**
   - 体验式反馈 > 技术 spec（"太矮了" > "把 y 轴加 0.5"）
   - Brief 模板：修复目标 / 根因分析 / 验收标准 / 格式要求
   - 引用 agent-context.md 不逐条贴
   - 代码审核 brief 必须贴完整 🐛🔴🟡🟢 规则
4. **模型选择策略**
   - Flash Free（200k）：日常对话、简单修改
   - Flash 付费（1M）：写代码、快速验证
   - Pro（1M）：根因分析、复杂重构、代码审核

---

### P20 — Vibe Coding 经验和教训合集

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **测试策略金字塔**
   - 单元测试：AI 自动生成
   - 集成测试：半自动，定义验收标准后 AI 写+跑
   - E2E 测试：CDP 双窗口手动辅助 + blocks
   - "单元测试由ai自动生成。集成测试的生成需要我稍微指导下"
2. **让 AI 复现 bug 比让 AI"猜修复"有效 10 倍**
   - 经验表明：AI 不结合日志定位 = 永远修不对
   - E2E 自测 + 日志定位 = 根因 → 修复 → 验证 闭环
3. **Skill 化是让 AI 严守流程的关键**
   - 纯 prompt 说"你要按流程走"不如写一个 SKILL.md
   - 固化后 AI 每一步都执行，不会跳过
4. **Vision 瓶颈**
   - "AI 在 3D 不好使"——空间位置识别、截图识别
   - 折中：用 DOM 状态 + 服务端日志代替
5. **角色转变：从 builder 到 conductor**
   - "我完全不写代码，只当顾问"
   - 定义 Specs → 验收 → 总结，剩下的 AI 做
6. **所有协作坑汇总**
   - 🕳️ AI 偷换方案 → 每次逼自己看完输出
   - 🕳️ E2E 前不重启 → WS 断连卡"查找房间中"
   - 🕳️ tool loop 不 yield → 118 轮炸 session
   - 🕳️ HMR 断 WS → 测试期间禁改代码
   - 🕳️ 集成测试 mock → 必须调真实代码

---

## 知识管理

### P21 — 三层编码规则体系

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **为什么需要三层**
   - 基础层（basic-rules.md）：代码本身的质量标准
   - 模块层（module-rules.md）：架构边界约束
   - 流程层（workflow-rules.md）：开发纪律和流程
2. **基础层规则详解**
   - 开工规则（出方案等确认）
   - 同步源文件（改 ts 再 tsc、改 res 再 build）
   - 防御式编程（参数必传、尽早 throw、减少可选参数）
   - 通用编码规则
3. **模块层规则详解**
   - 开闭原则：多人/单机必须分离，新增不修改
   - 服务规则：启动顺序（先 room 再 match）、E2E 前重启
   - 状态同步原则：绝对状态 > 变化量、服务端校验、断线保留
4. **流程层规则详解**
   - 重构标准（🐛🔴🟡🟢 概述）
   - 测试规范
   - 代码审核回复规则
5. **agent-context.md 机制**
   - 位置：项目文档中的 agent-context.md
   - 内容结构：项目结构 / 编码红线 / 测试命令 / BDD 规范 / 变更记录 / 禁止事项
   - **自动注入**：每个 OpenCode brief 开头以字符串自动附加，不需要 AI 读取
   - 为什么放 `docs/` 而不放 `notes/`（OpenCode 默认工作目录覆盖）
   - 演化：从逐条复制到引用路径（省 ~600 tokens）
   - 和 project-context.md 的区别（一个给 OpenCode，一个给自己）

---

### P22 — 重构标准 🐛🔴🟡🟢 逐条拆解

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **🐛 Bug 检查清单（必查）**
   - 逻辑与竞态：空指针、边界条件、异步竞态、条件分支、状态更新
   - 类型安全：as any、可选链、函数签名、断言风险
   - 内存泄漏：Three.js dispose、event cleanup、timer 清除
   - 改动影响：回归、接口同步、被删代码调用链
   - **改动是否真正生效？** AI 可能改了但没执行到
   - **End 逻辑重置（最高频 bug 源）**：
     - gameStop 未重置 gameStartStartedRef
     - onGameStarted 未重置 gameOverTriggeredRef
     - 跨轮状态残留
     - **每个 end/stop/dispose 必须遍历清理所有关联 ref/flag/state**
2. **🔴 清理项（直接改）**
   - 测试残留：window.__xxx、[DBG]、调试 console.log
   - 未使用的 import、死代码、被注释旧实现
3. **🟡 重构项（出方案等确认）**
   - 架构：开闭原则、事件驱动替 if-else、拆文件拆函数
   - **警惕不必要的抽象**：AI 一个场景搞出接口/工厂/策略模式全套
   - **重复代码**：AI 不知道已有工具函数，自己重新实现
   - **风格一致性**：AI 每次写法不同，多种风格混搭
   - **改动范围**：一个简单需求顺手改了十个不相关文件
   - 测试质量：BDD 必须调实际代码、禁 mock-only
   - 职责：单一职责、纯函数混副作用、层间越界、最少知识
   - 状态管理：禁 window 全局、模块级变量进 state
   - 状态同步子规则：发绝对值、服务端校验、断线保留
4. **🟢 关注项**
   - 条件嵌套>3层、缺 JSDoc、空 catch、未清理 event/timer、异步无超时
5. **代码审核回复规则**
   - 没写内容 = 该项直接要重构
   - 写了内容 = 按写的内容修改

---

### P23 — Specs、变更管理与方案体系

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **Main Specs 体系**
   - 6 个全局场景：collision / host-transfer / match-service / multiplayer-sync / player-lifecycle / room-service
   - 每个 Spec 的结构：场景描述 + 前置条件 + 步骤 + 验证点
   - 位置：项目文档 specs 目录
2. **Delta Specs 系统**
   - 每次改动新增的场景，存在 `changes/xxx/specs/` 下
   - AI 产出 Delta Specs → 兄弟确认 → 开工
   - 验收 = 验证 Delta Specs 全部通过
3. **变更目录结构**
   - `changes/<日期>-<功能名>/` + `specs/` + `log.md`
   - 归档：修复稳定后移入 `changes/archive/`
   - 示例：<日期>-<功能名>-<描述>
4. **方案与讨论记录体系**
   - 讨论记录（discussion/）：技术讨论、审核摘要
   - 方案文档（solutions/）：正式技术方案（架构/部署/功能）
   - 代码笔记（code-notes/）：实现细节、踩坑记录
   - **从讨论到实施的 SOP**：讨论 → 出方案 → 确认 → 实现 → 记录

---

### P24 — 决策记录精要（ADR）

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **ADR 格式**
   - 标题 + 决策 + 上下文 + 选项 + 选择理由 + 影响
2. **关键决策精选**
   - **OpenCode 调度模式**（三角色：调度 Flash Free / 写代码 Flash / 审核 Pro）
   - **状态同步选择**（绝对状态 > 增量，丢包免疫、代码简单）
   - **E2E 调试体系**（Playwright CDP > BrowserAct）
   - **beforeunload-disconnect**（替代 sendExit，WS 断开自动退出）
   - **SCF 部署方案**（直接注入 node_modules > Module._load hook）
   - **单人直接进入游戏**（URL 参数指定角色类型）
   - **线上 2 人限制**（无 session 管理，room1+room2 各自独立）
   - **host-transfer Phase3**（房主转移后状态恢复）
3. **反面决策（选了后来后悔的）**
   - 帧同步（basic1）→ 换状态同步（new_basic2）
   - Immutable.js → 去依赖
   - Module._load hook → 直接注入 node_modules

---

### P25 — 测试策略体系

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **测试金字塔在 AI 时代的落地**
   - 单元测试：AI 自动生成，不人工干预
   - 集成测试：半自动，定义好验收标准后 AI 写 + 跑
   - E2E 测试：CDP 双窗口半自动 + 手动辅助 3D 场景
2. **BDD 测试详解**
   - `test/features/*.feature` + `test/step-definitions/*.steps.ts`
   - 命令：`npx jest --config jest.multiplayer.json --silent`
   - 类型检查：`npx tsc --noEmit`
   - 7 场景覆盖：服务可达、WS 连接、无 ESM 错误
3. **E2E 自动化（blocks 积木系统）**
   - 6 阶段：初始化 → 创建房间 → 加入 → 匹配 → 游戏 → 结束
   - CDP WebSocket 控制 Playwright Chromium
   - 双窗口并行
   - 每个 block 独立验证（截图 + DOM + 日志）
   - blocks 切换独立 Tab 类型，不混用
4. **TDD 纪律**
   - 先因 bug 真实 RED → 再修复 GREEN
   - 禁止 mock 模拟函数——集成测试必须调真实代码
   - 测试覆盖正常路径 + 边界 + 异常
5. **3D 场景测试的折中**
   - Vision 模型暂不支持 3D 截图识别
   - AI "在 3D 不好使"（空间位置难判断）
   - 折中：DOM 状态 + 服务端日志作为主要验证手段

---

### P26 — Token 优化全攻略

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **agent-context.md 引用去重**
   - 共享规约只引用不逐条贴
   - 省 ~600 tokens/轮
2. **子 session 隔离**
   - 大任务 spawn child，撑爆不影响主 session
   - 省 ~300-3000 tokens
3. **摘要返回格式**
   - 子 agent 返回 2-3 行 + 文件列表
   - 父 session 不吞 git diff / OpenCode 原始产出
4. **Tool loop 主动 yield**
   - 每 20-30 轮输出进度结束回合
   - 让 compaction 能压缩上下文
   - 防 118 轮 tool call overflow
5. **Compaction 170k 触发**
   - 200k × 85% = 170k 触发压缩
   - 对话不容易被压缩
6. **rcl_explore 优先于 rcl_restore**
   - 遇到 RCL 指针先问具体问题
   - 不整段拉回几十 KB
7. **并行读文件**
   - 一次 read A+B+C 代替三步走
8. **grep 加 include 限制**
   - 避免扫 node_modules
9. **模型 contextWindow 速查**
   - Flash Free（deepseek-v4-flash-free）：200k → 日常 + 调度
   - Flash（deepseek-v4-flash）：1M → 写代码 + 验证
   - Pro（deepseek-v4-pro）：1M → 根因分析 + 审核
10. **连续失败降级**
    - 根因分析失败 → 换 Pro 模型重试

---

### P27 — 记忆管理体系

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **QMD 数据库系统**
   - 5 个 collections：memory-root-main / memory-dir-main / gts-play / gts-play-notes / sessions-main
   - SQLite 索引
   - 按标题精确匹配 → 关键词匹配 → 语义搜索
2. **MEMORY.md 核心索引**
   - 33 个锚点词，快速定位到对应文档
   - 搜索 priority：title exact > keyword > semantic
3. **MEMORY-ARCHIVE.md**
   - 详细记忆存档：历史教训、重要决策、重构规则
   - 所有 🔴🔴🔴 标记的内容
4. **memory/ 目录**
   - 35 篇每日记忆（2026-05-15 到 2026-07-05）
   - 1 篇 agent-token-optimization.md
5. **检索协议**
   - CLI：`openclaw memory search "<keywords>" --max-results 3 --json`
   - 禁用 memory_search 工具
6. **入库标准**
   - 满足至少 2 条：影响未来决策 >2周 / 重复使用 / 会造成损失 / 可操作可验证
7. **保存流程三件套**
   - gts-save-flow：审核 → BDD → 编译 → 规格 → 笔记 → 记忆 → 项目提交 → GitHub 两段同步
   - gts-save-memory：daily log + commit / 笔记 + commit，不 push
   - gts-submit-save：git commit + 记忆保存，不 push
8. **Daily Log 格式**
   - 日期 + 分类标题 + 结果（✅/❌）+ 根因 + 修复文件列表 + 优化入库 + 待继续

---

### P28 — Agent Brief 与 OpenCode 调度规范

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **Brief 标准模板**
   ```
   ## 修复
   - 现象（体验式反馈）：
   - 根因分析：
   - 验收标准：
   
   ## 格式要求
   - 改 .ts 再 tsc，不改 .js
   - 新增集成测试覆盖，禁 mock
   - 引用 agent-context.md 不逐条贴
   ```
2. **体验式反馈 VS 技术 spec**
   - "太矮了""抖了""过不去" → AI 能理解
   - 比"把 y 轴 +0.5"更高效——AI 自己判断怎么做
3. **引用规范**
   - agent-context.md 只引用路径，不逐条复制
   - 代码审核 brief 必须贴完整 🐛🔴🟡🟢 规则
4. **OpenCode 三角色调度**
   - OpenClaw（调度层）：免费 Flash Free → 接收、调度、验证、提交
   - OpenCode Flash：付费 Flash → 常规功能、普通 bug、重构
   - OpenCode Pro：付费 Pro → 架构、方案、顽固 bug、审核
5. **调度纪律**
   - 出方案后必须等兄弟确认才能开工
   - "要记住""好的"不等于同意
   - 兄弟指令完整传达（审核报告每条建议都必须写进 fix brief）

---

### P29 — 部署与服务管理

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **deploy-scf.js 设计**
   - 纯 Node.js、零 npm 依赖
   - AI 编写，一句话触发部署
   - 打包 → zip → 上传 SCF → 发布 → BDD 验证
2. **环境管理**
   - production + test 双环境
   - URL 参数控制：`?isDebug=true`
   - 双环境独立配置（内存、超时、并发数）
3. **SCF 实例架构**
   - room1 + room2 双实例并发
   - 各支持 2 人，共 4 人
   - 各自独立 warm container，互不影响
4. **SCF 配置速查**
   - 运行时：Node.js 18
   - 内存：512MB（room-service）/ 256MB（match-service）
   - 自定义静态并发：10
   - 超时：15 分钟无请求 warm container 回收
   - zip 结构：`svc/` + `node_modules/` + `scf_bootstrap` + `package.json`
5. **scf_bootstrap 修复全记录**
   - 权限问题（Windows Compress-Archive 不保留 +x）
   - 路径问题（../../../ 跑飞）
   - ESM 兼容问题
6. **BDD 测试锁定**
   - 7 场景覆盖部署质量
   - 部署前自动运行
7. **生产运维全流程**
   - **部署**：AI 开发 → AI 验收 → AI 部署 → E2E 验证（全程自动化）
   - **监控**：gts-logs 实时拉日志，按时间/实例/级别过滤
   - **告警**：SCF 自带实例崩溃恢复 + 自定义冷启动超时告警
   - **热修复**：发现问题 → AI 改代码 → 秒级部署，不进控制台
   - **版本管理**：deploy-scf.js 支持版本号标注，可回退到任意历史版本
8. **服务端口**
   - room-service：4003（WebSocket）
   - match-service：3000（HTTP）
   - webpack-dev-server：8093
9. **启动顺序**
   - 先 room-service，再 match-service
   - 重启 room 后必须重启 match（room 重启断开 match 的 WS 连接）
   - 重启脚本：gts-service skill 一键重启双服务
10. **调试 VS 生产**
    - Tick 30fps（调试）/ 10fps（生产）
    - 心跳 200s（调试）/ 2s（生产）
    - 日志级别 verbose（调试）/ info（生产）
11. **日志抓取**
    - gts-logs：自动抓取 SCF 日志
    - 微信/飞书通知

---

### P30 — OpenClaw 工具链全景

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **Skill Workshop 系统**
   - create / update / revise / list / inspect / apply / reject / quarantine
   - SKILL.md + PROPOSAL.md 结构
   - 如何让 AI 自己写 skill
2. **16 个 skill 全家桶**
   - **核心调度**：gts-dev-workflow（feat:/fix:/refactor: 触发 OpenCode）
   - **开发**：gts-dev-feat / gts-dev-fix / gts-dev-refactor
   - **验收**：gts-acceptance（BDD RED→GREEN 全自动）
   - **E2E**：gts-e2e-test / gts-e2e-auto / gts-e2e-perf
   - **运维**：gts-service（启动/重启/停止） / gts-deploy（部署 SCF） / gts-logs（日志）
   - **Git**：gts-git-commit / gts-git-pull
   - **记忆**：gts-save-flow / gts-save-memory / gts-submit-save
   - **其他**：gts-recall / gts-stop / gts-analysis / gts-code-review / gts-conversation-end
3. **通知通道**
   - `msg *`（桌面通知）——最高优先级
   - 飞书（新 bot + 旧 bot）
   - clickclaw（浏览器）
   - 微信通知
4. **cron 配置**
   - 正确用法：`payload.kind="agentTurn"` + `sessionTarget="current"` + `delivery.mode="announce"`
   - 不能用 `payload.kind="systemEvent"`（不会投递到聊天窗口）
5. **进程管理纪律**
   - dispatch → 立即连续 poll（不等用户消息、不等 completion event）
   - <20 分钟连续 poll，>20 分钟设 cron 30s 唤起继续 poll
   - 禁止 yield 等用户消息来触发下一轮
   - 任务完成 → 拉完整日志 process(action=log)
6. **入口检查协议（最高优先级）**
   - 每条消息第一件事：`process(action=list)`
   - 有已完成的后台任务 → 先汇报结果再处理当前消息
7. **浏览器管理**
   - Playwright Chromium 与用户 Chrome 共存
   - 杀进程要精确匹配：`Get-Process | Where-Object { $_.ProcessName -eq 'chrome' -and $_.CommandLine -match 'playwright' }`
8. **代码审核流水线**
   - gts-code-review → 调度 OpenCode Pro 审查
   - brief 贴完整 🐛🔴🟡🟢 规则
   - .last-review 跟踪审核状态
   - 审核结果 → fix brief 完整传达给 AI

---

### P31 — 前端性能优化（含 AI 素材管线）

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **帧管理**
   - rAF 主循环 + mpFrameSkip 隔帧多人更新
   - 多人逻辑 15fps vs 渲染 60fps
   - `state.multiplayer` 统一管理多人帧率
2. **deltaTime 系统**
   - 固定时间步长 + 渲染帧率独立
   - 避免 AI 擅自修改 rAF 回调加入繁重计算
   - 🕳️ **过早优化陷阱**：AI 喜欢在渲染循环里加大量计算
3. **SoA 状态管理**
   - TransformStore（位置/旋转/缩放）
   - VisualStore（颜色/可见性/动画状态）
   - RenderFrameData（每帧渲染用数据）
   - **设计目标：WebGPU + 多线程就绪**
     - TransformStore Float32Array → 直接映射 GPU StorageBuffer
     - VisualStore Uint8Array 位字段 → 低频同步
     - 固定 stride（64 字节实体槽）→ 一键切换 SharedArrayBuffer
     - IRenderer.syncFromEntityStore() 批量同步，Worker 可用
   - 改善 cache locality，减少 GC 压力
4. **插值优化**
   - 线性插值替代 Tween 缓动（减少对象创建）
   - interpolationDelayMs=100ms 的权衡
   - 双缓冲区交替读写
5. **双轨动画管理**
   - MMD 动画状态机（Idle → Walk 的 VMD 切换）
   - FBX 动画状态机（Idle → Running 的 clip 切换）
   - 每类模型独立管理，互不干扰
6. **Three.js 优化**
   - 几何体共享（BoxGeometry 只 new 一次）
   - 材质池
   - BufferAttribute 复用
   - 去掉 meta3d 引擎（20.6MB → 7.95MB）
7. **MMD + FBX 加载管线**
   - FBXLoader 加载 little man（little-man.fbx + 贴图）
   - MMDLoader 加载 giantess（giantess.pmx + VMD 动画）
   - 实际踩坑：MMDLoader 兼容性、FBX 贴图路径编码、模型缩放和位置
8. **AI 生成 3D 资源实操**
   - Tripo3D / CSM.ai 评估
   - Suno / ElevenLabs 音效评估
   - 当前限制：MMD 物理模拟在服务端无法跑、模型文件太大上传慢

---

### P32 — 通信可靠性与错误处理模式

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **WS 断连处理**
   - beforeunload-disconnect 替代 sendExit
   - WS 断开自动退出房间
   - 代次守卫防重连残留（warm container 兼容）
2. **重连恢复**
   - 客户端断线重连状态恢复
   - 服务端保留玩家状态（不断清）
   - 返回游戏流程
3. **超时管理**
   - 心跳间隔：调试 200s / 生产 2s
   - 心跳超时判离
   - Game 倒计时（所有玩家到齐 → 5s 后自动进入）
   - countdownGeneration 乐观锁
   - 🕳️ **Object.keys(Immutable.Map()) 永远为真**：Map 内部 5 个属性被误判为有数据
4. **竞态条件**
   - Promise 时序问题
   - 多命令去重（setTimeout + clearTimeout）
   - E2E 测试中 WS 稳定性
   - 🕳️ **Socket hang up 误判**：process(poll, timeout=30000) 等输出不等同卡住
5. **防御式编程**
   - 参数必传、尽早 throw
   - 减少可选参数，用必传 + 默认值工厂
   - 契约检查（requireCheck + test + assertTrue/assertGt）
6. **常见故障模式**
   - 🕳️ E2E 前不重启 → WS 断连卡"查找房间中"
   - 🕳️ HMR 断 WS → webpack 热更新导致退房
   - 🕳️ warm container 定时器残留
   - 🕳️ 状态重置遗漏（gameStop 未重置 flag）

---

### P33 — 教训、反模式与设计模式

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **选型类坑**
   - 帧同步很美但状态同步更适合 AI 协作
   - Immutable.js 太重 → 自建 HashMap → Js.Dict → SoA Store
   - Module._load hook 太复杂 → 直接注入 node_modules
2. **部署类坑（6 连环）**
   - undici@7 File is not defined（SCF Node 18 vs undici 需 Node 20）
   - zip 目录深度（扁平 zip 路径跑飞）
   - scf_bootstrap 权限（Windows zip 不保留 +x）
   - ESM vs CJS（@rescript/runtime 的 type:module）
3. **AI 协作类坑**
   - **偷换方案**：发现方案有问题不告诉你，悄悄换
   - **拍脑袋修 bug**：不结合日志定位，永远修不对
   - **提前抽象**：一个场景搞出接口/工厂/策略模式全套
   - **重复造轮**：不知道已有工具函数，自己重新实现
   - **风格不一致**：同一项目多种风格混搭
   - **范围爆炸**：一个简单需求顺手改十个不相关文件
4. **测试类坑**
   - 集成测试 mock 假代码：看起来测了但没测到实际路径
   - E2E 前不重启：WS 断连卡死
   - HMR 断 WS：测试期间 webpack 热更新退房
5. **工具类坑**
   - Tool loop 不 yield：118 轮 call → context overflow 炸 session
   - Socket hang up 误判：等输出不等同卡住
   - Object.keys(Immutable.Map()) 永远为真
   - 状态重置遗漏：gameStop 未重置 flag
6. **13 个可复用设计模式**
   - **服务端权威 + 绝对状态**：最简多人同步方案
   - **开闭原则**：AI 协作的第一架构约束
   - **纯函数共享层**：ReScript + bundle，两端行为一致
   - **渐进式碰撞精度**：AABB → OBB → 凸包，每步只解决当前痛点
   - **代次守卫**：generation++ / countdownGeneration 乐观锁
   - **SoA 状态管理**：TransformStore/VisualStore，**WebGPU/多线程就绪的纯数据架构**
   - **事件驱动**：新行为 = 新 handler，不改现有逻辑
   - **防御式编程**：参数必传、尽早 throw
   - **Test-as-documentation**：BDD + Specs = 活的文档
   - **隔离层设计**：business_layer/multiplayer/ 安全沙箱
   - **先跑通再工程化**：basic1 → new_basic2 → monorepo
   - **先状态同步再优化**：不做 rollback、不做增量、不做预测
   - **Skill 化流程**：可执行的流程化知识

---

## 总结

### P34 — 给下一个 Vibe Coder 的起步指南

**字数：** 500-5000（代码不计入）

**内容清单：**
1. **最佳起步路径**
   - Step 1：先跑通 Demo（1 个 HTML + 1 个 server.js）
   - Step 2：再加同步（状态同步，不要帧同步）
   - Step 3：再工程化（monorepo、TSRPC）
   - Step 4：再部署上线
2. **技术栈推荐**
   - Three.js + WebSocket = Vibe Jam 验证过的标准答案
   - 状态同步 + 绝对状态 = 最简单的可靠方案
   - 不要微服务、不要 Docker、不要消息队列
3. **工具链推荐**
   - OpenClaw → 调度大脑
   - OpenCode → 写代码的手
   - DeepSeek V4 Flash / Pro → 模型选择
4. **心态转变：从 builder 到 conductor**
   - 你不再写代码，你定义 Specs、验收、总结
   - 剩下的 AI 做
   - 问题在于"定义正确的事"，而不是"高效做错的事"
5. **从 P1-P4 外部视角到 P5-P34 内部实战的呼应**
   - Pieter Levels 的 3 天（P1）
   - Vibe Jam 的行业验证（P2）
   - AI 方法论（P3）
   - 能做/不能做的边界（P4 + P33）
6. **一句话总结**
   > 先把 demo 跑通，再想架构；先用状态同步，再想优化；先定义 Specs，再让 AI 干活。

---

## 系列统计

| 板块 | 篇数 | 每篇字数（代码不计） |
|------|------|---------------------|
| P0 目录 | 1 | 500-1000 |
| P1-P4 已发布 | 4 | 已存在 |
| P5 总览 | 1 | 500-5000 |
| 时间线 P6-P14 | 9 | 500-5000 |
| P15 WebGPU/多线程调研 | 1 | 500-5000 |
| 工作流 P16-P20 | 5 | 500-5000 |
| 知识管理 P21-P33 | 13 | 500-5000 |
| 总结 P34 | 1 | 500-5000 |
| **合计** | **35** | |

全部文章字数控制在 500-5000 字范围内（代码不计入字数限制）。每篇见本大纲即可直接开写。

