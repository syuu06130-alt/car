/* =============================================
   NERO — 湾岸レーサー
   script.js — Wangan Night Highway Edition
   ============================================= */
'use strict';

// ================================================================
// §0  GLOBALS & CONSTANTS
// ================================================================

const ROAD_W = 24;
const CAR_W  = 1.9;
const CAR_L  = 4.6;
const CAR_H  = 0.55;

const ENEMY_COLORS = [0xcc2200, 0x0044cc, 0xcc9900, 0x228844, 0x884488];

let bestScore = parseInt(localStorage.getItem('nero_best') || '0');
document.getElementById('hud-best').textContent = bestScore;
document.getElementById('go-best').textContent  = bestScore;

// ================================================================
// §1  RENDERER & SCENE
// ================================================================

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x020408);  // deep night sky
document.body.insertBefore(renderer.domElement, document.getElementById('loading-screen'));

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020408, 0.013);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ================================================================
// §2  LIGHTING  ─ sodium-vapor wangan night
// ================================================================

// Very dim cool ambient (night sky bounce)
scene.add(new THREE.AmbientLight(0x060a14, 1.2));
scene.add(new THREE.HemisphereLight(0x0c1428, 0x040608, 0.5));

// Four roving overhead sodium lights that track with the player
const sodiumLights = [];
const SODIUM_OFFSETS = [-30, -10, 10, 30];
for (const zo of SODIUM_OFFSETS) {
  const pl = new THREE.PointLight(0xffcc66, 3.0, 45);
  pl.position.set(0, 7.5, zo);
  scene.add(pl);
  sodiumLights.push({ light: pl, zOffset: zo });
}

// Subtle blue city-glow rim from the sides
const cityLeft  = new THREE.PointLight(0x0044aa, 2.5, 70);
const cityRight = new THREE.PointLight(0x001166, 2.0, 70);
cityLeft.position.set(-(ROAD_W + 12), 10, 0);
cityRight.position.set( (ROAD_W + 12), 10, 0);
scene.add(cityLeft);
scene.add(cityRight);

// ================================================================
// §3  WANGAN HIGHWAY ENVIRONMENT
// ================================================================

const roadTiles   = [];
const TILE_LEN    = 60;
const TILE_COUNT  = 14;

// Shared materials (reused across tiles)
const roadMat = new THREE.MeshStandardMaterial({
  color: 0x111318, roughness: 0.22, metalness: 0.06
});
const roadShoulderMat = new THREE.MeshStandardMaterial({
  color: 0x1a1c22, roughness: 0.75
});
const concreteLightMat = new THREE.MeshLambertMaterial({ color: 0x9a9aaa });
const concreteMidMat   = new THREE.MeshLambertMaterial({ color: 0x7a7a88 });
const concreteDarkMat  = new THREE.MeshLambertMaterial({ color: 0x606068 });
const metalMat   = new THREE.MeshPhongMaterial({ color: 0x8899aa, shininess: 60 });
const lineMat    = new THREE.MeshBasicMaterial({ color: 0xffffff });
const yellowMat  = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
const signGreen  = new THREE.MeshLambertMaterial({ color: 0x14461e });
const signWhite  = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd888 });

function buildWanganEnvironment() {
  for (let i = 0; i < TILE_COUNT; i++) {
    const grp = new THREE.Group();

    // ── Asphalt surface ──
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, TILE_LEN), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    grp.add(road);

    // Hard shoulder
    [-1, 1].forEach(s => {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, TILE_LEN), roadShoulderMat);
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(s * (ROAD_W / 2 + 1.1), 0.004, 0);
      grp.add(sh);
    });

    // ── Yellow edge lines ──
    [-1, 1].forEach(s => {
      const el = new THREE.Mesh(new THREE.PlaneGeometry(0.16, TILE_LEN), yellowMat);
      el.rotation.x = -Math.PI / 2;
      el.position.set(s * (ROAD_W / 2 - 0.25), 0.009, 0);
      grp.add(el);
    });

    // ── White lane dashes (centre & two inner lanes) ──
    for (let d = -TILE_LEN / 2 + 3; d < TILE_LEN / 2; d += 10) {
      // Centre
      const cd = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 6.0), lineMat);
      cd.rotation.x = -Math.PI / 2;
      cd.position.set(0, 0.009, d + 3);
      grp.add(cd);
      // Inner lanes
      [-ROAD_W / 3 + 0.6, ROAD_W / 3 - 0.6].forEach(lx => {
        const ld = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 4.5), lineMat);
        ld.rotation.x = -Math.PI / 2;
        ld.position.set(lx, 0.009, d + 2.25);
        grp.add(ld);
      });
    }

    // ── Jersey barriers (continuous) ──
    for (let bz = -TILE_LEN / 2; bz < TILE_LEN / 2; bz += 4) {
      [-1, 1].forEach(s => {
        const bx = s * (ROAD_W / 2 + 2.1);
        // Wide base
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.30, 3.85), concreteLightMat);
        b1.position.set(bx, 0.15, bz + 1.93);
        grp.add(b1);
        // Mid taper
        const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 3.85), concreteMidMat);
        b2.position.set(bx, 0.46, bz + 1.93);
        grp.add(b2);
        // Narrow top
        const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 3.85), concreteLightMat);
        b3.position.set(bx, 0.72, bz + 1.93);
        grp.add(b3);
      });
    }

    // ── Retaining walls ──
    [-1, 1].forEach(s => {
      const wx = s * (ROAD_W / 2 + 3.2);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.42, 5.5, TILE_LEN), concreteDarkMat);
      wall.position.set(wx, 2.75, 0);
      grp.add(wall);
      // Horizontal panel joints
      for (let jy = 1.0; jy < 5.5; jy += 1.4) {
        const joint = new THREE.Mesh(
          new THREE.BoxGeometry(0.43, 0.04, TILE_LEN),
          new THREE.MeshLambertMaterial({ color: 0x4a4a54 })
        );
        joint.position.set(wx, jy, 0);
        grp.add(joint);
      }
      // Wall cap
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, TILE_LEN), concreteMidMat);
      cap.position.set(wx, 5.57, 0);
      grp.add(cap);
    });

    // ── Overhead gantry (every 3rd tile) ──
    if (i % 3 === 0) addGantry(grp, 0);

    // ── Highway direction sign (every 5th tile) ──
    if (i % 5 === 2) addDirectionSign(grp, -18);
    if (i % 5 === 4) addDirectionSign(grp,  12);

    // ── Distant city skyline (one side, every tile) ──
    addCityBackdrop(grp, i);

    grp.position.z = i * TILE_LEN - TILE_LEN * (TILE_COUNT / 2);
    scene.add(grp);
    roadTiles.push(grp);
  }
}

