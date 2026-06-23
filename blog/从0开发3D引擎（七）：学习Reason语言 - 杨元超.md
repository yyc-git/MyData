# 从0开发3D引擎（七）：学习Reason语言 - 杨元超

> 日期: 2020-01-23 10:42
> 源: https://www.cnblogs.com/chaogex/p/12230293.html

目录

- [上一篇博文](#上一篇博文)
- [下一篇博文](#下一篇博文)
- [介绍Reason](#介绍reason)
- [Reason的优势](#reason的优势)
- [如何学习Reason？](#如何学习reason)
- [介绍Reason的部分知识点](#介绍reason的部分知识点)


大家好，本文介绍Reason语言以及学习Reason的方法。


# 上一篇博文


[从0开发3D引擎（六）：函数式反应式编程及其在引擎中的应用](https://www.cnblogs.com/chaogex/p/12175075.html)


# 下一篇博文


[从0开发3D引擎（补充）：介绍领域驱动设计](https://www.cnblogs.com/chaogex/p/12408802.html)


# 介绍Reason


Reason又叫Reasonml，是在Ocaml语言的基础上修改而来，由Facebook ReactJs的开发组开发和维护。

Reason是函数式编程语言，由Bucklescript编译器将其编译为javascript语言。

Reason是专门提供给前端开发者使用的，相对于Ocaml，语法上与javascript更为接近。


# Reason的优势


1、从“发展前景”来说：

1)大公司Facebook出品，质量、稳定性、后续维护升级有保证

2)Reason是基于OCaml的，因此随着Ocaml的版本更新，Reason和Bucklescript也会支持Ocaml的新特性

3)函数式编程越来越火，它也在3D引擎中越来越多地使用（如Frostbite公司提出的Frame Graph架构和Data Oriented思想都需要结合函数式编程）


2、从“性能”来说：

1)Reason支持mutable的操作和数据结构

可在性能热点处使用它们，提高性能

2)对浏览器的JIT编译友好，提升了运行时性能

因为Reason是强类型语言，所以保证了函数或数据结构的类型不变。这符合monomorphic，从而使浏览器的js引擎（如v8）在优化热点代码后，不会因为热点代码的类型改变而进行优化回滚。

3)BuckleScript对函数式编程做了很多优化（如对compose,curry等操作和immutable的数据结构做了优化，以及将尾递归函数优化为迭代操作），使我们可以放心地使用各种函数式编程的特性，丢掉低级别语法的优化负担

4)BuckleScript的编译速度非常快，使我们能一边写Reason代码，一边很快得到编译后的js代码


3、从“开发成本”来说：

1)支持跨平台，写一次Reason代码，可编译为多种语言（当然，目前主要是编译为js）

除了BuckleScript是编译为js的后端，现在还有编译为Native的[后端](https://reasonml.github.io/docs/zh-CN/native)；

根据BuckleScript作者的消息([当WebAssembly遇到BuckleScript](https://zhuanlan.zhihu.com/p/25067337))，未来可能支持编译为.wasm.

2)强类型

Reason有比Typescript还要强的类型，从而在编译时能检查更多的错误。


参考作者的介绍：


> 更好的类型安全: typescript是一个JS的超集，它存在很多历史包袱。而微软引入typescript更多的是作为一个工具来使用的比如IDE的代码补全，相对安全的代码重构。而这个类型的准确从第一天开始就不是它的设计初衷，以至于Facebook自己设计了一个相对更准确地类型系统Flow. 而OCaml的类型系统是已经被形式化的证明过正确的。也就是说从理论上BuckleScript 能够保证一旦编译通过是不会有运行时候类型错误的，而typescript远远做不到这点


3)类型推导，很多类型不需要手写，而是由Bucklescript帮我们推导

参考作者的介绍：


> 更多的类型推断，更好的语言特性：用过typescript的人都知道，typescript的类型推断很弱，基本上所有参数都需要显示的标注类型。不光是这点，像对函数式编程的支持，高阶类型系统GADT的支持几乎是没有。而OCaml本身是一个比Elm,PureScript还要强大的多的语言，它自身有一个非常高阶的module system，是为数不多的对dependent type提供支持的语言，polymorphic variant。而且pattern match的编译器也是优化过的。


4、从“生态”来说：

1)支持javascript的生态

