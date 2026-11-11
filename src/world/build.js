import * as THREE from 'three';
import { M, mat } from './materials.js';
import { StaticBatch } from './geom.js';
import { buildCeilingFeatures } from './ceilings.js';

const EPS = 1e-3;
const WALL_T = 0.2;
const DOOR_HEAD = 2.7;
const RAIL_H = 1.08;

/**
 * Builds the house shell (walls, glazing, rails, floors, ceilings, roofs, stairs) from house.json.
 * Returns the scene group plus the spatial queries the player controller needs.
 */
export function buildHouse(house) {
  const group = new THREE.Group();
  group.name = 'house';
  const colliders = [];
  const levels = house.levels;
  const upperEnabled = house.settings?.upperFloor !== false;
  const B = new StaticBatch();

  const rooms = house.rooms.map((r) => ({ ...r, x0: r.rect[0], z0: r.rect[1], x1: r.rect[2], z1: r.rect[3] }));
  const byLevel = levels.map((l) => rooms.filter((r) => r.level === l.id));

  const addSegCollider = (axis, at, a, b, y0, y1, r) => {
    if (axis === 'z') colliders.push({ ax: a, az: at, bx: b, bz: at, y0, y1, r });
    else colliders.push({ ax: at, az: a, bx: at, bz: b, y0, y1, r });
  };

  const sideMat = (room) => {
    if (!room || room.kind === 'outdoor') return M.wallExt;
    return mat(room.wall || 'plaster');
  };

  // box aligned to a wall line: `a..b` runs along the line, `n0..n1` is the offset across it
  const lineBox = (seg, a, b, y0, y1, n0, n1, faces) => {
    if (seg.axis === 'z') B.box(a, y0, seg.at + n0, b, y1, seg.at + n1, faces);
    else B.box(seg.at + n0, y0, a, seg.at + n1, y1, b, faces);
  };

  // ---------- edges between rooms on each level ----------
  function roomAt(list, x, z) {
    return list.find((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) || null;
  }

  function levelEdges(list) {
    const lines = new Map();
    const push = (axis, at, a, b) => {
      const k = `${axis}:${at.toFixed(3)}`;
      if (!lines.has(k)) lines.set(k, { axis, at, ivs: [] });
      lines.get(k).ivs.push([a, b]);
    };
    for (const r of list) {
      push('z', r.z0, r.x0, r.x1); push('z', r.z1, r.x0, r.x1);
      push('x', r.x0, r.z0, r.z1); push('x', r.x1, r.z0, r.z1);
    }
    const segs = [];
    for (const L of lines.values()) {
      const pts = [...new Set(L.ivs.flat().map((v) => +v.toFixed(3)))].sort((a, b) => a - b);
      let cur = null;
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1], m = (p + q) / 2;
        if (!L.ivs.some(([a, b]) => m > a && m < b)) { cur = null; continue; }
        const [nx, nz, px, pz] = L.axis === 'z' ? [m, L.at - 0.05, m, L.at + 0.05] : [L.at - 0.05, m, L.at + 0.05, m];
        const neg = roomAt(list, nx, nz), pos = roomAt(list, px, pz);
        if (cur && cur.neg === neg && cur.pos === pos && Math.abs(cur.b - p) < EPS) cur.b = q;
        else { cur = { axis: L.axis, at: L.at, a: p, b: q, neg, pos }; segs.push(cur); }
      }
    }
    return segs;
  }

  function edgeKind(n, p) {
    const k = (r) => (r ? r.kind : 'none');
    const a = k(n), b = k(p);
    if (a === b && (a === 'void' || a === 'outdoor')) return null;
    const s = new Set([a, b]);
    if (s.has('void') && s.has('none')) return 'wall';
    if (s.has('void')) return 'rail';
    if (s.has('outdoor') && !s.has('indoor')) return 'rail';
    return 'wall';
  }

  // ---------- wall pieces ----------
  function wallPiece(seg, a, b, y0, y1, collide = true, extendEnds = false) {
    if (b - a < EPS || y1 - y0 < EPS) return;
    let aa = a, bb = b;
    // Close corners by stretching into the perpendicular wall — but stop 2 mm short so this piece's
    // end face stays hidden inside it (an end face flush with the other wall's surface z-fights and
    // reads as a flickering white seam), and never stretch where the wall simply continues in line.
    const ext = WALL_T / 2 - 0.002;
    if (extendEnds) {
      if (Math.abs(a - seg.a) < EPS && !seg.contA) aa -= ext;
      if (Math.abs(b - seg.b) < EPS && !seg.contB) bb += ext;
    }
    const negM = sideMat(seg.neg), posM = sideMat(seg.pos);
    // end/top faces take the wall's own finish, so the 2 mm corner notch is invisible
    const cap = !seg.neg || !seg.pos || seg.neg.kind === 'outdoor' || seg.pos.kind === 'outdoor' ? M.wallExt : M.plaster;
    const faces = seg.axis === 'z'
      ? { px: cap, nx: cap, py: cap, ny: cap, pz: posM, nz: negM }
      : { px: posM, nx: negM, py: cap, ny: cap, pz: cap, nz: cap };
    lineBox(seg, aa, bb, y0, y1, -WALL_T / 2, WALL_T / 2, faces);

    // recessed shadow-gap skirting on interior faces (dark 18 mm reveal at the floor)
    if (y0 === seg.levelFloor) {
      const gapH = 0.018, d = 0.006;
      for (const [room, sgn] of [[seg.neg, -1], [seg.pos, 1]]) {
        if (!room || room.kind !== 'indoor' || (room.wall && room.wall !== 'plaster')) continue;
        const n0 = sgn < 0 ? -WALL_T / 2 - d : WALL_T / 2;
        const n1 = sgn < 0 ? -WALL_T / 2 : WALL_T / 2 + d;
        lineBox(seg, a, b, y0, y0 + gapH, n0, n1, M.shadowGap);
      }
    }
    if (collide) addSegCollider(seg.axis, seg.at, a, b, y0, y1, WALL_T / 2);
  }

  function frameBar(seg, a, b, y0, y1, depth = 0.09) {
    lineBox(seg, a, b, y0, y1, -depth / 2, depth / 2, M.frame);
  }

  function glassPane(seg, a, b, y0, y1, material, t = 0.024, offset = 0) {
    lineBox(seg, a, b, y0, y1, offset - t / 2, offset + t / 2, material);
  }

  function glassPiece(seg, a, b, y0, y1, tint) {
    if (b - a < EPS || y1 - y0 < EPS) return;
    const gm = tint === 'reeded' ? M.glassReeded : tint === 'green' ? M.glassTint : M.glass;
    glassPane(seg, a, b, y0, y1, gm);
    // slim black steel frame: sill, head, mullions every ~2.4 m
    const fw = 0.045;
    frameBar(seg, a, b, y0, y0 + fw);
    frameBar(seg, a, b, y1 - fw, y1);
    const n = Math.max(1, Math.round((b - a) / 2.4));
    for (let i = 0; i <= n; i++) {
      const c = a + ((b - a) * i) / n;
      frameBar(seg, c - fw / 2, c + fw / 2, y0, y1, i === 0 || i === n ? 0.1 : 0.07);
    }
    addSegCollider(seg.axis, seg.at, a, b, y0, y1, 0.04);
    colliders[colliders.length - 1].glass = true; // see-through: ignored when picking a floor target
  }

  function railPiece(seg, a, b, y0) {
    if (b - a < EPS) return;
    glassPane(seg, a, b, y0 + 0.06, y0 + RAIL_H, M.glass, 0.02);
    lineBox(seg, a, b, y0 + RAIL_H, y0 + RAIL_H + 0.035, -0.025, 0.025, M.frame);
    lineBox(seg, a, b, y0, y0 + 0.06, -0.04, 0.04, M.frame);
    addSegCollider(seg.axis, seg.at, a, b, y0 - 0.5, y0 + RAIL_H + 0.1, 0.05);
    colliders[colliders.length - 1].glass = true;
  }

  function glassTop(seg, lvl) {
    const indoor = [seg.neg, seg.pos].filter((r) => r && r.kind === 'indoor');
    if (indoor.some((r) => r.doubleHeight)) return lvl.top;
    if (!indoor.length) return lvl.ceiling;
    return Math.min(...indoor.map((r) => r.ceilingHeight ?? lvl.ceiling));
  }

  for (const lvl of levels) {
    const list = byLevel[lvl.id];
    const ops = house.openings.filter((o) => o.level === lvl.id);
    const segs = levelEdges(list);
    // mark segment ends that continue straight into another wall segment on the same line
    const wallEnds = new Map();
    for (const s of segs) {
      if (edgeKind(s.neg, s.pos) !== 'wall') continue;
      for (const p of [s.a, s.b]) {
        const k = `${s.axis}:${s.at.toFixed(3)}:${p.toFixed(3)}`;
        wallEnds.set(k, (wallEnds.get(k) || 0) + 1);
      }
    }
    for (const s of segs) {
      const key = (p) => `${s.axis}:${s.at.toFixed(3)}:${p.toFixed(3)}`;
      s.contA = (wallEnds.get(key(s.a)) || 0) > 1;
      s.contB = (wallEnds.get(key(s.b)) || 0) > 1;
    }
    for (const seg of segs) {
      seg.levelFloor = lvl.floor;
      const kind = edgeKind(seg.neg, seg.pos);
      if (!kind) continue;
      const y0 = lvl.floor, y1 = lvl.top;
      const here = ops
        .filter((o) => o.axis === seg.axis && Math.abs(o.at - seg.at) < EPS)
        .map((o) => ({ a: Math.max(o.from, seg.a), b: Math.min(o.to, seg.b), o }))
        .filter((x) => x.b - x.a > EPS)
        .sort((p, q) => p.a - q.a);

      const solid = (a, b) => {
        if (kind === 'wall') wallPiece(seg, a, b, y0, y1, true, true);
        else railPiece(seg, a, b, y0);
      };

      let cursor = seg.a;
      for (const { a, b, o } of here) {
        solid(cursor, a);
        const gTop = glassTop(seg, lvl);
        switch (o.type) {
          case 'open':
            break;
          case 'door':
            if (kind === 'wall') wallPiece(seg, a, b, y0 + DOOR_HEAD, y1, false);
            break;
          case 'glass':
            glassPiece(seg, a, b, y0, gTop, o.tint);
            wallPiece(seg, a, b, gTop, y1, false);
            break;
          case 'slider': {
            // open doorway in a glazed wall: posts + the panel parked over the neighbouring glass
            wallPiece(seg, a, b, gTop, y1, false);
            const w = b - a, side = o.park === 'right' ? 1 : -1;
            const pa = side < 0 ? a - w + 0.05 : b - 0.05;
            const off = 0.07;
            glassPane(seg, pa, pa + w, y0, gTop, M.glass, 0.024, off);
            lineBox(seg, pa, pa + 0.05, y0, gTop, off - 0.03, off + 0.03, M.frame);
            lineBox(seg, pa + w - 0.05, pa + w, y0, gTop, off - 0.03, off + 0.03, M.frame);
            frameBar(seg, a - 0.03, a + 0.03, y0, gTop, 0.1);
            frameBar(seg, b - 0.03, b + 0.03, y0, gTop, 0.1);
            frameBar(seg, a, b, gTop - 0.05, gTop, 0.12);
            break;
          }
          case 'window': {
            const sill = y0 + (o.sill ?? 0.6);
            wallPiece(seg, a, b, y0, sill);
            glassPiece(seg, a, b, sill, gTop, o.tint);
            wallPiece(seg, a, b, gTop, y1, false);
            break;
          }
          case 'clerestory': {
            const sill = y0 + (o.sill ?? 2.4);
            wallPiece(seg, a, b, y0, sill);
            glassPiece(seg, a, b, sill, gTop, o.tint);
            wallPiece(seg, a, b, gTop, y1, false);
            break;
          }
          default:
            solid(a, b);
        }
        cursor = b;
      }
      solid(cursor, seg.b);
    }
  }

  // ---------- floors, ceilings, roofs ----------
  function slab(r, y0, y1, faces, hole) {
    if (!hole) { B.box(r.x0, y0, r.z0, r.x1, y1, r.z1, faces); return; }
    const [hx0, hz0, hx1, hz1] = hole;
    B.box(r.x0, y0, r.z0, r.x1, y1, hz0, faces);
    B.box(r.x0, y0, hz1, r.x1, y1, r.z1, faces);
    B.box(r.x0, y0, hz0, hx0, y1, hz1, faces);
    B.box(hx1, y0, hz0, r.x1, y1, hz1, faces);
    B.box(hx0, y0 + 0.25, hz0, hx1, y0 + 0.26, hz1, { ny: M.skylight });
    // light-well sides
    B.box(hx0, y0, hz0, hx1, y0 + 0.25, hz0 + 0.01, { pz: M.ceiling });
    B.box(hx0, y0, hz1 - 0.01, hx1, y0 + 0.25, hz1, { nz: M.ceiling });
    B.box(hx0, y0, hz0, hx0 + 0.01, y0 + 0.25, hz1, { px: M.ceiling });
    B.box(hx1 - 0.01, y0, hz0, hx1, y0 + 0.25, hz1, { nx: M.ceiling });
  }

  for (const r of rooms) {
    const lvl = levels[r.level];
    const floorM = mat(r.floor || 'oak');
    const ceilM = r.ceiling === 'slats' ? M.walnutDark : mat(r.ceiling || 'ceiling');
    const roofTop = lvl.top - 0.02;
    const sides = { px: M.soffit, nx: M.soffit, pz: M.soffit, nz: M.soffit };

    if (r.kind !== 'void') {
      if (r.level === 0) B.box(r.x0, -0.2, r.z0, r.x1, 0, r.z1, { ...sides, py: floorM });
      else B.box(r.x0, lvl.floor - 0.35, r.z0, r.x1, lvl.floor, r.z1, { ...sides, py: floorM, ny: M.soffit });
    }
    const needsCeiling = (r.kind === 'indoor' && !r.doubleHeight) || r.kind === 'void';
    if (needsCeiling) {
      const cy = r.ceilingHeight ?? lvl.ceiling;
      slab(r, cy, roofTop, { ...sides, py: M.roof, ny: ceilM }, r.skylight);
      if (r.level === 0 || upperEnabled) buildCeilingFeatures(B, r, cy, group);
    }
  }

  // ---------- columns (from house.json) ----------
  for (const c of house.columns || []) {
    const [x, z, w, d] = c.rect;
    const h = levels[c.level ?? 0].ceiling;
    B.box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, M.plaster);
    B.box(x - w / 2 - 0.006, 0, z - d / 2 - 0.006, x + w / 2 + 0.006, 0.018, z + d / 2 + 0.006, M.shadowGap);
    colliders.push(
      { ax: x - w / 2, az: z - d / 2, bx: x + w / 2, bz: z - d / 2, y0: 0, y1: h, r: 0.02 },
      { ax: x + w / 2, az: z - d / 2, bx: x + w / 2, bz: z + d / 2, y0: 0, y1: h, r: 0.02 },
      { ax: x + w / 2, az: z + d / 2, bx: x - w / 2, bz: z + d / 2, y0: 0, y1: h, r: 0.02 },
      { ax: x - w / 2, az: z + d / 2, bx: x - w / 2, bz: z - d / 2, y0: 0, y1: h, r: 0.02 },
    );
  }

  // ---------- stairs ----------
  const stairs = (house.stairs || []).map((s) => {
    const [fx, fz] = s.from, [tx] = s.to;
    const dir = Math.sign(tx - fx);
    const len = Math.abs(tx - fx);
    const treads = s.risers - 1;
    const run = len / treads;
    const rise = (s.y1 - s.y0) / s.risers;
    const zA = fz - s.width / 2, zB = fz + s.width / 2;
    for (let i = 0; i < treads; i++) {
      const top = s.y0 + (i + 1) * rise;
      const cx = fx + dir * (i + 0.5) * run;
      B.box(cx - run / 2 - 0.015, top - 0.075, zA + 0.02, cx + run / 2 + 0.015, top, zB, M.oak);
    }
    // sloped steel stringer + glass balustrade with black cap on the open side
    const angle = Math.atan2(s.y1 - s.y0, len) * dir;
    const L = Math.hypot(len, s.y1 - s.y0);
    const mid = new THREE.Vector3((fx + tx) / 2, (s.y0 + s.y1) / 2, zB + 0.02);
    const sloped = (h, d, yOff, zOff, material) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(L, h, d), material);
      m.position.copy(mid).add(new THREE.Vector3(0, yOff, zOff));
      m.rotation.z = angle;
      m.castShadow = !material.transparent && !material.userData.noShadow;
      m.receiveShadow = true;
      if (material.transparent) m.renderOrder = 2;
      group.add(m);
    };
    sloped(0.3, 0.025, -0.1, 0, M.frame);
    sloped(RAIL_H - 0.05, 0.02, RAIL_H / 2, 0.03, M.glass);
    sloped(0.035, 0.05, RAIL_H, 0.03, M.frame);
    const minX = Math.min(fx, tx), maxX = Math.max(fx, tx);
    colliders.push({ ax: minX, az: zB + 0.05, bx: maxX, bz: zB + 0.05, y0: s.y0 - 1, y1: s.y1 + RAIL_H + 0.2, r: 0.05 });
    colliders.push({ ax: tx, az: zA, bx: tx, bz: zB, y0: s.y0, y1: s.y1 - 0.4, r: 0.05 });
    if (!upperEnabled) {
      // upper floor closed for now: stop at the bottom step
      const bx = fx + dir * -0.25;
      colliders.push({ ax: bx, az: zA - 0.2, bx, bz: zB + 0.2, y0: s.y0, y1: s.y0 + 2.2, r: 0.05, stairGate: true });
    }
    return { ...s, minX, maxX, zA, zB, fx, tx, len };
  });

  B.build(group);

  // ---------- spatial queries ----------
  const walkableUpper = upperEnabled ? rooms.filter((r) => r.level > 0 && r.kind !== 'void') : [];

  function stairHeight(x, z) {
    if (!upperEnabled) return null;
    for (const s of stairs) {
      if (z > s.zA && z < s.zB && x >= s.minX - 0.05 && x <= s.maxX + 0.05) {
        const t = THREE.MathUtils.clamp(Math.abs(x - s.fx) / s.len, 0, 1);
        return s.y0 + t * (s.y1 - s.y0);
      }
    }
    return null;
  }

  function floorAt(x, z, feet, stepUp = 0.45) {
    let best = 0;
    const consider = (h) => { if (h <= feet + stepUp && h > best) best = h; };
    const sh = stairHeight(x, z);
    if (sh !== null) consider(sh);
    for (const r of walkableUpper) {
      if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) consider(levels[r.level].floor);
    }
    return best;
  }

  function roomNameAt(x, z, feet) {
    const lvl = feet > 2 ? 1 : 0;
    const r = roomAt(byLevel[lvl].filter((q) => q.kind !== 'void'), x, z);
    if (r) return r.name;
    if (stairHeight(x, z) !== null) return 'Stair Hall';
    return null;
  }

  return { group, colliders, rooms, byLevel, levels, floorAt, roomNameAt, stairs, upperEnabled };
}
