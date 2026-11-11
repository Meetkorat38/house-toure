import * as THREE from 'three';
import { M } from './materials.js';
import { rbox, cyl, part, lathe, arcShell, pillow, bookStack, bowl } from './furniture.js';

// Upper floor pieces modelled on the footage: primary suite, roof terrace, bath, closet.

/** Upholstered bed; headboard side at -z, foot at +z. */
export function bed(w = 2.0, len = 2.15) {
  const g = new THREE.Group();
  part(g, rbox(w + 0.16, 0.34, len + 0.12, 0.06, 4), M.fabricGrey, 0, 0.17, 0.02);
  part(g, rbox(w, 0.24, len - 0.05, 0.08, 4), M.whiteSolid, 0, 0.44, 0.02);
  part(g, rbox(w + 0.04, 0.06, len * 0.62, 0.03, 3), M.fabricDark, 0, 0.58, len * 0.18);
  part(g, rbox(w + 0.06, 0.05, 0.55, 0.025, 3), M.fabricGrey, 0, 0.62, len / 2 - 0.35);
  for (const x of [-0.48, 0.48]) part(g, rbox(0.72, 0.2, 0.42, 0.09, 4), M.whiteSolid, x, 0.66, -len / 2 + 0.35, -0.5, 0, 0);
  pillow(g, M.boucle, 0, 0.56, -len / 2 + 0.5, 0, 0.55, 0.36, -0.35);
  return g;
}

/** Wood-panelled feature wall behind the bed with two sconces; faces +z. */
export function bedWall(w = 4.6, h = 2.9) {
  const g = new THREE.Group();
  part(g, rbox(w, h, 0.06, 0.004, 1), M.woodGreyPanel, 0, h / 2, 0);
  for (let i = 1; i < 8; i++) part(g, new THREE.BoxGeometry(0.006, h - 0.02, 0.004), M.shadowGap, -w / 2 + (w * i) / 8, h / 2, 0.034);
  for (const sx of [-1.45, 1.45]) {
    part(g, cyl(0.05, 0.05, 0.03, 20), M.brass, sx, 1.45, 0.05, Math.PI / 2, 0, 0);
    part(g, cyl(0.06, 0.06, 0.22, 24), M.pendantGlass, sx, 1.45, 0.16, Math.PI / 2, 0, 0);
  }
  return g;
}

export function nightstand() {
  const g = new THREE.Group();
  part(g, rbox(0.55, 0.32, 0.42, 0.01, 2), M.walnutDark, 0, 0.5, 0);
  part(g, new THREE.BoxGeometry(0.5, 0.004, 0.02), M.shadowGap, 0, 0.5, 0.214);
  return g;
}

/** Long curved charcoal sofa (convex back towards -z). */
export function curvedSofa() {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  part(inner, arcShell(2.6, 0.95, 0.4, 52, 0.06), M.fabricDark, 0, 0.05, 0);
  part(inner, arcShell(2.6, 0.26, 0.42, 52, 0.06), M.fabricDark, 0, 0.42, 0);
  part(inner, arcShell(2.45, 0.12, 0.05, 48, 0.01), M.metalBlack, 0, 0, 0);
  inner.position.z = 2.15;
  g.add(inner);
  pillow(g, M.whiteSolid, -0.55, 0.42, -0.3, 0.2, 0.48, 0.42, -0.3);
  pillow(g, M.boucle, 0.6, 0.42, -0.3, -0.2, 0.5, 0.44, -0.3);
  return g;
}

/** Cluster of three black "mushroom" side tables. */
export function nestingTables() {
  const g = new THREE.Group();
  const t = (r, h, x, z) => part(g, lathe([[0, 0], [r * 0.45, 0], [r * 0.1, 0.03], [r * 0.08, h - 0.03], [r, h - 0.02], [r, h], [0, h]], 40), M.metalBlack, x, 0, z);
  t(0.3, 0.52, 0, 0);
  t(0.26, 0.45, 0.42, 0.3);
  t(0.22, 0.38, -0.2, 0.45);
  return g;
}

/** Ceiling drop-down TV (y = 0 is the ceiling slot); screen faces +z. */
export function dropTV(w = 1.9, h = 1.1) {
  const g = new THREE.Group();
  part(g, new THREE.BoxGeometry(w + 0.3, 0.02, 0.3), M.metalBlack, 0, -0.01, 0);
  part(g, rbox(w, h, 0.05, 0.01, 2), M.metalBlack, 0, -0.08 - h / 2, 0);
  part(g, new THREE.PlaneGeometry(w - 0.04, h - 0.04), M.screen, 0, -0.08 - h / 2, 0.026);
  return g;
}

