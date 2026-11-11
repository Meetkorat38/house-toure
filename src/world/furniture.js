import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { M } from './materials.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Re-project UVs in metres by dominant normal axis so fabric/stone keep real scale. */
export function metricUV(geo) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    if (ay >= ax && ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; }
    else if (ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; }
    else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export const rbox = (w, h, d, r = 0.03, s = 3) => metricUV(new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2, h / 2, d / 2) * 0.999));
export const cyl = (rt, rb, h, seg = 32) => metricUV(new THREE.CylinderGeometry(rt, rb, h, seg));

export function part(parent, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = !material.transparent && !material.userData.noShadow;
  m.receiveShadow = true;
  if (material.transparent) m.renderOrder = 2;
  parent.add(m);
  return m;
}

/** Lathe from [radius, height] pairs (profile drawn bottom → top). */
export const lathe = (pts, seg = 40) => metricUV(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));

/** Curved shell: annulus sector extruded upwards (barrel/club chair backs). */
export function arcShell(rOuter, thick, height, spanDeg, bevel = 0.03) {
  const span = THREE.MathUtils.degToRad(spanDeg);
  const a0 = Math.PI / 2 + span / 2, a1 = Math.PI / 2 - span / 2; // open towards -y (front)
  const s = new THREE.Shape();
  const rI = rOuter - thick;
  s.absarc(0, 0, rOuter, a0, a1 + Math.PI * 2 * (a1 < a0 ? 0 : 0), true);
  s.absarc(0, 0, rI, a1, a0, false);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: height - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 4, curveSegments: 40 });
  g.rotateX(-Math.PI / 2); // extrude along +y; shape y -> -z
  g.translate(0, bevel, 0);
  g.computeVertexNormals();
  return metricUV(g);
}

export function pillow(parent, mat, x, y, z, ry = 0, w = 0.5, h = 0.46, tilt = -0.25) {
  const g = rbox(w, h, 0.16, 0.07, 4);
  part(parent, g, mat, x, y + h / 2, z, tilt, ry, 0);
}

// ---------------------------------------------------------------------------
// seating
// ---------------------------------------------------------------------------

/**
 * Straight sofa run along +x from 0..len, seat front faces +z.
 * style: 'channel' (vertical tufted back, great room), 'cushion' (loose back cushions), 'low' (media platform)
 */
function sofaRun(g, len, { depth = 1.05, style = 'channel', fabric = M.fabricGrey, seatH = 0.42, backH = 0.78, armL = false, armR = false } = {}) {
  const base = 0.09;
  part(g, rbox(len - 0.04, base, depth - 0.12, 0.01), M.metalBlack, len / 2, base / 2, 0.02);
  const armW = 0.22;
  const x0 = armL ? armW : 0, x1 = armR ? len - armW : len;
  // seat cushions
  const seatN = Math.max(1, Math.round((x1 - x0) / 0.95));
  const sw = (x1 - x0) / seatN;
  for (let i = 0; i < seatN; i++) {
    part(g, rbox(sw - 0.01, seatH - base, depth - 0.24, 0.07, 4), fabric, x0 + sw * (i + 0.5), base + (seatH - base) / 2, 0.11);
  }
  // back
  const backD = 0.24;
  if (style === 'channel') {
    const n = Math.max(2, Math.round(len / 0.21));
    const cw = len / n;
    for (let i = 0; i < n; i++) {
      part(g, rbox(cw + 0.004, backH - base, backD, 0.09, 4), fabric, cw * (i + 0.5), base + (backH - base) / 2, -depth / 2 + backD / 2);
    }
  } else {
    part(g, rbox(len, backH * 0.55, backD, 0.06, 4), fabric, len / 2, base + backH * 0.275, -depth / 2 + backD / 2);
    const n = Math.max(1, Math.round((x1 - x0) / 0.8));
    const cw = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      part(g, rbox(cw - 0.02, style === 'low' ? 0.42 : 0.5, 0.2, 0.09, 4), fabric, x0 + cw * (i + 0.5), seatH + 0.22, -depth / 2 + backD + 0.06, -0.12, 0, 0);
    }
  }
  if (armL) part(g, rbox(armW, seatH + 0.16, depth, 0.08, 4), fabric, armW / 2, (seatH + 0.16) / 2, 0);
  if (armR) part(g, rbox(armW, seatH + 0.16, depth, 0.08, 4), fabric, len - armW / 2, (seatH + 0.16) / 2, 0);
}

