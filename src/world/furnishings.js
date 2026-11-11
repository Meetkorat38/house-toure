import * as THREE from 'three';
import { M } from './materials.js';
import * as F from './furniture.js';
import * as U from './furnitureUpper.js';
import { placeModel } from './models.js';

const Y = 3.8; // upper floor level

/** Upper floor layout (primary suite, roof terrace, bath, closet, landing). */
function upperLayout() {
  return [
    // ---------------- Primary bedroom (x 0..11, z 0..9) ----------------
    [() => F.rug(5.6, 4.8, M.rugMaze), [4.9, Y, 5.4], 0],
    [() => U.bedWall(4.6, 2.9), [4.9, Y, 8.86], P],
    [() => U.bed(2.0, 2.15), [4.9, Y, 7.66], P, true],
    [() => U.nightstand(), [3.32, Y, 8.6], P],
    [() => U.nightstand(), [6.48, Y, 8.6], P],
    [() => U.curvedSofa(), [4.9, Y, 5.85], P, true],
    [() => U.nestingTables(), [7.0, Y, 5.3], 0, true],
    [() => U.dropTV(1.9, 1.1), [4.9, 7.0, 1.5], 0],
    [() => U.builtInShelves(1.6, 2.5), [0.3, Y, 8.0], P / 2],
    [() => F.boucleChair(), [9.4, Y, 1.7], -P / 4, true],

    // ---------------- Roof terrace (x 11..20, z 0..9) ----------------
    [() => U.outdoorSofa(3.2, 0.95, 3), [15.3, Y, 1.0], 0, true],
    [() => U.outdoorSofa(2.6, 0.95, 2), [15.3, Y, 5.1], P, true],
    [() => U.outdoorSofa(2.0, 0.95, 2), [18.7, Y, 3.05], -P / 2, true],
    [() => U.teakTable(1.5, 0.9), [15.3, Y, 3.05], 0, true],
    [() => U.planter(0.34, 0.55), [12.0, Y, 0.75], 0, true],
    [() => U.planter(0.3, 0.5), [19.3, Y, 8.3], 0, true],

    // ---------------- Primary bath (x 0..7, z 9..14) ----------------
    [() => U.vanity(2.4, 0.52), [6.72, Y, 10.55], -P / 2, true],
    [() => U.mirrorWall(2.3, 1.0), [6.88, Y + 1.6, 10.55], -P / 2],
    [() => U.tub(1.7, 0.85), [2.55, Y, 12.75], 0, true],
    [() => U.shower(1.8, 1.3, 2.1), [2.9, Y, 9.08], 0, true],

    // ---------------- Walk-in closet (x 7..13, z 11..14) ----------------
    [() => U.wardrobes(5.6, 2.6, 0.6), [10.0, Y, 13.68], P, true],
    [() => U.glassIsland(1.7, 0.7), [10.2, Y, 12.3], 0, true],
    ...[9.6, 10.2, 10.8].map((x) => [() => U.tubePendant(1.1, 0.6), [x, 7.0, 12.3], 0]),

    // ---------------- Upper landing / bridge ----------------
    [() => F.artwork(1.1, 1.4, M.art3), [12.1, Y + 1.55, 10.88], P],
  ];
}

function upperDecor(group) {
  const white = { pot: 0xe8e5df };
  placeModel(group, 'potted_plant_02', { position: [10.3, Y, 8.3], height: 1.2, recolor: white });
  placeModel(group, 'potted_plant_02', { position: [12.0, Y + 0.55, 0.75], height: 0.9, rotationY: 1 });
  placeModel(group, 'potted_plant_04', { position: [19.3, Y + 0.5, 8.3], height: 0.45 });
  placeModel(group, 'potted_plant_04', { position: [15.3, Y + 0.4, 3.05] });
  placeModel(group, 'potted_plant_02', { position: [7.6, Y, 9.5], height: 1.1, recolor: white });
  placeModel(group, 'ceramic_vase_03', { position: [6.72, Y + 0.81, 11.55], height: 0.3 });
}

const P = Math.PI;

/**
 * Ground-floor furniture layout, room by room, positioned from the reference footage.
 * Each entry: [builder(), [x, y, z], rotationY, solid?]
 */