/** Built-in walnut shelving niche with LED strips and a few objects; faces +z. */
export function builtInShelves(w = 1.8, h = 2.4) {
  const g = new THREE.Group();
  const d = 0.38;
  part(g, rbox(w, h, 0.03, 0.002, 1), M.walnutDark, 0, h / 2, -d / 2);
  for (const sx of [-1, 1]) part(g, rbox(0.04, h, d, 0.003, 1), M.walnutDark, sx * (w / 2 - 0.02), h / 2, 0);
  for (const y of [0.8, 1.45, 2.05, h - 0.03]) {
    part(g, rbox(w - 0.08, 0.035, d, 0.003, 1), M.walnutDark, 0, y + 0.0175, 0);
    if (y < h - 0.1) part(g, new THREE.BoxGeometry(w - 0.14, 0.008, 0.02), M.led, 0, y + 0.6, d / 2 - 0.05);
  }
  part(g, rbox(w, 0.78, d + 0.04, 0.004, 1), M.walnutDark, 0, 0.39, 0.02);
  const books = bookStack(4, 0.26, 0.2); books.position.set(-0.45, 0.835, 0); g.add(books);
  const b2 = bowl(0.14, M.white); b2.position.set(0.4, 1.485, 0); g.add(b2);
  const b3 = bookStack(3, 0.24, 0.18); b3.position.set(0.3, 2.085, 0); g.add(b3);
  return g;
}

/** Outdoor sofa run: teak frame, grey cushions, black/white striped pillows. Seat faces +z. */
export function outdoorSofa(len = 2.6, depth = 0.95, pillows = 2) {
  const g = new THREE.Group();
  part(g, rbox(len, 0.08, depth, 0.01, 2), M.teak, 0, 0.18, 0);
  for (const sx of [-1, 1]) part(g, rbox(0.08, 0.58, depth, 0.01, 2), M.teak, sx * (len / 2 - 0.04), 0.29, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, rbox(0.06, 0.18, 0.06, 0.01, 2), M.teak, sx * (len / 2 - 0.05), 0.09, sz * (depth / 2 - 0.05));
  part(g, rbox(len - 0.16, 0.18, depth - 0.1, 0.06, 4), M.outdoorFabric, 0, 0.31, 0.04);
  part(g, rbox(len - 0.16, 0.42, 0.18, 0.07, 4), M.outdoorFabric, 0, 0.58, -depth / 2 + 0.12, -0.12, 0, 0);
  for (let i = 0; i < pillows; i++) {
    const x = -len / 2 + 0.45 + (i * (len - 0.9)) / Math.max(1, pillows - 1);
    pillow(g, M.stripes, x, 0.4, -depth / 2 + 0.3, i % 2 ? 0.25 : -0.25, 0.48, 0.44, -0.35);
  }
  return g;
}

export function teakTable(w = 1.4, d = 0.85, h = 0.4) {
  const g = new THREE.Group();
  const n = 8;
  for (let i = 0; i < n; i++) part(g, rbox(w / n - 0.02, 0.035, d, 0.005, 1), M.teak, -w / 2 + (w * (i + 0.5)) / n, h - 0.0175, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, rbox(0.06, h - 0.035, 0.06, 0.008, 2), M.teak, sx * (w / 2 - 0.06), (h - 0.035) / 2, sz * (d / 2 - 0.06));
  return g;
}

export function planter(r = 0.32, h = 0.55) {
  const g = new THREE.Group();
  part(g, lathe([[0, 0], [r * 0.85, 0], [r, h * 0.9], [r * 0.96, h], [r * 0.85, h], [0, h * 0.9]], 32), M.whiteStone);
  return g;
}

/** Freestanding egg-shaped tub with a floor-mounted black filler; long axis along x. */
export function tub(len = 1.7, wid = 0.85) {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.26, 0.01], [0.36, 0.12], [0.4, 0.34], [0.41, 0.56], [0.395, 0.6], [0.36, 0.58], [0.355, 0.36], [0.3, 0.16], [0.2, 0.09], [0, 0.08]];
  const m = part(g, lathe(prof, 56), M.whiteSolid);
  m.scale.set(len / 0.82, 1, wid / 0.82);
  part(g, cyl(0.012, 0.012, 0.9, 10), M.metalBlack, len / 2 + 0.18, 0.45, 0);
  part(g, rbox(0.2, 0.025, 0.025, 0.01, 2), M.metalBlack, len / 2 + 0.09, 0.88, 0);
  return g;
}

/** Floating double vanity with a white marble top and two basins; faces +z. */
export function vanity(len = 2.6, d = 0.52) {
  const g = new THREE.Group();
  part(g, rbox(len, 0.42, d, 0.005, 1), M.walnut, 0, 0.55, 0);
  part(g, new THREE.BoxGeometry(len - 0.02, 0.006, 0.004), M.shadowGap, 0, 0.55, d / 2 + 0.004);
  part(g, rbox(len + 0.02, 0.05, d + 0.02, 0.01, 2), M.marbleWhite, 0, 0.785, 0);
  for (const x of [-len / 4, len / 4]) {
    part(g, rbox(0.5, 0.012, 0.32, 0.05, 3), M.whiteSolid, x, 0.807, 0.02);
    part(g, cyl(0.012, 0.012, 0.26, 10), M.metalBlack, x, 0.94, -d / 2 + 0.08);
    part(g, rbox(0.02, 0.02, 0.16, 0.008, 2), M.metalBlack, x, 1.06, -d / 2 + 0.15);
  }
  part(g, new THREE.BoxGeometry(len - 0.1, 0.01, 0.02), M.led, 0, 0.33, d / 2 - 0.08);
  return g;
}