function addGantry(grp, zOff) {
  const H = 7.8;
  // Side columns
  [-1, 1].forEach(s => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.24, H, 0.24), metalMat);
    col.position.set(s * (ROAD_W / 2 + 3.0), H / 2, zOff);
    grp.add(col);
    // Column base plate
    const bp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), concreteMidMat);
    bp.position.set(s * (ROAD_W / 2 + 3.0), 0.06, zOff);
    grp.add(bp);
  });
  // Top beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 6.6, 0.38, 0.38), metalMat);
  beam.position.set(0, H, zOff);
  grp.add(beam);
  // Lower cross-brace
  const brace = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 6.6, 0.14, 0.14), metalMat);
  brace.position.set(0, H - 0.8, zOff);
  grp.add(brace);

  // Lamp fixtures (hanging from beam)
  const lampPositions = [-ROAD_W / 2 + 2, -ROAD_W / 5, 0, ROAD_W / 5, ROAD_W / 2 - 2];
  lampPositions.forEach(lx => {
    // Housing
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.24, 0.96),
      new THREE.MeshLambertMaterial({ color: 0x4a4a52 }));
    h.position.set(lx, H - 0.52, zOff);
    grp.add(h);
    // Glowing face
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.72), lampGlowMat);
    face.rotation.x = Math.PI / 2;
    face.position.set(lx, H - 0.66, zOff);
    grp.add(face);
    // Hanging wire
    const wire = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.03), metalMat);
    wire.position.set(lx, H - 0.19, zOff);
    grp.add(wire);
  });
}

function addDirectionSign(grp, zOff) {
  const H = 7.6;
  const SW = 9.5, SHT = 2.0;
  [-SW / 2 + 0.4, SW / 2 - 0.4].forEach(sx => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.16, H, 0.16), metalMat);
    col.position.set(sx, H / 2, zOff);
    grp.add(col);
  });
  const span = new THREE.Mesh(new THREE.BoxGeometry(SW + 1.0, 0.24, 0.24), metalMat);
  span.position.set(0, H, zOff);
  grp.add(span);
  // Sign board
  const board = new THREE.Mesh(new THREE.BoxGeometry(SW, SHT, 0.11), signGreen);
  board.position.set(0, H + SHT / 2 + 0.14, zOff);
  grp.add(board);
  // White border frame
  const border = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.22, SHT + 0.22, 0.09), signWhite);
  border.position.set(0, H + SHT / 2 + 0.14, zOff - 0.02);
  grp.add(border);
  // Reflective route number dots
  for (let rx = -3.5; rx <= 3.5; rx += 1.75) {
    const dot = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dot.position.set(rx, H + SHT / 2 + 0.14, zOff + 0.065);
    grp.add(dot);
  }
}

function addCityBackdrop(grp, tileIdx) {
  // Distant blurry buildings on right side only (visual depth)
  const seed = tileIdx * 7919;
  const rng  = n => ((seed * n * 6364136223846793005n) % 2147483647n) / 2147483647;
  // Simple seeded random using tile index
  const r = (n) => Math.abs(Math.sin(tileIdx * 234.5 + n * 678.9));

  for (let b = 0; b < 3; b++) {
    const bw = 8  + r(b * 3)     * 14;
    const bh = 20 + r(b * 3 + 1) * 50;
    const bz = -TILE_LEN / 2 + b * 20 + r(b) * 10;
    const bx = (ROAD_W / 2 + 20 + r(b * 3 + 2) * 20);

    const build = new THREE.Mesh(
      new THREE.BoxGeometry(bw, bh, 6 + r(b) * 10),
      new THREE.MeshLambertMaterial({ color: 0x080c14 })
    );
    build.position.set(bx, bh / 2, bz);
    grp.add(build);

    // Lit windows (random)
    const rows = Math.floor(bh / 3.5);
    const cols = Math.floor(bw / 2.5);
    for (let wr = 0; wr < rows; wr++) {
      for (let wc = 0; wc < cols; wc++) {
        if (r(wr * 100 + wc + b * 10000) > 0.55) {
          const winMat = r(wr * 200 + wc) > 0.7
            ? new THREE.MeshBasicMaterial({ color: 0xffcc55 })
            : new THREE.MeshBasicMaterial({ color: 0x3355aa });
          const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), winMat);
          win.rotation.y = -Math.PI / 2;
          win.position.set(
            bx - bw / 2 - 0.01,
            wr * 3.5 + 2.5,
            bz - bw / 3 + wc * 2.5
          );
          grp.add(win);
        }
      }
    }
  }
}

// ================================================================
// §4  LAMBORGHINI HURACÁN — FRONT AT +Z (forward), HIGH DETAIL
// ================================================================

const playerCar  = new THREE.Group();
const playerCarBody = new THREE.Group();
playerCar.add(playerCarBody);
scene.add(playerCar);

const wheelNodes = [];

