# Javascript设计模式之我见：迭代器模式 - 杨元超

> 日期: 2013-10-12 13:47
> 源: https://www.cnblogs.com/chaogex/p/3342274.html

大家好！本文介绍迭代器模式及其在Javascript中的应用。


**模式介绍**


# 定义


提供一种方法顺序一个聚合对象中各个元素，而又不暴露该对象内部表示。


# 类图及说明


![](//images0.cnblogs.com/blog/419321/201310/12094238-df87998dd2394804ad48e235b3ee119e.jpg)


 


Iterator抽象迭代器


抽象迭代器负责定义访问和遍历元素的接口，而且基本上是有固定的3个方法：first()获得第一个元素，next()访问下一个元素，isDone()（或者为hasNext()）是否已经访问到底部


ConcreIterator具体迭代器


具体迭代器角色要实现迭代器接口，完成容器元素的遍历。


Aggregate抽象容器


容器角色负重提供创建具体迭代器角色的接口，必然提供一个类似createIterator()（或者为iterator()）这样的方法。


Concrete Aggregate具体容器


具体容器实现容器接口定义的方法，创建出容纳迭代器的对象。


# 应用场景


- 
访问一个聚合对象的内容而无需暴露它的内部表示。


- 
支持对聚合对象的多种遍历。 


- 
为遍历不同的聚合结构提供一个统一的接口。


# 优点


- 支持以不同的方式遍历一个聚合，复杂的聚合可用多种方式进行遍历。

- 迭代器简化了聚合的接口。有了迭代器的遍历接口，聚合本身就不需要类似的遍历接口了，这样就简化了聚合的接口。

- 在同一个聚合上可以有多个遍历 每个迭代器保持它自己的遍历状态。因此你可以同时进行多个遍历。


# 缺点 


- 由于迭代器模式将存储数据和遍历数据的职责分离，增加新的聚合类需要对应增加新的迭代器类，类的个数成对增加，这在一定程度上增加了系统的复杂性。

- 抽象迭代器的设计难度较大，需要充分考虑到系统将来的扩展，例如 JDK 内置迭代器 Iterator 就无法实现逆向遍历，如果需要实现逆向遍历，只能通过其子类ListIterator 等来实现，而 ListIterator 迭代器无法用于操作 Set 类型的聚合对象。在自定义迭代器时，创建一个考虑全面的抽象迭代器并不是件很容易的事情。


**迭代器模式在Javascript中的应用**


# 我的理解


## 抽象迭代器角色


定义对数据结构的通用基本操作。如hasNext、next等。


## **具体迭代器角色**


实现对某一类数据结构的基本操作。如ArrIterator实现对数组结构的基本操作，hashIterator实现对hash结构的基本操作


## **容器角色**


实现数据结构的特定操作。


# **类图及说明**


介绍两种形式的应用：


## **继承**


**![](//images0.cnblogs.com/blog/419321/201310/12124512-590ce51ef36a448482921529604c0a8a.jpg)**


优点


- 容器类可直接复用迭代器的操作，不用再提供方法iterator来获得迭代器实例了。


缺点


- 容器类继承了迭代器的所有操作，有些操作它可能不会用到。

- 限定了迭代器的扩展，在修改迭代器时可能会影响到容器类。


适用场合


- 迭代器比较简单

- 容器类需要使用所有的迭代器方法


## **委托**


 ![](//images0.cnblogs.com/blog/419321/201310/12124521-83a75a25b58547c286572948db3614b8.jpg)


优点


- 容器类可以只使用迭代器的部分操作。

- 灵活，便于容器类与迭代器类扩展。


缺点


- 容器类中需要增加委托方法iterator。


适用场合


- 迭代器类和容器类需要扩展


# 示例


大神可以拿各种offer，屌丝表示很是好奇。一天屌丝偷偷搞到了大神读的书籍清单，于是迫不及待地打开，想看个究竟。


## 类图


![](//images0.cnblogs.com/blog/419321/201310/12154344-e935a00032f5475589094df4c2201f93.jpg)


## 代码


代码中使用的库：[YOOP](http://www.cnblogs.com/chaogex/archive/2013/06/07/3123999.html)


IBook


```
var IBook = YYC.Interface("showInfo");
```


Book


```
 var Book = YYC.Class({Interface: IBook}, {
 Init: function (name) {
 this._name = name;
 },
 Private: {
 _name: ""
 },
 Public: {
 showInfo: function () {
 console.log(this._name);
 }
 }
 });
```


场景类


```
 function main(){
 //定义一个数组容器，存放所有的书对象
 var container, i, len;

 container = [];
 i = 0;
 len = 0;

 container.push(new Book("设计模式之禅"));
 container.push(new Book("Http权威指南"));
 container.push(new Book("深入理解计算机操作系统"));

 for(i = 0, len = container.length; i < len; i++){
 container[i].showInfo();
 }
 }

```


## 运行结果


![](//images0.cnblogs.com/blog/419321/201310/12111712-58b861ee148c4985b23e6fb3f70c82c4.png)


## 示例分析


场景类中实现了一个数组容器及其遍历。应该把容器的实现封装起来形成容器类，令场景类调用容器的接口方法。


另外，容器类中访问数组容器元素的逻辑具有通用性，可以提出来形成迭代器类。凡是需要访问数组容器元素的容器类，只要使用迭代器类就可以实现。


# 使用迭代器模式


现在分别用继承和委托的方式来实现。


### 继承


可以将内部容器container放到Iterator类中。


#### 类图


![](//images0.cnblogs.com/blog/419321/201310/12124628-bd799349226949c3afa59ca2ebe516c9.jpg)


#### 代码


IIterator


```
var IIterator = YYC.Interface("hasNext", "next");
```


Iterator


```
var Iterator = YYC.Class({Interface: IIterator}, {
 Init: function () {
 },
 Private: {
 _container: [],
 _cursor: 0
 },
 Public: {
 hasNext: function () {
 if (this._cursor === this._container.length) {
 return false;
 }
 else {
 return true;
 }
 },
 next: function () {
 var result = null;

 if (this.hasNext()) {
 result = this._container[this._cursor];
 this._cursor += 1;
 }
 else {
 result = null;
 }

 return result;
 }
 }
});
```


BookContainer


```
 var BookContainer = YYC.Class(Iterator, {
 Init: function(){},
 Public: {
 add: function(name){
 this._container.push(new Book(name));
 },
 showInfo: function(){
 while(this.hasNext()){
 this.next().showInfo();
 }
 }
 }
 });
```


IBook


```
var IBook = YYC.Interface("showInfo");
```


Book


```
var Book = YYC.Class({Interface: IBook}, {
 Init: function (name) {
 this._name = name;
 },
 Private: {
 _name: ""
 },
 Public: {
 showInfo: function () {
 console.log(this._name);
 }
 }
});
```


场景类Client


```
function main() {
 var container = new BookContainer();

 container.add("设计模式之禅");
 container.add("Http权威指南");
 container.add("深入理解计算机操作系统");

 container.showInfo();
}
```


### 委托


Iterator中通过注入获得内部容器container。


#### 类图


 ![](//images0.cnblogs.com/blog/419321/201310/12124715-92514bb485104eefbfc4a81bb4e3b705.jpg)


#### 代码


IIterator


```
var IIterator = YYC.Interface("hasNext", "next");
```


Iterator


```
var Iterator = YYC.Class({Interface: IIterator}, {
 Init: function (container) {
 this._container = container;
 },
 Private: {
 _container: [],
 _cursor: 0
 },
 Public: {
 hasNext: function () {
 if (this._cursor === this._container.length) {
 return false;
 }
 else {
 return true;
 }
 },
 next: function () {
 var result = null;

 if (this.hasNext()) {
 result = this._container[this._cursor];
 this._cursor += 1;
 }
 else {
 result = null;
 }

 return result;
 }
 }
});
```


IBookContainer


```
var IBookContainer = YYC.Interface("add", "iterator");
```


BookContainer


```
var BookContainer = YYC.Class({ Interface: IBookContainer }, {
 Init: function () {
 },
 Private: {
 _container: []
 },
 Public: {
 add: function (name) {
 this._container.push(new Book(name));
 },
 iterator: function () {
 return new Iterator(this._container);
 }
 }
});
```


IBook


```
var IBook = YYC.Interface("showInfo");
```


Book


```
var Book = YYC.Class({Interface: IBook}, {
 Init: function (name) {
 this._name = name;
 },
 Private: {
 _name: ""
 },
 Public: {
 showInfo: function () {
 console.log(this._name);
 }
 }
});
```


场景类Client


```
function main() {
 var container, iter;

 container = new BookContainer();

 container.add("设计模式之禅");
 container.add("Http权威指南");
 container.add("深入理解计算机操作系统");


 iter = container.iterator();

 while (iter.hasNext()) {
 iter.next().showInfo();
 }
}
```


#### 变形


　　上面将容器类BookContainer的showInfo方法放到场景类中实现。也可以将其放到BookContainer中，这样BookContainer就不需要iterator方法了。


IBookContainer


```
var IBookContainer = YYC.Interface("add", "showInfo");
```


BookContainer


```
var BookContainer = YYC.Class({ Interface: IBookContainer }, {
 Init: function () {
 this._iter = new Iterator(this._container);
 },
 Private: {
 _container: [],
 _iter: null
 },
 Public: {
 add: function (name) {
 this._container.push(new Book(name));
 },
 showInfo: function () {
 while (this._iter.hasNext()) {
 this._iter.next().showInfo();
 }
 }
 }
});
```


场景类


```
function main() {
 var container = new BookContainer();

 container.add("设计模式之禅");
 container.add("Http权威指南");
 container.add("深入理解计算机操作系统");

 container.showInfo();
}
```


### 运行结果


 ![](//images0.cnblogs.com/blog/419321/201310/12120526-e7650e25d5f64cda8d05d0bdcba91105.png)


## 示例分析


　　**为什么add放到容器类BookContainer，而不是放到迭代器Iterator中呢？**


```
add: function (name) {
 this._container.push(new Book(name));
},
```


因为在add方法中需要创建Book实例，因此与容器元素Book强耦合。而Iterator中都是容器的基本操作，是不需要知道具体的容器元素的。所以add不能放到Iterator中。


又因为add属于容器操作，因此应该放到作为容器类的BookContainer中。


**参考资料**


## 《设计模式之禅》


[迭代器模式](http://wenku.baidu.com/view/1ad15f11f18583d0496459e3.html)