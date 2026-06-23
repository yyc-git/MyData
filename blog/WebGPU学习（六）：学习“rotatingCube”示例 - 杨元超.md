# WebGPU学习（六）：学习“rotatingCube”示例 - 杨元超

> 日期: 2019-12-22 14:27
> 源: https://www.cnblogs.com/chaogex/p/12079739.html

大家好，本文学习Chrome->webgpu-samplers->rotatingCube示例。


上一篇博文：

[WebGPU学习（五）: 现代图形API技术要点和WebGPU支持情况调研](https://www.cnblogs.com/chaogex/p/12041286.html)


下一篇博文：

[WebGPU学习（七）：学习“twoCubes”和“instancedCube”示例](https://www.cnblogs.com/chaogex/p/12081022.html)


# 学习rotatingCube.ts


我们已经学习了[“绘制三角形”](https://www.cnblogs.com/chaogex/p/11993144.html)的示例，与它相比，本示例增加了以下的内容：


- 增加一个uniform buffer object（简称为ubo），用于传输“model矩阵 乘以 view矩阵 乘以 projection矩阵”的结果矩阵（简称为mvp矩阵），并在每帧被更新

- 设置顶点

- 开启面剔除

- 开启深度测试


下面，我们打开[rotatingCube.ts](https://github.com/yyc-git/webgpu-samples/blob/master/src/examples/rotatingCube.ts)文件，依次来看下新增内容：


## 增加一个uniform buffer object


### 介绍


在WebGL 1中，我们通过uniform1i,uniform4fv等函数传递每个gameObject对应的uniform变量（如diffuseMap, diffuse color, model matrix等）到shader中。

其中很多相同的值是不需要被传递的，举例如下：

如果gameObject1和gameObject3使用同一个shader1，它们的diffuse color相同，那么只需要传递其中的一个diffuse color，而在WebGL 1中我们一般把这两个diffuse color都传递了，造成了重复的开销。


WebGPU使用uniform buffer object来传递uniform变量。uniform buffer是一个全局的buffer，我们只需要设置一次值，然后在每次draw之前，设置使用的数据范围（通过offset, size来设置），从而复用相同的数据。如果uniform值有变化，则只需要修改uniform buffer对应的数据。


在WebGPU中，我们可以把所有gameObject的model矩阵设为一个ubo，所有相机的view和projection矩阵设为一个ubo，每一种material（如phong material，pbr material等）的数据（如diffuse color，specular color等）设为一个ubo，每一种light（如direction light、point light等）的数据（如light color、light position等）设为一个ubo，这样可以有效减少uniform变量的传输开销。


另外，我们需要注意ubo的内存布局：

默认的布局为std140，我们可以粗略地理解为，它约定了每一列都有4个元素。

我们来举例说明：

下面的ubo对应的uniform block，定义布局为std140：


```
layout (std140) uniform ExampleBlock
{
 float value;
 vec3 vector;
 mat4 matrix;
 float values[3];
 bool boolean;
 int integer;
};

```

它在内存中的实际布局为：


```
layout (std140) uniform ExampleBlock
{
 // base alignment // aligned offset
 float value; // 4 // 0 
 vec3 vector; // 16 // 16 (must be multiple of 16 so 4->16)
 mat4 matrix; // 16 // 32 (column 0)
 // 16 // 48 (column 1)
 // 16 // 64 (column 2)
 // 16 // 80 (column 3)
 float values[3]; // 16 // 96 (values[0])
 // 16 // 112 (values[1])
 // 16 // 128 (values[2])
 bool boolean; // 4 // 144
 int integer; // 4 // 148
};

```

也就是说，这个ubo的第一个元素为value，第2-4个元素为0（为了对齐）；

第5-7个元素为vector的x、y、z的值，第8个元素为0；

第9-24个元素为matrix的值（列优先）；

第25-27个元素为values数组的值，第28个元素为0；

第29个元素为boolean转为float的值，第30-32个元素为0；

第33个元素为integer转为float的值，第34-36个元素为0。


### 分析本示例对应的代码


- 在vertex shader中定义uniform block


代码如下：


```
 const vertexShaderGLSL = `#version 450
 layout(set = 0, binding = 0) uniform Uniforms {
 mat4 modelViewProjectionMatrix;
 } uniforms;
 ...
 void main() {
 gl_Position = uniforms.modelViewProjectionMatrix * position;
 fragColor = color;
 }
 `;

```

布局为默认的std140，指定了set和binding，包含一个mvp矩阵

其中set和binding用来对应相应的数据，会在后面说明


- 创建uniformsBindGroupLayout


代码如下：


```
 const uniformsBindGroupLayout = device.createBindGroupLayout({
 bindings: [{
 binding: 0,
 visibility: 1,
 type: "uniform-buffer"
 }]
 });

```

binding对应vertex shader中uniform block的binding，意思是bindings数组的第一个元素的对应binding为0的uniform block


visibility为GPUShaderStage.VERTEX（等于1），指定type为“uniform-buffer”


- 创建uniform buffer


代码如下：


```
 const uniformBufferSize = 4 * 16; // BYTES_PER_ELEMENT(4) * matrix length(4 * 4 = 16)

 const uniformBuffer = device.createBuffer({
 size: uniformBufferSize,
 usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
 });

```


- 创建uniform bind group


代码如下：


```
 const uniformBindGroup = device.createBindGroup({
 layout: uniformsBindGroupLayout,
 bindings: [{
 binding: 0,
 resource: {
 buffer: uniformBuffer,
 },
 }],
 });

```

binding对应vertex shader中uniform block的binding，意思是bindings数组的第一个元素的对应binding为0的uniform block


- 每一帧更新uniform buffer的mvp矩阵数据


代码如下：


```
 //因为是固定相机，所以只需要计算一次projection矩阵
 const aspect = Math.abs(canvas.width / canvas.height);
 let projectionMatrix = mat4.create();
 mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, aspect, 1, 100.0);
 
 ...
 
 
 //计算mvp矩阵
 function getTransformationMatrix() {
 let viewMatrix = mat4.create();
 mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(0, 0, -5));
 let now = Date.now() / 1000;
 mat4.rotate(viewMatrix, viewMatrix, 1, vec3.fromValues(Math.sin(now), Math.cos(now), 0));

 let modelViewProjectionMatrix = mat4.create();
 mat4.multiply(modelViewProjectionMatrix, projectionMatrix, viewMatrix);

 return modelViewProjectionMatrix;
 }
 
 ...
 return function frame() {
 //使用setSubData更新uniform buffer，后面分析
 uniformBuffer.setSubData(0, getTransformationMatrix());
 ...
 }

```


- draw之前设置bind group


代码如下：


```
 return function frame() {
 ...
 //“0”对应vertex shader中uniform block的“set = 0”
 passEncoder.setBindGroup(0, uniformBindGroup);
 passEncoder.draw(36, 1, 0, 0);
 ...
 }

```

### 详细分析“更新uniform buffer”


本示例使用setSubData来更新uniform buffer：


```
 return function frame() {
 uniformBuffer.setSubData(0, getTransformationMatrix());
 ...
 }

```

我们在[WebGPU学习（五）: 现代图形API技术要点和WebGPU支持情况调研](https://zhuanlan.zhihu.com/p/97410952)->Approaching zero driver overhead->persistent map buffer中，提到了WebGPU目前有两种方法实现“CPU把数据传输到GPU“，即更新GPUBuffer的值：

1.调用GPUBuffer->setSubData方法

2.使用persistent map buffer技术


这里使用了第1种方法。

我们看下如何在本示例中使用第2种方法：


```
function setBufferDataByPersistentMapBuffer(device, commandEncoder, uniformBufferSize, uniformBuffer, mvpMatricesData) {
 const [srcBuffer, arrayBuffer] = device.createBufferMapped({
 size: uniformBufferSize,
 usage: GPUBufferUsage.COPY_SRC
 });

 new Float32Array(arrayBuffer).set(mvpMatricesData);
 srcBuffer.unmap();

 commandEncoder.copyBufferToBuffer(srcBuffer, 0, uniformBuffer, 0, uniformBufferSize);
 const commandBuffer = commandEncoder.finish();

 const queue = device.defaultQueue;
 queue.submit([commandBuffer]);

 srcBuffer.destroy();
}

return function frame() {
 //uniformBuffer.setSubData(0, getTransformationMatrix());
 ...

 const commandEncoder = device.createCommandEncoder({});

 setBufferDataByPersistentMapBuffer(device, commandEncoder, uniformBufferSize, uniformBuffer, getTransformationMatrix());
 ...
}

```

为了验证性能，我做了[benchmark测试](https://github.com/yyc-git/WebGPU-Sample/blob/master/benchmark/benchmark_persistent_map_buffer.html)，创建一个包含160000个mat4的ubo，使用这2种方法来更新uniform buffer，比较它们的js profile：


使用setSubData(调用setBufferDataBySetSubData函数):

![截屏2019-12-22上午10.09.43.png-38.6kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227102604861-1250623789.png)


setSubData占91.54%


使用persistent map buffer(调用setBufferDataByPersistentMapBuffer函数):

![截屏2019-12-22上午10.09.50.png-52.9kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227102607958-364776610.png)


createBufferMapped和setBufferDataByPersistentMapBuffer占72.72+18.06=90.78%


可以看到两个的性能差不多。但考虑到persistent map buffer从实现原理上要更快（cpu和gpu共用一个buffer，不需要copy），因此应该优先使用该方法。


另外，WebGPU社区现在还在讨论如何优化更新buffer数据（如有人提出增加GPUUploadBuffer pass），因此我们还需要继续关注该方面的进展。


### 参考资料


[Advanced-GLSL](https://learnopengl.com/Advanced-OpenGL/Advanced-GLSL)->Uniform buffer objects


## 设置顶点


- 传输顶点的position和color数据到vertex shader的attribute（在glsl 4.5中用“in”表示attribute）中


代码如下：


```
 const vertexShaderGLSL = `#version 450
 ...
 layout(location = 0) in vec4 position;
 layout(location = 1) in vec4 color;
 layout(location = 0) out vec4 fragColor;
 void main() {
 gl_Position = uniforms.modelViewProjectionMatrix * position;
 fragColor = color;
 }
 
 const fragmentShaderGLSL = `#version 450
 layout(location = 0) in vec4 fragColor;
 layout(location = 0) out vec4 outColor;
 void main() {
 outColor = fragColor;
 }
 `;

```

在vertex shader中设置color为fragColor（在glsl 4.5中用“out”表示WebGL 1的varying变量），然后在fragment shader中接收fragColor，将其设置为outColor，从而将fragment的color设置为对应顶点的color


- 创建vertices buffer，设置立方体的顶点数据


代码如下：


```
cube.ts:

//每个顶点包含position,color,uv数据
//本示例没用到uv数据
export const cubeVertexArray = new Float32Array([
 // float4 position, float4 color, float2 uv,
 1, -1, 1, 1, 1, 0, 1, 1, 1, 1,
 -1, -1, 1, 1, 0, 0, 1, 1, 0, 1,
 -1, -1, -1, 1, 0, 0, 0, 1, 0, 0,
 1, -1, -1, 1, 1, 0, 0, 1, 1, 0,
 1, -1, 1, 1, 1, 0, 1, 1, 1, 1,
 -1, -1, -1, 1, 0, 0, 0, 1, 0, 0,

 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
 1, -1, 1, 1, 1, 0, 1, 1, 0, 1,
 1, -1, -1, 1, 1, 0, 0, 1, 0, 0,
 1, 1, -1, 1, 1, 1, 0, 1, 1, 0,
 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
 1, -1, -1, 1, 1, 0, 0, 1, 0, 0,

 -1, 1, 1, 1, 0, 1, 1, 1, 1, 1,
 1, 1, 1, 1, 1, 1, 1, 1, 0, 1,
 1, 1, -1, 1, 1, 1, 0, 1, 0, 0,
 -1, 1, -1, 1, 0, 1, 0, 1, 1, 0,
 -1, 1, 1, 1, 0, 1, 1, 1, 1, 1,
 1, 1, -1, 1, 1, 1, 0, 1, 0, 0,

 -1, -1, 1, 1, 0, 0, 1, 1, 1, 1,
 -1, 1, 1, 1, 0, 1, 1, 1, 0, 1,
 -1, 1, -1, 1, 0, 1, 0, 1, 0, 0,
 -1, -1, -1, 1, 0, 0, 0, 1, 1, 0,
 -1, -1, 1, 1, 0, 0, 1, 1, 1, 1,
 -1, 1, -1, 1, 0, 1, 0, 1, 0, 0,

 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
 -1, 1, 1, 1, 0, 1, 1, 1, 0, 1,
 -1, -1, 1, 1, 0, 0, 1, 1, 0, 0,
 -1, -1, 1, 1, 0, 0, 1, 1, 0, 0,
 1, -1, 1, 1, 1, 0, 1, 1, 1, 0,
 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,

 1, -1, -1, 1, 1, 0, 0, 1, 1, 1,
 -1, -1, -1, 1, 0, 0, 0, 1, 0, 1,
 -1, 1, -1, 1, 0, 1, 0, 1, 0, 0,
 1, 1, -1, 1, 1, 1, 0, 1, 1, 0,
 1, -1, -1, 1, 1, 0, 0, 1, 1, 1,
 -1, 1, -1, 1, 0, 1, 0, 1, 0, 0,
]);

```

```
rotatingCube.ts:

 const verticesBuffer = device.createBuffer({
 size: cubeVertexArray.byteLength,
 usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
 });
 verticesBuffer.setSubData(0, cubeVertexArray);

```

因为只需要设置一次顶点数据，所以这里可以使用setSubData来设置GPUBuffer的数据，对性能影响不大


- 创建render pipeline时，指定vertex shader的attribute


代码如下：


```
cube.ts:

export const cubeVertexSize = 4 * 10; // Byte size of one cube vertex.
export const cubePositionOffset = 0;
export const cubeColorOffset = 4 * 4; // Byte offset of cube vertex color attribute.

```

```
rotatingCube.ts:

 const pipeline = device.createRenderPipeline({
 ...
 vertexState: {
 vertexBuffers: [{
 arrayStride: cubeVertexSize,
 attributes: [{
 // position
 shaderLocation: 0,
 offset: cubePositionOffset,
 format: "float4"
 }, {
 // color
 shaderLocation: 1,
 offset: cubeColorOffset,
 format: "float4"
 }]
 }],
 },
 ...
 });

```


- render pass->draw指定顶点个数为36


代码如下：


```
 return function frame() {
 ...
 const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
 ...
 passEncoder.draw(36, 1, 0, 0);
 passEncoder.endPass();
 ...
 }

```

## 开启面剔除


相关代码为：


```
 const pipeline = device.createRenderPipeline({
 ...
 rasterizationState: {
 cullMode: 'back',
 },
 ...
 });

```

相关的定义为：


```
enum GPUFrontFace {
 "ccw",
 "cw"
};
enum GPUCullMode {
 "none",
 "front",
 "back"
};
...

dictionary GPURasterizationStateDescriptor {
 GPUFrontFace frontFace = "ccw";
 GPUCullMode cullMode = "none";
 ...
};

```

其中ccw表示逆时针，cw表示顺时针；frontFace用来设置哪个方向是“front”（正面）；cullMode用来设置将哪一面剔除掉。


因为本示例没有设置frontFace，因此frontFace为默认的ccw，即将顶点连接的逆时针方向设置为正面；

又因为本示例设置了cullMode为back，那么反面的顶点（即顺时针连接的顶点）会被剔除掉。


### 参考资料


[[WebGL入门]六，顶点和多边形](https://blog.csdn.net/lufy_legend/article/details/38326955)

[Investigation: Rasterization State](https://github.com/gpuweb/gpuweb/issues/137)


## 开启深度测试


现在分析相关代码，忽略与模版测试相关的代码：


- 创建render pipeline时，设置depthStencilState


代码如下：


```
 const pipeline = device.createRenderPipeline({
 ...
 depthStencilState: {
 //开启深度测试
 depthWriteEnabled: true,
 //设置比较函数为less，后面会说明 
 depthCompare: "less",
 //设置depth为24bit
 format: "depth24plus-stencil8",
 },
 ...
 });

```


- 创建depth texture（注意它的size->depth为1），将它的view设置为render pass -> depthStencilAttachment -> attachment


代码如下：


```
 const depthTexture = device.createTexture({
 size: {
 width: canvas.width,
 height: canvas.height,
 depth: 1
 },
 format: "depth24plus-stencil8",
 usage: GPUTextureUsage.OUTPUT_ATTACHMENT
 });

 const renderPassDescriptor: GPURenderPassDescriptor = {
 ...
 depthStencilAttachment: {
 attachment: depthTexture.createView(),

 depthLoadValue: 1.0,
 depthStoreOp: "store",
 ...
 }
 };

```

其中，depthStencilAttachment的定义为：


```
dictionary GPURenderPassDepthStencilAttachmentDescriptor {
 required GPUTextureView attachment;

 required (GPULoadOp or float) depthLoadValue;
 required GPUStoreOp depthStoreOp;
 ...
};

```

depthLoadValue和depthStoreOp与[WebGPU学习（二）: 学习“绘制一个三角形”示例](https://zhuanlan.zhihu.com/p/95650126)->分析render pass->colorAttachment的loadOp和StoreOp类似，我们来看下相关的代码：


```

 const pipeline = device.createRenderPipeline({
 ...
 depthStencilState: {
 ...
 depthCompare: "less",
 ...
 },
 ...
 });
 
 ...

 const renderPassDescriptor: GPURenderPassDescriptor = {
 ...
 depthStencilAttachment: {
 ...
 depthLoadValue: 1.0,
 depthStoreOp: "store",
 ...
 }
 };

```

在深度测试时，gpu会将fragment的z值（范围为[0.0-1.0]）与这里设置的depthLoadValue值（这里为1.0）比较。其中使用depthCompare定义的函数（这里为less，意思是所有z值大于等于1.0的fragment会被剔除）进行比较。


### 参考资料


[Depth testing](https://learnopengl.com/Advanced-OpenGL/Depth-testing)


## 最终渲染结果


![截屏2019-12-22下午12.01.20.png-54.8kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227102611409-737142405.png)


# 参考资料


[WebGPU规范](https://gpuweb.github.io/gpuweb/)

[webgpu-samplers Github Repo](https://github.com/yyc-git/webgpu-samples)

[WebGPU-5](https://blog.csdn.net/caxieyou/article/details/94644924)