Reason通过FFI（类似于Typescript的.d.ts）与javascript交互，支持引入js库；

Reason支持按照多种模块规范（可以为CommonJS、ES6 modules、AMD）来编译js。

2)支持Ocaml的生态

Reason支持很多Ocaml的库，并且可以将[Ocaml项目转换为Reason项目](https://reasonml.github.io/docs/zh-CN/convert-from-ocaml)


**参考资料**

[架构最快最好的To JS编译器](https://zhuanlan.zhihu.com/p/22216448)

[如何评价 reasonml ? -> Wonder的回答](https://www.zhihu.com/question/264265665/answer/293472713)


# 如何学习Reason？


1、学习[Reason官方文档](https://reasonml.github.io/docs/zh-CN/overview)，把Language Basics、JavaScript章节的内容看一遍；使用[在线代码编辑器](https://reasonml.github.io/en/try?rrjsx=true&reason=DYUwLgBAZg9jEF4ICcRQBQFYCUBuAUIaJFAJYBuIi0cAerhIbPAFxIBsDQA)写Reason代码，学习Reason语法


2、学习Reason的[Examples项目](https://reasonml.github.io/docs/en/community-examples)，把代码都看懂


3、参考[从0开发3D引擎（三）：搭建开发环境](https://www.cnblogs.com/chaogex/p/12164689.html)，搭建Reason的开发环境，开发自己的Reason项目

毕竟自己动手写才能真正掌握。


4、进一步学习Reason

可以学习Bucklescript的[文档](https://bucklescript.github.io/docs/zh-CN/interop-overview)；

可以学习[官方资料->Articles & Videos](https://reasonml.github.io/docs/en/articles-and-videos)；

可以跟随[本系列的文章](https://www.cnblogs.com/chaogex/p/12134031.html)，学习如何用Reason写3D引擎；

可以学习我们用Reason写的开源3D引擎-[Wonder.js](https://github.com/Wonder-Technology/Wonder.js)和用Reason+Reason-React+Redux写的开源编辑器-[Wonder-Editor](https://github.com/Wonder-Technology/Wonder-Editor)，学习如何使用Reason开发实际的项目。


5、有问题可以在[官方论坛](https://reasonml.chat/)中寻找答案，或者加我们的QQ群（106047770）进行咨询


# 介绍Reason的部分知识点


- bsconfig.json


bsconfig.json是项目的配置文件，可参考[Configuration](https://bucklescript.github.io/docs/zh-CN/build-configuration)，完整的配置描述[在这里](https://bucklescript.github.io/bucklescript/docson/#build-schema.json)。


值得注意的是：

编译后的js文件只能在“lib/”这个文件夹中（因为配置文件不支持修改）；

可以在“package-specs”字段中配置编译后的js文件模块规范（可以为CommonJS、ES6 modules、AMD）。在生产环境下，可以结合Webpack，将ES6 modules的js文件打包为一个文件。


- FFI


Reason通过FFI与javascript交互。


相关介绍可参考[External](https://reasonml.github.io/docs/zh-CN/external)

更多语法可参考[BuckleScript externals](https://bucklescript.github.io/docs/zh-CN/intro-to-external)


Reason社区已经写了很多FFI了，可在[redex](https://redex.github.io/)中找到。


- Library


Reason通过FFI，可以引入js的库；

而且Reason和Bucklescript也提供了API封装，来[操作Reason的数据结构](https://reasonml.github.io/api/index.html)（如List）和[js的数据结构](https://bucklescript.github.io/bucklescript/api/index.html)（如Array）


具体介绍可参考[Libraries](https://reasonml.github.io/docs/zh-CN/libraries)