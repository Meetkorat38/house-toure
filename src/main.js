import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { EffectComposer, RenderPass, EffectPass, SMAAEffect, BloomEffect, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import house from './data/house.json';
import { initMaterials } from './world/materials.js';
import { setMaxAnisotropy, setTextureTier } from './world/textures.js';
import { buildHouse } from './world/build.js';
import { buildExterior } from './world/exterior.js';
import { buildFurnishings } from './world/furnishings.js';
import { Moods } from './world/moods.js';
import { mergeStatic } from './world/merge.js';
import { Input } from './controls/input.js';
import { Player } from './controls/player.js';
import { Navigator } from './controls/nav.js';
import { FloorTarget } from './controls/target.js';
import { Tour, STOPS } from './controls/tour.js';
import { Hud } from './ui/hud.js';

const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches;
const quality = params.get('quality') || (isTouch ? 'low' : 'high');
const HIGH = quality === 'high';
const debug = params.has('debug');
document.body.classList.toggle('touch', isTouch);
const $ = (id) => document.getElementById(id);
const startMood = ['day', 'golden', 'evening'].includes(params.get('mood')) ? params.get('mood') : 'golden';
const marks = [];
const mark = (label) => marks.push([label, Math.round(performance.now())]);
mark('start');

// ---------- renderer ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
const basePR = Math.min(window.devicePixelRatio, HIGH ? 1.75 : 1.25);
renderer.setPixelRatio(basePR);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in the post chain
renderer.shadowMap.enabled = HIGH;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // static scene: updated on demand
window.addEventListener('model-loaded', () => { renderer.shadowMap.needsUpdate = true; });
setMaxAnisotropy(Math.min(HIGH ? 8 : 4, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(new THREE.Color(0xc4cbcf), 90, 300);
scene.background = new THREE.Color(0xc4cbcf);
// near 0.12 m / far 380 m: ~4x better depth precision than 0.05/500, which stops distant
// surfaces that sit a few millimetres apart (paving vs lawn, light housings vs ceiling) from flickering
const camera = new THREE.PerspectiveCamera(isTouch ? 72 : 68, window.innerWidth / window.innerHeight, 0.12, 380);
scene.userData.camera = camera;

// ---------- loading progress ----------
const startBtn = $('start-btn'), startTourBtn = $('start-tour-btn');
let loaded = false;
let compiling = Promise.resolve(); // shader compile, started as soon as the sky lighting arrives
THREE.DefaultLoadingManager.onProgress = (_url, done, total) => {
  if (loaded) return;
  const p = Math.round((done / Math.max(1, total)) * 100);
  $('load-bar').style.width = `${p}%`;
  $('load-label').textContent = `Loading materials… ${p}%`;
};
THREE.DefaultLoadingManager.onLoad = async () => {
  if (loaded) return;
  $('load-bar').style.width = '100%';
  $('load-label').textContent = 'Preparing scene…';
  mark('downloads done');
  await compiling; // usually already finished: it overlapped the texture downloads
  renderer.shadowMap.needsUpdate = true;
  loaded = true;
  $('load-label').textContent = '';
  $('loader').classList.add('done');
  startBtn.disabled = startTourBtn.disabled = false;
};

// ---------- lights (values are driven by the mood presets) ----------
const sun = new THREE.DirectionalLight(0xfff4e6, 1.1);
sun.position.set(30, 48, -22);
sun.target.position.set(18, 0, 6);
sun.castShadow = HIGH;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 160 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.025;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xdfe7ee, 0x6e6252, 0.35);
scene.add(hemi);
const rects = [];
if (HIGH) {
  RectAreaLightUniformsLib.init();
  const windowLight = (x, z, w, h, ry, intensity = 2.2) => {
    const l = new THREE.RectAreaLight(0xeef3f7, intensity, w, h);
    l.position.set(x, h / 2 + 0.1, z);
    l.rotation.y = ry; // emits along its -Z
    scene.add(l);
    rects.push(l);
  };
  windowLight(14.5, 0.25, 10, 3.2, Math.PI);
  windowLight(24, 0.25, 6.8, 3.2, Math.PI, 1.8);
  windowLight(4.4, 0.25, 7.6, 3.2, Math.PI, 1.8);
  windowLight(18, 16.7, 6, 3.4, 0, 1.4);
}

// ---------- world ----------
setTextureTier(quality); // phones load the half-size texture set
const M = initMaterials(quality);
mark('materials');
const world = buildHouse(house);
mark('house');
world.house = house;
scene.add(world.group);
const exterior = buildExterior(house, world.colliders, { quality });
mark('exterior');
scene.add(exterior.group);
const furnishings = buildFurnishings(world.colliders, { upper: world.upperEnabled });
mark('furnishings');
scene.add(furnishings);
// static scene: bake furniture + garden into one mesh per material (hundreds of draw calls → dozens)
// (the garden is left unmerged: trees are spread out, so per-object culling helps more there)
const mergeStats = params.has('nomerge') ? [] : [mergeStatic(furnishings)];
mark('merge');
if (!renderer.shadowMap.enabled) scene.traverse((o) => { o.castShadow = false; });

const moods = new Moods({
  scene, renderer, sun, hemi, rects, world, quality,
  onLoading: (on) => $('mood').classList.toggle('loading', on),
  initial: startMood,
});
moods.apply(moods.state);
const startSky = moods.loadParts(startMood);
scene.backgroundRotation.set(0, moods.rotation(startMood), 0);
scene.environmentRotation.set(0, moods.rotation(startMood), 0);
startSky.bg.then((bg) => { scene.background = bg; });
compiling = startSky.env.then((env) => {
  scene.environment = env;
  // golden hour aims the sun at the sky photo's sun, which is only known once the HDR is in
  moods.state = moods.snapshotPreset(startMood);
  moods.apply(moods.state);
  renderer.shadowMap.needsUpdate = true;
  mark('sky ready');
  // Shader programs depend on which maps a material has, not on the pixels, and on the
  // environment map being present — so compile now, in parallel with the texture downloads.
  return renderer.compileAsync(scene, camera).catch(() => {}).then(() => mark('shaders compiled'));
});

// ---------- post-processing: AO + bloom + AA + neutral tone mapping ----------
const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
composer.addPass(new RenderPass(scene, camera));
const ao = new N8AOPostPass(scene, camera, window.innerWidth, window.innerHeight);
Object.assign(ao.configuration, {
  aoRadius: 0.8, distanceFalloff: 0.6, intensity: 2.2, color: new THREE.Color(0x000000),
  halfRes: !HIGH, depthAwareUpsampling: true, transparencyAware: false, gammaCorrection: false,
});
ao.setQualityMode(HIGH ? 'Medium' : 'Performance');
composer.addPass(ao);
const effects = [new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL })];
if (HIGH) effects.unshift(new BloomEffect({ luminanceThreshold: 1.4, luminanceSmoothing: 0.2, intensity: 0.35, mipmapBlur: true }));
effects.push(new SMAAEffect());
composer.addPass(new EffectPass(camera, ...effects));