function buildLamborghini() {
  // ── Materials ──
  const paintBlack = new THREE.MeshPhongMaterial({
    color: 0x040407, shininess: 240, specular: 0x5555bb
  });
  const paintGold = new THREE.MeshPhongMaterial({
    color: 0xd4a017, shininess: 260, specular: 0xffe066
  });
  const carbon = new THREE.MeshPhongMaterial({
    color: 0x0b0b0e, shininess: 28, specular: 0x333333
  });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x162230, transparent: true, opacity: 0.38,
    shininess: 320, specular: 0x8899bb
  });
  const chrome = new THREE.MeshPhongMaterial({
    color: 0xe0e0ee, shininess: 480, specular: 0xffffff
  });
  const headlightMat  = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const drlMat        = new THREE.MeshBasicMaterial({ color: 0xeef4ff });
  const amberMat      = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const taillightMat  = new THREE.MeshBasicMaterial({ color: 0xff0d00 });
  const tailDimMat    = new THREE.MeshBasicMaterial({ color: 0x550400 });
  const reverseMat    = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const rubber = new THREE.MeshPhongMaterial({ color: 0x070707, shininess: 6 });
  const rimMat = new THREE.MeshPhongMaterial({ color: 0xbbbbbb, shininess: 300, specular: 0xffffff });
  const rimGold = new THREE.MeshPhongMaterial({ color: 0xd4a017, shininess: 250 });
  const intMat  = new THREE.MeshLambertMaterial({ color: 0x070709 });
  const blackMesh = new THREE.MeshBasicMaterial({ color: 0x000000 });

  function add(geo, mat, px, py, pz, rx, ry, rz) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    if (rx !== undefined) m.rotation.x = rx;
    if (ry !== undefined) m.rotation.y = ry;
    if (rz !== undefined) m.rotation.z = rz;
    m.castShadow = true;
    playerCarBody.add(m);
    return m;
  }

  // ══════════════════════════════════════════
  // BODY — Front at +Z, Rear at −Z
  // ══════════════════════════════════════════

  // Undertray / floor pan
  add(new THREE.BoxGeometry(CAR_W * 0.98, 0.07, CAR_L), carbon, 0, 0.07, 0);

  // Main lower body (sill/rocker area)
  add(new THREE.BoxGeometry(CAR_W * 0.94, CAR_H, CAR_L * 0.84), paintBlack, 0, 0.37, 0);

  // Rear haunches (very wide, Huracán signature)
  [-1, 1].forEach(s => {
    add(new THREE.BoxGeometry(0.28, 0.64, 1.85), paintBlack,
      s * (CAR_W * 0.49 + 0.12), 0.52, -0.28);
    // Fender flare
    add(new THREE.BoxGeometry(0.12, 0.18, 1.70), paintBlack,
      s * (CAR_W * 0.53 + 0.04), 0.22, -0.28);
    // Gold crease line
    add(new THREE.BoxGeometry(0.04, 0.06, 1.62), paintGold,
      s * (CAR_W * 0.50 + 0.16), 0.82, -0.28);
  });

  // Front fenders (angular, sharp)
  [-1, 1].forEach(s => {
    add(new THREE.BoxGeometry(0.20, 0.50, 1.30), paintBlack,
      s * (CAR_W * 0.49 + 0.08), 0.44, CAR_L * 0.26);
    // Front fender crease
    add(new THREE.BoxGeometry(0.04, 0.05, 1.20), paintGold,
      s * (CAR_W * 0.50 + 0.14), 0.78, CAR_L * 0.26);
  });

  // ── HOOD (forward slopping wedge toward +Z) ──
  // Main flat hood panel
  add(new THREE.BoxGeometry(CAR_W * 0.86, 0.09, CAR_L * 0.45), paintBlack,
    0, 0.68, CAR_L * 0.20);
  // Hood leading edge (sloped nose, angled toward +Z front)
  add(new THREE.BoxGeometry(CAR_W * 0.84, 0.24, 0.32), paintBlack,
    0, 0.54, CAR_L * 0.43, -0.50, 0, 0);
  // Hood centre spine / vent
  add(new THREE.BoxGeometry(0.44, 0.07, CAR_L * 0.28), carbon,
    0, 0.73, CAR_L * 0.12);
  // Hood vent slats
  for (let vs = 0; vs < 4; vs++) {
    add(new THREE.BoxGeometry(0.38, 0.02, 0.07), carbon,
      0, 0.77, CAR_L * 0.04 + vs * 0.12);
  }

  // ── CABIN / GREENHOUSE ──
  // Main cabin body
  add(new THREE.BoxGeometry(CAR_W * 0.76, 0.56, 1.65), paintBlack, 0, 0.92, -0.02);
  // Roof panel
  add(new THREE.BoxGeometry(CAR_W * 0.66, 0.10, 1.44), paintBlack, 0, 1.24, -0.04);
  // Roof rear taper
  add(new THREE.BoxGeometry(CAR_W * 0.60, 0.09, 0.40), paintBlack, 0, 1.20, -CAR_L * 0.22);

  // A-pillars
  [-1, 1].forEach(s => {
    const ap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.54, 0.09), paintBlack);
    ap.position.set(s * CAR_W * 0.37, 0.96, CAR_L * 0.14);
    ap.rotation.z = s * 0.18;
    ap.rotation.x = -0.52;
    playerCarBody.add(ap);
  });
  // B-pillars
  [-1, 1].forEach(s => {
    add(new THREE.BoxGeometry(0.08, 0.52, 0.08), paintBlack,
      s * CAR_W * 0.39, 0.96, -CAR_L * 0.08);
  });

  // ── GLAZING ──
  // Windshield
  const ws = new THREE.Mesh(new THREE.BoxGeometry(CAR_W * 0.70, 0.52, 0.08), glass);
  ws.position.set(0, 0.96, CAR_L * 0.16);
  ws.rotation.x = 0.50;
  playerCarBody.add(ws);
  // Rear window
  const rw = new THREE.Mesh(new THREE.BoxGeometry(CAR_W * 0.56, 0.42, 0.08), glass);
  rw.position.set(0, 0.98, -CAR_L * 0.13);
  rw.rotation.x = -0.30;
  playerCarBody.add(rw);
  // Side windows
  [-1, 1].forEach(s => {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 1.30), glass);
    sw.position.set(s * CAR_W * 0.40, 0.97, -0.01);
    playerCarBody.add(sw);
  });
  // Door mirrors (carbon stalk)
  [-1, 1].forEach(s => {
    add(new THREE.BoxGeometry(0.06, 0.08, 0.26), carbon,
      s * (CAR_W * 0.40 + 0.09), 1.20, CAR_L * 0.12);
    add(new THREE.BoxGeometry(0.20, 0.11, 0.11), carbon,
      s * (CAR_W * 0.40 + 0.16), 1.20, CAR_L * 0.10);
  });

  // ── SIDE SKIRTS ──
  [-1, 1].forEach(s => {
    add(new THREE.BoxGeometry(0.06, 0.22, CAR_L * 0.77), carbon,
      s * CAR_W * 0.50, 0.17, -0.02);
    add(new THREE.BoxGeometry(0.04, 0.04, CAR_L * 0.66), paintGold,
      s * CAR_W * 0.53, 0.30, -0.02);
    // Side engine air intake (between axles)
    add(new THREE.BoxGeometry(0.16, 0.28, 0.42), carbon,
      s * (CAR_W * 0.49 + 0.06), 0.30, -CAR_L * 0.08);
    add(new THREE.BoxGeometry(0.12, 0.22, 0.36), blackMesh,
      s * (CAR_W * 0.49 + 0.10), 0.30, -CAR_L * 0.08);
  });

  // ══════════════════════════════════════════
  // FRONT (+Z face)
  // ══════════════════════════════════════════

  // Front splitter (ground effect)
  add(new THREE.BoxGeometry(CAR_W * 1.08, 0.06, 0.30), carbon,
    0, 0.09, CAR_L * 0.444 + 0.15);
  add(new THREE.BoxGeometry(CAR_W * 0.96, 0.03, 0.14), carbon,
    0, 0.06, CAR_L * 0.444 + 0.22);
  // Splitter end plates
  [-1, 1].forEach(s => {
    add(new THREE.BoxGeometry(0.06, 0.12, 0.28), carbon,
      s * CAR_W * 0.52, 0.09, CAR_L * 0.444 + 0.01);
  });

  // Lower front bumper fascia
  add(new THREE.BoxGeometry(CAR_W * 0.92, 0.26, 0.09), carbon,
    0, 0.24, CAR_L * 0.445);

  // Central large intake
  add(new THREE.BoxGeometry(0.62, 0.22, 0.10), carbon, 0, 0.20, CAR_L * 0.445);
  add(new THREE.BoxGeometry(0.56, 0.16, 0.07), blackMesh, 0, 0.20, CAR_L * 0.445 + 0.04);
  // Intake horizontal bars
  for (let ib = 0; ib < 3; ib++) {
    add(new THREE.BoxGeometry(0.54, 0.025, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x1a1a20 }),
      0, 0.13 + ib * 0.06, CAR_L * 0.445 + 0.03);
  }

  // Side lower intakes
  [-0.55, 0.55].forEach(x => {
    add(new THREE.BoxGeometry(0.30, 0.18, 0.10), carbon, x, 0.20, CAR_L * 0.445);
    add(new THREE.BoxGeometry(0.24, 0.13, 0.07), blackMesh, x, 0.20, CAR_L * 0.445 + 0.04);
  });

  // Upper bumper (body-colour)
  add(new THREE.BoxGeometry(CAR_W * 0.86, 0.18, 0.09), paintBlack,
    0, 0.52, CAR_L * 0.445);

  // ── HEADLIGHTS (angular LED array) ──
  [-1, 1].forEach(s => {
    // Housing unit
    add(new THREE.BoxGeometry(0.44, 0.14, 0.09),
      new THREE.MeshPhongMaterial({ color: 0x1a1a24, shininess: 200 }),
      s * 0.62, 0.58, CAR_L * 0.445);
    // DRL (Daytime Running Light — bright LED strip)
    add(new THREE.BoxGeometry(0.40, 0.04, 0.08), drlMat,
      s * 0.62, 0.65, CAR_L * 0.445);
    // Main beam reflector
    add(new THREE.BoxGeometry(0.28, 0.08, 0.07), headlightMat,
      s * 0.60, 0.58, CAR_L * 0.445);
    // Indicator
    add(new THREE.BoxGeometry(0.14, 0.07, 0.07), amberMat,
      s * 0.60, 0.49, CAR_L * 0.445);
    // Eyebrow LED strip
    add(new THREE.BoxGeometry(0.36, 0.025, 0.07), drlMat,
      s * 0.60, 0.54, CAR_L * 0.444);
  });

  // ══════════════════════════════════════════
  // REAR (−Z face)
  // ══════════════════════════════════════════

  // Rear deck
  add(new THREE.BoxGeometry(CAR_W * 0.86, 0.14, 0.65), paintBlack,
    0, 0.73, -CAR_L * 0.36);
  // Engine lid / vented cover
  add(new THREE.BoxGeometry(CAR_W * 0.58, 0.08, 0.85), carbon,
    0, 0.72, -CAR_L * 0.20);
  // Engine cover louvres
  for (let l = 0; l < 5; l++) {
    add(new THREE.BoxGeometry(CAR_W * 0.52, 0.03, 0.08), carbon,
      0, 0.77, -CAR_L * 0.13 - l * 0.12);
  }

  // Rear bumper/diffuser
  add(new THREE.BoxGeometry(CAR_W * 0.90, 0.28, 0.22), carbon,
    0, 0.17, -CAR_L * 0.444);
  // Diffuser fins
  for (let fi = -0.65; fi <= 0.65; fi += 0.18) {
    add(new THREE.BoxGeometry(0.04, 0.22, 0.20), carbon, fi, 0.17, -CAR_L * 0.444);
  }

  // Fixed rear wing
  add(new THREE.BoxGeometry(CAR_W * 1.14, 0.07, 0.32), carbon,
    0, 1.08, -CAR_L * 0.42);
  add(new THREE.BoxGeometry(CAR_W * 1.10, 0.04, 0.28), paintBlack,
    0, 1.12, -CAR_L * 0.42);
  // Endplates
  [-1, 1].forEach(s => {
    add(new THREE.BoxGeometry(0.07, 0.42, 0.30), carbon,
      s * CAR_W * 0.58, 0.89, -CAR_L * 0.42);
  });
  // Wing struts
  [-0.52, 0.52].forEach(x => {
    add(new THREE.BoxGeometry(0.065, 0.42, 0.07), chrome,
      x * CAR_W * 0.5, 0.87, -CAR_L * 0.42);
  });

  // ── TAIL LIGHTS ──
  [-1, 1].forEach(s => {
    // Full wide unit
    add(new THREE.BoxGeometry(0.48, 0.09, 0.08), taillightMat,
      s * 0.62, 0.58, -CAR_L * 0.444);
    // Inner trim (gold)
    add(new THREE.BoxGeometry(0.22, 0.07, 0.08), paintGold,
      s * 0.62, 0.51, -CAR_L * 0.444);
    // Lower dim section
    add(new THREE.BoxGeometry(0.44, 0.06, 0.07), tailDimMat,
      s * 0.62, 0.44, -CAR_L * 0.444);
    // Reverse light
    add(new THREE.BoxGeometry(0.10, 0.05, 0.06), reverseMat,
      s * 0.30, 0.44, -CAR_L * 0.444);
  });
  // Full-width LED bar
  add(new THREE.BoxGeometry(CAR_W * 0.90, 0.04, 0.07), taillightMat,
    0, 0.59, -CAR_L * 0.444);

  // ── EXHAUSTS ──
  [-0.40, 0.40].forEach(x => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.054, 0.16, 12), chrome);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, 0.21, -CAR_L * 0.445);
    playerCarBody.add(pipe);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.10, 12), blackMesh);
    inner.rotation.x = Math.PI / 2;
    inner.position.set(x, 0.21, -CAR_L * 0.449);
    playerCarBody.add(inner);
  });

  // ── INTERIOR (visible through glass) ──
  [-1, 1].forEach(s => {
    // Bucket seat
    add(new THREE.BoxGeometry(0.34, 0.12, 0.54), intMat, s * 0.24, 0.72, -0.05);
    add(new THREE.BoxGeometry(0.32, 0.42, 0.10), intMat, s * 0.24, 0.92, -0.28);
  });
  // Dashboard
  add(new THREE.BoxGeometry(CAR_W * 0.66, 0.20, 0.22), intMat, 0, 0.80, CAR_L * 0.14);
  // Centre console
  add(new THREE.BoxGeometry(0.22, 0.12, 0.60), intMat, 0, 0.72, -0.05);
  // Steering wheel
  const swTorus = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.013, 6, 16),
    new THREE.MeshPhongMaterial({ color: 0x0e0e12 }));
  swTorus.rotation.x = 1.15;
  swTorus.position.set(-0.22, 0.84, CAR_L * 0.09);
  playerCarBody.add(swTorus);

  // ══════════════════════════════════════════
  // WHEELS  — front at +Z, rear at −Z
  // ══════════════════════════════════════════
  const wDefs = [
    { x: -CAR_W * 0.52, z:  CAR_L * 0.33, front: true  }, // FL
    { x:  CAR_W * 0.52, z:  CAR_L * 0.33, front: true  }, // FR
    { x: -CAR_W * 0.52, z: -CAR_L * 0.31, front: false }, // RL
    { x:  CAR_W * 0.52, z: -CAR_L * 0.31, front: false }, // RR
  ];

  wDefs.forEach(wd => {
    const pivot = new THREE.Group();
    pivot.position.set(wd.x, 0.30, wd.z);
    playerCarBody.add(pivot);

    const spin = new THREE.Group();
    pivot.add(spin);

    // Tyre (wider at rear — Huracán fitment)
    const tireW = wd.front ? 0.22 : 0.27;
    const tireR = wd.front ? 0.30 : 0.31;
    const tire  = new THREE.Mesh(new THREE.CylinderGeometry(tireR, tireR, tireW, 24), rubber);
    tire.rotation.z = Math.PI / 2;
    spin.add(tire);

    // Tyre shoulder bead
    [-0.5, 0.5].map(f => f * (tireW * 0.88)).forEach(bx => {
      const bead = new THREE.Mesh(
        new THREE.TorusGeometry(tireR - 0.025, 0.016, 5, 20),
        new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 4 })
      );
      bead.rotation.y = Math.PI / 2;
      bead.position.x = bx;
      spin.add(bead);
    });

    // Rim barrel
    const rimBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(tireR - 0.04, tireR - 0.04, tireW - 0.01, 20),
      new THREE.MeshPhongMaterial({ color: 0x1a1a1e })
    );
    rimBarrel.rotation.z = Math.PI / 2;
    spin.add(rimBarrel);

    // Rim face
    const rimFace = new THREE.Mesh(
      new THREE.CylinderGeometry(tireR * 0.72, tireR * 0.72, tireW + 0.01, 12),
      rimMat
    );
    rimFace.rotation.z = Math.PI / 2;
    spin.add(rimFace);

    // 10-spoke design (Huracán Evo OEM)
    for (let sp = 0; sp < 10; sp++) {
      const angle = (sp / 10) * Math.PI * 2;
      const spk = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.18, tireW + 0.01), rimMat);
      spk.rotation.z = Math.PI / 2;
      spk.rotation.x = angle;
      spin.add(spk);
    }

    // Centre cap
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, tireW + 0.02, 10), chrome);
    hub.rotation.z = Math.PI / 2;
    spin.add(hub);

    // Gold centre badge
    const badge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, tireW + 0.03, 6), rimGold);
    badge.rotation.z = Math.PI / 2;
    spin.add(badge);

    // Visible brake caliper (gold, offset)
    const cali = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.16, tireW - 0.02), rimGold);
    cali.rotation.z = Math.PI / 2;
    cali.position.y = tireR * 0.50;
    spin.add(cali);
    // Caliper bolt detail
    const boltMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    [-0.06, 0.06].forEach(bz => {
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, tireW - 0.01, 6), boltMat);
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(0, tireR * 0.50, bz);
      spin.add(bolt);
    });

    // Brake disc (dark slotted)
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(tireR * 0.60, tireR * 0.60, 0.04, 14),
      new THREE.MeshPhongMaterial({ color: 0x2a2a2e, shininess: 40 })
    );
    disc.rotation.z = Math.PI / 2;
    spin.add(disc);

    wheelNodes.push({ pivot, spin, front: wd.front });
  });
}

