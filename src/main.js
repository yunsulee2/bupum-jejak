import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createFluorescentModule } from './fluorescent-module.js';
import './style.css';

const $ = (selector) => document.querySelector(selector);

const ui = {
  app: $('#app'),
  scene: $('#scene'),
  loading: $('#loading-screen'),
  loadingProgress: $('#loading-progress'),
  intro: $('#intro'),
  start: $('#start-button'),
  fluorescentStart: $('#fluorescent-start-button'),
  fluorescentWorkspace: $('#fluorescent-workspace'),
  fluorescentCompletion: $('#fluorescent-completion'),
  shop: $('#shop'),
  shopCategories: $('#shop-categories'),
  shopProgress: $('#shop-progress'),
  shopGroup: $('#shop-group'),
  shopCode: $('#shop-code'),
  shopTitle: $('#shop-title'),
  shopDescription: $('#shop-description'),
  shopOptions: $('#shop-options'),
  cartLines: $('#cart-lines'),
  cartTotal: $('#cart-total'),
  cartCount: $('#cart-count'),
  catalogDate: $('#catalog-date'),
  priceNotice: $('#price-notice'),
  purchase: $('#purchase-button'),
  sessionLabel: $('#session-label'),
  workspace: $('#workspace'),
  partList: $('#part-list'),
  partCount: $('#part-count'),
  chapter: $('#chapter-label'),
  stepCurrent: $('#step-current'),
  stepTotal: $('#step-total'),
  progress: $('#progress-fill'),
  stepKicker: $('#step-kicker'),
  stepTitle: $('#step-title'),
  stepCopy: $('#step-copy'),
  stepSpec: $('#step-spec'),
  stepTool: $('#step-tool'),
  stepCheck: $('#step-check'),
  stepWarning: $('#step-warning'),
  variantList: $('#variant-list'),
  placementCopy: $('#placement-copy'),
  dragStatus: $('#drag-status'),
  dragStatusLabel: $('#drag-status-label'),
  dragCoach: $('#drag-coach'),
  dragDistance: $('#drag-distance'),
  phases: [...document.querySelectorAll('[data-phase]')],
  focus: $('#focus-button'),
  explode: $('#explode-button'),
  resetCamera: $('#reset-camera'),
  callout: $('#part-callout'),
  calloutCode: $('#callout-code'),
  calloutName: $('#callout-name'),
  toast: $('#toast'),
  completion: $('#completion'),
  completionTotal: $('#completion-total'),
  score: $('#score-value'),
  errors: $('#error-value'),
  restart: $('#restart-button'),
};

const state = {
  data: null,
  catalog: null,
  fluorescentData: null,
  shopCategories: [],
  shopIndex: 0,
  purchases: new Map(),
  shoppingComplete: false,
  stepIndex: 0,
  selectedId: null,
  selectedVariants: new Map(),
  installed: new Set(),
  errors: 0,
  ready: false,
  installing: false,
  dragging: null,
  poweredOn: false,
  powerStartedAt: 0,
  assemblyStartedAt: 0,
  exploded: false,
  explodeRestore: new Map(),
  toastTimer: null,
  audio: null,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0d0e);
scene.fog = new THREE.FogExp2(0x0a0d0e, 0.023);

