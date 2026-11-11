// Renders the PNG icons from public/favicon.svg.
// Usage: node scripts/make-icons.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = path.join(PUB, 'favicon.svg');

const outputs = [
  ['favicon-32.png', 32],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
];
for (const [name, size] of outputs) {
  await sharp(svg, { density: Math.ceil((72 * size) / 64) * 2 }).resize(size, size).png().toFile(path.join(PUB, name));
  console.log(name, `${size}x${size}`);
}
