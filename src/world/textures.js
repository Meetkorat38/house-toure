import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map();
let maxAniso = 8;
let suffix = ''; // '' = desktop set, '.lo' = half-size set for phones (see scripts/optimize-assets.mjs)
export const setMaxAnisotropy = (n) => { maxAniso = n; };
export const setTextureTier = (tier) => { suffix = tier === 'low' ? '.lo' : ''; };

function load(url, srgb) {
  if (!cache.has(url)) {
    const t = loader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = maxAniso;
    cache.set(url, t);
  }
  return cache.get(url);
}

/**
 * PBR set from public/assets/textures/<id>/{diff,nor,rough}[.lo].webp.
 * Geometry UVs are in metres, so `size` is how many metres one texture tile covers.
 * Clones share one image source, so each file is uploaded to the GPU once.
 */
export function pbr(id, { size = 1, rotation = 0, maps = ['diff', 'nor', 'rough'] } = {}) {
  const out = {};
  const base = `/assets/textures/${id}`;
  const keyMap = { diff: 'map', nor: 'normalMap', rough: 'roughnessMap' };
  for (const m of maps) {
    const src = load(`${base}/${m}${suffix}.webp`, m === 'diff');
    const t = src.clone();
    t.repeat.set(1 / size, 1 / size);
    t.rotation = rotation;
    t.needsUpdate = true;
    out[keyMap[m]] = t;
  }
  return out;
}

/**
 * Like pbr(), but the colour map is converted to greyscale on load so it can be re-tinted with
 * material.color (used to turn a blue-grey marble into the warm grey-taupe in the footage).
 */
export function pbrGrey(id, opts = {}) {
  const set = pbr(id, { ...opts, maps: (opts.maps || ['diff', 'nor', 'rough']).filter((m) => m !== 'diff') });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 4;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.repeat.set(1 / (opts.size || 1), 1 / (opts.size || 1));
  new THREE.ImageLoader().load(`/assets/textures/${id}/diff${suffix}.webp`, (img) => {
    canvas.width = img.width;
    canvas.height = img.height;
    const g = canvas.getContext('2d');
    g.filter = `grayscale(1) contrast(${opts.contrast ?? 1.15}) brightness(${opts.brightness ?? 1})`;
    g.drawImage(img, 0, 0);
    // the 4x4 placeholder may already be on the GPU as immutable storage: free it so the
    // full-size image is allocated fresh (otherwise the texture stays black)
    tex.dispose();
    tex.needsUpdate = true;
  });
  return { ...set, map: tex };
}

// ---------- procedural canvas textures ----------
const canvasTex = (w, h, draw, { srgb = true, repeat = true } = {}) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  return t;
};

// seeded random so generated art stays identical between reloads
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Vertical flutes for reeded glass (normal map, tile = 1 flute repeated). */
export function flutedNormal() {
  return canvasTex(64, 4, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const a = (x / w) * Math.PI * 2;
      const nx = Math.sin(a) * 0.9;
      const r = Math.round((nx * 0.5 + 0.5) * 255);
      g.fillStyle = `rgb(${r},128,${Math.round(Math.sqrt(1 - nx * nx) * 127 + 128)})`;
      g.fillRect(x, 0, 1, h);
    }
  }, { srgb: false });
}

