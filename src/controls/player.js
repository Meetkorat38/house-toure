import * as THREE from 'three';

const EYE = 1.6;
const RADIUS = 0.3;
const BODY = 1.75;
const STEP = 0.45;
const WALK = 1.7, RUN = 3.2;      // m/s — a calm viewing pace, not a game sprint
const GLIDE = 1.9, GLIDE_ACC = 1.8;

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * First-person viewer tuned for property tours:
 *  - look direction eases towards its target (no jitter), with drag momentum from Input
 *  - keyboard / joystick movement accelerates and settles smoothly
 *  - autopilot glides along a path (click/tap-to-walk, guided tour) with ease-in/out and gentle turning
 *  - capsule-vs-segment collision with sliding; floor/stair following; gravity
 */
export class Player {
  constructor(camera, world, spawn) {
    this.camera = camera;
    this.world = world;
    this.pos = new THREE.Vector2(spawn.x, spawn.z);
    this.feet = 0;
    this.vy = 0;
    this.vel = new THREE.Vector2();
    this.yaw = this.targetYaw = spawn.yaw ?? 0;
    this.pitch = this.targetPitch = 0;
    this.eyeY = EYE;
    this.grounded = true;
    this.auto = null;
    this.gyroOffset = null;
    this.bob = 0;
    camera.rotation.order = 'YXZ';
    this.apply(1);
  }

  get level() { return this.feet > 2 ? 1 : 0; }
  get moving() { return this.vel.lengthSq() > 0.01 || !!this.auto; }

  teleport(x, z, feet = 0, yaw = this.yaw, pitch = 0) {
    this.pos.set(x, z);
    this.feet = feet;
    this.eyeY = feet + EYE;
    this.yaw = this.targetYaw = yaw;
    this.pitch = this.targetPitch = pitch;
    this.vel.set(0, 0);
    this.vy = 0;
    this.auto = null;
    this.apply(1);
  }

  /** Glide along waypoints [{x,z}...]. opts: { yaw (final heading), pitch, onArrive, turn (face travel dir) } */
  glide(path, opts = {}) {
    if (!path || !path.length) return false;
    this.auto = { path, i: 0, speed: Math.max(this.vel.length(), 0), stuck: 0, turn: opts.turn ?? true, ...opts };
    return true;
  }
  cancelGlide() { this.auto = null; }

  /** Look at a heading/pitch smoothly (used by the tour on arrival). */
  lookTo(yaw, pitch = this.targetPitch) {
    this.targetYaw = this.yaw + wrap(yaw - this.yaw);
    this.targetPitch = pitch;
  }

  remaining() {
    const a = this.auto;
    if (!a) return 0;
    let d = Math.hypot(a.path[a.i].x - this.pos.x, a.path[a.i].z - this.pos.y);
    for (let k = a.i; k < a.path.length - 1; k++) d += Math.hypot(a.path[k + 1].x - a.path[k].x, a.path[k + 1].z - a.path[k].z);
    return d;
  }

  update(dt, input, gyro = null) {
    // ---------- look ----------
    const look = input.consumeLook(dt);
    if (gyro) {
      // phone orientation drives the view; dragging nudges it
      if (this.gyroOffset === null) this.gyroOffset = { yaw: this.targetYaw - gyro.yaw, pitch: 0 };
      this.gyroOffset.yaw += look.x;
      this.targetYaw = this.yaw + wrap(gyro.yaw + this.gyroOffset.yaw - this.yaw);
      this.targetPitch = THREE.MathUtils.clamp(gyro.pitch, -1.2, 1.2);
    } else {
      this.gyroOffset = null;
      this.targetYaw += look.x;
      this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + look.y, -1.2, 1.2);
    }
    const mv = input.moveVector();
    this.targetYaw += mv.turn * 1.6 * dt;
    const kLook = 1 - Math.exp(-dt * (input.gameMode ? 30 : 12));
    this.yaw += (this.targetYaw - this.yaw) * kLook;
    this.pitch += (this.targetPitch - this.pitch) * kLook;

    // ---------- movement ----------
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let tx = 0, tz = 0, k;
    const manual = mv.x !== 0 || mv.y !== 0;
    if (manual && this.auto) this.auto = null; // taking control cancels a glide / tour leg

