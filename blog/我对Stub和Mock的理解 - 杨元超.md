# 我对Stub和Mock的理解 - 杨元超

> 日期: 2013-10-25 22:55
> 源: https://www.cnblogs.com/chaogex/p/3388386.html

**介绍**


使用测试驱动开发大半年了，我还是对Stub和Mock的认识比较模糊，没有进行系统整理。


今天查阅了相关资料，觉得写得很不错，所以我试图在博文中对资料进行整理一下，再加上一些自己的观点。


本文是目前我对Stub和Mock的认识，难免有偏差，欢迎大家拍砖。


**分析**


Stub和Mock都是属于测试替身，对类型细分的话可以分为：


- Dummy Object

- Fake Object

- Test Stub

- Test Spy

- Mock Object


前四项属于Stub，最后的Mock Object属于Mock。


# 类型分析


## Dummy Object（哑对象）


测试代码仅仅是需要使用它来通过编译，实际上用不到它。如测试A类的run方法，需要在创建A类的实例时需要传入B类实例，但run方法并没有用到B类实例。在测试时需要传入B类的哑对象new NullB()（如“new A(new NullB())”），让其通过编译。这里的NullB是一个空类，没有具体实现。


## Fake Object（假对象）


假对象相对于哑对象来说，要对耦合的组件有一些简单的实现，实现我们在测试中要用到的方法，指定期望的行为（如返回期望的值）。假对象适用于替换产品代码中使用的全局对象，或者创建的类。这里注意的是要先对被替换的全局对象或类进行备份，然后在测试完成后进行恢复。


示例1（替换全局对象）：


```
//产品代码
function A(){
 this.num = 0;
}
A.prototype.run = function(){
 this.num = window.b.getNum();
};

//测试代码
describe("测试A类的run方法", function(){
 var temp = null;

 function backUp(){
 window.b = window.b || {};
 temp = YYC.Tool.extendDeep(window.b);
 }
 function restore(){
 window.b = temp;
 }

 beforeEach(function(){
 backUp();
 });
 afterEach(function(){
 restore();
 });

 it("获得数字", function () {
 window.b = { //假对象
 getNum: function(){
 return 1;
 }
 }

 var a = new A();
 a.run();

 expect(a.num).toEqual(1);
 });
});
```


示例2（替换类）：


```
//产品代码
function A() {
 this.num = 0;
 this._b = new B();
}
A.prototype.run = function () {
 this.num = this._b.getNum();
};

//测试代码
describe("测试A类的run方法", function () {
 var temp = null;

 function backUp() {
 window.B = window.B || function () {};
 temp = B;
 }

 function restore() {
 window.B = temp;
 }

 beforeEach(function () {
 backUp();
 });
 afterEach(function () {
 restore();
 });

 it("获得数字", function () {
 window.B = function () {
 };
 window.B.prototype.getNum = function () {
 return 1;
 };

 var a = new A();
 a.run();

 expect(a.num).toEqual(1);
 });
});
```


## Test Stub（测试桩）


测试桩与假对象有点类似，也要实现与产品代码耦合的组件，指定期望的行为。这里最大的不同是测试桩需要注入到产品代码中，从而在测试产品代码时替换组件，执行桩的行为。使用测试桩不需要进行备份和还原。


示例：


```
//产品代码
function A(b) {
 this.num = 0;
 this._b = b;
}
A.prototype.run = function () {
 this.num = this._b.getNum();
};

//测试代码
describe("测试A类的run方法", function () {
 it("获得数字", function () {
 var stub_B = { //B类的桩
 getNum: function(){
 return 1;
 }
 };

 var a = new A(stub_B); //注入桩
 a.run();

 expect(a.num).toEqual(1);
 });
});
```


## Test Spy（嗅探桩）


与测试桩类似，但是可以记录桩使用的记录，并进行验证。


示例：


可以使用jasmine的spy来举例。


