# WebGPU学习（一）: 开篇 - 杨元超

> 日期: 2019-12-05 08:39
> 源: https://www.cnblogs.com/chaogex/p/11986568.html

# 介绍


大家好，本系列从0开始学习WebGPU API，并给出相关的demo。


上一篇博文

[WebGPU学习系列目录](https://www.cnblogs.com/chaogex/p/12005108.html)

下一篇博文

[WebGPU学习（二）: 学习“绘制一个三角形”示例](https://www.cnblogs.com/chaogex/p/11993144.html)


## WebGPU介绍


参考[WebGPU 开发状态与计划](https://www.w3.org/2018/11/17-chinese-web-gpu.pdf)：


WebGL是老的Web 3D图形API，它的版本演进如下图所示：

![截屏2019-12-24下午4.32.02.png-140.5kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227101533125-437045876.png)


WebGPU是最新的Web 3D图形API，与WebGL的对比为：

![截屏2019-12-24下午4.42.45.png-108.5kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227101524090-1151089766.png)


浏览器封装了现代图形API（Dx12、Vulkan、Metal），提供给Web 3D程序员WebGPU API。


WebGPU概要：

![截屏2019-12-24下午4.44.33.png-119.7kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227101529218-1577753461.png)


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


## WebGPU完善程度


自从2017年提出WebGPU后，已经经过两年的发展。

目前Chrome和Safari支持得比较好，基本功能都有了（比如能够绘制pbr材质的模型，支持compute shader等），而且已经可以在MacOS中运行。


Babylonjs已经支持了WebGPU，详见[WebGPU 文档](https://doc.babylonjs.com/extensions/webgpu)。


不过WebGPU对于shader使用哪种方案还没有确定：

在Chrome中，使用4.5版本的glsl ，需要通过官方提供的第三方库将其转成二进制码（SPIR-V）；

在Safari中，直接使用新的语言[WSL](https://webkit.org/blog/8482/web-high-level-shading-language/)，不需要转换。


前者的好处是我们熟悉glsl，学习成本低；

后者的好处是新语言功能更强大，性能更好。


- 参考资料


[WebGPU 开发状态与计划-2018.11.17](https://www.w3.org/2018/11/17-chinese-web-gpu.pdf)

[Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)

[WebGPU and WSL in Safari](https://webkit.org/blog/9528/webgpu-and-wsl-in-safari/)

[WebGPU and WSL in Web Inspector](https://webkit.org/blog/9624/webgpu-and-wsl-in-web-inspector/)

[Babylonjs->WebGPU 文档](https://doc.babylonjs.com/extensions/webgpu)

[webgpu-samples for Chrome (uses GLSL via SPIR-V)](https://github.com/yyc-git/webgpu-samples)

[WebKit/Safari Demos (uses WSL)](https://webkit.org/demos/webgpu/)

[gpuweb->issues](https://github.com/gpuweb/gpuweb/issues)


## 准备开发环境


MacOS只有高版本支持WebGPU（我之前是MacOS 10.10版本，运行不了WebGPU！升级为MacOS Catalina就可以运行了！！！）。


对于Chrome：

下载最新的Chrome Canary，并且打开 chrome://flags/#enable-unsafe-webgpu


大家可以使用我下载的[Chrome Canary](https://github.com/yyc-git/MyData/blob/master/3d/googlechrome(canary).dmg)。


对于Safari：

下载最新的Safari Technology Preview，选中 Safari → Preferences → Advanced → Develop menu→ Experimental Features → WebGPU


## WebGPU学习资料


目前学习资料非常少，属于早期探索阶段～


[WebGPU学习中文资料](https://blog.csdn.net/caxieyou/article/details/92142390)

[WebGPU: An Explicit Graphics API for the Web](https://docs.google.com/presentation/d/1URnqb1Vuf2jPieHnt_eqXsPV_Es9Oog00_8LKZUdo6g/edit#slide=id.g482a63b4f5_0_1191)

[Get started with GPU Compute on the Web](https://developers.google.com/web/updates/2019/08/get-started-with-gpu-compute-on-the-web)

[WebGPU API规范](https://gpuweb.github.io/gpuweb/)


# 本系列技术选型


- 
开发环境


Chrome Canary

因为Chrome市场占用率更高，而且shader使用glsl更简单，所以我使用Chrome Canary。


- 
技术栈


Javascript语言


- 
使用原生WebGPU API


# 能给你带来什么收益？


- 从0学习WebGPU，熟悉原生API

- 缩小与PC端最新的3D技术的差距（学了WebGPU，就只与目前最新的DX12 RTX差半代了！而WebGL2只相当于DX10）

- 更新思维模式，学习最新的设计理念（WebGPU相比WebGL相当灵活和模块化，如果要被封装成引擎的话需要一些新的设计思路）


# 内容规划


本系列分成三个部分：


## 第一部分（已经完成）


一个一个地学习官方的[sample](https://github.com/yyc-git/webgpu-samples)（我fork到本地了），掌握基础的API调用，讲解相关的概念


## 第二部分（开始写了）


学习光线追踪，并实现对应的sample


## 第三部分（没有开始写）


综合运用所学内容，实现一些demo（如gpu driven render pipeline）