const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 100);
const defaultCamera = {
  position: new THREE.Vector3(-10.8, 8.1, 12.6),
  target: new THREE.Vector3(0, 2.45, 1.15),
};
camera.position.copy(defaultCamera.position);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.74;
renderer.outputColorSpace = THREE.SRGBColorSpace;
ui.scene.append(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 4;
controls.maxDistance = 25;
controls.maxPolarAngle = Math.PI * 0.88;
controls.target.copy(defaultCamera.target);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

scene.add(new THREE.HemisphereLight(0xb9d7e4, 0x111516, 0.72));

const keyLight = new THREE.SpotLight(0xffe1bd, 19, 35, Math.PI / 5, 0.55, 1.2);
keyLight.position.set(-7, 14, 7);
keyLight.target.position.set(0, 2, 0);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
scene.add(keyLight, keyLight.target);

const rimLight = new THREE.SpotLight(0x65d8c2, 13, 28, Math.PI / 4, 0.7, 1.5);
rimLight.position.set(8, 10, -3);
rimLight.target.position.set(0, 2, 0);
scene.add(rimLight, rimLight.target);

const amberLight = new THREE.PointLight(0xff9f4d, 4, 14, 2);
amberLight.position.set(-2, 3, 5);
scene.add(amberLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(42, 42),
  new THREE.MeshStandardMaterial({ color: 0x111617, roughness: 0.92, metalness: 0.08 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.09;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(32, 64, 0x27423f, 0x1a2424);
grid.position.y = -0.075;
grid.material.opacity = 0.38;
grid.material.transparent = true;
scene.add(grid);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.14, 0.3, 1.32);
composer.addPass(bloom);

const loader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const modelRoot = new THREE.Group();
scene.add(modelRoot);

const partRoots = new Map();
const basePositions = new Map();
const benchOffset = new THREE.Vector3(0.42, 0.45, 4.2);
const pendingOffsets = {
  'desk-frame': new THREE.Vector3(4.2, 0.55, 3.8),
  'desk-top': new THREE.Vector3(-1.4, 1.5, 4.1),
  'chair-base': new THREE.Vector3(4.2, 0.65, -1.8),
  'chair-body': new THREE.Vector3(-3.1, 1.4, 2.3),
  'monitor-stand': new THREE.Vector3(3.3, 0.85, 2.8),
  'monitor-panel': new THREE.Vector3(-3.2, 1.4, 2.9),
  cpu: new THREE.Vector3(0.25, -3.0, 0.25),
  ssd: new THREE.Vector3(0.24, -2.35, 1.35),
  ram: new THREE.Vector3(0.25, -2.75, -1.05),
  cooler: new THREE.Vector3(0.34, -3.15, -1.45),
  psu: new THREE.Vector3(0.15, 1.1, 4.2),
  gpu: new THREE.Vector3(1.05, -2.3, 3.6),
  cables: new THREE.Vector3(0.45, -2.1, -1.8),
};

let selectionHelper = null;
let targetHelper = null;
let targetFill = null;
let modelScene = null;
let lastFrame = performance.now();
const fanGroups = [];
const rgbMaterials = [];
const rgbLights = [];
const furnitureRoots = [];
let roomRoot = null;
let pcAssemblyRig = null;
let pcAssemblyBench = null;
let fluorescentModule = null;

function finishMaterial(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? 0.52,
    metalness: options.metalness ?? 0.18,
    clearcoat: options.clearcoat ?? 0.08,
    clearcoatRoughness: 0.45,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

function addBox(parent, name, size, position, material, radius = 0.06) {
  const geometry = radius > 0
    ? new RoundedBoxGeometry(size[0], size[1], size[2], 3, Math.min(radius, ...size.map((value) => value / 4)))
    : new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, name, radius, height, position, material, axis = 'y', segments = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
  mesh.name = name;
  mesh.position.set(...position);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function variantGroup(root, id) {
  const group = new THREE.Group();
  group.name = `${root.name}_${id}`;
  group.userData.variantId = id;
  root.add(group);
  return group;
}

function buildFurnitureScene() {
  const darkMetal = finishMaterial(0x202728, { roughness: 0.34, metalness: 0.72 });
  const softBlack = finishMaterial(0x171b1d, { roughness: 0.72, metalness: 0.08 });
  const graphite = finishMaterial(0x353d3e, { roughness: 0.48, metalness: 0.45 });
  const whiteMetal = finishMaterial(0xd9dfdf, { roughness: 0.34, metalness: 0.52 });
  const greyTop = finishMaterial(0x5b6262, { roughness: 0.66, metalness: 0.06 });
  const whiteTop = finishMaterial(0xe3dfd5, { roughness: 0.54, metalness: 0.02 });
  const blackGlass = finishMaterial(0x090c0f, { roughness: 0.09, metalness: 0.2, clearcoat: 1 });
  const mint = finishMaterial(0x45d5ba, { emissive: 0x123c34, emissiveIntensity: 0.9, roughness: 0.3 });
  const purple = finishMaterial(0x8a62ff, { emissive: 0x24144f, emissiveIntensity: 0.9, roughness: 0.3 });
  const cyan = finishMaterial(0x69e7ff, { emissive: 0x153b48, emissiveIntensity: 1.3, roughness: 0.22 });
  const magenta = finishMaterial(0xff4f9a, { emissive: 0x451329, emissiveIntensity: 1.3, roughness: 0.22 });

  const deskFrame = new THREE.Group();
  deskFrame.name = 'part_desk_frame';
  deskFrame.position.set(-5, 0, 0);
  const ikeaFrame = variantGroup(deskFrame, 'ikea-utespelare');
  [-2.65, 2.65].forEach((x) => {
    [-0.9, 0.9].forEach((z) => addBox(ikeaFrame, 'ikea_leg', [0.14, 3.05, 0.14], [x, 1.52, z], darkMetal));
    addBox(ikeaFrame, 'ikea_side_rail', [0.16, 0.15, 2.05], [x, 2.92, 0], darkMetal);
  });
  addBox(ikeaFrame, 'ikea_crossbar', [5.5, 0.14, 0.14], [0, 1.05, 0.68], darkMetal);
  addBox(ikeaFrame, 'ikea_cable_net', [4.4, 0.06, 0.86], [0, 2.63, -0.72], graphite, 0.02);
  const deskerFrame = variantGroup(deskFrame, 'desker-motion-1600');
  [-2.45, 2.45].forEach((x) => {
    addBox(deskerFrame, 'motion_column', [0.32, 2.82, 0.28], [x, 1.45, 0], whiteMetal);
    addBox(deskerFrame, 'motion_foot', [0.42, 0.12, 1.85], [x, 0.06, 0], whiteMetal);
    addBox(deskerFrame, 'motion_motor', [0.64, 0.3, 0.42], [x, 2.72, 0], graphite);
  });
  addBox(deskerFrame, 'motion_crossbar', [5.05, 0.22, 0.28], [0, 2.68, 0], whiteMetal);

  const deskTop = new THREE.Group();
  deskTop.name = 'part_desk_top';
  deskTop.position.set(-5, 3.18, 0);
  const ikeaTop = variantGroup(deskTop, 'ikea-utespelare');
  addBox(ikeaTop, 'ikea_worktop', [6.45, 0.18, 2.7], [0, 0, 0], greyTop, 0.1);
  addBox(ikeaTop, 'ikea_rear_grid', [5.35, 0.08, 0.44], [0, 0.06, -1.46], darkMetal, 0.03);
  const deskerTop = variantGroup(deskTop, 'desker-motion-1600');
  addBox(deskerTop, 'motion_worktop', [6.45, 0.2, 2.42], [0, 0, 0], whiteTop, 0.1);
  addBox(deskerTop, 'motion_controller', [0.72, 0.2, 0.32], [2.35, -0.18, 1.02], softBlack, 0.06);
  [2.18, 2.36, 2.54].forEach((x) => addCylinder(deskerTop, 'motion_control_led', 0.035, 0.04, [x, -0.28, 1.16], cyan, 'y', 12));

  const chairBase = new THREE.Group();
  chairBase.name = 'part_chair_base';
  chairBase.position.set(-5, 0.12, 4.15);
  const buildChairBase = (parent, accent, wide = false) => {
    addCylinder(parent, 'chair_gas_lift', 0.15, 1.35, [0, 0.9, 0], graphite);
    addCylinder(parent, 'chair_hub', 0.3, 0.18, [0, 0.32, 0], darkMetal);
    for (let index = 0; index < 5; index += 1) {
      const angle = index * Math.PI * 0.4;
      const length = wide ? 1.18 : 1.02;
      const spoke = addBox(parent, 'chair_spoke', [length, 0.1, 0.16], [Math.cos(angle) * length * 0.46, 0.28, Math.sin(angle) * length * 0.46], darkMetal, 0.04);
      spoke.rotation.y = -angle;
      addCylinder(parent, 'chair_caster', 0.13, 0.18, [Math.cos(angle) * length, 0.13, Math.sin(angle) * length], softBlack, 'z', 18);
    }
    addCylinder(parent, 'chair_accent_ring', 0.2, 0.06, [0, 0.5, 0], accent);
  };
  buildChairBase(variantGroup(chairBase, 'sidiz-gc-pro'), mint, false);
  buildChairBase(variantGroup(chairBase, 'secretlab-titan-evo'), purple, true);

  const chairBody = new THREE.Group();
  chairBody.name = 'part_chair_body';
  chairBody.position.set(-5, 1.72, 4.15);
  const sidizBody = variantGroup(chairBody, 'sidiz-gc-pro');
  addBox(sidizBody, 'sidiz_seat', [1.75, 0.28, 1.72], [0, 0.05, 0], softBlack, 0.18);
  addBox(sidizBody, 'sidiz_back', [1.72, 2.45, 0.24], [0, 1.24, 0.7], graphite, 0.18).rotation.x = -0.12;
  addBox(sidizBody, 'sidiz_mesh', [1.32, 1.72, 0.08], [0, 1.3, 0.55], mint, 0.15).rotation.x = -0.12;
  [-1.05, 1.05].forEach((x) => {
    addBox(sidizBody, 'sidiz_arm_post', [0.12, 0.74, 0.12], [x, 0.52, 0], darkMetal);
    addBox(sidizBody, 'sidiz_arm_pad', [0.25, 0.12, 0.9], [x, 0.9, -0.12], softBlack, 0.07);
  });
  const titanBody = variantGroup(chairBody, 'secretlab-titan-evo');
  addBox(titanBody, 'titan_seat', [2.0, 0.34, 1.86], [0, 0.05, 0], softBlack, 0.2);
  addBox(titanBody, 'titan_back', [1.98, 2.78, 0.34], [0, 1.38, 0.72], softBlack, 0.22).rotation.x = -0.1;
  [-0.78, 0.78].forEach((x) => addBox(titanBody, 'titan_bolster', [0.28, 2.2, 0.48], [x, 1.35, 0.52], purple, 0.13).rotation.x = -0.1);
  addBox(titanBody, 'titan_headrest', [1.18, 0.48, 0.16], [0, 2.4, 0.5], purple, 0.12).rotation.x = -0.1;
  [-1.15, 1.15].forEach((x) => {
    addBox(titanBody, 'titan_arm_post', [0.14, 0.78, 0.14], [x, 0.52, 0], darkMetal);
    addBox(titanBody, 'titan_arm_pad', [0.3, 0.12, 0.94], [x, 0.94, -0.12], softBlack, 0.07);
  });

  const monitorStand = new THREE.Group();
  monitorStand.name = 'part_monitor_stand';
  monitorStand.position.set(-5, 3.35, -0.15);
  const samsungStand = variantGroup(monitorStand, 'samsung-g60sf');
  addBox(samsungStand, 'samsung_base', [1.65, 0.09, 0.82], [0, 0, 0], graphite, 0.12);
  addBox(samsungStand, 'samsung_column', [0.16, 1.52, 0.18], [0, 0.78, -0.15], darkMetal, 0.05);
  addCylinder(samsungStand, 'samsung_ring', 0.28, 0.07, [0, 1.45, -0.12], cyan, 'z', 32);
  const lgStand = variantGroup(monitorStand, 'lg-27gx790a');
  [-0.52, 0.52].forEach((x) => {
    const foot = addBox(lgStand, 'lg_v_foot', [1.22, 0.09, 0.16], [x * 0.7, 0, 0.18], graphite, 0.05);
    foot.rotation.y = x > 0 ? 0.48 : -0.48;
  });
  addBox(lgStand, 'lg_column', [0.18, 1.55, 0.2], [0, 0.8, -0.15], darkMetal, 0.05);
  addBox(lgStand, 'lg_stand_accent', [0.34, 0.12, 0.08], [0, 1.45, -0.02], magenta, 0.04);

  const monitorPanel = new THREE.Group();
  monitorPanel.name = 'part_monitor_panel';
  monitorPanel.position.set(-5, 5.18, -0.15);
  const buildPanel = (parent, accent, samsung = false) => {
    addBox(parent, 'monitor_frame', [3.05, 1.82, 0.16], [0, 0, 0], softBlack, 0.11);
    const screen = addBox(parent, 'monitor_oled_screen', [2.86, 1.61, 0.035], [0, 0, 0.1], blackGlass, 0.07);
    screen.material = screen.material.clone();
    screen.material.emissive.set(samsung ? 0x082933 : 0x2a071a);
    screen.material.emissiveIntensity = 0.9;
    if (samsung) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 12, 48), accent);
      ring.name = 'samsung_core_ring';
      ring.position.set(0, 0, -0.12);
      parent.add(ring);
    } else {
      const rear = addBox(parent, 'lg_hex_back', [1.12, 0.78, 0.08], [0, 0, -0.13], graphite, 0.2);
      rear.rotation.z = Math.PI / 4;
      addBox(parent, 'lg_rear_accent', [0.84, 0.05, 0.06], [0, -0.4, -0.19], accent, 0.02);
    }
  };
  buildPanel(variantGroup(monitorPanel, 'samsung-g60sf'), cyan, true);
  buildPanel(variantGroup(monitorPanel, 'lg-27gx790a'), magenta, false);

  [deskFrame, deskTop, chairBase, chairBody, monitorStand, monitorPanel].forEach((root) => {
    furnitureRoots.push(root);
    modelScene.add(root);
  });
}

function buildRoomScene() {
  roomRoot = new THREE.Group();
  roomRoot.name = 'completed_gaming_room';
  const roomFloor = finishMaterial(0x161a1b, { roughness: 0.88, metalness: 0.02 });
  const wall = finishMaterial(0x202527, { roughness: 0.93, metalness: 0 });
  const rug = finishMaterial(0x172d2b, { roughness: 0.98, metalness: 0 });
  addBox(roomRoot, 'room_floor', [14, 0.14, 11], [-2.2, -0.15, 1.2], roomFloor, 0.03);
  addBox(roomRoot, 'room_back_wall', [14, 8.2, 0.12], [-2.2, 4, -4.2], wall, 0.03);
  addBox(roomRoot, 'room_side_wall', [0.12, 8.2, 11], [-9.2, 4, 1.2], wall, 0.03);
  addBox(roomRoot, 'room_rug', [5.2, 0.035, 4.4], [-4.6, -0.04, 3.4], rug, 0.35);
  addBox(roomRoot, 'wall_shelf', [3.4, 0.12, 0.55], [-5.4, 5.9, -3.8], finishMaterial(0x4e3525, { roughness: 0.74 }), 0.04);
  [-6.5, -5.4, -4.3].forEach((x, index) => addBox(roomRoot, 'shelf_object', [0.38, 0.8 + index * 0.12, 0.3], [x, 6.35, -3.66], finishMaterial(index === 1 ? 0x8a62ff : 0x303b3b, { roughness: 0.6 }), 0.06));
  addBox(roomRoot, 'neon_bar_cyan', [3.2, 0.055, 0.04], [-5.1, 7.1, -4.05], finishMaterial(0x69e7ff, { emissive: 0x69e7ff, emissiveIntensity: 4, roughness: 0.1 }), 0.02).rotation.z = -0.26;
  addBox(roomRoot, 'neon_bar_magenta', [2.2, 0.055, 0.04], [-2.5, 6.7, -4.05], finishMaterial(0xff4f9a, { emissive: 0xff4f9a, emissiveIntensity: 4, roughness: 0.1 }), 0.02).rotation.z = 0.38;
  const roomLight = new THREE.PointLight(0x6ee7d0, 0, 12, 2);
  roomLight.name = 'room_rgb_light';
  roomLight.position.set(-4, 5.2, -2.4);
  roomRoot.add(roomLight);
  const warmLamp = new THREE.PointLight(0xffbd76, 0, 9, 2);
  warmLamp.name = 'room_warm_light';
  warmLamp.position.set(-8, 3.8, 2.5);
  roomRoot.add(warmLamp);
  roomRoot.visible = false;
  scene.add(roomRoot);
}

function buildPcAssemblyScene() {
  pcAssemblyRig = new THREE.Group();
  pcAssemblyRig.name = 'pc_horizontal_assembly_rig';
  modelScene.add(pcAssemblyRig);

  ['part_case', 'part_cpu', 'part_ssd', 'part_ram_a', 'part_ram_b', 'part_cooler', 'part_psu', 'part_motherboard', 'part_gpu', 'part_cables']
    .map((name) => modelScene.getObjectByName(name))
    .filter(Boolean)
    .forEach((root) => pcAssemblyRig.attach(root));

  pcAssemblyBench = new THREE.Group();
  pcAssemblyBench.name = 'pc_assembly_workbench';
  const benchTop = finishMaterial(0x343b3c, { roughness: 0.72, metalness: 0.18 });
  const benchEdge = finishMaterial(0x171c1d, { roughness: 0.38, metalness: 0.65 });
  const esd = finishMaterial(0x12302d, { roughness: 0.92, metalness: 0.02 });
  const tray = finishMaterial(0x1c2425, { roughness: 0.64, metalness: 0.34 });
  addBox(pcAssemblyBench, 'pc_bench_top', [8.8, 0.24, 11], [0.8, 0.72, 2.2], benchTop, 0.09);
  addBox(pcAssemblyBench, 'pc_esd_mat', [7.8, 0.05, 9.9], [0.8, 0.87, 2.2], esd, 0.12);
  [-3.0, 4.6].forEach((x) => [-2.3, 6.7].forEach((z) => {
    addBox(pcAssemblyBench, 'pc_bench_leg', [0.24, 0.76, 0.24], [x, 0.32, z], benchEdge, 0.05);
  }));
  addBox(pcAssemblyBench, 'parts_tray', [1.7, 0.12, 1.15], [-2.7, 0.97, 5.9], tray, 0.08);
  for (let index = 0; index < 8; index += 1) {
    addCylinder(pcAssemblyBench, 'tray_fastener', 0.055, 0.06, [-3.25 + (index % 4) * 0.35, 1.05, 5.65 + Math.floor(index / 4) * 0.38], benchEdge, 'y', 16);
  }
  addBox(pcAssemblyBench, 'esd_ground_point', [0.32, 0.04, 0.32], [4.25, 0.92, -2.1], finishMaterial(0x67dcc2, { emissive: 0x174d43, emissiveIntensity: 1.5 }), 0.08);
  pcAssemblyBench.visible = false;
  scene.add(pcAssemblyBench);
}

function setPcAssemblyPose(enabled) {
  if (!pcAssemblyRig || !pcAssemblyBench) return;
  if (enabled) {
    pcAssemblyRig.position.set(-1.6, 2.08, 0);
    pcAssemblyRig.rotation.set(0, 0, -Math.PI / 2);
    pcAssemblyBench.visible = true;
  } else {
    pcAssemblyRig.position.set(0, 0, 0);
    pcAssemblyRig.rotation.set(0, 0, 0);
    pcAssemblyBench.visible = false;
  }
  pcAssemblyRig.updateMatrixWorld(true);
}

function setFurnitureVariant(purchaseKey, variantId) {
  state.data.parts.filter((part) => part.purchaseKey === purchaseKey).forEach((part) => {
    rootsFor(part.id).forEach((root) => {
      root.children.forEach((child) => {
        if (child.userData.variantId) child.visible = child.userData.variantId === variantId;
      });
    });
  });
}

function rememberMaterial(mesh) {
  if (!mesh.isMesh || !mesh.material) return;
  if (!mesh.userData.purchaseMaterial) {
    mesh.material = mesh.material.clone();
    mesh.userData.purchaseMaterial = true;
    if (mesh.material.color) mesh.userData.purchaseBaseColor = `#${mesh.material.color.getHexString()}`;
    mesh.userData.purchaseBaseMap = mesh.material.map ?? null;
  }
}

function setCaseShellMode(useNeural) {
  const caseRoot = modelScene?.getObjectByName('part_case');
  if (!caseRoot) return;
  const neuralShell = caseRoot.getObjectByName('neural4d_case_shell');
  const proceduralShell = caseRoot.getObjectByName('procedural_case_shell');
  const neuralVariant = state.purchases.get('case') === 'fractal-north-xl';
  const showNeural = useNeural && neuralVariant;
  if (neuralShell) neuralShell.visible = showNeural;
  if (proceduralShell) proceduralShell.visible = !showNeural;
}

function configureCaseGlass() {
  const caseRoot = modelScene?.getObjectByName('part_case');
  if (!caseRoot) return;
  caseRoot.traverse((object) => {
    if (!object.isMesh || !object.name.startsWith('case_glass_panel_')) return;
    object.material = new THREE.MeshPhysicalMaterial({
      name: `강화유리_${object.name}`,
      color: 0x9fc7c5,
      metalness: 0,
      roughness: 0.08,
      transmission: 0.58,
      transparent: true,
      opacity: 0.24,
      thickness: 0.055,
      ior: 1.47,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    object.castShadow = false;
    object.renderOrder = 5;
  });
}

function tintPart(part, variant) {
  const tint = new THREE.Color(variant.tint ?? '#ffffff');
  rootsFor(part.id).forEach((root) => {
    const scale = variant.modelScale ?? (variant.id.endsWith('triple') || variant.id.includes('64') ? 1.025 : 1);
    root.scale.setScalar(scale);
    root.traverse((object) => {
      if (!object.isMesh || !object.material?.color || object.name.includes('blade')) return;
      rememberMaterial(object);
      const base = new THREE.Color(object.userData.purchaseBaseColor);
      object.material.color.copy(base).lerp(tint, 0.22);
    });
    if (part.id === 'gpu') {
      root.traverse((object) => {
        if (object.name.includes('gpu_fan_0.15')) object.visible = (variant.fanCount ?? 3) > 2;
      });
    }
  });
}

function setCableVisualMode(installed) {
  const root = modelScene?.getObjectByName('part_cables');
  const looseBundle = root?.getObjectByName('cable_loose_bundle');
  const installedRoutes = root?.getObjectByName('cable_installed_routes');
  if (looseBundle) looseBundle.visible = !installed;
  if (installedRoutes) installedRoutes.visible = installed;
}

function applyCaseAppearance() {
  const category = state.shopCategories.find((item) => item.id === 'case');
  const option = category && selectedOption(category);
  const caseRoot = modelScene.getObjectByName('part_case');
  if (!option || !caseRoot) return;
  const white = option.appearance?.style === 'glass-white';
  caseRoot.traverse((object) => {
    if (!object.isMesh || !object.material?.color) return;
    rememberMaterial(object);
    object.visible = !(white && object.name.startsWith('front_wood_slat'));
    if (object.userData.neural4d_asset) {
      object.material.map = white ? null : object.userData.purchaseBaseMap;
      object.material.color.set(white ? 0xdde3e3 : 0xffffff);
      object.material.roughness = white ? 0.32 : 0.5;
      object.material.needsUpdate = true;
    }
    if (object.name.startsWith('case_')) {
      const base = new THREE.Color(object.userData.purchaseBaseColor);
      object.material.color.copy(white ? new THREE.Color(0xdde3e3) : base);
      object.material.roughness = white ? 0.38 : 0.62;
    }
    if (object.name.startsWith('front_wood_slat') && !white) {
      object.material.color.set(0x7e4d2f);
    }
  });
}

function applyPurchasedAppearances() {
  ['desk', 'chair', 'monitor'].forEach((key) => setFurnitureVariant(key, state.purchases.get(key)));
  state.data.parts.filter((part) => !part.purchaseKey).forEach((part) => {
    const variant = part.variants.find((item) => item.id === state.purchases.get(part.id));
    if (variant) tintPart(part, variant);
  });
  applyCaseAppearance();
}

function syncAssemblyVisibility() {
  if (!state.shoppingComplete) return;
  const currentId = getStep()?.partId;
  const pcPhase = state.stepIndex >= 6;
  setPcAssemblyPose(pcPhase);
  setCaseShellMode(state.stepIndex >= 12 || state.installed.has('motherboard'));
  const caseRoot = modelScene.getObjectByName('part_case');
  if (caseRoot) caseRoot.visible = state.stepIndex >= 10;
  state.data.parts.forEach((part) => {
    const isBoardCarrier = part.id === 'motherboard' && state.stepIndex >= 6 && state.stepIndex <= 11;
    const visible = state.installed.has(part.id) || part.id === currentId || isBoardCarrier;
    rootsFor(part.id).forEach((root) => { root.visible = visible; });
  });
  if (currentId === 'cables' && !state.installed.has('cables')) placeCableBundleOnTray();
}

function resize() {
  const width = ui.scene.clientWidth;
  const height = ui.scene.clientHeight;
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  composer.setSize(width, height);
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;
}

function animateVector(object, target, duration = 760) {
  const start = object.position.clone();
  const startTime = performance.now();
  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      const now = performance.now();
      const progress = Math.min(1, (now - startTime) / duration);
      object.position.lerpVectors(start, target, easeInOutCubic(progress));
      if (progress >= 1) {
        window.clearInterval(timer);
        resolve();
      }
    }, 16);
  });
}

