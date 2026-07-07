# Vibe Coding 多人游戏（十二）—— Phase 7：状态管理演进

> **📚 系列索引**
> 
> - [（零）目录 →](https://www.cnblogs.com/chaogex/p/21195307) 系列总索引、推荐阅读顺序

---

这个系列讲了很多架构决策，但有一个决策反复出现：**状态该用什么结构存？**

从 basic1 到生产版，状态管理重构了四次。不是因为闲得慌，而是每次都在解决一个真实的问题。

---

## v1：Immutable.js Map

basic1 做帧同步时需要快照回滚——存一份状态快照，回退后重放。Immutable.js 的不可变数据结构天然适合这个场景：

```typescript
import { Map } from "immutable"

let state = Map({
    players: Map({
        user_1: Map({ x: 0, y: 0, hp: 100 }),
        user_2: Map({ x: 5, y: 0, hp: 100 }),
    })
})

// 不可变更新
let newState = state.setIn(["players", "user_1", "x"], 1)
```

**优点：**
- 不可变，回滚即插即用（`oldSnapshot` → `setState(oldSnapshot)`）
- 全类型安全（TypeScript + Immutable 泛型）
- 时间旅行调试友好

**问题：**
- 包体积 ~50KB（gzip），对 SCF 部署的 zip 包来说是额外负担
- API 学习成本高——`setIn`、`updateIn`、`mergeDeep` 每个写法不同
- 类型推导体量爆炸——`Map<string, Map<string, number>>` 层层嵌套
- 性能：每次 `setIn` 都创建新对象树，GC 压力大

---

## v2：自制 ImmutableHashMap

去掉 Immutable.js 依赖，自己实现一个轻量不可变 HashMap：

```typescript
import { createEmpty, set, entries, get } from "meta3d-commonlib-new/src/structure/hash_map/ImmutableHashMap"

let players = createEmpty<playerState>()
players = set(players, "user_1", { x: 0, y: 0, hp: 100 })
```

**优点：**
- 零外部依赖
- API 更精简（create, set, get, entries 四个函数）

**问题：**
- **😤 hash 冲突 bug：** 自制的 HashMap 实现不完善，某些 key 组合下 hash 冲突导致数据丢失。上线后玩家发现自己的 HP 莫名其妙变成了别人的
- 不可变性带来的 GC 压力依然存在

---

## v3：回归 Js.Dict

和 hash 冲突 bug 斗争了两天后，决定回归最原始的方式——JavaScript 原生对象：

```typescript
let players: { [username: string]: playerState } = {}

players["user_1"] = { x: 0, y: 0, hp: 100 }
```

**优点：**
- 零 GC 压力（原地修改）
- 零库体积
- TypeScript 索引签名类型安全基本够用

**问题：**
- **类型安全性不够：** `players["nonexistent"]` 返回 `undefined`，但 TypeScript 不强制检查
- 对象属性枚举（`Object.keys/entries`）和 Immutable 的 `.map()`/`.filter()` 用法完全不同
- 深拷贝需要自己实现（结构化克隆或 JSON.parse(JSON.stringify())）

---

## v4（最终）：SoA Store

前三次都是"一个对象存所有的数据"。到 v4 做了彻底的重构——**按职责拆 Store，按数据性质拆 Layout**。

```
之前（AoS — Array of Structures）：
    players = {
        user_1: { position: {x,y,z}, visual: {mesh, animation}, hp: 100, ... },
        user_2: { position: {x,y,z}, visual: {mesh, animation}, hp: 100, ... },
    }

之后（SoA — Struct of Arrays）：
    TransformStore: {
        positions: Float32Array([x1,y1,z1, x2,y2,z2, ...]),   // 连续内存
        rotations: Float32Array([r1, r2, ...]),
    }
    VisualStore: {
        meshIds: Uint8Array([0, 1, ...]),
        flags: Uint8Array([moving_bit | collision_bit, ...]),
    }
    RenderFrameData: {
        // 每帧填充的渲染数据
    }
```

**SoA 带来的好处：**

1. **Cache locality**：遍历所有位置时，`positions` 是连续内存，CPU cache 命中率极高
2. **减少 GC**：Float32Array 是 TypedArray，不产生 GC 对象
3. **按需更新**：TransformStore（每帧变）和 VisualStore（低频变）分开，不互相污染
4. **WebGPU 就绪**：Float32Array 直接映射 GPU StorageBuffer，Uint8Array flags 位字段适合低频同步，固定 64 字节 stride 一键切换 SharedArrayBuffer

```typescript
// v4 状态管理核心接口
export class TransformStore {
    // 每个槽 64 字节：position(3×4) + rotation(4×4) + scale(3×4) + padding
    private _buffer: Float32Array
    private _stride = 16  // 16 floats per entity

    getPosition(entityId: number): [number, number, number] {
        let offset = entityId * this._stride
        return [this._buffer[offset], this._buffer[offset+1], this._buffer[offset+2]]
    }

    setPosition(entityId: number, x: number, y: number, z: number) {
        let offset = entityId * this._stride
        this._buffer[offset] = x
        this._buffer[offset+1] = y
        this._buffer[offset+2] = z
    }
}
```

---

## 演进总结

| 版本 | 方案 | 体积 | GC | 类型安全 | WebGPU 就绪 |
|------|------|------|----|---------|------------|
| v1 | Immutable.js Map | ~50KB | 差 | ✅ | ❌ |
| v2 | 自制 HashMap | 0 | 差 | ⚠️ | ❌ |
| v3 | Js.Dict | 0 | 好 | ⚠️ | ❌ |
| **v4** | **SoA Store** | **0** | **极好** | **✅** | **✅** |

唯一的教训是：**别在运行时容器上过度抽象。** Immutable.js 漂亮但太重，自制 HashMap 太脆弱，原生对象反而最稳。SoA 的 TypedArray 方案则把性能提升到了另一个层次——但它不是为了性能而性能，而是为了 WebGPU 的就绪。

> **"够用"比"好用"重要。v3 Js.Dict 用了好几个月才升级到 v4，就是因为 v3 已经够用了。**

---

下期讲一个完全不同的主题——**Phase 8：SCF 部署 6 连环坑**。当代码写完了、测试跑通了，真正的噩梦才开始。

**下一篇：[Vibe Coding 多人游戏（十三）—— Phase 8：SCF 部署 6 连环坑](https://www.cnblogs.com/chaogex/p/21195307)**
