/* World Editor — REAL 3D preview (THREE.js, game assets only).
 *
 * Replaces the old flat 2D-canvas "3D preview". Everything rendered here
 * is sourced from the game repos; nothing is invented to fill a gap:
 *
 * - Props/trees: real GLBs from selsocsoc assets/environment-props/
 *   (bundled under assets/props/ and assets/trees/, sha256-verified),
 *   placed at the layout's real x/y/z with rotation.y = -rotY * PI/180
 *   (the game's own conversion, world-layout.js radians()).
 * - NPC spawns: the game's roster figure, same construction as NPC
 *   Showcase viewer3d.js — capsule body (0.29/0.54 at 0.66), coin head
 *   at 1.66, face circle 0.30 at z 0.083, outfit wraparound with
 *   offset.x 0.25 (FRONT at u 0.5), real per-NPC skin tones, real
 *   held/hat GLBs at the real anchors (held (0.46, 0.64, 0.14),
 *   head (0, 1.93, 0)). Face/outfit PNGs load from the canonical
 *   raw GitHub URL (58 MB — too large to bundle); a failed texture
 *   leaves the face/outfit off, never a painted substitute.
 * - Town buildings: addCottage/addTownHall/pavilion/district-marker/
 *   garden/pond/path/string-light/lantern constructions are ported
 *   VERBATIM from selsocsoc assets/world-expansion.js and
 *   assets/environment-upgrade.js (dimensions, colours, sag, bulb
 *   counts all as written there). Two disclosed approximations:
 *   (a) outskirts cottage wall colours come from the game's 12-colour
 *   COTTAGES palette in layout order — the palette is real, but the
 *   per-cottage assignment is not in readable code; (b) the town sky/
 *   fog colour is NOT set anywhere in readable game code (the bundle
 *   sets no scene.background), so the preview uses a neutral pale
 *   fog colour with the game's real fog distances (near 36, far 112).
 * - Labelled markers (flat ring + floating label, never a fake
 *   building): base cottages (plaza — base-cottage body is 2.4 wide
 *   in the bundle matcher, full dimensions not in readable code),
 *   the town gate (base-gate, not fence-gate.glb — not assumed),
 *   minigame anchors, easels (wood/canvas colours known, no dims),
 *   and any type with no game source at all.
 *
 * View-only: editing stays on the 2D map. The inline editor script
 * hands this module the currently visible objects (filters already
 * applied) via window.__worldPreviewData and window.__worldPreview.
 */
import * as THREE from './three.module.js';
import { GLTFLoader } from './GLTFLoader.js';

const RAW_GAME = 'https://raw.githubusercontent.com/Kmberry1989/selsocsoc/main/';
const MANIFEST_URL = RAW_GAME + 'assets/npc/manifest.json';