function tweenCamera(position, target, duration = 780) {
  const fromPosition = camera.position.clone();
  const fromTarget = controls.target.clone();
  const started = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - started) / duration);
    const eased = easeInOutCubic(progress);
    camera.position.lerpVectors(fromPosition, position, eased);
    controls.target.lerpVectors(fromTarget, target, eased);
    if (progress < 1) window.requestAnimationFrame(tick);
  }
  window.requestAnimationFrame(tick);
}

function getPart(id) {
  return state.data.parts.find((part) => part.id === id);
}

function getStep() {
  return state.data.steps[state.stepIndex];
}

function formatWon(value) {
  return `${new Intl.NumberFormat('ko-KR').format(value ?? 0)}원`;
}

function purchaseKeyFor(part) {
  return part.purchaseKey ?? part.id;
}

function buildShopCategories() {
  const pcCategories = state.data.parts.filter((part) => !part.purchaseKey).map((part) => ({
    id: part.id,
    code: part.code,
    group: 'PC 핵심 부품',
    name: part.shortName,
    description: `${part.spec} 규격에서 호환되는 실제 제품 ${part.variants.length}개를 비교합니다. 구매한 제품명과 외형 차이가 조립 단계에 유지됩니다.`,
    assemblyPartIds: [part.id],
    options: part.variants.map((variant) => ({
      ...variant,
      maker: variant.name.split(' ')[0],
      summary: variant.tradeoff,
    })),
  }));
  state.shopCategories = [...state.catalog.categories, ...pcCategories];
  state.shopCategories.forEach((category) => {
    if (!state.purchases.has(category.id)) state.purchases.set(category.id, category.options[0].id);
  });
}