    if (this.auto) {
      const a = this.auto;
      const wp = a.path[a.i];
      const dx = wp.x - this.pos.x, dz = wp.z - this.pos.y;
      const d = Math.hypot(dx, dz);
      const rem = this.remaining();
      // ease in, cruise, ease out
      const vmax = Math.min(a.speedMax ?? GLIDE, Math.sqrt(2 * GLIDE_ACC * Math.max(0, rem - 0.05)) + 0.15);
      a.speed = Math.min(vmax, a.speed + GLIDE_ACC * dt);
      if (d > 1e-4) { tx = (dx / d) * a.speed; tz = (dz / d) * a.speed; }
      this.vel.set(tx, tz);
      k = 1;
      if (d < Math.max(0.12, a.speed * dt * 1.5)) {
        if (a.i < a.path.length - 1) a.i++;
        else if (rem < 0.15) this.arrive();
      }
      // turn gently towards the direction of travel, then to the final heading near the end
      if (this.auto) {
        if (a.yaw !== undefined && rem < 1.4) this.lookTo(a.yaw, a.pitch ?? this.targetPitch);
        else if (a.turn && d > 0.3 && !gyro) {
          const heading = Math.atan2(-dx, -dz);
          const diff = wrap(heading - this.targetYaw);
          this.targetYaw += diff * Math.min(1, dt * 1.6);
          this.targetPitch += (-0.04 - this.targetPitch) * Math.min(1, dt * 1.2);
        }
      }
    } else {
      const speed = input.running ? RUN : WALK;
      tx = (cos * mv.x - sin * mv.y) * speed;
      tz = (-sin * mv.x - cos * mv.y) * speed;
      // accelerate briskly, settle softly
      const accel = manual ? 7 : 5;
      k = 1 - Math.exp(-dt * accel);
      this.vel.x += (tx - this.vel.x) * k;
      this.vel.y += (tz - this.vel.y) * k;
    }

    const before = this.pos.clone();
    const steps = Math.max(1, Math.ceil((this.vel.length() * dt) / 0.1));
    for (let i = 0; i < steps; i++) {
      this.pos.x += (this.vel.x * dt) / steps;
      this.pos.y += (this.vel.y * dt) / steps;
      this.collide();
    }
    // keep velocity consistent with what collision allowed (slide instead of pushing into walls)
    if (dt > 0 && !this.auto) {
      const actual = this.pos.clone().sub(before).divideScalar(dt);
      if (actual.lengthSq() < this.vel.lengthSq()) this.vel.lerp(actual, 0.5);
    }
    if (this.auto) {
      const moved = this.pos.distanceTo(before);
      this.auto.stuck = moved < this.auto.speed * dt * 0.25 ? this.auto.stuck + dt : 0;
      if (this.auto.stuck > 0.8) this.arrive(); // blocked: stop gracefully
    }

    // ---------- floor / stairs / gravity ----------
    const floor = this.world.floorAt(this.pos.x, this.pos.y, this.feet, STEP);
    if (floor >= this.feet - 0.001) {
      this.feet = floor; this.vy = 0; this.grounded = true;
    } else if (this.grounded && this.feet - floor < STEP + 0.05) {
      this.feet = floor; this.vy = 0;
    } else {
      this.grounded = false;
      this.vy -= 9.8 * dt;
      this.feet += this.vy * dt;
      if (this.feet <= floor) { this.feet = floor; this.vy = 0; this.grounded = true; }
    }
    this.apply(dt);
  }

  arrive() {
    const a = this.auto;
    this.auto = null;
    this.vel.set(0, 0);
    if (a?.yaw !== undefined) this.lookTo(a.yaw, a.pitch ?? this.targetPitch);
    a?.onArrive?.();
  }

  collide() {
    const low = this.feet + 0.25, top = this.feet + BODY;
    const p = this.pos;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const s of this.world.colliders) {
        if (s.y1 <= low || s.y0 >= top) continue;
        const minD = RADIUS + s.r;
        if (p.x < Math.min(s.ax, s.bx) - minD || p.x > Math.max(s.ax, s.bx) + minD) continue;
        if (p.y < Math.min(s.az, s.bz) - minD || p.y > Math.max(s.az, s.bz) + minD) continue;
        const ex = s.bx - s.ax, ez = s.bz - s.az;
        const len2 = ex * ex + ez * ez || 1e-9;
        const t = THREE.MathUtils.clamp(((p.x - s.ax) * ex + (p.y - s.az) * ez) / len2, 0, 1);
        let dx = p.x - (s.ax + ex * t), dz = p.y - (s.az + ez * t);
        let d = Math.hypot(dx, dz);
        if (d >= minD) continue;
        if (d < 1e-6) { dx = -ez; dz = ex; d = Math.hypot(dx, dz) || 1; }
        const push = minD - d;
        p.x += (dx / d) * push;
        p.y += (dz / d) * push;
        moved = true;
      }
      if (!moved) break;
    }
  }

  apply(dt) {
    const k = 1 - Math.exp(-dt * 12);
    this.eyeY += (this.feet + EYE - this.eyeY) * k;
    // very subtle walking sway (~1 cm) so motion doesn't feel like a dolly on rails
    const sp = this.vel.length();
    this.bob += dt * sp * 4.2;
    const sway = Math.sin(this.bob) * 0.012 * Math.min(1, sp / WALK);
    this.camera.position.set(this.pos.x, this.eyeY + sway, this.pos.y);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
