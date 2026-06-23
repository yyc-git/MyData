# 深度学习基础课：“判断性别”Demo需求分析和初步设计（上） - 杨元超

> 日期: 2022-08-20 11:22
> 源: https://www.cnblogs.com/chaogex/p/16607382.html

大家好~我开设了“深度学习基础班”的线上课程，带领同学从0开始学习全连接和卷积神经网络，进行数学推导，并且实现可以运行的Demo程序


线上课程资料：

[本节课录像回放](https://ak798x0xzb.feishu.cn/minutes/obcnv4bcvt2c523t34oaljbc)

扫码加QQ群，获得ppt等资料，与群主交流讨论：

![image](https://img2022.cnblogs.com/blog/419321/202208/419321-20220820111348220-1404893460.jpg)


本系列文章为线上课程的复盘，每上完一节课就会同步发布对应的文章


本文为第二节课：“判断性别”Demo需求分析和初步设计（上）的复盘文章


本课程系列文章可进入索引查看：

[深度学习基础课系列文章索引](https://www.cnblogs.com/chaogex/p/16618498.html)


目录

- [为什么要学习本课？](#为什么要学习本课)
- [回顾相关课程内容](#回顾相关课程内容)
- [主问题：Demo需求分析](#主问题demo需求分析)
- [主问题：什么是神经元？](#主问题什么是神经元)
- [主问题：如何使用神经元实现Demo？](#主问题如何使用神经元实现demo)
[任务：给出代码](#任务给出代码)


# 为什么要学习本课？


- 什么是神经元？

- 如何根据一个人的身高和体重，使用神经元推测出该人的性别？


# 回顾相关课程内容


- [第一节课：课程介绍](https://www.cnblogs.com/chaogex/p/16607372.html)


深度学习在图形学中有什么应用？


# 主问题：Demo需求分析


- 需求是什么？

答：给出一个人的身高、体重，能够通过深度学习推测出他的性别


# 主问题：什么是神经元？


- 
什么是神经元？

答：![image](https://img2022.cnblogs.com/blog/419321/202208/419321-20220820111909276-1135523216.png)

如上图所示，一个神经元具有一个偏移值b和多个权重值w，接受多个输入值x，返回一个输出值y


- 
计算公式是什么？

答：![image](https://img2022.cnblogs.com/blog/419321/202208/419321-20220820111926181-1361881219.png)


# 主问题：如何使用神经元实现Demo？


- 已知一个人的身高为150厘米，体重为50公斤，如何使用神经元得到该人的性别（应该为女性）？


神经元的输入和输出是什么？

答：输入为身高和体重，输出为性别

- 如何处理数据？

答：性别表示为0（男）、1（女）

- 激活函数应该是什么？

答：返回1的任意函数

- 需要知道神经元的哪些值？

答：权重、偏移

- 值是多少？

答：有任意多个解，其中一个解为：

![image](https://img2022.cnblogs.com/blog/419321/202208/419321-20220820111939333-1556867136.png)


## 任务：给出代码


- 输入的数据称为样本

- 求神经元的权重、偏移的过程叫做训练

- 根据样本和权重、偏移，代入激活函数得到输出值的过程叫做推理

- 请用代码实现？

答：


```
type state = {
 weight1: float,
 weight2: float,
 bias: float,
}

type sampleData = {
 weight: float,
 height: float,
}

type gender =
 | Male
 | Female

let createState = (): state => {
 weight1: Js.Math.random(),
 weight2: Js.Math.random(),
 bias: Js.Math.random(),
}

let train = (state: state, sampleData: sampleData): state => {
 {
 weight1: 1.0,
 weight2: -2.0,
 bias: -49.0,
 }
}

let _activateFunc = x => x

let _convert = x =>
 switch x {
 | 0. => Male
 | 1. => Female
 }

let inference = (state: state, sampleData: sampleData): gender => {
 (sampleData.height *. state.weight1 +. sampleData.weight *. state.weight2 +. state.bias)
 ->_activateFunc
 ->_convert
}

let state = createState()

let gender =
 state
 ->train({
 weight: 50.,
 height: 150.,
 })
 ->inference({
 weight: 50.,
 height: 150.,
 })

//1
Js.log(gender)

```