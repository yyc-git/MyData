# Web 3D是否需要WebAssembly? - 杨元超

> 日期: 2020-01-10 17:36
> 源: https://www.cnblogs.com/chaogex/p/12177333.html

大家好，本文讨论了Web 3D是否需要WebAssembly，结论是：

对于使用原生3D技术的程序员，需要；

对于使用Javascript语言的前端程序员，不需要，有其它方法可以达到接近WebAssdembly的性能。


# WebAssembly是什么？


WebAssembly简称wasm，是一种数据格式，对应的文件后缀名为.wasm，文件由字节码组成；

而Javascript对应的文件后缀名为.js，文件由字符串组成。


两者都可以在浏览器上直接运行。


一份典型的.wasm 文件如下所示（引用自[恕我直言，90% 的应用场景都不需要用WebAssembly！](https://zhuanlan.zhihu.com/p/79792515)）：


```
00000000: 0061 736d 0100 0000 0108 0260 017f 0060 .asm.......`...`
00000010: 0000 0215 0203 656e 7603 6d65 6d02 0001 ......env.mem...
00000020: 026a 7303 6c6f 6700 0003 0201 0107 0b01 .js.log.........
00000030: 0765 7861 6d70 6c65 0001 0a23 0121 0041 .example...#.!.A
00000040: 0042 c8ca b1e3 f68d c8ab ef00 3703 0041 .B..........7..A
00000050: 0841 f2d8 918b 0236 0200 4100 1000 0b .A.....6..A....

```

可以通过Emscripten等编译器，将原生语言（如C++等）编译为wasm程序。


# 比较wasm与js


## 优点


对于使用Javascript语言的前端程序员，wasm的优点为：


- 体积更小

白鹭引擎团队测试过：


> 将大约300k左右（压缩后）JavaScript逻辑改用WebAssembly重写后，体积仅有90k左右。虽然使用WebAssembly需要引入一个50-100k的JavaScript类库作为基础设施，但是总体来看资源尺寸的优势还是很大的。


- 执行性能高（但是通过JIT优化，js程序的执行性能接近wasm）

wasm属于AOT: Ahead-of-Time compilation，即在执行前，通过编译生成浏览器能够直接执行的、优化过的字节码，这样浏览器在执行它时不需要进行编译，性能高。

但是，因为chrome浏览器的v8引擎支持JIT: Just-in-Time compilation，所以**js程序的执行性能接近wasm**（对于Web 3D程序，性能热点的逻辑会在主循环中多次被执行。而v8会在多次执行后，确定热点代码，会将其优化为字节码；然后从下次执行开始，直接执行字节码）

要提高js代码在JIT中的性能，需要保证类型的健壮性，如不要轻易改变变量的类型

因为js是弱类型和动态语言，直接写js代码很容易造成类型混乱，降低JIT的性能，所以我们应该使用编译为js的强类型语言（如[Reason语言](https://reasonml.github.io/)），通过编译检查来保证类型的健壮性。

- 更加安全

因为wasm文件是字节码，无法直接阅读，所以增加了安全性。


## 缺点


对于使用Javascript语言的前端程序员，wasm的缺点为：


- 
需要熟悉C++等原生语言

因为wasm是由原生语言编译而来，所以需要程序员学习原生语言，增加了学习成本


- 
不能直接操作原生图形API（如OpenGL），只能通过js调用WebGL

所以与其在wasm中调用webgl，还不如直接用js来调用webgl，这样更方便，性能应该也差不多

**参考资料**

[How to use WebGL shaders in WebAssembly](https://www.freecodecamp.org/news/how-to-use-webgl-shaders-in-webassembly-1e6c5effc813/)：


> When compiling, emscripten will map our code to the WebGL API.

> [WebAssembly 的出现是否会取代 JavaScript？ - doodlewind的回答 - 知乎](https://www.zhihu.com/question/322007706/answer/741764049)：

> 调 OpenGL 都要走回 JS 到 WebGL


- 增加了维护成本

我们通常用这种方案来应用wasm：一部分逻辑用wasm实现，负责需要高性能的密集计算；另一部分逻辑用js实现，负责dom操作和webgl调用。

这样就需要同时维护wasm和js代码，增加了成本。


# 结论


## 对于使用原生3D技术（如基于C++语言和DirectX、OpenGL等原生图形API）的程序员


可以用wasm技术，将3D程序编译为wasm文件，从而原生3D应用搬到浏览器上运行


## 对于使用Javascript语言的前端程序员


不需要用wasm技术，而是通过下面的方法来获得接近wasm的性能：

1、使用强类型语言（如Reason）编译为js。这样可提高js代码在JIT中的性能

2、把需要高性能的计算逻辑，放到worker线程中进行计算；或者使用WebGPU的compute shader，将其从CPU端移到GPU端进行计算，大幅提升性能。

关于WebGPU，可以参考 [WebGPU学习](https://www.cnblogs.com/chaogex/p/12005108.html)


# 参考资料


[恕我直言，90% 的应用场景都不需要用WebAssembly！](https://zhuanlan.zhihu.com/p/79792515)

[如何评论浏览器最新的 WebAssembly 字节码技术？ - 罗志宇的回答 - 知乎](https://www.zhihu.com/question/31415286/answer/58022648)

[WebAssembly在白鹭引擎5.0中的实践](https://blog.csdn.net/chenqiuge1984/article/details/80131055)