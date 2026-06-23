# 基于three.js的Instanced Draw+LOD+Frustum Cull的改进实现 - 杨元超

> 日期: 2024-05-24 08:38
> 源: https://www.cnblogs.com/chaogex/p/18209850

大家好，本文在上文的基础上，优化了Instanced Draw+LOD+Frustum Cull的性能，性能提升了3倍以上


关键词：three.js、Instanced Draw、大场景、LOD、Frustum Cull、优化、Web3D、WebGL、开源


上文：

[three.js使用Instanced Draw+Frustum Cull+LOD来渲染大场景（开源）](https://www.cnblogs.com/chaogex/p/18152526)


## 相对于上文的改进点


相对于上文的Octree，本文的Octree直接遍历世界矩阵而不是Mesh，从而提高了性能


相对于上文的Instanced LOD，本文的Instanced LOD简化了数据结构，并且不再通过交换来实现cull，从而提高了性能


## 本文改进的代码


调用代码：


```
let first = new THREE.Group()
...
first.add(mesh)

let details = [
	//第一级LOD
	{
		group: first,
		level: "l0",
		distance: 800,
	},
	//第二级LOD...
	{
		group: second,
		level: "l1",
		distance: 1000,
	},
	...
]

let octree = new Octree(boundingBox, 5, 0)


let camera = 获得当前相机

let instancedlod = new InstancedLOD(staticGroup, camera, "lod")

instancedlod.setOctree(octree);
instancedlod.setLevels(details, true);
instancedlod.setPopulation();

...


在主循环中调用：
instancedlod.update()


```

Octree


```
import * as THREE from "three";

class Octree {
	public box
	public capacity
	public divided
	public transforms
	public children
	public depth

	constructor(box3, n, depth) {
		this.box = box3;
		this.capacity = n;
		this.divided = false;
		this.transforms = [];
		this.children = [];
		this.depth = depth;
	}

	subdivide() {
		const { box, capacity, depth } = this;
		let size = new THREE.Vector3().subVectors(box.max, box.min).divideScalar(2);
		let arr = [
			[0, 0, 0],
			[size.x, 0, 0],
			[0, 0, size.z],
			[size.x, 0, size.z],
			[0, size.y, 0],
			[size.x, size.y, 0],
			[0, size.y, size.z],
			[size.x, size.y, size.z],
		];
		for (let i = 0; i {
					child.queryByBox(boxRange, found);
				});
			}
			return found;
		}
	}

	queryBySphere(
		sphereRange,
		boundingBox = sphereRange.getBoundingBox(new THREE.Box3()),
		found = []
	) {
		if (!this.box.intersectsBox(boundingBox)) {
			return found;
		} else {
			for (let transform of this.transforms) {
				if (
					sphereRange.containsPoint(
						new THREE.Vector3().setFromMatrixPosition(transform)
					)
				) {
					found.push(transform);
				}
			}
			if (this.divided) {
				this.children.forEach((child) => {
					child.queryBySphere(sphereRange, boundingBox, found);
				});
			}
			return found;
		}
	}

	queryByFrustum(frustum, found = []) {
		if (!frustum.intersectsBox(this.box)) {
			return found;
		} else {
			for (let transform of this.transforms) {
				if (
					frustum.containsPoint(
						new THREE.Vector3().setFromMatrixPosition(transform)
					)
				) {
					found.push(transform);
				}
			}
			if (this.divided) {
				this.children.forEach((child) => {
					child.queryByFrustum(frustum, found);
				});
			}
			return found;
		}
	}

	display(scene) {
		// 叶子结点
		if (!this.divided && this.transforms.length > 0) {
			scene.add(new THREE.Box3Helper(this.box, 0x00ff00));
			return;
		}
		this.children.forEach((child) => {
			child.display(scene);
		});
	}
}

export { Octree };


```

Contract（用于契约检查）


```
export let buildAssetMessage = (expect:string, actual = "not as expect") => {
 return `expect ${expect}, but actual ${actual}`;
}

export let test = (message: string, func: () => boolean): void => {
 if (func() !== true) {
 throw new Error(message);
 }
}

export let requireCheck = (func: () => void, isTest: boolean): void => {
 if (!isTest) {
 return;
 }

 func();
}

export function ensureCheck(returnVal: T, func: (returnVal: T) => void, isTest: boolean): T {
 if (!isTest) {
 return returnVal;
 }

 func(returnVal);

 return returnVal;
}

export function assertPass() {
 return true;
}

export function assertTrue(source: boolean) {
 return source === true;
}

export function assertFalse(source: boolean) {
 return source === false;
}

function _isNullableExist(source: T): T extends null ? never : T extends undefined ? never : boolean;
function _isNullableExist(source:any) {
 return source !== undefined && source !== null;
};

export let assertNullableExist = _isNullableExist;

// export function assertEqual(source: S, target: T): S extends T ? true : false;
export function assertEqual(source: S, target: T): S extends T ? true : false;
export function assertEqual(source: S, target: T): S extends T ? true : false;
export function assertEqual(source: S, target: T): S extends T ? true : false;
export function assertEqual(source: S, target: T): false;
export function assertEqual(source:any, target:any) {
 return source == target;
}

export function assertNotEqual(source: S, target: T): S extends T ? false : true;
export function assertNotEqual(source: S, target: T): S extends T ? false : true;
export function assertNotEqual(source: S, target: T): S extends T ? false : true;
export function assertNotEqual(source: S, target: T): true;
export function assertNotEqual(source:any, target:any) {
 return source != target;
}

export function assertGt(source: number, target: number) {
 return source > target;
}

export function assertGte(source: number, target: number) {
 return source >= target;
}

export function assertLt(source: number, target: number) {
 return source ,
			count: number,
			matrix4: Array,
			castShadow: boolean,
			receiveShadow: boolean
		}>
	public groupOfInstances


	public octree

	public frustum
	public worldProjectionMatrix
	public obj_position
	public cur_dist
	public cur_level

	constructor(scene, camera, treeSpecies) {
		this.treeSpecies = treeSpecies;
		this.numOfLevel = 0;
		this.scene = scene;
		this.camera = camera;
		this.levels;
		this.instancedMeshOfAllLevel;
		this.groupOfInstances;

		this.frustum = new THREE.Frustum();
		this.worldProjectionMatrix = new THREE.Matrix4();
		this.obj_position = new THREE.Vector3();
		this.cur_dist = 0;
		this.cur_level = 0;
	}

	setOctree(octree) {
		this.octree = octree;
	}

	extractMeshes(group) {
		return group.children
	}

	setLevels(array, isDebug) {
		requireCheck(() => {
			let group = array[0].group

			test("meshs should be first level children", () => {
				return group.children.reduce((result, child: THREE.Mesh) => {
					if (!result) {
						return result
					}

					return child.isMesh && child.children.length == 0
				}, true)
			})
			test("transform should be default", () => {
				return group.children.reduce((result, child: THREE.Mesh) => {
					if (!result) {
						return result
					}

					return child.position.equals(new THREE.Vector3(0, 0, 0)) && child.rotation.equals(new THREE.Euler(0, 0, 0)) && child.scale.equals(new THREE.Vector3(1, 1, 1))
				}, true)
			})
		}, isDebug)

		this.numOfLevel = array.length;
		this.levels = new Array(this.numOfLevel);
		this.instancedMeshOfAllLevel = new Array(this.numOfLevel); // array of { mesh:[], count, matrix4:[] }
		this.groupOfInstances = new Array(this.numOfLevel); // array of THREE.Group(), each Group -> tree meshes in each level
		for (let i = 0; i {
				const instancedMesh = new THREE.InstancedMesh(
					m.geometry,
					m.material,
					15000
				);
				instancedMesh.castShadow = castShadow;
				instancedMesh.receiveShadow = receiveShadow;

				group.add(instancedMesh);
			});
			this.groupOfInstances[i] = group;
			this.scene.add(group);
		}
	}

	getDistanceLevel(dist) {
		const { levels } = this;
		const length = levels.length;
		for (let i = 0; i {
			plane.constant += offset;
		});
	}

	/* update函数每帧都要进行,内存交换越少越好,计算时间越短越好 */
	// render() {
	update() {
		count++
		let {
			instancedMeshOfAllLevel,
			groupOfInstances,
			numOfLevel,
			camera,
			frustum,
			octree,
			worldProjectionMatrix,
			obj_position,
			cur_dist,
			cur_level,
		} = this;
		// clear
		for (let i = 0; i {
			obj_position.setFromMatrixPosition(matrix);
			cur_dist = obj_position.distanceTo(camera.position);
			cur_level = this.getDistanceLevel(cur_dist);
			if (cur_level != -1) {
				instancedMeshOfAllLevel[cur_level].count++;
				instancedMeshOfAllLevel[cur_level].matrix4.push(matrix); // column-major list of a matrix
			}
		});

		for (let i = 0; i = obj.count) {
					instancedMesh.count = obj.count;
					for (let k = 0; k < obj.count; k++) {
						instancedMesh.instanceMatrix.needsUpdate = true;
						instancedMesh.setMatrixAt(k, obj.matrix4[k]);
					}
				} else {
					let new_instancedMesh = new THREE.InstancedMesh(
						obj.meshes[j].geometry,
						obj.meshes[j].material,
						obj.count
					);
					for (let k = 0; k < obj.count; k++) {
						new_instancedMesh.setMatrixAt(k, obj.matrix4[k]);
					}
					new_instancedMesh.castShadow = obj.castShadow;
					new_instancedMesh.receiveShadow = obj.receiveShadow;
					groupOfInstances[i].children[j] = new_instancedMesh;
				}
			}
		}
	}
}

export { InstancedLOD };

```