function selectedOption(category) {
  return category.options.find((option) => option.id === state.purchases.get(category.id));
}

function renderShopNavigation() {
  let lastGroup = '';
  ui.shopCategories.innerHTML = state.shopCategories.map((category, index) => {
    const group = category.group !== lastGroup ? `<p>${category.group}</p>` : '';
    lastGroup = category.group;
    const choice = selectedOption(category);
    return `${group}<button type="button" data-shop-category="${index}" class="shop-category${index === state.shopIndex ? ' is-active' : ''}">
      <i>${String(index + 1).padStart(2, '0')}</i>
      <span><b>${category.name}</b><small>${choice?.name ?? '선택 필요'}</small></span>
      <em>✓</em>
    </button>`;
  }).join('');
  ui.shopCategories.querySelectorAll('[data-shop-category]').forEach((button) => {
    button.addEventListener('click', () => {
      state.shopIndex = Number(button.dataset.shopCategory);
      renderShop();
    });
  });
}

function renderShopOptions(category) {
  const selectedId = state.purchases.get(category.id);
  ui.shopOptions.innerHTML = category.options.map((option, index) => `
    <article class="shop-option${option.id === selectedId ? ' is-selected' : ''}" style="--product-accent:${option.tint ?? option.appearance?.accent ?? '#67dcc2'}">
      <button type="button" data-shop-option="${option.id}" aria-pressed="${option.id === selectedId}">
        <span class="product-visual${option.image ? ' has-image' : ''}" data-product="${category.id}" data-style="${option.appearance?.style ?? option.id}">
          ${option.image
            ? `<img src="${option.image}" alt="${option.name} 실제 제품 이미지" loading="eager" decoding="async"><span class="product-photo-label">실제 제품 이미지</span>`
            : '<i></i><i></i><i></i>'}
          <b>${option.badge}</b>
        </span>
        <span class="product-copy">
          <small>${option.maker ?? 'COMPATIBLE PRODUCT'} · 선택 ${String(index + 1).padStart(2, '0')}</small>
          <strong>${option.name}</strong>
          <em>${option.spec}</em>
          <p>${option.summary ?? option.tradeoff}</p>
          <span class="product-price">${formatWon(option.price)}<i>${option.id === selectedId ? '견적에 담김' : '이 제품 선택'}</i></span>
        </span>
      </button>
      <a href="${option.source ?? '#'}" target="_blank" rel="noreferrer">제품 정보 확인 ↗</a>
    </article>
  `).join('');
  ui.shopOptions.querySelectorAll('[data-shop-option]').forEach((button) => {
    button.addEventListener('click', () => {
      state.purchases.set(category.id, button.dataset.shopOption);
      playTone('select');
      renderShop();
      showToast(`${selectedOption(category).name}을 견적에 담았습니다.`, 'success');
    });
  });
}

function purchaseTotal() {
  return state.shopCategories.reduce((total, category) => total + (selectedOption(category)?.price ?? 0), 0);
}

function renderCart() {
  ui.cartLines.innerHTML = state.shopCategories.map((category) => {
    const option = selectedOption(category);
    return `<button type="button" data-cart-category="${category.id}">
      <span><b>${category.name}</b><small>${option?.name ?? '선택 필요'}</small></span>
      <strong>${option ? formatWon(option.price) : '-'}</strong>
    </button>`;
  }).join('');
  ui.cartLines.querySelectorAll('[data-cart-category]').forEach((button) => {
    button.addEventListener('click', () => {
      state.shopIndex = state.shopCategories.findIndex((category) => category.id === button.dataset.cartCategory);
      renderShop();
    });
  });
  const selectedCount = state.shopCategories.filter((category) => selectedOption(category)).length;
  ui.cartCount.textContent = String(selectedCount);
  ui.cartTotal.textContent = formatWon(purchaseTotal());
  ui.purchase.disabled = selectedCount !== state.shopCategories.length;
}

function renderShop() {
  const category = state.shopCategories[state.shopIndex];
  if (!category) return;
  ui.shopProgress.textContent = `${String(state.shopIndex + 1).padStart(2, '0')} / ${String(state.shopCategories.length).padStart(2, '0')}`;
  ui.shopGroup.textContent = category.group;
  ui.shopCode.textContent = category.code;
  ui.shopTitle.textContent = category.name;
  ui.shopDescription.textContent = category.description;
  renderShopNavigation();
  renderShopOptions(category);
  renderCart();
}

function openShop() {
  ensureAudio();
  ui.intro.hidden = true;
  ui.shop.hidden = false;
  ui.sessionLabel.textContent = '게이밍 룸 · 제품 구매';
  ui.app.dataset.mode = 'shop';
  renderShop();
  showToast('12개 품목을 비교하세요. 기본 견적은 모두 호환되는 구성입니다.');
}

function rootsFor(id) {
  return partRoots.get(id) ?? [];
}

function targetOffsetFor(id) {
  const preAssembly = ['cpu', 'ssd', 'ram', 'cooler'].includes(id);
  if (preAssembly && !state.installed.has('motherboard')) return benchOffset;
  return new THREE.Vector3();
}

function setRootOffset(root, offset) {
  const base = basePositions.get(root.uuid) ?? new THREE.Vector3();
  root.position.copy(base).add(offset);
}

function initializePartLayout() {
  rootsFor('motherboard').forEach((root) => setRootOffset(root, benchOffset));
  state.data.parts.forEach((part) => {
    if (part.id === 'motherboard') return;
    const offset = (['cpu', 'ssd', 'ram', 'cooler'].includes(part.id) ? benchOffset.clone() : new THREE.Vector3())
      .add(pendingOffsets[part.id] ?? new THREE.Vector3());
    rootsFor(part.id).forEach((root) => setRootOffset(root, offset));
  });
}

