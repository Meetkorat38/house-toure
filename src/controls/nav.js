/**
 * Walkable-area grid for the ground floor, built from the same colliders the player collides with.
 * Used for click/tap-to-walk and the guided tour: A* on an 8-connected grid + line-of-sight smoothing.
 */
export class NavGrid {
  constructor(colliders, { x0 = -6, z0 = -34, x1 = 44, z1 = 36, cell = 0.2, clearance = 0.36, floorY = 0, walkable = null } = {}) {
    this.floorY = floorY;
    this.x0 = x0; this.z0 = z0; this.cell = cell;
    this.w = Math.ceil((x1 - x0) / cell);
    this.h = Math.ceil((z1 - z0) / cell);
    const n = this.w * this.h;
    this.blocked = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.from = new Int32Array(n);
    this.state = new Uint8Array(n); // 0 new, 1 open, 2 closed
    this.heap = new Int32Array(n);
    this.f = new Float32Array(n);
    this.rasterize(colliders, clearance);
    if (walkable) {
      for (let k = 0; k < n; k++) {
        if (this.blocked[k]) continue;
        const c = this.center(k);
        if (!walkable(c.x, c.z)) this.blocked[k] = 1;
      }
    }
  }

  rasterize(colliders, clearance) {
    const { cell, x0, z0, w, h } = this;
    const lo = this.floorY + 0.25, hi = this.floorY + 1.75;
    for (const s of colliders) {
      // only things that block a standing person on this floor
      if (s.y1 <= lo || s.y0 >= hi) continue;
      const pad = s.r + clearance;
      const ci0 = Math.max(0, Math.floor((Math.min(s.ax, s.bx) - pad - x0) / cell));
      const ci1 = Math.min(w - 1, Math.ceil((Math.max(s.ax, s.bx) + pad - x0) / cell));
      const cj0 = Math.max(0, Math.floor((Math.min(s.az, s.bz) - pad - z0) / cell));
      const cj1 = Math.min(h - 1, Math.ceil((Math.max(s.az, s.bz) + pad - z0) / cell));
      const ex = s.bx - s.ax, ez = s.bz - s.az;
      const len2 = ex * ex + ez * ez || 1e-9;
      for (let j = cj0; j <= cj1; j++) {
        const pz = z0 + (j + 0.5) * cell;
        for (let i = ci0; i <= ci1; i++) {
          const px = x0 + (i + 0.5) * cell;
          let t = ((px - s.ax) * ex + (pz - s.az) * ez) / len2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dx = px - (s.ax + ex * t), dz = pz - (s.az + ez * t);
          if (dx * dx + dz * dz < pad * pad) this.blocked[j * w + i] = 1;
        }
      }
    }
  }

  idx(x, z) {
    const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  }
  center(k) {
    return { x: this.x0 + ((k % this.w) + 0.5) * this.cell, z: this.z0 + (Math.floor(k / this.w) + 0.5) * this.cell };
  }
  isFree(x, z) {
    const k = this.idx(x, z);
    return k >= 0 && !this.blocked[k];
  }

