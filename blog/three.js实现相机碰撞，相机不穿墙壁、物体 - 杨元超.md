# three.js实现相机碰撞，相机不穿墙壁、物体 - 杨元超

> 日期: 2024-04-25 15:53
> 源: https://www.cnblogs.com/chaogex/p/18157888

大家好，本文实现了相机碰撞检测，使相机不穿墙壁、物体，并给出了思路和代码，感谢大家~


关键词：数字孪生、three.js、Web3D、WebGL、相机碰撞、游戏相机


我正在承接Web3D数字孪生项目，具体介绍可看[承接各种Web3D业务](https://www.cnblogs.com/chaogex/p/14090516.html)


目录

- [实现原理](#实现原理)
- [参考资料](#参考资料)


实现前：

![image](https://img2024.cnblogs.com/blog/419321/202404/419321-20240425154851040-1321557876.gif)


移动第三人称相机时，相机可能会穿入到物体、墙壁中，影响视野


现在进行下面的改进：


- 只要相机和人物之间有物体，就平滑拉进

- 如果没有物体，则恢复默认的距离

- 如果在拉进时，人物往相机反方向移动，则可以移动到默认的距离而保持相机不动；再远相机就会跟随了


实现后效果如下：

![image](https://img2024.cnblogs.com/blog/419321/202404/419321-20240425155223672-730261966.gif)


## 实现原理


大概的实现原理如下：


从人物往相机发送射线，与场景进行相交检测；

如果最近相交点小于默认距离，则说明相机被遮挡，将相机沿着相机到人物的方向平滑移动


代码：


```
import { Raycaster, Scene, Vector3 } from "three"

type cameraVelocity = Vector3

export let handleCameraCollision = (raycaster: Raycaster, scene: Scene, defaultDistance: number, playerWorldPosition: Vector3, cameraCurrentWorldPosition: Vector3): cameraVelocity => {
 let playerToCameraDirection = cameraCurrentWorldPosition.clone().sub(playerWorldPosition).normalize()

 raycaster.set(playerWorldPosition, playerToCameraDirection)


 let intersects = raycaster.intersectObject(scene, true)

 let cameraToPlayerDistance = cameraCurrentWorldPosition.clone().distanceTo(playerWorldPosition)

 //实现“如果没有物体，则恢复默认的距离”和“如果在拉进时，人物往相机反方向移动，则可以移动到默认的距离而保持相机不动；再远相机就会跟随了”
 if (cameraToPlayerDistance cameraToPlayerDistance
 )
 ) {
 let speed
 if (intersects.length == 0 || intersects[0].distance > defaultDistance) {
 speed = defaultDistance / cameraToPlayerDistance
 }
 else {
 speed = intersects[0].distance / cameraToPlayerDistance

 if (intersects[0].distance + speed > cameraToPlayerDistance) {
 speed = 0
 }
 }


 return playerToCameraDirection.clone().multiplyScalar(speed)
 }

 if (intersects.length == 0 || intersects[0].distance >= cameraToPlayerDistance) {
 return new Vector3(0, 0, 0)
 }

 let cameraToPlayerDirection = playerWorldPosition.clone().sub(cameraCurrentWorldPosition).normalize()
 let speed = cameraToPlayerDistance / intersects[0].distance

 return cameraToPlayerDirection.multiplyScalar(speed)
}


...

camera.position.add(handleCameraCollision(...))

```

## 参考资料


[【C#】【Unity】第三人称摄像机跟随人物移动时碰撞到墙壁等，摄像机不穿越墙壁](https://blog.csdn.net/Terrell21/article/details/82982902)


[[UE4]第三人称探索类游戏的镜头控制思路与经验分享](https://zhuanlan.zhihu.com/p/143903648)


[第三人称视角游戏的镜头全自动控制方案 ](https://www.cnblogs.com/wsk-0000/articles/12534226.html)


[Raycaster Collision Detection](https://sbcode.net/threejs/raycaster2/)