/** L-shaped sectional: main run along x (facing +z) + return along z on the left (facing +x). */
export function sectionalL({ len = 5, ret = 3.2, depth = 1.05, style = 'channel', fabric = M.fabricGrey, pillows = [], pillowMat = M.fabricBeige, backH } = {}) {
  // Main run: x 0..len, back at z = -depth/2, seats face +z.
  // Return: back along x = 0, occupies x 0..depth, runs from z = depth/2 to depth/2 + L, seats face +x.
  const g = new THREE.Group();
  const main = new THREE.Group();
  sofaRun(main, len, { depth, style, fabric, armR: style !== 'channel', backH });
  g.add(main);
  const L = ret - depth;
  const side = new THREE.Group();
  sofaRun(side, L, { depth, style, fabric, armL: style !== 'channel', backH });
  side.rotation.y = Math.PI / 2; // local +x -> world -z, local +z (front) -> world +x
  side.position.set(depth / 2, 0, depth / 2 + L);
  g.add(side);
  g.userData.parts = [main, side]; // collide per run, not the whole L bounding box
  for (const p of pillows) pillow(g, p.mat || pillowMat, p.x, 0.42, p.z, p.ry || 0, p.w, p.h);
  return g;
}

/** Straight sofa (used for simpler runs). */
export function sofa({ len = 2.6, depth = 1.0, style = 'cushion', fabric = M.fabricBeige, armL = true, armR = true } = {}) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  sofaRun(inner, len, { depth, style, fabric, armL, armR });
  inner.position.x = -len / 2;
  g.add(inner);
  return g;
}

/** Curved bouclé lounge chair with walnut base (great room). Front faces +z. */
export function boucleChair() {
  const g = new THREE.Group();
  part(g, arcShell(0.43, 0.14, 0.56, 230, 0.05), M.boucle, 0, 0.2, 0);
  part(g, lathe([[0, 0], [0.33, 0], [0.37, 0.05], [0.37, 0.11], [0.33, 0.16], [0, 0.17]]), M.boucle, 0, 0.2, 0.03);
  part(g, lathe([[0, 0], [0.38, 0], [0.4, 0.03], [0.4, 0.17], [0.37, 0.2], [0, 0.2]]), M.walnut, 0, 0, 0);
  return g;
}

/** White leather swivel barrel chair (media lounge). Front faces +z. */
export function barrelChair() {
  const g = new THREE.Group();
  part(g, arcShell(0.42, 0.13, 0.48, 250, 0.05), M.white, 0, 0.3, 0);
  part(g, lathe([[0, 0], [0.32, 0], [0.35, 0.05], [0.35, 0.12], [0.31, 0.15], [0, 0.16]]), M.white, 0, 0.29, 0.03);
  part(g, lathe([[0, 0], [0.26, 0], [0.26, 0.015], [0.04, 0.03], [0.04, 0.29], [0, 0.29]]), M.brass, 0, 0, 0);
  return g;
}

/** Counter stool: white upholstered seat + back, walnut frame. Front faces +z. */
export function barStool() {
  const g = new THREE.Group();
  const seatY = 0.72, w = 0.46, d = 0.44;
  part(g, rbox(w, 0.09, d, 0.035, 3), M.boucle, 0, seatY, 0.02);
  part(g, rbox(w - 0.02, 0.36, 0.07, 0.03, 3), M.boucle, 0, seatY + 0.26, -d / 2 + 0.05, -0.08, 0, 0);
  const legT = 0.035;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    part(g, rbox(legT, seatY, legT, 0.008, 2), M.walnutDark, sx * (w / 2 - 0.03), seatY / 2, sz * (d / 2 - 0.03));
  }
  for (const sx of [-1, 1]) part(g, rbox(legT, 0.42, legT, 0.008, 2), M.walnutDark, sx * (w / 2 - 0.03), seatY + 0.2, -d / 2 + 0.03);
  part(g, rbox(w - 0.06, 0.025, 0.025, 0.006, 2), M.walnutDark, 0, 0.26, d / 2 - 0.03);
  part(g, rbox(0.025, 0.025, d - 0.06, 0.006, 2), M.walnutDark, -(w / 2 - 0.03), 0.26, 0);
  part(g, rbox(0.025, 0.025, d - 0.06, 0.006, 2), M.walnutDark, (w / 2 - 0.03), 0.26, 0);
  return g;
}

