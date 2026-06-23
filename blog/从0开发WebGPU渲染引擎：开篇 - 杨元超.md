# 从0开发WebGPU渲染引擎：开篇 - 杨元超

> 日期: 2023-07-07 16:15
> 源: https://www.cnblogs.com/chaogex/p/17535307.html

大家好，本系列会从0开始，开发一个基于WebGPU的路径追踪渲染器，使用深度学习降噪、DLSS等AI技术实现**实时渲染**；并且基于自研的低代码开发平台，让用户可以通过可视化拖拽的方式快速搭建自定义的Web3D引擎


目录

- [回顾目前的技术积累](#回顾目前的技术积累)
- [为什么要从0开发WebGPU渲染引擎？](#为什么要从0开发webgpu渲染引擎)
- [下一步](#下一步)


# 回顾目前的技术积累


我已经在Web3D引擎领域有[1万小时开发经验](https://www.cnblogs.com/chaogex/p/15986803.html)，主要完成了下面的事情：

1.用了4年，全职开发了Wonder：类似于Unity的WebGL引擎和编辑器，发布了v1.1正式版，完成了MVP功能


详细介绍可看：

[Wonder 1.0正式版发布-----WebGL 3D引擎和编辑器](https://www.cnblogs.com/chaogex/p/10508464.html)


[![](https://img2018.cnblogs.com/blog/419321/201903/419321-20190311205946475-1669737326.gif)](https://yyc-git.github.io/wonder/index.html)


2.学习了WebGPU，写了WebGPU的新手教程，熟悉了计算着色器的使用，实现了LBVH算法


详情请见：

[WebGPU学习系列目录](https://www.cnblogs.com/chaogex/p/12005108.html)


后面还作为技术合伙人，拿到了“WebGPU引擎项目”的天使轮千万投资


3.用了大概1年的时间，全职开发了基础的离线路径追踪渲染器，开设了相关的课程（课时长达49小时）


详情请见：

[WebGPU+光线追踪Ray Tracing 开发三个月总结](https://www.cnblogs.com/chaogex/p/13199224.html)

[发布了几个版本的代码](https://github.com/Wonder-Technology/Wonder.js/tree/v2.0.0-alpha.6)

[离线渲染零基础实战开发培训班](https://www.bilibili.com/video/BV1Jo4y1Z7ty/?vd_source=9fcdb7c5d92e95429d4dd9af0380937b)


渲染图：

![image](https://img2023.cnblogs.com/blog/419321/202307/419321-20230707161714408-477407956.png)


4.用了大概1年的时间，全职开发了Meta3D：Web3D低代码开发平台


Meta3D是开源的Web3D低代码平台，致力于建设共享互助开放的Web3D生态，让Web3D引擎和编辑器开发轻而易举


![image](https://img2023.cnblogs.com/blog/419321/202307/419321-20230707161731176-1817881509.png)


Meta3D的用户是Web3D引擎或编辑器的开发者，您使用Meta3D来快速搭建Web3D引擎或编辑器


Meta3D已经发布了内测版本


详情请见：

[Meta3D官网](https://meta3d-website.4everland.app/)


5.用了大概1年半的时间，学习了深度学习，开发了一个深度学习框架、开办了深度学习基础班培训课程，并且已经实现了深度学习降噪、DLSS等Demo


详情请见：

[我开发的深度学习框架](https://github.com/yyc-git/AI3D)

[深度学习基础课系列目录](https://www.cnblogs.com/chaogex/p/16618498.html)

[深度学习降噪专题课](https://www.cnblogs.com/chaogex/collections/2358)

[实时渲染前沿研究：在浏览器上实现了Facebook提出的DLSS算法](https://www.cnblogs.com/chaogex/p/17500874.html)


6.用了3个月，全职完成了《3D编程模式》这本开源书


本书提出了3D引擎和编辑器相关的7个编程模式，详情请见：

[我写了本开源书：《3D编程模式》](https://www.cnblogs.com/chaogex/p/17416866.html)


# 为什么要从0开发WebGPU渲染引擎？


开发Wonder v1.2版本时暂停了开发，原因是发现有两个问题难以解决：

(1)没有实现全局光照，只有局部光照

因为使用的是WebGL，性能不行，没有计算着色器，所以难以实现高性能的全局光照算法

(2)用户不能扩展编辑器

因为编辑器的UI是React写的，所以不方便由用户扩展


因此，本系列开发的引擎将作为Wonder的v3.0版本，彻底解决这个两个问题。

解决方案如下：

(1)对于第一个问题，我们从WebGL改为WebGPU，从光栅化渲染改为路径追踪渲染，从而实现全局光照。

这里不使用光栅化+光追的混合渲染的好处是可以只用一套算法而实现所有的渲染效果，方便实现和管理。

另外，因为使用[深度学习辐射亮度缓存](https://research.nvidia.com/publication/2021-06_real-time-neural-radiance-caching-path-tracing)、深度学习降噪、DLSS作为后处理，所以只需要1spp和低分辨率的采样，从而实现**实时渲染**


更多思考请详见：

[实时渲染路径追踪概述](https://www.cnblogs.com/chaogex/p/17154116.html)


(2)对于第二个问题，因为现在我们基于Meta3D来开发引擎和编辑器，用户可以通过组装不同的组件来实现自定义的引擎和编辑器，并且UI改为用IMGUI实现，从而能容易地实现引擎和编辑器的扩展


# 下一步


实现下面的功能：


- 基于WebGPU的计算着色器，实现基础的路径追踪器

- 使用LBVH作为加速结构