// ---------- navigation, player, input ----------
const nav = new Navigator(world);
mark('navgrid');
const input = new Input(canvas, { joystickEl: $('joystick'), knobEl: $('knob'), isTouch });
const player = new Player(camera, world, house.spawn);
const target = new FloorTarget(scene, camera, world, nav);

const hud = new Hud(world, house, {
  onMapTap: (x, z) => walkTo(x, z, { fast: true, level: hud.viewLevel }),
});

let captionTimer = 0;
const tour = new Tour(player, nav, {
  onStop: (stop, playing, leaving) => {
    $('place-select').value = stop.id;
    if (leaving) { hud.caption(null, false); return; }
    hud.caption(stop);
    captionTimer = playing ? 0 : 4.5;
  },
  onState: (playing) => {
    $('tour-btn').classList.toggle('playing', playing);
    $('tour-btn').setAttribute('aria-label', playing ? 'Pause guided tour' : 'Play guided tour');
    if (!playing) hud.caption(null, false);
  },
});

function walkTo(x, z, { fast = false, level = player.level } = {}) {
  const path = nav.findPath({ x: player.pos.x, z: player.pos.y, level: player.level }, { x, z, level });
  if (!path) return false;
  tour.stop();
  hud.caption(null, false);
  const last = path[path.length - 1];
  player.glide(path, { turn: true, speedMax: fast ? 3.0 : 1.9 });
  target.click(last, house.levels[level].floor);
  hud.hideHint();
  return true;
}

