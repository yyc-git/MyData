# WebGPU学习系列目录 - 杨元超

> 日期: 2019-12-08 11:30
> 源: https://www.cnblogs.com/chaogex/p/12005108.html

# 介绍


大家好，本系列从0开始学习WebGPU API，并给出相关的demo。


## WebGPU介绍


WebGPU是最新的Web 3D图形API，是WebGL的升级版。

浏览器封装了现代图形API（Dx12、Vulkan、Metal），提供给Web 3D程序员WebGPU API。


![截屏2019-12-24下午4.44.33.png-119.7kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227102252856-419847332.png)

（图来自于[WebGPU 开发状态与计划](https://www.w3.org/2018/11/17-chinese-web-gpu.pdf)）


## 为什么要学习WebGPU


- 
WebGPU更好地支持多线程


- 
WebGPU支持compute shader，从而让程序员能利用GPU实现很多优化


- 
WebGPU与WebGL2的区别很大，两者不容易兼容。如果要从WebGL1升级，最好直接升级到WebGPU，一劳永逸


- 
WebGPU是标准，各大浏览器都会支持。不像WebGL2，苹果直接不支持。


- 
目前WebGPU虽然还未正式发布，但已经比较成熟了，也有相关的Demo可供学习


# 目录


## 第一部分：


- [WebGPU学习（一）: 开篇](https://www.cnblogs.com/chaogex/p/11986568.html)

- [WebGPU学习（二）: 学习“绘制一个三角形”示例](https://www.cnblogs.com/chaogex/p/11993144.html)

- [WebGPU学习（三）:MSAA](https://www.cnblogs.com/chaogex/p/12003722.html)

- [WebGPU学习（四）:Alpha To Coverage](https://www.cnblogs.com/chaogex/p/12004546.html)

- [WebGPU学习（五）: 现代图形API技术要点和WebGPU支持情况调研](https://www.cnblogs.com/chaogex/p/12041286.html)

- [WebGPU学习（六）：学习“rotatingCube”示例](https://www.cnblogs.com/chaogex/p/12079739.html)

- [WebGPU学习（七）：学习“twoCubes”和“instancedCube”示例](https://www.cnblogs.com/chaogex/p/12081022.html)

- [WebGPU学习（八）：学习“texturedCube”示例](https://www.cnblogs.com/chaogex/p/12091529.html)

- [WebGPU学习（九）：学习“fractalCube”示例](https://www.cnblogs.com/chaogex/p/12097129.html)

- [WebGPU学习（十）：介绍“GPU实现粒子效果”](https://www.cnblogs.com/chaogex/p/12101154.html)

- [WebGPU学习（十一）：学习两个优化：“reuse render command buffer”和“dynamic uniform buffer offset”](https://www.cnblogs.com/chaogex/p/12112704.html)

- [WebGPU性能测试分析](https://www.cnblogs.com/chaogex/p/14975644.html)


## 第二部分：


- [WebGPU+光线追踪Ray Tracing 开发三个月总结](https://www.cnblogs.com/chaogex/p/13199224.html)

- [如何用WebGPU流畅渲染百万级2D物体？](https://www.cnblogs.com/chaogex/p/16514254.html)

- [如何用WebGPU流畅渲染千万级2D物体：基于光追管线](https://www.cnblogs.com/chaogex/p/16557207.html)

- [WebGPU的计算着色器实现冒泡排序](https://www.cnblogs.com/chaogex/p/16578547.html)

- [WebGPU实现Ray Packet](https://www.cnblogs.com/chaogex/p/16620738.html)


## 其它：


- 
[WebGPU带来的可能性](https://www.bilibili.com/video/BV1ZF411u7c3)