function expandByVisibleMeshes(box, root) {
  root.updateWorldMatrix(true, true);
  root.traverseVisible((object) => {
    if (!object.isMesh || !object.geometry) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox) return;
    box.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  return box;
}

function partBounds(id) {
  const box = new THREE.Box3();
  rootsFor(id).forEach((root) => expandByVisibleMeshes(box, root));
  return box;
}

function partBoundsAtTarget(id) {
  const box = new THREE.Box3();
  rootsFor(id).forEach((root) => {
    const rootBox = expandByVisibleMeshes(new THREE.Box3(), root);
    if (rootBox.isEmpty()) return;
    const base = basePositions.get(root.uuid) ?? new THREE.Vector3();
    const targetLocal = base.clone().add(targetOffsetFor(id));
    const currentWorld = root.getWorldPosition(new THREE.Vector3());
    const targetWorld = root.parent.localToWorld(targetLocal.clone());
    rootBox.translate(targetWorld.sub(currentWorld));
    box.union(rootBox);
  });
  return box;
}

function placeCableBundleOnTray() {
  const tray = pcAssemblyBench?.getObjectByName('parts_tray');
  const bounds = partBounds('cables');
  if (!tray || bounds.isEmpty()) return;
  const desired = new THREE.Box3().setFromObject(tray, true).getCenter(new THREE.Vector3());
  desired.y += 0.17;
  const worldDelta = desired.sub(bounds.getCenter(new THREE.Vector3()));
  rootsFor('cables').forEach((root) => {
    const parentRotation = root.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    const parentScale = root.parent.getWorldScale(new THREE.Vector3());
    const localDelta = worldDelta.clone().applyQuaternion(parentRotation).divide(parentScale);
    root.position.add(localDelta);
  });
}

function disposeTargetGuide() {
  if (targetHelper) {
    scene.remove(targetHelper);
    targetHelper.geometry.dispose();
    targetHelper.material.dispose();
    targetHelper = null;
  }
  if (targetFill) {
    scene.remove(targetFill);
    targetFill.geometry.dispose();
    targetFill.material.dispose();
    targetFill = null;
  }
}

function showTargetGuide(id) {
  disposeTargetGuide();
  if (!id || state.installed.has(id)) return;
  const bounds = partBoundsAtTarget(id);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  size.x = Math.max(size.x, 0.22);
  size.y = Math.max(size.y, 0.16);
  size.z = Math.max(size.z, 0.22);

  targetHelper = new THREE.Box3Helper(
    new THREE.Box3().setFromCenterAndSize(center, size.clone().multiplyScalar(1.08)),
    new THREE.Color(0x67dcc2),
  );
  targetHelper.material.transparent = true;
  targetHelper.material.opacity = state.selectedVariants.has(id) ? 0.95 : 0.42;
  targetHelper.material.depthTest = false;
  targetHelper.renderOrder = 12;
  scene.add(targetHelper);

  targetFill = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshBasicMaterial({
      color: 0x67dcc2,
      transparent: true,
      opacity: state.selectedVariants.has(id) ? 0.075 : 0.025,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  targetFill.position.copy(center);
  targetFill.renderOrder = 11;
  scene.add(targetFill);
}

function refreshSelectionHelper() {
  if (selectionHelper) {
    scene.remove(selectionHelper);
    selectionHelper.geometry.dispose();
    selectionHelper.material.dispose();
    selectionHelper = null;
  }
  if (!state.selectedId) return;
  const part = getPart(state.selectedId);
  const bounds = partBounds(part.id);
  if (bounds.isEmpty()) return;
  selectionHelper = new THREE.Box3Helper(bounds, new THREE.Color(part.accent));
  selectionHelper.renderOrder = 10;
  scene.add(selectionHelper);
}

function selectPart(id, focus = false) {
  if (!getPart(id) || state.installing) return;
  const step = getStep();
  if (step && id !== step.partId && !state.installed.has(id)) {
    showToast(`지금은 ${getPart(step.partId).shortName} 조립 단계입니다.`, 'error');
    playTone('error');
    return;
  }
  state.selectedId = id;
  const part = getPart(id);
  ui.partList.querySelectorAll('[data-part]').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.part === id);
  });
  ui.calloutCode.textContent = part.code;
  const variant = part.variants?.find((item) => item.id === state.selectedVariants.get(id));
  ui.calloutName.textContent = variant ? `${part.shortName} · ${variant.name}` : part.shortName;
  ui.callout.hidden = false;
  refreshSelectionHelper();
  if (focus) focusSelected();
}

function renderInventory() {
  ui.partList.innerHTML = state.data.parts.map((part, index) => `
    <button class="part-card" type="button" data-part="${part.id}" style="--part-accent:${part.accent}">
      <span class="part-index">${String(index + 1).padStart(2, '0')}</span>
      <span class="part-glyph" data-glyph="${part.id}"><i></i></span>
      <span class="part-copy"><b>${part.shortName}</b><small>${part.spec}</small></span>
      <span class="part-state">대기</span>
    </button>
  `).join('');

  ui.partList.querySelectorAll('[data-part]').forEach((button) => {
    button.addEventListener('click', () => selectPart(button.dataset.part, true));
  });
}

function setGuidePhase(phase) {
  const order = ['choose', 'grab', 'drop'];
  const activeIndex = order.indexOf(phase);
  ui.phases.forEach((item) => {
    const index = order.indexOf(item.dataset.phase);
    item.classList.toggle('is-active', index === activeIndex);
    item.classList.toggle('is-done', index < activeIndex);
  });
}

function renderVariants(part) {
  const selected = state.selectedVariants.get(part.id);
  ui.variantList.innerHTML = part.variants.map((variant) => `
    <button class="variant-card${selected === variant.id ? ' is-selected' : ' is-unpurchased'}" type="button"
      data-variant="${variant.id}" style="--variant-tint:${variant.tint}" ${state.shoppingComplete ? 'disabled' : ''}>
      <span class="variant-badge">${variant.badge}</span>
      <b>${variant.name}</b>
      <small>${variant.spec}</small>
      <p>${variant.tradeoff}</p>
      <i>${selected === variant.id ? `구매 완료 · ${formatWon(variant.price)}` : state.shoppingComplete ? '미구매 제품' : '선택'}</i>
    </button>
  `).join('');

  if (!state.shoppingComplete) {
    ui.variantList.querySelectorAll('[data-variant]').forEach((button) => {
      button.addEventListener('click', () => chooseVariant(part.id, button.dataset.variant));
    });
  }
}

function chooseVariant(partId, variantId) {
  if (state.installing || state.dragging || state.shoppingComplete) return;
  const step = getStep();
  if (!step || step.partId !== partId) return;
  const part = getPart(partId);
  const variant = part.variants.find((item) => item.id === variantId);
  if (!variant) return;
  state.selectedVariants.set(partId, variantId);
  renderVariants(part);
  selectPart(partId, false);
  setGuidePhase('grab');
  ui.dragStatus.classList.add('is-ready');
  ui.dragStatusLabel.textContent = `3D ${part.shortName}을 마우스로 잡아 끌어보세요`;
  showTargetGuide(partId);
  showToast(`${variant.name}을 선택했습니다. 이제 3D 부품을 직접 옮기세요.`, 'success');
  playTone('select');
}

function updateStepUI() {
  const step = getStep();
  if (!step) return;
  syncAssemblyVisibility();
  const part = getPart(step.partId);
  ui.chapter.textContent = step.chapter;
  ui.stepCurrent.textContent = String(state.stepIndex + 1).padStart(2, '0');
  ui.stepTotal.textContent = String(state.data.steps.length).padStart(2, '0');
  ui.progress.style.transform = `scaleX(${state.stepIndex / state.data.steps.length})`;
  ui.stepKicker.textContent = step.kicker;
  ui.stepTitle.textContent = step.title;
  ui.stepCopy.textContent = step.copy;
  ui.stepSpec.textContent = part.spec;
  ui.stepTool.textContent = step.tool;
  ui.stepCheck.textContent = step.check;
  ui.stepWarning.textContent = step.warning;
  ui.placementCopy.textContent = step.guide;
  ui.partCount.textContent = `${String(state.installed.size).padStart(2, '0')} / ${String(state.data.parts.length).padStart(2, '0')}`;
  renderVariants(part);
  setGuidePhase(state.selectedVariants.has(part.id) ? 'grab' : 'choose');
  ui.dragStatus.classList.toggle('is-ready', state.selectedVariants.has(part.id));
  ui.dragStatus.classList.remove('is-near');
  ui.dragStatusLabel.textContent = state.selectedVariants.has(part.id)
    ? `3D ${part.shortName}을 마우스로 잡아 끌어보세요`
    : '위의 두 종류 중 사용할 부품을 먼저 선택하세요';
  updateInventoryStates();
  selectPart(step.partId, false);
  showTargetGuide(step.partId);
  window.setTimeout(focusCurrentTask, 90);
}

function updatePartCard(id, installed) {
  const card = ui.partList.querySelector(`[data-part="${id}"]`);
  if (!card) return;
  card.classList.toggle('is-installed', installed);
  card.querySelector('.part-state').textContent = installed ? '완료' : '대기';
}

function updateInventoryStates() {
  const currentId = getStep()?.partId;
  state.data.parts.forEach((part) => {
    const card = ui.partList.querySelector(`[data-part="${part.id}"]`);
    if (!card) return;
    const installed = state.installed.has(part.id);
    card.classList.toggle('is-installed', installed);
    card.classList.toggle('is-current', part.id === currentId);
    card.querySelector('.part-state').textContent = installed ? '완료' : part.id === currentId ? '현재' : '대기';
  });
}