const SKIN = {
  'mayor-mayor': 0xc98f66, 'gideon': 0xb0825e, 'lyla-lens': 0xb97958,
  'chip-chance': 0x9a684a, 'barnaby-bargain': 0xd09a70, 'pip-parade': 0xc88965,
  'agnes-alley': 0xaa765b, 'dottie-daly': 0xe0ad82, 'peggy-plank': 0xb77b57,
  'mr-buck-coinsworth': 0xd8a279, 'fern-bramble': 0x936246,
  'stanley-stamp': 0xc58b66, 'bobby-gill': 0xb88361,
};
const NAME_TO_ID = {
  'Mayor Mayor': 'mayor-mayor', 'Gideon': 'gideon', 'Lyla Lens': 'lyla-lens',
  'Chip Chance': 'chip-chance', 'Barnaby Bargain': 'barnaby-bargain',
  'Pip Parade': 'pip-parade', 'Agnes Alley': 'agnes-alley', 'Dottie Daly': 'dottie-daly',
  'Peggy Plank': 'peggy-plank', 'Mr. Buck Coinsworth': 'mr-buck-coinsworth',
  'Fern Bramble': 'fern-bramble', 'Stanley Stamp': 'stanley-stamp', 'Bobby Gill': 'bobby-gill',
};
const HELD_GLB = {
  'mayor-mayor': 'gavel.glb', 'gideon': 'flag.glb', 'lyla-lens': 'camera.glb',
  'chip-chance': 'die.glb', 'barnaby-bargain': 'coin.glb', 'pip-parade': 'balloon.glb',
  'agnes-alley': 'yarn.glb', 'dottie-daly': 'scroll.glb', 'peggy-plank': 'hammer.glb',
  'mr-buck-coinsworth': 'goldbar.glb', 'fern-bramble': 'flower.glb',
  'stanley-stamp': 'envelope.glb', 'bobby-gill': 'rod.glb',
};
const HAT_GLB = {
  'mayor-mayor': 'tophat.glb', 'gideon': 'tourcap.glb', 'fern-bramble': 'strawhat.glb',
  'stanley-stamp': 'mailcap.glb', 'bobby-gill': 'buckethat.glb',
};
// Game's 12 outskirts-cottage wall colours, world-expansion.js COTTAGES.
const COTTAGE_COLORS = [
  0xd99678, 0xe6bd68, 0x8eb8cd, 0xb59fd0, 0x91b977, 0xd9a0ad,
  0xb7a2d7, 0xe2bb70, 0x87b6ac, 0xd78874, 0x86aec8, 0xd5aa70,
];
// Game town paths, world-expansion.js PATH_SEGMENTS.
const PATH_SEGMENTS = [
  { a: [0, -29.7], b: [0, 37], width: 2.15 }, { a: [-36, 0], b: [36, 0], width: 2.15 },
  { a: [-7, 0], b: [-25, -16], width: 1.5 }, { a: [7, 0], b: [24, -19], width: 1.5 },
  { a: [-7, 0], b: [-25, 19], width: 1.5 }, { a: [7, 0], b: [24, 21], width: 1.5 },
  { a: [0, 7.5], b: [-11.25, 7.5], width: 1.35 }, { a: [0, 4.8], b: [13.35, 4.8], width: 1.35 },
  { a: [0, 9], b: [2.8, 9], width: 1.15 },
];
const DISTRICT_MARKERS = [
  [-13, -10, 0xd9826c], [14, -9, 0xe1ba63], [-14, 12, 0x78aeb7], [14, 13, 0xa78bc2],
];
const FLOWER_COLORS = [0xf3d067, 0xe87b80, 0xa78bc8];
const PROP_GLBS = new Set(['barrel-stack', 'birdbath', 'bush-round', 'crate-stack', 'fence-gate',
  'fence-segment', 'flower-patch', 'lantern-post', 'mailbox', 'market-cart', 'park-bench',
  'picket-fence', 'picnic-table', 'planter-box', 'rock-cluster', 'signpost',
  'stepping-stones', 'stone-wall', 'well']);
const TREE_GLBS = new Set(['tree-apple', 'tree-birch', 'tree-maple', 'tree-oak', 'tree-pine', 'tree-willow']);

const canvas = document.getElementById('preview3d');
let renderer = null, scene = null, camera = null, worldGroup = null, selectionRing = null;
let orbit = { target: new THREE.Vector3(0, 0, 0), radius: 55, theta: -0.7, phi: 0.95 };
let lastSignature = '', buildGen = 0, rafRunning = false;
let npcManifest = null, manifestTried = false;

