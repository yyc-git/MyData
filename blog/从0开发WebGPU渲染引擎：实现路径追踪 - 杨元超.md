# 从0开发WebGPU渲染引擎：实现路径追踪 - 杨元超

> 日期: 2023-07-17 10:45
> 源: https://www.cnblogs.com/chaogex/p/17559382.html

大家好，本文基于WebGPU的计算着色器实现了基础的路径追踪器，支持Middle BVH和No BVH两种加速结构


我主要是将[离线渲染零基础实战开发培训班（一期）->第二十九节课](https://www.bilibili.com/video/BV1Jo4y1Z7ty/?p=42)的代码移植到WebGPU中，其中的原理可以看该课程


本文实现的代码在[这里](https://github.com/Wonder-Technology/Wonder.js/tree/4666fb452a2eda3dc098541cd3401cb9f2e875ea)


目录

- [实现的功能](#实现的功能)
- [目前遍历BVH的性能还不到不用BVH的一半](#目前遍历bvh的性能还不到不用bvh的一半)
- [下一步](#下一步)


# 实现的功能


本文实现了下面的功能：


- no bvh or middle bvh

- path tracer

- direct light sample

- lambertian+specular material

- corner box scene


场景中的球和地板是specular material，完全镜面反射；

墙是labertian material，漫反射


目前的性能是：


硬件（2015年的Mac Pro）：

Mac OS Big Sur 11.4操作系统

Chrome浏览器

Intel Iris Pro 1536 MB集成显卡


FPS: 9


渲染结果：

![image](https://img2023.cnblogs.com/blog/419321/202307/419321-20230717104407518-1157038172.png)


# 目前遍历BVH的性能还不到不用BVH的一半


不用BVH的遍历是指直接遍历所有的三角形的AABB；

BVH的遍历是指先遍历Top Level（BVH树），然后再遍历对应的BVH树叶节点包含的Bottom Level（三角形的AABB）


遍历BVH的性能主要在下面几个方面提升：

1.尽量减少重叠的AABB

2.通过traverse order等方法来减少遍历的BVH节点数量

3.减少显存占用和IO


对于第二个方面，我已经使用了traverse order，即判断ray和aabb相交的tMin如果大于intersectResult.t的话，则不再进入该AABB里继续判断相交了。

但这并没有提升FPS，这是因为我使用的corner box场景简单，本来AABB数量就少，所以这不是性能热点


对于第一个方面，因为我使用的是最简单的Middle BVH来构造的BVH树，重叠的AABB很多。但这也不是主要的性能热点，还是因为AABB数量少


主要的性能热点应该在第三个方面，因为遍历BVH需要使用Stack来保存节点，而每个线程（一个像素对应一个线程）都要在显存中分配一个Stack的内存空间，并且不断有进栈出栈操作，IO压力也大


作为测试，我将Stack的深度降低后（Stack是一个数组，要预先固定深度，也就是设置固定的数组大小），FPS明显提升


以前我实现过[Ray Packet](https://www.cnblogs.com/chaogex/p/16620738.html)来优化这个方面，即一个线程组中的8*8个线程共享同一个Stack。

但是这只适合于Primary Ray的相交，次级射线的相交就不适合了，因为它们发射的方向很不一样。

或许可以对次级射线进行排序，相似方向的射线为一组，然后每组就可以使用Ray Packet来实现共享同一个Stack。


# 下一步


实现下面的功能：


- 在path tracer中加入[NRC：深度学习辐射亮度缓存](https://research.nvidia.com/publication/2021-06_real-time-neural-radiance-caching-path-tracing)优化

- 使用Instant Neural Graphics Primitives with a Multiresolution Hash Encoding来优化NRC