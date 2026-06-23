# 实时渲染前沿研究：在浏览器上实现了Facebook提出的DLSS算法 - 杨元超

> 日期: 2023-06-24 11:42
> 源: https://www.cnblogs.com/chaogex/p/17500874.html

大家好，我基于[WebNN](https://github.com/webmachinelearning/webnn/blob/main/explainer.md)在浏览器上实现了2020年Facebook提出的Neural-Supersampling-for-Real-time-Rendering算法。它是一个用于实时渲染的神经网络超采样算法，能够把低分辨率的图片超采样为高分辨率的图片


本课程系列文章可进入合集查看：

[实时渲染前沿研究系列文章合集](https://www.cnblogs.com/chaogex/collections/2811)


# 介绍DLSS算法整体思想


算法的整体介绍可参考：[毫秒级时间使图像清晰16倍，Facebook提出的DLSS算法介绍](https://zhuanlan.zhihu.com/p/366126664)


算法的pytorch实现请见：[Github](https://github.com/INTEW/NSRR)


算法的本课实现请见：[Github](https://github.com/yyc-git/DLSS-Demo)


# 介绍整体实现思路


1.使用pytorch实现训练，保存weight、bias

2.使用WebNN实现推理，读取weight、bias


# 实现的重点记录


1.后面需要加入Motion Vector input，并实现Backward Warp

2.zero upsampling的实现参考了：[https://github.com/pytorch/pytorch/issues/7911#issuecomment-392835113](https://github.com/pytorch/pytorch/issues/7911#issuecomment-392835113)

3.应该可以使用Typescript dependent type来实现Tensor维度的编译检查。不过目前没有完全实现

4.等[webnn issue](https://github.com/webmachinelearning/webnn/issues/379)实现后，就可以直接获得MLOperand的dimensions了。这样可方便简化代码，如在builder.slice时直接获得dimensions


# 在浏览器上推理的结果


使用webgl后端，场景大小为180*120，推理后为720*480


耗时为：

2015年的macbook pro：6000ms


# 后续优化点


现在的主要问题是推理太慢了，可以从下面几个方面来加快速度：


- 
测试每个Module耗费的时间，找到性能热点


- 
减少推理中的数据拷贝，如减少builder.slice、builder.concat的使用


- 
减少previous frame的个数

目前我用的是5个，可以减少为4个


- 
减半Reconstruction网络的参数


- 
等待WebNN成熟，从而可以使用WebGPU后端、甚至是硬件推理后端


# 改进方向


## 对颜色rgb进行处理


进入神经网络前先除以albedo；神经网络输出后再乘以它


## 可以结合[Neural Supersampling for Real-time Rendering、High-Quality Supersampling via Mask-reinforced Deep Learning for Real-time Rendering](https://arxiv.org/abs/2301.01036)论文提出的神经网络，从而获得16*4=64倍的像素提升！


具体方法是：

1.渲染512*256的1/4的像素（也就是256*128）

2.使用该论文提出的神经网络，将其超采样为512*256的分辨率

3.使用本文实现的DLSS算法的神经网络，再将其超采样为512*256*16的分辨率


## 不使用Motion Vector来做Backward Warp?


参考[Fast Temporal Reprojection without Motion Vectors](https://www.google.com/search?q=Fast+Temporal+Reprojection+without+Motion+Vectors&oq=Fast+Temporal+Reprojection+without+Motion+Vectors&aqs=chrome..69i57.138j0j7&sourceid=chrome&ie=UTF-8)


## 移动端的改进


参考[MNSS: Neural Supersampling Framework for Real-Time Rendering on Mobile Devices](https://ieeexplore.ieee.org/document/10076842)