/** Upholstered dining chair with walnut legs. Front faces +z. */
export function diningChair() {
  const g = new THREE.Group();
  part(g, rbox(0.5, 0.08, 0.5, 0.03, 3), M.fabricBeige, 0, 0.47, 0);
  part(g, rbox(0.5, 0.42, 0.07, 0.03, 3), M.fabricBeige, 0, 0.74, -0.22, -0.1, 0, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    part(g, rbox(0.035, 0.44, 0.035, 0.008, 2), M.walnutDark, sx * 0.21, 0.22, sz * 0.21);
  }
  return g;
}

/** Cylindrical drum ottoman on brass ring (media). */
export function drumOttoman(r = 0.3) {
  const g = new THREE.Group();
  part(g, lathe([[0, 0], [r - 0.03, 0], [r, 0.03], [r, 0.38], [r - 0.03, 0.41], [0, 0.42]]), M.fabricBeige, 0, 0.04, 0);
  part(g, cyl(r - 0.02, r - 0.02, 0.04), M.brass, 0, 0.02, 0);
  return g;
}

/** Sculptural stacked black totem (great room accent). */
export function blackTotem() {
  const g = new THREE.Group();
  part(g, rbox(0.55, 0.3, 0.42, 0.13, 5), M.leatherBlack, 0, 0.15, 0);
  part(g, rbox(0.5, 0.26, 0.4, 0.12, 5), M.leatherBlack, 0.02, 0.43, 0);
  part(g, rbox(0.52, 0.26, 0.42, 0.12, 5), M.leatherBlack, -0.01, 0.69, 0);
  return g;
}

/** Outdoor chaise lounger (pool deck). Long axis along z, head at -z. */
export function lounger() {
  const g = new THREE.Group();
  part(g, rbox(0.7, 0.06, 2.0, 0.02), M.metalBlack, 0, 0.3, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, rbox(0.04, 0.3, 0.04, 0.01), M.metalBlack, sx * 0.31, 0.15, sz * 0.92);
  part(g, rbox(0.66, 0.08, 1.35, 0.035), M.fabricGrey, 0, 0.37, 0.3);
  part(g, rbox(0.66, 0.08, 0.7, 0.035), M.fabricGrey, 0, 0.55, -0.62, 0.55, 0, 0);
  return g;
}

// ---------------------------------------------------------------------------
// tables
// ---------------------------------------------------------------------------

/** Stacked travertine block coffee table (great room). */
export function travertineTable() {
  const g = new THREE.Group();
  part(g, rbox(1.3, 0.34, 0.85, 0.015, 2), M.travertine, 0, 0.17, 0);
  part(g, rbox(0.85, 0.24, 0.65, 0.015, 2), M.travertine, 0.55, 0.12, 0.42);
  return g;
}

export function pedestalSideTable(material = M.whiteStone, r = 0.26, h = 0.5) {
  const g = new THREE.Group();
  part(g, lathe([[0, 0], [r * 0.8, 0], [r * 0.6, 0.06], [r * 0.45, h * 0.5], [r * 0.6, h - 0.06], [r, h - 0.04], [r, h], [0, h]]), material);
  return g;
}

export function roundCoffeeTable(r = 0.62, h = 0.4, top = M.walnutDark, base = M.walnutDark) {
  const g = new THREE.Group();
  part(g, lathe([[0, 0], [r, 0], [r, 0.05], [0, 0.05]], 64), top, 0, h - 0.05, 0);
  part(g, lathe([[0, 0], [r * 0.55, 0], [r * 0.45, 0.04], [r * 0.4, h - 0.05], [0, h - 0.05]], 48), base);
  return g;
}

export function glassCoffeeTable() {
  const g = new THREE.Group();
  part(g, rbox(1.5, 0.025, 0.9, 0.008, 2), M.glassTable, 0, 0.4, 0);
  for (const [x, z] of [[-0.6, -0.32], [0.6, -0.32], [-0.6, 0.32], [0.6, 0.32], [-0.2, 0], [0.25, 0.05]]) {
    part(g, cyl(0.035, 0.035, 0.39, 20), M.glassTable, x, 0.195, z);
  }
  part(g, rbox(1.1, 0.012, 0.55, 0.004, 2), M.blackGlass, 0, 0.12, 0);
  return g;
}

export function diningTable(len = 2.6, w = 1.0) {
  const g = new THREE.Group();
  part(g, rbox(len, 0.05, w, 0.012, 2), M.walnut, 0, 0.75, 0);
  for (const sx of [-1, 1]) part(g, rbox(0.08, 0.72, w * 0.7, 0.01, 2), M.walnutDark, sx * (len / 2 - 0.35), 0.36, 0);
  return g;
}