```
//产品代码
function A(b) {
 this.num = 0;
 this._b = b;
}
A.prototype.run = function () {
 this.num = this._b.getNum();
};

//测试代码
describe("测试A类的run方法", function () {
 it("获得数字", function () {
 var stub_b = {
 getNum: function(){
 return 1;
 }
 };
 spyOn(stub_b, "getNum").andCallThrough(); //嗅探桩的getNum方法

 var a = new A(stub_b); //注入桩
 a.run();

 expect(a.num).toEqual(1);
 expect(stub_b.getNum).toHaveBeenCalled(); //验证调用过桩的getNum方法
 });
});
```


## Mock Object（模拟对象）


设定产品代码中耦合的类的期望的行为，然后验证期望的行为是否发生，从而达到测试产品代码行为的目的。适用于验证一些void的行为。例如：在某个条件发生时，要记录Log。这种情景，用stub就很难验证，因为对目标物件来说，沒有回传值，也沒有状态变化，就只能通过mock object來验证目标物件是否正确的与Log介面进行互动。


示例：


```
//产品代码
function A(b) {
 this.num = 0;
 this._b = b;
}
A.prototype.run = function () {
 this.num = this._b.getNum(2);
};

//测试代码（Mock为伪代码）
describe("测试A类的run方法", function () {
 it("获得数字", function () {
 var mockB = Mock.createMock({
 getNum: function(){}
 }); //如果B类存在的话，也可以直接传入B的原型：var mockB = Mock.createMock(B.prototype);
 Mock.expect(mockB.getNum, 2).return(1).times(1);

 var a = new A(mockB);
 a.run();

 expect(a.num).toEqual(1);
 Mock.verify(); //验证期望的行为发生：mockB的getNum传入的参数为2；调用了1次mockB.getNum
 });
});
```


**Mock（Mock Object）与Spy（Test Spy）的比较**


相同点


- 都要注入到产品代码中。


不同的


- Mock是替换整个被Mock的类，这个类可以存在也可以不存在。而Spy是使用一个已经存在的类，嗅探其中的部分方法。

- 从流程中来说，Mock是先设定被Mock的类的期望行为，然后验证期望的行为是否发生。Spy是记录下桩的方法的使用记录（如传入的参数，调用的次数等），然后再对记录进行验证。


**Mock退化为Stub**


在现实使用中，我们经常将mock做不同程度的退化，从而使得mock对象在某些程度上如stub一样工作。


使用Mock的示例：


```
//产品代码
function A(b) {
 this.num = 0;
 this._b = b;
}
A.prototype.run = function () {
 this.num = this._b.getNum(2);
};

//测试代码（Mock为伪代码）
describe("测试A类的run方法", function () {
 it("获得数字", function () {
 var mockB = Mock.createMock({
 getNum: function(){}
 }); //如果B类存在的话，也可以直接传入B的原型：var mockB = Mock.createMock(B.prototype);
 Mock.expect(mockB.getNum).return(1); //只指定返回值，没有期望的参数或期望调用的次数。因此不用verify来验证了！

 var a = new A(mockB);
 a.run();

 expect(a.num).toEqual(1);
 });
});
```


也可以用Stub来达到相同的效果：


```
//产品代码
function A(b) {
 this.num = 0;
 this._b = b;
}
A.prototype.run = function () {
 this.num = this._b.getNum();
};

//测试代码
describe("测试A类的run方法", function () {
 it("获得数字", function () {
 var stub_B = {
 getNum: function(){
 return 1;
 }
 };

 var a = new A(stub_B);
 a.run();

 expect(a.num).toEqual(1);
 });
});
```


**总结**


在比较简单的情况下（如需要哑对象来通过编译，或是需要测试桩来替换耦合的组件），使用Stub。


如果需要验证耦合组件的行为，可以使用Spy或Mock。


**参考资料**


[软件测试- 3 - Mock 和Stub的区别](http://blog.csdn.net/lilybear101/article/details/6938646)


[浅谈mock和stub](http://www.blogjava.net/aoxj/archive/2010/08/26/329975.html)


《xUnit测试模式--测试码重构》