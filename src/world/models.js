import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

/** Loads an optimised model (single GLB: meshopt geometry + WebP textures) once. */
function loadModel(id) {
  if (!cache.has(id)) {
    cache.set(id, loader.loadAsync(`/assets/models/${id}.glb`).then((g) => {
      g.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.material.map) o.material.map.anisotropy = 4;
        }
      });
      return g.scene;
    }));
  }
  return cache.get(id);
}

/**
 * Places a model into `parent` (async). Options: position, rotationY, scale, height (fit to height),
 * tint: { meshName -> color } to recolour parts (e.g. terracotta pot -> white).
 */
export function placeModel(parent, id, { position = [0, 0, 0], rotationY = 0, scale = 1, height, recolor } = {}) {
  const holder = new THREE.Group();
  holder.userData.keep = true; // filled asynchronously; never merged away
  holder.position.set(...position);
  holder.rotation.y = rotationY;
  parent.add(holder);
  loadModel(id).then((root) => {
    const obj = root.clone(true);
    if (recolor) {
      obj.traverse((o) => {
        if (!o.isMesh) return;
        // match on name suffix ("..._pot"), so "potted_plant_02_leaves" is not caught by "pot"
        const key = Object.keys(recolor).find((k) => o.name.toLowerCase().endsWith(`_${k}`) || o.material.name.toLowerCase().endsWith(`_${k}`));
        if (key) {
          o.material = o.material.clone();
          o.material.map = null;
          o.material.color.set(recolor[key]);
          o.material.roughness = 0.6;
        }
      });
    }
    let s = scale;
    if (height) {
      const box = new THREE.Box3().setFromObject(obj);
      s = height / Math.max(0.001, box.max.y - box.min.y);
    }
    obj.scale.setScalar(s);
    holder.add(obj);
    window.dispatchEvent(new Event('model-loaded'));
  }).catch((e) => console.warn('model failed', id, e));
  return holder;
}
