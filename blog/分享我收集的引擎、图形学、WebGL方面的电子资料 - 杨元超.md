# 分享我收集的引擎、图形学、WebGL方面的电子资料 - 杨元超

> 日期: 2016-06-13 21:40
> 源: https://www.cnblogs.com/chaogex/p/5579365.html

本文分享我这一年以来收集的我认为比较经典的电子资料，希望能对大家有所帮助！

本文会不断更新！


# 目录


- [WebGL Insights](#webgl_insights)

- [OpenGL Insights](#opengl_insights)

- [Game Programming Patterns](#patterns)

- [Design by Contract 原则与实践](#contract)

- [游戏引擎架构](#engine_architecture)

- [编程珠玑](#zhuji)


# 《WebGL Insights》


[http://pan.baidu.com/s/1dF7ERG9](http://pan.baidu.com/s/1dF7ERG9)


## 推荐度


5星


## 内容概要说明


相当于webgl的gems书，包括了介绍浏览器是怎么实现webgl的、一些图形渲染基于webgl的实现、现有的开源引擎（如babylonjs）的设计和优化等。


## 目录说明


I. WebGL Implementations


- ANGLE: A Desktop Foundation for WebGL

- Mozilla's Implementation of WebGL

- Continuous Testing of Chrome's WebGL Implementation


II. Moving to WebGL

4. Getting Serious with JavaScript

5. Emscripten & WebGL

6. Data Visualization with WebGL: from Python to JavaScript

7. Teaching an Introductory Computer Graphics Course with WebGL


III. Mobile

8. Bug-Free and Fast Mobile WebGL


IV. Engine Design

9. WebGL Engine Design in Babylon.js

10. Rendering Optimizations in the Turbulenz Engine

11. Performance and Rendering Algorithms in Blend4Web

12. Sketchfab Material Pipeline: From File Variations to Shader Generation

13. glslify: A module system for GLSL

14. Budgeting Frame Time


V. Rendering

15. Deferred Shading in Luma

16. HDR Image-Based Lighting on the Web

17. Real-Time Volumetric Lighting for WebGL

18. Terrain Geometry - LOD Adapting Concentric Rings


VI. Visualization

19. Data Visualization Techniques with WebGL

20. hare3d - Rendering Large Models in the Browser

21. The BrainBrowser Surface Viewer: WebGL-based Neurological Data Visualization


VII. Interaction

22. Usability of WebGL Applications

23. Designing Cameras for WebGL Applications


## 我的心得与体会


一本非常好的书，对深入里面Webgl、学习其他开源引擎的设计和优化、移动端webgl开发和优化等都很有帮助！


# 《OpenGL Insights》


[http://pan.baidu.com/s/1gfCu7K3](http://pan.baidu.com/s/1gfCu7K3)


# 推荐度


4星半


# 内容概要说明


本书算是基于opengl的gems书了，每个章节是一个专题，不仅包括opengl，也包括了webgl方面的主题，是一本提高阶段的书籍。


# 目录说明


暂无


# 我的心得与体会


书中的webgl方面的专题、性能专题以及移动方面的专题（比如介绍了tile-based架构)都是很有用的。

而且书最后还给出了opengl es2.0的渲染管线图。

不过还有些内容我现在暂时用不到（比如基于opengl 4.0 的tessellation shader，与occusion exclude相关的算法等），等到需要用到的时候，再来看。


# 《Game Programming Patterns》


[http://gameprogrammingpatterns.com/contents.html](http://gameprogrammingpatterns.com/contents.html)


## 推荐度


4星半


## contents


This is a online e-book that talks about design pattern in game.

First it revisit a part patterns(6 patterns) of gof, Then it discuss useful patterns that some of them are already applied in [Wonder.js engine](https://github.com/yyc-git/Wonder.js).


## catalogue


- 
Introduction

Architecture, Performance, and Games


- 
Design Patterns Revisited

Command

Flyweight

Observer

Prototype

Singleton

State


- 
Sequencing Patterns

Double Buffer

Game Loop

Update Method


- 
Behavioral Patterns

Bytecode

Subclass Sandbox

Type Object


- 
Decoupling Patterns

Component

Event Queue

Service Locator


- 
Optimization Patterns

Data Locality

Dirty Flag

Object Pool

Spatial Partition


## my experience


The book is full of practical experiences and the discussition is very detailed and instructive.


The "State pattern" chapter discuss the Concurrent State Machines, Hierarchical State Machines, Pushdown Automata that are instructive and will be useful.


The "Service Locator" chapter is new to me that it's the first time to touch the pattern.Though the author suggest that it can use DI instead of it in some cases.


The "Data Locality" chapter is important and a useful way for optimizing. It stresses the cache miss problem.


The "Spatial Partition" chapter is important too that i will use the technology to organize objects of scene.


# 《游戏引擎架构》


试读版下载，没找到完整版：

[http://pan.baidu.com/s/1hsyf20O](http://pan.baidu.com/s/1hsyf20O)


## 推荐度


5星


## 内容概要说明


本书全方位讲解了3d引擎的设计以及一些重要的实现、优化细节，是一本好书！


## 目录说明


第一部分 基础	1

第1章 导论	3

1.1 典型游戏团队的结构	4

1.2 游戏是什么	7

1.3 游戏引擎是什么	10

1.4 不同游戏类型中的引擎差异	11

1.5 游戏引擎概观	22

1.6 运行时引擎架构	27

1.7 工具及资产管道	46

第2章 专业工具	53

2.1 版本控制	53

2.2 微软Visual Studio	61

2.3 剖析工具	78

2.4 内存泄漏和损坏检测	79

2.5 其他工具	80

第3章 游戏软件工程基础	83

3.1 重温C++及最佳实践	83

3.2 C/C++的数据、代码及内存	90

3.3 捕捉及处理错误	118

第4章 游戏所需的三维数学	125

4.1 在二维中解决三维问题	125

4.2 点和矢量	125

4.3 矩阵	139

4.4 四元数	156

4.5 比较各种旋转表达方式	164

4.6 其他数学对象	168

4.7 硬件加速的SIMD运算	173

4.8 产生随机数	180

第二部分 低阶引擎系统	183

第5章 游戏支持系统	185

5.1 子系统的启动和终止	185

5.2 内存管理	193

5.3 容器	208

5.4 字符串	225

5.5 引擎配置	234

第6章 资源及文件系统	241

6.1 文件系统	241

6.2 资源管理器	251

第7章 游戏循环及实时模拟	277

7.1 渲染循环	277

7.2 游戏循环	278

7.3 游戏循环的架构风格	280

7.4 抽象时间线	283

7.5 测量及处理时间	285

7.6 多处理器的游戏循环	296

7.7 网络多人游戏循环	304

第8章 人体学接口设备（HID）	309

8.1 各种人体学接口设备	309

8.2 人体学接口设备的接口技术	311

8.3 输入类型	312

8.4 输出类型	316

8.5 游戏引擎的人体学接口设备系统	318

8.6 人体学接口设备使用实践	332

第9章 调试及开发工具	333

9.1 日志及跟踪	333

9.2 调试用的绘图功能	337

9.3 游戏内置菜单	344

9.4 游戏内置主控台	347

9.5 调试用摄像机和游戏暂停	348

9.6 作弊	348

9.7 屏幕截图及录像	349

9.8 游戏内置性能剖析	349

9.9 游戏内置的内存统计和泄漏检测	356

第三部分 图形及动画	359

第10章 渲染引擎	361

10.1 采用深度缓冲的三角形光栅化基础	361

10.2 渲染管道	404

10.3 高级光照及全局光照	426

10.4 视觉效果和覆盖层	438

10.5 延伸阅读	446

第11章 动画系统	447

11.1 角色动画的类型	447

11.2 骨骼	452

11.3 姿势	454

11.4 动画片段	459

11.5 蒙皮及生成矩阵调色板	471

11.6 动画混合	476

11.7 后期处理	493

11.8 压缩技术	496

11.9 动画系统架构	501

11.10 动画管道	502

11.11 动作状态机	515

11.12 动画控制器	535

第12章 碰撞及刚体动力学	537

12.1 你想在游戏中加入物理吗	537

12.2 碰撞/物理中间件	542

12.3 碰撞检测系统	544

12.4 刚体动力学	569

12.5 整合物理引擎至游戏	601

12.6 展望：高级物理功能	616

第四部分 游戏性	617

第13章 游戏性系统简介	619

13.1 剖析游戏世界	619

13.2 实现动态元素：游戏对象	623

13.3 数据驱动游戏引擎	626

13.4 游戏世界编辑器	627

第14章 运行时游戏性基础系统	637

14.1 游戏性基础系统的组件	637

14.2 各种运行时对象模型架构	640

14.3 世界组块的数据格式	657

14.4 游戏世界的加载和串流	663

14.5 对象引用与世界查询	670

14.6 实时更新游戏对象	676

14.7 事件与消息泵	690

14.8 脚本	707

14.9 高层次的游戏流程	726

第五部分 总结	727

第15章 还有更多内容吗	729

15.1 一些未谈及的引擎系统	729

15.2 游戏性系统	730

参考文献	733


## 如何应用该书


在实践（开发引擎、实现相关的算法等）时或者遇到问题时，可查阅本书的对应章节。


## 我的心得与体会


本书的5、6、7、13、14章节对我[现在的引擎](https://github.com/yyc-git/Wonder.js)的改进就很有帮助！

等我要实现骨骼动画时，需要再仔细研究11章节，然后提炼出动画引擎！


# 《Design by Contract 原则与实践》


暂时没找到电子资料，建议到淘宝购买复印版（因为本书已经停版了）。


## 推荐度


4星


## 内容概要说明


本书通过实例，详细而层层推进地探讨了“契约式设计”地思想原则和实践方法，引入了Dbc地六大原则和六大准则，展示了它们地运用，分析了Dbc和继承地关系，介绍了框定规则、Dbc的好处和限制、观察者框架中的契约和先验条件检验；最后给出了一个Java范例，并探讨了契约在分析模型中的应用。

本书思维严密，逻辑性很强。


## 目录说明


第1章 契约式设计初探	1

1.1 概述	1

1.2 顾客管理器范例	2

1.3 一些问题	5

1.4 customer_manager的契约	6

1.5 临时总结	9

1.6 运行时检测	11

1.7 可靠的文档	13

1.8 小结	15

1.9 一言以蔽之	15

1.10 下一步工作	15

第2章 契约式设计的基本原则	17

2.1 关于本章	17

2.2 栈	18

2.3 区分命令和查询	19

2.4 命名规范	22

2.5 区分基本查询和派生查询	23

2.6 说明命令对基本查询的影响	26

2.7 用不变式确定恒定特性	34

2.8 类及其契约	36

.2.9 基本查询是栈的一个概念模型	38

2.10 六大原则	42

2.11 下一步工作	43


第3章 运用六大原则	47

3.1 关于本章	47

3.2 字典	47

3.3 特性分离与分类	48

3.4 后验条件	50

3.5 先验条件	56

3.6 不变式	62

3.7 关于字典的完整的契约级概括	63

3.8 小结	65

3.9 练习	66

第4章 契约的构造支持类-- 不可变列表	69

4.1 关于本章	69

4.2 支持线性结构	69

4.3 契约只涉及表达式	70

4.4 不可变列表	71

4.5 不可变列表的契约	72

4.5.1 基本查询	72

4.5.2 创建命令	74

4.5.3 派生查询count	74

4.5.4 派生查询preceded_by	74

4.5.5 派生查询item	75

4.5.6 派生查询is_equal	77

4.5.7 派生查询sublist	79

4.6 小结	81

4.7 练习	81

第5章 六大原则在queue设计中的运用	83

5.1 关于本章	83

5.2 队列	83

5.3 remove特性的契约	84

5.4 将count作为一个派生特性	88

5.5 initialize特性的契约	91

5.6 head特性的契约	93

5.7 put特性的契约	94

5.8 更多派生查询	94

5.9 小结	95

5.10 练习	96

第6章 契约式设计与继承	99

6.1 关于本章	99

6.2 超类和子类	99

6.3 重新定义契约	100

6.3.1 eiffel语法	104

6.3.2 小结	107

6.4 不变式和继承	108

6.5 以被确保的后验条件定义超类	109

6.6 两种继承	116

6.7 小结	117

6.8 练习	117

第7章 框定规则	119

7.1 关于本章	119

7.2 变化规格和框定规则	119

7.3 使用不可变列表为put撰写框定规则	121

7.4 使用“forall”为put撰写框定规则	128

7.5 框定规则的类别	130

7.6 练习	132

7.7 关于预处理器的补充说明	132

第8章 契约式设计的收益	137

8.1 关于本章	137

8.2 几种优点	137

8.3 更优秀的设计	138

8.4 提高可靠性	140

8.5 更出色的文档	140

8.6 简化调试	142

8.7 支持复用	142

8.8 契约式设计与防御性编程	143

8.8.1 防止程序接受错误的输入	143

8.8.2 给程序穿上“防弹衣”	144

8.8.3 防御性编程	145

8.9 契约的一些开销和限制	146

第9章 观察者(observer) 框架中的契约	149

9.1 关于本章	149

9.2 观察者框架	150

9.3 不可变集合	152

9.4 观察者的系缚和解缚	155

9.5 通知（一个观察者）	156

9.6 通知（多个观察者）	158

97 性能问题	160

9.8 框定规则	161

9.9 保密	164

9.10 练习	166

第10章 满足先验条件	169

10.1 关于本章	169

10.2 例子	170

10.3 满足并测试先验条件	170

10.4 测试与检验	172

10.5 一个简单的计数器类	173

10.6 从用户角度看示例程序	174

10.7 程序的内部结构	176

10.8 程序的执行情况	178

10.9 一个次要的细节	184

10.10 小结	186

10.11 练习	187

第11章 java范例	189

11.1 关于本章	189

11.2 为什么选择java	190

11.3 队列	190

11.3.1 基本查询size()	192

11.3.2 基本查询get()	193

11.3.3 基本查询head()	193

11.3.4 派生查询isempty()	194

11.3.5 派生查询shallow copy()	194

11.3.6 构造方法queue	195

11.3.7 命令put	196

11.3.8 命令remove	196

11.3.9 小结	198

11.4 字典	198

11.4.1 名字	199

11.4.2 不变式	200

11.4.3 基本查询	200

11.4.4 一个派生查询	201

11.4.5 命令	201

11.4.6 构造方法	202

11.4.7 一组实现类	203

11.5 没有icontract的java	203

11.6 测试先验条件	207

11.7 练习	212

第12章 契约式分析	215

12.1 关于本章	215

12.2 一个用例	215

12.3 分析模型中的契约	217

12.4 withdrawcash用例的契约	217

12.5 从分析到设计	220

12.6 问题域和系统模型	221

12.7 对象限制语言	224

12.8 小结	225

参考资料	227

契约式设计	227

统一建模语言uml	228

eiffel和java编程语言	229

观察者模式	229

编译器和预处理器	229

三个实用网站	230

索引	245


## 如何应用该书


我的[Wonder.js引擎](https://github.com/yyc-git/Wonder.js)就使用了dbc，使用typescript的decorator来实现require和ensure,invariant。

现在我主要使用契约来替代防御性编程，检查先验条件和后验条件。


## 我的心得与体会


Dbc对提高代码质量有帮助，可与单元测试结合起来：Dbc提供运行时检查（检查先验、后验条件，进行防御式检查和测试）；单元测试提供静态测试，测试功能代码。


# 《编程珠玑》


[http://pan.baidu.com/s/1pK7etzd](http://pan.baidu.com/s/1pK7etzd)


## 推荐度


5星


## 内容概要说明


本书章节相互独立，在基础、性能、应用三个部分的主题中，给出了案例、经验、总结，并且每章后面还有习题，确实是一本很好的经典书籍！


## 目录说明


第一部分　基础

　　第1章　开篇

　　1.1　一次友好的对话

　　1.2　准确的问题描述

　　1.3　程序设计

　　1.4　实现概要

　　1.5　原理

　　1.6　习题

　　1.7　深入阅读

　　第2章　啊哈！算法

　　2.1　三个问题

　　2.2　无处不在的二分搜索

　　2.3　基本操作的威力

　　2.4　排序

　　2.5　原理

　　2.6　习题

　　2.7　深入阅读

　　2.8　变位词程序的实现（边栏）

　　第3章　数据决定程序结构

　　3.1　一个调查程序

　　.　3.2　格式信函编程

　　3.3　一组示例

　　3.4　结构化数据

　　3.5　用于特殊数据的强大工具

　　3.6　原理

　　3.7　习题

　　3.8　深入阅读

　　第4章　编写正确的程序

　　4.1　二分搜索的挑战

　　4.2　编写程序

　　4.3　理解程序

　　4.4　原理

　　4.5　程序验证的角色

　　4.6　习题

　　4.7　深入阅读

　　第5章　编程小事

　　5.1　从伪代码到c程序

　　5.2　测试工具

　　5.3　断言的艺术

　　5.4　自动测试

　　5.5　计时

　　5.6　完整的程序

　　5.7　原理

　　5.8　习题

　　5.9　深入阅读

　　5.10　调试（边栏）

　　第二部分　性能

　　第6章　程序性能分析

　　6.1　实例研究

　　6.2　设计层面

　　6.3　原理

　　6.4　习题

　　6.5　深入阅读

　　第7章　粗略估算

　　7.1　基本技巧

　　7.2　性能估计

　　7.3　安全系数

　　7.4　little定律

　　7.5　原理

　　7.6　习题

　　7.7　深入阅读

　　7.8　日常生活中的速算（边栏）

　　第8章　算法设计技术

　　8.1　问题及简单算法

　　8.2　两个平方算法

　　8.3　分治算法

　　8.4　扫描算法

　　8.5　实际运行时间

　　8.6　原理

　　8.7　习题

　　8.8　深入阅读

　　第9章　代码调优

　　9.1　典型的故事

　　9.2　急救方案集锦

　　9.3　大手术——二分搜索

　　9.4　原理

　　9.5　习题

　　9.6　深入阅读

　　第10章　节省空间

　　10.1　关键在于简单

　　10.2　示例问题

　　10.3　数据空间技术

　　10.4　代码空间技术

　　10.5　原理

　　10.6　习题

　　10.7　深入阅读

　　10.8　巨大的节省（边栏）

　　第三部分　应用

　　第11章　排序

　　11.1　插入排序

　　11.2　一种简单的快速排序

　　11.3　更好的几种快速排序

　　11.4　原理

　　11.5　习题

　　11.6　深入阅读

　　第12章　取样问题

　　12.1　问题

　　12.2　一种解决方案

　　12.3　设计空间

　　12.4　原理

　　12.5　习题

　　12.6　深入阅读

　　第13章　搜索

　　13.1　接口

　　13.2　线性结构

　　13.3　二分搜索树

　　13.4　用于整数的结构

　　13.5　原理

　　13.6　习题

　　13.7　深入阅读

　　13.8　一个实际搜索问题（边栏）

　　第14章　堆

　　14.1　数据结构

　　14.2　两个关键函数

　　14.3　优先级队列

　　14.4　一种排序算法

　　14.5　原理

　　14.6　习题

　　14.7　深入阅读

　　第15章　字符串

　　15.1　单词

　　15.2　短语

　　15.3　生成文本

　　15.4　原理

　　15.5　习题

　　15.6　深入阅读

　　第1版跋

　　第2版跋

　　附录a　算法分类

　　附录b　估算测试

　　附录c　时空开销模型

　　附录d　代码调优法则

　　附录e　用于搜索的c++类


## 如何应用该书


可以当成字典书来查（如需要实现排序或者要对3d引擎优化时，可查看对应的章节)。


## 我的心得与体会


书中的性能部分和应用的排序算法部分对我的[wonder.js引擎](https://github.com/yyc-git/Wonder.js)v0.5.6和v0.5.7版本的优化工作很有帮助。

书中第4章关于契约的应用我也深有感触！

还需要读第2遍，把每个章节的习题做一遍！

书中确实字字是珠玑，值得仔细品味和研究！