function showToast(message, tone = 'neutral') {
  window.clearTimeout(state.toastTimer);
  ui.toast.textContent = message;
  ui.toast.dataset.tone = tone;
  ui.toast.classList.add('is-visible');
  state.toastTimer = window.setTimeout(() => ui.toast.classList.remove('is-visible'), 2800);
}

function ensureAudio() {
  if (state.audio) return state.audio;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  state.audio = new AudioContext();
  return state.audio;
}

function playTone(kind = 'select') {
  const context = ensureAudio();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  oscillator.type = kind === 'error' ? 'sawtooth' : 'sine';
  oscillator.frequency.setValueAtTime(kind === 'install' ? 180 : kind === 'error' ? 96 : 420, now);
  oscillator.frequency.exponentialRampToValueAtTime(kind === 'install' ? 520 : kind === 'error' ? 72 : 620, now + 0.15);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(kind === 'error' ? 0.06 : 0.035, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.24);
}

function setPointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

function pickPart(event, preferredId = null) {
  setPointerFromEvent(event);
  const intersections = raycaster.intersectObject(modelRoot, true);
  const ids = intersections.map((hit) => findPartId(hit.object)).filter(Boolean);
  if (preferredId && ids.includes(preferredId)) return preferredId;
  return ids[0] ?? null;
}

function screenPoint(worldPoint) {
  const projected = worldPoint.clone().project(camera);
  return new THREE.Vector2(
    (projected.x * 0.5 + 0.5) * ui.scene.clientWidth,
    (-projected.y * 0.5 + 0.5) * ui.scene.clientHeight,
  );
}

function currentDropDistance(id) {
  const current = screenPoint(partBounds(id).getCenter(new THREE.Vector3()));
  const target = screenPoint(partBoundsAtTarget(id).getCenter(new THREE.Vector3()));
  return { distance: current.distanceTo(target), current, target };
}

function directionHint(current, target) {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const horizontal = Math.abs(dx) > 32 ? (dx > 0 ? '오른쪽' : '왼쪽') : '';
  const vertical = Math.abs(dy) > 32 ? (dy > 0 ? '아래쪽' : '위쪽') : '';
  return `${horizontal}${horizontal && vertical ? ' ' : ''}${vertical}` || '조금 더 가까이';
}

function beginPartDrag(event) {
  if (ui.workspace.hidden || state.installing || state.exploded) return;
  const step = getStep();
  const id = pickPart(event, step?.partId);
  if (!id) return;
  if (!step || id !== step.partId) {
    selectPart(id, false);
    return;
  }
  if (!state.selectedVariants.has(id)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    showToast('먼저 안내판에서 사용할 부품 종류를 하나 선택하세요.', 'error');
    setGuidePhase('choose');
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  if (state.exploded) toggleExploded();
  selectPart(id, false);
  controls.enabled = false;
  renderer.domElement.setPointerCapture(event.pointerId);

  const center = partBounds(id).getCenter(new THREE.Vector3());
  const planeNormal = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, center);
  const grabPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(dragPlane, grabPoint);
  const roots = rootsFor(id);
  const originalPositions = new Map(roots.map((root) => [root.uuid, root.position.clone()]));

  state.dragging = {
    id,
    pointerId: event.pointerId,
    roots,
    originalPositions,
    dragPlane,
    grabPoint,
    startClient: new THREE.Vector2(event.clientX, event.clientY),
    moved: false,
  };
  if (selectionHelper) selectionHelper.visible = false;
  ui.dragCoach.hidden = false;
  ui.dragCoach.style.left = `${event.clientX}px`;
  ui.dragCoach.style.top = `${event.clientY}px`;
  ui.dragStatus.classList.add('is-dragging');
  ui.dragStatusLabel.textContent = '빛나는 장착 위치까지 부품을 옮기세요';
  setGuidePhase('drop');
}

function movePartDrag(event) {
  const drag = state.dragging;
  if (!drag || drag.pointerId !== event.pointerId) return;
  event.preventDefault();
  setPointerFromEvent(event);
  const point = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(drag.dragPlane, point)) return;
  const delta = point.sub(drag.grabPoint);
  drag.roots.forEach((root) => {
    const parentRotation = root.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    const parentScale = root.parent.getWorldScale(new THREE.Vector3());
    const localDelta = delta.clone().applyQuaternion(parentRotation).divide(parentScale);
    root.position.copy(drag.originalPositions.get(root.uuid)).add(localDelta);
  });
  drag.moved ||= drag.startClient.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5;

  const step = getStep();
  const { distance } = currentDropDistance(drag.id);
  const tolerance = step.dropTolerance ?? 90;
  const isNear = distance <= tolerance;
  ui.dragCoach.style.left = `${event.clientX}px`;
  ui.dragCoach.style.top = `${event.clientY}px`;
  ui.dragDistance.textContent = isNear ? '장착 가능 · 여기서 놓으세요' : `목표까지 ${Math.round(distance)}픽셀`;
  ui.dragCoach.classList.toggle('is-near', isNear);
  ui.dragStatus.classList.toggle('is-near', isNear);
  if (targetHelper) targetHelper.material.color.set(isNear ? 0xa7ff8a : 0x67dcc2);
  if (targetFill) {
    targetFill.material.color.set(isNear ? 0xa7ff8a : 0x67dcc2);
    targetFill.material.opacity = isNear ? 0.2 : 0.075;
  }
}

async function finishPartDrag(event) {
  const drag = state.dragging;
  if (!drag || drag.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  state.dragging = null;
  controls.enabled = true;
  ui.dragCoach.hidden = true;
  ui.dragCoach.classList.remove('is-near');
  ui.dragStatus.classList.remove('is-dragging', 'is-near');
  if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);

  const step = getStep();
  const drop = currentDropDistance(drag.id);
  const tolerance = step.dropTolerance ?? 90;
  if (drag.moved && drop.distance <= tolerance) {
    await completeDraggedInstall(drag.id);
    return;
  }

  const animations = drag.roots.map((root) => animateVector(root, drag.originalPositions.get(root.uuid), 360));
  await Promise.all(animations);
  refreshSelectionHelper();
  setGuidePhase('grab');
  ui.dragStatusLabel.textContent = `3D ${getPart(drag.id).shortName}을 다시 잡아 끌어보세요`;
  if (drag.moved) {
    state.errors += 1;
    playTone('error');
    showToast(`아직 장착 위치가 아닙니다. ${directionHint(drop.current, drop.target)}으로 옮겨보세요.`, 'error');
  } else {
    showToast('부품을 누른 상태로 빛나는 영역까지 끌어 놓으세요.');
  }
}

async function completeDraggedInstall(partId) {
  const step = getStep();
  if (!step || step.partId !== partId) return;
  state.installing = true;
  ui.app.dataset.mode = 'installing';
  disposeTargetGuide();

  let movingIds = [partId];
  if (partId === 'motherboard') movingIds = ['motherboard', 'cpu', 'ssd', 'ram', 'cooler'];
  const animations = [];
  movingIds.forEach((id) => {
    const targetOffset = partId === 'motherboard' ? new THREE.Vector3() : targetOffsetFor(id);
    rootsFor(id).forEach((root) => {
      const base = basePositions.get(root.uuid) ?? new THREE.Vector3();
      animations.push(animateVector(root, base.clone().add(targetOffset), 520));
    });
  });

  playTone('install');
  await Promise.all(animations);
  if (partId === 'cables') setCableVisualMode(true);
  state.installed.add(partId);
  updatePartCard(partId, true);
  ui.partCount.textContent = `${String(state.installed.size).padStart(2, '0')} / ${String(state.data.parts.length).padStart(2, '0')}`;
  refreshSelectionHelper();
  const part = getPart(partId);
  const variant = part.variants.find((item) => item.id === state.selectedVariants.get(partId));
  showToast(`${variant.name} 장착 완료. 위치와 규격 검증을 통과했습니다.`, 'success');

  state.stepIndex += 1;
  state.installing = false;
  ui.app.dataset.mode = 'work';
  if (state.stepIndex >= state.data.steps.length) {
    finishAssembly();
    return;
  }
  updateStepUI();
}

function focusSelected() {
  if (!state.selectedId) {
    showToast('먼저 확인할 부품을 선택하세요.');
    return;
  }
  const bounds = partBounds(state.selectedId);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const distance = Math.max(2.8, size.length() * 1.65);
  const direction = camera.position.clone().sub(controls.target).normalize();
  tweenCamera(center.clone().add(direction.multiplyScalar(distance)), center, 680);
}

function focusCurrentTask() {
  const step = getStep();
  if (!step || state.dragging || state.installing) return;
  const combined = partBounds(step.partId).clone().union(partBoundsAtTarget(step.partId));
  if (combined.isEmpty()) return;
  const center = combined.getCenter(new THREE.Vector3());
  const size = combined.getSize(new THREE.Vector3());
  const distance = Math.max(6.2, size.length() * 1.95);
  const direction = new THREE.Vector3(-1.05, 0.82, 1.2).normalize();
  tweenCamera(center.clone().add(direction.multiplyScalar(distance)), center, 640);
}