const glbLoader = new GLTFLoader();
const glbCache = new Map();
const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin('anonymous');
const texCache = new Map();
function loadTex(url) {
  if (!texCache.has(url)) {
    const t = texLoader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(url, t);
  }
  return texCache.get(url);
}
function loadGLB(file, dir) {
  const key = dir + '/' + file;
  if (!glbCache.has(key)) {
    const local = 'assets/' + dir + '/' + file;
    const remote = RAW_GAME + 'assets/environment-props/' + dir + '/' + file;
    glbCache.set(key, new Promise((resolve, reject) => {
      glbLoader.load(local, (g) => resolve(g.scene), undefined, () => {
        glbLoader.load(remote, (g) => resolve(g.scene), undefined, reject);
      });
    }));
  }
  return glbCache.get(key);
}
function loadAccessoryGLB(file) {
  if (!glbCache.has('acc/' + file)) {
    const local = 'assets/accessories/' + file;
    const remote = RAW_GAME + 'assets/npc-accessories/' + file;
    glbCache.set('acc/' + file, new Promise((resolve, reject) => {
      glbLoader.load(local, (g) => resolve(g.scene), undefined, () => {
        glbLoader.load(remote, (g) => resolve(g.scene), undefined, reject);
      });
    }));
  }
  return glbCache.get('acc/' + file);
}

