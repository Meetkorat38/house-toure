import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { M } from './materials.js';

// Each mood: a 1k HDR for image-based lighting (~1.1 MB) + a WebP sky photo for the visible
// background (4k desktop / 2k phones, 25–125 KB). Far lighter than a 4k HDR (17 MB) and sharper.
const SKY = { day: 'overcast_soil_puresky', golden: 'kloppenheim_06_puresky', evening: 'qwantani_dusk_2_puresky' };

/** Lighting state per mood. Colours are hex, vectors are arrays. */
const PRESETS = {
  day: {
    env: 0.85, bg: 2.7, rot: 0.6, sunI: 1.1, sunCol: 0xfff4e6, sunPos: [30, 48, -22],
    hemiI: 0.35, hemiCol: 0xdfe7ee, hemiGround: 0x6e6252, rectI: 1, rectCol: 0xeef3f7, fog: 0xc4cbcf,
    led: 3.0, down: 4.0, downWarm: 2.6, pendant: 1.6, ceilGlow: 0.32, water: 0, spots: 0,
  },
  golden: {
    env: 0.5, bg: 2.0, rot: 0, sunI: 4.0, sunCol: 0xffb36e, sunPos: 'hdri',
    hemiI: 0.3, hemiCol: 0xffd9b0, hemiGround: 0x5a4030, rectI: 0.6, rectCol: 0xffd6a8, fog: 0xd8b892,
    led: 3.5, down: 4.0, downWarm: 3.0, pendant: 2.2, ceilGlow: 0.22, water: 0, spots: 0,
  },
  evening: {
    env: 0.09, bg: 1.1, rot: 0, sunI: 0, sunCol: 0x8fa6d6, sunPos: [-20, 30, -30],
    hemiI: 0.2, hemiCol: 0x6a7cab, hemiGround: 0x2a2018, rectI: 1.25, rectCol: 0xffc68c, fog: 0x232a3d,
    led: 6.5, down: 8, downWarm: 7, pendant: 4.5, ceilGlow: 0.07, water: 0.9, spots: 1,
  },
};

export class Moods {
  constructor({ scene, renderer, sun, hemi, rects, world, quality, onLoading, initial = 'golden' }) {
    Object.assign(this, { scene, renderer, sun, hemi, rects, world, quality, onLoading });
    this.loader = new RGBELoader();
    this.hdr = {};
    this.current = initial;
    this.state = this.snapshotPreset(initial);
    this.tween = null;
    this.spots = null;
    this.rectBase = rects.map((l) => l.intensity);
    this.busy = false;
  }

  snapshotPreset(name) {
    const p = PRESETS[name];
    const sunPos = p.sunPos === 'hdri' ? (this.hdrSunPos?.[name] || [-26, 17, -34]) : p.sunPos;
    return {
      env: p.env, bg: p.bg, sunI: p.sunI, sunCol: new THREE.Color(p.sunCol), sunPos: new THREE.Vector3(...sunPos),
      hemiI: p.hemiI, hemiCol: new THREE.Color(p.hemiCol), hemiGround: new THREE.Color(p.hemiGround),
      rectI: p.rectI, rectCol: new THREE.Color(p.rectCol), fog: new THREE.Color(p.fog),
      led: p.led, down: p.down, downWarm: p.downWarm, pendant: p.pendant, ceilGlow: p.ceilGlow, water: p.water, spots: p.spots,
    };
  }

  /** Resolves to { env: HDR texture for lighting, bg: sky photo for the background }. */
  loadHdr(name) {
    if (!this.hdr[name]) {
      const id = SKY[name];
      const env = this.loader.loadAsync(`/assets/hdri/${id}.hdr`).then((t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        if (PRESETS[name].sunPos === 'hdri') {
          this.hdrSunPos ??= {};
          this.hdrSunPos[name] = sunFromHdr(t);
        }
        return t;
      });
      const bg = new THREE.TextureLoader().loadAsync(`/assets/hdri/${id}_bg${this.quality === 'high' ? '' : '.lo'}.webp`).then((t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return t;
      });
      this.hdr[name] = Promise.all([env, bg]).then(([e, b]) => ({ env: e, bg: b }));
      this.parts = { ...this.parts, [name]: { env, bg } };
    }
    return this.hdr[name];
  }

