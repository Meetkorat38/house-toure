/** Room label, captions, first-time hint, stair note, and the minimap (tap a room to walk there). */
export class Hud {
  constructor(world, house, { onMapTap }) {
    this.world = world;
    this.house = house;
    this.onMapTap = onMapTap;
    this.labelEl = document.getElementById('room-label');
    this.floorEl = document.getElementById('floor-label');
    this.captionEl = document.getElementById('caption');
    this.toastEl = document.getElementById('toast');
    this.hintEl = document.getElementById('hint');
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.currentRoom = null;
    this.viewLevel = 0;
    this.bounds = { x0: -3, z0: -24, x1: 39, z1: 31 };
    this.dest = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('pointerdown', (e) => this.onTap(e));
  }

  resize() {
    const css = this.canvas.getBoundingClientRect();
    if (!css.width) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = Math.round(css.width * dpr);
    this.canvas.height = Math.round(css.height * dpr);
    const b = this.bounds;
    this.scale = Math.min(this.canvas.width / (b.x1 - b.x0), this.canvas.height / (b.z1 - b.z0));
    this.offX = (this.canvas.width - (b.x1 - b.x0) * this.scale) / 2;
    this.offY = (this.canvas.height - (b.z1 - b.z0) * this.scale) / 2;
  }
  toMap(x, z) { return [this.offX + (x - this.bounds.x0) * this.scale, this.offY + (z - this.bounds.z0) * this.scale]; }
  fromMap(px, py) { return [(px - this.offX) / this.scale + this.bounds.x0, (py - this.offY) / this.scale + this.bounds.z0]; }

  onTap(e) {
    e.stopPropagation();
    const r = this.canvas.getBoundingClientRect();
    const dpr = this.canvas.width / r.width;
    const [x, z] = this.fromMap((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
    this.onMapTap?.(x, z);
  }

  caption(stop, show = true) {
    if (!show || !stop) { this.captionEl.classList.remove('show'); return; }
    this.captionEl.innerHTML = `<b>${stop.name}</b>${stop.caption}`;
    this.captionEl.classList.add('show');
  }

  hint(html, ms = 4500) {
    this.hintEl.innerHTML = html;
    this.hintEl.classList.add('show');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.hintEl.classList.remove('show'), ms);
  }
  hideHint() { this.hintEl.classList.remove('show'); }

  update(dt, player) {
    const name = this.world.roomNameAt(player.pos.x, player.pos.y, player.feet)
      || (player.pos.y < 0 ? 'Garden' : 'Entry court');
    if (name !== this.currentRoom) {
      this.currentRoom = name;
      this.labelEl.textContent = name;
      this.labelEl.classList.remove('show');
      void this.labelEl.offsetWidth;
      this.labelEl.classList.add('show');
    }
    this.viewLevel = this.world.upperEnabled ? player.level : 0;
    this.floorEl.textContent = `${this.house.levels[this.viewLevel].name} floor`;
    if (!this.world.upperEnabled) {
      const s = this.world.stairs[0];
      const near = s && Math.hypot(player.pos.x - (s.fx + 0.6), player.pos.y - (s.zA + s.zB) / 2) < 1.6;
      this.toastEl.textContent = 'Upper floor — coming soon';
      this.toastEl.classList.toggle('show', near);
    }
    this.draw(player);
  }

  draw(player) {
    const { ctx, canvas } = this;
    if (!canvas.width) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = this.scale, ex = this.house.exterior;
    const ell = (cx, cz, rx, rz, fill) => {
      const [x, y] = this.toMap(cx, cz);
      ctx.beginPath(); ctx.ellipse(x, y, rx * s, rz * s, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
    };
    ell(ex.pool.center[0], ex.pool.center[1], ex.deck.r1, ex.deck.r1, 'rgba(255,255,255,0.12)');
    ell(ex.pool.center[0], ex.pool.center[1], ex.pool.r, ex.pool.r, 'rgba(80,190,210,0.75)');
    const [sx, sy] = this.toMap(ex.spa.center[0] - ex.spa.size[0] / 2, ex.spa.center[1] - ex.spa.size[1] / 2);
    ctx.fillStyle = 'rgba(80,190,210,0.75)';
    ctx.fillRect(sx, sy, ex.spa.size[0] * s, ex.spa.size[1] * s);

    const here = this.world.roomNameAt(player.pos.x, player.pos.y, player.feet);
    for (const r of this.world.byLevel[this.viewLevel]) {
      const [x0, y0] = this.toMap(r.x0, r.z0), [x1, y1] = this.toMap(r.x1, r.z1);
      if (r.kind === 'void') continue;
      ctx.fillStyle = r.name === here ? 'rgba(232,196,140,0.55)' : r.kind === 'outdoor' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    }
    // walking destination
    if (player.auto) {
      const a = player.auto, last = a.path[a.path.length - 1];
      const [dx, dy] = this.toMap(last.x, last.z);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(232,196,140,0.9)';
      ctx.beginPath();
      ctx.moveTo(...this.toMap(player.pos.x, player.pos.y));
      for (let k = a.i; k < a.path.length; k++) ctx.lineTo(...this.toMap(a.path[k].x, a.path[k].z));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI * 2); ctx.fillStyle = '#e8c48c'; ctx.fill();
    }
    const [px, py] = this.toMap(player.pos.x, player.pos.y);
    const ang = -player.yaw - Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, 9 * s, ang - 0.5, ang + 0.5); ctx.closePath();
    ctx.fillStyle = 'rgba(232,196,140,0.35)'; ctx.fill();
    ctx.beginPath(); ctx.arc(px, py, Math.max(3, 0.55 * s), 0, Math.PI * 2);
    ctx.fillStyle = '#e8c48c'; ctx.fill(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5; ctx.stroke();
  }
}