function toggleExploded() {
  if (state.installing || state.dragging) return;
  state.exploded = !state.exploded;
  ui.explode.classList.toggle('is-active', state.exploded);
  if (state.exploded) {
    state.explodeRestore.clear();
    state.data.parts.forEach((part, index) => {
      rootsFor(part.id).forEach((root) => {
        state.explodeRestore.set(root.uuid, root.position.clone());
        const angle = (index / state.data.parts.length) * Math.PI * 2;
        const offset = new THREE.Vector3(Math.cos(angle) * 1.45, 0.42 + (index % 3) * 0.22, Math.sin(angle) * 1.45);
        void animateVector(root, root.position.clone().add(offset), 520);
      });
    });
    showToast('분해도 보기: 각 부품의 위치와 결합 관계를 확인하세요.');
  } else {
    state.data.parts.forEach((part) => {
      rootsFor(part.id).forEach((root) => {
        const restore = state.explodeRestore.get(root.uuid);
        if (restore) void animateVector(root, restore, 520);
      });
    });
  }
  window.setTimeout(refreshSelectionHelper, 560);
}

function resetCamera() {
  tweenCamera(defaultCamera.position, defaultCamera.target, 720);
}

function initializeGamingEffects() {
  const groups = new Map();
  modelScene.traverse((object) => {
    if (!object.isMesh) return;
    const bladeMarker = object.name.lastIndexOf('_blade_');
    if (object.name.includes('fan') && bladeMarker > 0) {
      const prefix = object.name.slice(0, bladeMarker);
      if (!groups.has(prefix)) groups.set(prefix, []);
      groups.get(prefix).push(object);
    }

    const isRgbSurface = (object.name.includes('fan') && object.name.endsWith('_ring'))
      || object.name.includes('lightbar')
      || object.name.includes('status_led')
      || object.name === 'post_led';
    if (!isRgbSurface || !object.material) return;
    const material = object.material.clone();
    material.name = `게임 조명_${object.name}`;
    if (material.emissive) material.emissive.set(0x000000);
    material.emissiveIntensity = 0;
    object.material = material;
    rgbMaterials.push(material);
  });

  groups.forEach((blades, prefix) => {
    const hub = modelScene.getObjectByName(`${prefix}_hub`);
    if (!hub || !blades.length) return;
    const axis = prefix.startsWith('front_fan') || prefix.startsWith('rear_fan') || prefix.startsWith('cooler_fan')
      ? new THREE.Vector3(0, 1, 0)
      : prefix.startsWith('psu_fan')
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(1, 0, 0);
    fanGroups.push({
      prefix,
      blades,
      center: hub.position.clone(),
      axis,
      direction: fanGroups.length % 2 === 0 ? 1 : -1,
      speed: 8.5 + (fanGroups.length % 3) * 1.4,
    });
  });

  [
    { color: 0x5affd5, position: [-0.4, -0.7, 3.7] },
    { color: 0x8a62ff, position: [-0.5, 0.9, 2.3] },
    { color: 0xff4f9a, position: [0.45, -1.45, 2.7] },
  ].forEach(({ color, position }) => {
    const light = new THREE.PointLight(color, 0, 6.5, 2);
    light.position.set(...position);
    scene.add(light);
    rgbLights.push(light);
  });
}

function powerOnGamingRig() {
  state.poweredOn = true;
  state.powerStartedAt = performance.now();
  const monitorColor = state.purchases.get('monitor') === 'lg-27gx790a' ? 0xff4f9a : 0x69e7ff;
  furnitureRoots.forEach((root) => root.traverse((object) => {
    if (object.name !== 'monitor_oled_screen' || !object.material) return;
    object.material.emissive.set(monitorColor);
    object.material.emissiveIntensity = 1.7;
    object.material.color.set(0x061113);
  }));
  playTone('install');
}

function animateGamingEffects(now, delta) {
  const assemblyActive = state.shoppingComplete;
  if (!assemblyActive && !state.poweredOn) return;
  const assemblyElapsed = Math.max(0, now - state.assemblyStartedAt);
  const assemblyRamp = THREE.MathUtils.smoothstep(assemblyElapsed, 0, 650);
  const powerElapsed = Math.max(0, now - state.powerStartedAt);
  const powerRamp = state.poweredOn ? THREE.MathUtils.smoothstep(powerElapsed, 0, 1250) : 0;
  const fanStrength = state.poweredOn ? Math.max(0.72, powerRamp) : assemblyRamp * 0.72;
  const lightStrength = state.poweredOn ? Math.max(0.42, powerRamp) : assemblyRamp * 0.42;

  fanGroups.forEach((group) => {
    const angle = delta * group.speed * fanStrength * group.direction;
    const rotation = new THREE.Quaternion().setFromAxisAngle(group.axis, angle);
    group.blades.forEach((blade) => {
      blade.position.sub(group.center).applyAxisAngle(group.axis, angle).add(group.center);
      blade.quaternion.premultiply(rotation);
    });
  });

  rgbMaterials.forEach((material, index) => {
    const hue = (now * 0.000075 + index / Math.max(1, rgbMaterials.length)) % 1;
    material.emissive?.setHSL(hue, 0.92, 0.5);
    material.color?.setHSL(hue, 0.55, 0.16);
    material.emissiveIntensity = lightStrength * (2.8 + Math.sin(now * 0.003 + index) * 0.45);
  });

  rgbLights.forEach((light, index) => {
    const hue = (now * 0.000065 + index * 0.31) % 1;
    light.color.setHSL(hue, 0.9, 0.55);
    light.intensity = lightStrength * (6.5 + Math.sin(now * 0.0025 + index) * 1.2);
  });
}

function finishAssembly() {
  disposeTargetGuide();
  ui.progress.style.transform = 'scaleX(1)';
  ui.callout.hidden = true;
  if (selectionHelper) selectionHelper.visible = false;
  showToast('조립 완료. 전원 인가 자체 검사를 실행합니다.', 'success');

  powerOnGamingRig();
  setPcAssemblyPose(false);
  if (pcAssemblyRig) {
    pcAssemblyRig.position.x = -2.2;
    pcAssemblyRig.updateMatrixWorld(true);
  }
  if (roomRoot) {
    roomRoot.visible = true;
    roomRoot.getObjectByName('room_rgb_light').intensity = 7.5;
    roomRoot.getObjectByName('room_warm_light').intensity = 5.5;
  }
  const environment = modelScene.getObjectByName('environment');
  if (environment) environment.visible = false;
  floor.visible = false;
  grid.visible = false;
  ui.completionTotal.textContent = formatWon(purchaseTotal());

  tweenCamera(new THREE.Vector3(10.8, 8.7, 14.2), new THREE.Vector3(-1.25, 2.8, 0.7), 1300);
  window.setTimeout(() => {
    ui.workspace.hidden = true;
    ui.completion.hidden = false;
    ui.app.dataset.mode = 'complete';
    ui.errors.textContent = String(state.errors);
    ui.score.textContent = String(Math.max(60, 100 - state.errors * 8));
    playTone('install');
  }, 1350);
}

function updateCallout() {
  if (!state.selectedId || ui.callout.hidden) return;
  const bounds = partBounds(state.selectedId);
  if (bounds.isEmpty()) return;
  const point = bounds.getCenter(new THREE.Vector3());
  point.y += bounds.getSize(new THREE.Vector3()).y * 0.55;
  point.project(camera);
  const x = (point.x * 0.5 + 0.5) * ui.scene.clientWidth;
  const y = (-point.y * 0.5 + 0.5) * ui.scene.clientHeight;
  ui.callout.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  ui.callout.classList.toggle('is-offscreen', point.z > 1 || x < 0 || y < 0 || x > ui.scene.clientWidth || y > ui.scene.clientHeight);
}

function findPartId(object) {
  let current = object;
  while (current && current !== modelRoot) {
    if (current.userData.partId) return current.userData.partId;
    current = current.parent;
  }
  return null;
}

function startExperience() {
  openShop();
}

function startFluorescentExperience() {
  ensureAudio();
  ui.intro.hidden = true;
  ui.shop.hidden = true;
  ui.workspace.hidden = true;
  ui.completion.hidden = true;
  ui.fluorescentCompletion.hidden = true;
  ui.app.dataset.mode = 'fluorescent';
  fluorescentModule.start();
}

async function beginAssembly() {
  ensureAudio();
  state.stepIndex = 0;
  state.errors = 0;
  state.assemblyStartedAt = performance.now();
  state.installed.clear();
  state.selectedVariants.clear();
  state.data.parts.forEach((part) => {
    const variantId = state.purchases.get(purchaseKeyFor(part));
    if (variantId) state.selectedVariants.set(part.id, variantId);
  });
  state.shoppingComplete = true;
  setCableVisualMode(false);
  applyPurchasedAppearances();
  initializePartLayout();
  const environment = modelScene.getObjectByName('environment');
  if (environment) environment.visible = false;
  ui.shop.hidden = true;
  ui.workspace.hidden = false;
  ui.sessionLabel.textContent = '게이밍 룸 · 14단계 조립';
  ui.app.dataset.mode = 'work';
  renderInventory();
  updateStepUI();
  showToast('구매한 부품이 준비되었습니다. 3D 부품을 빛나는 위치까지 직접 끌어 놓으세요.');
}

