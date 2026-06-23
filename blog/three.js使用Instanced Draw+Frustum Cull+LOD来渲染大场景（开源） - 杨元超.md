# three.js使用Instanced Draw+Frustum Cull+LOD来渲染大场景（开源） - 杨元超

> 日期: 2024-04-23 11:40
> 源: https://www.cnblogs.com/chaogex/p/18152526

大家好，本文使用three.js实现了渲染大场景，在移动端也有较好的性能，并给出了代码，分析了关键点，感谢大家~


关键词：three.js、Instanced Draw、大场景、LOD、Frustum Cull、优化、Web3D、WebGL、开源


代码：[Github](https://github.com/yyc-git/DigitalTwin-instanced-lod)


我正在承接Web3D数字孪生项目，具体介绍可看[承接各种Web3D业务](https://www.cnblogs.com/chaogex/p/14090516.html)


加QQ群交流：106047770


目录

- [需求描述](#需求描述)
- [Instanced Draw](#instanced-draw)
- [Frustum Cull](#frustum-cull)
- [LOD](#lod)
- [参考资料](#参考资料)


## 需求描述


数字孪生项目通常需要渲染超大场景，比如智慧城市就需要渲染一片城市区域，甚至整个城市


渲染大场景所需要的技术点包括：


- Instanced Draw

一个Draw Call批量渲染物体，物体可以有不同的Transform、Color

- Frustum Cull

剔除视椎体外的物体

- Occlusion Cull

剔除被遮挡的物体（WebGL1不支持）

- LOD

根据物体到相机的距离，显示不同Level的物体。越远的越粗糙，越近的越细致

- GPU Driven Pipeline

把前几个优化都放到GPU中来做，并且物体可以有更多差异（需要WebGPU）

- Space Partition

使用Octree、BVH、BSP等加速结构来划分场景，在Cull、碰撞检测、Ray Picking等操作时查询加速结构而不是遍历所有物体，从而提高性能

- Multi Thread Render

开一个渲染线程来渲染

- AssetBundle、Stream Load

划分为多个场景包，动态、流式加载


本文使用Instanced Draw+Frustum Cull+LOD来渲染大场景，最终实现效果演示：


![image](https://img2024.cnblogs.com/blog/419321/202404/419321-20240423113644044-1790268787.gif)


场景总三角面数是千万级，总物体数量是1万（PC端）/5000（移动端），动态物体数量是800（PC端）/400（移动端）


其中，树使用了Instanced Draw+LOD，白色立方体使用了Instanced Draw


可以把相机拉进、拉远，可看到不同Level的树


移动相机，可看到红框内的Triangles在变化（大概在几十万到几百万），这是Frustum Cull后的三角面数


在5年前的中配手机上，FPS可达15左右


下面开始实现各个关键点，给出实现的思路：


## Instanced Draw


比如要将克隆的1000个Mesh改为Instanced的，则保留它们作为source，并创建一个InstancedMesh，count设为1000，写入1000个Mesh的世界矩阵；然后隐藏source，显示InstancedMesh

之所以保留source，是因为可以用它们来做碰撞检测、Ray Picking等单个Mesh的操作


值得注意的是物体可能是多材质的Object3D（如树），所以要将其中的每个Mesh拆分到一组Instanced Draw中。举例来说，如果树有个3个材质（即3个子Mesh），则需要创建3个InstancedMesh，然后将所有树的第一个材质的Mesh对应到第一个InstancedMesh中，其余的以此类推


## Frustum Cull


![image](https://img2024.cnblogs.com/blog/419321/202404/419321-20240423113659749-518393412.png)


如上图所示，实现Instanced Draw+Frustum Cull的原理是将要剔除的物体移到InstancedMesh的instanceMatrix的最后，并将count减1


值得注意的是要将three.js默认的对单个Object3D的frustum cull关闭（即将source的frustumCulled设为false）


另外，我们直接遍历所有的待剔除物体来进行Fustum Cull检测，没有使用Octree等加速结构

相关的讨论请参考：[Linear search vs Octree (Frustum cull)](https://gamedev.stackexchange.com/questions/30151/linear-search-vs-octree-frustum-cull)


## LOD


![image](https://img2024.cnblogs.com/blog/419321/202404/419321-20240423113718034-259560968.png)


如上图所示，假设车有3个Level的LOD层级，我们希望离相机越远，显示越高的Level（Geometry、Material越简单）


我们需要创建3个InstanceMesh，分别对应不同的Level，如下图所示：

![image](https://img2024.cnblogs.com/blog/419321/202404/419321-20240423113724336-1451998520.png)


## 参考资料


[InstancedMesh2 - Easy handling and frustum culling](https://discourse.threejs.org/t/instancedmesh2-easy-handling-and-frustum-culling/58622)


[What is a more straightforward way to do instance culling?](https://community.khronos.org/t/what-is-a-more-straightforward-way-to-do-instance-culling/76825/2)


[Linear search vs Octree (Frustum cull)](https://gamedev.stackexchange.com/questions/30151/linear-search-vs-octree-frustum-cull)


[100kTrees](https://github.com/Strange-tech/100kTrees)


[LOD + Instancing](https://discourse.threejs.org/t/lod-instancing/20524)


[LOD with Instancing and Multi-Material Meshes](https://discourse.threejs.org/t/lod-with-instancing-and-multi-material-meshes/6620)


[Three.js InstancedMesh performance optimizations - DevLog 10](https://www.youtube.com/watch?v=fMgIW2Kyad4)