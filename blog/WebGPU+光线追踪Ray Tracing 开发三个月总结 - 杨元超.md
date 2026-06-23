# WebGPU+光线追踪Ray Tracing 开发三个月总结 - 杨元超

> 日期: 2020-06-27 18:39
> 源: https://www.cnblogs.com/chaogex/p/13199224.html

大家好~这三个月以来，我一直在学习和实现“基于WebGPU的混合光线追踪实时渲染”的技术，使用了Ray Tracing管线（如.rgen、.rmiss等着色器）。

现在与大家分享和介绍我目前的学习成果，希望对大家有所帮助！谢谢！


目录

- [通过国外的开源项目，可在WebGPU中使用Ray Tracing管线](#通过国外的开源项目可在webgpu中使用ray-tracing管线)
[搭建运行环境](#搭建运行环境)

- [应用场景](#应用场景)
- [介绍我目前的实现方案](#介绍我目前的实现方案)
- [介绍我学习的整个流程，分享相关资料](#介绍我学习的整个流程分享相关资料)
[了解光线追踪的相关领域](#了解光线追踪的相关领域)
- [实现第一个光追的Demo](#实现第一个光追的demo)
- [学习和实现Ray Tracing管线](#学习和实现ray-tracing管线)
- [用Reason重写](#用reason重写)
- [学习GBuffer+Ray Tracing混合管线](#学习gbufferray-tracing混合管线)
- [实现降噪Denoise](#实现降噪denoise)
[实现taa](#实现taa)
- [实现BMFR降噪算法](#实现bmfr降噪算法)

- [学习蒙特卡罗积分（monte carlo）的理论](#学习蒙特卡罗积分monte-carlo的理论)
- [实现全局光照](#实现全局光照)
- [基于GGX模型，实现disney BRDF](#基于ggx模型实现disney-brdf)
- [目前的渲染效果](#目前的渲染效果)

- [我目前的实现需要改进的地方](#我目前的实现需要改进的地方)
[在Ray Tracing pass中支持纹理](#在ray-tracing-pass中支持纹理)
- [扩展disney BRDF，实现BSDF，支持透明、折射效果](#扩展disney-brdf实现bsdf支持透明折射效果)
- [增加后处理](#增加后处理)
- [在云端环境下多线程渲染](#在云端环境下多线程渲染)
- [改进降噪效果](#改进降噪效果)
- [改进indirect specular/diffuse noise](#改进indirect-speculardiffuse-noise)


# 通过国外的开源项目，可在WebGPU中使用Ray Tracing管线


这三个月我对Ray Tracing的研究有了质的突破，主要归功于我发现的[WebGPU Node](https://github.com/maierfelix/webgpu)开源项目！

该作者首先在[dawn-ray-tracing](https://github.com/maierfelix/dawn-ray-tracing)开源项目中对“dawn项目：Chrome对WebGPU的实现"进行了扩展，加入了光追的API；

然后在[WebGPU Node](https://github.com/maierfelix/webgpu)开源项目中，底层封装了Vulkan SDK，上层使用了dawn-ray-tracing项目，提供了WebGPU API，实现了在Nodejs环境中使用WebGPU API和Ray Tracing管线来实现硬件加速的光线追踪（电脑需要使用nvdia的RTX显卡）！


相关介绍参见：

[Real-Time Ray-Tracing in WebGPU](http://maierfelix.github.io/2020-01-13-webgpu-ray-tracing/)


## 搭建运行环境


显卡需要为GeForce RTX（如RTX 2060s）


有两种方法来搭建运行环境：

1、给Chrome浏览器打补丁，使其与下载DXR驱动（DirectX Raytracing）关联，从而在该浏览器中运行

详见该作者最近写的开源项目：[chromium-ray-tracing](https://github.com/maierfelix/chromium-ray-tracing)

（我目前没有运行成功，不建议使用该方法！）


2、在[这里](https://developer.nvidia.com/vulkan-driver)->Vulkan Beta Driver Downloads 下载并安装最新的Vulkan Driver（版本应该大于等于Windows 451.74），然后在你项目中安装webgpu的npm包：“yarn add webgpu@0.1.16”。这样就可以在nodejs中调用vulkan 1.2版本的Ray Tracing API了！！！（操作系统需要为win10！win7下会有问题！）


参考示例：[webgpu-examples](https://github.com/maierfelix/webgpu-examples)

使用方法： clone 项目，然后在项目根目录执行“npm install”，接着在项目根目录执行“node .\ray-tracing\index.mjs”运行光追示例。


注意：要在requestAdapter中指定preferredBackend为“Vulkan”（因为如果为D3D12，会有[bug](https://github.com/maierfelix/webgpu/issues/24)），相关代码为：


```
 let adapter = await GPU.requestAdapter({
 window,
 preferredBackend: "Vulkan"
 });

```

# 应用场景


考虑到WebGPU还没有正式发布，并且可能在三年内浏览器都不会支持Ray Tracing管线，所以我把渲染放到云端，这样就可以在云端自行搭建环境（如使用WebGPU Node开源项目），然后通过网络传输将渲染结果传输到客户端，从而在客户端浏览器不支持的情况下仍能显示光追渲染的画面。


因此，我的应用场景为：

1、云渲染

2、云游戏


这两个应用场景有不同的需求：

“云渲染”属于离线渲染，我们关心的是：


- 画质要好

- 渲染时间可以长点


因此：


- 每帧可采样多次，即n spp(n >= 30)

- 支持多种渲染效果，如“焦射”(causicts)等

- 全局光照可使用n次bounce（n >= 2）


“云游戏”属于实时渲染，我们关心的是：


- 画质可以差点

- 渲染时间要短（每帧30ms以内）


因此：


- 每帧只采样一次，即1 spp

- 全局光照只使用一次或两次bounce

- 对“焦射”(causicts)等场景用性能好的方案达到接近的渲染效果，通过牺牲画质来减少渲染时间


# 介绍我目前的实现方案


主要技术框架是“实时混合光线追踪”，主要包含下面的pass：

1、gbuffer pass

创建gbuffer

2、ray tracing pass

直接从gbuffer中获取world position、diffuse等数据，用来计算直接光照，从而减少了每个像素发射的光线数量；

每个像素发射1个shadow ray，用来计算直接光照的阴影；

如果只用1个bounce来计算全局光照的话，每个像素发射1个indirect ray+1个shadow ray，用来计算间接光照。

3、denoise pass

基于[BMFR算法](https://webpages.tuni.fi/foi/papers/Koskela-TOG-2019-Blockwise_Multi_Order_Feature_Regression_for_Real_Time_Path_Tracing_Reconstruction.pdf)来实现降噪，具体可参考本文后面的“实现降噪Denoise”部分。

4、taa pass

使用taa来抗锯齿


相关代码可见我的开源项目：

[WebGPU-RTX](https://github.com/yyc-git/WebGPU-RTX)


# 介绍我学习的整个流程，分享相关资料


## 了解光线追踪的相关领域


我通过下面的文章进行了初步的了解：

[一篇光线追踪的入门](https://zhuanlan.zhihu.com/p/41269520)

[光线追踪与实时渲染的未来](https://zhuanlan.zhihu.com/p/34851503)

[实时光线追踪技术：业界发展近况与未来挑战](https://zhuanlan.zhihu.com/p/102397700)

[Introduction to NVIDIA RTX and DirectX Ray Tracing](https://devblogs.nvidia.com/introduction-nvidia-rtx-directx-ray-tracing/)

[如何评价微软的 DXR（DirectX Raytracing）？](https://www.zhihu.com/question/269149582)


## 实现第一个光追的Demo


通过学习下面的资料：

[Ray Tracing in One Weekend](http://www.realtimerendering.com/raytracing/Ray%20Tracing%20in%20a%20Weekend.pdf)

[Ray Tracing: The Next Week](http://www.realtimerendering.com/raytracing/Ray%20Tracing_%20The%20Next%20Week.pdf)

[Ray Tracing in One Weekend和Ray Tracing: The Next Week的详解](https://www.cnblogs.com/lv-anchoret/category/1368696.html)

[基于OpenGL的GPU光线追踪](https://zhuanlan.zhihu.com/p/51387524)


我参考资料中的代码，用WebGL 2实现一个Demo：

![](https://img2020.cnblogs.com/blog/419321/202006/419321-20200627175159769-555922735.png)


该场景的红圈中是一个球，附近有一个球形光源和一个矩形光源


因为没有进行降噪，所以噪点太多了哈哈！


相关代码可见我的开源项目：

[Wonder-RayTrace](https://github.com/Wonder-Technology/Wonder-RayTrace)


## 学习和实现Ray Tracing管线


通过学习[NVIDIA Vulkan Ray Tracing Tutorial](https://nvpro-samples.github.io/vk_raytracing_tutorial_KHR/)教程，我用 js语言+[WebGPU Node](https://github.com/maierfelix/webgpu)开源项目 基于Ray Tracing管线依次实现了阴影、反射等基础渲染效果。


该教程使用了VK_KHR_ray_tracing扩展，而[WebGPU Node](https://github.com/maierfelix/webgpu)开源项目也使用了该扩展（Vulkan SDK），因此该教程的shader代码几乎可以直接用到该开源项目中。


[教程代码](https://github.com/nvpro-samples/vk_raytracing_tutorial_KHR)


## 用Reason重写


我用[Reason语言](https://reasonml.github.io/)重写了示例代码，提炼了一个基础架构。


## 学习GBuffer+Ray Tracing混合管线


因为我希望优先减少渲染时间，所以我要通过混合管线来进行实时渲染。


我通过[A Gentle Introduction To DirectX Raytracing](http://cwyman.org/code/dxrTutors/dxr_tutors.md.html)教程来学习和实现。


[教程代码下载](http://cwyman.org/code/dxrTutors.Code.zip)


我学习了该教程的第一篇到第11篇，分别实现了创建GBuffer、使用Lambertian材质渲染、多光源的阴影等内容。


## 实现降噪Denoise


教程的[第9篇](http://cwyman.org/code/dxrTutors/tutors/Tutor9/tutorial09.md.html)通过每个像素对每个光源发射一个shadow ray，最后累加并计算平均值，实现了多光源的阴影。


教程的[第11篇](http://cwyman.org/code/dxrTutors/tutors/Tutor11/tutorial11.md.html)对第9篇进行了改进：为了减少每个像素发射的shadow ray的数量，每个像素只随机向一个光源发射一个shadow ray。

这样会导致噪点，如下图所示：

![](https://img2020.cnblogs.com/blog/419321/202006/419321-20200627180211593-1135305863.png)


我们可以通过累计采样数来不断逼近无噪点的图片（如该教程的[第6篇](http://cwyman.org/code/dxrTutors/tutors/Tutor6/tutorial06.md.html)一样），但这样需要经过长时间后才会收敛，所以只适合“云渲染”这种离线渲染的应用场景。


累加一定帧数后，结果如下图所示：

![](https://img2020.cnblogs.com/blog/419321/202006/419321-20200627180852746-1953908106.png)


### 实现taa


降噪算法通常需要先实现“帧间的数据复用”，而TAA抗锯齿也需要实现“帧间数据复用”的技术；而且降噪算法会使用TAA作为最后一个pass来抗锯齿。所以我决定先实现taa，将其作为实现降噪算法的铺垫。


我参考了下面的资料来实现taa：

[DX12渲染管线(2) - 时间性抗锯齿(TAA)](https://zhuanlan.zhihu.com/p/64993622)、 [相关代码](https://github.com/MrySwk/GravityEngine/blob/master/GEngine/GDxRenderer/Shaders/TaaPassPS.hlsl)

[Unity Temporal AA的改进与提高](https://zhuanlan.zhihu.com/p/46841906)、 [相关代码](https://github.com/Hengle/Unity-GPU-Driven-Pipeline/blob/master/Assets/PostProcessing/Shaders/Builtins/TemporalAntialiasing.shader)

[unit Temporal Anti-Aliasing](https://liangz0707.github.io/whoimi/blogs/RTR/TAA.html)


### 实现BMFR降噪算法


为了能应用于“云游戏”这种实时渲染的应用场景，我们需要快速降噪。因此我实现了BMFR算法来降噪。


降噪前场景：

![](https://img2020.cnblogs.com/blog/419321/202006/419321-20200627181019015-1268635518.png)


降噪后场景：

![](https://img2020.cnblogs.com/blog/419321/202006/419321-20200627181026025-937868782.png)


我参考了下面的资料：

[BLOCKWISE MULTI-ORDER FEATURE REGRESSION FOR REAL-TIME PATH TRACING RECONSTRUCTION](https://webpages.tuni.fi/foi/papers/Koskela-TOG-2019-Blockwise_Multi_Order_Feature_Regression_for_Real_Time_Path_Tracing_Reconstruction.pdf)

[参考代码](https://github.com/gztong/BMFR-DXR-Denoiser)


## 学习蒙特卡罗积分（monte carlo）的理论


教程的[第11篇](http://cwyman.org/code/dxrTutors/tutors/Tutor11/tutorial11.md.html)随机向一个光源发射一个shadow ray，这其实已经使用了蒙特卡罗积分的理论。


我们可以通过下面的资料深入学习该理论，了解概率密度函数（pdf）、重要性采样等相关概念，为我们后面实现全局光照打下理论基础：

[【RAY TRACING THE REST OF YOUR LIFE 超详解】 光线追踪 3-1 蒙特卡罗 (一)](https://www.cnblogs.com/lv-anchoret/p/10327692.html) 到 [【RAY TRACING THE REST OF YOUR LIFE 超详解】 光线追踪 3-7 混合概率密](https://www.cnblogs.com/lv-anchoret/p/10604712.html)

[光线追踪器Ray Tracer：进阶篇](https://yangwc.com/2019/05/23/RayTracer-Advance/)


## 实现全局光照


通过学习教程的[第12篇](http://cwyman.org/code/dxrTutors/tutors/Tutor12/tutorial12.md.html)，我实现了one bounce的全局光照。


更多参考资料：

[Global Illumination and Path Tracing](https://www.scratchapixel.com/lessons/3d-basic-rendering/global-illumination-path-tracing)

[Global Illumination and Monte Carlo](https://ocw.mit.edu/courses/electrical-engineering-and-computer-science/6-837-computer-graphics-fall-2012/lecture-notes/MIT6_837F12_Lec18.pdf)


这里我遇到的问题主要是处理indirect specular noise：噪点不稳定，导致降噪后不稳定（高光周围有明显波动）。

我首先以为是pdf写错了，结果修改了pdf后还是没有改进；

然后希望通过clamp等方法移除这些高光的fireflies噪点，结果影响到了画质；

最后采用了“采样indirect specular/diffuse多次”来稳定噪点。这适用于“云渲染”的离线渲染，但不适用于“云游戏”的实时渲染。


## 基于GGX模型，实现disney BRDF


通过学习教程的[第14篇](http://cwyman.org/code/dxrTutors/tutors/Tutor14/tutorial14.md.html)，我引入了pbr材质，实现了GGX模型，加入了多bounce的全局光照。


我对教程代码进行了改进：

在.rgen着色器中使用for循环而不是递归来实现的多bounce；

实现了disney BRDF，在pbr材质中有diffuse、roughness、metallic、specular这几个参数。


更多参考资料：

[基于物理着色（二）- Microfacet材质和多层材质](https://zhuanlan.zhihu.com/p/20119162)

[基于物理着色（三）- Disney和UE4的实现](https://zhuanlan.zhihu.com/p/20122884)

[基于物理的渲染（PBR）白皮书 | 迪士尼原则的BRDF与BSDF相关总结](https://zhuanlan.51cto.com/art/201904/594881.htm)

[WebGPU-Path-Tracer](https://github.com/maierfelix/WebGPU-Path-Tracer) 实现了disney BRDF


## 目前的渲染效果


![](https://img2020.cnblogs.com/blog/419321/202006/419321-20200627181756867-1335598038.png)


# 我目前的实现需要改进的地方


## 在Ray Tracing pass中支持纹理


使用bindless texture或者virtual texture来实现


## 扩展disney BRDF，实现BSDF，支持透明、折射效果


## 增加后处理


如gamma矫正等


## 在云端环境下多线程渲染


云端天然具有并行的优势，因此可将渲染任务分配到多个显卡/服务器中执行。


## 改进降噪效果


BMFR对高光specular处理得不好。

为了应用在“云渲染”中，需要提高画质。因此可考虑：


- 改进BMFR对specular的处理

BMFR论文中已有相关的讨论

- 使用专门对多个spp采样进行降噪的降噪器来替代BMFR

因为BMFR主要是针对1 spp采样，所以需要使用针对蒙托卡罗积分路径追踪的降噪器来替代


## 改进indirect specular/diffuse noise


现在我通过增加spp来增加噪点的稳定性，这在“云游戏”中行不通，因为只能有1 spp。因此可考虑：


- 使用blue noise

可参考： [http://psgraphics.blogspot.com/2018/10/flavors-of-sampling-in-ray-tracing.html](http://psgraphics.blogspot.com/2018/10/flavors-of-sampling-in-ray-tracing.html)

[https://hal.archives-ouvertes.fr/hal-02158423/file/blueNoiseTemporal2019_slides.pdf](https://hal.archives-ouvertes.fr/hal-02158423/file/blueNoiseTemporal2019_slides.pdf)

[https://belcour.github.io/blog/research/2019/06/18/animation-bluenoise.html](https://belcour.github.io/blog/research/2019/06/18/animation-bluenoise.html)

[https://zhuanlan.zhihu.com/p/90017623](https://zhuanlan.zhihu.com/p/90017623)

- 对GGX模型使用VNDF来代替NDF采样

- 对多bounce的indirect specular noise进行优化

可能的解决方案:

使用reflection denoise filter;

adaptive multiple bounce;

- 使用photon mapping来降低噪点