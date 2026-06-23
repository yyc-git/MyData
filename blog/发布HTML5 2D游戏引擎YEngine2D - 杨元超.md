# 发布HTML5 2D游戏引擎YEngine2D - 杨元超

> 日期: 2014-11-11 07:26
> 源: https://www.cnblogs.com/chaogex/p/4088630.html

## 关于YEngine2D


YEngine2D是一个开源的、采用HTML5技术和Javscript语言创建的2D游戏框架，用来构建web二维游戏。


### [GitHub地址](https://github.com/yyc-git/YEngine2D)


## 最新版本


v0.1.2


## 浏览器支持


Chrome

Firefox

IE9+


## 外部依赖


您需要先下载[YOOP框架](https://github.com/yyc-git/YOOP)


## 相关游戏


[发布HTML5 RTS游戏-古代战争](http://www.cnblogs.com/chaogex/p/4086142.html)


## 特点


- 开源免费


引擎遵循MIT协议，用户可完全自由使用。


- 良好的设计


引擎从敏捷开发的游戏中提炼而出，具有良好的代码和模块结构，有比较好的可维护性和可扩展性。


- 良好的可测试性


引擎非常重视单元测试，基本实现了单元测试全覆盖。


- 使用HTML5技术，面向Web游戏开发


引擎采用最新的HTML5技术和Javascript语言开发，前端开发的同学能很快上手。


## 领域模型


![](//images0.cnblogs.com/blog/419321/201411/230826475933421.jpg)


## 包图


![](//images0.cnblogs.com/blog/419321/201411/162103416815705.jpg)


- 入口


引擎YE.main提供了引擎入口，可进行游戏配置，加载用户类。


- 基础


放置通用抽象基类。


- 核心


包括入口类、导演类、场景类、层类、精灵类，搭建游戏开发的基本框架。


- 动作


参考cocos2d，提出了立即动作和持续动作类，用户可创建自定义动作类。


- 动画


提供多种方式创建动画和管理动画。


- 算法


提供了通用的算法实现，如A*寻路算法。


- 内部库


集成了多个库，包括：

1、jsExtend

Javascript扩展库，扩展了String和Array对象。

2、YEQuery

仿jquery的Dom操作和ajax封装库。

3、YSound

优先使用Web Audio，可回退到Html5 Audio的声音库。


- 加载


支持图片、声音、json文件的加载。


- 数据结构


提出了线性集合类、哈希集合类、图片数据类等。


- UI


目前只有Canvas通用绘制封装类，后面会加入常用的UI组件。


- 事件管理


目前支持PC的键盘和鼠标事件，后面会加入移动端事件的支持。


- 声音管理


封装底层声音库YSound，提供游戏使用的高层api。


## 升级计划


- 建立开源社区，丰富文档

- 优化内存

- 改进声音加载

- 支持移动端游戏开发

- 加入UI组件

- 优化性能