// ================================================================
// §5  PLAYER FOOT MODEL — faces +Z (forward)
// ================================================================

const playerFoot = new THREE.Group();
playerFoot.visible = false;
scene.add(playerFoot);

function buildPlayer() {
  const skinMat   = new THREE.MeshLambertMaterial({ color: 0xd4926a });
  const suitMat   = new THREE.MeshLambertMaterial({ color: 0x0a0a12 });
  const gearMat   = new THREE.MeshLambertMaterial({ color: 0x141418 });
  const visorMat  = new THREE.MeshBasicMaterial({ color: 0xd4a017, transparent: true, opacity: 0.55 });
  const goldAccent = new THREE.MeshBasicMaterial({ color: 0xd4a017 });

  function pa(geo, mat, px, py, pz) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    playerFoot.add(m);
    return m;
  }

  // Humanoid faces +Z (positive Z = front of body)
  // Helmet
  pa(new THREE.SphereGeometry(0.22, 10, 8), gearMat, 0, 1.78, 0);
  // Visor (on front = +Z face)
  pa(new THREE.PlaneGeometry(0.32, 0.13), visorMat, 0, 1.74, 0.21);
  // Helmet chin
  pa(new THREE.BoxGeometry(0.22, 0.08, 0.22), gearMat, 0, 1.60, 0.06);
  // Neck
  pa(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8), skinMat, 0, 1.58, 0);

  // Torso
  pa(new THREE.BoxGeometry(0.44, 0.56, 0.22), suitMat, 0, 1.22, 0);
  // Gold suit stripe (vertical centre)
  pa(new THREE.BoxGeometry(0.06, 0.46, 0.24), goldAccent, 0, 1.22, 0);
  // Suit shoulders
  [-1, 1].forEach(s => {
    pa(new THREE.BoxGeometry(0.10, 0.08, 0.22), suitMat, s * 0.25, 1.46, 0);
  });

  // Arms
  [-1, 1].forEach(s => {
    pa(new THREE.BoxGeometry(0.14, 0.50, 0.14), suitMat, s * 0.31, 1.18, 0);
    pa(new THREE.SphereGeometry(0.08, 6, 5), skinMat, s * 0.31, 0.92, 0);
    // Gloves
    pa(new THREE.BoxGeometry(0.11, 0.14, 0.10), gearMat, s * 0.31, 0.85, 0);
  });

  // Waist/belt
  pa(new THREE.BoxGeometry(0.40, 0.09, 0.20), gearMat, 0, 0.93, 0);

  // Legs
  [-1, 1].forEach(s => {
    pa(new THREE.BoxGeometry(0.17, 0.54, 0.17), suitMat, s * 0.12, 0.68, 0);
    pa(new THREE.BoxGeometry(0.16, 0.44, 0.16), suitMat, s * 0.12, 0.21, 0);
    // Boots (pointing toward +Z = forward)
    pa(new THREE.BoxGeometry(0.17, 0.10, 0.30), gearMat, s * 0.12, 0.05, 0.05);
  });
}

