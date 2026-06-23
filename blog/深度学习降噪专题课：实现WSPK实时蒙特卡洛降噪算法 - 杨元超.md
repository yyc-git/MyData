# 深度学习降噪专题课：实现WSPK实时蒙特卡洛降噪算法 - 杨元超

> 日期: 2023-06-12 11:45
> 源: https://www.cnblogs.com/chaogex/p/17474648.html

大家好~本课程基于全连接和卷积神经网络，学习LBF等深度学习降噪算法，实现实时路径追踪渲染的降噪


本课程偏向于应用实现，主要介绍深度学习降噪算法的实现思路，演示实现的效果，给出实现的相关代码


线上课程资料：

[本节课录像回放](https://www.bilibili.com/video/BV1vm4y1q7NZ/)

[代码](https://github.com/yyc-git/Denoise-Demo)


加QQ群，获得相关资料，与群主交流讨论：106047770


本系列文章为线上课程的复盘，每上完一节课就会同步发布对应的文章


本课程系列文章可进入合集查看：

[深度学习降噪专题课系列文章合集](https://www.cnblogs.com/chaogex/collections/2358)


# 回顾上节课内容


回顾“深度学习蒙特卡洛降噪的基本思想”


# 介绍WSPK算法整体思想


WSPK针对KPCN，做了下面的优化：


- network使用了RepVGG块，可以通过结构重参数化来使得训练和推理的network的结构不一样（训练的network是多路架构，推理的network是单路架构），从而提高network的收敛速度

- network的最后一个RepVGG输出important map+alpha map，然后通过类似于softmax的机制，实现kernel fusion，在输出层输出包含场景像素数据（辐射亮度：r、g、b）

这样做的好处是减少了最后一个RepVGG输出的范围，加快了训练输出


网络结构如下图所示（只显示了最后两层）：

![image](https://img2023.cnblogs.com/blog/419321/202306/419321-20230612114416361-1154333664.png)


# 介绍整体实现思路


1.使用pytorch实现训练，保存weight

2.使用WebNN实现推理，读取weight


# 演示训练、推理


使用webgl后端，场景大小为256*256


耗时为：

2015年的macbook pro：600ms


RTX2060s：60ms


补充：

使用webgl后端，场景大小为1280*720

耗时为：

2015年的macbook pro：2000ms


# 目前遇到的问题


[input with big image error for webgl backend: context lost](https://github.com/webmachinelearning/webnn-polyfill/issues/229)


[WebGPU backend error: Binding size is smaller than the minimum binding size](https://github.com/webmachinelearning/webnn-polyfill/issues/230)

已得到答复：目前不支持WebGPU backend


# 参考资料


- [WSPK算法实现](https://github.com/Rendering-at-ZJU/weight-sharing-kernel-prediction-denoising)

- [Web Neural Network API Explained](https://github.com/webmachinelearning/webnn/blob/main/explainer.md)