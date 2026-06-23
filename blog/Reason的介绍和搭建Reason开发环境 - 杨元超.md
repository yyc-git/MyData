# Reason的介绍和搭建Reason开发环境 - 杨元超

> 日期: 2019-03-14 10:44
> 源: https://www.cnblogs.com/chaogex/p/10528737.html

# Reason介绍


Reason是在Ocaml语言的基础上修改而来，专门提供给前端开发者使用。


Reason是函数式编程语言，使用Bucklescript编译器编译成javascript语言。


在我看来，至少有两大优点：

1.编译后的javascript优化得非常好，让我们能够高性能地使用函数式编程。

2.强类型和类型推导，让我们既不用向Typescript那样定义很多类型（Reason会帮我们推导类型），又可以享受强类型约束的好处（编译时能检查更多的错误）。


我们[Wonder](https://www.wonder-3d.com/)已经使用Reason两年的时间了，所有产品，包括前端后端，都用Reason语言写，非常好用。


下面是一些链接资料：

[Reason官网](https://reasonml.github.io/docs/en/what-and-why)

[如何评价 reasonml ? -> Wonder的回答](https://www.zhihu.com/question/264265665/answer/293472713)


# 如何在VSCode中搭建Reason的开发环境


建议使用VSCode编辑器来开发Reason，因为它的插件支持得最好。


具体搭建Reason开发环境的步骤如下：


1.执行“yarn global add bs-platform”


这一步是为了安装Reason的相关工具，如格式化工具bsrefmt等


2.安装VSCode


3.安装VSCode->Extensions->reason-vscode插件


4.设置reason-vscode，显示函数的类型签名


在VSCode->“设置”中，搜索到reason的设置，选中 “Show the type for each top-level value in a codelens”。

或者在setting.json中，加上：


```
 "reason_language_server.per_value_codelens": true

```

5.克隆Reason-Example项目，学习如何开始开发：


```
git clone https://github.com/Wonder-Technology/Reason-Example.git

```

1)执行"yarn install"


2)执行"yarn watch"


这样在写Reason的时候，会自动编译为js。


3)执行"yarn start"，在浏览器地址中输入 [http://127.0.0.1:8080](http://127.0.0.1:8080) ， 运行index.html页面

打开控制台，看到输出“1”


# 应用案例


案例就是我们Wonder的产品哈，详见：


[Wonder.js-基于WebGL的3D引擎](https://github.com/Wonder-Technology/Wonder.js)


[Wonder-Editor-基于Wonder.js的3D编辑器](https://github.com/Wonder-Technology/Wonder-Editor)


我写的“从0开发3D引擎”系列博文也使用了Reason语言，详见：

[从0开发3D引擎](https://www.cnblogs.com/chaogex/p/12134031.html)