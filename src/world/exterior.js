import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { M } from './materials.js';
import { StaticBatch } from './geom.js';
import { metricUV } from './furniture.js';
import { makeTree, makeBoxwood } from './trees.js';
import { buildPoolArea } from './pool.js';

// Plan shapes are drawn in (x, z). ShapeGeometry lives in XY, so map z -> -y and rotate -90° about X.
function flat(shape, y, material, uvScale = 1) {
  const g = new THREE.ShapeGeometry(shape, 64);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale);
  const m = new THREE.Mesh(g, material);
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}
const rectColliders = (colliders, x0, z0, x1, z1, y0, y1) => {
  colliders.push(
    { ax: x0, az: z0, bx: x1, bz: z0, y0, y1, r: 0.05 },
    { ax: x1, az: z0, bx: x1, bz: z1, y0, y1, r: 0.05 },
    { ax: x1, az: z1, bx: x0, bz: z1, y0, y1, r: 0.05 },
    { ax: x0, az: z1, bx: x0, bz: z0, y0, y1, r: 0.05 },
  );
};

/** Grid of stone slabs with grass joints (slabs sit 6 mm proud of the lawn). */
function slabs(B, x0, z0, x1, z1, sw, sd, gap = 0.04) {
  for (let x = x0; x < x1 - 0.01; x += sw) {
    for (let z = z0; z < z1 - 0.01; z += sd) {
      B.box(x + gap / 2, -0.06, z + gap / 2, Math.min(x + sw, x1) - gap / 2, 0.006, Math.min(z + sd, z1) - gap / 2,
        { py: M.paver, px: M.paver, nx: M.paver, pz: M.paver, nz: M.paver });
    }
  }
}

