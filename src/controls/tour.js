/**
 * Places (room picker) + guided tour following the reference video's route.
 * Each stop: where to stand, which way to look, and a one-line caption.
 */
export const STOPS = [
  { id: 'entry', name: 'Entry', x: 18, z: 25.5, yaw: 0, pitch: 0.06,
    caption: 'Travertine entry walk lined with clipped boxwood.' },
  { id: 'foyer', name: 'Foyer', x: 18.6, z: 14.6, yaw: Math.PI / 2 - 0.25, pitch: 0.18,
    caption: 'Double-height foyer with a skylight and gallery art wall.' },
  { id: 'great', name: 'Great room', x: 15.6, z: 8.4, yaw: 0.08, pitch: -0.04,
    caption: 'Great room opening to the garden through full-height sliding glass.' },
  { id: 'kitchen', name: 'Kitchen', x: 19.0, z: 6.6, yaw: -1.15, pitch: -0.02,
    caption: 'Grey marble waterfall island under a floating walnut ceiling.' },
  { id: 'media', name: 'Media lounge', x: 28.8, z: 7.5, yaw: -1.1, pitch: 0.04,
    caption: 'Media lounge: walnut slat ceiling, fluted glass and a cinema screen.' },
  { id: 'family', name: 'Family room', x: 8.2, z: 8.0, yaw: 0.68, pitch: 0.02,
    caption: 'Family room with an oak plank ceiling and pivot doors to the lawn.' },
  { id: 'terrace', name: 'Garden terrace', x: 17.8, z: -2.6, yaw: Math.PI - 0.35, pitch: 0.02,
    caption: 'Stone terrace stepping down to the lawn.' },
  { id: 'pool', name: 'Pool', x: 21.0, z: -27.6, yaw: Math.PI - 0.2, pitch: 0.06,
    caption: 'Pool and spa, with the rear facade behind.' },
  { id: 'stair', name: 'Floating stair', x: 29.3, z: 12.6, yaw: 1.1, pitch: 0.28,
    caption: 'Floating oak stair with a glass balustrade and a wood-grain stone wall.' },
  { id: 'landing', name: 'Upper landing', level: 1, x: 21.2, z: 10.0, yaw: Math.PI / 2, pitch: -0.12,
    caption: 'Glass-railed bridge over the double-height foyer.' },
  { id: 'bedroom', name: 'Primary bedroom', level: 1, x: 9.6, z: 7.9, yaw: 0.75, pitch: -0.05,
    caption: 'Primary suite: walnut ceiling, panelled bed wall and a view over the garden.' },
  { id: 'roof', name: 'Roof terrace', level: 1, x: 12.4, z: 7.6, yaw: -0.75, pitch: 0.02,
    caption: 'Covered roof terrace under a black louvred pergola.' },
  { id: 'bath', name: 'Primary bath', level: 1, x: 5.6, z: 13.3, yaw: 1.05, pitch: -0.1,
    caption: 'Marble bath with a freestanding tub and floor-to-ceiling glass.' },
  { id: 'closet', name: 'Walk-in closet', level: 1, x: 8.0, z: 11.9, yaw: -1.35, pitch: 0.05,
    caption: 'Walk-in closet with a glass-top island under a skylight.' },
];

export class Tour {
  constructor(player, nav, { onStop, onState }) {
    this.player = player;
    this.nav = nav;
    this.onStop = onStop;
    this.onState = onState;
    this.playing = false;
    this.index = -1;
    this.hold = 0;
  }

  /** Walk (glide) to a stop. `fast` is used for jumps from the room picker. */
  goTo(i, { fast = false } = {}) {
    const s = STOPS[(i + STOPS.length) % STOPS.length];
    this.index = STOPS.indexOf(s);
    const p = this.player;
    const level = s.level || 0;
    const path = this.nav.findPath({ x: p.pos.x, z: p.pos.y, level: p.level }, { x: s.x, z: s.z, level });
    const dist = path ? path.reduce((acc, w, k) => acc + Math.hypot(w.x - (k ? path[k - 1].x : p.pos.x), w.z - (k ? path[k - 1].z : p.pos.y)), 0) : Infinity;
    const arrive = () => {
      this.onStop?.(s, this.playing);
      if (this.playing) this.hold = 4.5;
    };
    if (!path) {
      p.teleport(s.x, s.z, this.nav.world.levels[level].floor, s.yaw, s.pitch);
      arrive();
      return s;
    }
    p.glide(path, { yaw: s.yaw, pitch: s.pitch, speedMax: fast || dist > 16 ? 3.0 : 1.9, onArrive: arrive });
    this.onStop?.(s, this.playing, true);
    return s;
  }

  play() {
    this.playing = true;
    this.onState?.(true);
    const start = this.index < 0 || this.index >= STOPS.length - 1 ? 0 : this.index + 1;
    this.goTo(start);
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    this.hold = 0;
    this.onState?.(false);
  }

  next() { this.goTo(this.currentIndex() + 1, { fast: true }); }
  prev() { this.goTo(this.currentIndex() - 1, { fast: true }); }

  /** Nearest stop to the viewer (used by next / prev when wandering freely). */
  currentIndex() {
    if (this.index >= 0 && this.player.auto) return this.index;
    let best = 0, bd = Infinity;
    STOPS.forEach((s, i) => {
      const d = Math.hypot(s.x - this.player.pos.x, s.z - this.player.pos.y) + ((s.level || 0) !== this.player.level ? 50 : 0);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  update(dt) {
    if (!this.playing || this.player.auto) return;
    if (this.hold > 0) {
      this.hold -= dt;
      if (this.hold <= 0) {
        if (this.index >= STOPS.length - 1) this.stop();
        else this.goTo(this.index + 1);
      }
    }
  }
}
