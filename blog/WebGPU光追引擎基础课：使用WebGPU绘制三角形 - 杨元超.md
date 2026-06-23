# WebGPU光追引擎基础课：使用WebGPU绘制三角形 - 杨元超

> 日期: 2022-09-06 20:06
> 源: https://www.cnblogs.com/chaogex/p/16663173.html

大家好~我开设了“WebGPU光追引擎基础课”的线上课程，从0开始，在课上带领大家现场写代码，使用WebGPU开发基础的光线追踪引擎

课程重点在于基于GPU并行计算，实现BVH构建和遍历


本课程使用自主开发的[Meta3D低代码开发平台](https://www.yuque.com/docs/share/4c56226d-ffc6-4e8e-8d94-6dfa230d74fb)来开发和共享老师和学生的代码，方便大家自由分享


线上课程资料：

[本节课录像回放](https://www.bilibili.com/video/BV1Va41197N6)

加QQ群，获得ppt等资料，与群主交流讨论：106047770


本系列文章为线上课程的复盘，每上完一节课就会同步发布对应的文章


本文为第二节课：使用WebGPU绘制三角形


本课程系列文章可进入索引查看：

[WebGPU光追引擎基础课系列文章索引](https://www.cnblogs.com/chaogex/p/16651894.html)


目录

- [主问题：如何实现](#主问题如何实现)


# 主问题：如何实现


- 
分析代码

代码详见：[代码](https://github.com/yyc-git/WebGPURayTracingEngineEdu/blob/master/lessons/2_triangle/src/main.ts)


- 
运行代码

结果如下图所示：

![image](https://img2022.cnblogs.com/blog/419321/202209/419321-20220906200633411-500077317.png)