// ---------------------------------------------------------------------------
// kitchen
// ---------------------------------------------------------------------------

/** Marble waterfall island along x, centred, height 0.92. Stools side faces +z. */
export function waterfallIsland(len = 4.4, depth = 1.15, h = 0.92) {
  const g = new THREE.Group();
  const t = 0.06;
  part(g, rbox(len, t, depth, 0.004, 1), M.marble, 0, h - t / 2, 0);
  for (const sx of [-1, 1]) part(g, rbox(t, h - t, depth, 0.004, 1), M.marble, sx * (len / 2 - t / 2), (h - t) / 2, 0);
  // front marble panel (seating side is overhang: panel set back 0.3)
  part(g, rbox(len - 2 * t, h - t - 0.1, 0.03, 0.002, 1), M.marble, 0, (h - t + 0.1) / 2, -depth / 2 + 0.015);
  part(g, rbox(len - 2 * t, h - t - 0.1, depth - 0.33, 0.002, 1), M.cabinetDark, 0, (h - t + 0.1) / 2, -0.15);
  part(g, rbox(len - 2 * t - 0.1, 0.1, depth - 0.4, 0.002, 1), M.shadowGap, 0, 0.05, -0.15);
  // sink + black faucet
  part(g, rbox(0.7, 0.006, 0.42, 0.002, 1), M.metalBlack, -0.6, h + 0.001, -0.12);
  part(g, cyl(0.016, 0.02, 0.3, 12), M.metalBlack, -0.6, h + 0.15, -0.4);
  part(g, rbox(0.024, 0.024, 0.22, 0.01, 2), M.metalBlack, -0.6, h + 0.3, -0.3);
  return g;
}

/** Tall handle-less cabinetry wall with two ovens and a lit niche. Front faces +z. */
export function cabinetWall(len = 6.4, h = 2.9, depth = 0.62) {
  const g = new THREE.Group();
  part(g, rbox(len, h, depth, 0.004, 1), M.cabinetDark, 0, h / 2, 0);
  const n = Math.round(len / 0.6);
  for (let i = 1; i < n; i++) {
    const x = -len / 2 + (len * i) / n;
    part(g, new THREE.BoxGeometry(0.006, h - 0.12, 0.004), M.shadowGap, x, h / 2 + 0.03, depth / 2 + 0.004);
  }
  part(g, new THREE.BoxGeometry(len - 0.02, 0.006, 0.004), M.shadowGap, 0, 0.9, depth / 2 + 0.004);
  part(g, new THREE.BoxGeometry(len - 0.02, 0.006, 0.004), M.shadowGap, 0, 2.1, depth / 2 + 0.004);
  for (const [x, y] of [[-1.5, 1.05], [-1.5, 1.72]]) {
    part(g, rbox(0.58, 0.58, 0.02, 0.004, 1), M.blackGlass, x, y, depth / 2 + 0.01);
    part(g, rbox(0.5, 0.018, 0.02, 0.008, 2), M.chrome, x, y + 0.24, depth / 2 + 0.035);
  }
  // open niche with warm strip
  part(g, rbox(1.6, 0.7, 0.04, 0.002, 1), M.walnut, 1.3, 1.35, depth / 2 - 0.15);
  part(g, new THREE.BoxGeometry(1.5, 0.012, 0.02), M.led, 1.3, 1.68, depth / 2 - 0.05);
  part(g, rbox(1.62, 0.04, 0.3, 0.002, 1), M.marble, 1.3, 0.99, depth / 2 - 0.15);
  return g;
}

/** Floating walnut ceiling panel with warm LED cove (hangs from ceiling at cy). */
export function floatingPanel(w = 5.4, d = 3.0, drop = 0.38) {
  const g = new THREE.Group();
  part(g, rbox(w, 0.1, d, 0.006, 1), M.walnutDark, 0, -drop, 0);
  part(g, new THREE.BoxGeometry(w + 0.04, 0.02, d + 0.04), M.led, 0, -drop + 0.06, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, cyl(0.006, 0.006, drop, 6), M.metalBlack, sx * (w / 2 - 0.3), -drop / 2, sz * (d / 2 - 0.3));
  return g;
}