// ================================================================
// §6  ENEMY CARS
// ================================================================

const enemies   = [];
const MAX_ENEMIES = 8;

function buildEnemyCar(colorHex) {
  const grp     = new THREE.Group();
  const bodyGrp = new THREE.Group();
  grp.add(bodyGrp);

  const paint  = new THREE.MeshPhongMaterial({ color: colorHex, shininess: 110 });
  const dark   = new THREE.MeshLambertMaterial({ color: 0x0e0e0e });
  const glass_ = new THREE.MeshPhongMaterial({ color: 0x1a3048, transparent: true, opacity: 0.44 });
  const wRub   = new THREE.MeshPhongMaterial({ color: 0x080808, shininess: 5 });
  const wRim   = new THREE.MeshPhongMaterial({ color: 0xbbbbbb, shininess: 180 });

  function b(w, h, d, mat, px, py, pz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz); m.castShadow = true; bodyGrp.add(m);
  }

  b(1.72, 0.43, 3.85, paint,   0, 0.36, 0);
  b(1.56, 0.54, 1.72, paint,   0, 0.86, 0.1);
  b(1.38, 0.09, 1.52, paint,   0, 1.14, 0.1);
  b(0.06, 0.19, 3.65, dark,   -0.90, 0.26, 0);
  b(0.06, 0.19, 3.65, dark,    0.90, 0.26, 0);

  const wsFront = new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.44, 0.07), glass_);
  wsFront.position.set(0, 0.88, -0.90); wsFront.rotation.x = 0.25;
  bodyGrp.add(wsFront);

  const hlMat = new THREE.MeshBasicMaterial({ color: 0xddddff });
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xff0d00 });
  [-0.60, 0.60].forEach(x => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.06), hlMat);
    hl.position.set(x, 0.55, -1.93); bodyGrp.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.06), tlMat);
    tl.position.set(x, 0.54, 1.93); bodyGrp.add(tl);
  });

  // Wheels
  const wPositions = [[-0.94,-1.28],[0.94,-1.28],[-0.94,1.28],[0.94,1.28]];
  grp._wheels = [];
  wPositions.forEach(([wx, wz]) => {
    const spin = new THREE.Group();
    spin.position.set(wx, 0.28, wz);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.21, 16), wRub);
    t.rotation.z = Math.PI / 2;
    spin.add(t);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.22, 8), wRim);
    r.rotation.z = Math.PI / 2;
    spin.add(r);
    bodyGrp.add(spin);
    grp._wheels.push(spin);
  });

  return grp;
}