/** Large abstract ink-wash painting like the foyer/gallery art in the video. */
export function abstractArt(seed = 7, w = 512, h = 768) {
  return canvasTex(w, h, (g) => {
    const r = rng(seed);
    g.fillStyle = '#e9e6df';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = r() * w, y = h * (0.15 + 0.7 * r());
      const rad = 10 + r() * 90;
      const shade = 60 + r() * 120;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(${shade},${shade},${shade + 6},${0.05 + r() * 0.08})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(x, y, rad * (1.5 + r() * 2), rad * 0.35, (r() - 0.5) * 0.3, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(40,40,44,${0.12 + r() * 0.25})`;
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath();
      let x = r() * w, y = h * (0.25 + r() * 0.5);
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (r() - 0.3) * 80; y += (r() - 0.5) * 30; g.lineTo(x, y); }
      g.stroke();
    }
  }, { repeat: false });
}

/** Cream rug with a dark maze/greek-key line pattern (family room). */
export function mazeRug(w = 512, h = 512) {
  return canvasTex(w, h, (g) => {
    const r = rng(3);
    g.fillStyle = '#c9bfae';
    g.fillRect(0, 0, w, h);
    // subtle wool mottling
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,250,240' : '120,110,95'},0.05)`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    g.strokeStyle = '#857b6d';
    g.lineWidth = 3;
    g.lineCap = 'square';
    const cell = 20;
    for (let y = cell; y < h - cell; y += cell) {
      for (let x = cell; x < w - cell; x += cell) {
        if (r() < 0.45) continue;
        g.beginPath();
        g.moveTo(x, y);
        if (r() < 0.5) g.lineTo(x + cell * (1 + Math.floor(r() * 2)), y);
        else g.lineTo(x, y + cell * (1 + Math.floor(r() * 2)));
        g.stroke();
      }
    }
    g.strokeRect(10, 10, w - 20, h - 20);
  }, { repeat: false });
}

/** Leaf clump texture with alpha (used for hedges, trees and boxwood). */
export function leafAtlas(seed = 11, tint = [62, 92, 46]) {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(seed);
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = 20 + r() * (w - 40), y = 20 + r() * (h - 40);
      const len = 10 + r() * 16, wid = 4 + r() * 5;
      const k = 0.65 + r() * 0.6;
      g.fillStyle = `rgb(${Math.round(tint[0] * k)},${Math.round(tint[1] * k)},${Math.round(tint[2] * k)})`;
      g.save();
      g.translate(x, y);
      g.rotate(r() * Math.PI * 2);
      g.beginPath();
      g.ellipse(0, 0, len / 2, wid / 2, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }, { repeat: false });
}

/** Dense foliage surface for clipped hedges (tileable, no alpha). */
export function hedgeTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(5);
    g.fillStyle = '#2f4a24';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h;
      const k = 0.55 + r() * 0.8;
      g.fillStyle = `rgb(${Math.round(58 * k)},${Math.round(92 * k)},${Math.round(42 * k)})`;
      g.save();
      g.translate(x, y);
      g.rotate(r() * Math.PI);
      g.beginPath();
      g.ellipse(0, 0, 3 + r() * 4, 1.5 + r() * 2, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  });
}

/** Large-format porcelain tiles (1.2 x 0.6 m) with thin joints; UVs in metres → repeat 1/1.2, 1/0.6. */
export function porcelainTiles() {
  const t = canvasTex(512, 256, (g, w, h) => {
    const r = rng(9);
    g.fillStyle = '#c9c6bf';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(80,76,70,0.05)';
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    g.fillStyle = '#8f8b84';
    g.fillRect(0, 0, w, 2);
    g.fillRect(0, 0, 2, h);
  });
  t.repeat.set(1 / 1.2, 1 / 0.6);
  return t;
}

/** Black / white awning stripes for outdoor cushions (one stripe pair per 0.12 m). */
export function stripes() {
  const t = canvasTex(64, 8, (g, w, h) => {
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1c1c1e'; g.fillRect(0, 0, w / 2, h);
  });
  t.repeat.set(1 / 0.12, 1);
  return t;
}

/** Rippled water normal map. */
export function waterNormal() {
  return canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    const f = (x, y) => Math.sin(x * 0.11 + Math.sin(y * 0.07) * 2) + Math.sin(y * 0.13 + Math.sin(x * 0.05) * 3) * 0.7
      + Math.sin((x + y) * 0.21) * 0.3;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = f(x + 1, y) - f(x - 1, y), dy = f(x, y + 1) - f(x, y - 1);
        const i = (y * w + x) * 4;
        img.data[i] = 128 + dx * 40;
        img.data[i + 1] = 128 + dy * 40;
        img.data[i + 2] = 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
}

/** Projector image for the media room (soft abstract landscape). */
export function screenImage() {
  return canvasTex(512, 288, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#9fb5c9');
    grd.addColorStop(0.5, '#d9c9a6');
    grd.addColorStop(1, '#6d8291');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    const r = rng(21);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(${80 + r() * 80},${90 + r() * 70},${100 + r() * 60},0.18)`;
      g.beginPath();
      g.ellipse(r() * w, h * 0.4 + r() * h * 0.6, 30 + r() * 120, 8 + r() * 30, 0, 0, Math.PI * 2);
      g.fill();
    }
  }, { repeat: false });
}