function std(color, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}
function mesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function labelSprite(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 112;
  const ctx = c.getContext('2d');
  ctx.font = '700 44px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(20,26,22,0.85)';
  const w = Math.min(500, ctx.measureText(text).width + 48);
  ctx.beginPath(); ctx.roundRect((512 - w) / 2, 14, w, 84, 20); ctx.fill();
  ctx.fillStyle = '#f5f2e8';
  ctx.fillText(text, 256, 58);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(4.4, 0.96, 1);
  sp.renderOrder = 10;
  return sp;
}
function marker(label, radius, y = 0.06) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(0.4, radius - 0.18), radius, 40),
    new THREE.MeshBasicMaterial({ color: 0xd5743f, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = y; g.add(ring);
  const sp = labelSprite(label); sp.position.y = Math.max(1.6, radius + 1.2); g.add(sp);
  return g;
}

// --- Game town constructions, verbatim from world-expansion.js ---
function addCottage(group, color) {
  const cottage = new THREE.Group();
  const wall = std(color), trim = std(0x6f5146, 0.82);
  const body = mesh(new THREE.BoxGeometry(2.8, 1.85, 2.45), wall, 0, 0.93, 0);
  body.name = 'CottageBody';
  const roof = mesh(new THREE.ConeGeometry(2.02, 1.15, 4), trim, 0, 2.43, 0);
  roof.rotation.y = Math.PI / 4; roof.scale.z = 0.76;
  cottage.add(body, roof,
    mesh(new THREE.BoxGeometry(0.62, 1.15, 0.09), std(0x42666c, 0.75), 0, 0.58, 1.27),
    mesh(new THREE.BoxGeometry(1.25, 0.12, 0.5), std(0xb7a78b, 1), 0, 0.06, 1.45));
  [-0.78, 0.78].forEach((wx) => {
    cottage.add(mesh(new THREE.BoxGeometry(0.55, 0.62, 0.08), trim, wx, 1.08, 1.26));
    cottage.add(mesh(new THREE.BoxGeometry(0.42, 0.49, 0.09), std(0x9ed0dd, 0.35), wx, 1.08, 1.31));
  });
  group.add(cottage);
  return cottage;
}
function addTownHall(group) {
  const hall = new THREE.Group();
  const wall = std(0xd9c49b), trim = std(0x684e43, 0.84), roofMat = std(0x78908a, 0.82);
  const body = mesh(new THREE.BoxGeometry(6.2, 2.9, 4.7), wall, 0, 1.45, 0);
  body.name = 'TownHallBody';
  const roof = mesh(new THREE.ConeGeometry(4.2, 1.55, 4), roofMat, 0, 3.75, 0);
  roof.rotation.y = Math.PI / 4; roof.scale.z = 0.78;
  const tower = mesh(new THREE.BoxGeometry(1.55, 1.7, 1.55), wall, 0, 4.35, 0.15);
  tower.name = 'TownHallTower';
  const towerRoof = mesh(new THREE.ConeGeometry(1.25, 1.25, 4), roofMat, 0, 5.65, 0.15);
  towerRoof.rotation.y = Math.PI / 4;
  hall.add(body, roof, tower, towerRoof,
    mesh(new THREE.BoxGeometry(1.12, 1.65, 0.12), trim, 0, 0.83, 2.39),
    mesh(new THREE.BoxGeometry(2.15, 0.14, 0.72), std(0xb6a485, 1), 0, 0.07, 2.7));
  [-2, -1, 1, 2].forEach((wx) => {
    hall.add(mesh(new THREE.BoxGeometry(0.72, 0.82, 0.1), trim, wx, 1.58, 2.38));
    hall.add(mesh(new THREE.BoxGeometry(0.56, 0.66, 0.11), std(0xa9d1d5, 0.35), wx, 1.58, 2.44));
  });
  group.add(hall);
  return hall;
}
function addPavilion(group) {
  const pavilion = new THREE.Group();
  pavilion.add(mesh(new THREE.CylinderGeometry(3.1, 3.35, 0.35, 10), std(0xd4bd8c, 0.95), 0, 0.1, 0));
  const roof = mesh(new THREE.ConeGeometry(3.4, 1.2, 8), std(0xb96050, 0.8), 0, 3.2, 0);
  pavilion.add(roof);
  for (let i = 0; i < 8; i += 1) {
    const a = i / 8 * Math.PI * 2;
    pavilion.add(mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.8, 7), std(0x775540), Math.cos(a) * 2.55, 1.55, Math.sin(a) * 2.55));
  }
  group.add(pavilion);
  return pavilion;
}
function addDistrictMarker(group, color) {
  const poleMat = std(0x654a3c);
  group.add(mesh(new THREE.CylinderGeometry(0.07, 0.085, 1.8, 8), poleMat, 0, 0.9, 0));
  group.add(mesh(new THREE.BoxGeometry(1.25, 0.48, 0.12), std(color, 0.84), 0, 1.45, 0));
  group.add(mesh(new THREE.ConeGeometry(0.13, 0.24, 6), poleMat, 0, 1.94, 0));
}
function addGardenBed(group) {
  group.add(mesh(new THREE.BoxGeometry(1.75, 0.14, 1.7), std(0xb39361, 0.95), 0, 0.07, 0));
  group.add(mesh(new THREE.BoxGeometry(1.5, 0.17, 1.45), std(0x76543b, 1), 0, 0.13, 0));
}
function addGardenSign(group) {
  const edging = std(0xb39361, 0.95);
  group.add(mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.1, 7), edging, 0, 0.55, 0));
  group.add(mesh(new THREE.BoxGeometry(1.1, 0.4, 0.1), std(0x6f955e), 0, 1, 0));
}
function catenary(a, b, t) {
  return new THREE.Vector3(
    THREE.MathUtils.lerp(a.x, b.x, t),
    THREE.MathUtils.lerp(a.y, b.y, t) - Math.sin(Math.PI * t) * 0.72,
    THREE.MathUtils.lerp(a.z, b.z, t));
}

// Shared geometries/materials for the many small ground items.
const SHARED = {
  grassGeo: new THREE.ConeGeometry(0.045, 0.26, 3),
  grassMat: std(0x4d8a51, 1),
  flowerGeo: new THREE.IcosahedronGeometry(0.085, 0),
  flowerMats: FLOWER_COLORS.map((c) => std(c, 0.86)),
  trunkGeo: new THREE.CylinderGeometry(0.18, 0.26, 1.7, 7),
  trunkMat: std(0x78513b, 0.94),
  crownGeo: new THREE.IcosahedronGeometry(1.05, 1),
  crownMat: std(0x4f8d58, 0.9),
  lanternPostGeo: new THREE.CylinderGeometry(0.07, 0.1, 4.05, 7),
  lanternPostMat: std(0x5d4539, 0.88),
  lanternCapGeo: new THREE.CylinderGeometry(0.16, 0.11, 0.16, 8),
  lanternCapMat: std(0x9a704b, 0.72),
  bulbGeo: new THREE.SphereGeometry(0.085, 7, 5),
  bulbMat: new THREE.MeshStandardMaterial({ color: 0xffd796, emissive: 0xffa83d, emissiveIntensity: 0.15, roughness: 0.46, transparent: true, opacity: 0.82 }),
  cableMat: new THREE.LineBasicMaterial({ color: 0x3e322c, transparent: true, opacity: 0.8 }),
};

