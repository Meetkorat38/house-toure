import * as THREE from 'three';

const TAP_MOVE = 8;     // px a pointer may travel and still count as a tap/click
const TAP_TIME = 450;   // ms

/**
 * Input for a real-estate walkthrough (not a game):
 *  - drag anywhere to look ("grab the view"), with momentum after release
 *  - click / tap the floor to walk there (emits 'tap'); mouse hover emits 'hover' for the target ring
 *  - WASD / arrows / Q-E on desktop; a visible thumb joystick on touch devices
 *  - optional game mode (pointer lock, FPS-style mouse look) and gyroscope look on phones
 */
export class Input {
  constructor(dom, { joystickEl, knobEl, isTouch }) {
    this.dom = dom;
    this.joystickEl = joystickEl;
    this.knobEl = knobEl;
    this.isTouch = isTouch;
    this.enabled = false;
    this.keys = new Set();
    this.look = { x: 0, y: 0 };     // radians to add to yaw / pitch this frame
    this.lookVel = { x: 0, y: 0 };  // momentum after a drag
    this.joy = { x: 0, y: 0 };
    this.joyId = null;
    this.drag = null;               // { id, x, y, t, startX, startY, moved, lastT }
    this.gameMode = false;
    this.lockBlocked = false;       // browser refused pointer lock (e.g. embedded views): use drag instead
    this.pad = { f: 0, b: 0, l: 0, r: 0 }; // on-screen arrow buttons
    this.listeners = { tap: [], hover: [], manual: [], gameMode: [] };
    this.gyro = null;               // { yaw, pitch } absolute device orientation when enabled

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.closest?.('select, input, button')) return;
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      // walking keys take over from a glide / tour; turning keys don't
      if (/^(KeyW|KeyA|KeyS|KeyD|ArrowUp|ArrowDown)$/.test(e.code)) this.emit('manual');
      if (e.code === 'KeyG') this.setGameMode(!this.gameMode);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (this.enabled && this.gameMode && document.pointerLockElement === dom) {
        // FPS-style in game mode
        this.look.x -= e.movementX * 0.0022;
        this.look.y -= e.movementY * 0.0022;
      }
    });
    // Esc releases the mouse but game mode stays on; the next click captures it again
    document.addEventListener('pointerlockchange', () => this.emit('gameMode', this.gameMode));
    document.addEventListener('pointerlockerror', () => { this.lockBlocked = true; this.emit('gameMode', this.gameMode); });

    dom.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e, true));
    dom.addEventListener('pointerleave', () => this.emit('hover', null));

    joystickEl.addEventListener('pointerdown', (e) => this.onJoyDown(e));
  }

  on(name, fn) { this.listeners[name].push(fn); }
  emit(name, ...a) { for (const fn of this.listeners[name]) fn(...a); }
  isMoveKey(c) { return /^(Key[WASDQE]|Arrow)/.test(c); }

  get locked() { return document.pointerLockElement === this.dom; }

  /** Game mode: FPS mouse-look + keys/arrow buttons. Works without pointer lock too (drag to look). */
  setGameMode(on) {
    if (this.isTouch) return;
    this.gameMode = on;
    if (on) this.tryLock();
    else if (this.locked) document.exitPointerLock();
    this.emit('gameMode', this.gameMode);
  }

  tryLock() {
    if (this.lockBlocked || this.locked || !this.dom.requestPointerLock) return;
    try {
      const p = this.dom.requestPointerLock();
      p?.catch?.(() => { this.lockBlocked = true; this.emit('gameMode', this.gameMode); });
    } catch { this.lockBlocked = true; }
  }

  /** On-screen arrow buttons: dir = 'f' | 'b' | 'l' | 'r'. */
  setPad(dir, on) {
    this.pad[dir] = on ? 1 : 0;
    if (on && (dir === 'f' || dir === 'b')) this.emit('manual');
  }

  // ---------- drag-to-look + tap ----------
  onDown(e) {
    if (!this.enabled) return;
    if (this.gameMode && e.pointerType === 'mouse') {
      if (this.locked) return;          // mouse already captured: movement drives the view
      this.tryLock();                   // capture on click; if the browser refuses, fall through to drag
    }
    if (this.drag) return;
    e.preventDefault();
    try { this.dom.setPointerCapture?.(e.pointerId); } catch { /* pointer already gone */ }
    const now = performance.now();
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, t: now, lastT: now, moved: 0 };
    this.lookVel.x = this.lookVel.y = 0;
    this.dom.classList.add('dragging');
  }

  onMove(e) {
    if (this.joyId !== null && e.pointerId === this.joyId) { this.onJoyMove(e); return; }
    if (this.drag && e.pointerId === this.drag.id) {
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.moved = Math.max(this.drag.moved, Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY));
      // tour mode: grab-the-view (drag left turns right). Game mode: FPS-style (drag right turns right).
      const k = (this.isTouch ? 2.3 : 1.9) / Math.max(320, window.innerWidth) * (this.gameMode && !this.isTouch ? -1.25 : 1);
      const lx = dx * k, ly = dy * k;
      this.look.x += lx;
      this.look.y += ly;
      const now = performance.now(), dt = Math.max(1, now - this.drag.lastT);
      this.lookVel.x = (lx / dt) * 16; this.lookVel.y = (ly / dt) * 16;
      this.drag.x = e.clientX; this.drag.y = e.clientY; this.drag.lastT = now;
      return;
    }
    if (!this.drag && !this.isTouch && e.pointerType === 'mouse' && this.enabled && !this.locked && e.target === this.dom) {
      this.emit('hover', { x: e.clientX, y: e.clientY });
    }
  }

  onUp(e, cancelled = false) {
    if (this.joyId !== null && e.pointerId === this.joyId) { this.onJoyUp(); return; }
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const d = this.drag;
    this.drag = null;
    this.dom.classList.remove('dragging');
    const quick = performance.now() - d.t < TAP_TIME;
    if (!cancelled && d.moved < TAP_MOVE && quick) {
      this.lookVel.x = this.lookVel.y = 0;
      this.emit('tap', { x: e.clientX, y: e.clientY });
    } else if (performance.now() - d.lastT > 80) {
      this.lookVel.x = this.lookVel.y = 0; // held still before releasing: no fling
    }
  }

  // ---------- thumb joystick (touch) ----------
  onJoyDown(e) {
    if (!this.enabled || this.joyId !== null) return;
    e.preventDefault();
    e.stopPropagation();
    this.joyId = e.pointerId;
    try { this.joystickEl.setPointerCapture?.(e.pointerId); } catch { /* pointer already gone */ }
    const r = this.joystickEl.getBoundingClientRect();
    this.joyCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width * 0.36 };
    this.joystickEl.classList.add('active');
    this.onJoyMove(e);
    this.emit('manual');
  }
  onJoyMove(e) {
    const c = this.joyCenter;
    let dx = e.clientX - c.x, dy = e.clientY - c.y;
    const d = Math.hypot(dx, dy);
    if (d > c.R) { dx = (dx / d) * c.R; dy = (dy / d) * c.R; }
    this.joy.x = dx / c.R;
    this.joy.y = -dy / c.R;
    this.knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  onJoyUp() {
    this.joyId = null;
    this.joy.x = this.joy.y = 0;
    this.knobEl.style.transform = 'translate(-50%, -50%)';
    this.joystickEl.classList.remove('active');
  }

  // ---------- gyroscope look (phones) ----------
  async enableGyro() {
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return false;
    if (typeof DOE.requestPermission === 'function') {
      try { if ((await DOE.requestPermission()) !== 'granted') return false; } catch { return false; }
    }
    const zee = new THREE.Vector3(0, 0, 1), euler = new THREE.Euler(), q = new THREE.Quaternion();
    const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    const e2 = new THREE.Euler();
    this.onOrient = (ev) => {
      if (ev.alpha == null) return;
      const d = THREE.MathUtils.degToRad;
      const orient = d(screen.orientation?.angle ?? window.orientation ?? 0);
      euler.set(d(ev.beta), d(ev.alpha), -d(ev.gamma), 'YXZ');
      q.setFromEuler(euler).multiply(q1).multiply(q0.setFromAxisAngle(zee, -orient));
      e2.setFromQuaternion(q, 'YXZ');
      this.gyro = { yaw: e2.y, pitch: e2.x };
    };
    window.addEventListener('deviceorientation', this.onOrient);
    return true;
  }
  disableGyro() {
    if (this.onOrient) window.removeEventListener('deviceorientation', this.onOrient);
    this.onOrient = null;
    this.gyro = null;
  }

  // ---------- per-frame reads ----------
  consumeLook(dt) {
    const out = { x: this.look.x, y: this.look.y };
    this.look.x = this.look.y = 0;
    if (!this.drag) {
      // momentum glide after a flick, decaying quickly
      out.x += this.lookVel.x * dt * 60 * 0.5;
      out.y += this.lookVel.y * dt * 60 * 0.5;
      const k = Math.exp(-dt * 7);
      this.lookVel.x *= k; this.lookVel.y *= k;
      if (Math.abs(this.lookVel.x) < 1e-5) this.lookVel.x = 0;
      if (Math.abs(this.lookVel.y) < 1e-5) this.lookVel.y = 0;
    }
    return out;
  }

  /** x = strafe right, y = forward, turn = keyboard turn (-1..1). */
  moveVector() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD')) x += 1;
    if (k.has('KeyA')) x -= 1;
    x += this.joy.x;
    y += this.joy.y + this.pad.f - this.pad.b;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    let turn = 0;
    if (k.has('ArrowLeft') || k.has('KeyQ')) turn += 1;
    if (k.has('ArrowRight') || k.has('KeyE')) turn -= 1;
    turn += this.pad.l - this.pad.r;
    return { x, y, turn };
  }

  get manualActive() {
    const m = this.moveVector();
    return m.x !== 0 || m.y !== 0 || m.turn !== 0;
  }
  get running() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || Math.hypot(this.joy.x, this.joy.y) > 0.95;
  }

  reset() {
    this.keys.clear();
    this.joy.x = this.joy.y = 0;
    this.look.x = this.look.y = 0;
    this.lookVel.x = this.lookVel.y = 0;
    this.pad.f = this.pad.b = this.pad.l = this.pad.r = 0;
    this.drag = null;
  }
}
