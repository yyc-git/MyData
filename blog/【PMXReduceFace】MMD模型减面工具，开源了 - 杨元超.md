# 【PMXReduceFace】MMD 模型减面工具，开源了

> 日期: 2026-08-14
> 源: https://github.com/yyc-git/PMXReduceFace

# 项目介绍

[PMXReduceFace](https://github.com/yyc-git/PMXReduceFace) 是一个 MMD PMX 模型减面工具：基于 **QEM（二次误差度量）约束边折叠**，在保留 morph 表情、UV 接缝与小材质细节的前提下，把高模 PMX 削减到目标面数。减面后的 PMX 可直接在 MMD 中使用，配合预生成的 LOD 档位可在游戏/渲染中按距离切换。

协议为 **MIT**，完全开源，可自由商用。

[开源代码仓库：Github](https://github.com/yyc-git/PMXReduceFace)

# 背景：为什么需要这个工具

MMD 模型（PMX 格式）常常携带非常高的面数——一个精心制作的模型动辄 5-10 万三角形，直接压面数会带来三个「老大难」问题：

## 问题的本质

**1. 表情 morph 会被破坏**

MMD 的表情（口型、眨眼、微笑）是通过顶点位移实现的，一个 morph 会引用成百上千个顶点。如果减面时把这些顶点删了，表情就废了。所以减面必须先搞清楚「哪些顶点不能动」。

**2. UV 接缝会撕裂**

模型的 UV 接缝处通常是「空间重合但 UV 不同」的两组顶点，减面合并时如果不区分，贴图直接撕裂，衣服、头发上的花纹全错位。

**3. 小材质细节会消失**

眼睛、睫毛、饰品这些细节材质往往只有几百个面，在全局减面里最先被牺牲掉——但恰恰是这些细节决定了一个模型「像不像」。

**还有一个常常被忽略的问题：减面不是「删面」那么简单，删完还要保证质量。**

QEM 是业界最经典的网格简化算法，它的核心是「二次误差度量」——每次折叠代价最低的边。但 QEM 有个致命盲区：**它只优化「点到平面的距离」，对形状质量完全无感**。细长条三角形（sliver）面积≈0 会被当成「零损失」免费折叠，结果头部、手指冒出长条；球面上的小三角形几乎共面，会被「免费」合并成跨曲面大平面，结果裙摆、袜子出现视觉破面。

PMXReduceFace 的思路：**在 QEM 之上叠加一套完整的质量守卫体系**，边折叠前逐项校验形状、拓扑、法线、突起、尺寸，把「会破坏视觉质量」的折叠全部拒绝掉；折叠后还有兜底检测，发现洞就补上。

```
PMX 高模
  → 锁定集（morph 顶点 + UV 接缝 + 小材质 100% 保留）
  → QEM 约束边折叠（sliver / 拓扑 / 翻转 / 突起 / 尺寸守卫）
  → 折叠后补洞（新增闭合环检测 + 耳切法三角化）
  → 字节级重写输出（morph/骨/刚体等未减面段原样保留）
```

# 技术方案

## 减面管线

```
loadPmx（three mmdparser 解析）
  → triangulateFaces
  → buildLockedSet（morph 引用 + UV 接缝聚类 + 材质级锁定 → 锁定顶点集）
  → collapseMesh（QEM 边折叠 + 材质保护）
      ① 每边折叠代价 = Q（二次误差度量，纯线性代数零依赖）
      ② 每次从堆顶取最低代价边，折叠前守卫
      ③ 每材质按 min-retention 动态保护 + 小材质全锁
      ④ 折叠完只重算 touchedV 顶点法线（其余保留输入法线）
  → 折叠后补洞（findHoleChains + triangulatePolygon + patchHoles）
  → buildDecimatedPmx（字节级重写：顶点/面/材质 faceCount 就地 patch）
```

## 质量守卫体系（十轮迭代沉淀）

| 守卫 | 解决的问题 | 核心机制 |
|------|-----------|---------|
| **sliver 防护** | 细长条三角形（头部/手指/袜子冒长条） | aspect ≥ 10 且最长边 ≥ 0.5 → 拒绝 |
| **拓扑守卫** | 非流形边 / 洞（薄壳露洞） | link condition（Hoppe 1996）+ 洞检测 |
| **fold-over 翻转** | 折叠翻转（细长圆柱冒出多余面片） | 模拟新法线与相邻法线夹角突变检测 |
| **突起守卫** | 指尖近共面微三角被合并成跨曲面大平面（尖刺/圆锥体） | 顶点到 1-ring 邻接面最大距离 + 局部预算 |
| **大鼓包防护** | 大 + 鼓 = 圆锥体 | 突起超阈值 且 面积超局部预算 → 拒绝 |
| **曲率感知尺寸守卫** | 球面小三角被「免费」合并成跨曲面大平面（屁股破面） | 局部输入尺寸预算 p95 + 曲率门控（平坦区不误杀） |
| **折叠后补洞** | 折叠引入的真洞（网格缺失、能看到背景） | 新增闭合环检测 + 耳切法三角化补面 |

## 十轮迭代：从「能减面」到「视觉无损」

项目经历了十轮迭代，每一轮都是真实模型实测 + Kimi 视觉验证驱动：

1. **基础版**：QEM 约束边折叠 + morph/接缝/材质保护
2. **sliver 防护**：消灭长条三角形（阈值从 aspect≥20 逐步收紧到 10/0.5）
3. **拓扑守卫**：link condition + 洞检测，堵住薄壳露洞
4. **突起守卫**：拒绝顶点戳出邻接面的折叠，指尖不再冒尖刺
5. **洞守卫收窄**：removesSlit 豁免只保留共点边分离，堵住 30 个真洞盲区
6. **曲率感知尺寸守卫**：球面不再跨曲面合并大平面（质量地板 27110→39949）
7. **指尖尖刺消除**：断言从「只比数量」升级为「覆盖位置」（距输入突起质心距离），内外带尖刺全消
8. **法线保留**：`recomputeNormals` 只重算参与折叠的顶点（touchedV），修复分层拼块模型接缝法线破坏（Tda 肩窝 108 翻转点 → 0）
9. **通用质量断言**：verify 全局检查解耦 BurumaSet 材质绑定，任何模型无条件执行（此前无 BurumaSet 的模型质量断言全跳过 → 洞漏检）
10. **折叠后补洞**：检测新增闭合边界环并耳切法补面（Tda 补 4 洞、XiaoMei 补 3 洞无回归）

# 特性

- **QEM 约束边折叠**：二次误差度量（纯数学零依赖），每次折叠代价最低边
- **保留 morph**：morph 引用顶点全进锁定集，折叠后索引自动重映射，表情不破坏
- **保留 UV 接缝**：空间重合顶点聚类锁定，贴图不撕裂
- **小材质自动保护**：面数 ≤500 的材质（眼睛、睫毛）100% 保留
- **十重质量守卫**：sliver / 拓扑 / 翻转 / 突起 / 大鼓包 / 尺寸 / 补洞，视觉无损
- **折叠后补洞**：新增闭合环检测 + 耳切法三角化补面
- **字节级重写**：morph/骨/刚体等未减面段原样保留，零风险
- **内置验证**：verify.mjs 全量断言 + real-model-check 真实模型质量断言
- **双目标控制**：`--target-ratio`（比例）与 `--target-tri`（绝对面数）任选
- **BDD 34 场景**：合成 fixture（纯字节生成 PMX），不依赖真实模型
- **MIT 协议**：完全开源，可自由商用

# 使用方式

## 快速开始

```bash
git clone git@github.com:yyc-git/PMXReduceFace.git
cd PMXReduceFace
yarn install
yarn test:bdd        # BDD 34 场景全绿
npx tsc --noEmit     # 类型检查
```

## 核心 CLI

```bash
# 按比例减半面数
node src/tool/pmx-face-reduce/reduce.mjs --input in.pmx --output out.pmx --target-ratio 0.5

# 完整参数
node src/tool/pmx-face-reduce/reduce.mjs \
  --input in.pmx --output out.pmx \
  --target-ratio 0.5 \
  [--target-tri 35000] \
  [--lock-morph true] \
  [--lock-seams true] \
  [--lock-materials "0,1"] \
  [--min-retention 0.3] \
  [--lock-small-materials true]

# 验证（断言全绿退出码 0）
node src/tool/pmx-face-reduce/verify.mjs in.pmx out.pmx --target-ratio 0.5

# 真实模型集成检查（reduce + verify + 视觉质量断言）
node scripts/real-model-check.mjs --input your.pmx --target-ratio 0.55
```

## 核心 API

```js
import { reduceFaces } from 'pmx-reduce-face/src/tool/pmx-face-reduce/reduce.mjs';
import { verifyFaces } from 'pmx-reduce-face/src/tool/pmx-face-reduce/verify.mjs';
import { collapseMesh } from 'pmx-reduce-face/src/tool/pmx-face-reduce/qem.mjs';
import { buildLockedSet } from 'pmx-reduce-face/src/tool/pmx-face-reduce/lock-set.mjs';

const result = reduceFaces({ input: 'in.pmx', output: 'out.pmx', targetRatio: 0.5 });
// result.newTriangles / result.reductionRatio / result.reductionMet / result.perMaterial
```

## 可视化 Demo

```bash
yarn demo:prepare        # 预生成 4 档 LOD + stats.json
yarn webpack:dev-server  # 启动 → http://localhost:8096
```

浏览器打开 `http://localhost:8096`：加载原版 PMX + 预生成 LOD，OrbitControls 旋转/缩放，HUD 实时显示各 LOD 的顶点/三角形/材质/减面率，按钮一键切换对比。

# 质量保障

- **BDD 34 场景全绿**（jest-cucumber）：合成 fixture（纯字节生成 PMX），覆盖 morph 锁定 / 接缝 / 材质保护 / 各守卫 / 补洞 / 回归
- **真实模型质量断言**（`real-model-check.mjs`）：BurumaSet 面积 p99 ≤ 输入×1.5 / 指尖突起数量与面积 ≤ 输入 / 全局跨曲面新增超尺寸 = 0 / 非流形边 = 0 / noNewHoles（闭环检测）
- **十轮视觉验证**：每轮 Kimi K2.7 多模态视觉实测 LOD50 对比，几何绿 ≠ 视觉 OK 的教训反复验证
- **类型检查**：tsc 0 errors

# 踩过的坑（经验分享）

开发过程中踩了几个典型的坑，分享出来供大家参考：

1. **「减面」不是「删面」，质量守卫才是核心**：最初几轮以为 QEM 折叠 + 保护锁定集就够了，结果 Kimi 视觉一测全是问题——长条、圆锥体、破面、洞。**QEM 只优化点到面距离，对视觉质量完全无感，必须叠加形状/拓扑/尺寸守卫**。十轮迭代里有七轮是在补守卫。

2. **断言只比数量不覆盖位置 = 漏检**：指尖尖刺修复时，最初断言「突起面数量 ≤ 输入」通过了，但 Kimi 视觉打回——尖刺还在，只是换了个位置。**断言必须覆盖位置（距输入质心距离判新增），不能只比 count/maxArea**。

3. **几何绿 ≠ 视觉 OK**：法线单位长度断言全绿，但 Tda 肩窝实际有明暗分界线——因为全局重算法线把艺术家校准的分裂法线破坏了（33.6°→85.6°）。**数值正确 ≠ 方向正确，必须视觉验证**。

4. **换模型 = 断言全失效**：verify 的检查区域（指尖坐标）和材质检查（BurumaSet）都硬编码 XiaoMei——换 Tda 礼服（无 BurumaSet、手部位置不同）后质量断言被整体跳过，洞直接漏检。**全局性检查必须与具体模型解耦**。

5. **洞 ≠ 大三角 ≠ 法线异常**：兄弟报告「破面」，我按大三角/法线修了三轮白干——实际他说的是「空洞」（三角形网格缺失、能看到背景）。**动手前先对齐术语，检测脚本和 brief 里必须用用户的术语**。

6. **「洞」要先对比原版再定性**：Tda 两腿间的 V 字洞排查到最后，对比原版发现输入 669 洞环 vs 输出 661——**那个洞原版模型里就有**（礼服结构开口），不是减面引入的。减面工具只补「新增的洞」，原版自带的开放边界是合法的。

# 未来计划

- npm 包发布，开箱即用（目前支持源码引用与 file: 本地依赖）
- 前端实时减面（QEM 浏览器化）：qem.mjs/quadric.mjs 已是纯函数，只需把 Node Buffer 层改写为 Uint8Array/DataView
- 更多 PMX 模型的兼容性验证与参数预设

# 总结

如果你在做 MMD 模型优化，被「减面后表情坏了、贴图裂了、细节没了、破面洞一堆」折磨过；或者你在做游戏/渲染，需要一套能自动产出多档 LOD 的管线——PMXReduceFace 就是为你准备的。MIT 协议，完全开源，一条命令出结果，质量守卫替你守住视觉底线，欢迎 Star、Fork、提 Issue、贡献代码。

[开源代码仓库：Github](https://github.com/yyc-git/PMXReduceFace)

---

**相关链接：**
- [PMXReduceFace 仓库](https://github.com/yyc-git/PMXReduceFace)
- [VMDPhysicsBake（同系列开源工具）](https://github.com/yyc-git/VMDPhysicsBake)
- [BoneConverter（同系列开源工具）](https://github.com/yyc-git/BoneConverter)