async function ensureManifest() {
  if (manifestTried) return;
  manifestTried = true;
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (res.ok) npcManifest = await res.json();
  } catch { /* fallback to NAME_TO_ID + v2 filename convention */ }
}
function npcInfo(name) {
  const id = NAME_TO_ID[name] || null;
  if (npcManifest && id) {
    const c = (npcManifest.characters || []).find((x) => x.id === id);
    if (c) return { id, faceUrl: c.faceUrl, outfitUrl: c.outfitUrl };
  }
  return id ? { id, faceUrl: `assets/npc-faces/npc-${id}-face-v2.png`, outfitUrl: `assets/npc-outfits/npc-${id}-outfit-v2.png` } : null;
}

function buildNpcFigure(o, gen) {
  const g = new THREE.Group();
  const info = npcInfo(o.props?.npc || '');
  const skin = info ? (SKIN[info.id] ?? 0xc99a56) : 0xc99a56;
  const skinMat = std(skin, 0.7);
  if (info) {
    const ot = loadTex(RAW_GAME + info.outfitUrl);
    ot.wrapS = THREE.RepeatWrapping; ot.offset.x = 0.25;
    const body = mesh(new THREE.CapsuleGeometry(0.29, 0.54, 8, 20),
      new THREE.MeshStandardMaterial({ map: ot, roughness: 0.85 }), 0, 0.66, 0);
    g.add(body);
    const shoulders = mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.045, 22),
      body.material, 0, 0.97, 0);
    shoulders.rotation.x = Math.PI / 2; g.add(shoulders);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.30, 40),
      new THREE.MeshBasicMaterial({ map: loadTex(RAW_GAME + info.faceUrl), transparent: true }));
    face.position.set(0, 1.66, 0.083); g.add(face);
  } else {
    g.add(mesh(new THREE.CapsuleGeometry(0.29, 0.54, 8, 20), skinMat, 0, 0.66, 0));
  }
  const head = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.15, 32), skinMat, 0, 1.66, 0);
  head.rotation.x = Math.PI / 2; g.add(head);
  for (const side of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(0.13, 14, 10), skinMat, 0.46 * side, 0.68, 0));
    g.add(mesh(new THREE.BoxGeometry(0.25, 0.14, 0.42), std(0x3a3a3a), 0.19 * side, 0.15, 0.045));
  }
  if (info) {
    const attach = (file, pos) => {
      if (!file) return;
      loadAccessoryGLB(file).then((root) => {
        if (gen !== buildGen) return;
        const inst = root.clone(true);
        inst.position.set(...pos);
        inst.traverse((m) => { if (m.isMesh) m.castShadow = true; });
        g.add(inst);
      }).catch(() => { /* failed GLB left out, never faked */ });
    };
    attach(HELD_GLB[info.id], [0.46, 0.64, 0.14]);
    attach(HAT_GLB[info.id], [0, 1.93, 0]);
  }
  const sp = labelSprite(o.props?.npc || 'NPC');
  sp.position.y = 2.6; g.add(sp);
  return g;
}