/** Wall mirror with two vertical light bars; faces +z. */
export function mirrorWall(w = 2.6, h = 1.1) {
  const g = new THREE.Group();
  part(g, new THREE.BoxGeometry(w, h, 0.012), M.mirror, 0, 0, 0);
  for (const sx of [-1, 1]) part(g, cyl(0.016, 0.016, 0.9, 12), M.pendantGlass, sx * (w / 2 + 0.12), 0, 0.04);
  return g;
}

/** Frameless glass shower: front + side panel and a black header (corner at the local origin). */
export function shower(w = 1.8, d = 1.3, h = 2.1) {
  const g = new THREE.Group();
  // glass sits in a slim black floor channel (never coplanar with the floor → no flickering seam)
  const gh = h - 0.02;
  part(g, new THREE.BoxGeometry(w, gh, 0.012), M.glass, w / 2, 0.02 + gh / 2, d);
  part(g, new THREE.BoxGeometry(0.012, gh, d * 0.55), M.glass, w, 0.02 + gh / 2, d * 0.275);
  part(g, new THREE.BoxGeometry(w, 0.022, 0.03), M.metalBlack, w / 2, 0.011, d);
  part(g, new THREE.BoxGeometry(0.03, 0.022, d * 0.55), M.metalBlack, w, 0.011, d * 0.275);
  part(g, rbox(w, 0.03, 0.03, 0.005, 1), M.metalBlack, w / 2, h + 0.015, d);
  part(g, rbox(0.25, 0.012, 0.25, 0.005, 1), M.metalBlack, w / 2, 2.15, d / 2);
  return g;
}

/** Wardrobe wall: walnut carcass, bronze glass doors, lit interior with hanging clothes; faces +z. */
export function wardrobes(len = 5.6, h = 2.6, d = 0.6) {
  const g = new THREE.Group();
  part(g, rbox(len, h, 0.03, 0.002, 1), M.walnutDark, 0, h / 2, -d / 2);
  part(g, rbox(len, 0.04, d, 0.002, 1), M.walnutDark, 0, h - 0.02, 0);
  const n = Math.round(len / 0.95);
  for (let i = 0; i <= n; i++) part(g, rbox(0.03, h, d, 0.002, 1), M.walnutDark, -len / 2 + (len * i) / n, h / 2, 0);
  const cloth = [M.fabricGrey, M.whiteSolid, M.navy, M.fabricBeige];
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (len * (i + 0.5)) / n;
    part(g, new THREE.BoxGeometry(len / n - 0.04, 0.006, 0.02), M.led, x, h - 0.08, -d / 2 + 0.06);
    if (i % 2) {
      for (const y of [0.45, 1.0, 1.55]) part(g, rbox(len / n - 0.06, 0.025, d - 0.08, 0.003, 1), M.walnutDark, x, y, 0);
    } else {
      part(g, cyl(0.01, 0.01, len / n - 0.08, 8), M.chrome, x, 2.05, 0, 0, 0, Math.PI / 2);
      for (let k = 0; k < 6; k++) part(g, rbox(0.04, 0.85, 0.42, 0.015, 2), cloth[k % 4], x - 0.3 + k * 0.11, 1.6, 0);
    }
    part(g, new THREE.BoxGeometry(len / n - 0.05, h - 0.06, 0.008), M.bronzeGlass, x, h / 2, d / 2);
  }
  return g;
}

/** Closet island: grey cabinet base, lit glass display top. */
export function glassIsland(w = 1.7, d = 0.75, h = 0.95) {
  const g = new THREE.Group();
  part(g, rbox(w, h - 0.12, d, 0.004, 1), M.cabinetGrey, 0, (h - 0.12) / 2, 0);
  part(g, rbox(w - 0.04, 0.1, d - 0.04, 0.002, 1), M.blackGlass, 0, h - 0.07, 0);
  part(g, new THREE.BoxGeometry(w - 0.1, 0.008, d - 0.1), M.led, 0, h - 0.11, 0);
  part(g, rbox(w, 0.02, d, 0.003, 1), M.glassTable, 0, h - 0.01, 0);
  return g;
}

/** Thin vertical light-tube pendant hanging from y = 0. */
export function tubePendant(drop = 1.1, len = 0.6) {
  const g = new THREE.Group();
  part(g, cyl(0.002, 0.002, drop, 4), M.metalBlack, 0, -drop / 2, 0);
  part(g, cyl(0.02, 0.02, 0.03, 12), M.brass, 0, -drop - 0.015, 0);
  part(g, cyl(0.016, 0.016, len, 12), M.pendantGlass, 0, -drop - 0.03 - len / 2, 0);
  return g;
}
