# 关于使用Css设置Canvas画布大小的问题 - 杨元超

> 日期: 2013-10-19 11:46
> 源: https://www.cnblogs.com/chaogex/p/3377692.html

**问题分析**


我们在调整画布大小时，希望画布中的图形保持不变，只是改变画布本身的大小。但是如果使用Css设置画布大小，则会出现问题。


# 问题描述


如果使用Css设置Canvas画布的大小，则导致画布按比例缩放到你设置的值。


# 原因


在Canvas元素的内部存在一个名为2d渲染环境（2d redering context）的对象，所以，通过Css设置画布尺寸会引起奇怪的效果。


# 解决方案


在Html页面上加入canvas元素（不能使用js动态加入canvas）。


通过Html设置画布大小。可以直接在Html页面上设置Canvas元素的大小：


```

```


也可以通过js设置画布大小：


```
 var canvas = document.getElementById("testCanvas");
 canvas.width = 200;
 canvas.height = 100;
```


这两种方法都可以。


需要注意的是，设置画布大小后，画布所有的样式和内容会重置（如画布上的图形会消失，在设置画布大小后需要重新绘制）。


**示例**


首先我们创建一个宽度为200px，高度为100px的画布，它的边框为红色。然后在中间画一个大小为20*20的正方形：


![](//images0.cnblogs.com/blog/419321/201310/19112208-6fea7fb343ab44559b1befb9e379b094.png)


# 代码


```


 


 var canvas, context;
 canvas = document.getElementById("testCanvas");

 canvas.width = 200;
 canvas.height = 100;
 canvas.style.border = "1px solid red";

 context = canvas.getContext("2d");
 context.strokeStyle = "#99cc33";
 context.fillRect(90, 40, 20, 20);


```


# 将画布大小缩小1倍


## 使用css设置画布大小


### 相关代码


```
 canvas.style.width = "100px";
 canvas.style.height = "50px";
```


### 效果


![](//images0.cnblogs.com/blog/419321/201310/19112521-266b9c929f3a415c8dfd2d2bcf9b3c79.png)


### 分析


我们发现画布是整体按比例缩小了1倍。


## 使用js设置画布大小


### 相关代码


```
 canvas.width = 100;
 canvas.height = 50;

 //设置画布大小后，所有样式会重置。因此需要重新绘制正方形
 context.fillRect(90, 40, 20, 20);
 
```


### 效果


![](//images0.cnblogs.com/blog/419321/201310/19114015-5ec6ce777f734147849d365e229719fc.png)


### 分析


相当于把画布的右半部和下半部去掉了，达到了我们预期的效果。