/** Long glass cylinder pendant with brass cap. y = 0 is the ceiling/mount point. */
export function glassPendant(drop = 1.0, len = 0.55) {
  const g = new THREE.Group();
  part(g, cyl(0.003, 0.003, drop, 6), M.metalBlack, 0, -drop / 2, 0);
  part(g, cyl(0.045, 0.06, 0.06, 24), M.brass, 0, -drop - 0.03, 0);
  part(g, cyl(0.055, 0.055, len, 32), M.pendantGlass, 0, -drop - 0.06 - len / 2, 0);
  part(g, cyl(0.06, 0.06, 0.012, 24), M.brass, 0, -drop - 0.06 - len, 0);
  return g;
}

export function linearPendant(len = 1.8, drop = 1.15) {
  const g = new THREE.Group();
  part(g, rbox(len, 0.04, 0.05, 0.01, 2), M.metalBlack, 0, -drop, 0);
  part(g, new THREE.BoxGeometry(len - 0.04, 0.006, 0.03), M.led, 0, -drop - 0.022, 0);
  for (const sx of [-1, 1]) part(g, cyl(0.002, 0.002, drop, 4), M.metalBlack, sx * (len / 2 - 0.1), -drop / 2, 0);
  return g;
}

// ---------------------------------------------------------------------------
// media
// ---------------------------------------------------------------------------

export function platform(w, d, h = 0.13) {
  const g = new THREE.Group();
  part(g, rbox(w, h, d, 0.01, 2), M.oak, 0, h / 2, 0);
  return g;
}

/** Projector screen on a wall; faces +z. */
export function screen(w = 4.2, h = 2.36) {
  const g = new THREE.Group();
  part(g, rbox(w + 0.12, h + 0.12, 0.05, 0.01, 2), M.metalBlack, 0, 0, 0);
  part(g, new THREE.PlaneGeometry(w, h), M.screen, 0, 0, 0.026);
  return g;
}

export function barCounter(len = 3.6) {
  const g = new THREE.Group();
  part(g, rbox(len, 1.02, 0.6, 0.01, 2), M.walnutDark, 0, 0.51, 0);
  part(g, rbox(len + 0.06, 0.04, 0.7, 0.005, 1), M.marble, 0, 1.04, 0.03);
  return g;
}

// ---------------------------------------------------------------------------
// soft furnishings & decor
// ---------------------------------------------------------------------------

export function rug(w, d, material = M.rug) {
  const g = new THREE.Group();
  const geo = metricUV(new RoundedBoxGeometry(w, 0.012, d, 2, 0.005));
  if (material === M.rugMaze) {
    // maze rug uses a single image stretched to the rug
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getZ(i) / d + 0.5);
  }
  const m = part(g, geo, material, 0, 0.006, 0);
  m.castShadow = false;
  return g;
}

/** Framed artwork; faces +z, centred at its middle. */
export function artwork(w, h, material = M.art1) {
  const g = new THREE.Group();
  part(g, rbox(w + 0.04, h + 0.04, 0.04, 0.004, 1), M.metalBlack, 0, 0, 0);
  const plane = new THREE.PlaneGeometry(w, h);
  part(g, plane, material, 0, 0, 0.021);
  return g;
}

export function bench(len = 1.8) {
  const g = new THREE.Group();
  part(g, rbox(len, 0.1, 0.45, 0.03, 3), M.leatherBlack, 0, 0.42, 0);
  for (const sx of [-1, 1]) part(g, rbox(0.03, 0.37, 0.4, 0.005, 1), M.metalBlack, sx * (len / 2 - 0.12), 0.185, 0);
  return g;
}

export function bowl(r = 0.2, material = M.walnutDark) {
  const g = new THREE.Group();
  part(g, lathe([[0, 0], [r * 0.5, 0], [r, r * 0.45], [r * 0.95, r * 0.47], [r * 0.45, 0.02], [0, 0.02]], 32), material);
  return g;
}

export function bookStack(n = 3, w = 0.3, d = 0.22) {
  const g = new THREE.Group();
  const cols = [0xe8e2d6, 0x3b3b3b, 0xc9b79c, 0xf3f1ec];
  let y = 0;
  for (let i = 0; i < n; i++) {
    const h = 0.025 + (i % 2) * 0.01;
    const m = new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.8 });
    part(g, rbox(w - i * 0.02, h, d - i * 0.015, 0.004, 1), m, 0, y + h / 2, 0, 0, (i - 1) * 0.08, 0);
    y += h;
  }
  return g;
}
