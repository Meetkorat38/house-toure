import * as THREE from 'three';
import { pbr, pbrGrey, flutedNormal, abstractArt, mazeRug, hedgeTexture, waterNormal, screenImage, porcelainTiles, stripes } from './textures.js';

const std = (params) => new THREE.MeshStandardMaterial(params);
const phys = (params) => new THREE.MeshPhysicalMaterial(params);
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);

/**
 * Materials matched to the reference footage. Textures are CC0 (Poly Haven / ambientCG);
 * UVs are in metres, so `size` = metres per texture tile.
 */
function create(quality) {
  const M = {};

  // ---- floors & stone ----
  // wide-plank oak: deeper honey-brown with a soft satin sheen, as in the footage
  M.oak = std({ ...pbr('laminate_floor_02', { size: 1.9, rotation: Math.PI / 2 }), color: lin(0.84, 0.62, 0.42), roughness: 0.62, envMapIntensity: 1.0 });
  M.oakCeiling = std({ ...pbr('laminate_floor_02', { size: 2.2 }), color: lin(1.25, 1.12, 0.95), roughness: 1 });
  M.marble = std({ ...pbrGrey('Marble023', { size: 1.6, contrast: 1.1, brightness: 1.05 }), color: lin(1.55, 1.46, 1.34), roughness: 0.55, envMapIntensity: 1.2 });
  M.travertine = std({ ...pbr('Travertine004', { size: 1.2 }), roughness: 1 });
  // pale cream travertine like the footage (greyscaled source re-tinted, so it never reads orange)
  M.paver = std({ ...pbrGrey('Travertine009', { size: 2.4, contrast: 0.9, brightness: 1.05 }), color: lin(1.12, 1.07, 0.97), roughness: 1 });
  M.stoneClad = std({ ...pbr('Travertine004', { size: 2.5, rotation: Math.PI / 2 }), color: lin(0.62, 0.6, 0.58), roughness: 1 });

  // ---- woods ----
  M.walnut = std({ ...pbr('walnut_veneer', { size: 1.2, rotation: Math.PI / 2 }), color: lin(0.75, 0.68, 0.62), roughness: 1 });
  M.walnutDark = std({ ...pbr('walnut_veneer', { size: 1.2, rotation: Math.PI / 2 }), color: lin(0.42, 0.34, 0.29), roughness: 1 });
  M.walnutSlat = std({ ...pbr('walnut_veneer', { size: 0.6, rotation: Math.PI / 2 }), color: lin(0.36, 0.28, 0.23), roughness: 1 });
  // wall panelling: grain runs vertically on walls (UV v = height)
  M.walnutPanel = std({ ...pbr('walnut_veneer', { size: 1.4 }), color: lin(0.4, 0.32, 0.27), roughness: 0.85 });
  M.walnutPanelLight = std({ ...pbr('walnut_veneer', { size: 1.4 }), color: lin(0.78, 0.68, 0.6), roughness: 0.85 });

  // ---- upper floor ----
  M.woodGrey = std({ ...pbr('laminate_floor_02', { size: 2.4 }), color: lin(0.6, 0.53, 0.47), roughness: 1 });
  M.woodGreyPanel = std({ ...pbr('laminate_floor_02', { size: 2.0, rotation: Math.PI / 2 }), color: lin(0.62, 0.56, 0.5), roughness: 0.9 });
  M.stoneWood = std({ ...pbr('laminate_floor_02', { size: 3.2, rotation: Math.PI / 2 }), color: lin(0.5, 0.48, 0.47), roughness: 0.85,
    normalScale: new THREE.Vector2(0.35, 0.35) }); // soft relief: full-strength plank bevels catch light like a white seam
  // bold dark veining like the bath floor in the footage (contrast pushed on the greyscaled source)
  M.marbleWhite = std({ ...pbrGrey('Marble012', { size: 1.6, contrast: 2.2, brightness: 1.12 }), color: lin(1.06, 1.06, 1.05), roughness: 0.45, envMapIntensity: 1.2 });
  M.porcelain = std({ map: porcelainTiles(), roughness: 0.75, color: lin(0.72, 0.7, 0.67) });
  M.outdoorFabric = std({ ...pbr('Fabric030', { size: 0.5 }), color: lin(1.15, 1.15, 1.15), roughness: 1 });
  M.teak = std({ ...pbr('walnut_veneer', { size: 1.0, rotation: Math.PI / 2 }), color: lin(1.1, 0.82, 0.6), roughness: 0.8 });
  M.stripes = std({ map: stripes(), roughness: 1 });
  M.mirror = std({ color: 0xe8ecee, metalness: 1, roughness: 0.04 });
  M.bronzeGlass = std({ color: 0x5d4f42, roughness: 0.08, transparent: true, opacity: 0.45, depthWrite: false });
  M.whiteSolid = std({ color: 0xf4f3f0, roughness: 0.25 });

  // ---- paint & plaster ----
  M.plaster = std({ color: 0xefede8, roughness: 0.92, envMapIntensity: 0.6 });
  // ceilings get a little self-illumination to stand in for light bounced off the floor (no realtime GI)
  M.ceiling = std({ color: 0xf3f2ef, roughness: 0.95, envMapIntensity: 0.6, emissive: 0xf1efe9, emissiveIntensity: 0.32 });
  M.shadowGap = std({ color: 0x1b1b1c, roughness: 0.9 });
  M.cabinetDark = std({ color: 0x3a3a3b, roughness: 0.55, metalness: 0.05 });
  M.cabinetGrey = std({ color: 0x5c5c5c, roughness: 0.5 });
  M.lacquerWhite = std({ color: 0xf2f1ee, roughness: 0.35 });

  // ---- exterior ----
  M.wallExt = std({ color: 0x35373a, roughness: 0.75, metalness: 0.1 });
  M.roof = std({ color: 0x2b2c2e, roughness: 0.95 });
  M.soffit = std({ color: 0x3f4043, roughness: 0.85 });
  M.grass = std({ ...pbr('leafy_grass', { size: 3.5 }), color: lin(0.66, 1.12, 0.42), roughness: 1 });
  lawnStripes(M.grass);
  const hedgeMap = hedgeTexture();
  hedgeMap.repeat.set(0.9, 0.9);
  M.hedge = std({ map: hedgeMap, roughness: 1, color: lin(0.85, 0.95, 0.82) });
  M.trunk = std({ color: 0x6b5d50, roughness: 1 });
  M.poolTile = std({ color: 0x7fc6cf, roughness: 0.35 });
  M.poolCoping = M.paver;
  const wn = waterNormal();
  wn.repeat.set(0.25, 0.25);
  M.water = phys({ color: 0x1f9fb4, roughness: 0.04, metalness: 0, transmission: 0, transparent: true, opacity: 0.62,
    normalMap: wn, normalScale: new THREE.Vector2(0.25, 0.25), envMapIntensity: 1.3, clearcoat: 1, clearcoatRoughness: 0.05 });

  // ---- glass & metal ----
  // Fresnel glass: nearly clear when looked through, reflective at grazing angles — the look of real
  // glazing without "transmission", which re-renders the whole scene and cost ~45% of each frame.
  M.glass = fresnelGlass(std({ color: 0xe9f0f1, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.08,
    envMapIntensity: quality === 'high' ? 2.2 : 2.0, depthWrite: false, side: THREE.DoubleSide }));
  const flutes = flutedNormal();
  flutes.repeat.set(1 / 0.025, 1);
  M.glassReeded = std({ color: 0xd7e6e8, roughness: 0.25, transparent: true, opacity: 0.55, normalMap: flutes,
    normalScale: new THREE.Vector2(1.4, 1.4), depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.2 });
  M.glassTint = std({ color: 0x2f7d63, roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  M.glassTable = std({ color: 0x9fb2b1, roughness: 0.03, transparent: true, opacity: 0.35, depthWrite: false, envMapIntensity: 1.5 });
  M.frame = std({ color: 0x141517, roughness: 0.45, metalness: 0.5 });
  M.metalBlack = std({ color: 0x111111, roughness: 0.4, metalness: 0.6 });
  M.brass = std({ color: 0xb8915a, roughness: 0.3, metalness: 1 });
  M.chrome = std({ color: 0xdddddd, roughness: 0.12, metalness: 1 });
  M.blackGlass = std({ color: 0x0b0c0e, roughness: 0.05, metalness: 0.3 });

  // ---- fabrics ----
  M.fabricGrey = std({ ...pbr('Fabric030', { size: 0.5 }), color: lin(2.1, 2.08, 2.02), roughness: 1 });
  M.fabricBeige = std({ ...pbr('Fabric030', { size: 0.5 }), color: lin(3.0, 2.55, 1.95), roughness: 1 });
  M.fabricDark = std({ ...pbr('Fabric030', { size: 0.5 }), color: lin(0.62, 0.62, 0.64), roughness: 1 });
  M.boucle = std({ ...pbr('Fabric062', { size: 0.25 }), color: lin(0.98, 0.9, 0.76), roughness: 1 });
  M.navy = std({ ...pbr('Fabric030', { size: 0.5 }), color: lin(0.5, 0.75, 1.65), roughness: 1 });
  M.leatherBlack = std({ color: 0x1c1c1d, roughness: 0.55 });
  M.rug = std({ ...pbr('Carpet016', { size: 1.2 }), roughness: 1, color: lin(1.08, 1.06, 1.02) });
  M.rugMaze = std({ map: mazeRug(), roughness: 1 });

  // ---- light & media ----
  M.led = std({ color: 0xfff2dc, emissive: 0xffd7a0, emissiveIntensity: 3.0 });
  M.downlight = std({ color: 0xffffff, emissive: 0xfff0d8, emissiveIntensity: 4.0 });
  M.downlightWarm = std({ color: 0xffe9c8, emissive: 0xffc98a, emissiveIntensity: 2.6 });
  M.pendantGlass = std({ color: 0xfff7ea, emissive: 0xffe2b8, emissiveIntensity: 1.6, roughness: 0.4, transparent: true, opacity: 0.92 });
  M.skylight = std({ color: 0xe6f3ff, emissive: 0xdcefff, emissiveIntensity: 1.5 });
  const scr = screenImage();
  M.screen = std({ map: scr, emissiveMap: scr, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6 });
  M.art1 = std({ map: abstractArt(7), roughness: 0.9 });
  M.art2 = std({ map: abstractArt(19, 512, 512), roughness: 0.9 });
  M.art3 = std({ map: abstractArt(33, 384, 512), roughness: 0.9 });
  M.white = std({ color: 0xf1efea, roughness: 0.6 });
  M.whiteStone = std({ ...pbr('Travertine009', { size: 0.8 }), color: lin(1.25, 1.24, 1.22), roughness: 1 });
  M.plantPot = std({ color: 0xe9e6e0, roughness: 0.7 });

  // shadows from glass/LEDs look wrong; flag them
  for (const k of ['glass', 'glassReeded', 'glassTint', 'glassTable', 'bronzeGlass', 'led', 'downlight', 'downlightWarm', 'skylight', 'pendantGlass', 'water']) {
    M[k].userData.noShadow = true;
  }
  return M;
}

/** Raise glass opacity towards grazing angles (Schlick-style), so reflections show at the edges. */
function fresnelGlass(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
      float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 4.0);
      gl_FragColor.a = mix(gl_FragColor.a, 0.82, fres);`);
  };
  material.customProgramCacheKey = () => 'fresnelGlass';
  return material;
}

/**
 * Mowing stripes (alternating 1.6 m bands, light/dark like a freshly cut lawn) plus slow
 * large-scale colour variation so the grass texture never looks tiled. Shader-only, free at runtime.
 */
function lawnStripes(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLawnPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLawnPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLawnPos;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float band = smoothstep(0.42, 0.58, abs(fract(vLawnPos.x / 3.2) - 0.5) * 2.0);
        float stripe = mix(0.86, 1.08, band);
        float macro = 0.92 + 0.08 * sin(vLawnPos.x * 0.11 + vLawnPos.z * 0.07) * sin(vLawnPos.z * 0.09 - vLawnPos.x * 0.05);
        diffuseColor.rgb *= stripe * macro;`);
  };
  material.customProgramCacheKey = () => 'lawnStripes';
}

export let M = null;
export function initMaterials(quality = 'high') {
  M = create(quality);
  return M;
}
export const mat = (name, fallback = 'plaster') => M[name] || M[fallback];
