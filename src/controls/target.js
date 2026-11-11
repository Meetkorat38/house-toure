import * as THREE from 'three';

/**
 * Floor picking for click/tap-to-walk + the on-floor target ring.
 * Picking is analytic (ray vs floor plane, occluded by solid colliders) so it costs nothing per frame.
 * Glass is treated as see-through: clicking the lawn through a window routes you out via a door.
 */
export class FloorTarget {
  constructor(scene, camera, world, nav) {
    this.camera = camera;
    this.world = world;
    this.nav = nav;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();

    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
    const fill = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false });
    this.ring = new THREE.Group();
    const r = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.235, 48), mat);
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.2, 48), fill);
    for (const m of [r, d]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 5; }
    this.ring.add(d, r);
    this.ring.visible = false;
    scene.add(this.ring);

    this.pulse = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.24, 48), mat.clone());
    this.pulse.rotation.x = -Math.PI / 2;
    this.pulse.renderOrder = 5;
    this.pulse.visible = false;
    this.pulseT = 0;
    scene.add(this.pulse);

    this.dest = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 40), mat.clone());
    this.dest.rotation.x = -Math.PI / 2;
    this.dest.renderOrder = 5;
    this.dest.visible = false;
    scene.add(this.dest);
  }

  /** Screen point → walkable floor point {x, z} or null. */
  pick(sx, sy, floorY = 0) {
    this.camera.updateMatrixWorld();
    this.ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const o = this.ray.ray.origin, dir = this.ray.ray.direction;
    if (dir.y > -0.03) return null; // looking at or above the horizon
    let t = (floorY + 0.01 - o.y) / dir.y;
    t = Math.min(t, 45);
    const px = o.x + dir.x * t, pz = o.z + dir.z * t;

    // first solid obstacle the ray passes through (in plan), at the height the ray has there
    let best = 1;
    for (const s of this.world.colliders) {
      if (s.glass || s.stairGate) continue;
      const u = segIntersect(o.x, o.z, px, pz, s.ax, s.az, s.bx, s.bz);
      if (u === null || u >= best) continue;
      const h = o.y + dir.y * t * u;
      if (h > s.y0 - 0.01 && h < s.y1) best = u;
    }
    let x = px, z = pz;
    if (best < 1) {
      // clicked a wall or furniture: walk up to it
      const back = Math.max(0, best - 0.35 / Math.max(0.01, t * Math.hypot(dir.x, dir.z)));
      x = o.x + (px - o.x) * back;
      z = o.z + (pz - o.z) * back;
    }
    return this.nav.nearestFree(x, z, floorY > 2 ? 1 : 0, 1.4);
  }

  hover(pt, floorY = 0) {
    if (!pt) { this.ring.visible = false; return; }
    this.ring.visible = true;
    this.ring.position.set(pt.x, floorY + 0.012, pt.z);
  }

  click(pt, floorY = 0) {
    this.pulse.visible = true;
    this.pulse.position.set(pt.x, floorY + 0.014, pt.z);
    this.pulseT = 0;
    this.dest.visible = true;
    this.dest.position.set(pt.x, floorY + 0.012, pt.z);
  }

  clearDest() { this.dest.visible = false; }

  update(dt, moving) {
    if (this.pulse.visible) {
      this.pulseT += dt;
      const s = 1 + this.pulseT * 3.5;
      this.pulse.scale.set(s, s, s);
      this.pulse.material.opacity = Math.max(0, 0.9 - this.pulseT * 1.8);
      if (this.pulseT > 0.5) this.pulse.visible = false;
    }
    if (this.dest.visible) {
      this.dest.material.opacity = 0.55 + Math.sin(performance.now() * 0.008) * 0.25;
      if (!moving) this.dest.visible = false;
    }
    if (moving) this.ring.visible = false;
  }
}

/** Intersection of segment P0→P1 with Q0→Q1; returns param along P (0..1) or null. */
function segIntersect(p0x, p0z, p1x, p1z, q0x, q0z, q1x, q1z) {
  const rx = p1x - p0x, rz = p1z - p0z, sx = q1x - q0x, sz = q1z - q0z;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qpx = q0x - p0x, qpz = q0z - p0z;
  const u = (qpx * sz - qpz * sx) / den;
  const v = (qpx * rz - qpz * rx) / den;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return u;
}
