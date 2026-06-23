# ECS模式 - 杨元超

> 日期: 2024-01-19 07:54
> 源: https://www.cnblogs.com/chaogex/p/17973836

大家好，本文提出了ECS模式。ECS模式是游戏引擎中常用的模式，通常用来组织游戏场景。本文出自我写的开源书《3D编程模式》，该书的更多内容请详见：

[Github](https://github.com/yyc-git/3DProgramPattern)

[在线阅读](https://yyc-git.github.io/3dProgramPattern/docs/%E5%89%8D%E8%A8%80/)


目录

- [普通英雄和超级英雄](#普通英雄和超级英雄)
[需求](#需求)
- [实现思路](#实现思路)
- [给出UML](#给出uml)
- [给出代码](#给出代码)
[Client的代码](#client的代码)
- [创建WorldState的代码](#创建worldstate的代码)
- [创建场景的代码](#创建场景的代码)
- [普通英雄移动的代码](#普通英雄移动的代码)
- [超级英雄移动和飞行的代码](#超级英雄移动和飞行的代码)
- [初始化的代码](#初始化的代码)
- [主循环的代码](#主循环的代码)
- [主循环中更新的代码](#主循环中更新的代码)
- [主循环中渲染的代码](#主循环中渲染的代码)
- [运行Client的代码](#运行client的代码)

- [提出问题](#提出问题)

- [基于组件化的思想改进](#基于组件化的思想改进)
[概述解决方案](#概述解决方案)
- [给出UML](#给出uml-1)
- [结合UML图，描述如何具体地解决问题](#结合uml图描述如何具体地解决问题)
- [给出代码](#给出代码-1)
[Client的代码](#client的代码-1)
- [创建WorldState的代码](#创建worldstate的代码-1)
- [创建场景的代码](#创建场景的代码-1)
- [移动的相关代码](#移动的相关代码)
- [飞行的相关代码](#飞行的相关代码)
- [初始化和主循环的代码](#初始化和主循环的代码)
- [主循环中更新的代码](#主循环中更新的代码-1)
- [主循环中渲染的代码](#主循环中渲染的代码-1)
- [运行Client的代码](#运行client的代码-1)

- [提出问题](#提出问题-1)

- [使用ECS模式来改进](#使用ecs模式来改进)
[概述解决方案](#概述解决方案-1)
- [给出UML](#给出uml-2)
- [结合UML图，描述如何具体地解决问题](#结合uml图描述如何具体地解决问题-1)
- [给出代码](#给出代码-2)
[Client的代码](#client的代码-2)
- [创建WorldState的代码](#创建worldstate的代码-2)
- [创建ArrayBuffer的代码](#创建arraybuffer的代码)
- [创建场景的代码](#创建场景的代码-2)
- [移动的相关代码](#移动的相关代码-1)
- [飞行的相关代码](#飞行的相关代码-1)
- [初始化和主循环的代码](#初始化和主循环的代码-1)
- [主循环中更新的代码](#主循环中更新的代码-2)
- [主循环中渲染的代码](#主循环中渲染的代码-2)
- [运行Client的代码](#运行client的代码-2)


- [定义](#定义)
[一句话定义](#一句话定义)
- [补充说明](#补充说明)
- [通用UML](#通用uml)
- [角色的抽象代码](#角色的抽象代码)
[用户的抽象代码](#用户的抽象代码)
- [World的抽象代码](#world的抽象代码)
- [CreateStateSystem的抽象代码](#createstatesystem的抽象代码)
- [OtherSystem的抽象代码](#othersystem的抽象代码)
- [GameObjectManager的抽象代码](#gameobjectmanager的抽象代码)
- [DataOrientedComponentManager的抽象代码](#dataorientedcomponentmanager的抽象代码)
- [OtherComponentManager的抽象代码](#othercomponentmanager的抽象代码)
- [GameObject的抽象代码](#gameobject的抽象代码)
- [DataOrientedComponent的抽象代码](#dataorientedcomponent的抽象代码)
- [OtherComponent的抽象代码](#othercomponent的抽象代码)

- [遵循的设计原则在UML中的体现](#遵循的设计原则在uml中的体现)

- [应用](#应用)
[优点](#优点)
- [缺点](#缺点)
- [使用场景](#使用场景)
[场景描述](#场景描述)
- [具体案例](#具体案例)

- [注意事项](#注意事项)

- [结合其它模式](#结合其它模式)
[结合多线程模式](#结合多线程模式)
- [结合管道模式](#结合管道模式)

- [最佳实践](#最佳实践)
[哪些场景不需要使用模式](#哪些场景不需要使用模式)

- [更多资料推荐](#更多资料推荐)


# 普通英雄和超级英雄


## 需求


我们需要开发一个游戏，游戏中有两种人物：普通英雄和超级英雄，他们具有下面的行为：


- 普通英雄只能移动

- 超级英雄不仅能够移动，还能飞行


我们使用下面的方法来渲染：


- 使用Instance技术来一次性批量渲染所有的普通英雄

- 一个一个地渲染每个超级英雄


## 实现思路


应该有一个游戏世界，它由多个普通英雄和多个超级英雄组成


一个模块对应一个普通英雄，一个模块对应一个超级英雄。模块应该维护该英雄的数据和实现该英雄的行为


## 给出UML


**领域模型**


![image](https://img2024.cnblogs.com/blog/419321/202401/419321-20240119080509874-517677027.png)


总体来看，领域模型分为用户、游戏世界、英雄这三个部分


我们看下用户、游戏世界这两个部分：


Client是用户


World是游戏世界，由多个普通英雄和多个超级英雄组成。World负责管理所有的英雄，并且实现了初始化和主循环的逻辑


我们看下英雄这个部分：


一个NormalHero对应一个普通英雄，维护了该英雄的数据，实现了移动的行为


一个SuperHero对应一个超级英雄， 维护了该英雄的数据，实现了移动、飞行的行为


## 给出代码


首先，我们看下Client的代码；

然后，我们依次看下Client代码中前两个步骤的代码，它们包括：


- 创建WorldState的代码

- 创建场景的代码


然后，因为创建场景时操作了普通英雄和超级英雄，所以我们看下它们的代码，它们包括：


- 普通英雄移动的代码

- 超级英雄移动和飞行的代码


然后，我们依次看下Client代码中剩余的两个步骤的代码，它们包括：


- 初始化的代码

- 主循环的代码


然后，我们看下主循环的一帧中每个步骤的代码，它们包括：


- 主循环中更新的代码

- 主循环中渲染的代码


最后，我们运行Client的代码


### Client的代码


Client


```
let worldState = World.createState()

worldState = _createScene(worldState)

worldState = WorldUtils.init(worldState)

WorldUtils.loop(worldState, [World.update, World.renderOneByOne, World.renderInstances])

```

Client首先创建了WorldState，用来保存游戏世界中所有的数据；然后创建了场景；然后进行了初始化；最后开始了主循环


### 创建WorldState的代码


World


```
export let createState = (): worldState => {
 return {
 normalHeroes: Map(),
 superHeroes: Map()
 }
}

```

createState函数创建了WorldState，它包括两个分别用来保存所有的普通英雄和所有的超级英雄的容器


### 创建场景的代码


Client


```
let _createScene = (worldState: worldState): worldState => {
 创建和加入normalHero1到worldState.normalHeroes
 创建和加入normalHero2到worldState.normalHeroes

 normalHero1移动

 创建和加入superHero1到worldState.superHeroes
 创建和加入superHero2到worldState.superHeroes

 superHero1移动
 superHero1飞行

 return worldState
}

```

_createScene函数创建了场景，创建和加入了两个普通英雄和两个超级英雄到游戏世界中。其中第一个普通英雄进行了移动，第一个超级英雄进行了移动和飞行


NormalHero


```
//创建一个普通英雄
export let create = (): [normalHeroState, normalHero] => {
 创建它的state数据：
 position设置为[0,0,0]
 velocity设置为1.0

 其中：position为位置，velocity为速度

 返回该英雄
}

```


NormalHero的create函数创建了一个普通英雄，初始化了它的数据


SuperHero


```
//创建一个超级英雄
export let create = (): [superHeroState, superHero] => {
 创建它的state数据：
 position设置为[0,0,0]
 velocity设置为1.0
 maxVelocity设置为1.0

 其中：position为位置，velocity为速度，maxVelocity为最大速度

 返回该英雄
}

```


SuperHero的create函数创建了一个超级英雄，初始化了它的数据


### 普通英雄移动的代码


NormalHero


```
//一个普通英雄的移动
export let move = (worldState: worldState, normalHero: normalHero): worldState => {
 从worldState中获得该英雄的position和velocity

 根据velocity，更新position

 更新worldState中该英雄的数据
}

```

move函数实现了移动的行为逻辑，更新了位置


### 超级英雄移动和飞行的代码


SuperHero


```
//一个超级英雄的移动
export let move = (worldState: worldState, superHero: superHero): worldState => {
 从worldState中获得该英雄的position和velocity

 根据velocity，更新position

 更新worldState中该英雄的数据
}

//一个超级英雄的飞行
export let fly = (worldState: worldState, superHero: superHero): worldState => {
 从worldState中获得该英雄的position和velocity、maxVelocity

 根据maxVelocity、velocity，更新position

 更新worldState中该英雄的数据
}

```

SuperHero的move函数的逻辑跟NormalHero的move函数的逻辑是一样的


fly函数实现了飞行的行为逻辑。它跟move函数一样，也是更新英雄的position。只是因为两者在计算时使用的速度的算法不一样，所以更新position的幅度不同


### 初始化的代码


WorldUtils


```
export let init = (worldState) => {
 console.log("初始化...")

 return worldState
}

```

init函数实现了初始化。这里没有任何逻辑，只是进行了打印


### 主循环的代码


WorldUtils


```
export let loop = (worldState, [update, renderOneByOne, renderInstances]) => {
 worldState = update(worldState)
 renderOneByOne(worldState)
 renderInstances(worldState)

 ...

 requestAnimationFrame(
 (time) => {
 loop(worldState, [update, renderOneByOne, renderInstances])
 }
 )
}

```

loop函数实现了主循环。在主循环的一帧中，首先进行了更新；然后一个一个地渲染了所有的超级英雄；然后一次性批量渲染了所有的普通英雄；最后执行下一帧


### 主循环中更新的代码


World


```
export let update = (worldState: worldState): worldState => {
 遍历worldState.normalHeroes：
 更新每个normalHero
 遍历worldState.superHeroes：
 更新每个superHero
}

```

update函数实现了更新，它会遍历所有的normalHero和superHero，调用它们的update函数来更新自己


我们看下NormalHero的update函数的代码：


```
//更新一个普通英雄
export let update = (normalHeroState: normalHeroState): normalHeroState => {
 更新该英雄的position
}

```

它更新了自己的position


我们看下SuperHero的update函数的代码：


```
//更新一个超级英雄
export let update = (superHeroState: superHeroState): superHeroState => {
 更新该英雄的position
}

```

它的逻辑跟NormalHero的update是一样的，这是因为两者都使用同样的算法来更新自己的position


### 主循环中渲染的代码


World


```
export let renderOneByOne = (worldState: worldState): void => {
 worldState.superHeroes.forEach(superHeroState => {
 console.log("OneByOne渲染 SuperHero...")
 })
}

export let renderInstances = (worldState: worldState): void => {
 let normalHeroStates = worldState.normalHeroes

 console.log("批量Instance渲染 NormalHeroes...")
}

```

renderOneByOne函数实现了超级英雄的渲染，它遍历每个超级英雄，一个一个地渲染

renderInstances函数实现了普通英雄的渲染，它一次性获得所有的普通英雄，批量渲染


### 运行Client的代码


下面，我们运行Client的代码，打印的结果如下：


```
初始化...
更新NormalHero
更新NormalHero
更新SuperHero
更新SuperHero
OneByOne渲染 SuperHero...
OneByOne渲染 SuperHero...
批量Instance渲染 NormalHeroes...
{"normalHeroes":{"144891":{"position":[0,0,0],"velocity":1},"648575":{"position":[2,2,2],"velocity":1}},"superHeroes":{"497069":{"position":[6,6,6],"velocity":1,"maxFlyVelocity":10},"783438":{"position":[0,0,0],"velocity":1,"maxFlyVelocity":10}}}

```

通过打印的数据，可以看到运行的步骤如下：

1.进行了初始化

2.更新了所有的人物，包括两个普通英雄和两个超级英雄

3.渲染了2个超级英雄

4.一次性批量渲染了所有的普通英雄

5.打印了WorldState


我们看下打印的WorldState：


- WorldState的normalHeroes中一共有两个普通英雄的数据，其中有一个普通英雄数据的position为[2,2,2]而不是初始的[0,0,0]，说明该普通英雄进行了移动操作；

- WorldState的superHeroes中一共有两个超级英雄的数据，其中有一个超级英雄数据的position为[6,6,6]，说明该超级英雄进行了移动和飞行操作


值得注意的是：

因为WorldState的normalHeroes和superHeroes中的Key是随机生成的id值，所以每次打印时Key都不一样


## 提出问题


- 
NormalHero和SuperHero中的update、move函数的逻辑是重复的


- 
如果英雄增加更多的行为，NormalHero和SuperHero模块会越来越复杂，不容易维护


虽然这两个问题都可以通过继承来解决，即最上面是Hero基类，然后不同种类的Hero层层继承，但是继承的方式很死板，不够灵活


# 基于组件化的思想改进


## 概述解决方案


- 
基于组件化的思想，用组合代替继承。具体修改如下：


将人物抽象为GameObject；

- 将人物的行为抽象为组件，并把人物的相关数据也移到组件中；

- GameObject通过挂载不同的组件，来实现不同的行为


这样就通过GameObject组合不同的组件来代替人物层层继承，从而更加灵活


## 给出UML


**领域模型**


![image](https://img2024.cnblogs.com/blog/419321/202401/419321-20240119080518277-176282651.png)


总体来看，领域模型分为用户、游戏世界、GameObject、组件这四个部分


我们看下用户、游戏世界这两个部分：


Client是用户


World是游戏世界，由多个GameObject组成。World负责管理所有的GameObject，并且实现了初始化和主循环的逻辑


我们看下GameObject这个部分：


一个GameObject对应一个人物。GameObject负责管理挂载的组件，它可以挂载PositionComponent、VelocityComponent、FlyComponent、InstanceComponent这四种组件，每种组件最多挂载一个


我们看下组件这个部分：


组件负责维护自己的数据，实现自己的行为逻辑。具体来说，是将NormalHero、SuperHero的position数据和move函数、update函数移到了PositionComponent中；将NormalHero、SuperHero的velocity数据移到了VelocityComponent中；将SuperHero的maxVelocity数据和fly函数移到了FlyComponent中


InstanceComponent没有数据和逻辑，它只是一个标记，用来表示挂载该组件的GameObject使用一次性批量渲染的算法来渲染


## 结合UML图，描述如何具体地解决问题


- 
现在只需要实现一次Position组件中的update、move函数，然后将它挂载到不同的GameObject中，就可以实现普通英雄和超级英雄的更新、移动的逻辑，从而消除了之前在NormalHero、SuperHero中因共实现了两次的update、move函数而造成的重复代码


- 
因为NormalHero、SuperHero都是GameObject，而GameObject本身只负责管理组件，没有行为逻辑，所以随着人物的行为的增加，GameObject并不会增加逻辑，而只需要增加对应行为的组件，让GameObject挂载该组件即可

通过这样的设计，将行为的逻辑和数据从人物移到了组件中，从而可以通过组合的方式使人物具有多个行为，避免了庞大的人物模块的出现


## 给出代码


首先，我们看下Client的代码；

然后，我们依次看下Client代码中前两个步骤的代码，它们包括：


- 创建WorldState的代码

- 创建场景的代码


然后，因为创建场景时操作了普通英雄和超级英雄，所以我们看下它们的代码，它们包括：


- 移动的相关代码

- 飞行的相关代码


然后，我们依次看下Client代码中剩余的两个步骤的代码，它们包括：


- 初始化和主循环的代码


然后，我们看下主循环的一帧中每个步骤的代码，它们包括：


- 主循环中更新的代码

- 主循环中渲染的代码


最后，我们运行Client的代码


### Client的代码


Client的代码跟之前的Client的代码基本上一样，故省略。不一样的地方是_createScene函数中创建场景的方式不一样，这个等会再讨论


### 创建WorldState的代码


World


```
export let createState = (): worldState => {
 return {
 gameObjects: Map()
 }
}

```

createState函数创建了WorldState，它保存了一个用来保存所有的gameObject的容器


### 创建场景的代码


Client


```
let _createScene = (worldState: worldState): worldState => {
 创建和加入normalHero1到worldState.gameObjects：
 创建gameObject
 创建positionComponent
 创建velocityComponent
 创建instanceComponent
 挂载positionComponent、velocityComponent、instanceComponent到gameObject
 加入gameObject到worldState.gameObjects

 创建和加入normalHero2到worldState.gameObjects

 normalHero1移动：
 调用normalHero1挂载的positionComponent的move函数

 创建和加入superHero1到worldState.gameObjects：
 创建gameObject
 创建positionComponent
 创建velocityComponent
 创建flyComponent
 挂载positionComponent、velocityComponent、flyComponent到gameObject
 加入gameObject到worldState.gameObjects

 创建和加入superHero2到worldState.gameObjects

 superHero1移动：
 调用superHero1挂载的positionComponent的move函数
 superHero1飞行：
 调用superHero1挂载的flyComponent的fly函数

 return worldState
}


```

_createScene函数创建了场景，场景的内容跟之前一样，都包括了2个普通英雄和2个超级英雄，只是现在创建一个英雄的方式改变了，具体变为：首先创建一个GameObject和相关的组件；然后挂载组件到GameObject；最后加入该GameObject到World中


普通英雄对应的GameObject挂载的组件跟超级英雄对应的GameObject挂载的组件也不一样，其中前者挂载了InstanceComponent（因为普通英雄需要一次性批量渲染），后者则挂载了FlyComponent（因为超级英雄多出了飞行的行为）


另外，现在改为通过调用对应组件的函数而不是直接操作英雄模块，从而实现英雄的“移动”、“飞行”


GameObject


```
//创建一个gameObject
export let create = (): [gameObjectState, gameObject] => {
 创建它的state数据：
 没有挂载任何的组件

 返回该gameObject
}

```

GameObject的create函数创建了一个gameObject，初始化了它的数据


PositionComponent


```
//创建一个positionComponent
export let create = (): positionComponentState => {
 创建它的state数据：
 gameObject设置为null
 position设置为[0,0,0]

 其中：position为位置，gameObject为挂载到的gameObject

 返回该组件
}

```

PositionComponent的create函数创建了一个positionComponent，初始化了它的数据


VelocityComponent


```
//创建一个velocityComponent
export let create = (): velocityComponentState => {
 创建它的state数据：
 gameObject设置为null
 velocity设置为1.0

 其中：velocity为速度，gameObject为挂载到的gameObject

 返回该组件
}

```

FlyComponent


```
//创建一个flyComponent
export let create = (): flyComponentState => {
 创建它的state数据：
 gameObject设置为null
 maxVelocity设置为1.0

 其中：maxVelocity为最大速度，gameObject为挂载到的gameObject

 返回该组件
}

```

InstanceComponent


```
//创建一个instanceComponent
export let create = (): instanceComponentState => {
 创建它的state数据：
 gameObject设置为null

 其中：gameObject为挂载到的gameObject

 返回该组件
}

```


这三种组件的create函数的职责跟PositionComponent的create函数的职责一样，不一样的是InstanceComponent的state数据中只有挂载到的gameObject，没有自己的数据


我们可以看到，组件的state数据中都保存了挂载到的gameObject，这样做的目的是可以通过它来获得挂载到它上的其它组件，从而一个组件可以操作其它挂载的组件


### 移动的相关代码


PositionComponent


```
...

//获得一个组件的position
export let getPosition = (positionComponentState: positionComponentState) => {
 return positionComponentState.position
}

//设置一个组件的position
export let setPosition = (positionComponentState: positionComponentState, position) => {
 return {
 ...positionComponentState,
 position: position
 }
}

...

//一个gameObject的移动
export let move = (worldState: worldState, positionComponentState: positionComponentState): worldState => {
 //获得该组件的position、gameObject
 let [x, y, z] = getPosition(positionComponentState)

 //通过该组件的gameObject，获得挂载到该gameObject的velocityComponent组件
 //获得它的velocity
 let gameObject = getExnFromStrictNull(positionComponentState.gameObject)
 let velocity = VelocityComponent.getVelocity(GameObject.getVelocityComponentExn(getGameObjectStateExn(worldState, gameObject)))

 //根据velocity，更新该组件的position
 positionComponentState = setPosition(positionComponentState, [x + velocity, y + velocity, z + velocity])

 更新worldState中该组件挂载的gameObject中的该组件的数据
}

```

VelocityComponent


```
//获得一个组件的velocity
export let getVelocity = (velocityComponentState: velocityComponentState) => {
 return velocityComponentState.velocity
}

```

PositionComponent维护了position数据，提供了它的get、set函数。VelocityComponent维护了velocity数据，，提供了它的get函数


另外，PositionComponent的move函数实现了移动的行为逻辑


### 飞行的相关代码


FlyComponent


```
//获得一个组件的maxVelocity
export let getMaxVelocity = (flyComponentState: flyComponentState) => {
 return flyComponentState.maxVelocity
}

//设置一个组件的maxVelocity
export let setMaxVelocity = (flyComponentState: flyComponentState, maxVelocity) => {
 return {
 ...flyComponentState,
 maxVelocity: maxVelocity
 }
}

//一个gameObject的飞行
export let fly = (worldState: worldState, flyComponentState: flyComponentState): worldState => {
 //获得该组件的maxVelocity、gameObject
 let maxVelocity = getMaxVelocity(flyComponentState)
 let gameObject = getExnFromStrictNull(flyComponentState.gameObject)

 //通过该组件的gameObject，获得挂载到该gameObject的positionComponent组件
 //获得它的position
 let [x, y, z] = PositionComponent.getPosition(GameObject.getPositionComponentExn(getGameObjectStateExn(worldState, gameObject)))

 //通过该组件的gameObject，获得挂载到该gameObject的velocityComponent组件
 //获得它的velocity
 let velocity = VelocityComponent.getVelocity(GameObject.getVelocityComponentExn(getGameObjectStateExn(worldState, gameObject)))

 //根据maxVelocity、velocity，更新positionComponent组件的position
 velocity = velocity {
 遍历worldState.gameObjects：
 if(gameObject挂载了positionComponent){
 更新positionComponent
 }
}

```

update函数实现了更新，它会遍历所有的gameObject，调用它挂载的PositionComponent组件的update函数来更新该组件。我们看下PositionComponent的update函数的代码：


```
//更新一个组件
export let update = (positionComponentState: positionComponentState): positionComponentState => {
 更新该组件的position
}

```

它的逻辑跟之前的NormalHero和SuperHero中的update函数的逻辑是一样的


### 主循环中渲染的代码


World


```
export let renderOneByOne = (worldState: worldState): void => {
 let superHeroGameObjects = worldState.gameObjects.filter(gameObjectState => {
 //判断gameObject是不是没有挂载InstanceComponent
 return !GameObject.hasInstanceComponent(gameObjectState)
 })

 superHeroGameObjects.forEach(gameObjectState => {
 console.log("OneByOne渲染 SuperHero...")
 })
}

export let renderInstances = (worldState: worldState): void => {
 let normalHeroGameObejcts = worldState.gameObjects.filter(gameObjectState => {
 //判断gameObject是不是挂载了InstanceComponent
 return GameObject.hasInstanceComponent(gameObjectState)
 })

 console.log("批量Instance渲染 NormalHeroes...")
}

```

renderOneByOne函数实现了超级英雄的渲染，它首先得到了所有没有挂载InstanceComponent组件的gameObject；最后遍历它们，一个一个地渲染


renderInstances函数实现了普通英雄的渲染，它首先得到了所有挂载了InstanceComponent组件的gameObject；最后批量渲染


### 运行Client的代码


下面，我们运行Client的代码，打印的结果如下：


```
初始化...
更新PositionComponent
更新PositionComponent
更新PositionComponent
更新PositionComponent
OneByOne渲染 SuperHero...
OneByOne渲染 SuperHero...
批量Instance渲染 NormalHeroes...
{"gameObjects":{"304480":{"positionComponent":{"gameObject":304480,"position":[0,0,0]},"velocityComponent":{"gameObject":304480,"velocity":1},"flyComponent":{"gameObject":304480,"maxVelocity":10},"instanceComponent":null},"666533":{"positionComponent":{"gameObject":666533,"position":[2,2,2]},"velocityComponent":{"gameObject":666533,"velocity":1},"flyComponent":null,"instanceComponent":{"gameObject":666533}},"838392":{"positionComponent":{"gameObject":838392,"position":[0,0,0]},"velocityComponent":{"gameObject":838392,"velocity":1},"flyComponent":null,"instanceComponent":{"gameObject":838392}},"936933":{"positionComponent":{"gameObject":936933,"position":[6,6,6]},"velocityComponent":{"gameObject":936933,"velocity":1},"flyComponent":{"gameObject":936933,"maxVelocity":10},"instanceComponent":null}}}

```

通过打印的数据，可以看到运行的步骤与之前一样

不同之处在于：


- 更新4个英雄现在变为更新4个positionComponent

- 打印的WorldState不一样


我们看下打印的WorldState：


- WorldState的gameObjects包括了4个gameObject的数据，其中有一个gameObject数据的positionComponent的position为[2,2,2]，说明它进行了移动操作；

- 有一个gameObject数据的positionComponent的position为[6,6,6]，说明它进行了移动和飞行操作


值得注意的是：

因为WorldState的gameObjects中的Key是随机生成的id值，所以每次打印时Key都不一样


## 提出问题


- 组件的数据分散在各个组件中，性能不好

如position数据现在是一对一地分散保存在各个positionComponent组件中（即一个positionComponent组件保存自己的position），那么如果需要遍历所有组件的position数据，则需要遍历所有的positionComponent组件，分别获得它们的position。因为每个positionComponent组件的数据并没有连续地保存在内存中，所以会造成缓存命中丢失，带来性能损失


- 涉及多种组件的行为不知道放在哪里

如果超级英雄增加一个“跳”的行为，该行为不仅需要修改position数据，还需要修改velocity数据，那么实现该行为的jump函数应该放在哪个组件中呢？

因为jump函数需要同时修改PositionComponent组件的position数据和VelocityComponent组件的velocity数据，所以将它放在两者中任何一种组件中都不合适。因此需要增加一种新的组件-JumpComponent，对应“跳”这个行为，并实现jump函数。该函数会通过JumpComponent挂载到的gameObject来获得挂载到它上的PositionComponent和VelocityComponent组件，从而修改它们的数据。

如果增加更多的这种涉及多种组件的行为，就需要为每个这样的行为增加一种组件。因为组件比较重，既有数据又有逻辑，所以增加组件的成本较高；另外，因为组件与GameObject是聚合关系，而GameObject和World也是聚合关系，它们都属于强关联关系，所以增加组件会较强地影响GameObject和World，这也增加了成本


# 使用ECS模式来改进


## 概述解决方案


- 
基于Data Oriented的思想进行改进

组件可以按角色分为Data Oriented组件和其它组件，其中前者的特点是属于该角色的每个组件都有数据，且组件的数量较多；后者的特点是属于该角色的每个组件都没有数据，或者组件的数量很少。这里具体说明一下各种组件的角色：目前一共有四种组件，它们是PositionComponent、VelocityComponent、FlyComponent、InstanceComponent。其中，InstanceComponent组件因为没有组件数据，所以属于“其它组件”；另外三种组件则都属于“Data Oriented组件”。

属于Data Oriented组件的三种组件的所有组件数据将会分别集中起来，保存在各自的一块连续的地址空间中，具体就是分别保存在三个ArrayBuffer中


- 
将GameObject和各个组件扁平化

GameObject不再有数据和逻辑了，而只是一个全局唯一的id。组件也不再有数据和逻辑了，其中属于“Data Oriented组件”的组件只是一个ArrayBuffer上的索引；属于“其它组件”的组件只是一个全局唯一的id


- 
增加Component+GameObject这一层，将扁平的GameObject和组件放在该层中


- 
增加Manager这一层，来管理GameObject和组件的数据

这一层有GameObjectManager和四种组件的Manager，其中GameObjectManager负责管理所有的gameObject；四种组件的Manager负责管理自己的ArrayBuffer，操作属于该种类的所有组件


- 增加System这一层，来实现行为的逻辑

一个System实现一个行为，比如这一层中的MoveSystem、FlySystem分别实现了移动和飞行的行为逻辑


值得注意的是：


- GameObject和组件的数据被移到了Manager中，逻辑则被移到了Manager和System中。其中只操作自己数据的逻辑（如getPosition、setPosition）被移到了Manager中，其它逻辑（通常为行为逻辑，需要操作多种组件）被移到了System中

- 一种组件的Manager只对该种组件进行操作，而一个System可以对多种组件进行操作


## 给出UML


**领域模型**


![image](https://img2024.cnblogs.com/blog/419321/202401/419321-20240119080525699-813542014.png)


总体来看，领域模型分为五个部分：用户、World、System层、Manager层、Component+GameObject层，它们的依赖关系是前者依赖后者


我们看下用户、World这两个部分：

Client是用户


World是游戏世界，虽然仍然实现了初始化和主循环的逻辑，不过不再管理所有的GameObject了


我们看下System这一层：


有多个System，每个System实现一个行为逻辑。每个System的职责如下：


- CreateStateSystem实现创建WorldState的逻辑，创建的WorldState包括了所有的Manager的state数据；

- UpdateSystem实现更新所有人物的position的逻辑，具体是更新所有PositionComponent的position；

- MoveSystem实现一个人物的移动的逻辑，具体是根据挂载到该人物gameObject上的一个positionComponent和一个velocityComponent，更新该positionComponent的position；

- FlySystem实现一个人物的飞行的逻辑，具体是根据挂载到该人物gameObject上的一个positionComponent、一个velocityComponent、一个flyComponent，更新该positionComponent的position；

- RenderOneByOneSystem实现渲染所有超级英雄的逻辑；

- RenderInstancesSystem实现渲染所有普通英雄的逻辑


我们看下Manager这一层：


每个Manager都有一个state数据


GameObjectManager负责管理所有的gameObject


PositionComponentManager、VelocityComponentManager、FlyComponentManager、InstanceComponentManager负责管理属于各自种类的所有的组件


PositionComponentManager的state数据包括一个buffer字段和一个positions字段，其中前者是一个ArrayBuffer，保存了该种组件的所有组件数据；后者是buffer的视图，用于读写buffer中的position数据


PositionComponentManager的batchUpdate函数负责批量更新所有的positionComponent组件的position


因为VelocityComponentManager、FlyComponentManager与PositionComponentManager一样，都属于Data Oriented组件的Manager，所以它们的数据和函数类似（只是没有batchUpdate函数），故在图中省略它们的数据和函数


我们看下Component+GameObject这一层：


因为PositionComponent、VelocityComponent、FlyComponent属于Data Oriented组件，所以它们是一个index，也就是各自Manager的state的buffer中的索引值


因为InstanceComponent属于其它组件，所以它是一个全局唯一的id


GameObject是一个全局唯一的id


我们来看下依赖关系：


System层：


因为CreateSystem需要调用各个Manager的createState函数来创建它们的state，所以依赖了整个Manager层


因为UpdateSystem需要调用PositionComponentManager的batchUpdate函数来更新，所以依赖了PositionComponentManager


因为MoveSystem需要调用PositionComponentManager来获得和设置position，并且调用VelocityComponentManager来获得velocity，所以依赖了PositionComponentManager、VelocityComponentManager


因为FlySystem需要调用PositionComponentManager来获得和设置position，并且调用VelocityComponentManager、FlyComponentManager来分别获得velocity和maxVelocity，所以依赖了PositionComponentManager、VelocityComponentManager、FlyComponentManager


因为RenderOneByOneSystem和RenderInstancesSystem需要调用GameObjectManager来获得所有的gameObject，并调用各种组件的Manager来获得组件数据，所以依赖了整个Manager层


Manager层：


因为GameObjectManager需要操作GameObject，所以依赖了GameObject


因为各种组件的Manager需要操作所有的该种组件，所以依赖了对应的组件


## 结合UML图，描述如何具体地解决问题


- 
现在各种组件的数据都集中保存在各自Manager的state的buffer（ArrayBuffer）中，遍历同一种组件的所有组件数据即是遍历一个ArrayBuffer。因为ArrayBuffer的数据是连续地保存在内存中的，所以缓存命中不会丢失，从而提高了性能


- 
现在将涉及多种组件的行为放在对应的System中。因为System很轻，没有数据，只有逻辑，所以增加和维护System的成本较低；另外，因为System位于最上层，所以修改System也不会影响Manager层和Component+GameObject层


## 给出代码


首先，我们看下Client的代码；

然后，我们看下Client代码中第一步的代码：


- 创建WorldState的代码


然后，因为创建WorldState时会创建Data Oriented组件的Manager的state，其中的关健是创建各自的ArrayBuffer，所以我们看下创建它的代码；

然后，我们看下Client代码中第二步的代码：


- 创建场景的代码


然后，因为创建场景时操作了普通英雄和超级英雄，所以我们看下它们的代码，它们包括：


- 移动的相关代码

- 飞行的相关代码


然后，我们依次看下Client代码中剩余的两个步骤的代码，它们包括：


- 初始化和主循环的代码


然后，我们看下主循环的一帧中每个步骤的代码，它们包括：


- 主循环中更新的代码

- 主循环中渲染的代码


最后，我们运行Client的代码


### Client的代码


Client


```
let worldState = World.createState({ positionComponentCount: 10, velocityComponentCount: 10, flyComponentCount: 10 })

跟之前一样...

```

Client的代码跟之前的Client的代码基本一样，除了createState函数的参数和_createScene函数中创建场景的方式不一样，这个等会再讨论


### 创建WorldState的代码


World


```
export let createState = CreateStateSystem.createState

```

CreateStateSystem


```
export let createState = ({ positionComponentCount, velocityComponentCount, flyComponentCount }): worldState => {
 return {
 gameObjectManagerState: GameObjectManager.createState(),
 positionComponentManagerState: PositionComponentManager.createState(positionComponentCount),
 velocityComponentManagerState: VelocityComponentManager.createState(velocityComponentCount),
 flyComponentManagerState: FlyComponentManager.createState(flyComponentCount),
 instanceComponentManagerState: InstanceComponentManager.createState()
 }
}

```

CreateStateSystem的createState函数创建了WorldState，它保存了各个Manager的state


因为Data Oriented组件的Manager的state在创建时要创建包括该种组件的所有组件数据的ArrayBuffer，需要知道该种组件的最大个数，所以这里的createState函数接收了三种Data Oriented组件的最大个数


### 创建ArrayBuffer的代码


我们以PositionComponentManager为例，来看下它的createState函数的相关代码：

position_component/ManagerStateType


```
export type state = {
 maxIndex: number,
 buffer: ArrayBuffer,
 positions: Float32Array,
 ...
}

```

这是PositionComponentManager的state的类型定义，它的字段解释如下：


- buffer字段保存了一个ArrayBuffer，它用来保存所有的positionComponent的数据。目前每个positionComponent的数据只有position，它的类型是三个float

- positions字段保存了ArrayBuffer的一个视图，通过它可以读写所有的positionComponent的position

- maxIndex字段是ArrayBuffer上最大的索引值，用于在创建一个positionComponent时生成它的index值


position_component/Manager


```
let _setAllTypeArrDataToDefault = ([positions]: Array, count, [defaultPosition]) => {
 range(0, count - 1).forEach(index => {
 OperateTypeArrayUtils.setPosition(index, defaultPosition, positions)
 })

 return [positions]
}

let _initBufferData = (count, defaultDataTuple): [ArrayBuffer, Array] => {
 let buffer = BufferUtils.createBuffer(count)

 let typeArrData = _setAllTypeArrDataToDefault(CreateTypeArrayUtils.createTypeArrays(buffer, count), count, defaultDataTuple)

 return [buffer, typeArrData]
}

export let createState = (positionComponentCount: number): state => {
 let defaultPosition = [0, 0, 0]

 let [buffer, [positions]] = _initBufferData(positionComponentCount, [defaultPosition])

 return {
 maxIndex: 0,
 buffer,
 positions,
 ...
 }
}

```

这是PositionComponentManager的createState函数的代码，其中调用的_initBufferData函数创建了buffer和positions，它的步骤如下：

1.调用BufferUtils的createBuffer函数来创建包括最大组件个数的数据的ArrayBuffer

2.调用CreateTypeArrayUtils的createTypeArrays函数来创建所有的TypeArray，它们是操作ArrayBuffer的视图。这里具体是只创建了一个视图：positions

3.调用_setAllTypeArrDataToDefault函数来将positions的所有的值写为默认值：[0,0,0]


下面是BufferUtils的createBuffer函数和CreateTypeArrayUtils的createTypeArrays函数的相关代码：

position_component/BufferUtils


```
let _getPositionSize = () => 3

export let getPositionOffset = (count) => 0

export let getPositionLength = (count) => count * _getPositionSize()

export let getPositionIndex = index => index * _getPositionSize()

let _getTotalByteLength = (count) => {
 return count * Float32Array.BYTES_PER_ELEMENT * _getPositionSize()
}

export let createBuffer = (count) => {
 return new ArrayBuffer(_getTotalByteLength(count))
}

```

position_component/CreateTypeArrayUtils


```
export let createTypeArrays = (buffer, count) => {
 return [
 new Float32Array(buffer, BufferUtils.getPositionOffset(count), BufferUtils.getPositionLength(count))
 ]
}

```

另外两种Data Oriented组件的Manager（VelocityComponentManager、FlyComponentManager）的createState函数的逻辑跟PositionComponentManager的createState函数的逻辑一样，故省略相关代码


### 创建场景的代码


Client


```
let _createScene = (worldState: worldState): worldState => {
 创建normalHero1：
 创建gameObject
 创建positionComponent
 创建velocityComponent
 创建instanceComponent
 挂载positionComponent、velocityComponent、instanceComponent到gameObject

 创建normalHero2

 normalHero1移动：
 调用MoveSystem的move函数，传入normalHero1的positionComponent、velocityComponent

 创建superHero1
 创建gameObject
 创建positionComponent
 创建velocityComponent
 创建flyComponent
 挂载positionComponent、velocityComponent、flyComponent到gameObject

 创建superHero2

 superHero1移动：
 调用MoveSystem的move函数，传入superHero1的positionComponent、velocityComponent
 superHero1飞行：
 调用FlySystem的fly函数，传入superHero1的positionComponent、velocityComponent、flyComponent

 return worldState
}

```

_createScene函数创建了场景，场景的内容跟之前一样，都包括了2个普通英雄和2个超级英雄，只是现在创建一个英雄的方式又改变了，具体变为：现在不需要加入GameObject到World中


另外，现在改为通过调用MoveSystem和FlySystem的函数来操作对应的组件，从而实现英雄的“移动”、“飞行”


gameObject/Manager


```
export let createState = (): state => {
 return {
 maxUID: 0
 }
}

//创建一个gameObject
//一个gameObject就是一个uid
export let createGameObject = (state: state): [state, gameObject] => {
 let uid = state.maxUID

 //生成一个uid
 //uid的意思是unique id，即全局唯一的id
 let newUID = uid + 1

 state = {
 ...state,
 maxUID: newUID
 }

 return [state, uid]
}

```

GameObjectManager的createGameObject函数创建了一个gameObject，它就是一个全局唯一的id


position_component/Manager


```
//创建一个positionComponent
//一个positionComponent就是一个index
export let createComponent = (state: state): [state, component] => {
 let index = state.maxIndex
 
 //生成一个index
 let newIndex = index + 1

 state = {
 ...state,
 maxIndex: newIndex
 }

 return [state, index]
}

```


PositionComponentManager的createComponent函数创建了一个positionComponent，它就是一个PositionComponentManager的state的buffer上的索引


VelocityComponentManager、FlyComponentManager的相关代码跟PositionComponentManager类似，故省略相关代码


instance_component/Manager


```
//创建一个instanceComponent
//一个instanceComponent就是一个uid
export let createComponent = (state: state): [state, component] => {
 let uid = state.maxUID

 //生成一个id
 let newUID = uid + 1

 state = {
 ...state,
 maxUID: newUID
 }

 return [state, uid]
}

```

InstanceComponentManager的createComponent函数创建了一个instanceComponent，因为InstanceComponent组件属于“其它组件”，所以它跟GameObject一样都是一个全局唯一的id而不是一个index


### 移动的相关代码


MoveSystem


```
//一个gameObject的移动
export let move = (worldState: worldState, positionComponent, velocityComponent): worldState => {
 let [x, y, z] = PositionComponentManager.getPosition(worldState.positionComponentManagerState, positionComponent)

 let velocity = VelocityComponentManager.getVelocity(worldState.velocityComponentManagerState, velocityComponent)

 //根据velocity，更新positionComponent的position
 let positionComponentManagerState = PositionComponentManager.setPosition(worldState.positionComponentManagerState, positionComponent, [x + velocity, y + velocity, z + velocity])

 return {
 ...worldState,
 positionComponentManagerState: positionComponentManagerState
 }
}

```

MoveSystem的move函数实现移动的行为逻辑。这里涉及到读写Data Oriented组件的ArrayBuffer上的数据。我们来看下读写PositionComponentManager的positions的相关代码：

position_component/Manager


```
export let getPosition = (state: state, component: component) => {
 return OperateTypeArrayUtils.getPosition(component, state.positions)
}

export let setPosition = (state: state, component: component, position) => {
 OperateTypeArrayUtils.setPosition(component, position, state.positions)

 return state
}

```

position_component/OperateTypeArrayUtils


```
export let getPosition = (index, typeArr) => {
 return TypeArrayUtils.getFloat3Tuple(BufferUtils.getPositionIndex(index), typeArr)
}

export let setPosition = (index, data, typeArr) => {
 TypeArrayUtils.setFloat3(BufferUtils.getPositionIndex(index), data, typeArr)
}

```

TypeArrayUtils


```
export let getFloat3Tuple = (index, typeArray) => {
 return [
 typeArray[index],
 typeArray[index + 1],
 typeArray[index + 2]
 ]
}

export let setFloat3 = (index, param, typeArray) => {
 typeArray[index] = param[0]
 typeArray[index + 1] = param[1]
 typeArray[index + 2] = param[2]
}

```

position_component/BufferUtils


```
let _getPositionSize = () => 3

...

export let getPositionIndex = index => index * _getPositionSize()

```

通过代码可知，实现“读写PositionComponentManager的ArrayBuffer上的数据”的思路是：

因为一个positionComponent的值是ArrayBuffer的索引，所以使用它来读写ArrayBuffer的视图positions中的对应数据


### 飞行的相关代码


FlySystem


```
//一个gameObject的飞行
export let fly = (worldState: worldState, positionComponent, velocityComponent, flyComponent): worldState => {
 let [x, y, z] = PositionComponentManager.getPosition(worldState.positionComponentManagerState, positionComponent)

 let velocity = VelocityComponentManager.getVelocity(worldState.velocityComponentManagerState, velocityComponent)

 let maxVelocity = FlyComponentManager.getMaxVelocity(worldState.flyComponentManagerState, flyComponent)

 //根据maxVelociy、velocity，更新positionComponent的position
 velocity = velocity {
 let positionComponentManagerState = PositionComponentManager.batchUpdate(worldState.positionComponentManagerState)

 return {
 ...worldState,
 positionComponentManagerState: positionComponentManagerState
 }
}

```

UpdateSystem的update函数实现了更新，它调用了PositionComponentManager的batchUpdate函数来批量更新所有的positionComponent组件。我们看下PositionComponentManager的相关代码：

position_component/Manager


```
export let getAllComponents = (state: state): Array => {
 从state中获得所有的positionComponents
}

export let batchUpdate = (state: state) => {
 return getAllComponents(state).reduce((state, component) => {
 更新position
 }, state)
}

```

batchUpdate函数遍历所有的positionComponent，更新它们的position。更新的逻辑跟之前一样


### 主循环中渲染的代码


World


```
export let renderOneByOne = RenderOneByOneSystem.render

```

RenderOneByOneSystem


```
export let render = (worldState: worldState): void => {
 let superHeroGameObjects = GameObjectManager.getAllGameObjects(worldState.gameObjectManagerState).filter(gameObject => {
 //判断gameObject是不是没有挂载InstanceComponent
 return !InstanceComponentManager.hasComponent(worldState.instanceComponentManagerState, gameObject)
 })

 superHeroGameObjects.forEach(gameObjectState => {
 console.log("OneByOne渲染 SuperHero...")
 })
}

```

gameObject/Manager


```
export let getAllGameObjects = (state: state): Array => {
 let { maxUID } = state

 //返回[0, 1, ..., maxUID-1]的数组
 return range(0, maxUID - 1)
}

```

RenderOneByOneSystem的render函数实现了超级英雄的渲染，它首先得到了所有没有挂载InstanceComponent组件的gameObject；最后一个一个地渲染


World


```
export let renderInstances = RenderInstancesSystem.render

```

RenderInstancesSystem


```
export let render = (worldState: worldState): void => {
 let normalHeroGameObejcts = GameObjectManager.getAllGameObjects(worldState.gameObjectManagerState).filter(gameObject => {
 //判断gameObject是不是挂载了InstanceComponent
 return InstanceComponentManager.hasComponent(worldState.instanceComponentManagerState, gameObject)
 })

 console.log("批量Instance渲染 NormalHeroes...")
}

```

RenderInstancesSystem的render函数实现了普通英雄的渲染，它首先得到了所有挂载了InstanceComponent组件的gameObject；最后一次性批量渲染


### 运行Client的代码


下面，我们运行Client的代码，打印的结果如下：


```
初始化...
更新PositionComponent: 0
更新PositionComponent: 1
更新PositionComponent: 2
更新PositionComponent: 3
OneByOne渲染 SuperHero...
OneByOne渲染 SuperHero...
批量Instance渲染 NormalHeroes...
{"gameObjectManagerState":{"maxUID":4},"positionComponentManagerState":{"maxIndex":4,"buffer":{},"positions":{"0":2,"1":2,"2":2,"3":0,"4":0,"5":0,"6":6,"7":6,"8":6,"9":0,"10":0,"11":0,"12":0,"13":0,"14":0,"15":0,"16":0,"17":0,"18":0,"19":0,"20":0,"21":0,"22":0,"23":0,"24":0,"25":0,"26":0,"27":0,"28":0,"29":0},"gameObjectMap":{"0":0,"1":1,"2":2,"3":3},"gameObjectPositionMap":{"0":0,"1":1,"2":2,"3":3}},"velocityComponentManagerState":{"maxIndex":4,"buffer":{},"velocitys":{"0":1,"1":1,"2":1,"3":1,"4":1,"5":1,"6":1,"7":1,"8":1,"9":1},"gameObjectMap":{"0":0,"1":1,"2":2,"3":3},"gameObjectVelocityMap":{"0":0,"1":1,"2":2,"3":3}},"flyComponentManagerState":{"maxIndex":1,"buffer":{},"maxVelocitys":{"0":10,"1":10,"2":10,"3":10,"4":10,"5":10,"6":10,"7":10,"8":10,"9":10},"gameObjectMap":{"0":2,"1":3},"gameObjectFlyMap":{"2":0,"3":1}},"instanceComponentManagerState":{"maxUID":1,"gameObjectMap":{"0":0,"1":1},"gameObjectInstanceMap":{"0":0,"1":1}}}

```

通过打印的数据，可以看到运行的步骤与之前一样

不同之处在于：


- 打印的WorldState不一样


我们看下打印的WorldState：


- WorldState的gameObjectManagetState的maxUID为4，说明创建了4个gameObject；

- WorldState的positionComponentManagerState的maxIndex为4，说明创建了4个positionComponent；

- WorldState的positionComponentManagerState的positions有3个连续的值是2、2、2，说明有一个positionComponent组件进行了移动操作；有另外3个连续的值是6、6、6，说明有另外一个positionComponent组件进行了移动操作和飞行操作；


# 定义


## 一句话定义


组合代替继承；连续地保存组件数据；分离逻辑和数据


## 补充说明


“组合代替继承”是指基于组件化思想，通过GameObject组合不同的组件代替GameObject层层继承


“连续地保存组件数据”是指基于Data Oriented思想，将Data Oriented组件的组件数据集中起来，保存在内存中连续的地址空间


“分离逻辑和数据”是指将GameObject和组件扁平化，将它们的数据放到Manager层，将它们的逻辑放到System层和Manager层。其中，只操作自己数据的逻辑（如getPosition、setPosition）被移到了Manager中，其它逻辑（通常为行为逻辑，需要操作多种组件）被移到了System中


## 通用UML


**领域模型**


![image](https://img2024.cnblogs.com/blog/419321/202401/419321-20240119080531552-1529443173.png)


总体来看，领域模型分为用户、World、System层、Manager层、Component+GameObject层五个部分，它们的依赖关系是前者依赖后者。其中，System层负责实现行为的逻辑；Manager层负责管理场景数据，即管理GameObject和组件的数据；Component+GameObject层为组件和GameObject，它们现在只是有一个number类型的数据的值对象


我们看下用户这个部分：


- Client

该角色是用户


我们看下World这个部分：


- World

该角色是门户，提供了API，实现了初始化和主循环的逻辑


我们看下System这一层：


一个System实现一个行为的逻辑


- 
CreateStateSystem

该角色负责创建WorldState


- 
OtherSystem

该角色是除了CreateStateSystem以外的所有System，它们各自有一个函数action，用于实现某个行为


我们看下Manager这一层：


每个Manager都有一个state数据


- 
GameObjectManager

该角色负责管理所有的gameObject


- 
DataOrientedComponentManager

该角色是一种Data Oriented组件的Manager，负责维护和管理该种组件的所有组件数据，将其集中地保存在各自的state的buffer中

DataOrientedComponentManager的state数据包括一个buffer字段和多个“typeArray of buffer”字段，其中前者是一个ArrayBuffer，保存了该种组件的所有组件数据；后者是buffer的多个视图，用于读写buffer中对应的数据


- 
OtherComponentManager

该角色是一种其它组件的Manager，负责维护和管理该种组件的所有组件数据

OtherComponentManager的state数据包括多个“value map”字段，它们是多个Hash Map，每个Hash Map保存一类组件数据


我们看下Component+GameObject这一层：


- 
DataOrientedComponent

该角色是一种Data Oriented组件中的一个组件，它是一个ArrayBuffer上的索引


- 
OtherComponent

该角色是一种其它组件中的一个组件，它是一个全局唯一的id


- 
GameObject

该角色是一个gameObject，它是一个全局唯一的id


**角色之间的关系**


- 
只有一个CreateStateSystem


- 
可以有多个OtherSystem，每个OtherSystem实现一个行为


- 
只有一个GameObjectManager


- 
可以有多个DataOrientedComponentManager，每个对应一种Data Oriented组件


- 
可以有多个DataOrientedComponent，每个对应一种Data Oriented组件


- 
可以有多个OtherComponentManager，每个对应一种其它组件


- 可以有多个OtherComponent，每个对应一种其它组件


System层：


- 因为CreateSystem需要调用各个Manager的createState函数来创建它们的state，所以依赖了整个Manager层


- 因为OtherSystem可能需要调用1个GameObjectManager来处理gameObject、调用多个DataOrientedComponentManager和OtherComponentManager来处理各自种类的组件，所以它与GameObjectManager是一对一的依赖关系，与DataOrientedComponentManager和OtherComponentManager都是一对多的依赖关系


Manager层：


- 因为GameObjectManager需要操作多个GameObject，所以它与GameObject是一对多的依赖关系


- 
因为DataOrientedComponentManager和DataOrientedComponent对应同一种Data Oriented组件，且前者管理所有的后者，所以前者和后者是一对多的依赖关系


- 
因为OtherComponentManager和OtherComponent对应同一种其它组件，且前者管理所有的后者，所以前者和后者是一对多的依赖关系


Component+GameObject层：


- 因为一个GameObject可以挂载各种组件，其中每种组件只能挂载一个，所以GameObject与DataOrientedComponent、OtherComponent都是一对一的组合关系


## 角色的抽象代码


下面我们来看看各个角色的抽象代码：


我们按照依赖关系，从上往下依次看下领域模型中用户、World、System层、Manager层、Component+GameObject层这五个部分的抽象代码：


首先，我们看下属于用户的抽象代码

然后，我们看下World的抽象代码

然后，我们看下System层的抽象代码，它们包括：


- CreateStateSystem的抽象代码

- OtherSystem的抽象代码


然后，我们看下Manager层的抽象代码，它们包括：


- GameObjectManager的抽象代码

- DataOrientedComponentManager的抽象代码

- OtherComponentManager的抽象代码


最后，我们看下Component+GameObject层的抽象代码，它们包括：


- GameObject的抽象代码

- DataOrientedComponent的抽象代码

- OtherComponent的抽象代码


### 用户的抽象代码


Client


```
let _createScene = (worldState: worldState): worldState => {
 创建gameObject1
 创建组件
 挂载组件

 触发gameObject1的行为

 创建更多的gameObjects...

 return worldState
}

let worldState = World.createState({ dataOrientedComponent1Count: xx })

worldState = _createScene(worldState)

worldState = World.init(worldState)

World.loop(worldState)

```

### World的抽象代码


World


```
export let createState = CreateStateSystem.createState

export let action1 = OtherSystem1.action

export let init = (worldState: worldState): worldState => {
 初始化...

 return worldState
}


//假实现
let requestAnimationFrame = (func) => {
}


export let loop = (worldState: worldState) => {
 调用OtherSystem来更新

 调用OtherSystem来渲染

 requestAnimationFrame(
 (time) => {
 loop(worldState)
 }
 )
}

```

### CreateStateSystem的抽象代码


CreateStateSystem


```
export let createState = ({ dataOrientedComponent1Count }): worldState => {
 return {
 gameObjectManagerState: GameObjectManager.createState(),
 dataOrientedComponent1ManagerState: DataOrientedComponent1Manager.createState(dataOrientedComponent1Count),
 otherComponent1ManagerState: OtherComponent1Manager.createState(),

 创建更多的DataOrientedManagerState和OtherComponentManagerState...
 }
}

```

### OtherSystem的抽象代码


OtherSystem1


```
export let action = (worldState: worldState, gameObject?: gameObject, dataOrientedComponentX?: dataOrientedComponentX, otherComponentX?: otherComponentX) => {
 行为的逻辑...

 return worldState
}

```

有多个OtherSystem，这里只给出一个OtherSystem的抽象代码


### GameObjectManager的抽象代码


gameObject/ManagerStateType


```
export type state = {
 maxUID: number
}

```

gameObject/Manager


```
export let createState = (): state => {
 return {
 maxUID: 0
 }
}

export let createGameObject = (state: state): [state, gameObject] => {
 let uid = state.maxUID

 let newUID = uid + 1

 state = {
 ...state,
 maxUID: newUID
 }

 return [state, uid]
}

export let getAllGameObjects = (state: state): Array => {
 let { maxUID } = state

 return range(0, maxUID - 1)
}

```

### DataOrientedComponentManager的抽象代码


dataoriented_component1/ManagerStateType


```
export type TypeArrayType = Float32Array | Uint8Array | Uint16Array | Uint32Array

export type state = {
 maxIndex: number,
 //buffer保存了该种组件所有的value1、value2、...、valueX数据
 buffer: ArrayBuffer,
 //该种组件所有的value1数据的视图
 value1s: TypeArrayType,
 //该种组件所有的value2数据的视图
 value2s: TypeArrayType,
 更多valueXs...,

 ...
}

```

dataoriented_component1/Manager


```
let _setAllTypeArrDataToDefault = ([value1s, value2s]: Array, count, [defaultValue1, defaultValue2]) => {
 range(0, count - 1).forEach(index => {
 OperateTypeArrayUtils.setValue1(index, defaultValue1, value1s)
 OperateTypeArrayUtils.setValue2(index, defaultValue2, value2s)
 })

 return [value1s, value2s]
}

let _initBufferData = (count, defaultDataTuple): [ArrayBuffer, Array] => {
 let buffer = BufferUtils.createBuffer(count)

 let typeArrData = _setAllTypeArrDataToDefault(CreateTypeArrayUtils.createTypeArrays(buffer, count), count, defaultDataTuple)

 return [buffer, typeArrData]
}

export let createState = (dataorientedComponentCount: number): state => {
 let defaultValue1 = default value1
 let defaultValue2 = default value2

 let [buffer, [value1s, value2s]] = _initBufferData(dataorientedComponentCount, [defaultValue1, defaultValue2])

 return {
 maxIndex: 0,
 buffer,
 value1s,
 value2s,
 ...
 }
}

export let createComponent = (state: state): [state, component] => {
 let index = state.maxIndex

 let newIndex = index + 1

 state = {
 ...state,
 maxIndex: newIndex
 }

 return [state, index]
}

...

export let getAllComponents = (state: state): Array => {
 从state中获得所有的dataorientedComponent1s
}

export let getValue1 = (state: state, component: component) => {
 return OperateTypeArrayUtils.getValue1(component, state.value1s)
}

export let setValue1 = (state: state, component: component, position) => {
 OperateTypeArrayUtils.setValue1(component, position, state.value1s)

 return state
}

get/set value2...

export let batchOperate = (state: state) => {
 let allComponents = getAllComponents(state)

 console.log("批量操作")

 return state
}

```

dataoriented_component1/BufferUtils


```
// 这里只给出了两个value的情况
// 更多的value也以此类推...

let _getValue1Size = () => value1 size

let _getValue2Size = () => value2 size

export let getValue1Offset = () => 0

export let getValue2Offset = (count) => getValue1Offset() + getValue1Length(count) * TypeArray2.BYTES_PER_ELEMENT

export let getValue1Length = (count) => count * _getValue1Size()

export let getValue2Length = (count) => count * _getValue2Size()

export let getValue1Index = index => index * _getValue1Size()

export let getValue2Index = index => index * _getValue2Size()

let _getTotalByteLength = (count) => {
 return count * (TypeArray1.BYTES_PER_ELEMENT * (_getValue1Size() + TypeArray2.BYTES_PER_ELEMENT * (_getValue2Size())))
}

export let createBuffer = (count) => {
 return new ArrayBuffer(_getTotalByteLength(count))
}

```

dataoriented_component1/CreateTypeArrayUtils


```
export let createTypeArrays = (buffer, count) => {
 return [
 new Float32Array(buffer, BufferUtils.getValue1Offset(), BufferUtils.getValue1Length(count)),
 new Float32Array(buffer, BufferUtils.getValue2Offset(count), BufferUtils.getValue2Length(count)),
 ]
}

```

有多个DataOrientedComponentManager，这里只给出一个DataOrientedComponentManager的抽象代码


### OtherComponentManager的抽象代码


other_component1/ManagerStateType


```
export type state = {
 maxUID: number,
 //value1Map用来保存该种组件所有的value1数据
 value1Map: Map,
 更多valueXMap...,

 ...
}

```

other_component1/Manager


```
export let createState = (): state => {
 return {
 maxUID: 0,
 value1Map: Map(),
 ...
 }
}

export let createComponent = (state: state): [state, component] => {
 let uid = state.maxUID

 let newUID = uid + 1

 state = {
 ...state,
 maxUID: newUID
 }

 return [state, uid]
}

...

export let getAllComponents = (state: state): Array => {
 从state中获得所有的otherComponent1s
}

export let getValue1 = (state: state, component: component) => {
 return getExnFromStrictUndefined(state.value1Map.get(component))
}

export let setValue1 = (state: state, component: component, value1) => {
 return {
 ...state,
 value1Map: state.value1Map.set(component, value1)
 }
}

export let batchOperate = (state: state) => {
 let allComponents = getAllComponents(state)

 console.log("批量操作")

 return state
}

```

有多个OtherComponentManager，这里只给出一个OtherComponentManager的抽象代码


### GameObject的抽象代码


GameObjectType


```
type id = number

export type gameObject = id

```

### DataOrientedComponent的抽象代码


DataOrientedComponent1Type


```
type index = number

export type component = index

```

有多个DataOrientedComponent，这里只给出一个DataOrientedComponent的抽象代码


### OtherComponent的抽象代码


OtherComponent1Type


```
type id = number

export type component = id

```

有多个OtherComponent，这里只给出一个OtherComponent的抽象代码


## 遵循的设计原则在UML中的体现


ECS模式主要遵循下面的设计原则：


- 单一职责原则

每个System只实现一个行为；每个组件的Manager只管理一种组件

- 合成复用原则

GameObject组合了多个组件

- 接口隔离原则

GameObject和组件经过了扁平化处理，移除了数据和逻辑，改为只是有一个number类型数据的值对象

- 最少知识原则

World、System、Manager、Component+GameObject这几个层只能上层依赖下层，不能跨层依赖

- 开闭原则

要增加一种行为，只需要增加一个System，不会影响Manager


# 应用


## 优点


- 
组件的数据集中连续地保存在ArrayBuffer中，增加了缓存命中，提高了读写的性能


- 
创建和删除组件的性能也很好，因为在这个过程中不会分配或者销毁内存，所以没有垃圾回收的开销

这是因为在创建ArrayBuffer时就预先按照最大组件个数分配了一块连续的内存，所以在创建组件时，只是返回一个当前最大索引(maxIndex)的值而已；在删除组件时，只是将ArrayBuffer中该组件对应的数据还原为默认值而已


- 
职责划分明确，行为的逻辑应该放在哪里很清楚

对于只涉及到操作一种组件的行为逻辑，则将其放在该组件对应的Manager（如将batchUpdate position的逻辑放到PositionComponentManager的batchUpdate函数中）；涉及到多种组件的行为逻辑则放在对应的System中（如将飞行行为放到FlySystem中）；


- 
增加行为很容易

因为一个行为对应一个System，所以要增加一个行为，则只需增加一个对应的System即可，这不会影响到Manager。另外，因为System只有逻辑没有数据，所以增加和维护System很容易


## 缺点


- 需要转换为函数式编程的思维

习惯面向对象编程的同学倾向于设计一个包括数据和逻辑的组件类，而ECS模式则将其扁平化为一个值对象，这符合函数式编程中一切都是数据的思维模式。

另外，ECS中的System其实就只是一个函数而已，本身没有数据，这也符合函数式编程中函数是第一公民的思维模式。

终上所述，如果使用函数式编程范式的同学能够更容易地使用ECS模式


## 使用场景


### 场景描述


游戏的场景中有很多种类的人物，人物的行为很多或者很复杂


### 具体案例


- 
有很多种类的游戏人物

通过挂载不同的组件到GameObject，来实现不同种类的游戏人物，代替继承


- 
游戏人物有很多的行为，而且还经常会增加新的行为

因为每个行为对应一个System，所以增加一个新的行为就是增加一个System。不管行为如何变化，只影响System层，不会影响作为下层的Manager层和GameObject、Component层


- 
对于引擎而言，ECS模式主要用在场景管理这块


## 注意事项


- 因为组件的ArrayBuffer一旦在创建后，它的大小就不会改动，所以最好在创建时指定足够大的最大组件个数


# 结合其它模式


## 结合多线程模式


如果引擎开了多个线程，那么可以将组件的ArrayBuffer改为SharedArrayBuffer。这样的话就可以将其直接共享到各个线程中而不需要拷贝，从而提高了性能


## 结合管道模式


如果引擎使用了管道模式，那么可以去掉System，而使用管道的Job来代替。其中一个Job就是一个System


另外，可以去掉WorldState，而使用PipelineManagerState来代替


# 最佳实践


## 哪些场景不需要使用模式


如果游戏的人物种类很少，行为简单，那么就可以使用最开始给出的人物模块的方案，即使用一个人物模块对应一种人物，并通过继承实现多种人物，这样最容易实现


# 更多资料推荐


ECS的概念最先是由“守望先锋”游戏的开发者提出的，详细资料可以在网上搜索“《守望先锋》架构设计和网络同步”


ECS模式是在“组件化”、“Data Oriented”基础上发展而来，可以在网上搜索更多关于“组件化”、“Data Oriented”、“ECS”的资料