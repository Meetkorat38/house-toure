// Builds the web-ready asset set in public/assets from the raw downloads in assets-src.
//   textures  → WebP, sized to what each material needs, plus a half-size ".lo" set for phones
//   skies     → 1k HDR (lighting) + WebP equirect background (4k desktop / 2k phone)
//   models    → single GLB: welded, simplified, meshopt-compressed, WebP textures
// Usage: node scripts/optimize-assets.mjs
import { mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets-src');
const OUT = path.join(ROOT, 'public', 'assets');

// max texture size per set: [diffuse, normal, roughness] for the desktop tier (phones get half)
const TEXTURES = {
  laminate_floor_02: [2048, 2048, 1024], // the oak floor fills most of the frame
  leafy_grass: [1024, 1024, 512],
  walnut_veneer: [1024, 1024, 512],
  Marble023: [1024, 1024, 512],
  Marble012: [1024, 1024, 512],
  Travertine004: [1024, 1024, 512],
  Travertine009: [1024, 1024, 512],
  Fabric030: [512, 512, 256],
  Fabric062: [512, 512, 256],
  Carpet016: [512, 512, 256],
};
const QUALITY = { diff: 82, nor: 90, rough: 72 };
const SKIES = ['overcast_soil_puresky', 'kloppenheim_06_puresky', 'qwantani_dusk_2_puresky'];
const MODELS = { potted_plant_02: 0.5, potted_plant_04: 1, ceramic_vase_01: 0.5, ceramic_vase_03: 0.5 };

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
let total = 0;
async function sized(file) { const s = (await stat(file)).size; total += s; return s; }

async function textures() {
  for (const [id, sizes] of Object.entries(TEXTURES)) {
    const dir = path.join(OUT, 'textures', id);
    await mkdir(dir, { recursive: true });
    const maps = ['diff', 'nor', 'rough'];
    const report = [];
    for (let i = 0; i < maps.length; i++) {
      const src = path.join(SRC, 'textures', id, `${maps[i]}.jpg`);
      if (!existsSync(src)) continue;
      for (const [suffix, size] of [['', sizes[i]], ['.lo', Math.max(128, sizes[i] / 2)]]) {
        const out = path.join(dir, `${maps[i]}${suffix}.webp`);
        let img = sharp(src).resize(size, size, { fit: 'inside', withoutEnlargement: true });
        if (maps[i] === 'rough') img = img.greyscale();
        await img.webp({ quality: QUALITY[maps[i]], effort: 5, smartSubsample: maps[i] === 'diff' }).toFile(out);
        report.push(`${maps[i]}${suffix} ${kb(await sized(out))}`);
      }
    }
    console.log(`texture ${id}: ${report.join(', ')}`);
  }
}

async function skies() {
  const dir = path.join(OUT, 'hdri');
  await mkdir(dir, { recursive: true });
  for (const id of SKIES) {
    const hdr = path.join(dir, `${id}.hdr`);
    await copyFile(path.join(SRC, 'hdri', `${id}_1k.hdr`), hdr);
    const bgSrc = path.join(SRC, 'hdri', `${id}_tonemapped.jpg`);
    const report = [`hdr ${kb(await sized(hdr))}`];
    for (const [suffix, w, q] of [['', 4096, 80], ['.lo', 2048, 76]]) {
      const out = path.join(dir, `${id}_bg${suffix}.webp`);
      await sharp(bgSrc, { limitInputPixels: false }).resize(w, w / 2).webp({ quality: q, effort: 5 }).toFile(out);
      report.push(`bg${suffix} ${kb(await sized(out))}`);
    }
    console.log(`sky ${id}: ${report.join(', ')}`);
  }
}

async function models() {
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const dir = path.join(OUT, 'models');
  await mkdir(dir, { recursive: true });
  for (const [id, ratio] of Object.entries(MODELS)) {
    const doc = await io.read(path.join(SRC, 'models', id, `${id}.gltf`));
    const steps = [dedup(), prune(), weld()];
    if (ratio < 1) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002 }));
    steps.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 80 }));
    steps.push(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await doc.transform(...steps);
    const out = path.join(dir, `${id}.glb`);
    await io.write(out, doc);
    console.log(`model ${id}: ${kb(await sized(out))}`);
  }
}

await textures();
await skies();
await models();
console.log(`done: ${(total / 1e6).toFixed(1)} MB written to public/assets`);
