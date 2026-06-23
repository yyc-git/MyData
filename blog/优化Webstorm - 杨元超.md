# 优化Webstorm - 杨元超

> 日期: 2016-07-18 10:05
> 源: https://www.cnblogs.com/chaogex/p/5680187.html

Webstorm这个编辑器还是很强大的，而且版本更新得快，支持最新的typescript，就是性能越来越低。

本文总结了一些优化Webstorm的有效方法，希望对大家有所帮助！


# 测试环境


Mac OS X 操作系统

Webstorm 11.0


# 优化方法


## exclude项目中不用的文件


- 进入Settings->Project->Directories，把用不到的文件目录都Excluded（选中该文件目录，右击鼠标，点Excluded）

- 进入Settings->Editor->File Types，在最下面的Ignore files and folders中加入要ignore的文件或文件夹

- 在project窗口的文件夹上，右击鼠标，点击Mark Directory As->Excluded


## 优化代码检查


- 进入Settings->Editor->Inspections，把用不到的检查都关掉

- 进入Settings->Editor->General，把最下面的Error highlighting->Autoreparse delay(ms) 改成比较大的值（如20000)


## 去掉平时用不到的插件


进入Settings->Plugins，去掉平常用不到的插件，在一定程度上会提高软件打开时的加载速度。


## 优化typescript编译


进入Settings->Languages & Frameworks->Typescript，取消Track changes


## 优化文件保存


可以取消自动保存功能（建议保留该功能！）：


进入Settings->Apparence & Behavior->Synchronization，取消 Synchronize file on frame deactivation 和 Save files automatically 的选择。


## 清除缓存


项目久了之后可以清除缓存：点击File -> Invalidate Caches / Restart


# 更多方法


[Increasing Memory Heap](https://www.jetbrains.com/help/idea/2016.1/increasing-memory-heap.html)


# 参考资料


[PhpStorm10 设置内存](http://my.oschina.net/u/144160/blog/702321)