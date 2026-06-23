# Wonder发布v1.1正式版本，新增资产预览、脚本、AssetBundle等 - 杨元超

> 日期: 2019-06-02 10:03
> 源: https://www.cnblogs.com/chaogex/p/10962063.html

# 更新说明


本次版本重点增加了脚本组件，并且实现了类似于unity的AssetBundle，支持动态加载场景和资源。


# 相关链接


- [官网](https://www.wonder-3d.com/)

- Wonder官方QQ群： 106047770


# 相关资料


- 
[Wonder v1.1版本 新特性 视频演示](https://www.bilibili.com/video/av54326698/)


- 
[Wonder v1.1版本 视频演示相关的 测试资源](https://github.com/Wonder-Technology/Wonder-Demo/tree/master/testResources/1.1/package)


# 新特性


## 增加了Inspector Canvas，可以预览Material和WDB资产


## 增加了脚本组件(实验性功能，请暂不使用)，可加入用户逻辑


## 增加了AssetBundle，以及生成AssetBundle的整个流程(实验性功能，请暂不使用)


AssetBundle用来支持动态加载场景和资源，这在大型游戏和应用中很有用。

比如：

一开始只需要加载第一关的数据，然后在第一关运行中，异步加载第二关数据，并且在第一关结束时无缝切换第二关。

这样就不需要一开始加载所有关卡的数据了，减少了用户等待的时间。


相对于Unity，我们有三个优势：

1)AssetBundle包体更小，生成速度更快

2)AssetBundle支持脚本

3)支持将多个场景AssetBundle中的重复的资源，提出到资源AssetBundle中，这样场景AssetBundle中就没有该资源了


## 增加了进度条


# 注意事项


## 脚本组件和AssetBundle功能目前属于测试阶段，仅供用户测试，请不要用到生产环境


没有相应的文档

目前提供给用户的API也很少，后面会陆续增加


# 详细改动列表


## 引擎


### Bug Fixes


