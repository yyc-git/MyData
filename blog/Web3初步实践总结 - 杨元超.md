# Web3初步实践总结 - 杨元超

> 日期: 2022-10-28 06:05
> 源: https://www.cnblogs.com/chaogex/p/16834535.html

大家好~Web3是2021年才开始的浪潮，我非常赞同Web3的去中心化的理念，并且最近从Web2全面转向Web3了。

现在与大家分享我的实践的经验，希望对大家有所帮助，谢谢！


目录

- [为什么要转向Web3](#为什么要转向web3)
- [介绍Web3](#介绍web3)
- [充值](#充值)
- [Dapp](#dapp)
- [钱包](#钱包)
- [NFT](#nft)
- [DAO](#dao)
- [域名](#域名)
- [开源](#开源)
- [后端](#后端)
- [我正在使用的应用](#我正在使用的应用)
- [我关注的应用](#我关注的应用)
- [我正在开发的Dapp：Meta3D](#我正在开发的dappmeta3d)
- [更多的Web3学习资料](#更多的web3学习资料)


# 为什么要转向Web3


传统的Web2是中心化的，意味着用户的数据都是保存在提供服务的公司的服务器中，归公司所有。公司可以在不经过用户允许的情况下，任意使用数据，甚至封杀用户。

我就经历过多次被服务商限制的经历。


而Web3是基于去中心化的区块链技术的，再也没有唯一的一个中心，而是人人都是中心。用户的数据归用户所有，完全自由~


因为我一直在实践开源精神，推崇完全的自由，所以Web3很适合我


看下Web3会带来哪些改变：


[Web 3.0 可能会给互联网用户带来哪些改变？](https://www.zhihu.com/question/505057757)


# 介绍Web3


Web3基于区块链技术，完全分布式，而且基础设施从2008年发布区块链以来已经发展了10几年了，已经比较成熟，而且有很多Web3的应用了


Web3具有下面的特点：


- 
统一的身份

用户只有一个账号地址，直接使用钱包用该账号地址在各个网站登录


- 
去中心化

依赖结构从Web2的金字塔转变为圆形，没有唯一的中心，人人都是中心

这也意味着不再有一个老大哥会来为你做事，而是什么事情都要你自己做（当然提倡人人都互相帮助和服务，这样每个人也可以省去很多事情，同时保持完全的自由）

所以自由越大，责任也越大


- 
数据归用户所有

用户数据存储在分布式系统上（如IPFS、AR），永久存储，不会丢失，而且归用户所有


# 充值


Web3使用代币（如比特币）进行交易，国外的一些服务商（如Express VPN）也开始支持了使用比特币进行支付


因为代币与用户的唯一账号地址关联，所以代币可以自由流通和转换


可以使用[币安](https://www.binance.com/zh-CN)，将人民币转换为代币

不过我目前卡在用户认证的环节了，暂时没有通过


我使用[PAXFUL](https://paxful.com/zh/buy-bitcoin/with-any-payment-method/?paymentMethod=with-any-payment-method&countryIso=CN&hasScroll=true)，成功地用微信支付的方式购买了比特币。购买的比特币默认在PAXFUL的钱包里，可以在[PAXFUL的钱包](https://paxful.com/zh/wallet)中，点击BTC的发送，输入在MetaMask中可查看账号地址后就发送到MetaMask钱包中。也可以在[PAXFUL的转换](https://paxful.com/zh/wallet/convert)中现将比特币BTC转成ETH，再发送


# Dapp


Web3中的应用称为Dapp


现在已经有很多Dapp了，具体可以参考：


[目前有哪些已经上线的 Web3.0 实际应用呢？](https://www.zhihu.com/question/399036343)


可以将你的Dapp可以收录到DappRadar平台上：


[如何将您的项目收录在DappRadar平台上](https://docs.moonbeam.network/cn/learn/dapps-list/dapp-radar/)


# 钱包


进入Dapp不需要注册，直接使用钱包登录即可


我使用MetaMask钱包，钱包的安装教程在这里：

[如何开启MetaMask钱包？](https://zhuanlan.zhihu.com/p/112285438)


# NFT


我理解的NFT就相当于一个属于你的收藏，是一个数字资产，全网通用的，跟你的唯一账号绑定


NFT有很多应用场景，可以参考：

[细数未来 NFT 的十几个应用场景](https://zhuanlan.zhihu.com/p/434371985)

[14个令人激动的NFT未来趋势](https://www.shiliannft.com/NFTzixun/3070.html)


# DAO


Web3的DAO的概念对应Web2的公司的概念


DAO是一个松散的去中心化的组织，不再有什么董事长、领导之类的层级结构，而是人人平等


DAO不属于某个人，每个成员都可以发起提案，通过投票来表决


DAO可以发行内部代币，进行激励


人人都可以对DAO做出贡献。DAO越是对社会有用，价值就越高，内部代币就越值钱，每个成员就越能获益，从而形成正面循环


我已经使用了[Colony](https://xdai.colony.io/)免费创建了DAO


介绍资料：


[全面解读｜Colony v2：有效降低市场交易成本的DAO基础设施](https://daorayaki.org/quan-mian-jie-du-colony-v2-you-xiao-jiang-di-shi-chang-jiao-yi-cheng-ben-de-daoji-chu-she-shi/)


更多参考资料：


[DAO在知乎的资料](https://www.zhihu.com/search?type=content&q=DAO)


[“在公司工作”和“在 DAO 工作”的区别](https://zhuanlan.zhihu.com/p/464282420)


[发起一个DAO](https://www.hackdao.org/handbook/docs/make/)


# 域名


Web3有ENS、DAS等域名，注册的话需要比特币


介绍资料如下：

[DAS域名是域名吗？手把手教你注册DAS域名](https://zhuanlan.zhihu.com/p/433708031)


# 开源


Web3的Dapp的代码都是开源的


另外可以使用代币来激励开源项目的开发者


参考资料：


[Web3会让开源的未来更好吗？](https://mp.weixin.qq.com/s?__biz=MzI5MjE4NzYzNw==&mid=2247485295&idx=1&sn=2823940cf4ca2b1208d609626a8439e0&chksm=ec047bf5db73f2e3180a8a6ab8ce0b4de1fb1d3a0d46ea3f65841408cc44d3282250759e36d6&scene=21#wechat_redirect)


# 后端


要自己开发Dapp的话，虽然前端基本上不用修改，而后端要完全换成Web3的后端


开发Dapp的参考资料：

[Web3 DApp 最佳编程实践指南](https://guoyu.mirror.xyz/RD-xkpoxasAU7x5MIJmiCX4gll3Cs0pAd5iM258S1Ek)


已经有web3.js等前端库可以与区块链等进行操作


因为我一直使用腾讯云的云开发作为后端，所以也想看下Web3中有没有类似的提供云开发（即serverless）的云平台。结果找到了4everland，它完全是基于Web3的后端，数据存储在IPFS或AR上，提供了静态网站托管、Bucket（跟腾讯云的云开发一样，可以通过https来进行数据读写等操作，使用AWS的S3的API）等服务


经过我的测试，托管网站的访问速度挺快的，不过Bucket的访问速度比较慢


参考资料为：


[免费的静态托管平台4EVERLAND](https://zhuanlan.zhihu.com/p/401381716)


# 我正在使用的应用


我已经使用了下面的Web3的Dapp：


**Mirror**


我使用Mirror来写文章。文章是保存在AR上的，永久存储。并且可以把文章铸造为[NFT](https://baijiahao.baidu.com/s?id=1747721740815338220&wfr=spider&for=pc)


这下再也不需要因为怕丢失而将文章到处同步到各个平台了！


Mirror貌似有bug，只能发布一次文章，然后需要登出再登入，然后才能发下一篇文章


Mirror发布的文章登上搜索引擎的速度比较慢，可以使用[Ask Mirror](https://askmirror.xyz/)来搜索文章


我的Mirror地址，大家可以关注：

[Mirror yyc](https://mirror.xyz/0xf63e1991A343814EdE505D7cfC368615EAe75307)


参考资料：

[永远不会被关停的去中心化「链闻」——Mirror](https://mp.weixin.qq.com/s?__biz=MzA3Njc5ODgxMA==&mid=2247485319&idx=1&sn=2d42368c506297d576d41230cafef7fb&chksm=9f5a89b2a82d00a4a4435763cb198fb6b45da8a7d1df14dba5945b332842a6de7566b619958d&scene=21#wechat_redirect)

[这可能是公认的最web3的产品了](https://juejin.cn/post/7135079444879769613)


**[Colony](https://xdai.colony.io/)**


我使用它免费地创建了DAO


**[4everland](https://www.4everland.org/)**


我使用它托管网站和Dapp的前端，使用它的Bucket作为Dapp的后端，替代了腾讯云的云开发


# 我关注的应用


下面这些Dapp还不能正式使用，可以先关注：


**[Lenster](https://lenster.xyz/)**


这是一个类似于Twitter的Web3社交Dapp，目前还在内测，不能使用，可以先关注


**[ShowMe](https://showme.fan/)**


这是一个类似于知识星球的Web3 Dapp，目前暂时不支持国内用户


**[Nansen Connect](https://connect.nansen.ai/)**


这是一个类似于Dicord的Web3聊天Dapp，刚刚开始公测，可以加入公共的频道聊天，但还不能创建频道


# 我正在开发的Dapp：Meta3D


Meta3D是Web3D低代码开发平台，用户可以像搭建积木一样快速搭建Web3D引擎、Web3D编辑器


Meta3D属于Web3 Dapp，代码完全开源，通过钱包直接登录，并且使用4everland作为Web3后端


目前Meta3D还在内测版开发中，请勿使用，仅供学习


Meta3D的资料在这里：


[官网](https://meta3d-website.4everland.app/)


[Github](https://github.com/Meta3D-Technology/Meta3D)


# 更多的Web3学习资料


[Web3星球](https://www.zhihu.com/column/c_1526129690394095616)