function buildObject(o, index, expandedCottageIndex, gen) {
  const g = new THREE.Group();
  const asset = o.props?.asset;
  const scanned = o.props?.assetPath ? String(o.props.assetPath).split('/').pop().replace(/\.(glb|gltf)$/i, '') : null;
  const glbName = asset || scanned;
  if (glbName && (PROP_GLBS.has(glbName) || TREE_GLBS.has(glbName))) {
    const dir = TREE_GLBS.has(glbName) ? 'trees' : 'props';
    loadGLB(glbName + '.glb', dir).then((root) => {
      if (gen !== buildGen) return;
      const inst = root.clone(true);
      inst.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      g.add(inst);
    }).catch(() => { g.add(marker('GLB failed to load: ' + glbName, 1.2)); });
    return g;
  }
  switch (o.type) {
    case 'tree': {
      const s = Math.max(0.05, +o.scale || 1);
      g.add(mesh(SHARED.trunkGeo, SHARED.trunkMat, 0, 0.84 * s, 0));
      const crown = mesh(SHARED.crownGeo, SHARED.crownMat, 0, 2.05 * s, 0);
      crown.scale.setScalar(s); g.add(crown);
      break;
    }
    case 'lantern-post':
      g.add(mesh(SHARED.lanternPostGeo, SHARED.lanternPostMat, 0, 2.02, 0));
      g.add(mesh(SHARED.lanternCapGeo, SHARED.lanternCapMat, 0, 4.08, 0));
      break;
    case 'fence': {
      loadGLB('fence-segment.glb', 'props').then((root) => {
        if (gen !== buildGen) return;
        const inst = root.clone(true); g.add(inst);
      }).catch(() => {});
      break;
    }
    case 'bush': {
      loadGLB('bush-round.glb', 'props').then((root) => {
        if (gen !== buildGen) return;
        const inst = root.clone(true); g.add(inst);
      }).catch(() => {});
      break;
    }
    case 'rock-cluster': {
      loadGLB('rock-cluster.glb', 'props').then((root) => {
        if (gen !== buildGen) return;
        const inst = root.clone(true); g.add(inst);
      }).catch(() => {});
      break;
    }
    case 'grass-tuft':
      g.add(mesh(SHARED.grassGeo, SHARED.grassMat, 0, 0.13, 0));
      break;
    case 'flower-patch':
      g.add(mesh(SHARED.flowerGeo, SHARED.flowerMats[index % 3], 0, 0.16, 0));
      break;
    case 'building-cottage':
      if (o.props?.source === 'expanded-cottage') {
        addCottage(g, COTTAGE_COLORS[expandedCottageIndex % COTTAGE_COLORS.length]);
      } else {
        g.add(marker('Town cottage — base geometry not in readable code', 1.8, 0.06));
      }
      break;
    case 'building-town-hall': addTownHall(g); break;
    case 'building-pavilion': addPavilion(g); break;
    case 'pond': {
      const pond = mesh(new THREE.CylinderGeometry(5.2, 5.6, 0.12, 48),
        new THREE.MeshStandardMaterial({ color: 0x70afc3, roughness: 0.28, metalness: 0.06 }), 0, 0.02, 0);
      pond.scale.z = 0.58; g.add(pond);
      break;
    }
    case 'district-marker': {
      let color = DISTRICT_MARKERS[0][2];
      let best = Infinity;
      for (const [mx, mz, mc] of DISTRICT_MARKERS) {
        const d = Math.hypot(mx - (+o.x || 0), mz - (+o.z || 0));
        if (d < best) { best = d; color = mc; }
      }
      addDistrictMarker(g, color);
      break;
    }
    case 'garden-plot': addGardenBed(g); break;
    case 'sign': addGardenSign(g); break;
    case 'string-light-run': {
      const pts = Array.isArray(o.props?.points) ? o.props.points : [];
      const h = +o.props?.height || 4.5;
      const bulbs = +o.props?.bulbs || 0;
      if (pts.length >= 2) {
        const a = new THREE.Vector3(+pts[0][0], h, +pts[0][1]);
        const b = new THREE.Vector3(+pts[pts.length - 1][0], h, +pts[pts.length - 1][1]);
        const linePts = [];
        for (let i = 0; i < 25; i += 1) linePts.push(catenary(a, b, i / 24));
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), SHARED.cableMat));
        for (let i = 0; i < bulbs; i += 1) {
          const bulb = mesh(SHARED.bulbGeo, SHARED.bulbMat, 0, 0, 0);
          bulb.position.copy(catenary(a, b, (i + 0.5) / bulbs));
          if (i % 3 === 1) bulb.scale.setScalar(1.12);
          g.add(bulb);
        }
      }
      break;
    }
    case 'npc-spawn': return buildNpcFigure(o, gen);
    case 'minigame-anchor':
      g.add(marker('Minigame: ' + (o.props?.game || o.id), 1.4));
      break;
    case 'prop-easel':
      g.add(marker('Easel — dimensions not in readable code', 1.0));
      break;
    case 'bench': {
      loadGLB('park-bench.glb', 'props').then((root) => {
        if (gen !== buildGen) return;
        const inst = root.clone(true); g.add(inst);
      }).catch(() => {});
      break;
    }
    case 'pine-tree': {
      loadGLB('tree-pine.glb', 'trees').then((root) => {
        if (gen !== buildGen) return;
        const inst = root.clone(true); g.add(inst);
      }).catch(() => {});
      break;
    }
    default:
      g.add(marker(o.type, 1.2));
  }
  return g;
}

