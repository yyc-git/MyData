# WebGPU学习（八）：学习“texturedCube”示例 - 杨元超

> 日期: 2019-12-24 14:57
> 源: https://www.cnblogs.com/chaogex/p/12091529.html

大家好，本文学习Chrome->webgpu-samplers->texturedCube示例。


上一篇博文：

[WebGPU学习（七）：学习“twoCubes”和“instancedCube”示例](https://www.cnblogs.com/chaogex/p/12081022.html)


下一篇博文：

[WebGPU学习（九）：学习“fractalCube”示例](https://www.cnblogs.com/chaogex/p/12097129.html)


# 学习texturedCube.ts


最终渲染结果：

![截屏2019-12-23上午8.11.40.png-117.2kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227102838216-2048813412.png)


该示例绘制了有一个纹理的立方体。


与“rotatingCube”示例相比，该示例增加了下面的步骤：


- 传输顶点的uv数据

- 增加了sampler和sampled-texture类型的uniform数据


下面，我们打开[texturedCube.ts](https://github.com/yyc-git/webgpu-samples/blob/master/src/examples/texturedCube.ts)文件，依次分析增加的步骤：


## 传递顶点的uv数据


- shader加入uv attribute


代码如下：


```
 const vertexShaderGLSL = `#version 450
 ...
 layout(location = 0) in vec4 position;
 layout(location = 1) in vec2 uv;

 layout(location = 0) out vec2 fragUV;
 layout(location = 1) out vec4 fragPosition;

 void main() {
 fragPosition = 0.5 * (position + vec4(1.0));
 ...
 fragUV = uv;
 }
 `;
 
 const fragmentShaderGLSL = `#version 450
 layout(set = 0, binding = 1) uniform sampler mySampler;
 layout(set = 0, binding = 2) uniform texture2D myTexture;

 layout(location = 0) in vec2 fragUV;
 layout(location = 1) in vec4 fragPosition;
 layout(location = 0) out vec4 outColor;

 void main() {
 outColor = texture(sampler2D(myTexture, mySampler), fragUV) * fragPosition;
 }
 `;

```

vertex shader传入了uv attribute数据，并将其传递给fragUV，从而传到fragment shader，作为纹理采样坐标


另外，这里可以顺便说明下：fragPosition用来实现与position相关的颜色渐变效果


- uv数据包含在verticesBuffer的cubeVertexArray中


cubeVertexArray的代码如下：


```
cube.ts:
export const cubeUVOffset = 4 * 8;
export const cubeVertexArray = new Float32Array([
 // float4 position, float4 color, float2 uv,
 1, -1, 1, 1, 1, 0, 1, 1, 1, 1,
 -1, -1, 1, 1, 0, 0, 1, 1, 0, 1,
 -1, -1, -1, 1, 0, 0, 0, 1, 0, 0,
 1, -1, -1, 1, 1, 0, 0, 1, 1, 0,
 1, -1, 1, 1, 1, 0, 1, 1, 1, 1,
 -1, -1, -1, 1, 0, 0, 0, 1, 0, 0,

 ...
]);

```

创建和设置verticesBuffer的相关代码如下：


```
texturedCube.ts:
 const verticesBuffer = device.createBuffer({
 size: cubeVertexArray.byteLength,
 usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
 });
 verticesBuffer.setSubData(0, cubeVertexArray);
 
 ...
 
 return function frame() {
 ...
 passEncoder.setVertexBuffer(0, verticesBuffer);
 ...
 } 

```


- 创建render pipeline时指定uv attribute的相关数据


代码如下：


```
 const pipeline = device.createRenderPipeline({
 ...
 vertexState: {
 vertexBuffers: [{
 ...
 attributes: [
 ...
 {
 // uv
 shaderLocation: 1,
 offset: cubeUVOffset,
 format: "float2"
 }]
 }],
 },
 ...
 }); 

```

## 增加了sampler和sampled-texture类型的uniform数据


WebGPU相对于WebGL1，提出了sampler，可以对它设置filter、wrap等参数，从而实现了texture和sampler自由组合，同一个texture能够以不同filter、wrap来采样


- fragment shader传入这两个uniform数据，用于纹理采样


代码如下：


```
 const fragmentShaderGLSL = `#version 450
 layout(set = 0, binding = 1) uniform sampler mySampler;
 layout(set = 0, binding = 2) uniform texture2D myTexture;

 layout(location = 0) in vec2 fragUV;
 layout(location = 1) in vec4 fragPosition;
 layout(location = 0) out vec4 outColor;

 void main() {
 outColor = texture(sampler2D(myTexture, mySampler), fragUV) * fragPosition;
 }
 `;

```


- 创建bind group layout


代码如下：


```
 const bindGroupLayout = device.createBindGroupLayout({
 bindings: [
 ...
 {
 // Sampler
 binding: 1,
 visibility: GPUShaderStage.FRAGMENT,
 type: "sampler"
 }, {
 // Texture view
 binding: 2,
 visibility: GPUShaderStage.FRAGMENT,
 type: "sampled-texture"
 }]
 });

```


- 拷贝图片到texture，返回texture


代码如下，后面会进一步研究：


```
 const cubeTexture = await createTextureFromImage(device, 'assets/img/Di-3d.png', GPUTextureUsage.SAMPLED);

```


- 创建sampler，指定filter


代码如下：


```
 const sampler = device.createSampler({
 magFilter: "linear",
 minFilter: "linear",
 });
 

```

我们看一下相关定义：


```
GPUSampler createSampler(optional GPUSamplerDescriptor descriptor = {});

...

dictionary GPUSamplerDescriptor : GPUObjectDescriptorBase {
 GPUAddressMode addressModeU = "clamp-to-edge";
 GPUAddressMode addressModeV = "clamp-to-edge";
 GPUAddressMode addressModeW = "clamp-to-edge";
 GPUFilterMode magFilter = "nearest";
 GPUFilterMode minFilter = "nearest";
 GPUFilterMode mipmapFilter = "nearest";
 float lodMinClamp = 0;
 float lodMaxClamp = 0xffffffff;
 GPUCompareFunction compare = "never";
};

```

GPUSamplerDescriptor的addressMode指定了texture在u、v、w方向的wrap mode（u、v方向的wrap相当于WebGL1的wrapS、wrapT，w方向是给3d texture用的）


mipmapFilter与mipmap有关，lodXXX与texture lod有关，compare与软阴影的Percentage Closer Filtering技术有关，我们不讨论它们


- 创建uniform bind group时传入sampler、texture的view


```
 const uniformBindGroup = device.createBindGroup({
 layout: bindGroupLayout,
 bindings: [
 ...
 {
 binding: 1,
 resource: sampler,
 }, {
 binding: 2,
 resource: cubeTexture.createView(),
 }],
 });

```

### 参考资料


[Sampler Object](https://www.khronos.org/opengl/wiki/Sampler_Object)


## 详细分析“拷贝图片到texture”步骤


相关代码如下：


```
 const cubeTexture = await createTextureFromImage(device, 'assets/img/Di-3d.png', GPUTextureUsage.SAMPLED);

```

该步骤可以分解为两步：

1.加载图片

2.拷贝解码后类型为HTMLImageElement的图片到GPU的texture中


下面依次分析：


### 1、加载图片


打开[helper.ts](https://github.com/yyc-git/webgpu-samples/blob/master/src/helpers.ts)文件，查看createTextureFromImage对应代码：


```
 const img = document.createElement('img');
 img.src = src;
 await img.decode();

```

这里使用decode api来加载图片。另外一种实现方式是使用img.onload：


```
 const img = document.createElement('img');
 img.src = src;
 img.onload = (img) => {
 ...
 };

```

我们来分析下这两种加载方式：

根据[Pre-Loading and Pre-Decoding Images with Javascript for Better Performance](https://usefulangle.com/post/123/javascript-pre-load-decode-image)的说法，图片的加载过程有两个步骤：

1.从服务器加载图片

2.解码图片


对于这两种加载图片的方式，图片的加载过程的第1步都是在其它线程上并行执行，不会阻塞主线程；

如果用onload，则浏览器会在主线程上同步执行第2步，从而阻塞主线程；

如果用decode api，则浏览器会在其它线程上并行执行第2步，不会阻塞主线程。


因为chrome和firefox浏览器都支持decode api，所以加载图片应该优先使用该API。

兼容性情况如下图所示：

![截屏2019-12-24下午2.31.34.png-85.3kB](https://img2020.cnblogs.com/blog/419321/202012/419321-20201227102841590-849029126.png)


#### 参考资料


[Pre-Loading and Pre-Decoding Images with Javascript for Better Performance](https://usefulangle.com/post/123/javascript-pre-load-decode-image)

[Chrome 图片解码与 Image.decode API](https://zhuanlan.zhihu.com/p/43991630)


### 2、拷贝图片


WebGL1只能使用texImage2D将图片上传到GPU texture中，而WebGPU能让我们更加灵活地控制上传过程。


WebGPU有两种方法上传：


- 创建图片对应的imageBitmap，将其拷贝到GPU texture中


该方法要用到copyImageBitmapToTexture函数。虽然WebGPU规范已经定义了该函数，但目前Chrome Canary不支持它，所以暂时不能用该方法上传。


**参考资料**

[Proposal for copyImageBitmapToTexture](https://github.com/gpuweb/gpuweb/pull/266)

[ImageBitmapToTexture design](https://github.com/gpuweb/gpuweb/blob/master/design/ImageBitmapToTexture.md)


- 将图片绘制到canvas中，通过getImageData获得数据，将其设置到buffer中，把buffer数据拷贝到GPU texture中


本示例使用这种方法实现上传。

我们来看下createTextureFromImage对应代码：


```
 const imageCanvas = document.createElement('canvas');
 imageCanvas.width = img.width;
 imageCanvas.height = img.height;

 const imageCanvasContext = imageCanvas.getContext('2d');
 
 //在绘制图片时将图片在Y方向反转了
 imageCanvasContext.translate(0, img.height);
 imageCanvasContext.scale(1, -1);
 
 imageCanvasContext.drawImage(img, 0, 0, img.width, img.height);
 const imageData = imageCanvasContext.getImageData(0, 0, img.width, img.height);

```

这里首先创建canvas，然后绘制图片，最后获得图片数据。


接着看后续代码：


```
 let data = null;

 const rowPitch = Math.ceil(img.width * 4 / 256) * 256;
 if (rowPitch == img.width * 4) {
 data = imageData.data;
 } else {
 data = new Uint8Array(rowPitch * img.height);
 for (let y = 0; y RowPitch must be aligned to D3D12_TEXTURE_DATA_PITCH_ALIGNMENT.

> Offset must be aligned to D3D12_TEXTURE_DATA_PLACEMENT_ALIGNMENT, which is 512.


另外，关于纹理尺寸，可以参考[WebGPU-6](https://blog.csdn.net/caxieyou/article/details/94987754)：


> 第一个问题是关于纹理尺寸的，回答是WebGPU没有对尺寸有特别明确的要求。sample code中最多不能比4kor8k大就行。这个也不是太难理解，OpenGL对纹理和FBO的尺寸总是有上限的。


另外，根据我的测试，buffer（代码中的textureDataBuffer）中的图片数据需要为未压缩的图片数据（它的类型为Uint8Array，length=img.width * img.height * 4（因为每个像素有r、g、b、a这4个值）），否则会报错（在我的测试中，“通过canvas->toDataURL得到图片的base64，将其转为Uint8Array，得到压缩后的图片数据，将其设置到buffer中”会报错）


继续看后续代码：


```
 const commandEncoder = device.createCommandEncoder({});
 commandEncoder.copyBufferToTexture({
 buffer: textureDataBuffer,
 rowPitch: rowPitch,
 imageHeight: 0,
 }, {
 texture: texture,
 }, {
 width: img.width,
 height: img.height,
 depth: 1,
 });

 device.defaultQueue.submit([commandEncoder.finish()]);

 return texture;

```

这里提交了copyBufferToTexture这个command到GPU，并返回texture

（注：这个command此时并没有执行，会由GPU决定什么时候执行）


WebGPU支持buffer与buffer、buffer与texture、texture与texture之间互相拷贝。


**参考资料**

[3 channel formats](https://github.com/gpuweb/gpuweb/issues/66)

[Copies investigation (+ proposals)](https://github.com/gpuweb/gpuweb/issues/69)


# 参考资料


[WebGPU规范](https://gpuweb.github.io/gpuweb/)

[webgpu-samplers Github Repo](https://github.com/yyc-git/webgpu-samples)

[WebGPU-6](https://blog.csdn.net/caxieyou/article/details/94987754)