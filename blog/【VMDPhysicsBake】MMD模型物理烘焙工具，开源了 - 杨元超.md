# 【VMDPhysicsBake】MMD 模型物理烘焙工具，开源了

> 日期: 2026-08-12
> 源: https://github.com/yyc-git/VMDPhysicsBake

# 项目介绍

[VMDPhysicsBake](https://github.com/yyc-git/VMDPhysicsBake) 是一个 VMD 物理烘焙工具：将 **PMX 模型 + 动作 VMD** 离线烘焙为**逐帧物理骨 VMD**。它用 Ammo.js（Bullet）完整模拟骨骼物理，把裙摆、头发、胸部等物理骨的每帧姿态直接写入 VMD，在 MMD 中播放时即可复现烘焙时的物理效果，**无需依赖 MMD 内置物理引擎**。

协议为 **MIT**，完全开源，可自由商用。

[开源代码仓库：Github](https://github.com/yyc-git/VMDPhysicsBake)

# 背景：为什么需要这个工具

在 MMD 生态中，模型的裙摆、头发、胸部等部位通常靠物理引擎（Bullet）实时模拟。这里有一个长期存在的痛点：

**MMD 的实时物理依赖观看端的物理引擎，同一个模型在不同播放器里物理效果完全不一样。**

## 问题的本质

用过 MMD 的朋友都有体会：同一个模型，在 A 播放器里裙摆自然下垂，在 B 播放器里裙子乱飞、穿模严重。原因是物理模拟发生在**播放端**，而不同播放器的物理引擎实现、帧率、求解器迭代次数都不同，物理结果天然不一致。

更麻烦的是，很多场景需要**确定性**的物理效果——比如做视频、做演出、做自动化管线时，希望同一份输入永远产出同一份输出。而实时物理是随机的、依赖环境的，做不到。

**还有一个常常被忽略的问题：性能，特别是移动端。**

裙摆、头发这类物理骨是典型的多刚体系统（示例模型 491 个刚体 + 847 个约束），每帧都要做碰撞检测 + 约束求解，计算量非常大。桌面端跑实时物理尚且能承受，但在**移动端**（手机、平板）上，实时物理会严重拖累帧率——本来能跑 60 帧的场景，开了物理直接掉到 30 帧以下，甚至发热卡顿。这也是为什么很多移动端 MMD 应用要么阉割物理（裙子、头发僵直），要么直接不做实时物理。

VMDPhysicsBake 的思路完全不同：**不做实时物理，而是在烘焙阶段就把物理结果「烤」进 VMD**。

```
PMX 模型 + 动作 VMD
  → Ammo.js 离线模拟（与播放器无关）
  → 物理骨每帧姿态写入 VMD
  → 任意 MMD 播放器播放，效果完全一致
```

产物在任何 MMD 播放器中都是**同一份物理动画**——物理效果与播放器彻底解耦，这是实时物理做不到的。

而且烘焙之后，**播放端不再需要跑物理引擎**：物理骨的关键帧已经写死在 VMD 里，播放器只需要读取骨骼关键帧插值播放，**移动端也能流畅运行**。物理计算从「每帧实时求解」变成「离线算一次」，把移动端最贵的运行时开销转移到了开发期——这既是质量一致性方案，也是性能方案。

# 技术方案

## 烘焙管线

VMDPhysicsBake 的完整转换链路如下：

```
PMX + 动作 VMD
  → MMDLoader.load2 加载模型（与 demo 页面完全同构建）
  → MMDAnimationHelper 驱动（warmup 预热 + 逐帧 stepPhysics）
  → 每帧采样全部物理骨（185 骨，与页面完全一致）
  → 抽帧导出（能量法主段 + SKIP_HEAD + 补帧 0/90）
  → vmd-writer 写出（SJIS 编码）
  → 逐帧物理骨 VMD
```

核心流程：

1. **加载模型**：用 MMDLoader.load2 完整构建 mesh（骨骼、刚体、约束全部解析），与 demo 页面走同一条构建链路
2. **驱动物理**：MMDAnimationHelper 统一驱动动画 + 物理，先 warmup 预热（头发预下落），再逐帧推进物理
3. **采样物理骨**：每一帧记录全部物理骨（`physics.bodies` 关联骨）的位移/旋转
4. **抽帧导出**：物理骨按能量法抽稀关键帧（静态段不重复写帧），动作骨逐帧原样保留，morph 表情帧原样复制
5. **写出 VMD**：SJIS 编码写盘，同一输入两次烘焙字节一致

## useLoader 链路：命令行 = 页面，逐字节一致

VMDPhysicsBake 提供两种烘焙方式，产物**逐字节一致**：

| 方式 | 命令 | 特点 |
|------|------|------|
| **页面烘焙** | `node src/tool/bake-view-oneclick.cjs`（或浏览器打开 demo） | 浏览器内实时模拟，可视化观察物理效果 |
| **命令行烘焙** | `yarn bake`（bake-config.json 默认 `useLoader: true`） | 纯命令行，MMDLoader.load2 同构建同驱动同抽帧，适合脚本化 / CI |

> 实测：`yarn bake` 输出与页面 oneclick 产物 **1310324B 逐字节相同，avg=0.000000 / max=0.000000 / n=11788 / miss=0**。

这个「字节级一致」来之不易：命令行烘焙早期用手动构建 mesh 的方式模拟物理，初始姿态与页面一致，但物理 update 每一步都分叉，混沌效应下误差越来越大（avg 卡在 0.12 上不去）。后来改为直接复用 MMDLoader.load2 完整链路，命令行与页面**同构建、同驱动、同采样**，差异直接归零。

## 多档物理参数

`src/tool/bake-config*.json` 提供丰富物理参数档：spring 刚度、solver 迭代次数、阻尼、平衡点、zone rules（分区调参，如胸部/裙子碰撞 mask 分离）。命令行可用 `--config` 指定任意档位，或 `--pmx/--vmd/--output` 直接覆盖输入输出。

# 特性

- **离线烘焙**：PMX + 动作 VMD → 物理骨逐帧 VMD（Ammo.js / Bullet 数值模拟，离线可复现）
- **移动端友好**：物理计算离线完成，播放端无需跑物理引擎，移动端也能流畅播放
- **动作骨原样保留**：非物理骨关键帧（position/rotation/interpolation）逐帧不变
- **morph 原样复制**：表情帧与权重逐条保留
- **确定性输出**：同一输入两次烘焙字节一致（内置 V6 断言）
- **命令行 = 页面**：MMDLoader.load2 同链路，两种烘焙方式产物逐字节一致
- **内置验证**：V1-V6 断言 + verify-report.json，跑完即知产物质量
- **零游戏项目依赖**：纯 Node + npm 依赖（three / ammojs-typed / pako）
- **MIT 协议**：完全开源，可自由商用

# 使用方式

## 快速开始

```bash
git clone git@github.com:yyc-git/VMDPhysicsBake.git
cd VMDPhysicsBake
yarn install
yarn bake        # 产出 output/pickup_bake.vmd（自带 HMS 模型 + pickup.vmd 示例）
yarn verify      # V1-V6 断言 + output/verify-report.json
```

## 核心 CLI

```bash
# 指定配置文件（bake-config*.json，路径相对 src/tool/）
node src/tool/bake-physics.mjs --config bake-config.json

# CLI 覆盖输入输出
node src/tool/bake-physics.mjs --pmx demo/assets/xxx.pmx --vmd demo/assets/anim.vmd --output output/anim_bake.vmd

# 自检模式（不落盘，纯内存校验）
node src/tool/bake-physics.mjs --self-check

# 物理部件统计（刚体/约束数量）
node src/tool/count-physics.mjs "demo/assets/Tda HMS illustrious Prom Dress Ver1.00 [Silver].pmx"
```

## 核心 API

```ts
import { bakePhysics, verifyBake, countPhysics } from 'vmd-physics-bake';

// 烘焙：等价于 `node src/tool/bake-physics.mjs --config bake-config.json`
const result = bakePhysics();   // result.outputPath / result.bytes / result.stdout

// 验证：读取 output/verify-report.json
const report = verifyBake();    // report.allPass / report.assertions

// 统计 PMX 物理部件
const count = countPhysics('path/to/model.pmx');   // count.rigidBodies / count.joints
```

## 可视化 Demo

```bash
node scripts/view-bake-server.cjs   # 静态 server，端口 8123
```

浏览器打开 `http://localhost:8123/demo/index.html`：加载 PMX + VMD，页面内 Ammo.js 实时跑物理，播放完**自动导出 VMD**。URL 参数可控制物理档位：

| 参数 | 默认 | 说明 |
|------|------|------|
| `interval` | 1 | 物理更新间隔（1 = 每渲染帧更新，最高档） |
| `solver` | 10 | solver 迭代次数（最高档） |
| `warmup` | 60 | 物理预热帧数（头发预下落） |
| `speed` | 1 | 加速倍数（fixed 模式下墙钟快 K 倍，物理结果逐位一致） |
| `vmds` | pickup | 多动画逗号分隔，按顺序逐动画烘焙 |

# 与其他方案对比

| 方案 | MMD 内置实时物理 | 手工逐帧调 VMD | VMDPhysicsBake |
|------|-----------------|----------------|---------------|
| 播放器一致性 | ❌ 不同播放器效果不同 | ✅ 固定 | **✅ 固定（逐字节一致）** |
| 工作量 | 零 | 极高：逐帧手调 | **低：一条命令** |
| 确定性/可复现 | ❌ 依赖环境 | ✅ | **✅ 字节级确定** |
| 自动化/批量 | ❌ | ❌ | **✅ 纯代码可批量** |
| 效果观感 | 实时、可交互 | 静态 | **✅ 烘焙后的物理效果** |

VMDPhysicsBake 最大的优势是**确定性 + 可自动化**：同一输入永远产出同一份 VMD，适合视频制作、演出、CI 管线等对结果一致性有硬要求的场景。

# 质量保障

- **BDD 测试**：6 suites 全绿（jest-cucumber），覆盖 163 物理骨 / 78 morph / 91 帧 / solver 迭代等契约
- **内置验证**：verify V1-V6 ALL PASS（动作骨逐帧一致、morph 保留、确定性字节一致、物理骨覆盖）
- **链路一致性**：命令行与页面产物 1310324B 逐字节一致（avg=0.000000）
- **类型检查**：tsc 0 errors

# 踩过的坑（经验分享）

开发过程中踩了几个典型的坑，分享出来供大家参考：

1. **「手动构建 mesh」≠「Loader 构建 mesh」**：命令行烘焙早期自己手动构建骨骼/刚体，初始姿态与页面一致，但物理 update 每一步都分叉，混沌效应下误差不断放大（avg 卡 0.12 无法收敛）。**同样的参数，不同构建链路的物理结果完全不同**——最终放弃手动构建，直接复用 MMDLoader.load2 完整链路，命令行与页面差异直接归零。**能用官方 Loader 就别手写构建。**

2. **采样 JSON 的路径前缀会悄悄破坏物理结果**：bake-from-view 读取采样 JSON 里的 PMX 路径时，若路径带仓库名前缀（`/VMDPhysicsBake/demo/assets/...`），PMX 读取失败 → 类型过滤失效 → 物理骨集合不同 → 产物 motions 数量漂移（11084 ≠ 11788）。**路径解析 bug 不会报错，只会悄悄改变物理骨集合，必须用产物数量做交叉校验。**

3. **物理参数调优救不了链路错误**：曾经花大量时间调 spring 刚度、solver 迭代、阻尼，期望逼近页面效果，结果 avg 从 0.43 只降到 0.41——**参数在错误的链路上调不出正确结果**。真正的解是链路对齐（useLoader），不是参数微调。

4. **物理骨集合必须来自真实关联**：页面采样的骨集合来自 `physics.bodies` 与骨骼的真实关联，而不是硬编码的参考列表——模型换了，集合也跟着变，硬编码必然出错。

# 未来计划

- npm 包发布，开箱即用（目前支持源码引用与 file: 本地依赖）
- 更多 PMX 模型的物理参数预设与兼容性验证
- 更多 MMD 动画格式（vmd 150/160 等）的兼容完善

# 总结

如果你在做 MMD 视频、演出或自动化管线，被「不同播放器物理效果不一致」折磨过；或者你在做移动端 MMD 应用，被实时物理的帧率拖垮过——VMDPhysicsBake 就是为你准备的。MIT 协议，完全开源，命令行一条命令出结果，欢迎 Star、Fork、提 Issue、贡献代码。

[开源代码仓库：Github](https://github.com/yyc-git/VMDPhysicsBake)

---

**相关链接：**
- [VMDPhysicsBake 仓库](https://github.com/yyc-git/VMDPhysicsBake)
- [BoneConverter（同系列开源工具）](https://github.com/yyc-git/BoneConverter)
