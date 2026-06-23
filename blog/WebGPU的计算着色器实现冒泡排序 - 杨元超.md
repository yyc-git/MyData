# WebGPU的计算着色器实现冒泡排序 - 杨元超

> 日期: 2022-08-12 08:31
> 源: https://www.cnblogs.com/chaogex/p/16578547.html

大家好~本文使用WebGPU的计算着色器，实现了奇偶排序。

奇偶排序是冒泡排序的并行版本，在1996年由J Kornerup提出。它解除了每轮冒泡间的串行依赖以及每轮冒泡内部的串行依赖，使得冒泡操作可以并行执行


目录

- [介绍奇偶排序算法](#介绍奇偶排序算法)
- [分析时间复杂度](#分析时间复杂度)
- [需求](#需求)
- [初步设计](#初步设计)
- [代码实现](#代码实现)
- [发现问题](#发现问题)
- [改进设计](#改进设计)
- [相关代码实现](#相关代码实现)
- [改进设计](#改进设计-1)
- [相关代码实现](#相关代码实现-1)
- [限制](#限制)
- [总结](#总结)
- [参考资料](#参考资料)


最终版本的代码在[这里](https://github.com/yyc-git/WebGPU-Odd-Even-Sort)


# 介绍奇偶排序算法


假设待排序的数组为Arr1

在奇数步中，Arr1中奇数项与相邻的右边一项比较和交换；

在偶数步中，Arr1中奇数项与相邻的左边一项比较和交换;

直到一步中没有交换项，则停止


举例来说的话，如下图所示：

![image](https://img2022.cnblogs.com/blog/419321/202208/419321-20220812082755493-1463891724.jpg)


在每步中，红框内的两项进行比较和交换；

直到一步中没有交换项，则停止


# 分析时间复杂度


与冒泡排序一样，总的比较次数不变，依然为O(n^2)次

但因为为并行执行，所以时间复杂度降低为O(log2(n^2))=O(n)


# 需求


排序的需求如下所示:


- 对一个包含128个数字的数组进行升序的排序


# 初步设计


因为数组可以两两分为64个组，每个组并行执行操作，所以计算着色器只使用一个workgroup，包含64个局部单位，每个局部单位对应一个组；


在每个局部单位中：

启动一个while循环，执行每步操作，然后同步，最后判断所有局部单位在该步骤中是否有交换操作，如果都没有的话则停止循环


“执行每步操作”时判断该步骤是奇数还是偶数步，从而取对应的两项来比较和交换


# 代码实现


经过上面的设计后，现在我们来实现代码

计算着色器代码如下所示：


```
//64个局部单位
const workgroupSize = 64;

// 局部单位之间的共享变量，用于存放128个数字
var sharedData: array;
// 局部单位之间的共享变量，用于标志所有局部单位在该步骤中是否有交换操作（只要有任意一个局部单位在该步骤中有交换操作，则该标志为true）
var isSwap: bool;
// 局部单位之间的共享变量，用于记录步骤数，从而判断是奇数还是偶数步
var stepCount: u32;

struct BeforeSortData {
 data : array
}
struct AfterSortData {
 data : array
}

//待排序的数组
@binding(0) @group(0) var beforeSortData : BeforeSortData;
//排序后的数组
@binding(1) @group(0) var afterSortData : AfterSortData;

@compute @workgroup_size(workgroupSize, 1, 1)
fn main(
@builtin(global_invocation_id) GlobalInvocationID : vec3,
) {
//将待排序的数据读取到共享变量中

var index = GlobalInvocationID.x * 2;
sharedData[index] = beforeSortData.data[index];
sharedData[index+ 1 ] = beforeSortData.data[index + 1];

//初始化共享变量

isSwap = false;
stepCount = 0;

//同步
workgroupBarrier();

//开始循环
while(true){
 var firstIndex:u32;
 var secondIndex:u32;

 //判断该步骤是奇数还是偶数步，从而得到对应的两项的序号

 //偶数步
 if(stepCount % 2 == 0){
 firstIndex = index + 1;
 secondIndex = index + 2;
 }
 //奇数步
 else{
 firstIndex = index;
 secondIndex = index + 1;
 }

 //确保没超过边界
 if(secondIndex sharedData[secondIndex]){
 var temp = sharedData[firstIndex];
 sharedData[firstIndex] = sharedData[secondIndex];
 sharedData[secondIndex] = temp;

 isSwap = true;
 }
 }

 stepCount += 1;

 workgroupBarrier();

 //如果该步骤中没有交换操作的话则停止循环
 if(!isSwap){
 break;
 }
}

//将排序后的数据传给返回给CPU端的Storage Buffer中，从而可在CPU端得到排序后的结果
afterSortData.data[index] = sharedData[index];
afterSortData.data[index + 1] = sharedData[index + 1];
}

```

本来我是想像设置workgroupSize一样，将128设为const的，如下所示：


```
const workgroupSize = 64;
const itemCount = 128;

var sharedData: array;

```

但是运行时会报错！照理说根据WGSL的文档，是不应该报错的！所以不清楚是我没搞清楚还是WGSL目前的bug？

（另外，如果使用override而不是const，也会报错！）


如果改为使用workgroupSize，则不会报错。代码如下所示：


```
const workgroupSize = 64;

var sharedData: array;

```

这是因为workgroupSize在@workgroup_size中使用了。代码如下所示：


```
@compute @workgroup_size(workgroupSize, 1, 1)

```

# 发现问题


运行代码后，会报警告：


```
1 warning(s) generated while compiling the shader:
:74:5 warning: 'workgroupBarrier' must only be called from uniform control flow
 workgroupBarrier();
 ^^^^^^^^^^^^^^^^

:77:5 note: control flow depends on non-uniform value
 if(!isSwap){
 ^^

:77:9 note: reading from workgroup storage variable 'isSwap' may result in a non-uniform value
 if(!isSwap){
 ^^^^^^

```

这是因为WGSL会进行[Uniformity analysis](https://www.w3.org/TR/WGSL/#uniformity-overview)检查，确保像“workgroupBarrier”这种barries是在[uniform control flow](https://www.w3.org/TR/WGSL/#uniform-control-flow)中安全地调用

WGSL在检查时发现：因为isSwap被多个局部单位读写，所以为"non-uniform value"，导致所在的control flow为non-uniform


更多关于Uniformity的资料在这里：

[uniformity](https://www.w3.org/TR/WGSL/#uniformity)

[Add the uniformity analysis to the WGSL spec](https://github.com/gpuweb/gpuweb/pull/1571)

[uniformity issues](https://github.com/gpuweb/gpuweb/issues?q=uniform+control+flow.+label%3Auniformity)


# 改进设计


现在需要去掉isSwap的if判断

因为isSwap的if判断是用来结束循环的，那么在去掉它之后我们就需要新的结束条件

因为总共有128个数字要排序，所以最多进行128步即可完成所有的排序


# 相关代码实现


所以去掉isSwap，把循环终止条件修改下，并且重构一下代码

相关代码改为：


```

fn _swap(firstIndex:u32, secondIndex:u32){
 var temp = sharedData[firstIndex];
 sharedData[firstIndex] = sharedData[secondIndex];
 sharedData[secondIndex] = temp;
}

fn _oddSort(index:u32) {
 var firstIndex = index;
 var secondIndex = index + 1;

 if(sharedData[firstIndex] > sharedData[secondIndex]){
 _swap(firstIndex, secondIndex);
 }
}

fn _evenSort(index:u32) {
 var firstIndex = index + 1;
 var secondIndex = index + 2;

 if(secondIndex sharedData[secondIndex]){
 _swap(firstIndex, secondIndex);
 }
}


@compute @workgroup_size(workgroupSize, 1, 1)
fn main(
@builtin(global_invocation_id) GlobalInvocationID : vec3,
) {
 ...

 var firstIndex:u32;
 var secondIndex:u32;

 for (var i: u32 = 0; i 尽量减少if判断

- if中尽量使用常数判断，如if(const value < 2)


- 减少Bank Conflict


对共享变量内存尽量连续地读写

如对本文的共享数组sharedData，尽量连续的读写相邻的序号


- 减少同步操作


如果已知确定的循环次数，可以展开循环，这样可以减少同步操作和循环的指令开销


# 参考资料


[啥是Parallel Reduction](https://zhuanlan.zhihu.com/p/41151532)

[CUDA(六). 从并行排序方法理解并行化思维——冒泡、归并、双调排序的GPU实现](https://blog.csdn.net/abcjennifer/article/details/47110991)

[uniformity](https://www.w3.org/TR/WGSL/#uniformity)

[CUDA编程——Warp Divergence](https://blog.csdn.net/junparadox/article/details/50541825)