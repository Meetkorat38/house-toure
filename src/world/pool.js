import * as THREE from 'three';
import { M } from './materials.js';
import { metricUV } from './furniture.js';

/**
 * Pool area from the footage: round pool with a slim travertine coping, a rounded-square spa
 * attached on the east side, a solid travertine ring deck, an outer ring of curved slabs with
 * grass joints, and long pads stepping down from the house terrace.
 * Plan coords (x, z); shape coords (x, -z) — see exterior.js.
 */

const shapeArc = (path, cx, cz, r, a0, a1, cw) => path.absarc(cx, -cz, r, -a0, -a1, cw);

function roundedRect(path, cx, cz, w, d, rad, reverse = false) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = -cz - d / 2, y1 = -cz + d / 2;
  const pts = [];
  const corner = (x, y, a) => { for (let i = 0; i <= 6; i++) { const t = a + (i / 6) * (Math.PI / 2); pts.push([x + Math.cos(t) * rad, y + Math.sin(t) * rad]); } };
  corner(x1 - rad, y0 + rad, -Math.PI / 2);
  corner(x1 - rad, y1 - rad, 0);
  corner(x0 + rad, y1 - rad, Math.PI / 2);
  corner(x0 + rad, y0 + rad, Math.PI);
  if (reverse) pts.reverse();
  path.moveTo(...pts[0]);
  for (const p of pts.slice(1)) path.lineTo(...p);
  path.closePath();
  return path;
}

/**
 * Outline of the union of a circle and a rounded rectangle (both convex and overlapping):
 * keep each boundary's points that lie outside the other shape, then sort by angle around a
 * point inside both — valid because a union of two overlapping convex sets is star-shaped.
 */
function circleRectUnion(cx, cz, r, rx, rz, w, d, rad) {
  const pts = [];
  const inRect = (x, z) => {
    const qx = Math.abs(x - rx) - (w / 2 - rad), qz = Math.abs(z - rz) - (d / 2 - rad);
    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rad < -1e-4;
  };
  for (let i = 0; i < 160; i++) {
    const t = (i / 160) * Math.PI * 2, x = cx + Math.cos(t) * r, z = cz + Math.sin(t) * r;
    if (!inRect(x, z)) pts.push([x, z]);
  }
  const rr = roundedRect(new THREE.Path(), rx, rz, w, d, rad).getPoints(8);
  for (const p of rr) {
    const x = p.x, z = -p.y;
    if (Math.hypot(x - cx, z - cz) > r + 1e-4) pts.push([x, z]);
  }
  // pivot: a point inside both shapes (towards the rect from the circle centre)
  const dx = rx - cx, dz = rz - cz, L = Math.hypot(dx, dz) || 1;
  const k = Math.min(r * 0.98, L), px = cx + (dx / L) * k, pz = cz + (dz / L) * k;
  pts.sort((a, b) => Math.atan2(a[1] - pz, a[0] - px) - Math.atan2(b[1] - pz, b[0] - px));
  return pts;
}

function polyShape(pts, Ctor = THREE.Shape, reverse = false) {
  const p = new Ctor();
  const list = reverse ? [...pts].reverse() : pts;
  p.moveTo(list[0][0], -list[0][1]);
  for (const q of list.slice(1)) p.lineTo(q[0], -q[1]);
  p.closePath();
  return p;
}

function extrudeFlat(shape, y0, h, curveSegments = 64, bevel = 0.008) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, h - bevel * 2), curveSegments,
    bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + bevel, 0);
  return metricUV(g);
}

