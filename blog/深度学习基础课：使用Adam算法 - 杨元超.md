# 深度学习基础课：使用Adam算法 - 杨元超

> 日期: 2023-01-30 16:48
> 源: https://www.cnblogs.com/chaogex/p/17076577.html

大家好~我开设了“深度学习基础班”的线上课程，带领同学从0开始学习全连接和卷积神经网络，进行数学推导，并且实现可以运行的Demo程序


线上课程资料：


[本节课录像回放](https://ak798x0xzb.feishu.cn/minutes/obcn4fy1k29u48ifj6y7ien5)


加QQ群，获得ppt等资料，与群主交流讨论：106047770


本系列文章为线上课程的复盘，每上完一节课就会同步发布对应的文章


本课程系列文章可进入索引查看：


[深度学习基础课系列文章索引](https://www.cnblogs.com/chaogex/p/16618498.html)


目录

- [为什么要学习本课](#为什么要学习本课)
- [代码实现](#代码实现)
- [Adam算法的学习资料](#adam算法的学习资料)


# 为什么要学习本课


- 为什么要使用Adam算法？

答：是因为要解决上一节课出现的无法收敛的问题。Adam算法可以自动调节每一层的学习率。我们只需要给出一个初始的学习率，在每一轮的中它会自动调整每一层的学习率，使它更接近最适合的值，从而能加快收敛


# 代码实现


- 在入口的[Main](https://github.com/yyc-git/DeepLearningEdu/blob/master/lessons/15_adam/src/code/Main.res)代码中，现在使用Adam优化算法了，相关代码如下：


```
let _createConvNetwork = () => {
 let learnRate = 0.001

 ...

 Network.create(
 AdamWOptimizerUtils.buildNetworkAdamWOptimizerData(~learnRate, ()),

```


- Adam算法的核心实现代码如下：

[AdamW.res](https://github.com/yyc-git/DeepLearningEdu/blob/master/lessons/15_adam/src/code/optimizer/AdamW.res)


```
let update = (data, (learnRate, t: int, (beta1, beta2, epsion)), vt_1, st_1, gradient) => {
 let vt = vt_1 *. beta1 +. (1. -. beta1) *. gradient
 let st = st_1 *. beta2 +. (1. -. beta2) *. gradient *. gradient

 let vBiasCorrect = vt /. (1. -. Js.Math.pow_float(~base=beta1, ~exp=t->Obj.magic))
 let sBiasCorrect = st /. (1. -. Js.Math.pow_float(~base=beta2, ~exp=t->Obj.magic))

 (data -. learnRate *. vBiasCorrect /. (Js.Math.sqrt(sBiasCorrect) +. epsion), (vt, st))
}

```

# Adam算法的学习资料


- [7.4 动量法](https://tangshusen.me/Dive-into-DL-PyTorch/#/chapter07_optimization/7.4_momentum)

- [7.6 RMSProp算法](https://tangshusen.me/Dive-into-DL-PyTorch/#/chapter07_optimization/7.6_rmsprop)

- [7.8 Adam算法](https://tangshusen.me/Dive-into-DL-PyTorch/#/chapter07_optimization/7.8_adam)