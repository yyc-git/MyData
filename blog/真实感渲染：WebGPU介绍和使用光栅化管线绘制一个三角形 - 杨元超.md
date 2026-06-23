# 真实感渲染：WebGPU介绍和使用光栅化管线绘制一个三角形 - 杨元超

> 日期: 2022-11-29 07:29
> 源: https://www.cnblogs.com/chaogex/p/16934336.html

大家好~本课程为“真实感渲染”的线上课程，从0开始，介绍相关的图形学算法和数学基础，给出详细的数学推导、伪代码和实现代码，最终带领大家开发出基于物理的渲染器


线上课程资料：


[本节课录像回放1](https://ak798x0xzb.feishu.cn/minutes/obcnvdy8ndr575jj26juz249)


[本节课录像回放2](https://ak798x0xzb.feishu.cn/minutes/obcnv2q25mneyutdsy8za7p1)


加QQ群，获得ppt等资料，与群主交流讨论：106047770


本系列文章为线上课程的复盘，每上完一节课就会同步发布对应的文章


本课程系列文章可进入索引查看：

[真实感渲染系列文章索引](https://www.cnblogs.com/chaogex/p/16926309.html)


目录

- [回顾相关课程内容](#回顾相关课程内容)
- [为什么要学习本课](#为什么要学习本课)
- [主问题：WebGPU是什么](#主问题webgpu是什么)
- [主问题：如何渲染](#主问题如何渲染)
- [主问题：WebGPU和WebGL是什么关系](#主问题webgpu和webgl是什么关系)
- [主问题：如何学习WebGPU](#主问题如何学习webgpu)
- [任务：准备开发环境](#任务准备开发环境)
- [主问题：如何使用光栅化管线实现“绘制一个三角形”](#主问题如何使用光栅化管线实现绘制一个三角形)
[结学](#结学)

- [任务：使用光栅化管线实现“绘制一个三角形”](#任务使用光栅化管线实现绘制一个三角形)
- [总结](#总结)
- [参考资料](#参考资料)
- [谢谢你~](#谢谢你)


# 回顾相关课程内容


- 为什么要学习真实感渲染？


# 为什么要学习本课


- WebGPU是什么？

- WebGL和WebGPU相比有什么区别？

- 如何用WebGPU绘制一个三角形？

![image](https://img2023.cnblogs.com/blog/419321/202211/419321-20221129072550451-1302172588.png)


# 主问题：WebGPU是什么


- WebGPU是什么？

答：Web端图形API。浏览器封装了现代图形API（Dx12、Vulkan、Metal），提供给Web 3D程序员WebGPU API

- 它有什么用？

答：![image](https://img2023.cnblogs.com/blog/419321/202211/419321-20221129072601820-180251933.png)


# 主问题：如何渲染


- 
在哪里渲染？

答：GPU


- 
有哪些渲染管线？

答：![image](https://img2023.cnblogs.com/blog/419321/202211/419321-20221129072606669-2140931553.png)


- 
每个渲染管线分别用于什么用途？

答：光栅化管线用于渲染；光追管线用于光线相交计算，实现了硬件光线相交计算加速；计算管线用于通用GPU计算，也可以实现光线相交计算，还可以实现遮挡剔除等计算


# 主问题：WebGPU和WebGL是什么关系


- 
WebGL是什么？

答：和WebGPU一样，都是Web端图形API


- 
它对应本地端的什么图形API？它的版本是如何演进的？

答：![image](https://img2023.cnblogs.com/blog/419321/202211/419321-20221129072618795-1622624513.png)


- 
WebGL和WebGPU相比有什么区别？

答：![image](https://img2023.cnblogs.com/blog/419321/202211/419321-20221129072622590-92065788.png)


- 
WebGPU相比WebGL有什么优势？

答：


WebGPU提供了对GPU更大范围地控制，从而能提高性能

- WebGPU更好地支持多线程

- WebGPU支持计算管线，从而让程序员能使用GPU进行计算

- WebGPU与WebGL2的区别很大，两者不容易兼容。如果要从WebGL1升级，最好直接升级到WebGPU，一劳永逸

- 各大浏览器都会支持WebGPU，而IOS不支持WebGL2


# 主问题：如何学习WebGPU


- [ WebGPU学习系列 ](https://www.cnblogs.com/chaogex/p/12005108.html)

- [ WebGPU学习中文资料 ](https://blog.csdn.net/caxieyou/article/details/92142390)

- [ WebGPU规范 ](https://gpuweb.github.io/gpuweb)

- [ webgpu-samples ](https://github.com/austinEng/webgpu-samples)


# 任务：准备开发环境


- WebGPU Node开源项目是干什么的？

答：运行在Node.js环境中，底层封装了Vulkan等本地图形API，上层提供WebGPU API

- 为什么要用WebGPU Node开源项目而不是WebGPU标准?

答：因为它有下面的优点：


WebGPU标准目前不支持光追管线，但是WebGPU Node开源项目支持它（需要RTX显卡）

- WebGPU标准使用的WGSL着色器语言缺少很多特性；而WebGPU Node开源项目使用GLSL，更成熟


然而它也有缺点： WebGPU Node提供的WebGPU API版本较老（2020年的版本）


- 
我们使用什么管线？

答：考虑到大多数同学的电脑没有RTX显卡，所以我们主要使用计算管线而不是光追管线来实现光线追踪


- 
安装nodejs


Node.js 是能够在服务器端运行JavaScript 的开放源代码、跨平台 JavaScript 运行环境


下载[最新版本](https://npm.taobao.org/mirrors/node/latest-v14.x/)，版本至少为13及以上


在Windows上安装时务必选择全部组件，包括勾选Add to Path


**检查npm**


npm是Node.js的包管理工具，通过下面的方式来检查是否已安装：


```
//应该能打印出版本号
npm -v

```


- 安装VS Code


进入[官网](https://code.visualstudio.com/)下载并安装


- 准备项目代码


clone本课程的Github项目(HTTPS clone)：[https://github.com/yyc-git/PotorealisticRenderEdu-3](https://github.com/yyc-git/PotorealisticRenderEdu-3)


- 
clone 后，请在根目录上执行：yarn


- 
没有yarn的同学请先执行：npm install --global yarn


- 
每个同学可以在项目中新建“mine/”文件夹（已经被git ignore），用于存放自己的文件


在项目根目录下，输入：


```
node lessons/2_triangle/code/index.js 

```

应该能看到运行结果：

![image](https://img2023.cnblogs.com/blog/419321/202211/419321-20221129072639349-1326683838.png)


- Shader languages support for VS Code


安装这个用于GLSL高亮的VS Code插件


- Shaderc GLSL Linter


安装这个用于GLSL编译检查的VS Code插件：


1.[下载shaderc](https://github.com/google/shaderc#downloads)，选择对应的操作系统的版本，解压

（在[cloud storage](https://console.cloud.google.com/storage/browser/shaderc/artifacts/prod/graphics_shader_compiler/shaderc;tab=objects?prefix=&forceOnObjectsSortingFiltering=false)中，可以找到历史版本）


2.VS Code中安装Shaderc GLSL Linter插件


3.设置它：


"glslcPath": "your-install-dir/bin/glslc"(e.g. /Users/yang/File/install/bin/glslc)


"glslcArgs": "--target-env=vulkan1.2"


4.验证：

打开项目的scene.vert文件，随便写一些错误的glsl代码，应该会有红线出现。

按f8后出现错误信息，如下图所示：

![image](https://img2023.cnblogs.com/blog/419321/202211/419321-20221129072749008-679615147.png)


- Clang-Format


安装这个用于GLSL格式化的VS Code插件：


1.终端上执行：


```
npm install -g clang-format

```

2.VS Code中安装Clang-Format插件


3.设置它:


"executable": "your-global-node_module-dir/clang-format/bin/your-os-dir/clang-format"

(e.g. /usr/local/lib/node_modules/clang-format/bin/darwin_x64/clang-format)


4.验证：

打开项目的scene.vert文件，把格式打乱（如缩进代码）；然后格式化代码，应该能够正确格式化


# 主问题：如何使用光栅化管线实现“绘制一个三角形”


- 
WebGPU坐标系介绍

右手坐标系

![image](https://img2023.cnblogs.com/blog/419321/202211/419321-20221130062112001-1887178097.png)


- 
已知一个三角形的三个顶点（2D坐标，z为0），如何通过光栅化管线渲染出一个三角形？

![image](https://img2023.cnblogs.com/blog/419321/202211/419321-20221130062115519-582403572.png)


## 结学


- 如何通过光栅化管线渲染出一个三角形？


# 任务：使用光栅化管线实现“绘制一个三角形”


- 请实现代码

答：待实现的代码：[exec](https://github.com/yyc-git/PotorealisticRenderEdu-3/tree/master/lessons/2_triangle/exec)，实现后的代码：[code](https://github.com/yyc-git/PotorealisticRenderEdu-3/tree/master/lessons/2_triangle/code)

- 介绍代码实现

答：参考资料：[WebGPU学习（二）: 学习“绘制一个三角形”示例](https://www.cnblogs.com/chaogex/p/11993144.html)

- 请每个同学运行代码，渲染出一个三角形

答：在项目根目录下，输入：


```
node lessons/2_triangle/code/index.js 

```

应该能看到运行结果：

![image](https://img2023.cnblogs.com/blog/419321/202211/419321-20221129072639349-1326683838.png)


- 移植该程序到WebGPU标准需要哪些修改？


# 总结


- 请回顾本节课的内容？

- 回答开始的问题？


# 参考资料


- [ WebGPU学习系列 ](https://www.cnblogs.com/chaogex/p/12005108.html)

- 《WebGL编程指南》

- [ WebGPU规范 ](https://gpuweb.github.io/gpuweb)


# 谢谢你~