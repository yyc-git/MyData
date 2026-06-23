# three.js高性能渲染室外场景 - 杨元超

> 日期: 2024-06-06 16:10
> 源: https://www.cnblogs.com/chaogex/p/18235482

大家好，本文在相关文章的基础上，使用three.js渲染了高性能的室外场景，在移动端也有较好的性能，并给出了代码，分析了关键点，感谢大家~


关键词：three.js、Web3D、WebGL、室外场景、Instanced Draw、大场景、LOD、Frustum Cull、优化、开源


![image](https://img2024.cnblogs.com/blog/419321/202406/419321-20240606160959276-380051412.png)


代码：[Github](https://github.com/yyc-git/outdoor)


相关文章：

[three.js实现数字孪生3D仓库一期（开源） ](https://www.cnblogs.com/chaogex/p/18151130)

[three.js使用Instanced Draw+Frustum Cull+LOD来渲染大场景（开源）](https://www.cnblogs.com/chaogex/p/18152526)

[基于three.js的Instanced Draw+LOD+Frustum Cull的改进实现](https://www.cnblogs.com/chaogex/p/18209850)


我正在承接Web3D数字孪生项目，具体介绍可看[承接各种Web3D业务](https://www.cnblogs.com/chaogex/p/14090516.html)


加QQ群交流：106047770


目录

- [亮点](#亮点)
- [height map](#height-map)
- [color map](#color-map)
- [基础纹理](#基础纹理)
- [光照](#光照)
- [加入第三人称人物](#加入第三人称人物)
- [相机与地形 碰撞检测](#相机与地形-碰撞检测)
- [人物与地形 碰撞检测](#人物与地形-碰撞检测)
- [加入树](#加入树)
- [加入草](#加入草)
- [人物与树 碰撞检测](#人物与树-碰撞检测)
- [改进方向](#改进方向)
- [参考资料](#参考资料)


## 亮点


本文的亮点是基于Instanced Draw+LOD+Frustum Cull优化，能够高性能地渲染树、草等室外物体；并且实现了基本的地形


本文代码能在PC端、移动端流程运行


## height map


基于height map实现地形，能根据x、z坐标从height map中插值，获得y坐标（地形高度）


## color map


预读取color map，作为顶点颜色，代替多层纹理（为了性能考虑），可用来实现 道路 等效果


## 基础纹理


为了性能考虑，只加入一张纹理，以repeat的方式铺在地形上，使其与顶点颜色叠加


## 光照


地形使用MeshPhongMaterial材质，Phong光照


## 加入第三人称人物


加入第三人称人物，实现方式详见[实现人物](https://www.cnblogs.com/chaogex/p/18151130#%E5%AE%9E%E7%8E%B0%E4%BA%BA%E7%89%A9)


## 相机与地形 碰撞检测


相机移动时，不应该插入到地形中


最开始我是根据height map更新相机的y坐标，具体参考[地形碰撞](https://mouse0w0.github.io/lwjglbook-CN-Translation/15-terrain-collisions/)


这样做的问题是如果地形过高，可能导致相机拉得太高了；而且会有相机抖动的问题


所以，我改为加入地形Collider（立方体），让相机与Collider进行碰撞处理，具体详见[three.js实现相机碰撞，相机不穿墙壁、物体 ](https://www.cnblogs.com/chaogex/p/18157888)


本文只加入了一个Collider，并以绿色的立方体来显示（实际上应该不可见）


## 人物与地形 碰撞检测


跟相机一样，人物也与地形Collider进行碰撞检测


## 加入树


基于Instanced Draw+LOD+Frustum Cull来加入树


## 加入草


草直接使用billboard+Instanced Draw+Frustum Cull来渲染


## 人物与树 碰撞检测


使用八叉树保存树，使人物与八叉树进行碰撞检测


## 改进方向


下面是对地形的改进方向：


- 
超大地形

目前地形只有一块，如果是开放世界的话，应该是多块地形；

应该用四叉树作为加速结构来实现Frustum Cull；

应该实现LOD（不同lod的三角面数不同，material也不同，如近的lod应该使用多层纹理+color map，远的lod只使用color map）

参考：

[Tutorial 18: Large Terrain Rendering](https://www.rastertek.com/tertut18.html)


- 
多层纹理


- 
加入normal map，显示细节


- 
加入水


地形的系列教程如下：


[DirectX 11 Terrain Tutorials](https://www.rastertek.com/tutterr.html)

[DirectX 11 Terrain Tutorials - Series 2](https://www.rastertek.com/tutdx11s2ter.html)


## 参考资料


[Use Tri-Planar Texture Mapping for Better Terrain](https://gamedevelopment.tutsplus.com/use-tri-planar-texture-mapping-for-better-terrain--gamedev-13821a)


[多层纹理（Multilayered Terrain）](https://www.mbsoftworks.sk/tutorials/opengl3/21-multilayered-terrain/)