- **api:** fix CoordinateAPI->convertWorldToScreen: change result to option ([9dd6c50](https://github.com/Wonder-Technology/Wonder.js/commit/9dd6c50))

- **asset-bundle:** fix "add manifest data" logic ([357df6b](https://github.com/Wonder-Technology/Wonder.js/commit/357df6b))

- **asset-bundle:** fix "add manifest data" logic ([9cdd2e0](https://github.com/Wonder-Technology/Wonder.js/commit/9cdd2e0))

- **asset-bundle:** fix "generate whole asset bundle" logic ([a90c52e](https://github.com/Wonder-Technology/Wonder.js/commit/a90c52e))

- **clone:** fix "clone transform": not mark dirty in CloneTransformMainService.re ([000bde0](https://github.com/Wonder-Technology/Wonder.js/commit/000bde0))

- **event:** bind mobile event use {"passive": false} ([5464e01](https://github.com/Wonder-Technology/Wonder.js/commit/5464e01))

- **event:** change point dom->target from canvas to body ([688310b](https://github.com/Wonder-Technology/Wonder.js/commit/688310b))

- **event:** fix "unbind arcballCameraController event" bug: unbind should unbind cameraController's all binded functions ([24f861f](https://github.com/Wonder-Technology/Wonder.js/commit/24f861f))

- **event:** fix init event job->chrome bug for getMovementDeltaWhenPointerLocked ([4f3e45b](https://github.com/Wonder-Technology/Wonder.js/commit/4f3e45b))

- **event:** fix init event job->chrome bug for getMovementDeltaWhenPointerLocked: use skip(2) instead of skip(1) ([2e7add8](https://github.com/Wonder-Technology/Wonder.js/commit/2e7add8))

- **event:** fix touch event: not prevent default ([05422f1](https://github.com/Wonder-Technology/Wonder.js/commit/05422f1))

- **event:** fix unbind arcball camera controller->keydown event ([2290309](https://github.com/Wonder-Technology/Wonder.js/commit/2290309))

- **event:** fix unbind arcball event->dispose point drag start/drop event ([8567055](https://github.com/Wonder-Technology/Wonder.js/commit/8567055))

- **event:** touchmove event prevent default ([ee51005](https://github.com/Wonder-Technology/Wonder.js/commit/ee51005))

- **geometry:** now "get points" use slice instead of subarray(for ios);optimize RenderJobUtils->_getOrCreateBuffer->Index: defer get indices data; ([6a45c0a](https://github.com/Wonder-Technology/Wonder.js/commit/6a45c0a))

- **glsl:** fix webgl1_frontLight_fragment.glsl->calcTotalLight ([40574ed](https://github.com/Wonder-Technology/Wonder.js/commit/40574ed))

- **job:** fix worker->add custom job->"if action is BEFORE, the custom job is executed after the source job(in pipeline)" bug ([4db344d](https://github.com/Wonder-Technology/Wonder.js/commit/4db344d))

- **memory:** fix QueryCPUMemoryService->isGeometryBufferNearlyFull:add judge indices16 and indices32 ([27485bc](https://github.com/Wonder-Technology/Wonder.js/commit/27485bc))

- **redo-undo:** fix deep copy gameObject record->disposedArcballCameraControllerArray ([895b2e0](https://github.com/Wonder-Technology/Wonder.js/commit/895b2e0))


### Features


- **api:** add APIAPI.re ([606b8b1](https://github.com/Wonder-Technology/Wonder.js/commit/606b8b1))

- **api:** change scriptAPI to uncurry ([a66f6ef](https://github.com/Wonder-Technology/Wonder.js/commit/a66f6ef))

- **api:** reallocateCPUMemoryJobAPI add reallocateGeometry api ([58f6e1c](https://github.com/Wonder-Technology/Wonder.js/commit/58f6e1c))

- **api:** sceneAPI,script api add findGameObjectsByName ([72382d0](https://github.com/Wonder-Technology/Wonder.js/commit/72382d0))

- **api:** scriptAPI add more apis ([0be975d](https://github.com/Wonder-Technology/Wonder.js/commit/0be975d))

- **asset:** convert->script: support script component not has event function data/attribute ([6def268](https://github.com/Wonder-Technology/Wonder.js/commit/6def268))

- **asset:** convert,assemble,generate add "gameObject->isActive, script->isActive, meshRenderer->isRender" ([83603b8](https://github.com/Wonder-Technology/Wonder.js/commit/83603b8))

- **asset:** wdb add script component data ([5ea3908](https://github.com/Wonder-Technology/Wonder.js/commit/5ea3908))

- **asset-bundle:** add "add manifest data" logic ([bcf6dd4](https://github.com/Wonder-Technology/Wonder.js/commit/bcf6dd4))

- **asset-bundle:** add "assemble rab", "isAssembled" logic ([a92371d](https://github.com/Wonder-Technology/Wonder.js/commit/a92371d))

- **asset-bundle:** add "assemble sab" logic ([001a1d8](https://github.com/Wonder-Technology/Wonder.js/commit/001a1d8))

- **asset-bundle:** add "checkCircleDependency","removeDupliceData" logic ([259919d](https://github.com/Wonder-Technology/Wonder.js/commit/259919d))

- **asset-bundle:** add "generate rab" logic ([8e5c3c7](https://github.com/Wonder-Technology/Wonder.js/commit/8e5c3c7))

- **asset-bundle:** add "generate sab" logic ([124e9bd](https://github.com/Wonder-Technology/Wonder.js/commit/124e9bd))

- **asset-bundle:** add "get ab progress info" logic ([353c8a1](https://github.com/Wonder-Technology/Wonder.js/commit/353c8a1))

- **asset-bundle:** add "load and use asset bundle"->client logic ([3fc4ecb](https://github.com/Wonder-Technology/Wonder.js/commit/3fc4ecb))

- **asset-bundle:** add "release asset bundle data" logic ([9067e17](https://github.com/Wonder-Technology/Wonder.js/commit/9067e17))

- **asset-bundle:** add GenerateAllABSystem and finish its logic ([e7a860d](https://github.com/Wonder-Technology/Wonder.js/commit/e7a860d))

- **asset-bundle:** add more script apis ([39167d7](https://github.com/Wonder-Technology/Wonder.js/commit/39167d7))

- **asset-bundle:** FindDependencyDataSystem add findAllDependencyRAbRelativePathByBreadthSearch and fix ImportABSystem->loadAndAssembleAllDependencyRAB to use mergeArray and concat array; ([37aa67f](https://github.com/Wonder-Technology/Wonder.js/commit/37aa67f))

- **asset-bundle:** fix "assembled sab->gameObject->texture->flipY not equal (generated single sab)sab->gameObject->texture->flipY" bug ([4df279d](https://github.com/Wonder-Technology/Wonder.js/commit/4df279d))

- **asset-bundle:** fix "generate single sab": now can get imageUint8Array data ([b035e61](https://github.com/Wonder-Technology/Wonder.js/commit/b035e61))

- **asset-bundle:** fix "loadAndAssembleAllDependencyRAB and loadSABAndSetToState->load order" bug: now concat and merge loadAndAssembleAllDependencyRAB and then concat loadSABAndSetToState. ([2ac5441](https://github.com/Wonder-Technology/Wonder.js/commit/2ac5441))

- **asset-bundle:** fix "removeDupliceData" logic ([01d4a57](https://github.com/Wonder-Technology/Wonder.js/commit/01d4a57))

- **asset-bundle:** fix api->generateSingleRAB, generateSingleSAB: not return state ([2a4affd](https://github.com/Wonder-Technology/Wonder.js/commit/2a4affd))

- **asset-bundle:** fix BatchOperateWholeGeometrySystem->setGeometryData->set texCoord data ([84b837a](https://github.com/Wonder-Technology/Wonder.js/commit/84b837a))

- **asset-bundle:** fix cache api: change return value from stream to promise ([efa904b](https://github.com/Wonder-Technology/Wonder.js/commit/efa904b))

- **asset-bundle:** fix cache: ImportABSystem->loadAllDependencyRABAndSetToState,loadSABAndSetToState now not handle "initAssetBundleArrayBufferCache" logic ([9434c6e](https://github.com/Wonder-Technology/Wonder.js/commit/9434c6e))

- **asset-bundle:** fix GenerateAllABAPI->generateAllABs: not check circle dependency ([596703a](https://github.com/Wonder-Technology/Wonder.js/commit/596703a))

- **asset-bundle:** fix ImportABSystem->RAB->_loadAndAssembleRAB: use stream to wrap rabRelativePath for mergeArray ([2843138](https://github.com/Wonder-Technology/Wonder.js/commit/2843138))

- **asset-bundle:** optimize load rabs and sab: 1.merge load all; 2.concat assemble dependency rabs ([8394da3](https://github.com/Wonder-Technology/Wonder.js/commit/8394da3))

- **asset-bundle:** run test->use.html use indexDB for cache asset bundle ([7a643fc](https://github.com/Wonder-Technology/Wonder.js/commit/7a643fc))

- **asset-bundle:** script api add getAllDependencyRABCount,getLoadedDependencyRABCount ([010c408](https://github.com/Wonder-Technology/Wonder.js/commit/010c408))

- **asset-bundle:** script api add initAllSABGameObjects,addSABSceneGameObjectChildrenToScene ([1939aca](https://github.com/Wonder-Technology/Wonder.js/commit/1939aca))

- **asset-bundle:** script api add releaseLoadedSAB,releaseLoadedRAB,releaseAssembleRABData ([a874898](https://github.com/Wonder-Technology/Wonder.js/commit/a874898))

- **asset-bundle:** script api: add isSABAssembled ([7303a19](https://github.com/Wonder-Technology/Wonder.js/commit/7303a19))

- **camera:** unbind camera controller event: add unbindArcballCameraControllerPointScaleEvent api ([7346f4c](https://github.com/Wonder-Technology/Wonder.js/commit/7346f4c))

- **clone:** fix clone script component ([4c0ed54](https://github.com/Wonder-Technology/Wonder.js/commit/4c0ed54))

- **data-json:** decrease setting.json->buffer->textureCountPerMaterial to 8 ([58dc883](https://github.com/Wonder-Technology/Wonder.js/commit/58dc883))

- **dispose:** add "dispose array buffer view source texture" ([d5c6e77](https://github.com/Wonder-Technology/Wonder.js/commit/d5c6e77))

- **dispose:** add "dispose texture" logic(draft) ([dce7094](https://github.com/Wonder-Technology/Wonder.js/commit/dce7094))

- **dispose:** fix "dispose basic source texture/array buffer view source texture->bindTextureUnitCacheMap" ([c56411f](https://github.com/Wonder-Technology/Wonder.js/commit/c56411f))

- **dispose:** fix "dispose script component": now clear script component disposed data ([ecae5e7](https://github.com/Wonder-Technology/Wonder.js/commit/ecae5e7))

- **dispose:** GameObjectAPI add disposeGameObjectLightMaterialComponentRemoveTexture; LightMaterialAPI add batchDisposeLightMaterialRemoveTexture; ([8b2ea84](https://github.com/Wonder-Technology/Wonder.js/commit/8b2ea84))

- **dispose:** pass "render worker->dispose basic source texture" ([4692a5e](https://github.com/Wonder-Technology/Wonder.js/commit/4692a5e))

- **gameObject:** gameObjectAPI add disposeGameObjectRemoveTexture api ([8818438](https://github.com/Wonder-Technology/Wonder.js/commit/8818438))

- **gameObject): add "is active" logic; (feat(script:** add "is active" logic); ([d772512](https://github.com/Wonder-Technology/Wonder.js/commit/d772512))

- **imgui:** add sliderFloat api ([6252277](https://github.com/Wonder-Technology/Wonder.js/commit/6252277))

- **imgui:** manageIMGUIAPI add clearIMGUIFunc api ([11e51e6](https://github.com/Wonder-Technology/Wonder.js/commit/11e51e6))

- **jiehuo:** add "draw line->solid line, dash line, alpha" feature ([ffb862a](https://github.com/Wonder-Technology/Wonder.js/commit/ffb862a))

- **jiehuo:** add jiehuo html and api ([0e03ac9](https://github.com/Wonder-Technology/Wonder.js/commit/0e03ac9))

- **jiehuo:** JieHuoAPI add loadImageDataArr api ([c7ec5b9](https://github.com/Wonder-Technology/Wonder.js/commit/c7ec5b9))

- **redo-undo:** fix deep copy gameObject: add copy disposedScriptArray ([d06d0f7](https://github.com/Wonder-Technology/Wonder.js/commit/d06d0f7))

- **script:** fix scriptp api->loadAllDependencyRABAndSetToState ([8ec0299](https://github.com/Wonder-Technology/Wonder.js/commit/8ec0299))

- **shader:** fix "no material shader"->HandleNoMaterialShaderUniformConfigDataService: useSendUniformService.getSendCachableDataByType(type_) ([e2644e6](https://github.com/Wonder-Technology/Wonder.js/commit/e2644e6))

- **skybox:** add skybox(by add job); ([b1bd64f](https://github.com/Wonder-Technology/Wonder.js/commit/b1bd64f))

- **skybox:** fix "left and right reverse" bug ([59ab763](https://github.com/Wonder-Technology/Wonder.js/commit/59ab763))

- **skybox:** fix draw cube texture->gl format ([2e14fd1](https://github.com/Wonder-Technology/Wonder.js/commit/2e14fd1))

- **texture:** basicSourceTextureAPI add disposeBasicSourceTexture; ([3217b6c](https://github.com/Wonder-Technology/Wonder.js/commit/3217b6c))

- **texture:** fix "assemble wdb"->BatchSetTextureAllDataSystem->batchSetNewDiffueMaps ([e5f1cd7](https://github.com/Wonder-Technology/Wonder.js/commit/e5f1cd7))

- update wonder-bs-jest, jest version ([f423264](https://github.com/Wonder-Technology/Wonder.js/commit/f423264))

- **script:** add "enable/disable script event function" api ([75a400b](https://github.com/Wonder-Technology/Wonder.js/commit/75a400b))

- **script:** add draft; pass script example run test; ([52c76db](https://github.com/Wonder-Technology/Wonder.js/commit/52c76db))

- **script:** event function can be undefined ([b8ae68f](https://github.com/Wonder-Technology/Wonder.js/commit/b8ae68f))

- **script:** handle clone script component ([f3a761d](https://github.com/Wonder-Technology/Wonder.js/commit/f3a761d))

- **script:** handle dispose script component ([2c53649](https://github.com/Wonder-Technology/Wonder.js/commit/2c53649))

- **script:** run test: change transform->local position when update ([1cbd100](https://github.com/Wonder-Technology/Wonder.js/commit/1cbd100))

- **script:** ScriptAPI and ScriptAttributeAPI add more api ([745cbd6](https://github.com/Wonder-Technology/Wonder.js/commit/745cbd6))

- **texture:** fix dispose texture: not delete glTexture ([be455eb](https://github.com/Wonder-Technology/Wonder.js/commit/be455eb))

- **worker:** script: exec script in main worker ([7638acb](https://github.com/Wonder-Technology/Wonder.js/commit/7638acb))


## 编辑器


### Bug Fixes


- **asset:** fix "remove folder asset": should remove folder's all children ([79e3d37](https://github.com/Wonder-Technology/Wonder-Editor/commit/79e3d37))

- **asset:** fix "remove material asset":1.remove instead of dispose material->maps; 2.if material has no gameObjects, dispose material; ([d81994f](https://github.com/Wonder-Technology/Wonder-Editor/commit/d81994f))

- **asset:** fix remove texture asset: if texture has no materials, should dispose texture's engine data ([c711c20](https://github.com/Wonder-Technology/Wonder-Editor/commit/c711c20))

- **asset:** fix rename asset in inspector: if value not change, shouldn't warn ([22eeb02](https://github.com/Wonder-Technology/Wonder-Editor/commit/22eeb02))

- **asset:** script attribute: sort entries show order; add check script event function/attribute jsObj str; ([5185889](https://github.com/Wonder-Technology/Wonder-Editor/commit/5185889))

- **console:** fix "str.split error" bug: fix ConsoleBaseComponent->buildMultiLineStringComponent ([272a8ba](https://github.com/Wonder-Technology/Wonder-Editor/commit/272a8ba))

- **event:** fix FloatInput,IntInput->drag over in pointer lock->movement ([a085859](https://github.com/Wonder-Technology/Wonder-Editor/commit/a085859))

- **event:** fix init event job->chrome bug for getMovementDeltaWhenPointerLocked ([d60b64f](https://github.com/Wonder-Technology/Wonder-Editor/commit/d60b64f))

- **event:** fix init event job->chrome bug for getMovementDeltaWhenPointerLocked: use skip(2) instead of skip(1) ([6eb7a9d](https://github.com/Wonder-Technology/Wonder-Editor/commit/6eb7a9d))

- **imgCanvas:** fix bug: remove texture should redraw material snapshot and remove container gameObj ([a51373c](https://github.com/Wonder-Technology/Wonder-Editor/commit/a51373c))

- **imgCanvas:** use drawImage func instead of Js.object.type ([4c94f56](https://github.com/Wonder-Technology/Wonder-Editor/commit/4c94f56))

- **inspectorCanvas:** fix texture cache: if change texture asset,clear its cache ([c93df9f](https://github.com/Wonder-Technology/Wonder-Editor/commit/c93df9f))

- **inspectorEngine:** fix bug caused by 192843c39172cd9983ac1ed2f524f10b3015209f ([db62c89](https://github.com/Wonder-Technology/Wonder-Editor/commit/db62c89))

- **inspectorEngine:** fix bug: stateData no state ([8ea3542](https://github.com/Wonder-Technology/Wonder-Editor/commit/8ea3542))

- **inspectorEngine:** need fix bug ([192843c](https://github.com/Wonder-Technology/Wonder-Editor/commit/192843c))

- **publish:** index.html: use contentLength instead of totalByteLength ([201e5da](https://github.com/Wonder-Technology/Wonder-Editor/commit/201e5da))

- **resize:** fix bug: enter editor; show material inspector; resize to big window; show blank area; ([9995f8b](https://github.com/Wonder-Technology/Wonder-Editor/commit/9995f8b))

- **ui:** mouse over FloatInput/IntInput->drag zone should show move cursor ([b0c4b57](https://github.com/Wonder-Technology/Wonder-Editor/commit/b0c4b57))

- **wdb:** need jack fix bug ([974710e](https://github.com/Wonder-Technology/Wonder-Editor/commit/974710e))


### Features


- **abUI:** finish all asset bundle ui ([2c24176](https://github.com/Wonder-Technology/Wonder-Editor/commit/2c24176))

- **ambientLight:** add ambient light in inspector canvas ([3c00512](https://github.com/Wonder-Technology/Wonder-Editor/commit/3c00512))

- **asset:** add "remove script event function, script attribute asset" ([119af1d](https://github.com/Wonder-Technology/Wonder-Editor/commit/119af1d))

- **asset:** add script event function asset; add script attribute asset; ([2e0facb](https://github.com/Wonder-Technology/Wonder-Editor/commit/2e0facb))

- **asset:** fix rename script attribute asset->attribute name: now update in all script components ([fee5180](https://github.com/Wonder-Technology/Wonder-Editor/commit/fee5180))

- **asset:** script attribute asset: add "update script attribute in all script components" logic ([32d3785](https://github.com/Wonder-Technology/Wonder-Editor/commit/32d3785))

- **asset:** script event function asset: add "update script event function in all script components" logic ([fe76e2e](https://github.com/Wonder-Technology/Wonder-Editor/commit/fe76e2e))

- **asset-bundle:** add "asset->load assetBundle" logic ([51fba9d](https://github.com/Wonder-Technology/Wonder-Editor/commit/51fba9d))

- **asset-bundle:** add "generate all ab" draft logic(pass compile) ([e3876ab](https://github.com/Wonder-Technology/Wonder-Editor/commit/e3876ab))

- **asset-bundle:** add "generate single sab" ([5d6a4cf](https://github.com/Wonder-Technology/Wonder-Editor/commit/5d6a4cf))

- **asset-bundle:** add geo.png ([ec60c07](https://github.com/Wonder-Technology/Wonder-Editor/commit/ec60c07))

- **asset-bundle:** add HeaderAssetBundle->"generate single rab" related ui ([150ca0c](https://github.com/Wonder-Technology/Wonder-Editor/commit/150ca0c))

- **asset-bundle:** add SelectTree ui draft ([63fb0b1](https://github.com/Wonder-Technology/Wonder-Editor/commit/63fb0b1))

- **asset-bundle:** asset tree->add assetBundle node ([f0f289c](https://github.com/Wonder-Technology/Wonder-Editor/commit/f0f289c))

- **asset-bundle:** begin "import ab at runtime when run": rewrite script api for asset bundle ([594684b](https://github.com/Wonder-Technology/Wonder-Editor/commit/594684b))

- **asset-bundle:** export/import wpk add asset bundle ([6310e5f](https://github.com/Wonder-Technology/Wonder-Editor/commit/6310e5f))

- **asset-bundle:** finish "build select tree from asset tree for generate single rab" ([75c226b](https://github.com/Wonder-Technology/Wonder-Editor/commit/75c226b))

- **asset-bundle:** finish "generateAndDownloadSingleRAB" logic ([c973ebf](https://github.com/Wonder-Technology/Wonder-Editor/commit/c973ebf))

- **asset-bundle:** fix generate single rab: added light material shouldn't add to basic material resource data ([b149ac7](https://github.com/Wonder-Technology/Wonder-Editor/commit/b149ac7))

- **asset-bundle:** fix HeaderAssetBundleGenerateAllAB: change generate-single-sab to generate-all-ab ([cf32db3](https://github.com/Wonder-Technology/Wonder-Editor/commit/cf32db3))

- **asset-bundle:** fix modal: click close button shouldn't generate single ab ([a179227](https://github.com/Wonder-Technology/Wonder-Editor/commit/a179227))

- **asset-bundle:** header->"generate single rab" add "name" input ([2c34074](https://github.com/Wonder-Technology/Wonder-Editor/commit/2c34074))

- **asset-bundle:** publish local: write asset bundle to zip ([5e45104](https://github.com/Wonder-Technology/Wonder-Editor/commit/5e45104))

- **asset-bundle:** support load "asset bundle zip" to asset ([72b90e6](https://github.com/Wonder-Technology/Wonder-Editor/commit/72b90e6))

- **assetCanvas:** finish asset canvas demo ([7cf4536](https://github.com/Wonder-Technology/Wonder-Editor/commit/7cf4536))

- **camera:** fix scene view->edit camera: fix point scale ([bcf22bc](https://github.com/Wonder-Technology/Wonder-Editor/commit/bcf22bc))

- **controller:** add "exec script event functions when run" logic ([a676fef](https://github.com/Wonder-Technology/Wonder-Editor/commit/a676fef))

- **engine:** update wonder.js to 1.0.2 ([15da515](https://github.com/Wonder-Technology/Wonder-Editor/commit/15da515))

- **engine:** update wonder.js to 1.1.0 ([dda7c6b](https://github.com/Wonder-Technology/Wonder-Editor/commit/dda7c6b))

- **engine:** update wonder.js version ([50402dd](https://github.com/Wonder-Technology/Wonder-Editor/commit/50402dd))

- **engine:** update wonder.js version ([bcf12f1](https://github.com/Wonder-Technology/Wonder-Editor/commit/bcf12f1))

- **engine:** update wonder.js version ([238649c](https://github.com/Wonder-Technology/Wonder-Editor/commit/238649c))

- **engine:** update wonder.js version ([f7e1eab](https://github.com/Wonder-Technology/Wonder-Editor/commit/f7e1eab))

- **engine:** update wonder.js version ([b429bce](https://github.com/Wonder-Technology/Wonder-Editor/commit/b429bce))

- **engine:** update wonder.js, wonder-webgl version ([9d41c84](https://github.com/Wonder-Technology/Wonder-Editor/commit/9d41c84))

- **export:** export mateial snapshot ([10fda6d](https://github.com/Wonder-Technology/Wonder-Editor/commit/10fda6d))

- **header:** add "New Scene" ([eb5d73a](https://github.com/Wonder-Technology/Wonder-Editor/commit/eb5d73a))

- **header:** fix "New Scene": should operate in stop ([5792121](https://github.com/Wonder-Technology/Wonder-Editor/commit/5792121))

- **header:** fix "NewScene": should clear current scene tree node before exec update_transform_gizmos job ([b65da2f](https://github.com/Wonder-Technology/Wonder-Editor/commit/b65da2f))

- **imgCanvas:** create import wdb/gltf file material snapshot ([1c75f35](https://github.com/Wonder-Technology/Wonder-Editor/commit/1c75f35))

- **imgCanvas:** finish remove material should remove it's imageData from imageDataMap ([76c648a](https://github.com/Wonder-Technology/Wonder-Editor/commit/76c648a))

- **imgCanvas:** finish TODOs ([98e2bb6](https://github.com/Wonder-Technology/Wonder-Editor/commit/98e2bb6))

- **imgCanvas:** fix "create material/wdb snapshot": now clear img canvas before draw ([245be64](https://github.com/Wonder-Technology/Wonder-Editor/commit/245be64))

- **imgCanvas:** fix AssetTreeInspectorUtils->disposeContainerGameObjectAllChildrenAndReallocateCPUMemory->_reallocateCPUMemory: add condition judge ([90e4a49](https://github.com/Wonder-Technology/Wonder-Editor/commit/90e4a49))

- **imgCanvas:** store img-canvas context in editorState ([2b71dfc](https://github.com/Wonder-Technology/Wonder-Editor/commit/2b71dfc))

- **imgui:** fix scene view imgui: if SceneViewIMGUIUtils->convertWorldToScreen return None, return (-100, -100) ([a6a1fdd](https://github.com/Wonder-Technology/Wonder-Editor/commit/a6a1fdd))

- **inspector:** finish create material sphere into inspector canvas ([8573a77](https://github.com/Wonder-Technology/Wonder-Editor/commit/8573a77))

- **inspectorCanvas:** arcball camera controller->event work ([bb505cb](https://github.com/Wonder-Technology/Wonder-Editor/commit/bb505cb))

- **inspectorCanvas:** fix "cache texture": load wdb->extract material assets shouldn't dispose texture ([48b4db8](https://github.com/Wonder-Technology/Wonder-Editor/commit/48b4db8))

- **inspectorCanvas:** fix arcball camera controller: left mouse button can still drag ([f236513](https://github.com/Wonder-Technology/Wonder-Editor/commit/f236513))

- **inspectorCanvas:** fix generate material snapshot: generate snapshot in MaterialInspector->willUnmount ([5c166e9](https://github.com/Wonder-Technology/Wonder-Editor/commit/5c166e9))

- **inspectorCanvas:** fix MaterialInspector->update snapshot bug ([b6d3a64](https://github.com/Wonder-Technology/Wonder-Editor/commit/b6d3a64))

- **inspectorCanvas:** fix remove material asset: if material is removed, not create material sphere ([7fe0f3f](https://github.com/Wonder-Technology/Wonder-Editor/commit/7fe0f3f))

- **inspectorCanvas:** fix:restore arcball camera controller->angle before update snapshot ([62c8c40](https://github.com/Wonder-Technology/Wonder-Editor/commit/62c8c40))

- **inspectorCanvas:** improve light ([b084951](https://github.com/Wonder-Technology/Wonder-Editor/commit/b084951))

- **inspectorCanvas:** update default material snapshot base64 ([c801917](https://github.com/Wonder-Technology/Wonder-Editor/commit/c801917))

- **inspectorCanvas:** wdb inspector: generate snapshot in WDBInspector->didMount ([952ff4c](https://github.com/Wonder-Technology/Wonder-Editor/commit/952ff4c))

- **inspectorCanvas:** wDBInspector, MaterialInspector->didMount add tryCatch ([6ab8559](https://github.com/Wonder-Technology/Wonder-Editor/commit/6ab8559))

- **inspectorEngine:** show sphere and camera ([938daed](https://github.com/Wonder-Technology/Wonder-Editor/commit/938daed))

- **job:** init_pipelines remove init_script job ([e9ac408](https://github.com/Wonder-Technology/Wonder-Editor/commit/e9ac408))

- **language:** add arcball camera and light language ([30126b9](https://github.com/Wonder-Technology/Wonder-Editor/commit/30126b9))

- **language:** add asset and inspector language ([14215de](https://github.com/Wonder-Technology/Wonder-Editor/commit/14215de))

- **language:** add camera group language ([ef33b41](https://github.com/Wonder-Technology/Wonder-Editor/commit/ef33b41))

- **language:** add message language ([7c08bc0](https://github.com/Wonder-Technology/Wonder-Editor/commit/7c08bc0))

- **language:** change header-edit->zh ([6b8efc8](https://github.com/Wonder-Technology/Wonder-Editor/commit/6b8efc8))

- **language:** finish header and controller language ([6053827](https://github.com/Wonder-Technology/Wonder-Editor/commit/6053827))

- **language:** fix language data ([b7fae29](https://github.com/Wonder-Technology/Wonder-Editor/commit/b7fae29))

- **language:** restore DomHelper->locationReload to use reload ([ce4b198](https://github.com/Wonder-Technology/Wonder-Editor/commit/ce4b198))

- **left-header:** fix clone gameObject has script component ([814aca0](https://github.com/Wonder-Technology/Wonder-Editor/commit/814aca0))

- **mainEditorMaterial:** split MainEditorBasic/lightMaterial to MainEditorBasic/LightMaterialForGam ([6577143](https://github.com/Wonder-Technology/Wonder-Editor/commit/6577143))

- **message:** change message -> isActive to be immutable ([e1860e7](https://github.com/Wonder-Technology/Wonder-Editor/commit/e1860e7))

- **message:** finish message demo ([58f197c](https://github.com/Wonder-Technology/Wonder-Editor/commit/58f197c))

- **message:** finish message demo ([0710f75](https://github.com/Wonder-Technology/Wonder-Editor/commit/0710f75))

- **message:** finish message feature ([46ce318](https://github.com/Wonder-Technology/Wonder-Editor/commit/46ce318))

- **message:** finish message feature ([51aeea2](https://github.com/Wonder-Technology/Wonder-Editor/commit/51aeea2))

- **progress:** add progress willUnmount off event ([90ee1d8](https://github.com/Wonder-Technology/Wonder-Editor/commit/90ee1d8))

- **progress:** finish offCustomGlobalEventByEventName in progress->willUnmount ([8a12a22](https://github.com/Wonder-Technology/Wonder-Editor/commit/8a12a22))

- **progress:** finish progress feat and style ([548fa0c](https://github.com/Wonder-Technology/Wonder-Editor/commit/548fa0c))

- **progress:** load wdb, import package add progress ([36b9f75](https://github.com/Wonder-Technology/Wonder-Editor/commit/36b9f75))

- **progress:** use send local ui state instead of operate dom ([7912f99](https://github.com/Wonder-Technology/Wonder-Editor/commit/7912f99))

- **publish:** fix publish local->no worker: fix for asset bundle ([78af837](https://github.com/Wonder-Technology/Wonder-Editor/commit/78af837))

- **publish:** fix publish local->worker: fix for asset bundle ([fe1eb33](https://github.com/Wonder-Technology/Wonder-Editor/commit/fe1eb33))

- **publish:** update engine files ([80ab8fe](https://github.com/Wonder-Technology/Wonder-Editor/commit/80ab8fe))

- **pwa:** finish pwa update data ([2825e30](https://github.com/Wonder-Technology/Wonder-Editor/commit/2825e30))

- **pwa:** finish pwa update data ([c322bcc](https://github.com/Wonder-Technology/Wonder-Editor/commit/c322bcc))

- **redo-undo:** fix redo/undo remove script component ([5e8e4fc](https://github.com/Wonder-Technology/Wonder-Editor/commit/5e8e4fc))

- **redo-undo:** script component->attribute add redo/undo ([cdb392a](https://github.com/Wonder-Technology/Wonder-Editor/commit/cdb392a))

- **redo-undo:** script component->event function add redo/undo ([6e58c7c](https://github.com/Wonder-Technology/Wonder-Editor/commit/6e58c7c))

- **redo-undo:** script event function,script attribute asset add redo-undo ([dd482af](https://github.com/Wonder-Technology/Wonder-Editor/commit/dd482af))

- **script:** add "store script assets in asb", "relate script assets when import package", "extract script assets when load asset" logic(draft) ([5300181](https://github.com/Wonder-Technology/Wonder-Editor/commit/5300181))

- **script:** fix event function->body str: replace "return engineState" to return engineState;" ([d1fc979](https://github.com/Wonder-Technology/Wonder-Editor/commit/d1fc979))

- **script:** fix script component: support Int type ([560e7fb](https://github.com/Wonder-Technology/Wonder-Editor/commit/560e7fb))

- **script:** rewrite script api->asset bundle api->addSABSceneGameObjectChildrenToScene, setSABSceneGameObjectToBeScene, disposeSceneAllChildren ([e2fa8cc](https://github.com/Wonder-Technology/Wonder-Editor/commit/e2fa8cc))

- **script:** script api now update editor ([5fb6843](https://github.com/Wonder-Technology/Wonder-Editor/commit/5fb6843))

- **script-component:** "add script event function": if no scriptEventFunction asset, warn ([bc26270](https://github.com/Wonder-Technology/Wonder-Editor/commit/bc26270))

- **script-component:** add "remove script component" logic ([3d06aab](https://github.com/Wonder-Technology/Wonder-Editor/commit/3d06aab))

- **script-component:** add "remove script event function" ([0cbcaa0](https://github.com/Wonder-Technology/Wonder-Editor/commit/0cbcaa0))

- **script-component:** add "script attribute" logic ([afaba0c](https://github.com/Wonder-Technology/Wonder-Editor/commit/afaba0c))

- **script-component:** add "script attribute"->fields logic ([ad54248](https://github.com/Wonder-Technology/Wonder-Editor/commit/ad54248))

- **script-component:** add script component logic(draft); add "add script event function" logic(draft); ([af77d66](https://github.com/Wonder-Technology/Wonder-Editor/commit/af77d66))

- **script-component:** fix "add script event function" bugs ([4dbcf39](https://github.com/Wonder-Technology/Wonder-Editor/commit/4dbcf39))

- **script-component:** HideScriptEventFunctionGroupForAdd,HideScriptEventFunctionGroupForChange now not dispatch ([f21fa91](https://github.com/Wonder-Technology/Wonder-Editor/commit/f21fa91))

- **snapshot:** add basicMaterial and lightMaterial closeColorPick and blurShininess event handler ([d520210](https://github.com/Wonder-Technology/Wonder-Editor/commit/d520210))

- **wdb:** add imageDataIndex in wdbData ([bacfd2a](https://github.com/Wonder-Technology/Wonder-Editor/commit/bacfd2a))

- **wdb:** add WDBInspector.re and refactor didMount and willunMount ([29ddbef](https://github.com/Wonder-Technology/Wonder-Editor/commit/29ddbef))

- **wdb:** finish clone wdb gameObject to other engine state ([58c609f](https://github.com/Wonder-Technology/Wonder-Editor/commit/58c609f))

- **wdb:** finish export package store wdb snapshot to asb, import package should use it ([a7c265b](https://github.com/Wonder-Technology/Wonder-Editor/commit/a7c265b))

- **wdb:** import wdb create snapshot ([abdb9a8](https://github.com/Wonder-Technology/Wonder-Editor/commit/abdb9a8))

- **wdb:** import wdb should dispose inspector canvas gameObject ([07e54bf](https://github.com/Wonder-Technology/Wonder-Editor/commit/07e54bf))

- remove ImmutableSparseMapService.re ([291b8e4](https://github.com/Wonder-Technology/Wonder-Editor/commit/291b8e4))

- update files ([91c58e4](https://github.com/Wonder-Technology/Wonder-Editor/commit/91c58e4))

- update files ([e3a5e09](https://github.com/Wonder-Technology/Wonder-Editor/commit/e3a5e09))

- update wonder.js,wonder-bs-jest,wonder-commonlib,jest version ([3891511](https://github.com/Wonder-Technology/Wonder-Editor/commit/3891511))


### Performance Improvements


- **img:** change img size ([a50b2d3](https://github.com/Wonder-Technology/Wonder-Editor/commit/a50b2d3))

- **inspectorCanvas:** optimize render inspector canvas: cache texture ([51a9e19](https://github.com/Wonder-Technology/Wonder-Editor/commit/51a9e19))