  /** Rotation of the sky photo for a mood. */
  rotation(name) { return PRESETS[name].rot; }

  /** The lighting HDR and the background photo separately (startup compiles shaders on env alone). */
  loadParts(name) {
    this.loadHdr(name);
    return this.parts[name];
  }

  /**
   * Evening effects that add no lights (so no shader recompiles and almost no GPU cost):
   * warm additive "light pools" on the floors under the ceiling fixtures + a glow around the pool.
   * On desktop the window area lights are also moved up to the ceilings and turned warm.
   */
  buildEveningFx() {
    const group = new THREE.Group();
    const tex = radialTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: tex, color: 0xffb46a, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2,
    });
    const spots = [];
    const rooms = this.world.upperEnabled ? this.world.rooms : this.world.byLevel[0];
    for (const r of rooms) {
      if (r.kind !== 'indoor') continue;
      const y = this.world.levels[r.level].floor + 0.012;
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      const sp = r.ceilingStyle === 'slats' ? 2.0 : 2.6;
      const nx = Math.max(1, Math.round(w / sp)), nz = Math.max(1, Math.round(d / sp));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        spots.push([r.x0 + (w * (i + 0.5)) / nx, r.z0 + (d * (j + 0.5)) / nz, r.doubleHeight ? 2.2 : 1.5, y]);
      }
    }
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    const inst = new THREE.InstancedMesh(plane, mat, spots.length);
    const m4 = new THREE.Matrix4();
    spots.forEach(([x, z, s, y], i) => inst.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(s * 2, 1, s * 2))));
    inst.renderOrder = 4;
    inst.frustumCulled = false;
    group.add(inst);

    const ex = this.world.house?.exterior;
    if (ex) {
      const glowMat = mat.clone();
      glowMat.color.set(0x3fd0e8);
      const glow = new THREE.Mesh(plane, glowMat);
      glow.position.set(ex.pool.center[0], 0.02, ex.pool.center[1]);
      glow.scale.set((ex.pool.r + 2.5) * 2, 1, (ex.pool.r + 2.5) * 2);
      glow.renderOrder = 4;
      group.add(glow);
      this.poolGlow = glowMat;
    }
    this.poolMat = mat;
    this.scene.add(group);
    this.spots = group;

    // desktop: daylight panels at the windows become warm ceiling light at night
    if (this.rects.length && !this.rectDay) {
      this.rectDay = this.rects.map((l) => ({ p: l.position.clone(), r: l.rotation.clone(), w: l.width, h: l.height }));
      const ceil = [[14.5, 4.5, 8.5, 7], [24, 4.5, 6.5, 7], [4.5, 4.5, 7.5, 7.5], [32, 4.5, 6.5, 7]];
      this.rectEve = ceil.map(([x, z, w, h]) => ({ p: new THREE.Vector3(x, 3.3, z), r: new THREE.Euler(-Math.PI / 2, 0, 0), w, h }));
    }
  }

  placeRects(set) {
    if (!set) return;
    this.rects.forEach((l, i) => {
      const t = set[i];
      if (!t) return;
      l.position.copy(t.p);
      l.rotation.copy(t.r);
      l.width = t.w;
      l.height = t.h;
    });
  }

  async set(name) {
    if (!PRESETS[name]) return;
    if (this.busy) { this.pending = name; return; } // apply after the current fade
    if (name === this.current) return;
    this.busy = true;
    this.onLoading?.(true);
    const hdr = await this.loadHdr(name);
    if (name === 'evening' && !this.spots) this.buildEveningFx();
    this.onLoading?.(false);
    this.tween = { from: this.state, to: this.snapshotPreset(name), t: 0, dur: 2.0, hdr, rot: PRESETS[name].rot, swapped: false, name };
    this.current = name;
  }

  apply(s) {
    const { scene, sun, hemi } = this;
    scene.environmentIntensity = s.env;
    scene.backgroundIntensity = s.bg;
    sun.intensity = s.sunI;
    sun.color.copy(s.sunCol);
    sun.position.copy(s.sunPos);
    hemi.intensity = s.hemiI;
    hemi.color.copy(s.hemiCol);
    hemi.groundColor.copy(s.hemiGround);
    // never toggle light visibility: changing the light count recompiles every shader
    this.rects.forEach((l, i) => { l.intensity = this.rectBase[i] * s.rectI; l.color.copy(s.rectCol); });
    if (scene.fog) scene.fog.color.copy(s.fog);
    M.led.emissiveIntensity = s.led;
    M.downlight.emissiveIntensity = s.down;
    M.downlightWarm.emissiveIntensity = s.downWarm;
    M.pendantGlass.emissiveIntensity = s.pendant;
    M.ceiling.emissiveIntensity = s.ceilGlow;
    M.water.emissive.set(0x1aa6c0);
    M.water.emissiveIntensity = s.water;
    if (this.spots) {
      this.spots.visible = s.spots > 0.001;
      this.poolMat.opacity = 0.42 * s.spots;
      if (this.poolGlow) this.poolGlow.opacity = 0.35 * s.spots;
    }
  }

  update(dt) {
    const tw = this.tween;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + dt / tw.dur);
    const e = tw.t < 0.5 ? 2 * tw.t * tw.t : 1 - Math.pow(-2 * tw.t + 2, 2) / 2; // ease in-out
    const a = tw.from, b = tw.to;
    const L = (x, y) => x + (y - x) * e;
    const s = {
      env: L(a.env, b.env), bg: L(a.bg, b.bg), sunI: L(a.sunI, b.sunI),
      sunCol: a.sunCol.clone().lerp(b.sunCol, e), sunPos: a.sunPos.clone().lerp(b.sunPos, e),
      hemiI: L(a.hemiI, b.hemiI), hemiCol: a.hemiCol.clone().lerp(b.hemiCol, e), hemiGround: a.hemiGround.clone().lerp(b.hemiGround, e),
      rectI: L(a.rectI, b.rectI), rectCol: a.rectCol.clone().lerp(b.rectCol, e), fog: a.fog.clone().lerp(b.fog, e),
      led: L(a.led, b.led), down: L(a.down, b.down), downWarm: L(a.downWarm, b.downWarm), pendant: L(a.pendant, b.pendant),
      ceilGlow: L(a.ceilGlow, b.ceilGlow), water: L(a.water, b.water), spots: L(a.spots, b.spots),
    };
    // swap the sky photo halfway, behind a brief soft dip
    if (!tw.swapped && tw.t >= 0.5) {
      tw.swapped = true;
      this.scene.environment = tw.hdr.env;
      this.scene.background = tw.hdr.bg;
      this.scene.backgroundRotation.set(0, tw.rot, 0);
      this.scene.environmentRotation.set(0, tw.rot, 0);
      this.placeRects(tw.name === 'evening' ? this.rectEve : this.rectDay);
    }
    const dip = 1 - 0.35 * Math.exp(-Math.pow((tw.t - 0.5) / 0.08, 2));
    s.env *= dip; s.bg *= dip;
    this.apply(s);
    this.state = s;
    this.renderer.shadowMap.needsUpdate = true;
    if (tw.t >= 1) {
      this.tween = null;
      this.busy = false;
      this.apply(s); // final state without the fade flag (hides unused lights)
      if (this.pending && this.pending !== this.current) {
        const next = this.pending;
        this.pending = null;
        this.set(next);
      }
      this.pending = null;
      this.onChange?.(this.current);
    }
  }
}

/** Soft round falloff used for the evening light pools. */
function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Direction of the brightest pixel in an equirect HDR → a sun position (elevation clamped for nice light). */
function sunFromHdr(tex) {
  const { data, width, height } = tex.image;
  const half = data instanceof Uint16Array;
  const val = (i) => (half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i]);
  const ch = data.length / (width * height);
  let best = -1, bx = 0, by = 0;
  for (let y = 0; y < height / 2; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * ch;
      const l = val(i) * 0.2126 + val(i + 1) * 0.7152 + val(i + 2) * 0.0722;
      if (l > best) { best = l; bx = x; by = y; }
    }
  }
  const u = (bx + 0.5) / width, v = 1 - (by + 0.5) / height;
  const lon = (u - 0.5) * Math.PI * 2;
  let lat = (v - 0.5) * Math.PI;
  lat = THREE.MathUtils.clamp(lat, THREE.MathUtils.degToRad(14), THREE.MathUtils.degToRad(40));
  const dir = new THREE.Vector3(Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat));
  const target = new THREE.Vector3(18, 0, 6);
  return target.add(dir.multiplyScalar(60)).toArray();
}
