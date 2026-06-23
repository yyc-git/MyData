# 理解DOM - 杨元超

> 日期: 2014-09-06 19:46
> 源: https://www.cnblogs.com/chaogex/p/3959723.html

# 前言


本文试图弄清楚DOM到底是什么，不会讨论具体DOM节点的操作。


# DOM是什么


DOM全称为The Document Object Model，应该理解为是一个规范，定义了HTML和XML文档的逻辑结构和文档操作的编程接口。


## 文档逻辑结构


DOM实际上是以面向对象方式描述的对象模型，它将文档建模为一个个对象，以树状的结构组织（本文称之为“文档树”，树中的对象称为“节点”）。

每个文档包含1个document节点，0个或1个doctype节点以及0个或多个元素节点等。document节点是文档树的根节点。

如对于HTML文档，DOM 是这样规定的：


- 整个文档是一个文档节点

- 每个 HTML 标签是一个元素节点

- 包含在 HTML 元素中的文本是文本节点

- 每一个 HTML 属性是一个属性节点

- 注释属于注释节点


节点与文档内容是一一对应的关系，节点之间有层次关系。


例如下面的hmlt文档：


```


 文档标题


[我的链接]()
# 我的标题


```

会被建模为下面的文档树：

![_1](http://img2.tbcdn.cn/L1/461/1/8ee8be23856d5b187a8b433b88cbcc03f0c53def)


又如下面的html文档：


```


 Aliens?
 Why yes.


```

会被建模为下面的文档树：

![_2](http://img1.tbcdn.cn/L1/461/1/20227de567513876af94136badef35f8af4008ef)


## 文档操作


程序员可以使用DOM定义的接口来获得对文档中所有元素进行访问的入口，创建文档，浏览文档结构，添加、修改或删除文档元素和内容。

HTML或XML文档中的所有的内容都可以通过使用DOM定义的接口来操作。


## DOM到底是对象模型还是编程接口？


总的来说，DOM应该理解为是1个规范。

站在实现（如浏览器）和使用者（如程序员）的角度来看，DOM就是一套文档节点的编程接口，只要实现了接口，就可以使用接口成员来操作文档；站在设计和制定的角度来看，DOM是一个对象模型，它将文档内容建模为对象并组织为树状结构，定义了这些对象的行为和属性以及这些对象之间的关系。


# DOM不是什么


- DOM不是一个数据结构集，并没有定义数据结构。

- DOM没有定义文档中什么信息是相关的或者文档中的信息是如何组织的。


如对于XML，这些是在[XML Information Set](http://www.w3.org/TR/2004/REC-xml-infoset-20040204/)中指定的。DOM只是这些信息集的API。


**鉴于水平有限，w3c资料中我没有理解的部分此处没有给出**，详细内容可参考[What is the Document Object Model -> What the Document Object Model is not](http://www.w3.org/TR/2004/REC-DOM-Level-3-Core-20040407/introduction.html#ID-E7C30822)


# DOM的分级


上面讨论的DOM是1级DOM，具体就是 DOM CORE和DOM HTML，它将HTML和XML文档映射为对由层次对象（节点）组成的树。

根据W3C DOM规范，DOM有1级、2级、3级以及最新的4级，本文只讨论前3级DOM。


## 1级DOM


1级DOM在1998年10月份成为W3C的提议，由DOM CORE与DOM HTML两个模块组成。DOM CORE能映射以XML为基础的文档结构，允许获取和操作文档的任意部分。DOM HTML通过添加HTML专用的对象与函数对DOM核心进行了扩展。


## 2级DOM


![2_DOM](http://img1.tbcdn.cn/L1/461/1/9c71bd26356e6884475a93eace7fbd54865221d9)


鉴于1级DOM仅以映射文档结构为目标，DOM 2级面向更为宽广。通过对原有DOM的扩展，2级DOM通过对象接口增加了对鼠标和用户界面事件（DHTML长期支持鼠标与用户界面事件）、范围、遍历（重复执行DOM文档）和层叠样式表（CSS）的支持。同时也对DOM 1的核心进行了扩展，从而可支持XML命名空间。

2级DOM引进了几个新DOM模块来处理新的接口类型：

DOM视图：描述跟踪一个文档的各种视图（使用CSS样式设计文档前后）的接口；

DOM事件：描述事件接口；

DOM样式：描述处理基于CSS样式的接口；

DOM遍历与范围：描述遍历和操作文档树的接口；


## 3级DOM


3级DOM通过引入统一方式载入和保存文档和文档验证方法对DOM进行进一步扩展，DOM3包含一个名为“DOM载入与保存”的新模块，DOM核心扩展后可支持XML1.0的所有内容，包扩XML Infoset、 XPath、和XML Base。


## "0级"DOM


当阅读与DOM有关的材料时，可能会遇到参考0级DOM的情况。需要注意的是并没有标准被称为0级DOM，它仅是DOM历史上一个参考点（0级DOM被认为是在Internet Explorer 4.0 与Netscape Navigator4.0支持的最早的DHTML）。


# 参考资料


[DOM百度百科](http://baike.baidu.com/subview/14806/8904138.htm)

[What is the Document Object Model](http://www.w3.org/TR/2004/REC-DOM-Level-3-Core-20040407/introduction.html)

[W3C DOM4](http://www.w3.org/TR/domcore/)