function layout() {
  return [
    // ---------------- Great room (x 9..20, z 0..9) ----------------
    [() => F.rug(6.4, 5.4), [14.3, 0, 4.4], 0],
    [() => F.sectionalL({ len: 5.4, ret: 3.4, style: 'channel', fabric: M.fabricGrey,
      pillows: [{ x: 1.4, z: -0.22 }, { x: 2.0, z: -0.2, mat: M.boucle }, { x: 3.9, z: -0.22, mat: M.leatherBlack }, { x: 4.5, z: -0.2 }] }),
    [11.3, 0, 2.25], 0, true],
    [() => F.travertineTable(), [14.2, 0, 4.15], 0, true],
    [() => F.boucleChair(), [13.2, 0, 6.5], P + 0.15, true],
    [() => F.boucleChair(), [15.5, 0, 6.5], P - 0.15, true],
    [() => F.pedestalSideTable(M.whiteStone, 0.24, 0.52), [14.35, 0, 6.85], 0, true],
    [() => F.blackTotem(), [10.55, 0, 5.9], 0.3, true],
    [() => F.bookStack(3), [14.0, 0.34, 3.95], 0.2],
    [() => F.bowl(0.18), [13.6, 0.34, 4.3], 0],
    [() => F.artwork(0.6, 0.8, M.art3), [19.2, 1.7, 1.99], 0],

    // ---------------- Kitchen & dining (x 20..28) ----------------
    [() => F.waterfallIsland(4.4, 1.15), [23.4, 0, 4.6], 0, true],
    ...[22.0, 22.95, 23.9, 24.85].map((x) => [() => F.barStool(), [x, 0, 5.62], P, true]),
    [() => F.cabinetWall(6.4, 2.9, 0.62), [24.2, 0, 8.58], P, true],
    [() => F.floatingPanel(5.4, 3.0, 0.38), [23.4, 3.4, 4.6], 0],
    ...[22.4, 23.4, 24.4].map((x) => [() => F.glassPendant(0.75, 0.55), [x, 2.92, 4.6], 0]),
    [() => F.diningTable(2.4, 1.0), [26.8, 0, 3.3], P / 2, true],
    ...[2.6, 3.4, 4.1].flatMap((z) => [
      [() => F.diningChair(), [26.05, 0, z], P / 2, true],
      [() => F.diningChair(), [27.55, 0, z], -P / 2, true],
    ]),
    [() => F.linearPendant(1.8, 1.25), [26.8, 3.4, 3.3], P / 2],
    [() => F.bowl(0.16, M.white), [26.8, 0.775, 3.0], 0],

    // ---------------- Media lounge (x 28..36) ----------------
    [() => F.platform(4.7, 5.6), [30.95, 0, 3.25], 0, false],
    [() => F.sectionalL({ len: 4.7, ret: 3.6, depth: 1.05, style: 'low', fabric: M.navy, backH: 0.7,
      pillows: [0.5, 1.2, 1.9, 2.6, 3.3, 4.0].map((x) => ({ x, z: -0.22, mat: M.navy, w: 0.52 })) }),
    [29.25, 0.13, 5.75], P / 2, true],
    [() => F.rug(3.2, 3.6), [31.6, 0.13, 3.1], 0],
    [() => F.glassCoffeeTable(), [31.5, 0.13, 3.0], P / 2, true],
    [() => F.drumOttoman(0.28), [32.75, 0.13, 1.6], 0, true],
    [() => F.drumOttoman(0.28), [32.75, 0.13, 4.3], 0, true],
    [() => F.barrelChair(), [34.0, 0, 1.0], -P / 2 - 0.5, true],
    [() => F.barrelChair(), [34.2, 0, 5.4], -P / 2 + 0.5, true],
    [() => F.screen(4.2, 2.36), [35.88, 1.75, 3.2], -P / 2],
    [() => F.barCounter(3.8), [32.6, 0, 8.6], P, true],
    ...[31.6, 32.6, 33.6].map((x) => [() => F.barStool(), [x, 0, 7.9], 0, true]),

    // ---------------- Family room (x 0..9) ----------------
    [() => F.rug(4.6, 4.2, M.rugMaze), [3.5, 0, 4.7], 0],
    [() => F.sectionalL({ len: 4.8, ret: 3.6, style: 'cushion', fabric: M.fabricBeige,
      pillows: [{ x: 0.9, z: -0.2, mat: M.boucle }, { x: 3.6, z: -0.2, mat: M.fabricGrey }] }),
    [1.35, 0, 7.4], P / 2, true],
    [() => F.roundCoffeeTable(0.62, 0.4), [3.9, 0, 4.5], 0, true],
    [() => F.boucleChair(), [6.4, 0, 2.6], -P / 4, true],
    [() => F.pedestalSideTable(M.metalBlack, 0.2, 0.55), [6.9, 0, 3.6], 0, true],
    [() => F.bowl(0.2, M.travertine), [3.9, 0.4, 4.5], 0],
    [() => F.artwork(1.8, 1.2, M.art2), [3.6, 1.55, 8.88], P],

    // ---------------- Gallery / foyer ----------------
    [() => F.artwork(2.2, 1.4, M.art2), [3.5, 1.55, 9.12], 0],
    [() => F.bench(1.6), [3.5, 0, 10.95], 0, true],
    [() => F.artwork(2.4, 3.4, M.art1), [14.12, 2.3, 14.0], P / 2],

    // ---------------- Pool deck ----------------
    ...[[26, -3], [28, -3], [30, -3]].map(([x, z]) => [() => F.lounger(), [x, 0, z], P, true]),
    // pool deck: a pair on the west side, a pair beyond the spa (as in the footage)
    ...[[16.4, -19.6], [17.3, -19.6]].map(([x, z]) => [() => F.lounger(), [x, 0, z], 0, true]),
    ...[[33.6, -21.6], [34.5, -21.4]].map(([x, z]) => [() => F.lounger(), [x, 0, z], 0.15, true]),
  ];
}