function mapPartRoots() {
  state.data.parts.forEach((part) => {
    const roots = part.nodeNames.map((name) => modelScene.getObjectByName(name)).filter(Boolean);
    roots.forEach((root) => {
      basePositions.set(root.uuid, root.position.clone());
      root.traverse((object) => {
        object.userData.partId = part.id;
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
    });
    partRoots.set(part.id, roots);
  });
}

async function loadExperience() {
  [state.data, state.catalog, state.fluorescentData] = await Promise.all([
    fetch('/data/desktop-atx.json').then((response) => response.json()),
    fetch('/data/store-catalog.json').then((response) => response.json()),
    fetch('/data/fluorescent-lab.json').then((response) => response.json()),
  ]);
  buildShopCategories();
  ui.catalogDate.textContent = state.catalog.updatedAt;
  ui.priceNotice.textContent = state.catalog.notice;
  ui.stepTotal.textContent = String(state.data.steps.length).padStart(2, '0');

  return new Promise((resolve, reject) => {
    loader.load(
      '/models/pc-lab.glb?v=hero-parts-20260806-1',
      (gltf) => {
        modelScene = gltf.scene;
        modelScene.name = 'BUILD_LAB_DESKTOP_ATX';
        modelScene.traverse((object) => {
          if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        modelRoot.add(modelScene);
        buildFurnitureScene();
        buildPcAssemblyScene();
        configureCaseGlass();
        setCaseShellMode(true);
        buildRoomScene();
        initializeGamingEffects();
        mapPartRoots();
        setCableVisualMode(false);
        applyPurchasedAppearances();
        initializePartLayout();
        fluorescentModule = createFluorescentModule({
          data: state.fluorescentData,
          scene,
          camera,
          controls,
          pcRoot: modelRoot,
          globalFloor: floor,
          grid,
          setSessionLabel: (label) => { ui.sessionLabel.textContent = label; },
          tweenCamera,
        });
        window.__FLUORESCENT_LAB_QA__ = fluorescentModule.qa;
        state.ready = true;
        ui.start.disabled = false;
        ui.fluorescentStart.disabled = false;
        ui.app.dataset.mode = 'intro';
        ui.loading.classList.add('is-complete');
        window.setTimeout(() => { ui.loading.hidden = true; }, 600);
        resolve();
      },
      (event) => {
        const progress = event.total ? event.loaded / event.total : 0.55;
        ui.loadingProgress.style.transform = `scaleX(${Math.min(1, progress)})`;
      },
      reject,
    );
  });
}

function animate(now) {
  const delta = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  controls.update(delta);
  animateGamingEffects(now, delta);
  fluorescentModule?.update(now, delta);
  if (targetHelper && !state.dragging) {
    targetHelper.material.opacity = 0.58 + Math.sin(now * 0.004) * 0.28;
  }
  updateCallout();
  composer.render(clock.getDelta());
  window.requestAnimationFrame(animate);
}

ui.start.addEventListener('click', startExperience);
ui.fluorescentStart.addEventListener('click', startFluorescentExperience);
ui.purchase.addEventListener('click', beginAssembly);
ui.focus.addEventListener('click', focusSelected);
ui.explode.addEventListener('click', toggleExploded);
ui.resetCamera.addEventListener('click', resetCamera);
ui.restart.addEventListener('click', () => window.location.reload());
renderer.domElement.addEventListener('pointerdown', beginPartDrag, true);
renderer.domElement.addEventListener('pointermove', movePartDrag, true);
renderer.domElement.addEventListener('pointerup', finishPartDrag, true);
renderer.domElement.addEventListener('pointercancel', finishPartDrag, true);
window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Enter' && !ui.intro.hidden && state.ready) startExperience();
  if (event.code === 'KeyF' && !ui.workspace.hidden) focusSelected();
  if (event.code === 'KeyX' && !ui.workspace.hidden) toggleExploded();
  if (event.code === 'KeyR' && !ui.workspace.hidden) resetCamera();
});

resize();
window.requestAnimationFrame(animate);

window.__BUILD_LAB_QA__ = {
  shoppingState() {
    return {
      categories: state.shopCategories.length,
      selected: state.purchases.size,
      total: purchaseTotal(),
      purchases: Object.fromEntries(state.purchases),
    };
  },
  roomState() {
    return {
      visible: Boolean(roomRoot?.visible),
      furnitureParts: furnitureRoots.length,
      environmentVisible: modelScene?.getObjectByName('environment')?.visible ?? null,
      floorVisible: floor.visible,
    };
  },
  powerState() {
    return {
      poweredOn: state.poweredOn,
      fanGroups: fanGroups.length,
      rgbSurfaces: rgbMaterials.length,
      rgbLights: rgbLights.length,
      assemblyFansActive: state.shoppingComplete && !state.poweredOn,
    };
  },
  fanMotionState() {
    const blade = fanGroups[0]?.blades[0];
    return blade ? [...blade.position.toArray(), ...blade.quaternion.toArray()] : null;
  },
  pickDebug(clientX, clientY) {
    const event = { clientX, clientY };
    setPointerFromEvent(event);
    return raycaster.intersectObject(modelRoot, true).slice(0, 12).map((hit) => ({
      name: hit.object.name,
      id: findPartId(hit.object),
      distance: hit.distance,
    }));
  },
  dragState() {
    return state.dragging ? { id: state.dragging.id, moved: state.dragging.moved } : null;
  },
  caseGlassState() {
    const panels = [];
    modelScene?.getObjectByName('part_case')?.traverse((object) => {
      if (object.isMesh && object.name.startsWith('case_glass_panel_')) panels.push(object);
    });
    return {
      count: panels.length,
      transparent: panels.every((panel) => panel.material.transparent && panel.material.depthWrite === false),
      names: panels.map((panel) => panel.name),
    };
  },
  cameraState() {
    return {
      position: camera.position.toArray(),
      target: controls.target.toArray(),
      controlsEnabled: controls.enabled,
    };
  },
  partDebug(id) {
    const current = partBounds(id);
    const target = partBoundsAtTarget(id);
    return {
      id,
      currentCenter: current.getCenter(new THREE.Vector3()).toArray(),
      currentSize: current.getSize(new THREE.Vector3()).toArray(),
      targetCenter: target.getCenter(new THREE.Vector3()).toArray(),
      targetSize: target.getSize(new THREE.Vector3()).toArray(),
      roots: rootsFor(id).map((root) => ({
        name: root.name,
        localPosition: root.position.toArray(),
        worldPosition: root.getWorldPosition(new THREE.Vector3()).toArray(),
        parent: root.parent?.name ?? null,
      })),
    };
  },
  dragPoints() {
    const id = getStep()?.partId;
    if (!id || !rootsFor(id).length) return null;
    const canvasRect = renderer.domElement.getBoundingClientRect();
    const candidates = [new THREE.Box3().setFromObject(rootsFor(id)[0], true).getCenter(new THREE.Vector3())];
    rootsFor(id)[0].traverseVisible((object) => {
      if (!object.isMesh || !object.geometry?.attributes?.position) return;
      candidates.push(new THREE.Box3().setFromObject(object, true).getCenter(new THREE.Vector3()));
      const positions = object.geometry.attributes.position;
      const index = object.geometry.index;
      const indices = index ? [index.getX(0), index.getX(1), index.getX(2)] : [0, 1, 2];
      const centroid = new THREE.Vector3();
      indices.forEach((vertexIndex) => centroid.add(new THREE.Vector3().fromBufferAttribute(positions, vertexIndex)));
      candidates.push(object.localToWorld(centroid.multiplyScalar(1 / 3)));
    });
    const inventoryRight = document.querySelector('.inventory-panel').getBoundingClientRect().right;
    const guideLeft = document.querySelector('.guide-panel').getBoundingClientRect().left;
    const usable = candidates.map((world) => ({ world, screen: screenPoint(world) })).filter(({ world, screen }) => {
      if (screen.x < inventoryRight + 8 || screen.x > guideLeft - 8 || screen.y < 82 || screen.y > ui.scene.clientHeight - 80) return false;
      const projected = world.clone().project(camera);
      raycaster.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
      return raycaster.intersectObject(modelRoot, true).some((hit) => findPartId(hit.object) === id);
    }).sort((a, b) => Math.abs(a.screen.x - ui.scene.clientWidth * 0.5) - Math.abs(b.screen.x - ui.scene.clientWidth * 0.5));
    const pickWorld = usable[0]?.world ?? candidates[0];
    const groupWorld = partBounds(id).getCenter(new THREE.Vector3());
    const targetWorld = partBoundsAtTarget(id).getCenter(new THREE.Vector3());
    const pick = screenPoint(pickWorld);
    const desiredPick = screenPoint(pickWorld.clone().add(targetWorld).sub(groupWorld));
    return {
      from: { x: canvasRect.left + pick.x, y: canvasRect.top + pick.y },
      to: { x: canvasRect.left + desiredPick.x, y: canvasRect.top + desiredPick.y },
      id,
    };
  },
};

loadExperience().catch((error) => {
  console.error(error);
  ui.loading.querySelector('strong').textContent = '3D 자산을 불러오지 못했습니다';
  ui.loading.querySelector('p').textContent = '부품 불러오기 오류';
});