function spawnEnemy() {
  if (enemies.length >= MAX_ENEMIES) return;
  const lane   = (Math.floor(Math.random() * 3) - 1) * (ROAD_W / 3.5);
  const colorH = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
  const grp    = buildEnemyCar(colorH);
  grp.position.set(lane, 0, phys.position.z - 130 - Math.random() * 90);
  grp._speed  = 8 + Math.random() * 16;
  grp._lane   = lane;
  grp._lane_t = Math.random() * 100;
  scene.add(grp);
  enemies.push(grp);
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e._lane_t += dt;
    const targetX = e._lane + Math.sin(e._lane_t * 0.35) * 2.8;
    e.position.x += (targetX - e.position.x) * 0.022;
    e.position.z += e._speed * dt;
    if (e._wheels) e._wheels.forEach(w => { w.rotation.x += (e._speed / 0.28) * dt; });

    if (e.position.z > phys.position.z + 85) {
      scene.remove(e); enemies.splice(i, 1);
    }
  }
  if (gameState.playing && enemies.length < MAX_ENEMIES && Math.random() < 0.022) spawnEnemy();
}

// ================================================================
// §7  PHYSICS STATE
// ================================================================

const phys = {
  position: new THREE.Vector3(0, 0, 0),
  yaw: 0, speed: 0, steer: 0,
  spinAngle: 0, suspY: 0, suspVY: 0,
};

const C = {
  ACCEL: 20, BRAKE: 32, FRICTION: 5, HANDBRAKE: 44,
  MAX_FWD: 38, MAX_REV: 10,
  WHEELBASE: 2.7,
  MAX_STEER: 0.48, STEER_IN: 2.8, STEER_OUT: 4.2,
  SPEED_UNDER: 0.044,
  WHEEL_R: 0.30,
  SPRING: 60, DAMP: 10,
  CAM_LAG: 6, CAM_DIST: 9, CAM_H: 4.2,
  WALK_SPEED: 4, WALK_STEER: 2.2,
};

// ================================================================
// §8  GAME STATE
// ================================================================

const gameState = {
  playing: false, inCar: true,
  score: 0, health: 100, elapsed: 0,
};

// ================================================================
// §9  INPUT
// ================================================================

const K = {};
window.addEventListener('keydown', e => { K[e.code] = true;  e.preventDefault(); });
window.addEventListener('keyup',   e => { K[e.code] = false; });

let touchData = { fwd: false, rev: false, left: false, right: false, hb: false };

function buildTouchControls() {
  const ui = document.createElement('div');
  ui.style.cssText =
    'position:fixed;bottom:0;left:0;right:0;height:180px;z-index:500;' +
    'pointer-events:none;display:flex;justify-content:space-between;' +
    'align-items:flex-end;padding:16px;';
  ui.innerHTML = `
    <div style="pointer-events:auto;display:grid;grid-template-columns:60px 60px 60px;
                grid-template-rows:60px 60px;gap:6px;">
      <div></div>
      <button id="t-fwd"   style="background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.18);color:#fff;font-size:20px;border-radius:8px;touch-action:none;">▲</button>
      <div></div>
      <button id="t-left"  style="background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.18);color:#fff;font-size:20px;border-radius:8px;touch-action:none;">◄</button>
      <button id="t-rev"   style="background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.18);color:#fff;font-size:20px;border-radius:8px;touch-action:none;">▼</button>
      <button id="t-right" style="background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.18);color:#fff;font-size:20px;border-radius:8px;touch-action:none;">►</button>
    </div>
    <button id="t-hb" style="pointer-events:auto;background:rgba(212,160,23,0.22);
      border:1px solid rgba(212,160,23,0.45);color:#d4a017;font-family:monospace;
      font-size:10px;padding:12px 20px;border-radius:8px;letter-spacing:2px;touch-action:none;">HB</button>`;
  document.body.appendChild(ui);

  function bind(id, key) {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', e => { touchData[key] = true;  e.preventDefault(); }, { passive: false });
    el.addEventListener('touchend',   e => { touchData[key] = false; e.preventDefault(); }, { passive: false });
  }
  bind('t-fwd','fwd'); bind('t-rev','rev');
  bind('t-left','left'); bind('t-right','right'); bind('t-hb','hb');
}

function getInput() {
  return {
    fwd:   K.ArrowUp    || K.KeyW || touchData.fwd,
    rev:   K.ArrowDown  || K.KeyS || touchData.rev,
    left:  K.ArrowLeft  || K.KeyA || touchData.left,
    right: K.ArrowRight || K.KeyD || touchData.right,
    hb:    K.Space                 || touchData.hb,
    e:     K.KeyE,
  };
}

// ================================================================
// §10  ROAD TILE RECYCLING
// ================================================================

function updateRoad() {
  const pz = phys.position.z;
  const totalLen = TILE_COUNT * TILE_LEN;
  roadTiles.forEach(tile => {
    if (tile.position.z < pz - TILE_LEN * 2)            tile.position.z += totalLen;
    if (tile.position.z > pz + TILE_LEN * (TILE_COUNT-2)) tile.position.z -= totalLen;
  });
  // Sodium lights track player
  sodiumLights.forEach(({ light, zOffset }) => {
    light.position.set(0, 7.5, pz + zOffset);
  });
  cityLeft.position.z  = pz;
  cityRight.position.z = pz;
}

// ================================================================
// §11  PHYSICS UPDATE
// ================================================================

function stepCarPhysics(dt, inp) {
  const tgtSteer = inp.left ? -C.MAX_STEER : inp.right ? C.MAX_STEER : 0;
  const sRate    = (inp.left || inp.right) ? C.STEER_IN : C.STEER_OUT;
  phys.steer    += (tgtSteer - phys.steer) * Math.min(sRate * dt, 1);

  let accel = 0;
  if (inp.fwd) accel = phys.speed >= 0 ? C.ACCEL : C.BRAKE;
  else if (inp.rev) accel = phys.speed > 0 ? -C.BRAKE : -C.ACCEL * 0.55;

  if (inp.hb) {
    const hb = C.HANDBRAKE * dt;
    phys.speed = phys.speed > 0 ? Math.max(0, phys.speed - hb) : Math.min(0, phys.speed + hb);
  }
  phys.speed += accel * dt;

  if (!inp.fwd && !inp.rev && !inp.hb) {
    const f = C.FRICTION * dt;
    phys.speed = Math.abs(phys.speed) < f ? 0 : phys.speed - Math.sign(phys.speed) * f;
  }
  phys.speed = THREE.MathUtils.clamp(phys.speed, -C.MAX_REV, C.MAX_FWD);

  const effSteer = phys.steer / (1 + Math.abs(phys.speed) * C.SPEED_UNDER);
  const yawRate  = (phys.speed / C.WHEELBASE) * Math.tan(effSteer);
  phys.yaw      += yawRate * dt;

  phys.position.x += Math.sin(phys.yaw) * phys.speed * dt;
  phys.position.z += Math.cos(phys.yaw) * phys.speed * dt;

  const maxX = ROAD_W / 2 - 1.2;
  if (Math.abs(phys.position.x) > maxX) {
    phys.position.x = Math.sign(phys.position.x) * maxX;
    phys.speed *= 0.5;
  }

  const springF = (0 - phys.suspY) * C.SPRING;
  const dampF   = phys.suspVY * C.DAMP;
  phys.suspVY  += (springF - dampF) * dt;
  phys.suspY   += phys.suspVY * dt;

  phys.spinAngle += (phys.speed / C.WHEEL_R) * dt;
}

const walkState = { x: 0, z: 0, yaw: 0 };