/** Tileable caustics: cellular-noise web, animated by scrolling two layers. */
function causticsTexture() {
  const N = 256, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pts = Array.from({ length: 22 }, () => [rnd() * N, rnd() * N]);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let f1 = 1e9, f2 = 1e9;
      for (const [px, py] of pts) {
        for (let ox = -N; ox <= N; ox += N) for (let oy = -N; oy <= N; oy += N) {
          const d = Math.hypot(x - px - ox, y - py - oy);
          if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
        }
      }
      const edge = Math.max(0, 1 - (f2 - f1) / 9);
      const v = Math.pow(edge, 2.2) * 255;
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildPoolArea(group, ex, colliders) {
  const [cx, cz] = ex.pool.center;
  const R = ex.pool.r;
  const [sx, sz] = ex.spa.center;
  const [sw, sd] = ex.spa.size;
  const srad = ex.spa.radius;
  const D = ex.deck;
  const copeW = 0.35;
  const parts = [];
  const add = (geo, mat, { cast = false } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    m.castShadow = cast;
    group.add(m);
    parts.push(m);
    return m;
  };

  // ---- inner deck: travertine ring around the pool, bulging out around the spa ----
  const spaPad = D.spaMargin ?? 1.6;
  const outline = circleRectUnion(cx, cz, D.r1, sx, sz, sw + (copeW + spaPad) * 2, sd + (copeW + spaPad) * 2, srad + copeW + spaPad * 0.8);
  const deck = polyShape(outline);
  // one merged hole: pool coping + spa coping overlap where the spa joins the pool
  deck.holes.push(polyShape(circleRectUnion(cx, cz, R + copeW, sx, sz, sw + copeW * 2, sd + copeW * 2, srad + copeW), THREE.Path, true));
  add(extrudeFlat(deck, -0.07, 0.07, 96, 0.004), M.paver);

  // copings: slightly raised, bullnosed rims
  const poolCope = new THREE.Shape();
  poolCope.absarc(cx, -cz, R + copeW, 0, Math.PI * 2, false);
  poolCope.holes.push(new THREE.Path().absarc(cx, -cz, R, 0, Math.PI * 2, true));
  add(extrudeFlat(poolCope, -0.04, 0.07, 128, 0.015), M.paver, { cast: true });
  const spaCope = roundedRect(new THREE.Shape(), sx, sz, sw + copeW * 2, sd + copeW * 2, srad + copeW);
  spaCope.holes.push(roundedRect(new THREE.Path(), sx, sz, sw, sd, srad, true));
  add(extrudeFlat(spaCope, -0.04, 0.09, 32, 0.015), M.paver, { cast: true });

  // ---- outer ring: curved slabs with grass joints (lawn shows through the gaps) ----
  const [a0, a1] = D.ring2.map(THREE.MathUtils.degToRad);
  const n = D.ring2Slabs;
  const gapA = 0.05 / D.r2;
  for (let i = 0; i < n; i++) {
    const s0 = a0 + ((a1 - a0) * i) / n + gapA, s1 = a0 + ((a1 - a0) * (i + 1)) / n - gapA;
    const outer = D.r2 + ((i * 37) % 5) * 0.12; // slightly ragged outer edge, as in the video
    const sh = new THREE.Shape();
    shapeArc(sh, cx, cz, outer, s0, s1, true);
    shapeArc(sh, cx, cz, D.r1 + 0.06, s1, s0, false);
    sh.closePath();
    add(extrudeFlat(sh, -0.07, 0.077, 24, 0.006), M.paver);
  }

  // ---- stepping pads from the house terrace, following a gentle arc ----
  const padGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const [px, pz, rot, w] of ex.pads) {
    const g = padGeo.clone();
    g.scale(w, 0.075, 0.95);
    g.rotateY(rot);
    g.translate(px, -0.07 + 0.0375 + 0.006, pz);
    add(metricUV(g), M.paver);
  }

  // ---- basins ----
  const depth = 1.6;
  const wallMat = M.poolTile.clone();
  wallMat.side = THREE.BackSide;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, depth, 96, 1, true), wallMat);
  wall.position.set(cx, -depth / 2 - 0.04, cz);
  group.add(wall);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.002, R - 0.002, 0.15, 96, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2f5f6a, roughness: 0.25, side: THREE.BackSide }));
  band.position.set(cx, -0.13, cz);
  group.add(band);

  const caustics = causticsTexture();
  caustics.repeat.set(0.35, 0.35);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x8fd3db, roughness: 0.4, emissive: 0xb8f4ff, emissiveMap: caustics, emissiveIntensity: 0.45,
  });
  const floorGeo = new THREE.CircleGeometry(R, 96);
  floorGeo.rotateX(-Math.PI / 2);
  // planar metre UVs so the caustic scale is constant
  const uv = floorGeo.attributes.uv, pos = floorGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(cx, -depth - 0.04, cz);
  group.add(floor);

  const waterGeo = new THREE.CircleGeometry(R, 96);
  waterGeo.rotateX(-Math.PI / 2);
  const wuv = waterGeo.attributes.uv, wpos = waterGeo.attributes.position;
  for (let i = 0; i < wuv.count; i++) wuv.setXY(i, wpos.getX(i), wpos.getZ(i));
  const water = new THREE.Mesh(waterGeo, M.water);
  water.position.set(cx, -0.1, cz);
  water.renderOrder = 1;
  group.add(water);

  // spa: rounded-square basin, slightly warmer water tint, own caustics
  const spaDepth = 0.85;
  const spaShape = roundedRect(new THREE.Shape(), sx, sz, sw, sd, srad);
  const spaWallGeo = new THREE.ExtrudeGeometry(spaShape, { depth: spaDepth, bevelEnabled: false, curveSegments: 16 });
  spaWallGeo.rotateX(-Math.PI / 2);
  spaWallGeo.translate(0, -spaDepth - 0.04, 0);
  // extrude groups: 0 = caps (hidden, they would lid the basin), 1 = side walls
  group.add(new THREE.Mesh(spaWallGeo, [new THREE.MeshBasicMaterial({ visible: false }), wallMat]));
  const spaFloor = new THREE.Mesh(new THREE.ShapeGeometry(spaShape, 16).rotateX(-Math.PI / 2), floorMat);
  spaFloor.position.y = -spaDepth - 0.035;
  group.add(spaFloor);
  const spaWater = new THREE.Mesh(new THREE.ShapeGeometry(spaShape, 16).rotateX(-Math.PI / 2), M.water);
  spaWater.position.y = -0.09;
  spaWater.renderOrder = 1;
  group.add(spaWater);

  // ---- colliders: pool rim + spa rim ----
  const N = 40;
  for (let i = 0; i < N; i++) {
    const t0 = (i / N) * Math.PI * 2, t1 = ((i + 1) / N) * Math.PI * 2;
    colliders.push({ ax: cx + Math.cos(t0) * (R + 0.05), az: cz + Math.sin(t0) * (R + 0.05),
      bx: cx + Math.cos(t1) * (R + 0.05), bz: cz + Math.sin(t1) * (R + 0.05), y0: -2, y1: 1, r: 0.05 });
  }
  const hx = sw / 2 + 0.05, hz = sd / 2 + 0.05;
  for (const [ax, az, bx, bz] of [[-hx, -hz, hx, -hz], [hx, -hz, hx, hz], [hx, hz, -hx, hz], [-hx, hz, -hx, -hz]]) {
    colliders.push({ ax: sx + ax, az: sz + az, bx: sx + bx, bz: sz + bz, y0: -2, y1: 1, r: 0.05 });
  }

  const update = (dt) => {
    caustics.offset.x += dt * 0.02;
    caustics.offset.y += dt * 0.013;
    floorMat.emissiveIntensity = 0.4 + Math.sin(performance.now() * 0.0011) * 0.06;
    const nm = M.water.normalMap;
    nm.offset.x += dt * 0.012;
    nm.offset.y += dt * 0.007;
  };
  // lawn hole = deck outline (grown by 1 cm so no grass shows at the seam)
  const grow = outline.map(([x, z]) => {
    const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1;
    return [x + (dx / l) * 0.01, z + (dz / l) * 0.01];
  });
  return { update, lawnHole: polyShape(grow, THREE.Path, true) };
}
