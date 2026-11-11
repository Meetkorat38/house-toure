// Downloads the CC0 assets used by the walkthrough into public/assets.
// Sources: Poly Haven (polyhaven.com, CC0) and ambientCG (ambientcg.com, CC0).
// Usage: node scripts/fetch-assets.mjs
import { mkdir, writeFile, readdir, rename, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Raw downloads go to assets-src/ (not deployed); scripts/optimize-assets.mjs writes the web
// versions (WebP textures, 1k HDR + WebP sky backgrounds, meshopt GLB models) to public/assets/.
const OUT = path.join(ROOT, 'assets-src');
const UA = { 'User-Agent': 'walkthrough-asset-fetch/1.0' };

const POLY_TEXTURES = { laminate_floor_02: '2k', walnut_veneer: '1k', leafy_grass: '2k' };
// day (overcast like the footage), golden hour, evening (blue-hour dusk)
// day (heavy textured overcast like the footage), golden hour, evening (blue-hour dusk).
// 1k HDR is plenty for lighting; the visible sky comes from the tonemapped JPG (→ WebP).
const POLY_HDRI = { overcast_soil_puresky: '1k', kloppenheim_06_puresky: '1k', qwantani_dusk_2_puresky: '1k' };
const POLY_MODELS = [
  'potted_plant_04', 'potted_plant_02', 'ceramic_vase_01', 'ceramic_vase_03', 'decorative_book_set_01',
  // Poly Haven trees are 60–200 MB each (film-grade); trees are built procedurally instead.
  'shrub_01', 'shrub_04', 'grass_medium_01',
];
const ACG = {
  WoodFloor040: '2K', Marble023: '1K', Travertine009: '1K', Travertine004: '1K',
  Fabric030: '1K', Fabric062: '1K', Carpet016: '1K',
  Marble012: '1K', // white marble with grey veins: primary bath floor
};

async function get(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}
async function save(file, buf) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf);
}
const exists = (f) => existsSync(f);

async function polyTexture(id, res) {
  const files = JSON.parse((await get(`https://api.polyhaven.com/files/${id}`)).toString());
  const maps = { Diffuse: 'diff', nor_gl: 'nor', Rough: 'rough', AO: 'ao' };
  for (const [key, short] of Object.entries(maps)) {
    const entry = files[key]?.[res]?.jpg || files[key]?.[res]?.png;
    if (!entry) continue;
    const ext = entry.url.split('.').pop();
    const file = path.join(OUT, 'textures', id, `${short}.${ext}`);
    if (!exists(file)) await save(file, await get(entry.url));
  }
  console.log('texture', id);
}

async function polyHdri(id, res) {
  const files = JSON.parse((await get(`https://api.polyhaven.com/files/${id}`)).toString());
  const entry = files.hdri[res].hdr;
  const file = path.join(OUT, 'hdri', `${id}_${res}.hdr`);
  if (!exists(file)) await save(file, await get(entry.url));
  const bg = path.join(OUT, 'hdri', `${id}_tonemapped.jpg`);
  if (files.tonemapped && !exists(bg)) await save(bg, await get(files.tonemapped.url));
  console.log('hdri', id);
}

async function polyModel(id) {
  const files = JSON.parse((await get(`https://api.polyhaven.com/files/${id}`)).toString());
  const g = files.gltf?.['1k']?.gltf || files.gltf?.['2k']?.gltf;
  if (!g) { console.log('model (no gltf, skipped)', id); return; }
  const dir = path.join(OUT, 'models', id);
  const main = path.join(dir, `${id}.gltf`);
  if (!exists(main)) await save(main, await get(g.url));
  for (const [rel, inc] of Object.entries(g.include || {})) {
    const f = path.join(dir, rel);
    if (!exists(f)) await save(f, await get(inc.url));
  }
  console.log('model', id);
}

async function acgMaterial(id, res) {
  const dir = path.join(OUT, 'textures', id);
  if (exists(path.join(dir, 'diff.jpg'))) { console.log('acg (cached)', id); return; }
  const zip = path.join(OUT, '_tmp', `${id}.zip`);
  await save(zip, await get(`https://ambientcg.com/get?file=${id}_${res}-JPG.zip`));
  const tmp = path.join(OUT, '_tmp', id);
  await mkdir(tmp, { recursive: true });
  execFileSync('C:\\Windows\\System32\\tar.exe', ['-xf', zip, '-C', tmp]);
  await mkdir(dir, { recursive: true });
  for (const f of await readdir(tmp)) {
    const map = f.includes('_Color') ? 'diff' : f.includes('_NormalGL') ? 'nor' : f.includes('_Roughness') ? 'rough'
      : f.includes('_AmbientOcclusion') ? 'ao' : null;
    if (map && f.endsWith('.jpg')) await rename(path.join(tmp, f), path.join(dir, `${map}.jpg`));
  }
  console.log('acg', id);
}

await mkdir(OUT, { recursive: true });
for (const [id, res] of Object.entries(POLY_TEXTURES)) await polyTexture(id, res);
for (const [id, res] of Object.entries(POLY_HDRI)) for (const r of [res].flat()) await polyHdri(id, r);
for (const id of POLY_MODELS) await polyModel(id);
for (const [id, res] of Object.entries(ACG)) await acgMaterial(id, res);
if (exists(path.join(OUT, '_tmp'))) await rm(path.join(OUT, '_tmp'), { recursive: true, force: true });

let total = 0;
async function du(d) { for (const f of await readdir(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) await du(p); else total += (await stat(p)).size; } }
await du(OUT);
console.log(`done: ${(total / 1e6).toFixed(1)} MB in assets-src (run optimize-assets.mjs next)`);