input.on('tap', ({ x, y }) => {
  const p = target.pick(x, y, player.feet);
  if (p) walkTo(p.x, p.z);
});
input.on('hover', (pt) => target.hover(pt ? target.pick(pt.x, pt.y, player.feet) : null, player.feet));
input.on('manual', () => { tour.stop(); target.clearDest(); hud.hideHint(); });
let unlockedAt = 0;
input.on('gameMode', (on) => {
  document.body.classList.toggle('game', on);
  document.body.classList.toggle('locked', input.locked);
  if (!input.locked) unlockedAt = performance.now();
  $('game-toggle').checked = on;
  target.hover(null);
});

// ---------- on-screen arrow buttons (hold to walk / turn) ----------
for (const b of document.querySelectorAll('#dpad button')) {
  const dir = b.dataset.dir;
  const off = () => { input.setPad(dir, false); b.classList.remove('on'); };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    input.setPad(dir, true);
    b.classList.add('on');
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, off);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------- compact layout for narrow screens (phones, small windows) ----------
function updateLayout() {
  const compact = isTouch || window.innerWidth <= 640 || window.innerHeight <= 480;
  document.body.classList.toggle('compact', compact);
  if (!compact) document.body.classList.remove('map-open');
  hud.resize();
}
updateLayout();
$('map-btn').addEventListener('click', () => {
  document.body.classList.toggle('map-open');
  hud.resize();
});

// ---------- HUD wiring ----------
const select = $('place-select');
for (const s of STOPS) select.add(new Option(s.name, s.id));
select.addEventListener('change', () => {
  tour.stop();
  tour.goTo(STOPS.findIndex((s) => s.id === select.value), { fast: true });
  select.blur();
});
$('prev-btn').addEventListener('click', () => { tour.stop(); tour.prev(); });
$('next-btn').addEventListener('click', () => { tour.stop(); tour.next(); });
$('tour-btn').addEventListener('click', () => (tour.playing ? tour.stop() : tour.play()));

for (const b of document.querySelectorAll('#mood button')) {
  b.classList.toggle('on', b.dataset.mood === startMood);
  b.addEventListener('click', () => {
    document.querySelectorAll('#mood button').forEach((x) => x.classList.toggle('on', x === b));
    moods.set(b.dataset.mood);
  });
}

$('gyro-btn').addEventListener('click', async () => {
  const btn = $('gyro-btn');
  if (input.gyro || btn.classList.contains('on')) {
    input.disableGyro();
    btn.classList.remove('on');
    return;
  }
  const ok = await input.enableGyro();
  btn.classList.toggle('on', ok);
  if (!ok) hud.hint('Motion sensor isn’t available on this device.', 2500);
});

