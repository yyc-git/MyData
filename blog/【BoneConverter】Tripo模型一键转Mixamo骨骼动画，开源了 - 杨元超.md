# 【BoneConverter】Tripo模型一键转Mixamo骨骼动画，开源了

> 日期: 2026-08-11
> 源: https://github.com/yyc-git/BoneConverter

# 项目介绍

[BoneConverter](https://github.com/yyc-git/BoneConverter) 是一个运行时骨骼名转换工具：将 **Tripo AI 生成的 FBX 模型**（自带骨骼绑定）的骨骼名转换为 **Mixamo 命名体系**，使模型无需重新手动绑骨，即可直接播放 Mixamo 动画。

协议为 **MIT**，完全开源，可自由商用。

[开源代码仓库：Github](https://github.com/yyc-git/BoneConverter)

# 背景：为什么需要这个工具

在 3D 游戏开发中，我们经常使用 AI 生成模型（如 Tripo AI 生成的角色模型），再配合 Mixamo 的现成动画库让角色动起来。但这里有一个痛点：

**Mixamo 的动画绑定的是 Mixamo 官方骨骼命名体系（mixamorig\* 前缀），而 AI 生成的模型自带一套完全不同的骨骼命名。**

## 两个生态的碰撞

先简单介绍一下两个生态：

- **Tripo AI**：目前主流的 AI 文生图/图生 3D 工具，输入文字或图片即可生成带骨骼绑定的 3D 模型，几秒钟出结果，非常适合快速产出角色原型。但它的骨骼是自家命名的，与动画生态不互通。链接：[Tripo AI 官网](https://studio.tripo3d.com/)
- **Mixamo**：Adobe 旗下的动画库，提供海量现成角色动画（走路、跑步、攻击、舞蹈等），可以免费下载，是独立开发者做角色动画的首选资源。但它的动画绑定在官方骨骼命名体系上。链接：[Mixamo 官网](https://www.mixamo.com/#/)

两者的结合点是显而易见的：**AI 生成模型的外观 + Mixamo 的现成动画库 = 快速产出可动角色**。但结合点上的骨骼命名差异，成了最大的拦路虎。

要让 AI 模型播放 Mixamo 动画，传统做法是：

1. 去 Mixamo 官网手动上传模型、标记关节、重新绑骨
2. 绑骨成功后下载带 Mixamo 骨骼的模型
3. 再导入引擎播放动画

这个流程在**长头发女性等复杂模型**上经常绑定失败——头发、裙子、飘带等部位关节标记困难，手动绑骨不仅费时费力，还经常半途而废。我们团队在这个问题上吃够了苦头：尝试过各种手动绑骨方案，最终确定「不做物理绑骨，做运行时骨骼名转换」才是正解。

有了 BoneConverter 之后，做法变成了：

1. 在 [Tripo AI](https://studio.tripo3d.com/) 生成模型，并绑定骨骼；然后导出 FBX 模型（选择Mixamo），得到zip 压缩包
2. 用 BoneConverter 一键转换骨骼名（一个 API 调用，无需手动绑骨）
3. 加载 Mixamo 动画，直接播放（骨骼名已匹配）

全程**零手动绑骨、全自动**，从生成模型到播放动画只需要几分钟。

BoneConverter 的思路完全不同：**不做物理绑骨，而是在运行时把模型自带的骨骼名转换成 Mixamo 命名体系**。骨骼还是原来的骨骼，但名字变成了 Mixamo 认识的"语言"，Mixamo 动画轨道（`mixamorigHips.position`、`mixamorigLeftArm.quaternion` 等）就能直接对号入座。

# 技术方案

## 转换管线

BoneConverter 的完整转换链路如下：

```
Tripo zip (FBX + 纹理)
  → unzipTripoZip        解压，定位 FBX 与贴图
  → loadFbx              THREE.FBXLoader 解析
  → convertTripoToMixamo 核心转换：
      ① restructureHierarchy  层级重构（删除 Root，合并 Pelvis）
      ② renameBones           骨骼名 → Mixamo 命名（mixamorig*）
      ③ fixSkinningIndices    修复指向已删骨骼的 skinIndex
      ④ alignRestPose         基于官方骨架对齐 rest pose
      ⑤ rebindJointVerts      重绑关节顶点
      ⑥ reposeModelBind       模型 bind 姿态重定位
  → exportFbx            导出 ASCII FBX + 纹理 base64 内嵌
  → Mixamo-ready FBX
```

核心是 **convertTripoToMixamo** 的六步转换：

1. **层级重构**：Tripo 模型通常有一个多余的 Root 节点，先删除并合并到 Pelvis，保证骨骼层级与 Mixamo 一致
2. **骨骼重命名**：通过映射表（`BoneMapping.ts`）把 Tripo 骨骼名逐一映射为 `mixamorig*` 命名
3. **修复蒙皮索引**：重命名/删骨后，部分顶点的 skinIndex 可能指向已删除的骨骼，需要修复，否则顶点会"飞走"
4. **rest pose 对齐**：基于内置的官方 Mixamo 骨架（lod2），把模型骨骼的静止姿态对齐到 Mixamo 参考系——**这一步至关重要，动画播放不扭曲的关键**
5. **重绑关节顶点**：让顶点正确跟随新骨骼
6. **模型 bind 姿态重定位**：保证蒙皮公式参考系一致

## rest pose 对齐：动画不扭曲的关键

很多人会问：只是改个骨骼名，动画就能正常播放吗？

答案是：**光改名不够，还要对齐静止姿态**。Mixamo 动画是在 Mixamo 官方骨骼的静止姿态（rest pose）下烘焙的。如果模型骨骼的静止姿态与官方不一致（比如手臂角度、骨盆倾斜度不同），动画播放时就会出现扭曲、穿模、关节错位。

BoneConverter 内置了 Mixamo 官方骨架（lod2），转换时会把模型骨骼的 rest pose 对齐到官方参考系，保证：

- 骨骼静止姿态与 Mixamo 动画的参考系一致
- 动画播放不扭曲、不穿模
- 前臂、手指等容易出问题的部位也正常

这个对齐逻辑是经过真机实测打磨的：最初尝试移除官方骨骼对齐帧（用自洽路径），结果动画完全扭曲；恢复官方帧后，动画恢复正常。**官方骨架帧同时承担绑定与动画重定向的双重角色，不能简单移除。**

# 特性

- **一键转换**：输入 Tripo 模型的 zip 压缩包，输出可直接使用的 Mixamo 骨骼 FBX
- **完整管线**：解压 zip → 加载 FBX → 骨骼转换 → 纹理内嵌 → 导出 ASCII FBX，全链路自动完成
- **rest pose 对齐**：基于 Mixamo 官方骨架对齐骨骼静止姿态，动画播放不扭曲
- **纹理内嵌**：材质纹理以 base64 内嵌进 FBX，单文件交付，无需外部资源
- **零手动绑骨**：不需要 Mixamo 网页端手动标记关节
- **MIT 协议**：完全开源，可自由商用
- **开箱即用 Demo**：浏览器上传 zip 即可看到转换效果

# 使用方式

## 核心 API

```ts
import { processTripoZip } from 'bone-converter';

// 读取 Tripo 模型压缩包（zip 内包含 .fbx + 纹理贴图）
const zipBytes = await file.arrayBuffer();

const result = await processTripoZip(zipBytes);

// result.fbxData: ArrayBuffer —— 转换后的 FBX（Mixamo 骨骼 + 内嵌纹理）
```

API 极简：**一个函数搞定全链路**。传入 Tripo 模型 zip，返回转换后的 FBX（ArrayBuffer），可直接保存为 .fbx 文件，或直接用 THREE.FBXLoader 加载进场景。

## 完整示例（浏览器）

```ts
import { processTripoZip } from 'bone-converter';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const input = document.getElementById('file') as HTMLInputElement;
input.addEventListener('change', async () => {
  const file = input.files?.[0];
  if (!file) return;

  const result = await processTripoZip(await file.arrayBuffer());

  // 方式 1：保存为 FBX 文件
  const blob = new Blob([result.fbxData], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${result.fbxName}_mixamo.fbx`;
  a.click();

  // 方式 2：直接加载进 Three.js 场景播放 Mixamo 动画
  const loader = new FBXLoader();
  const model = loader.parse(result.fbxData, '');
  scene.add(model);

  // 加载任意 Mixamo 动画并播放（骨骼名已匹配，无需手动绑定）
  loader.load('/animations/Idle.fbx', (animObj) => {
    const mixer = new THREE.AnimationMixer(model);
    const clip = animObj.animations[0];
    mixer.clipAction(clip).play();
  });
});
```

## 运行 Demo

```bash
git clone git@github.com:yyc-git/BoneConverter.git
cd BoneConverter
yarn install
yarn webpack:dev-server   # 默认 http://localhost:8095
```

Demo 功能：
1. 上传 Tripo zip → 自动完成全链路转换并显示模型
2. 加载 Mixamo 动画 → 显示动画轨道列表 + 轨道匹配率
3. 播放 / 停止 → AnimationMixer 播放 / 停止

# 与其他方案对比

| 方案 | 手动绑骨（Mixamo 官网） | 插件绑骨（Blender 等） | BoneConverter |
|------|------------------------|----------------------|---------------|
| 操作成本 | 高：上传→标关节→调权重 | 高：需装插件、学习绑骨 | **低：一个 API 调用** |
| 复杂模型（长发/裙摆） | 经常失败 | 需要经验 | **成功率高** |
| 批量处理 | 不支持 | 有限 | **支持（纯代码）** |
| 运行时/构建时 | 构建时 | 构建时 | **运行时/构建时均可** |
| 依赖人工 | 高 | 中 | **零人工** |

BoneConverter 最大的优势是**纯代码、可批量、可集成**：它不依赖任何 GUI 工具，可以在服务器上批量转换，也可以直接集成进游戏构建管线，甚至可以在运行时动态转换用户上传的模型。

# 质量保障

- **BDD 测试**：8 suites / 69 tests 全绿（jest-cucumber），覆盖骨骼映射、层级重构、蒙皮修复、rest pose 对齐、zip 管线全流程
- **E2E 测试**：真实浏览器（Playwright）端到端验证：上传 zip → 转换 → 动画匹配率 1.000 → 播放推进 → 视觉校验全通过
- **类型检查**：tsc 0 errors

# 踩过的坑（经验分享）

开发过程中踩了几个典型的坑，分享出来供大家参考：

1. **动画扭曲不一定是骨骼名的问题**：曾经遇到模型变小 + 动画扭曲 + 前臂消失的严重回归，一度误诊为骨骼对齐逻辑问题。最后通过 diff 定位，真凶是 demo 层对模型做了整体缩放（root.scale），破坏了蒙皮绑定的参考系。**对蒙皮模型做整体缩放 = 绑定参考系破坏，顶点会错位**。正确做法是只调整相机适配模型大小，不改模型本身。

2. **静态绑定贴合 ≠ 动画播放正确**：有段时间用"bind 贴合度"（骨骼绑定姿态与几何的偏差）作为质量指标，指标全绿但动画实际是扭曲的。**静态 bind 贴合度与动画播放正确性是两回事**，官方骨骼帧同时承担绑定与动画重定向双重角色，验证必须以真实动画播放为准。

3. **诊断脚本的结论必须与真机实测交叉验证**：脚本说"骨骼绑定错位 30 度"，但浏览器里实测完全正常——诊断参考系本身可能有问题。**实测为准**。

# 未来计划

- 支持更多 AI 建模工具生成的模型（如 Meshy、Rodin 等）的骨骼体系
- 提供 npm 包发布，开箱即用（目前可直接用源码引用）
- 更多 Mixamo 动画兼容性验证与骨骼映射完善

# 总结

如果你也在用 AI 生成模型 + Mixamo 动画做 3D 游戏，被手动绑骨折磨过，BoneConverter 就是为你准备的。MIT 协议，完全开源，欢迎 Star、Fork、提 Issue、贡献代码。

[开源代码仓库：Github](https://github.com/yyc-git/BoneConverter)

---

**相关链接：**
- [BoneConverter 仓库](https://github.com/yyc-git/BoneConverter)
- [GTS-Play（本工具所属游戏项目）](https://www.gts-play.cn/)