export function buildExterior(house, colliders, { quality = 'high' } = {}) {
  const ex = house.exterior;
  const group = new THREE.Group();
  group.name = 'exterior';
  const B = new StaticBatch();
  const [sx0, sz0, sx1, sz1] = ex.site;

  // ---- pool, spa, travertine decks and stepping pads (see pool.js) ----
  const pool = buildPoolArea(group, ex, colliders);

  // ---- lawn (grass texture in metres, mowing stripes in the shader) with a hole for the pool deck ----
  const lawn = new THREE.Shape();
  const far = 140;
  lawn.moveTo(sx0 - far, -(sz0 - far));
  lawn.lineTo(sx1 + far, -(sz0 - far));
  lawn.lineTo(sx1 + far, -(sz1 + far));
  lawn.lineTo(sx0 - far, -(sz1 + far));
  lawn.closePath();
  lawn.holes.push(pool.lawnHole);
  group.add(flat(lawn, -0.005, M.grass));

  // ---- terrace slabs along the rear facade, entry walk ----
  const [tx0, tz0, tx1, tz1] = ex.terrace;
  slabs(B, tx0, tz0, tx1, tz1, 1.2, 1.2, 0.012);
  const [wx0, wz0, wx1, wz1] = ex.entryWalk;
  // entry walk: big pavers with grass joints every 1.4 m (as in the opening shot)
  for (let z = wz0; z < wz1; z += 1.45) {
    B.box(wx0, -0.06, z + 0.05, wx1, 0.008, Math.min(z + 1.4, wz1), { py: M.paver, px: M.paver, nx: M.paver, pz: M.paver, nz: M.paver });
  }

  // ---- clipped hedges ----
  const hedgeBox = (x0, z0, x1, z1, h) => {
    const g = metricUV(new RoundedBoxGeometry(x1 - x0, h, z1 - z0, 3, 0.18));
    const m = new THREE.Mesh(g, M.hedge);
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    rectColliders(colliders, x0, z0, x1, z1, 0, h);
  };
  const H = 3.2, T = 1.1;
  hedgeBox(sx0, sz0, sx1, sz0 + T, H);
  hedgeBox(sx0, sz0 + T, sx0 + T, sz1, H);
  hedgeBox(sx1 - T, sz0 + T, sx1, sz1, H);
  hedgeBox(sx0 + T, sz1 - T, wx0 - 1.6, sz1, H);
  hedgeBox(wx1 + 1.6, sz1 - T, sx1 - T, sz1, H);
  colliders.push({ ax: wx0 - 1.6, az: sz1, bx: wx1 + 1.6, bz: sz1, y0: -1, y1: 3, r: 0.1 });

  // low boxwood balls lining the entry walk
  const ball = makeBoxwood(3, 0.38);
  for (let z = wz0 + 1.2; z < wz1 - 0.4; z += 0.85) {
    for (const x of [wx0 - 0.45, wx1 + 0.45]) {
      const b = ball.clone();
      b.position.set(x, 0, z);
      const s = 0.85 + ((z * 7.3) % 1) * 0.3;
      b.scale.set(s, s, s);
      group.add(b);
    }
  }
  rectColliders(colliders, wx0 - 0.9, wz0 + 0.8, wx0 - 0.05, wz1, 0, 0.7);
  rectColliders(colliders, wx1 + 0.05, wz0 + 0.8, wx1 + 0.9, wz1, 0, 0.7);
  // lawn strips beside the walk
  // (the lawn plane already covers them)

  // ---- entry: glass bridge overhead + stone-clad column ----
  const [bx0, bz0, bx1, bz1, by0, by1] = ex.entryBridge;
  B.box(bx0, by0, bz0, bx1, by1, bz1, { py: M.roof, ny: M.walnut, px: M.wallExt, nx: M.wallExt, pz: M.wallExt, nz: M.wallExt });
  B.box(bx0, by1, bz0, bx1, by1 + 1.05, bz0 + 0.02, M.glass);
  B.box(bx0, by1, bz1 - 0.02, bx1, by1 + 1.05, bz1, M.glass);
  B.box(bx0 - 1.0, 0, bz0 + 0.4, bx0 - 0.2, by1 + 3.2, bz0 + 1.2, M.stoneClad);
  rectColliders(colliders, bx0 - 1.0, bz0 + 0.4, bx0 - 0.2, bz0 + 1.2, 0, 6);

  // garage volume
  const [gx0, gz0, gx1, gz1, gh] = ex.garage;
  B.box(gx0, 0, gz0, gx1, gh, gz1, { py: M.roof, px: M.wallExt, nx: M.wallExt, pz: M.wallExt, nz: M.wallExt });
  // glazed west face towards the entry walk (black mullions), stone plinth, wood soffit band
  B.box(gx0 - 0.03, 0.35, gz0 + 0.4, gx0 - 0.005, gh - 0.4, gz1 - 0.4, M.glass);
  for (let z = gz0 + 0.4; z <= gz1 - 0.39; z += (gz1 - gz0 - 0.8) / 4) B.box(gx0 - 0.06, 0.35, z - 0.03, gx0, gh - 0.4, z + 0.03, M.frame);
  B.box(gx0 - 0.06, 0.32, gz0 + 0.4, gx0, 0.38, gz1 - 0.4, M.frame);
  B.box(gx0 - 0.06, gh - 0.43, gz0 + 0.4, gx0, gh - 0.37, gz1 - 0.4, M.frame);
  B.box(gx0 + 0.02, 0.36, gz0 + 0.45, gx0 + 0.04, gh - 0.42, gz1 - 0.45, M.walnutPanel);
  B.box(gx0 - 0.08, 0, gz0, gx0, 0.35, gz1, M.stoneClad);
  rectColliders(colliders, gx0, gz0, gx1, gz1, 0, gh);

  // upper-terrace pergola (black louvers)
  const pg = ex.pergola;
  const [px0, pz0, px1, pz1] = pg.rect;
  for (let x = px0 + pg.spacing / 2; x < px1; x += pg.spacing) B.box(x - 0.05, pg.y, pz0, x + 0.05, pg.y + 0.28, pz1, M.frame);
  B.box(px0, pg.y + 0.28, pz0 - 0.15, px1 + 0.15, pg.y + 0.5, pz0 + 0.15, M.frame);
  B.box(px1 - 0.15, pg.y + 0.28, pz0, px1 + 0.15, pg.y + 0.5, pz1, M.frame);
  // warm LED strip under the main pergola beams (seen in the footage)
  B.box(px0, pg.y + 0.26, pz0 + 0.12, px1, pg.y + 0.28, pz0 + 0.16, { ny: M.led });
  B.box(px1 - 0.03, pg.y + 0.26, pz0, px1 + 0.01, pg.y + 0.28, pz1, { ny: M.led });
  for (const z of [pz0 + 0.15, pz1 - 0.15]) B.box(px1 - 0.25, 3.8, z - 0.1, px1 - 0.05, pg.y + 0.3, z + 0.1, M.frame);

  B.build(group);

  // ---- trees: garden specimens + a dense distant tree line (like the video backdrop) ----
  const variants = [makeTree(1, 14, { variant: 0 }), makeTree(2, 11, { variant: 1, spread: 0.6 }), makeTree(3, 16, { variant: 2, spread: 0.35 })];
  const plant = (x, z, v, s = 1, ry = 0) => {
    const t = variants[v % 3].clone();
    t.position.set(x, 0, z);
    t.scale.setScalar(s);
    t.rotation.y = ry;
    group.add(t);
  };
  const garden = [[-1.5, -26, 0, 1.0], [6, -30, 1, 0.9], [39, -27, 2, 1.0], [40, -9, 1, 0.8], [-2.5, 24, 0, 0.8], [40, 31, 2, 0.75], [34, -31, 0, 0.9]];
  for (const [x, z, v, s] of garden) {
    plant(x, z, v, s, x * 0.37);
    colliders.push({ ax: x - 0.01, az: z, bx: x + 0.01, bz: z, y0: 0, y1: 3, r: 0.45 * s });
  }
  const ring = quality === 'high' ? 46 : 26;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2;
    const rad = 62 + ((i * 37) % 23);
    plant(19 + Math.cos(a) * rad * 1.1, 0 + Math.sin(a) * rad, i, 0.9 + ((i * 13) % 7) / 10, i);
  }

  return { group, update: pool.update };
}