// ---------- start / pause ----------
const intro = $('intro'), hudEl = $('hud');
let started = false;
function start({ withTour = false } = {}) {
  if (!loaded) return;
  intro.classList.add('hidden');
  hudEl.classList.remove('hidden');
  input.enabled = true;
  hud.resize();
  input.setGameMode($('game-toggle').checked); // on by default (desktop); the menu checkbox can turn it off
  if (!started) {
    started = true;
    player.teleport(house.spawn.x, house.spawn.z, 0, house.spawn.yaw ?? 0, 0.04);
    if (!withTour) {
      hud.hint(isTouch
        ? '<b>Joystick</b> to walk · <b>drag</b> to look<br><b>Tap the floor</b> to walk there'
        : input.gameMode
          ? '<b>Move the mouse</b> to look · <b>WASD</b> or the arrows to walk<br><b>Esc</b> frees the mouse · <b>G</b> leaves game mode'
          : '<b>Click the floor</b> to walk there<br><b>Drag</b> to look around · <b>WASD</b> to walk', 5600);
    }
  }
  if (withTour) tour.play();
}
function pause() {
  input.enabled = false;
  input.reset();
  if (input.locked) document.exitPointerLock(); // keep game mode on; just free the mouse
  tour.stop();
  startBtn.textContent = 'Continue';
  intro.classList.remove('hidden');
}
startBtn.addEventListener('click', () => start());
startTourBtn.addEventListener('click', () => start({ withTour: true }));
$('menu-btn').addEventListener('click', pause);
window.addEventListener('keydown', (e) => {
  // Esc first frees a captured mouse (browser default); a further Esc opens the menu
  if (e.code === 'Escape' && input.enabled && !input.locked && performance.now() - unlockedAt > 400) pause();
});

window.addEventListener('resize', () => {
  updateLayout();
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- loop ----------
const clock = new THREE.Clock();
const debugEl = $('debug');
let frames = 0, fpsT = 0, fps = 0, idleT = 0.6, syncT = 0;

// Adaptive resolution: keep motion smooth (~40+ fps) by trading a little sharpness on slower GPUs.
// With hysteresis: drop quickly when slow, but only climb back after a long stretch of headroom —
// flip-flopping between sizes re-allocates the render targets and reads as a flicker.
let resScale = 1, perfAcc = 0, perfFrames = 0, lastFrame = performance.now(), goodWindows = 0, lastChange = 0;
function adaptResolution() {
  const now = performance.now(), ft = now - lastFrame;
  lastFrame = now;
  if (document.hidden || ft > 250 || moods.busy) return; // ignore stalls, tab switches, fades
  perfAcc += ft; perfFrames++;
  if (perfAcc < 1500) return;
  const avg = perfAcc / perfFrames;
  perfAcc = perfFrames = 0;
  goodWindows = avg < 12 ? goodWindows + 1 : 0;
  let next = resScale;
  if (avg > 26 && resScale > 0.55) next = Math.max(0.55, +(resScale - 0.1).toFixed(2));
  else if (goodWindows >= 5 && resScale < 1 && now - lastChange > 15000) next = Math.min(1, +(resScale + 0.1).toFixed(2));
  if (next !== resScale) {
    lastChange = now;
    goodWindows = 0;
    resScale = next;
    renderer.setPixelRatio(basePR * resScale);
    composer.setSize(window.innerWidth, window.innerHeight);
  }
}

function idleCamera(dt) {
  idleT += dt * 0.04;
  const cx = 20, cz = -2;
  camera.position.set(cx + Math.sin(idleT) * 30, 9, cz - Math.cos(idleT) * 26);
  camera.lookAt(cx, 2.2, cz + 5);
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (input.enabled) {
    player.update(dt, input, input.gyro);
    tour.update(dt);
    target.update(dt, !!player.auto);
    hud.update(dt, player);
    if (captionTimer > 0 && (captionTimer -= dt) <= 0) hud.caption(null, false);
    if ((syncT += dt) > 0.5 && document.activeElement !== select && !player.auto) {
      syncT = 0;
      select.value = STOPS[tour.currentIndex()].id;
    }
  } else if (!started) {
    idleCamera(dt);
  }
  moods.update(dt);
  exterior.update(dt);
  composer.render(dt);
  if (started) adaptResolution();

  if (debug) {
    frames++; fpsT += dt;
    if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
    debugEl.textContent = `${fps} fps · ${quality} · res ${Math.round(resScale * 100)}%\n` +
      `x ${player.pos.x.toFixed(1)}  z ${player.pos.y.toFixed(1)}  yaw ${player.yaw.toFixed(2)}`;
  }
});

if (debug) Object.assign(window, { marks, mergeStats, scene, player, world, THREE, M, ao, composer, camera, nav, tour, moods, target, input, hud });
