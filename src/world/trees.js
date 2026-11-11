import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { leafAtlas } from './textures.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

let leafMats = null;
function leafMaterials() {
  if (!leafMats) {
    leafMats = [
      [62, 92, 46], [70, 98, 52], [88, 104, 60],
    ].map((tint, i) => new THREE.MeshStandardMaterial({
      map: leafAtlas(11 + i * 7, tint), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9,
    }));
  }
  return leafMats;
}

const barkMat = new THREE.MeshStandardMaterial({ color: 0x8a7d70, roughness: 1 });

/**
 * Procedural broadleaf / eucalyptus-like tree: tube trunk + branches, leaf-card clusters at branch tips.
 * Returns a Group with two meshes (bark, leaves). Height in metres.
 */
export function makeTree(seed = 1, height = 12, { spread = 0.45, clusters = 9, cardsPer = 46, variant = 0 } = {}) {
  const r = rng(seed);
  const barkGeos = [], leafGeos = [];
  const tips = [];

  // trunk: slightly leaning curve
  const lean = new THREE.Vector3((r() - 0.5) * 0.12 * height, 0, (r() - 0.5) * 0.12 * height);
  const trunkTop = new THREE.Vector3(lean.x, height * 0.55, lean.z);
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean.x * 0.3, height * 0.2, lean.z * 0.3),
    trunkTop,
  ]);
  const trunkR = height * 0.022;
  const tube = (curve, radius, seg = 10) => {
    const g = new THREE.TubeGeometry(curve, seg, radius, 7, false);
    // taper: scale radius along v
    const pos = g.attributes.position, uv = g.attributes.uv;
    const c = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const t = uv.getX(i);
      curve.getPointAt(Math.min(1, t), c);
      const k = 1 - t * 0.65;
      pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k, c.y + (pos.getY(i) - c.y) * k, c.z + (pos.getZ(i) - c.z) * k);
    }
    g.computeVertexNormals();
    return g;
  };
  barkGeos.push(tube(trunkCurve, trunkR, 12));

  // branches from upper trunk
  const nb = 5 + Math.floor(r() * 3);
  for (let i = 0; i < nb; i++) {
    const t = 0.55 + r() * 0.45;
    const start = trunkCurve.getPointAt(Math.min(1, t));
    const ang = (i / nb) * Math.PI * 2 + r() * 0.8;
    const len = height * (0.28 + r() * 0.22);
    const dir = new THREE.Vector3(Math.cos(ang) * spread, 0.7 + r() * 0.5, Math.sin(ang) * spread).normalize();
    const mid = start.clone().addScaledVector(dir, len * 0.5).add(new THREE.Vector3(0, len * 0.08, 0));
    const end = start.clone().addScaledVector(dir, len);
    end.y += len * 0.15;
    barkGeos.push(tube(new THREE.CatmullRomCurve3([start, mid, end]), trunkR * (0.45 + r() * 0.2), 6));
    tips.push(end, mid.clone().lerp(end, 0.4));
  }
  tips.push(trunkTop.clone().add(new THREE.Vector3(0, height * 0.25, 0)));

  // leaf clusters: random quads around tips
  const card = new THREE.PlaneGeometry(1, 1);
  const tmp = new THREE.Object3D();
  const useTips = tips.slice(0, clusters + 3);
  for (const tip of useTips) {
    const rad = height * (0.12 + r() * 0.07);
    for (let k = 0; k < cardsPer; k++) {
      const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1);
      const d = rad * Math.cbrt(r());
      tmp.position.set(tip.x + Math.sin(v) * Math.cos(u) * d, tip.y + Math.cos(v) * d * 0.6, tip.z + Math.sin(v) * Math.sin(u) * d);
      tmp.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
      const s = height * (0.07 + r() * 0.05);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      const g = card.clone().applyMatrix4(tmp.matrix);
      // normals pointing outwards from cluster centre give soft, volumetric shading
      const n = g.attributes.normal, p = g.attributes.position;
      for (let i = 0; i < n.count; i++) {
        const nx = p.getX(i) - tip.x, ny = p.getY(i) - tip.y + rad * 0.3, nz = p.getZ(i) - tip.z;
        const l = Math.hypot(nx, ny, nz) || 1;
        n.setXYZ(i, nx / l, ny / l, nz / l);
      }
      leafGeos.push(g);
    }
  }

  const group = new THREE.Group();
  const bark = new THREE.Mesh(mergeGeometries(barkGeos), barkMat);
  bark.castShadow = true;
  const leaves = new THREE.Mesh(mergeGeometries(leafGeos), leafMaterials()[variant % 3]);
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  group.add(bark, leaves);
  return group;
}

/** Round clipped shrub (boxwood ball) built from leaf cards on a sphere. */
export function makeBoxwood(seed = 3, radius = 0.4) {
  const r = rng(seed);
  const geos = [];
  const card = new THREE.PlaneGeometry(1, 1);
  const tmp = new THREE.Object3D();
  const core = new THREE.SphereGeometry(radius * 0.9, 14, 10);
  core.translate(0, radius * 0.85, 0);
  for (let k = 0; k < 90; k++) {
    const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1);
    const d = radius * (0.85 + r() * 0.15);
    tmp.position.set(Math.sin(v) * Math.cos(u) * d, radius * 0.85 + Math.cos(v) * d * 0.85, Math.sin(v) * Math.sin(u) * d);
    tmp.lookAt(tmp.position.x * 2, tmp.position.y * 2 - radius * 0.85, tmp.position.z * 2);
    const s = radius * 0.55;
    tmp.scale.set(s, s, s);
    tmp.updateMatrix();
    geos.push(card.clone().applyMatrix4(tmp.matrix));
  }
  const g = new THREE.Group();
  const coreMesh = new THREE.Mesh(core, new THREE.MeshStandardMaterial({ color: 0x2c4422, roughness: 1 }));
  const leaves = new THREE.Mesh(mergeGeometries(geos), leafMaterials()[0]);
  coreMesh.castShadow = leaves.castShadow = true;
  g.add(coreMesh, leaves);
  return g;
}
