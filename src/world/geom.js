import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Accumulates static world-space boxes/quads per material and emits one merged mesh per material.
 * UVs are planar in metres (top faces use x/z, side faces use the horizontal axis + y), so
 * textures keep a consistent real-world scale across every wall and floor.
 */
export class StaticBatch {
  constructor() {
    this.parts = new Map(); // material -> geometry[]
  }

  push(material, geo) {
    if (!material) return;
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(geo);
  }

  /** faces: material or { px, nx, py, ny, pz, nz } (missing faces are skipped) */
  box(x0, y0, z0, x1, y1, z1, faces) {
    const f = faces && faces.isMaterial ? { px: faces, nx: faces, py: faces, ny: faces, pz: faces, nz: faces } : faces;
    const q = (mat, verts, normal, uvFn) => {
      if (!mat) return;
      const pos = new Float32Array(12), nor = new Float32Array(12), uv = new Float32Array(8);
      verts.forEach((v, i) => {
        pos.set(v, i * 3);
        nor.set(normal, i * 3);
        uv.set(uvFn(v), i * 2);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      this.push(mat, g);
    };
    // each quad wound counter-clockwise seen from outside
    q(f.py, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], (v) => [v[0], -v[2]]);
    q(f.ny, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], (v) => [v[0], v[2]]);
    q(f.pz, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], (v) => [v[0], v[1]]);
    q(f.nz, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], (v) => [-v[0], v[1]]);
    q(f.px, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], (v) => [-v[2], v[1]]);
    q(f.nx, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], (v) => [v[2], v[1]]);
  }

  /** Arbitrary geometry already in world space (keeps its own UVs). */
  geometry(material, geo) {
    const g = geo.index ? geo : geo;
    if (!g.attributes.uv) {
      const n = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    }
    this.push(material, g.index ? g.toNonIndexed() : g);
  }

  build(group, { shadows = true } = {}) {
    for (const [mat, geos] of this.parts) {
      const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      const transparent = mat.transparent || mat.userData.noShadow;
      mesh.castShadow = shadows && !transparent;
      mesh.receiveShadow = shadows && !mat.userData.noReceive;
      if (transparent) mesh.renderOrder = 2;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}

/** Bake a mesh's transform into a cloned geometry (for batching procedural parts). */
export function bake(geo, position, rotationY = 0, scale = 1) {
  const g = geo.clone();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY),
    new THREE.Vector3(scale, scale, scale),
  );
  g.applyMatrix4(m);
  return g;
}