function stepWalkPhysics(dt, inp) {
  if (inp.left)  walkState.yaw += C.WALK_STEER * dt;
  if (inp.right) walkState.yaw -= C.WALK_STEER * dt;
  if (inp.fwd) {
    walkState.x += Math.sin(walkState.yaw) * C.WALK_SPEED * dt;
    walkState.z += Math.cos(walkState.yaw) * C.WALK_SPEED * dt;
  }
  if (inp.rev) {
    walkState.x -= Math.sin(walkState.yaw) * C.WALK_SPEED * 0.6 * dt;
    walkState.z -= Math.cos(walkState.yaw) * C.WALK_SPEED * 0.6 * dt;
  }
  walkState.x = THREE.MathUtils.clamp(walkState.x, -(ROAD_W/2+8), ROAD_W/2+8);
}

// ================================================================
// §12  COLLISION DETECTION
// ================================================================

const _box1 = new THREE.Box3();
const _box2 = new THREE.Box3();
const playerBoxSize = new THREE.Vector3(CAR_W, CAR_H, CAR_L);

function checkCollisions() {
  _box1.setFromCenterAndSize(
    new THREE.Vector3(phys.position.x, phys.suspY + CAR_H / 2, phys.position.z),
    playerBoxSize
  );
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    _box2.setFromCenterAndSize(
      new THREE.Vector3(e.position.x, CAR_H / 2, e.position.z),
      new THREE.Vector3(1.85, 0.92, 4.0)
    );
    if (_box1.intersectsBox(_box2)) {
      applyDamage(Math.abs(phys.speed - e._speed) * 1.5);
      phys.speed *= -0.3;
      showDamageFlash();
      e.position.z += 3.5;
    }
  }
}

function applyDamage(dmg) {
  gameState.health = Math.max(0, gameState.health - dmg);
  const fill = document.getElementById('hud-dmg-fill');
  fill.style.width = gameState.health + '%';
  fill.style.background = gameState.health > 60 ? '#2ecc71'
    : gameState.health > 30 ? '#f39c12' : '#e74c3c';
  if (gameState.health <= 0) triggerGameOver();
}

function showDamageFlash() {
  const el = document.getElementById('damage-flash');
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 120);
}

// ================================================================
// §13  VISUAL SYNC
// ================================================================

function syncCarMesh() {
  playerCar.position.set(phys.position.x, phys.suspY, phys.position.z);
  playerCar.rotation.y = phys.yaw;

  const pitch = THREE.MathUtils.clamp(phys.suspVY * 0.02, -0.07, 0.07);
  playerCarBody.rotation.x = THREE.MathUtils.lerp(playerCarBody.rotation.x, pitch, 0.1);

  // Front at +Z — steer sign is correct
  wheelNodes.forEach(w => {
    if (w.front) w.pivot.rotation.y = phys.steer;
    w.spin.rotation.x = phys.spinAngle;
  });
}

// ================================================================
// §14  CAMERA
// ================================================================

const camPos  = new THREE.Vector3(0, 6, 12);
const camLook = new THREE.Vector3();
const camWalk = new THREE.Vector3();