/** Potted plants & vases (async glTF). */
function decor(group) {
  const white = { pot: 0xe8e5df };
  placeModel(group, 'potted_plant_02', { position: [10.0, 0, 0.8], height: 1.3, recolor: white });
  placeModel(group, 'potted_plant_02', { position: [18.5, 0, 8.4], height: 1.1, rotationY: 1, recolor: white });
  placeModel(group, 'potted_plant_02', { position: [8.3, 0, 0.8], height: 1.2, rotationY: 2, recolor: white });
  placeModel(group, 'potted_plant_02', { position: [21.2, 0, 16.3], height: 1.4, recolor: white });
  placeModel(group, 'potted_plant_02', { position: [29.4, 0, 14.2], height: 1.2, recolor: white });
  placeModel(group, 'potted_plant_04', { position: [14.65, 0.34, 4.05] });
  placeModel(group, 'potted_plant_04', { position: [14.75, 0.24, 4.6], rotationY: 1 });
  placeModel(group, 'ceramic_vase_03', { position: [25.0, 0.92, 4.4], height: 0.38 });
  placeModel(group, 'ceramic_vase_01', { position: [25.3, 0.92, 4.75], height: 0.28 });
  placeModel(group, 'ceramic_vase_01', { position: [31.2, 0.55, 3.0], height: 0.25 });
  placeModel(group, 'potted_plant_04', { position: [24.9, 1.0, 8.4] });
}

export function buildFurnishings(colliders, { upper = false } = {}) {
  const group = new THREE.Group();
  group.name = 'furnishings';
  const box = new THREE.Box3();
  const items = upper ? [...layout(), ...upperLayout()] : layout();
  if (upper) upperDecor(group);
  for (const [make, pos, ry = 0, solid = false] of items) {
    const obj = make();
    obj.position.set(...pos);
    obj.rotation.y = ry;
    group.add(obj);
    if (!solid) continue;
    obj.updateMatrixWorld(true);
    for (const target of obj.userData.parts || [obj]) {
      box.setFromObject(target);
      const pad = 0.02;
      const x0 = box.min.x - pad, x1 = box.max.x + pad, z0 = box.min.z - pad, z1 = box.max.z + pad;
      const y0 = box.min.y, y1 = box.max.y;
      colliders.push(
        { ax: x0, az: z0, bx: x1, bz: z0, y0, y1, r: 0.02 },
        { ax: x1, az: z0, bx: x1, bz: z1, y0, y1, r: 0.02 },
        { ax: x1, az: z1, bx: x0, bz: z1, y0, y1, r: 0.02 },
        { ax: x0, az: z1, bx: x0, bz: z0, y0, y1, r: 0.02 },
      );
    }
  }
  decor(group);
  return group;
}
