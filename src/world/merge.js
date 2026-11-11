import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merge every static mesh under `root` into one mesh per (material, shadow flags, render order).
 * Furniture, trees and garden pieces never move, so hundreds of small draw calls become a few dozen.
 * Must run after colliders are computed (they are derived from the unmerged objects).
 * `root` must sit at the world origin (its children are baked into world space).
 */
export function mergeStatic(root, { skip = () => false, cell = 10 } = {}) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const remove = [];
  const centre = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || skip(o)) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(o.matrixWorld);
    if (o.matrixWorld.determinant() < 0) flipWinding(g);
    g.morphAttributes = {};
    g.clearGroups();
    // bucket by area too (cell x cell metres, per floor) so frustum culling still skips what's behind you
    g.computeBoundingSphere();
    centre.copy(g.boundingSphere.center);
    const area = `${Math.floor(centre.x / cell)},${Math.floor(centre.z / cell)},${centre.y > 3.6 ? 1 : 0}`;
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}|${area}`;
    if (!buckets.has(key)) buckets.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder, geos: [] });
    buckets.get(key).geos.push(g);
    remove.push(o);
  });
  for (const o of remove) {
    o.parent.remove(o);
    o.geometry.dispose();
  }
  // drop groups left empty
  const empties = [];
  root.traverse((o) => { if (o !== root && o.type === 'Group' && o.children.length === 0 && !o.userData.keep) empties.push(o); });
  for (const e of empties) e.parent?.remove(e);

  let made = 0;
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const m = new THREE.Mesh(merged, b.material);
    m.castShadow = b.cast;
    m.receiveShadow = b.receive;
    m.renderOrder = b.order;
    m.matrixAutoUpdate = false;
    root.add(m);
    made++;
  }
  return { before: remove.length, after: made };
}

function flipWinding(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i += 3) {
    for (const a of [p, n, uv]) {
      if (!a) continue;
      for (let c = 0; c < a.itemSize; c++) {
        const t = a.array[(i + 1) * a.itemSize + c];
        a.array[(i + 1) * a.itemSize + c] = a.array[(i + 2) * a.itemSize + c];
        a.array[(i + 2) * a.itemSize + c] = t;
      }
    }
  }
}