function stepCamera(dt) {
  const lag = Math.min(C.CAM_LAG * dt, 1);

  if (gameState.inCar) {
    const spd  = Math.abs(phys.speed);
    const dist = C.CAM_DIST + spd * 0.15;
    const hgt  = C.CAM_H    + spd * 0.05;
    const tPos = new THREE.Vector3(
      phys.position.x - Math.sin(phys.yaw) * dist,
      phys.suspY + hgt,
      phys.position.z - Math.cos(phys.yaw) * dist
    );
    camPos.lerp(tPos, lag);
    const ahead = 3 + spd * 0.08;
    const tLook = new THREE.Vector3(
      phys.position.x + Math.sin(phys.yaw) * ahead,
      phys.suspY + 1.0,
      phys.position.z + Math.cos(phys.yaw) * ahead
    );
    camLook.lerp(tLook, lag * 1.5);
  } else {
    const tPos = new THREE.Vector3(
      walkState.x - Math.sin(walkState.yaw) * 4,
      3.5,
      walkState.z - Math.cos(walkState.yaw) * 4
    );
    camWalk.lerp(tPos, lag);
    camPos.copy(camWalk);
    camLook.set(walkState.x, 1.5, walkState.z);
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// ================================================================
// §15  HUD UPDATE
// ================================================================

let _lastScoreTick = 0;
const speedoCtx   = document.getElementById('speedo-canvas').getContext('2d');
const minimapCtx  = document.getElementById('minimap-canvas').getContext('2d');

function updateHUD(dt) {
  if (!gameState.playing) return;
  const kmh = Math.abs(phys.speed) * 3.6;

  if (gameState.inCar) {
    gameState.elapsed += dt;
    _lastScoreTick    += dt;
    if (_lastScoreTick > 0.1) {
      gameState.score += Math.floor(kmh * 0.04 + 0.5);
      _lastScoreTick = 0;
    }
  }
  document.getElementById('hud-score').textContent = gameState.score;
  const min = Math.floor(gameState.elapsed / 60);
  const sec = Math.floor(gameState.elapsed % 60).toString().padStart(2, '0');
  document.getElementById('hud-time').textContent = `${min}:${sec}`;

  drawSpeedo(kmh);

  const gearEl = document.getElementById('speedo-gear');
  if (phys.speed < -0.5)     { gearEl.textContent = 'R'; gearEl.style.color = '#ff7700'; }
  else if (kmh < 1)           { gearEl.textContent = 'N'; gearEl.style.color = '#cccc00'; }
  else {
    const g = kmh < 20 ? 1 : kmh < 42 ? 2 : kmh < 68 ? 3 : kmh < 96 ? 4 : kmh < 120 ? 5 : 6;
    gearEl.textContent = g; gearEl.style.color = '#d4a017';
  }

  const st  = document.getElementById('hud-status');
  const inp = getInput();
  if (inp.hb && Math.abs(phys.speed) > 1) st.textContent = 'HANDBRAKE';
  else if (phys.speed < -0.5)             st.textContent = 'REVERSE';
  else if (Math.abs(phys.speed) < 0.5)    st.textContent = 'STOPPED';
  else                                    st.textContent = 'DRIVE';

  if (!gameState.inCar) {
    const dist = Math.hypot(walkState.x - phys.position.x, walkState.z - phys.position.z);
    document.getElementById('enter-hint').classList.toggle('hidden', dist > 6);
    document.getElementById('exit-hint').classList.add('hidden');
  } else {
    document.getElementById('exit-hint').classList.remove('hidden');
    document.getElementById('enter-hint').classList.add('hidden');
  }

  drawMinimap();
}

function drawSpeedo(kmh) {
  const w = 140, h = 140, cx = 70, cy = 70, r = 58;
  speedoCtx.clearRect(0, 0, w, h);

  speedoCtx.beginPath();
  speedoCtx.arc(cx, cy, r, 0, Math.PI * 2);
  speedoCtx.strokeStyle = 'rgba(255,255,255,0.05)';
  speedoCtx.lineWidth = 10; speedoCtx.stroke();

  const startA = Math.PI * 0.75;
  const endA   = startA + Math.PI * 1.5 * Math.min(kmh / 160, 1);
  const col    = kmh > 110 ? '#e74c3c' : kmh > 75 ? '#f39c12' : '#00c8ff';
  speedoCtx.beginPath();
  speedoCtx.arc(cx, cy, r, startA, endA);
  speedoCtx.strokeStyle = col;
  speedoCtx.lineWidth = 7; speedoCtx.lineCap = 'round'; speedoCtx.stroke();

  for (let v = 0; v <= 160; v += 20) {
    const a  = startA + Math.PI * 1.5 * (v / 160);
    speedoCtx.beginPath();
    speedoCtx.moveTo(cx + (r-14)*Math.cos(a), cy + (r-14)*Math.sin(a));
    speedoCtx.lineTo(cx + r*Math.cos(a),      cy + r*Math.sin(a));
    speedoCtx.strokeStyle = 'rgba(255,255,255,0.25)'; speedoCtx.lineWidth = 1.5; speedoCtx.stroke();
  }

  const na = startA + Math.PI * 1.5 * Math.min(kmh / 160, 1);
  speedoCtx.beginPath();
  speedoCtx.moveTo(cx, cy);
  speedoCtx.lineTo(cx + (r-16)*Math.cos(na), cy + (r-16)*Math.sin(na));
  speedoCtx.strokeStyle = '#ffffff'; speedoCtx.lineWidth = 1.5; speedoCtx.stroke();

  document.getElementById('speedo-num').textContent = Math.round(kmh);
}

function drawMinimap() {
  const W = 120, H = 120;
  minimapCtx.clearRect(0, 0, W, H);
  minimapCtx.fillStyle = 'rgba(4,8,20,0.9)'; minimapCtx.fillRect(0, 0, W, H);

  const roadPx = (ROAD_W / 180) * W * 3;
  minimapCtx.fillStyle = 'rgba(30,36,54,1)';
  minimapCtx.fillRect(W/2 - roadPx/2, 0, roadPx, H);

  const scale = 0.8, mapCX = W/2, mapCZ = H/2;
  minimapCtx.fillStyle = '#d4a017';
  minimapCtx.beginPath(); minimapCtx.arc(mapCX, mapCZ, 4, 0, Math.PI*2); minimapCtx.fill();

  minimapCtx.save(); minimapCtx.translate(mapCX, mapCZ); minimapCtx.rotate(-phys.yaw);
  minimapCtx.fillStyle = '#00c8ff'; minimapCtx.fillRect(-1, -10, 2, 8);
  minimapCtx.restore();

  enemies.forEach(e => {
    const dx = (e.position.x - phys.position.x) * scale;
    const dz = (e.position.z - phys.position.z) * scale;
    const ex = mapCX + dx, ey = mapCZ + dz;
    if (ex > 0 && ex < W && ey > 0 && ey < H) {
      minimapCtx.fillStyle = '#e74c3c';
      minimapCtx.fillRect(ex-2, ey-3, 4, 6);
    }
  });
}

// ================================================================
// §16  ENTER / EXIT CAR
// ================================================================

function enterCar() {
  gameState.inCar = true;
  playerCar.visible = true;
  playerFoot.visible = false;
  phys.position.x = walkState.x;
  phys.position.z = walkState.z;
}

function exitCar() {
  gameState.inCar = false;
  phys.speed = 0;
  walkState.x   = phys.position.x - Math.sin(phys.yaw) * 2.5;
  walkState.z   = phys.position.z - Math.cos(phys.yaw) * 2.5;
  walkState.yaw = phys.yaw;
  playerFoot.visible = true;
  playerCar.visible  = true;
}

// ================================================================
// §17  GAME FLOW
// ================================================================

function startGame() {
  gameState.playing = true; gameState.inCar = true;
  gameState.score = 0; gameState.health = 100; gameState.elapsed = 0;

  phys.position.set(0, 0, 0);
  phys.yaw = 0; phys.speed = 0; phys.steer = 0;
  walkState.x = 0; walkState.z = 0; walkState.yaw = 0;

  document.getElementById('hud-dmg-fill').style.width = '100%';
  document.getElementById('hud-dmg-fill').style.background = '#2ecc71';
  playerCar.visible = true; playerFoot.visible = false;

  enemies.forEach(e => scene.remove(e)); enemies.length = 0;
  for (let i = 0; i < 5; i++) spawnEnemy();

  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
}

function triggerGameOver() {
  gameState.playing = false;
  if (gameState.score > bestScore) {
    bestScore = gameState.score;
    localStorage.setItem('nero_best', bestScore);
  }
  document.getElementById('go-score').textContent = gameState.score;
  document.getElementById('go-best').textContent  = bestScore;
  document.getElementById('hud-best').textContent = bestScore;
  document.getElementById('gameover-screen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
}

// ================================================================
// §18  MAIN LOOP
// ================================================================

let lastT = 0, prevEState = false;

function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min((ts - lastT) / 1000, 0.05);
  lastT = ts;
  if (dt <= 0) return;

  if (gameState.playing) {
    const inp = getInput();

    const ePressed = inp.e;
    if (ePressed && !prevEState) {
      if (gameState.inCar) exitCar();
      else {
        const dist = Math.hypot(walkState.x - phys.position.x, walkState.z - phys.position.z);
        if (dist < 6) enterCar();
      }
    }
    prevEState = ePressed;

    if (gameState.inCar) {
      stepCarPhysics(dt, inp);
      syncCarMesh();
      checkCollisions();
    } else {
      stepWalkPhysics(dt, inp);
      playerFoot.position.set(walkState.x, 0, walkState.z);
      // FIX: humanoid faces forward (toward +Z = direction of travel)
      playerFoot.rotation.y = walkState.yaw;
    }

    updateEnemies(dt);
    updateRoad();
    updateHUD(dt);
    stepCamera(dt);
  }

  renderer.render(scene, camera);
}

// ================================================================
// §19  INIT
// ================================================================

function init() {
  const bar = document.getElementById('loading-bar');
  const pct = document.getElementById('loading-pct');

  const steps = [
    ['湾岸ハイウェイを構築中...', buildWanganEnvironment],
    ['ランボルギーニを構築中...', buildLamborghini],
    ['ドライバーを構築中...',     buildPlayer],
    ['トラフィックを配置中...',   () => { for (let i = 0; i < 6; i++) spawnEnemy(); }],
    ['タッチUIを構築中...',      buildTouchControls],
  ];

  let i = 0;
  function doStep() {
    if (i >= steps.length) {
      bar.style.width = '100%'; pct.textContent = '100%';
      setTimeout(() => {
        const ls = document.getElementById('loading-screen');
        ls.style.opacity = '0';
        setTimeout(() => {
          ls.remove();
          document.getElementById('title-screen').classList.remove('hidden');
        }, 600);
      }, 200);
      return;
    }
    const p = Math.round((i / steps.length) * 100);
    bar.style.width = p + '%'; pct.textContent = p + '%';
    steps[i][1]();
    i++;
    setTimeout(doStep, 80);
  }
  doStep();

  camPos.set(0, C.CAM_H + 3, C.CAM_DIST + 3);
  camera.position.copy(camPos);
  camera.lookAt(0, 0, 0);

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-retry').addEventListener('click', startGame);

  requestAnimationFrame(ts => { lastT = ts; loop(ts); });
}

init();
