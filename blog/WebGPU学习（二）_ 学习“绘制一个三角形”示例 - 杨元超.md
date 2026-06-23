# WebGPU学习（二）: 学习“绘制一个三角形”示例 - 杨元超

> 日期: 2019-12-06 08:34
> 源: https://www.cnblogs.com/chaogex/p/11993144.html

大家好，本文学习Chrome->webgpu-samplers->helloTriangle示例。


上一篇博文：

[WebGPU学习（一）: 开篇](https://www.cnblogs.com/chaogex/p/11986568.html)


下一篇博文：

[WebGPU学习（三）:MSAA](https://www.cnblogs.com/chaogex/p/12003722.html)


# 准备Sample代码


克隆[webgpu-samplers Github Repo](https://github.com/yyc-git/webgpu-samples)到本地。

（备注：当前的version为0.0.2）


实际的sample代码在src/examples/文件夹中，是typescript代码写的：

![截屏2019-12-04下午3.53.16.png-64.7kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227101722719-92855320.png)


# 学习helloTriangle.ts


打开helloTriangle.ts文件，我们来看下init函数的内容。


## 首先是shader代码


```
 const vertexShaderGLSL = `#version 450
 const vec2 pos[3] = vec2[3](vec2(0.0f, 0.5f), vec2(-0.5f, -0.5f), vec2(0.5f, -0.5f));

 void main() {
 gl_Position = vec4(pos[gl_VertexIndex], 0.0, 1.0);
 }
 `;

 const fragmentShaderGLSL = `#version 450
 layout(location = 0) out vec4 outColor;

 void main() {
 outColor = vec4(1.0, 0.0, 0.0, 1.0);
 }
 `;

```

这里是vertex shader和fragment shader的glsl代码。


（webgpu支持vertex shader、fragment shader、compute shader，这里只使用了前面两个）


“#version 450”声明了glsl版本为4.5（它要放在glsl的第一行）


第2行定义了三角形的三个顶点坐标，使用2维数组保存（每个元素为vec2类型）。因为都在一个平面，所以顶点只定义了x、y坐标（顶点的z为0.0）


第5行的gl_VertexIndex为顶点序号，每次执行时值依次为0、1、2（vertex shader被执行了3次，因为只有3个顶点）（具体见本文末尾对draw的分析）


第9行是fragment shader，因为三角形为一个颜色，所以所有片段的颜色为同一个固定值


## 然后我们继续看下面的代码


```
 const adapter = await navigator.gpu.requestAdapter();
 const device = await adapter.requestDevice();
 // 准备编译glsl的库
 const glslang = await glslangModule();
 // 获得webgpu上下文
 const context = canvas.getContext('gpupresent');

```

第4行的glslangModule是import的第三方库：


```
import glslangModule from '../glslang';

```

## 继续往下看


```
 // 定义swapbuffer的格式为RGBA8位的无符号归一化格式
 const swapChainFormat = "bgra8unorm";

 // @ts-ignore:
 const swapChain: GPUSwapChain = context.configureSwapChain({
 device,
 format: swapChainFormat,
 });

```

@ts-ignore是typescript用来忽略错误的。因为context的类型是RenderingContext，它没有定义configureSwapChain函数，如果编译该行typescript会报错，所以需要忽略错误。


第5行配置了swap chain。[vulkan tutorial](https://vulkan-tutorial.com/Drawing_a_triangle/Presentation/Swap_chain)对此进行了说明：

swap chain是一个缓冲结构，webgpu会先将内容渲染到swap chain的buffer中，然后再将其显示到屏幕上；

swap chain本质上是等待呈现在屏幕上的一个图片队列。


## 接下来就是创建render pipeline


```
 const pipeline = device.createRenderPipeline({
 layout: device.createPipelineLayout({ bindGroupLayouts: [] }),

 vertexStage: {
 module: device.createShaderModule({
 code: glslang.compileGLSL(vertexShaderGLSL, "vertex"),

 // @ts-ignore
 source: vertexShaderGLSL,
 transform: source => glslang.compileGLSL(source, "vertex"),
 }),
 entryPoint: "main"
 },
 fragmentStage: {
 module: device.createShaderModule({
 code: glslang.compileGLSL(fragmentShaderGLSL, "fragment"),

 // @ts-ignore
 source: fragmentShaderGLSL,
 transform: source => glslang.compileGLSL(source, "fragment"),
 }),
 entryPoint: "main"
 },

 primitiveTopology: "triangle-list",

 colorStates: [{
 format: swapChainFormat,
 }],
 });

```

### 了解pipeline


WebGPU有两种pipeline:render pipeline和compute pipeline，这里只用了render pipeline


这里使用render pipeline descriptor来创建render pipeline，它的定义如下：


```
dictionary GPUPipelineDescriptorBase : GPUObjectDescriptorBase {
 required GPUPipelineLayout layout;
};

...

dictionary GPURenderPipelineDescriptor : GPUPipelineDescriptorBase {
 required GPUProgrammableStageDescriptor vertexStage;
 GPUProgrammableStageDescriptor fragmentStage;

 required GPUPrimitiveTopology primitiveTopology;
 GPURasterizationStateDescriptor rasterizationState = {};
 required sequence colorStates;
 GPUDepthStencilStateDescriptor depthStencilState;
 GPUVertexStateDescriptor vertexState = {};

 unsigned long sampleCount = 1;
 unsigned long sampleMask = 0xFFFFFFFF;
 boolean alphaToCoverageEnabled = false;
 // TODO: other properties
};

```

render pipeline可以设置绑定的资源布局、编译的shader、fixed functions（如混合、深度、模版、cullMode等各种状态和顶点数据的格式vertexState），相对于WebGL（WebGL的一个API只能设置一个，如使用gl.cullFace设置cull mode），提升了性能（静态设置了各种状态，不需要在运行时设置），便于管理（把各个状态集中到了一起设置）。


### 分析render pipeline descriptor


vertexStage和fragmentStage分别设置vertex shader和fragment shader：

使用第三方库，将glsl编译为字节码（格式为SPIR-V）；

source和transform字段是多余的，可以删除。


因为shader没有绑定资源（如uniform buffer, texture等），所以第2行的bindGroupLayouts为空数组，不需要bind group和bind group layout


第25行的primitiveTopology指定片元的拓扑结构，此处为三角形。

它可以为以下值：


```
enum GPUPrimitiveTopology {
 "point-list",
 "line-list",
 "line-strip",
 "triangle-list",
 "triangle-strip"
};

```

现在先忽略colorStates


## 我们继续分析后面的代码，接下来定义了frame函数


frame函数定义了每帧执行的逻辑：


```
 function frame() {
 const commandEncoder = device.createCommandEncoder({});
 const textureView = swapChain.getCurrentTexture().createView();

 const renderPassDescriptor: GPURenderPassDescriptor = {
 colorAttachments: [{
 attachment: textureView,
 loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
 }],
 };

 const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
 passEncoder.setPipeline(pipeline);
 passEncoder.draw(3, 1, 0, 0);
 passEncoder.endPass();

 device.defaultQueue.submit([commandEncoder.finish()]);
 }

 return frame;

```

### 学习command buffer


我们不能直接操作command buffer，需要创建command encoder，使用它将多个commands（如render pass的draw）设置到一个command buffer中，然后执行submit，把command buffer提交到gpu driver的队列中。


根据 webgpu设计文档->[Command Submission](https://github.com/gpuweb/gpuweb/blob/master/design/CommandSubmission.md):


> Command buffers carry sequences of user commands on the CPU side. They can be recorded independently of the work done on GPU, or each other. They go through the following stages:

> creation -> "recording" -> "ready" -> "executing" -> done


我们知道，command buffer有

creation, recording,ready,executing,done五种状态。


根据该文档，结合代码来分析command buffer的操作流程：

第2行创建command encoder时，应该是创建了command buffer，它的状态为creation；

第12行开始render pass（webgpu还支持compute pass，不过这里没用到），command buffer的状态变为recording；

13-14行将“设置pipeline”、“绘制”的commands设置到command buffer中；

第15行结束render pass，(可以设置下一个pass，如compute pass，不过这里只用了一个pass）；

第17行“commandEncoder.finish()”将command buffer的状态变为ready；

然后执行subimit，command buffer状态变为executing，被提交到gpu driver的队列中，不能再在cpu端被操作；

如果提交成功，gpu会决定在某个时间处理它。


### 分析render pass


第5行的renderPassDescriptor描述了render pass，它的定义为：


```
dictionary GPURenderPassDescriptor : GPUObjectDescriptorBase {
 required sequence colorAttachments;
 GPURenderPassDepthStencilAttachmentDescriptor depthStencilAttachment;
};

```

这里只用到了colorAttachments。它类似于WebGL->framebuffer的colorAttachments。这里只用到了一个color buffer attachment。


我们来看下colorAttachment的定义：


```
dictionary GPURenderPassColorAttachmentDescriptor {
 required GPUTextureView attachment;
 GPUTextureView resolveTarget;

 required (GPULoadOp or GPUColor) loadValue;
 GPUStoreOp storeOp = "store";
};

```

这里设置attachment，将其与swap chain关联：


```
 attachment: textureView,

```

我们现在忽略resolveTarget。


loadValue和storeOp决定渲染前和渲染后怎样处理attachment中的数据。

我们看下它的类型：


```
enum GPULoadOp {
 "load"
};
enum GPUStoreOp {
 "store",
 "clear"
};

...
dictionary GPUColorDict {
 required double r;
 required double g;
 required double b;
 required double a;
};
typedef (sequence or GPUColorDict) GPUColor;

```

loadValue如果为GPULoadOp类型，则只有一个值：“load”，它的意思是渲染前保留attachment中的数据；

如果为GPUColor类型（如这里的{ r: 0.0, g: 0.0, b: 0.0, a: 1.0 }），则不仅为"load"，而且设置了渲染前的初始值，类似于WebGL的clearColor。


storeOp如果为“store”，意思是渲染后保存被渲染的内容到内存中，后面可以被读取；

如果为“clear”，意思是渲染后清空内容。


现在我们回头看下render pipeline中的colorStates：


```
 colorStates: [{
 format: swapChainFormat,
 }],

```

colorStates与colorAttachments对应，也只有一个，它的format应该与swap chain的format相同


我们继续看render pass代码:


```
 const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
 passEncoder.setPipeline(pipeline);
 passEncoder.draw(3, 1, 0, 0);
 passEncoder.endPass();

```

draw的定义为：


```
void draw(unsigned long vertexCount, unsigned long instanceCount,
 unsigned long firstVertex, unsigned long firstInstance);

```

三角形有3个顶点，这里只绘制1个实例，两者都从0开始（所以vertex shader中的gl_VertexIndex依次为0、1、2），所以第3行为“draw(3, 1, 0, 0)”


## 最终渲染结果


![截屏2019-12-04下午9.53.50.png-8kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227101725937-1226681895.png)


# 参考资料


[webgpu-samplers Github Repo](https://github.com/yyc-git/webgpu-samples)

[vulkan tutorial](https://vulkan-tutorial.com/Introduction)

[webgpu设计文档->Command Submission](https://github.com/gpuweb/gpuweb/blob/master/design/CommandSubmission.md)

[WebGPU-4](https://blog.csdn.net/caxieyou/article/details/94631287)