function init() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  // Town sky/fog colour is not in any readable game source (the bundle
  // sets no scene.background); neutral pale fog + the game's real
  // fog distances (near 36, far 112, world-expansion.js).
  scene.background = new THREE.Color(0xdfe8ea);
  scene.fog = new THREE.Fog(0xdfe8ea, 36, 112);
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  scene.add(new THREE.HemisphereLight(0xdfeaf2, 0x2a3430, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(30, 60, 40); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -60; key.shadow.camera.right = 60;
  key.shadow.camera.top = 60; key.shadow.camera.bottom = -60;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc3ff, 0.6);
  rim.position.set(-40, 30, -30); scene.add(rim);
  // Ground: the editor's own default ground texture (grass-meadow.png),
  // tiled; town paths are the game's verbatim PATH_SEGMENTS.
  const groundTex = loadTex('assets/textures/grass-meadow.png');
  groundTex.wrapS = THREE.RepeatWrapping; groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(60, 60);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  for (const seg of PATH_SEGMENTS) {
    const dx = seg.b[0] - seg.a[0], dz = seg.b[1] - seg.a[1];
    const len = Math.hypot(dx, dz);
    const path = mesh(new THREE.BoxGeometry(seg.width, 0.035, len), std(0xd8bd86, 1),
      (seg.a[0] + seg.b[0]) / 2, 0.035, (seg.a[1] + seg.b[1]) / 2);
    path.rotation.y = Math.atan2(dx, dz);
    path.castShadow = false;
    scene.add(path);
  }
  worldGroup = new THREE.Group();
  scene.add(worldGroup);
  selectionRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 40),
    new THREE.MeshBasicMaterial({ color: 0xd5743f, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.visible = false;
  scene.add(selectionRing);

  const pointers = new Map();
  let pinch = null, drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.classList.add('dragging');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), r: orbit.radius };
      drag = null;
    } else {
      drag = { x: e.clientX, y: e.clientY, theta: orbit.theta, phi: orbit.phi };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      orbit.radius = Math.min(200, Math.max(5, pinch.r * pinch.d / d));
      return;
    }
    if (!drag) return;
    orbit.theta = drag.theta - (e.clientX - drag.x) * 0.008;
    orbit.phi = Math.min(1.45, Math.max(0.15, drag.phi + (e.clientY - drag.y) * 0.005));
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) { drag = null; canvas.classList.remove('dragging'); }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbit.radius = Math.min(200, Math.max(5, orbit.radius * (e.deltaY > 0 ? 1.1 : 0.9)));
  }, { passive: false });

  let lastW = 0, lastH = 0;
  const resize = () => {
    const w = canvas.clientWidth || 600, h = canvas.clientHeight || 400;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
  const tick = () => {
    if (!canvas.classList.contains('hidden')) {
      resize();
      const sp = Math.sin(orbit.phi), cp = Math.cos(orbit.phi);
      camera.position.set(
        orbit.target.x + orbit.radius * sp * Math.sin(orbit.theta),
        orbit.target.y + orbit.radius * cp,
        orbit.target.z + orbit.radius * sp * Math.cos(orbit.theta));
      camera.lookAt(orbit.target);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
  };
  tick();
  ensureManifest().then(() => { lastSignature = ''; renderFromData(); });
  renderFromData();
}

function signature(objects, selectionId) {
  return JSON.stringify(objects.map((o) => [
    o.id, o.type, +o.x || 0, +o.y || 0, +o.z || 0, +o.rotY || 0, +o.scale || 1,
    o.props?.npc || '', o.props?.asset || '', o.props?.assetPath || '',
    JSON.stringify(o.props?.points || []), o.props?.source || ''])) + '|' + (selectionId || '');
}

function renderFromData() {
  const data = window.__worldPreviewData;
  if (!data || !worldGroup) return;
  const sig = signature(data.objects, data.selectionId);
  if (sig === lastSignature) return;
  lastSignature = sig;
  buildGen += 1;
  const gen = buildGen;
  while (worldGroup.children.length) {
    const c = worldGroup.children.pop();
    c.traverse((m) => {
      if (m.isMesh && !Object.values(SHARED).includes(m.geometry)) m.geometry?.dispose?.();
      if (m.isSprite) m.material.map?.dispose?.();
    });
  }
  let expandedIndex = 0;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < data.objects.length; i += 1) {
    const o = data.objects[i];
    if (o.props?.source === 'expanded-cottage') expandedIndex += 1;
    const child = buildObject(o, i, expandedIndex - 1, gen);
    child.position.set(+o.x || 0, +o.y || 0, +o.z || 0);
    child.rotation.y = -(+o.rotY || 0) * Math.PI / 180;
    child.scale.setScalar(Math.max(0.05, +o.scale || 1));
    child.userData.layoutId = o.id;
    worldGroup.add(child);
    minX = Math.min(minX, +o.x || 0); maxX = Math.max(maxX, +o.x || 0);
    minZ = Math.min(minZ, +o.z || 0); maxZ = Math.max(maxZ, +o.z || 0);
  }
  // Selection ring follows the selected object in world space.
  selectionRing.visible = false;
  if (data.selectionId) {
    const sel = data.objects.find((o) => o.id === data.selectionId);
    if (sel) {
      const r = Math.max(1.2, +sel.props?.collisionRadius || 1.5);
      selectionRing.scale.setScalar(r);
      selectionRing.position.set(+sel.x || 0, (+sel.y || 0) + 0.08, +sel.z || 0);
      selectionRing.visible = true;
    }
  }
  // Refit only on first build or when the user hits Fit view.
  if (window.__worldPreviewFitNext || !window.__worldPreviewFitted) {
    window.__worldPreviewFitted = true;
    window.__worldPreviewFitNext = false;
    if (data.objects.length) {
      orbit.target.set((minX + maxX) / 2, 1, (minZ + maxZ) / 2);
      const span = Math.max(20, maxX - minX, maxZ - minZ);
      orbit.radius = Math.min(160, Math.max(25, span * 1.05));
      orbit.theta = -0.7; orbit.phi = 0.95;
    }
  }
}

window.__worldPreview = {
  zoom(factor) { orbit.radius = Math.min(200, Math.max(5, orbit.radius * factor)); },
  fit() { window.__worldPreviewFitNext = true; lastSignature = ''; renderFromData(); },
};
window.__worldPreviewRender = renderFromData;
init();
