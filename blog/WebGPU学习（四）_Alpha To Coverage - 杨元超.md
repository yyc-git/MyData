# WebGPU学习（四）:Alpha To Coverage - 杨元超

> 日期: 2019-12-08 08:11
> 源: https://www.cnblogs.com/chaogex/p/12004546.html

大家好，本文学习与MSAA相关的Alpha To Coverage以及在WebGPU中的实现。


上一篇博文

[WebGPU学习（三）:MSAA](https://www.cnblogs.com/chaogex/p/12003722.html)


下一篇博文

[WebGPU学习（五）: 现代图形API技术要点和WebGPU支持情况调研](https://www.cnblogs.com/chaogex/p/12041286.html)


# 学习Alpha To Coverage


## 前置知识


- [WebGPU学习（三）:MSAA](https://zhuanlan.zhihu.com/p/95930763)

- 一个fragment对应一个像素


## 介绍


开启了MSAA和Alpha To Coverage后，fragment的alpha值（fragment shader输出的颜色的alpha值）会影响该fragment对应像素的采样点是否被覆盖。


## 动机


参考[乱弹纪录II:Alpha To Coverage](http://www.zwqxin.com/archives/opengl/talk-about-alpha-to-coverage.html)：

![截屏2019-12-07下午3.48.09.png-220.6kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227102132652-393192052.png)

![截屏2019-12-07下午3.48.17.png-844.8kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227102136184-157562456.png)

![截屏2019-12-07下午3.48.23.png-203.1kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227102139597-1758729465.png)

![截屏2019-12-07下午3.48.29.png-774.9kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227102143080-1666659808.png)

![截屏2019-12-07下午9.25.41.png-380.3kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227102145980-1726057970.png)


## 原理


### 覆盖检测


通过[WebGPU学习（三）:MSAA](https://zhuanlan.zhihu.com/p/95930763)对MSAA原理的介绍，我们知道gpu要经过覆盖检测的步骤，来决定哪些采样点被覆盖。没有被覆盖的采样点不会进入“解析”步骤。


覆盖检测的结果是计算出每个fragment的coverage（覆盖率）。


根据[乱弹纪录II:Alpha To Coverage](http://www.zwqxin.com/archives/opengl/talk-about-alpha-to-coverage.html) 的说法，开启MSAA后，每个fragment带了一个新属性coverage（覆盖率），它是一个二进制的bit掩码mask。


以4X MSAA为例，每个fragment的coverage为xxxx，其中x为0或1。它的每一位对应像素的一个采样点sample，0表示该sample没被覆盖，1表示被覆盖。


所以coverage这个掩码对应了采样点的覆盖情况。


### 如何计算coverage


1.用户可以设置一个固定的coverage掩码，这里命名为FixedSampleMask


2.gpu检测每个像素有哪些采样点被primitive覆盖，得到该采样点的coverage掩码，这里命名为RasterizerCoverageMask


3.如果开启了Alpha To Coverage，则会将fragment的alpha值转换为coverage掩码，这里命名为AlphaCoverageMask


转换的算法可以参考[乱弹纪录II:Alpha To Coverage](http://www.zwqxin.com/archives/opengl/talk-about-alpha-to-coverage.html) ：


> 一个fragment的Alpha值在0~1间，它对应着一个dither mask。还是以4XMSAA为例，这个dither mask也是xxxx的形式，Alpha为0对应了0000，alpha为1对应了1111，至于中间的值的对应关系，OpenGL是交由显卡制造商决定的——其实一般就是类似[0~0.249 -> 0000, 0.25~0.499 -> 0001, 0.5~0.749 -> 0011, 0.75~0.99-> 0111]这样。


4.fragment shader可以输出该fragment的coverage掩码，这里称为FragShaderSampleMaskOutput


像素最终的coverage = FixedSampleMask & RasterizerCoverageMask & AlphaCoverageMask & FragShaderSampleMaskOutput

（“&”是逻辑与运算，如0011 & 0010 = 0010）


## 参考资料


[乱弹纪录II:Alpha To Coverage](http://www.zwqxin.com/archives/opengl/talk-about-alpha-to-coverage.html)


# WebGPU实现Alpha To Coverage


暂时没有实现的sample，我们根据WebGPU规范和相关资料，分析下WebGPU如何实现Alpha To Coverage。


- 在render pipeline descriptor中设置固定的coverage掩码FixedSampleMask和是否开启Alpha To Coverage：


```
dictionary GPURenderPipelineDescriptor : GPUPipelineDescriptorBase {
...
 unsigned long sampleMask = 0xFFFFFFFF;
 boolean alphaToCoverageEnabled = false;
... 
};

```

我们注意到sampleMask是unsigned long类型，它是32位的，而coverage应该是二进制的（如4X MSAA的coverage是4位的二进制），所以这里是进行了进制转换。


举例来说：

对于4X MSAA，如果设置sampleMask为0x1（十六进制），则它转换为二进制是0001；

如果设置sampleMask为0x3，则它转换为二进制是0010


- 可以在fragment shader中设置输出的coverage掩码FragShaderSampleMaskOutput


根据[Investigation: Multisample Coverage](https://github.com/gpuweb/gpuweb/issues/267)，我们知道Vulkan->SPIR-V的fragment shader支持内置的SampleMask变量。


因为Chrome实现的WebGPU也使用SPIR-V作为shader编译后的字节码，所以WebGPU在这点上应该与Vulkan类似。


我没有搜索到SPIR-V中关于SampleMask的详细资料，但是考虑到Chrome实现的WebGPU使用GLSL 4.5，所以我们可以看下它关于gl_SampleMask的[说明](https://www.khronos.org/registry/OpenGL-Refpages/gl4/html/gl_SampleMask.xhtml)：


> Name

> gl_SampleMask — specifies the sample coverage mask for the current fragment

> Declaration

> out int gl_SampleMask[] ;


我们看到gl_SampleMask的每个元素的类型是32位的，所以也进行了进制转换。


又因为它是数组，所以它支持coverage为超过32位的二进制（如支持64X MSAA）


用代码来说明：


```
//in fragment shader

gl_SampleMask[0] = 1; //对于4X MSAA来说，相当于设置该fragment的coverage为0001


```

```
//in fragment shader

gl_SampleMask[0] = 2;

gl_SampleMask[1] = 1; //对于64X MSAA来说，可能相当于设置该fragment的coverage为000...1000...10 （前面的000...1有32位，后面的000...10有32位） (我不能确定这是否正确！)


```


- 
如果开启了Alpha To Coverage，则不能在fragment shader中输出coverage掩码


- 
如果开启了Alpha To Coverage，将alpha转换为掩码的算法在不同的浏览器中不一样


## 参考资料


[Investigation: Multisample Coverage](https://github.com/gpuweb/gpuweb/issues/267)

[Minutes for GPU Web meeting 2019-04-29](https://docs.google.com/document/d/1RxZx6K2eytCCNI593YtEDgyxP84iuG0xvcS-Fr2EZsk/edit#heading=h.o7nziwf8wb1n)

[OpenGL->gl_SampleMask](https://www.khronos.org/registry/OpenGL-Refpages/gl4/html/gl_SampleMask.xhtml)