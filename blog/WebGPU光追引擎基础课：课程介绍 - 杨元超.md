# WebGPU光追引擎基础课：课程介绍 - 杨元超

> 日期: 2022-09-03 08:11
> 源: https://www.cnblogs.com/chaogex/p/16651891.html

大家好~我开设了“WebGPU光追引擎基础课”的线上课程，从0开始，在课上带领大家现场写代码，使用WebGPU开发基础的光线追踪引擎

课程重点在于基于GPU并行计算，实现BVH构建和遍历


本课程使用自主开发的[Meta3D低代码开发平台](https://www.yuque.com/docs/share/4c56226d-ffc6-4e8e-8d94-6dfa230d74fb)来开发和共享老师和学生的代码，方便大家自由分享


线上课程资料：

[本节课录像回放](https://ak798x0xzb.feishu.cn/minutes/obcn6olmjnb8l8ro68g1368n)

扫码加QQ群，获得ppt等资料，与群主交流讨论：

![image](https://img2022.cnblogs.com/blog/419321/202208/419321-20220820111348220-1404893460.jpg)


本系列文章为线上课程的复盘，每上完一节课就会同步发布对应的文章


本文为第一节课：课程介绍的复盘文章


本课程系列文章可进入索引查看：

[WebGPU光追引擎基础课系列文章索引](https://www.cnblogs.com/chaogex/p/16651894.html)


目录

- [为什么要学习本课](#为什么要学习本课)
- [教学方式](#教学方式)
- [技术栈](#技术栈)
- [课程特色](#课程特色)
- [学员收益](#学员收益)
- [课程大纲](#课程大纲)
- [相关的学习资源](#相关的学习资源)


# 为什么要学习本课


详见：[WebGPU带来的可能性](https://www.bilibili.com/video/BV1ZF411u7c3?vd_source=9fcdb7c5d92e95429d4dd9af0380937b)


# 教学方式


- 本课程属于工程实践，偏重于代码实现而不是理论

- 部分课程的代码由老师实现，给同学讲解

- 其余课程的代码由同学在老师的引导下，在上课时自己实现


# 技术栈


- Typescript

用于Demo开发

- Rescript

用于引擎开发

Rescript的学习资料为：

[官方文档](https://rescript-lang.org/docs/manual/latest/introduction)


# 课程特色


- 从0开始

- 零基础上手学习

- 实战开发，现场写代码

- 基于光线追踪

- 侧重于GPU端实现

- 代码在公开的Meta3D平台上共享


# 学员收益


- 了解WebGPU

- 学习GPU并行计算

- 学习BVH实现

- 了解光线追踪

- 了解引擎开发

- 获得公开共享的代码


# 课程大纲


一、全局纵览


- 课程介绍

- 介绍光线投射

- 使用WebGPU绘制三角形

- 使用Meta3D实现“绘制三角形”


二、Demo实现


- 渲染数十万3D物体

- 渲染百万级2D物体

- 实现GPU冒泡排序

- 实现GPU Parallel Reduction

- 使用Ray Packet优化BVH遍历

- 实现GPU Prefix Sum

- 实现GPU基数排序

- 基于PLOC算法实现GPU构造BVH

- 实现GPU LOD

- 实现直接光源采样的路径追踪

- 优化Shadow Ray遍历BVH

- 实现完美镜面反射

- 优化Reflect Ray遍历BVH

- 加上基于深度学习的降噪


三、引擎开发


- 封装光追管线

- 实现Material

- 封装光追渲染

- 组合为引擎


四、引擎应用


- 渲染2D场景

- 渲染3D场景


# 相关的学习资源


- [WebGPU学习系列](https://www.cnblogs.com/chaogex/p/12005108.html)

- [离线渲染零基础实战开发培训班（一期）](https://www.bilibili.com/video/BV1Jo4y1Z7ty)

- [深度学习基础课](https://www.cnblogs.com/chaogex/p/16618498.html)