  /** Nearest free cell centre to (x, z) within `maxR` metres (spiral search), or null. */
  nearestFree(x, z, maxR = 2.5) {
    if (this.isFree(x, z)) return { x, z };
    const ci = Math.floor((x - this.x0) / this.cell), cj = Math.floor((z - this.z0) / this.cell);
    const R = Math.ceil(maxR / this.cell);
    let best = null, bestD = Infinity;
    for (let r = 1; r <= R; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= this.w || j >= this.h || this.blocked[j * this.w + i]) continue;
          const d = di * di + dj * dj;
          if (d < bestD) { bestD = d; best = this.center(j * this.w + i); }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** True if the straight line a→b stays on free cells. */
  lineFree(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(d / (this.cell * 0.5)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      if (!this.isFree(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  /** A* path from (sx,sz) to (tx,tz). Returns smoothed waypoints [{x,z}, ...] (excluding start) or null. */
  findPath(sx, sz, tx, tz) {
    const start = this.nearestFree(sx, sz, 1.0), goal = this.nearestFree(tx, tz, 2.5);
    if (!start || !goal) return null;
    if (this.lineFree(start.x, start.z, goal.x, goal.z)) return [goal];
    const s = this.idx(start.x, start.z), g = this.idx(goal.x, goal.z);
    const { w, blocked, state, from } = this;
    const gs = this.g, fs = this.f, heap = this.heap;
    state.fill(0);
    let size = 0;
    const gx = g % w, gy = Math.floor(g / w);
    const H = (k) => {
      const dx = Math.abs((k % w) - gx), dy = Math.abs(Math.floor(k / w) - gy);
      return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy));
    };
    const push = (k) => {
      let i = size++;
      heap[i] = k;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (fs[heap[p]] <= fs[heap[i]]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      heap[0] = heap[--size];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < size && fs[heap[l]] < fs[heap[m]]) m = l;
        if (r < size && fs[heap[r]] < fs[heap[m]]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
      return top;
    };
    gs[s] = 0; fs[s] = H(s); state[s] = 1; from[s] = -1; push(s);
    const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false, iter = 0;
    while (size > 0 && iter++ < 200000) {
      const k = pop();
      if (state[k] === 2) continue;
      if (k === g) { found = true; break; }
      state[k] = 2;
      const ki = k % w, kj = Math.floor(k / w);
      for (const [di, dj, c] of nb) {
        const i = ki + di, j = kj + dj;
        if (i < 0 || j < 0 || i >= w || j >= this.h) continue;
        const n = j * w + i;
        if (blocked[n] || state[n] === 2) continue;
        // no corner cutting
        if (di && dj && (blocked[kj * w + i] || blocked[j * w + ki])) continue;
        const ng = gs[k] + c;
        if (state[n] === 1 && ng >= gs[n]) continue;
        gs[n] = ng; fs[n] = ng + H(n); from[n] = k; state[n] = 1;
        push(n);
      }
    }
    if (!found) return null;
    const raw = [];
    for (let k = g; k !== -1; k = from[k]) raw.push(this.center(k));
    raw.reverse();
    raw[raw.length - 1] = goal;
    // string-pull: skip to the farthest visible point
    const out = [];
    let cur = start, i = 0;
    while (i < raw.length - 1) {
      let j = raw.length - 1;
      while (j > i + 1 && !this.lineFree(cur.x, cur.z, raw[j].x, raw[j].z)) j--;
      out.push(raw[j]);
      cur = raw[j];
      i = j;
    }
    if (!out.length) out.push(goal);
    return out;
  }
}

/**
 * One NavGrid per floor, joined by the stair. Paths across floors are
 * [walk to stair foot] → [straight up the flight] → [walk on the other floor] (or the reverse);
 * the player's floor-following handles the heights.
 */
export class Navigator {
  constructor(world) {
    this.world = world;
    const stair = world.stairs[0];
    this.stair = stair;
    const inRect = (x, z, r, m = 0) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
    // ground: everywhere except the stair flight itself (so paths never climb by accident)
    const flight = stair && { x0: stair.minX - 0.1, x1: stair.maxX - 0.1, z0: stair.zA - 0.05, z1: stair.zB + 0.05 };
    this.grids = [new NavGrid(world.colliders, {
      floorY: 0,
      walkable: flight ? (x, z) => !inRect(x, z, flight) : null,
    })];
    if (world.upperEnabled) {
      const lvl = world.levels[1];
      const rooms = world.byLevel[1].filter((r) => r.kind !== 'void');
      this.grids[1] = new NavGrid(world.colliders, {
        x0: -1, z0: -1, x1: 31, z1: 16, floorY: lvl.floor,
        walkable: (x, z) => rooms.some((r) => inRect(x, z, r)),
      });
      // stair foot (ground) and head (upper landing)
      const dir = Math.sign(stair.tx - stair.fx), zc = (stair.zA + stair.zB) / 2;
      this.foot = { x: stair.fx - dir * 0.55, z: zc };
      this.head = { x: stair.tx + dir * 0.45, z: zc };
    }
  }

  grid(level) { return this.grids[level] || this.grids[0]; }
  nearestFree(x, z, level = 0, r = 2.5) { return this.grid(level).nearestFree(x, z, r); }

  /** from/to: { x, z, level } → waypoints [{x,z}] or null */
  findPath(from, to) {
    const a = from.level || 0, b = to.level || 0;
    if (a === b || !this.grids[1]) return this.grid(b).findPath(from.x, from.z, to.x, to.z);
    const [first, second, entry, exit] = a === 0
      ? [this.grids[0], this.grids[1], this.foot, this.head]
      : [this.grids[1], this.grids[0], this.head, this.foot];
    const p1 = first.findPath(from.x, from.z, entry.x, entry.z);
    const p2 = second.findPath(exit.x, exit.z, to.x, to.z);
    if (!p1 || !p2) return null;
    return [...p1, { ...entry }, { ...exit }, ...p2];
  }
}
