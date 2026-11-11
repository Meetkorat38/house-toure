import * as THREE from 'three';
import { M } from './materials.js';
import { bake } from './geom.js';

const speakerGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.008, 28);
const speakerRim = new THREE.CylinderGeometry(0.125, 0.125, 0.004, 28);
const canGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.006, 16);
const canRim = new THREE.CylinderGeometry(0.042, 0.042, 0.004, 16);

/**
 * Ceiling details per room style, matching the reference:
 *  - plaster (default): trimless triple-spot housings on a grid + round in-ceiling speakers
 *  - slats: dense dark walnut slat ceiling with many warm round downlights (media lounge)
 *  - planks: oak plank ceiling with black recessed linear lights (family room)
 */
export function buildCeilingFeatures(B, r, cy) {
  const style = r.ceilingStyle || 'plaster';
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  const y = cy - 0.008; // housings sit 8 mm proud: smaller gaps flicker at a distance

  if (style === 'slats') {
    const slatW = 0.028, gap = 0.022, depth = 0.05;
    for (let z = r.z0 + 0.03; z < r.z1 - slatW; z += slatW + gap) {
      B.box(r.x0, cy - depth, z, r.x1, cy, z + slatW, { ny: M.walnutSlat, pz: M.walnutSlat, nz: M.walnutSlat });
    }
    for (let x = r.x0 + 0.8; x < r.x1 - 0.4; x += 1.1) {
      for (let z = r.z0 + 0.8; z < r.z1 - 0.4; z += 1.1) {
        B.geometry(M.metalBlack, bake(canRim, [x, cy - depth - 0.004, z]));
        B.geometry(M.downlightWarm, bake(canGeo, [x, cy - depth - 0.011, z]));
      }
    }
    return;
  }

  if (style === 'planks') {
    const n = r.linearLights ?? 3;
    for (let i = 1; i <= n; i++) {
      const x = r.x0 + (w * i) / (n + 1);
      B.box(x - 0.025, y - 0.002, r.z0 + 0.6, x + 0.025, cy, r.z1 - 0.6, { ny: M.metalBlack });
      // emissive dots along the track
      for (let z = r.z0 + 0.8; z < r.z1 - 0.7; z += 0.18) {
        B.box(x - 0.008, y - 0.012, z, x + 0.008, y - 0.006, z + 0.05, { ny: M.downlight });
      }
    }
    return;
  }

  if (r.downlights === false) return;
  // triple-spot trimless housings: 0.32 x 0.11 black recess with three lamps
  const sx = r.lightSpacing ?? 2.6;
  const nx = Math.max(1, Math.round(w / sx)), nz = Math.max(1, Math.round(d / sx));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = r.x0 + (w * (i + 0.5)) / nx, z = r.z0 + (d * (j + 0.5)) / nz;
      const alongX = (i + j) % 2 === 0;
      const hx = alongX ? 0.16 : 0.055, hz = alongX ? 0.055 : 0.16;
      B.box(x - hx, y - 0.001, z - hz, x + hx, cy, z + hz, { ny: M.metalBlack });
      for (let k = -1; k <= 1; k++) {
        const ox = alongX ? k * 0.1 : 0, oz = alongX ? 0 : k * 0.1;
        B.box(x + ox - 0.025, y - 0.008, z + oz - 0.025, x + ox + 0.025, y - 0.005, z + oz + 0.025, { ny: M.downlight });
      }
    }
  }
  // speakers: two per larger room
  if (w * d > 30) {
    const spots = [[r.x0 + w * 0.25, r.z0 + d * 0.3], [r.x0 + w * 0.75, r.z0 + d * 0.7]];
    for (const [x, z] of spots) {
      B.geometry(M.plaster, bake(speakerRim, [x, cy - 0.004, z]));
      B.geometry(M.cabinetGrey, bake(speakerGeo, [x, cy - 0.014, z]));
    }
  }
}
