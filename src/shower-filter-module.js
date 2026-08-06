import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const STAGES = ['inspect', 'shop', 'prepare', 'open', 'install', 'seal', 'test'];
const TWIST_TARGET = Math.PI * 2;
const STAGE_COPY = {
  inspect: {
    code: '진단 01',
    title: '필터를 주문하기 전에<br />샤워기부터 확인하세요',
    copy: '갈색으로 변했다고 아무 리필이나 사면 안 됩니다. 본체 모델과 필터 위치, 리필 계열, O링을 차례로 조사하세요.',
  },
  shop: {
    code: '판별 02',
    title: '같은 브랜드 안에서도<br />전용 리필을 찾으세요',
    copy: '일반형·시그니처·여행용은 모양과 세대가 다릅니다. 제품명보다 적용 본체와 필터 위치를 우선 비교하세요.',
  },
  prepare: {
    code: '준비 03',
    title: '젖은 손으로 잡기 전에<br />물부터 완전히 잠그세요',
    copy: '수전을 잠그고 샤워기 내부의 잔압을 뺍니다. 마른 수건을 깔아 작은 O링을 잃어버리지 않게 준비하세요.',
  },
  open: {
    code: '분리 04',
    title: '하단 캡을 손으로<br />반시계 방향으로 푸세요',
    copy: '플라이어나 과도한 힘을 쓰지 않습니다. 캡을 수직으로 받치며 한 바퀴 돌려 나사산을 천천히 분리하세요.',
  },
  install: {
    code: '장착 05',
    title: '새 필터를 끌어서<br />손잡이 안에 넣으세요',
    copy: '필터 양끝을 오염시키지 않게 잡고, 비어 있는 투명 바디 중앙에 수직으로 밀어 넣습니다.',
  },
  seal: {
    code: '밀폐 06',
    title: 'O링을 홈에 앉히고<br />캡을 손으로 잠그세요',
    copy: 'O링이 빠지거나 비틀리면 물이 샙니다. 홈 전체가 평평한지 확인한 뒤 캡을 시계 방향으로 체결하세요.',
  },
  test: {
    code: '검증 07',
    title: '물을 천천히 열고<br />충분히 흘려보내세요',
    copy: '새 필터를 통과한 물을 흘려보낸 다음 하단 연결부의 물방울과 수압, 물줄기 균일도를 확인하세요.',
  },
};

function physical(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? 0.42,
    metalness: options.metalness ?? 0.08,
    clearcoat: options.clearcoat ?? 0.18,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.3,
    transmission: options.transmission ?? 0,
    thickness: options.thickness ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    side: options.side ?? THREE.FrontSide,
    depthWrite: options.depthWrite ?? true,
  });
}

function box(parent, size, position, material, radius = 0.05) {
  const geometry = radius
    ? new RoundedBoxGeometry(size[0], size[1], size[2], 4, Math.min(radius, ...size.map((value) => value / 4)))
    : new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radii, height, position, material, segments = 48, axis = 'y') {
  const radiusTop = Array.isArray(radii) ? radii[0] : radii;
  const radiusBottom = Array.isArray(radii) ? radii[1] : radii;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.set(...position);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function torus(parent, radius, tube, position, material) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 20, 72), material);
  mesh.position.set(...position);
  mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function segment(parent, start, end, radius, material) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 12), material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  parent.add(mesh);
  return mesh;
}

function createFilter(color, name) {
  const group = new THREE.Group();
  group.name = name;
  const pleatMaterial = physical(color, { roughness: 0.84, metalness: 0, clearcoat: 0.05 });
  cylinder(group, 0.145, 1.28, [0, 0, 0], pleatMaterial, 48);
  const stripeMaterial = physical(color === 0xf4f5ee ? 0xd8ded7 : 0x8a572f, { roughness: 0.72 });
  for (let index = -5; index <= 5; index += 1) {
    torus(group, 0.148, 0.008, [0, index * 0.105, 0], stripeMaterial);
  }
  const endMaterial = physical(0xe7ebe5, { roughness: 0.56, metalness: 0.02 });
  cylinder(group, 0.16, 0.09, [0, 0.68, 0], endMaterial, 40);
  cylinder(group, 0.16, 0.09, [0, -0.68, 0], endMaterial, 40);
  return group;
}

function formatWon(value) {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}

export function createShowerFilterModule({
  data,
  scene,
  camera,
  controls,
  pcRoot,
  globalFloor,
  grid,
  setSessionLabel,
  tweenCamera,
}) {
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    workspace: $('#shower-workspace'),
    completion: $('#shower-completion'),
    menu: $('#shower-menu-button'),
    restart: $('#shower-restart-button'),
    stepCode: $('#shower-step-code'),
    title: $('#shower-title'),
    copy: $('#shower-copy'),
    progress: $('#shower-progress-fill'),
    routeProgress: $('#shower-route-progress'),
    route: [...document.querySelectorAll('[data-shower-stage]')],
    inspection: $('#shower-inspection'),
    clues: $('#shower-clues'),
    clueCount: $('#shower-clue-count'),
    specSheet: $('#shower-spec-sheet'),
    shop: $('#shower-shop'),
    products: $('#shower-products'),
    compare: $('#shower-compare'),
    prepare: $('#shower-prepare'),
    prepareButtons: [...document.querySelectorAll('[data-shower-prepare]')],
    prepareCount: $('#shower-prepare-count'),
    twist: $('#shower-twist'),
    twistDial: $('#shower-twist-dial'),
    twistHand: $('#shower-twist-hand'),
    twistLabel: $('#shower-twist-label'),
    twistCount: $('#shower-twist-count'),
    twistDirection: $('#shower-twist-direction'),
    twistHelp: $('#shower-twist-help'),
    install: $('#shower-install'),
    dragStage: $('#shower-drag-stage'),
    dragPiece: $('#shower-filter-piece'),
    dragSlot: $('#shower-filter-slot'),
    seal: $('#shower-seal'),
    oRingButton: $('#shower-oring-button'),
    sealDial: $('#shower-seal-dial'),
    sealHand: $('#shower-seal-hand'),
    sealCount: $('#shower-seal-count'),
    test: $('#shower-test'),
    flushButton: $('#shower-flush-button'),
    flushFill: $('#shower-flush-fill'),
    flushLabel: $('#shower-flush-label'),
    testResults: $('#shower-test-results'),
    feedback: $('#shower-feedback'),
    action: $('#shower-action'),
    purchasePrice: $('#shower-purchase-price'),
    errorCount: $('#shower-error-count'),
  };

  const state = {
    active: false,
    stage: 'inspect',
    clues: new Set(),
    prepare: new Set(),
    selectedProduct: null,
    purchasedProduct: null,
    purchaseErrors: 0,
    twistProgress: 0,
    twistDirection: -1,
    twisting: false,
    twistComplete: false,
    lastAngle: 0,
    filterInstalled: false,
    oRingSeated: false,
    sealed: false,
    flushing: false,
    flushProgress: 0,
    tested: false,
    completed: false,
  };

  const root = new THREE.Group();
  root.name = 'SHOWER_FILTER_REPLACEMENT_LAB';
  root.visible = false;
  scene.add(root);

  let showerUnit;
  let capGroup;
  let oldFilter;
  let newFilter;
  let oRing;
  let filterMarker;
  let labelMarker;
  let bodyMarker;
  let sealMarker;
  let waterJets;
  let showerGlow;
  const shelfFilterPosition = new THREE.Vector3(3.6, 1.42, -2.5);
  const housingFilterPosition = new THREE.Vector3(1.25, 2.46, -2.95);

  function buildBathroom() {
    const tile = physical(0xc9d2cf, { roughness: 0.42, metalness: 0.02, clearcoat: 0.48, clearcoatRoughness: 0.18 });
    const tileDark = physical(0x8d9a97, { roughness: 0.48, clearcoat: 0.34 });
    const grout = physical(0x65716f, { roughness: 0.92, metalness: 0 });
    const floorMaterial = physical(0x596561, { roughness: 0.66, clearcoat: 0.2 });
    const chrome = physical(0xd9e2e1, { roughness: 0.18, metalness: 0.93, clearcoat: 0.78, clearcoatRoughness: 0.08 });
    const white = physical(0xf1f3ef, { roughness: 0.35, clearcoat: 0.42 });
    const glass = physical(0xbfe7e6, { roughness: 0.08, transmission: 0.72, thickness: 0.25, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });

    box(root, [12, 0.18, 9], [0, -0.08, 0], floorMaterial, 0);
    box(root, [12, 6.8, 0.18], [0, 3.3, -3.5], tile, 0);
    box(root, [0.18, 6.8, 9], [-5.4, 3.3, 0], tileDark, 0);
    for (let x = -5; x <= 5; x += 1) box(root, [0.018, 6.6, 0.025], [x, 3.3, -3.39], grout, 0);
    for (let y = 0; y <= 6; y += 1) box(root, [11.6, 0.018, 0.025], [0, y + 0.3, -3.39], grout, 0);
    for (let x = -5; x <= 5; x += 1) box(root, [0.018, 0.02, 8.6], [x, 0.02, 0], grout, 0);
    for (let z = -3; z <= 4; z += 1) box(root, [11.6, 0.02, 0.018], [0, 0.02, z], grout, 0);

    // Glass shower partition and shelf keep the space recognisably domestic.
    box(root, [0.06, 4.9, 4.1], [-1.65, 2.48, -1.25], glass, 0.03);
    box(root, [0.09, 5.1, 0.09], [-1.65, 2.55, 0.8], chrome, 0.02);
    box(root, [2.65, 0.12, 0.74], [3.45, 1.08, -3.08], tileDark, 0.03);
    box(root, [2.5, 0.05, 0.62], [3.45, 1.17, -3.02], glass, 0.03);
    box(root, [1.55, 0.1, 0.62], [-0.42, 1.05, -3.08], tileDark, 0.03);
    box(root, [1.4, 0.035, 0.52], [-0.42, 1.13, -3.01], glass, 0.03);
    cylinder(root, [0.2, 0.23], 0.64, [3.0, 1.51, -3.02], physical(0xa6d6c5, { roughness: 0.4 }), 40);
    cylinder(root, [0.17, 0.2], 0.52, [3.48, 1.45, -3.02], physical(0xe7c78c, { roughness: 0.4 }), 40);
    box(root, [0.82, 1.35, 0.1], [-4.1, 2.3, -3.25], physical(0xe8e5db, { roughness: 0.92 }), 0.08);
    box(root, [0.9, 0.08, 0.22], [-4.1, 3.02, -3.28], chrome, 0.03);

    // Mixer and hose.
    box(root, [2.15, 0.34, 0.36], [1.25, 1.02, -3.12], chrome, 0.16);
    cylinder(root, 0.26, 0.19, [0.65, 1.02, -2.88], chrome, 48, 'z');
    cylinder(root, 0.26, 0.19, [1.85, 1.02, -2.88], chrome, 48, 'z');
    const lever = box(root, [0.12, 0.68, 0.11], [1.25, 1.38, -2.91], chrome, 0.04);
    lever.rotation.z = -0.26;
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.25, 0.95, -2.9),
      new THREE.Vector3(2.35, 0.55, -2.45),
      new THREE.Vector3(2.65, 1.25, -2.42),
      new THREE.Vector3(1.25, 1.65, -2.78),
    ]);
    const hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 72, 0.075, 16, false), chrome);
    hose.castShadow = true;
    root.add(hose);

    showerUnit = new THREE.Group();
    showerUnit.name = 'ATOJET_WINDOW_3G_SHOWER_HEAD';
    showerUnit.position.set(1.25, 2.72, -2.95);
    root.add(showerUnit);

    const transparentBody = physical(0xc8f4ef, { roughness: 0.1, transmission: 0.58, thickness: 0.22, transparent: true, opacity: 0.36, clearcoat: 0.9, side: THREE.DoubleSide, depthWrite: false });
    const body = cylinder(showerUnit, [0.27, 0.24], 1.72, [0, -0.26, 0], transparentBody, 72);
    body.name = 'transparent_filter_body';
    cylinder(showerUnit, [0.28, 0.25], 0.19, [0, 0.68, 0], chrome, 56);
    const neck = box(showerUnit, [0.34, 0.56, 0.32], [0, 0.88, 0], chrome, 0.13);
    neck.rotation.z = -0.13;
    cylinder(showerUnit, 0.73, 0.25, [0.05, 1.29, 0.12], chrome, 72, 'z');
    const sprayFace = cylinder(showerUnit, 0.64, 0.025, [0.05, 1.29, 0.265], white, 72, 'z');
    sprayFace.name = 'micro_spray_plate';
    const nozzleMaterial = physical(0x6c8581, { roughness: 0.5, metalness: 0.12 });
    for (let ring = 0; ring < 4; ring += 1) {
      const radius = 0.12 + ring * 0.14;
      const count = 8 + ring * 6;
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2;
        cylinder(showerUnit, 0.012, 0.02, [0.05 + Math.cos(angle) * radius, 1.29 + Math.sin(angle) * radius, 0.285], nozzleMaterial, 10, 'z');
      }
    }

    oldFilter = createFilter(0x9d693b, 'used_brown_sediment_filter');
    oldFilter.position.set(0, -0.26, 0);
    showerUnit.add(oldFilter);

    capGroup = new THREE.Group();
    capGroup.name = 'bottom_filter_cap';
    capGroup.position.set(0, -1.16, 0);
    showerUnit.add(capGroup);
    cylinder(capGroup, [0.29, 0.32], 0.29, [0, 0, 0], chrome, 64);
    for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * Math.PI * 2;
      const ridge = box(capGroup, [0.025, 0.18, 0.035], [Math.cos(angle) * 0.31, 0, Math.sin(angle) * 0.31], chrome, 0.01);
      ridge.rotation.y = -angle;
    }
    cylinder(capGroup, 0.12, 0.24, [0, -0.24, 0], chrome, 48);

    oRing = torus(showerUnit, 0.235, 0.027, [0, -1.02, 0], physical(0x111918, { roughness: 0.82, metalness: 0 }));
    oRing.name = 'cap_seal_o_ring';

    const labelPlate = box(showerUnit, [0.32, 0.38, 0.015], [0.24, 0.16, 0.08], physical(0x3a8179, { roughness: 0.46, emissive: 0x0b3c37, emissiveIntensity: 0.3 }), 0.03);
    labelPlate.rotation.y = Math.PI / 2;
    labelPlate.name = 'window_3g_model_label';

    newFilter = createFilter(0xf4f5ee, 'new_atojet_pure_filter');
    newFilter.position.copy(shelfFilterPosition);
    newFilter.rotation.z = Math.PI / 2;
    newFilter.visible = false;
    root.add(newFilter);

    waterJets = new THREE.Group();
    waterJets.name = 'clean_water_spray';
    waterJets.visible = false;
    showerUnit.add(waterJets);
    const waterMaterial = physical(0x76e9f0, { roughness: 0.05, transmission: 0.52, transparent: true, opacity: 0.62, emissive: 0x1aa3b0, emissiveIntensity: 0.55, depthWrite: false });
    for (let index = 0; index < 22; index += 1) {
      const angle = (index / 22) * Math.PI * 2;
      const radius = 0.12 + (index % 4) * 0.12;
      const start = [0.05 + Math.cos(angle) * radius, 1.29 + Math.sin(angle) * radius, 0.31];
      const spread = 0.28 + (index % 3) * 0.08;
      const end = [start[0] + Math.cos(angle) * spread, start[1] + Math.sin(angle) * spread - 1.5, 2.55];
      const jet = segment(waterJets, start, end, 0.009, waterMaterial.clone());
      jet.userData.phase = index * 0.41;
    }

    showerGlow = new THREE.PointLight(0x75eee1, 0, 7, 1.8);
    showerGlow.position.set(1.25, 3.2, -1.4);
    root.add(showerGlow);

    const markerMaterial = physical(0x58e5d0, { roughness: 0.15, emissive: 0x17bda9, emissiveIntensity: 2.5, transparent: true, opacity: 0.52, depthWrite: false });
    filterMarker = cylinder(showerUnit, 0.2, 1.46, [0, -0.26, 0], markerMaterial.clone(), 48);
    labelMarker = box(showerUnit, [0.4, 0.46, 0.05], [0.29, 0.16, 0.08], markerMaterial.clone(), 0.04);
    labelMarker.rotation.y = Math.PI / 2;
    bodyMarker = cylinder(showerUnit, [0.31, 0.29], 1.82, [0, -0.26, 0], markerMaterial.clone(), 48);
    sealMarker = torus(showerUnit, 0.24, 0.045, [0, -1.02, 0], markerMaterial.clone());
    [filterMarker, labelMarker, bodyMarker, sealMarker].forEach((marker) => { marker.visible = false; });

    const key = new THREE.SpotLight(0xe4fbf9, 22, 24, Math.PI / 4, 0.55, 1.4);
    key.position.set(4.5, 7.5, 5.5);
    key.target.position.set(1.2, 2.2, -2.7);
    key.castShadow = true;
    root.add(key, key.target);
    const fill = new THREE.PointLight(0x70a9b0, 4.8, 17, 1.6);
    fill.position.set(-3.8, 4.2, 1.8);
    root.add(fill);
  }

  function setFeedback(message, tone = '') {
    ui.feedback.className = `fluorescent-feedback shower-feedback${tone ? ` is-${tone}` : ''}`;
    ui.feedback.innerHTML = message;
  }

  function specMarkup() {
    const found = (id) => state.clues.has(id);
    return [
      ['condition', '교체 신호', '변색·수압'],
      ['model', '본체', '윈도우 3G'],
      ['position', '위치', '손잡이 바디'],
      ['family', '리필', '일반 순수필터'],
      ['seal', '밀폐', '하단 O링'],
    ].map(([id, label, value]) => `<span class="${found(id) ? '' : 'is-unknown'}"><small>${label}</small><b>${found(id) ? value : '미확인'}</b></span>`).join('');
  }

  function renderClues() {
    ui.clues.innerHTML = data.clues.map((clue) => `<button class="fluorescent-clue shower-clue${state.clues.has(clue.id) ? ' is-found' : ''}" type="button" data-shower-clue="${clue.id}">
      <small>${clue.code}</small><b>${clue.name}</b><span>${state.clues.has(clue.id) ? clue.value : '3D 샤워기에서 확인하기'}</span>
    </button>`).join('');
    ui.clues.querySelectorAll('[data-shower-clue]').forEach((button) => button.addEventListener('click', () => inspectClue(button.dataset.showerClue)));
    ui.clueCount.textContent = `${state.clues.size} / ${data.clues.length} 발견`;
    ui.specSheet.innerHTML = specMarkup();
  }

  function focusClue(clue) {
    filterMarker.visible = ['condition', 'family'].includes(clue.id);
    labelMarker.visible = clue.id === 'model';
    bodyMarker.visible = clue.id === 'position';
    sealMarker.visible = clue.id === 'seal';
    const views = {
      filter: [new THREE.Vector3(4.5, 3.25, 2.1), new THREE.Vector3(1.25, 2.42, -2.95)],
      label: [new THREE.Vector3(3.0, 3.15, -0.3), new THREE.Vector3(1.25, 2.8, -2.95)],
      body: [new THREE.Vector3(4.8, 3.7, 2.2), new THREE.Vector3(1.25, 2.45, -2.95)],
      seal: [new THREE.Vector3(3.4, 2.3, 0.2), new THREE.Vector3(1.25, 1.72, -2.95)],
    };
    const [position, target] = views[clue.camera];
    tweenCamera(position, target, 620);
  }

  function inspectClue(id) {
    const clue = data.clues.find((item) => item.id === id);
    if (!clue) return;
    state.clues.add(id);
    focusClue(clue);
    renderClues();
    setFeedback(`<b>${clue.value}</b> — ${clue.help}`, 'success');
    ui.action.disabled = state.clues.size !== data.clues.length;
  }

  function compatibility(product) {
    const required = data.scenario.required;
    const familyLabel = (value) => ({
      WINDOW_STANDARD: '일반형 윈도우',
      SIGNATURE: '시그니처 전용',
      TRAVEL_MINI: '여행용 미니',
      PURESOME: '퓨어썸 전용',
    })[value] ?? value;
    const generationLabel = (value) => ({
      '3G_HOME': '가정용 3세대',
      SIGNATURE: '시그니처 세대',
      '3G_TRAVEL': '여행용 3세대',
      BASIC: '퓨어썸 기본형',
    })[value] ?? value;
    const positionLabel = (value) => ({
      'handle-body': '손잡이 바디',
      'handle-window': '시그니처 손잡이',
      'mini-body': '여행용 미니 바디',
      'whole-unit': '샤워기 전체',
    })[value] ?? value;
    const formLabel = (value) => ({
      'long-cylinder': '긴 원통형',
      'short-cylinder': '짧은 원통형',
      'mini-cylinder': '미니 원통형',
      'shower-head': '샤워기 본체형',
    })[value] ?? value;
    return [
      { label: '구매 품목', pass: product.kind === required.kind, actual: product.kind === 'replacement-filter' ? '교체 필터' : '샤워기 본체', need: '교체 필터' },
      { label: '브랜드', pass: product.brand === required.brand, actual: product.maker, need: '아토젯' },
      { label: '리필 계열', pass: product.family === required.family, actual: familyLabel(product.family), need: familyLabel(required.family) },
      { label: '적용 세대', pass: product.generation === required.generation, actual: generationLabel(product.generation), need: generationLabel(required.generation) },
      { label: '장착 위치', pass: product.position === required.position, actual: positionLabel(product.position), need: positionLabel(required.position) },
      { label: '형상', pass: product.form === required.form, actual: formLabel(product.form), need: formLabel(required.form) },
    ];
  }

  function renderProducts() {
    ui.products.innerHTML = data.products.map((product) => `<button type="button" class="fluorescent-product shower-product${state.selectedProduct === product.id ? ' is-selected' : ''}" data-shower-product="${product.id}" style="--shower-product-accent:${product.accent}">
      <span class="fluorescent-product-visual shower-product-visual"><img src="${product.image}" alt="${product.name}" /></span>
      <span class="fluorescent-product-copy shower-product-copy"><small>${product.maker}</small><b>${product.name}</b><span>${product.pack}</span><strong>${formatWon(product.price)}</strong></span>
    </button>`).join('');
    ui.products.querySelectorAll('[data-shower-product]').forEach((button) => button.addEventListener('click', () => selectProduct(button.dataset.showerProduct)));
  }

  function selectProduct(id) {
    state.selectedProduct = id;
    const product = data.products.find((item) => item.id === id);
    if (!product) return;
    const checks = compatibility(product);
    const allPass = checks.every((check) => check.pass);
    renderProducts();
    ui.compare.className = `fluorescent-compare shower-compare ${allPass ? 'is-pass' : 'is-fail'}`;
    ui.compare.innerHTML = `<b>${allPass ? '현재 샤워기에 사용할 수 있는 리필입니다.' : '같은 필터처럼 보여도 적용 본체가 다릅니다.'}</b><br />${checks.map((check) => `<span class="${check.pass ? 'is-match' : 'is-mismatch'}">${check.pass ? '✓' : '×'} ${check.label}</span>`).join(' · ')}`;
    ui.action.disabled = false;
    setFeedback(allPass ? '1팩과 3팩은 수량만 다르며 현재 일반형 윈도우 본체에 모두 사용할 수 있습니다.' : '구매를 시도하면 어느 항목 때문에 설치할 수 없는지 확인할 수 있습니다.');
  }

  function wrongProductFeedback(product, checks) {
    const failed = checks.filter((check) => !check.pass);
    const consequences = [];
    if (failed.some((item) => item.label === '구매 품목')) consequences.push('필터만 교체할 수 있는데 샤워기 전체를 다시 사게 됩니다');
    if (failed.some((item) => item.label === '리필 계열' || item.label === '적용 세대')) consequences.push('필터 길이와 체결 구조가 달라 케이스가 닫히지 않습니다');
    if (failed.some((item) => item.label === '장착 위치' || item.label === '형상')) consequences.push('손잡이 바디 중앙에 안착되지 않아 물이 우회하거나 누수될 수 있습니다');
    if (failed.some((item) => item.label === '브랜드')) consequences.push('제품명이 비슷해도 전용 리필 호환은 보장되지 않습니다');
    return `<b>구매 보류:</b> ${failed.map((item) => `${item.label} ${item.actual} → 필요 ${item.need}`).join(', ')}.<br />${consequences.join(' · ')}`;
  }

  function attemptPurchase() {
    const product = data.products.find((item) => item.id === state.selectedProduct);
    if (!product) return;
    const checks = compatibility(product);
    if (!checks.every((check) => check.pass)) {
      state.purchaseErrors += 1;
      setFeedback(wrongProductFeedback(product, checks), 'error');
      return;
    }
    state.purchasedProduct = product.id;
    newFilter.visible = true;
    setFeedback(`<b>${product.name}</b>을 ${formatWon(product.price)}에 선택했습니다. 물을 잠그고 교체를 준비합니다.`, 'success');
    window.setTimeout(() => setStage('prepare'), 430);
  }

  function togglePrepare(id) {
    state.prepare.add(id);
    ui.prepareButtons.forEach((button) => {
      const checked = state.prepare.has(button.dataset.showerPrepare);
      button.classList.toggle('is-checked', checked);
      button.querySelector('em').textContent = checked ? '완료 ✓' : '확인';
    });
    ui.prepareCount.textContent = `${state.prepare.size} / 3 완료`;
    ui.action.disabled = state.prepare.size !== 3;
    setFeedback(state.prepare.size === 3 ? '수전이 잠기고 잔압이 빠졌습니다. 이제 손으로 하단 캡을 열 수 있습니다.' : '수전 잠금, 잔압 제거, 마른 작업면을 모두 준비하세요.', state.prepare.size === 3 ? 'success' : '');
  }

  function resetTwist(direction) {
    state.twistProgress = 0;
    state.twistDirection = direction;
    state.twisting = false;
    state.twistComplete = false;
    updateTwistVisual();
  }

  function updateTwistVisual() {
    const percent = Math.min(1, state.twistProgress / TWIST_TARGET);
    const signedRotation = state.twistProgress * state.twistDirection;
    const hand = state.stage === 'seal' ? ui.sealHand : ui.twistHand;
    const count = state.stage === 'seal' ? ui.sealCount : ui.twistCount;
    const dial = state.stage === 'seal' ? ui.sealDial : ui.twistDial;
    hand.style.transform = `rotate(${signedRotation}rad)`;
    count.textContent = `${Math.round(percent * 360)}° / 360°`;
    dial.setAttribute('aria-valuenow', String(Math.round(percent * 100)));
    if (state.stage === 'open') {
      capGroup.rotation.y = signedRotation;
      capGroup.position.y = -1.16 - percent * 0.42;
    } else if (state.stage === 'seal') {
      capGroup.rotation.y = -TWIST_TARGET + state.twistProgress;
      capGroup.position.y = -1.58 + percent * 0.42;
    }
    if (percent >= 1 && !state.twistComplete) completeTwist();
  }

  function addTwistDelta(delta) {
    if (!['open', 'seal'].includes(state.stage)) return;
    if (state.stage === 'seal' && !state.oRingSeated) return;
    const directed = delta * state.twistDirection;
    if (directed > 0) state.twistProgress = Math.min(TWIST_TARGET, state.twistProgress + directed);
    else state.twistProgress = Math.max(0, state.twistProgress + directed * 0.16);
    updateTwistVisual();
  }

  function completeTwist() {
    if (state.twistComplete) return;
    state.twistComplete = true;
    state.twisting = false;
    if (state.stage === 'open') {
      setFeedback('캡과 O링을 안전하게 분리했습니다. 오염된 필터를 수직으로 빼냈습니다.', 'success');
      root.attach(oldFilter);
      oldFilter.position.set(-0.42, 1.32, -2.84);
      oldFilter.rotation.set(0, 0, Math.PI / 2);
      window.setTimeout(() => setStage('install'), 520);
    } else {
      state.sealed = true;
      setFeedback('O링을 누르지 않고 캡이 손으로 끝까지 체결되었습니다. 이제 물을 천천히 열어 시험합니다.', 'success');
      window.setTimeout(() => setStage('test'), 520);
    }
  }

  function installFilter() {
    if (state.filterInstalled) return;
    state.filterInstalled = true;
    newFilter.visible = true;
    newFilter.position.copy(housingFilterPosition);
    newFilter.rotation.set(0, 0, 0);
    ui.dragPiece.classList.add('is-installed');
    ui.dragSlot.classList.add('is-filled');
    ui.dragPiece.style.transform = '';
    ui.action.disabled = false;
    setFeedback('새 필터가 투명 바디 중앙에 수직으로 안착했습니다. O링과 캡을 다시 조립하세요.', 'success');
  }

  function seatORing() {
    if (state.oRingSeated) return;
    state.oRingSeated = true;
    oRing.material.color.setHex(0x58e5d0);
    oRing.material.emissive.setHex(0x126b61);
    oRing.material.emissiveIntensity = 1.4;
    ui.oRingButton.classList.add('is-checked');
    ui.oRingButton.querySelector('em').textContent = '홈 안착 ✓';
    ui.sealDial.classList.remove('is-locked');
    setFeedback('O링이 끊김 없이 홈 전체에 평평하게 앉았습니다. 다이얼을 시계 방향으로 돌리세요.', 'success');
  }

  function finishFlush() {
    state.flushing = false;
    state.flushProgress = 1;
    state.tested = true;
    ui.flushFill.style.transform = 'scaleX(1)';
    ui.flushLabel.textContent = '흘려보내기 완료 · 검사 가능';
    ui.flushButton.classList.add('is-complete');
    ui.testResults.hidden = false;
    ui.action.disabled = false;
    waterJets.visible = true;
    showerGlow.intensity = 8;
    setFeedback('하단 캡이 마르고 물줄기가 균일합니다. 필터 교체와 누수 검증이 완료되었습니다.', 'success');
  }

  function setStage(stage) {
    state.stage = stage;
    const index = STAGES.indexOf(stage);
    const copy = STAGE_COPY[stage];
    ui.stepCode.textContent = copy.code;
    ui.title.innerHTML = copy.title;
    ui.copy.textContent = copy.copy;
    ui.progress.style.transform = `scaleX(${(index + 1) / STAGES.length})`;
    ui.routeProgress.textContent = `${String(index + 1).padStart(2, '0')} / 07`;
    ui.route.forEach((item, itemIndex) => {
      item.classList.toggle('is-active', item.dataset.showerStage === stage);
      item.classList.toggle('is-done', itemIndex < index);
    });
    ui.inspection.hidden = stage !== 'inspect';
    ui.shop.hidden = stage !== 'shop';
    ui.prepare.hidden = stage !== 'prepare';
    ui.twist.hidden = stage !== 'open';
    ui.install.hidden = stage !== 'install';
    ui.seal.hidden = stage !== 'seal';
    ui.test.hidden = stage !== 'test';
    ui.action.hidden = false;
    ui.action.disabled = true;

    if (stage === 'inspect') {
      ui.action.innerHTML = '현장 정보 확정 <span>→</span>';
      ui.action.disabled = state.clues.size !== data.clues.length;
    } else if (stage === 'shop') {
      ui.action.innerHTML = '선택한 리필 구매 <span>→</span>';
      ui.action.disabled = !state.selectedProduct;
      renderProducts();
      tweenCamera(new THREE.Vector3(6.3, 4.4, 5.8), new THREE.Vector3(1.0, 2.0, -2.5), 720);
      setFeedback('아토젯 · 일반형 윈도우 · 가정용 3세대 · 손잡이 바디 · 긴 원통형을 포장 표기와 대조하세요.');
    } else if (stage === 'prepare') {
      ui.action.innerHTML = '준비 완료하고 캡 열기 <span>→</span>';
      ui.action.disabled = state.prepare.size !== 3;
      tweenCamera(new THREE.Vector3(5.0, 3.4, 2.7), new THREE.Vector3(1.25, 2.2, -2.95), 680);
      setFeedback('수전을 잠근 뒤 샤워기 버튼을 눌러 남은 물이 나오지 않는지 확인하세요.');
    } else if (stage === 'open') {
      resetTwist(-1);
      ui.twistLabel.textContent = '하단 캡 풀기';
      ui.twistDirection.textContent = '↶';
      ui.twistHelp.textContent = '캡을 받친 채 반시계 방향으로 한 바퀴 돌립니다. 손으로 움직이지 않으면 억지로 작업하지 않습니다.';
      ui.action.innerHTML = '다이얼로 캡을 푸세요 <span>↶</span>';
      tweenCamera(new THREE.Vector3(3.8, 2.55, 0.45), new THREE.Vector3(1.25, 1.7, -2.95), 620);
      setFeedback('다이얼을 반시계 방향으로 원을 그리듯 돌리세요. 캡이 내려오며 나사산이 풀립니다.');
    } else if (stage === 'install') {
      ui.action.innerHTML = '장착 확인하고 O링 점검 <span>→</span>';
      ui.action.disabled = !state.filterInstalled;
      tweenCamera(new THREE.Vector3(4.8, 3.25, 2.0), new THREE.Vector3(1.25, 2.35, -2.95), 620);
      setFeedback('오른쪽의 새 필터를 마우스로 잡아 투명 손잡이 목표 영역까지 직접 옮기세요.');
    } else if (stage === 'seal') {
      resetTwist(1);
      ui.action.hidden = true;
      ui.sealDial.classList.toggle('is-locked', !state.oRingSeated);
      tweenCamera(new THREE.Vector3(3.7, 2.4, 0.2), new THREE.Vector3(1.25, 1.72, -2.95), 620);
      setFeedback('먼저 O링 확인 버튼을 눌러 홈 전체를 점검하세요. 확인 전에는 캡을 돌릴 수 없습니다.');
    } else if (stage === 'test') {
      state.flushing = false;
      state.flushProgress = 0;
      ui.flushFill.style.transform = 'scaleX(0)';
      ui.flushLabel.textContent = '버튼을 계속 눌러 물 흘려보내기';
      ui.testResults.hidden = true;
      ui.action.innerHTML = '누수·수압 검증 완료 <span>✓</span>';
      ui.action.disabled = true;
      tweenCamera(new THREE.Vector3(6.2, 4.5, 5.5), new THREE.Vector3(1.25, 2.65, -2.65), 760);
      setFeedback('물 흘려보내기 버튼을 길게 눌러 새 필터 내부의 공기를 빼고 흐름을 안정시키세요.');
    }
    setSessionLabel(`샤워기 필터 · ${index + 1}/7 ${ui.route[index].querySelector('b').textContent}`);
  }

  function action() {
    if (state.stage === 'inspect') setStage('shop');
    else if (state.stage === 'shop') attemptPurchase();
    else if (state.stage === 'prepare') setStage('open');
    else if (state.stage === 'install') setStage('seal');
    else if (state.stage === 'test' && state.tested) finishExperience();
  }

  function finishExperience() {
    state.completed = true;
    const purchased = data.products.find((product) => product.id === state.purchasedProduct);
    ui.purchasePrice.textContent = formatWon(purchased?.price ?? 0);
    ui.errorCount.textContent = `${state.purchaseErrors}회`;
    setSessionLabel('샤워기 필터 · 누수 검증 완료');
    tweenCamera(new THREE.Vector3(7.3, 4.9, 6.5), new THREE.Vector3(0.8, 2.5, -2.3), 820);
    ui.workspace.hidden = true;
    ui.completion.hidden = false;
  }

  function pointerAngle(event, element) {
    const rect = element.getBoundingClientRect();
    return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2));
  }

  function bindDial(element) {
    element.addEventListener('pointerdown', (event) => {
      if (!['open', 'seal'].includes(state.stage)) return;
      if (state.stage === 'seal' && !state.oRingSeated) return;
      state.twisting = true;
      state.lastAngle = pointerAngle(event, element);
      element.setPointerCapture(event.pointerId);
    });
    element.addEventListener('pointermove', (event) => {
      if (!state.twisting || !element.hasPointerCapture(event.pointerId)) return;
      const angle = pointerAngle(event, element);
      let delta = angle - state.lastAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      state.lastAngle = angle;
      addTwistDelta(delta);
    });
    const end = (event) => {
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      state.twisting = false;
    };
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
    element.addEventListener('keydown', (event) => {
      const wanted = state.stage === 'open' ? 'ArrowLeft' : 'ArrowRight';
      if (event.code !== wanted) return;
      event.preventDefault();
      addTwistDelta((Math.PI / 8) * state.twistDirection);
    });
  }

  let dragOrigin = null;
  ui.dragPiece.addEventListener('pointerdown', (event) => {
    if (state.stage !== 'install' || state.filterInstalled) return;
    dragOrigin = { x: event.clientX, y: event.clientY };
    ui.dragPiece.classList.add('is-dragging');
    ui.dragPiece.setPointerCapture(event.pointerId);
  });
  ui.dragPiece.addEventListener('pointermove', (event) => {
    if (!dragOrigin || !ui.dragPiece.hasPointerCapture(event.pointerId)) return;
    const dx = event.clientX - dragOrigin.x;
    const dy = event.clientY - dragOrigin.y;
    ui.dragPiece.style.transform = `translate(${dx}px, ${dy}px)`;
    const distance = Math.hypot(dx, dy);
    const progress = Math.min(0.86, distance / 210);
    newFilter.position.lerpVectors(shelfFilterPosition, housingFilterPosition, progress);
    newFilter.rotation.z = Math.PI / 2 * (1 - progress);
  });
  const endDrag = (event) => {
    if (!dragOrigin) return;
    if (ui.dragPiece.hasPointerCapture(event.pointerId)) ui.dragPiece.releasePointerCapture(event.pointerId);
    const pieceRect = ui.dragPiece.getBoundingClientRect();
    const slotRect = ui.dragSlot.getBoundingClientRect();
    const pieceCenter = { x: pieceRect.left + pieceRect.width / 2, y: pieceRect.top + pieceRect.height / 2 };
    const slotCenter = { x: slotRect.left + slotRect.width / 2, y: slotRect.top + slotRect.height / 2 };
    const closeEnough = Math.hypot(pieceCenter.x - slotCenter.x, pieceCenter.y - slotCenter.y) < Math.max(80, slotRect.width * 0.55);
    ui.dragPiece.classList.remove('is-dragging');
    dragOrigin = null;
    if (closeEnough) installFilter();
    else {
      ui.dragPiece.style.transform = '';
      newFilter.position.copy(shelfFilterPosition);
      newFilter.rotation.z = Math.PI / 2;
      setFeedback('필터가 목표 홈에 닿지 않았습니다. 초록색 손잡이 영역까지 끌어 놓으세요.', 'error');
    }
  };
  ui.dragPiece.addEventListener('pointerup', endDrag);
  ui.dragPiece.addEventListener('pointercancel', endDrag);

  bindDial(ui.twistDial);
  bindDial(ui.sealDial);
  ui.prepareButtons.forEach((button) => button.addEventListener('click', () => togglePrepare(button.dataset.showerPrepare)));
  ui.oRingButton.addEventListener('click', seatORing);
  ui.flushButton.addEventListener('pointerdown', (event) => {
    if (state.stage !== 'test' || state.tested) return;
    state.flushing = true;
    ui.flushButton.setPointerCapture(event.pointerId);
  });
  const stopFlush = (event) => {
    if (ui.flushButton.hasPointerCapture(event.pointerId)) ui.flushButton.releasePointerCapture(event.pointerId);
    state.flushing = false;
  };
  ui.flushButton.addEventListener('pointerup', stopFlush);
  ui.flushButton.addEventListener('pointercancel', stopFlush);
  ui.action.addEventListener('click', action);
  ui.menu.addEventListener('click', () => window.location.reload());
  ui.restart.addEventListener('click', () => window.location.reload());

  function start() {
    state.active = true;
    pcRoot.visible = false;
    globalFloor.visible = false;
    grid.visible = false;
    root.visible = true;
    ui.workspace.hidden = false;
    ui.completion.hidden = true;
    controls.minDistance = 2.2;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI * 0.88;
    renderClues();
    setStage('inspect');
    tweenCamera(new THREE.Vector3(6.5, 4.6, 6.1), new THREE.Vector3(0.8, 2.35, -2.55), 840);
  }

  function update(now, delta) {
    if (!state.active) return;
    [filterMarker, labelMarker, bodyMarker, sealMarker].forEach((marker, index) => {
      if (marker?.visible) marker.material.opacity = 0.4 + Math.sin(now * 0.006 + index) * 0.18;
    });
    if (state.flushing && !state.tested) {
      state.flushProgress = Math.min(1, state.flushProgress + delta * 0.72);
      ui.flushFill.style.transform = `scaleX(${state.flushProgress})`;
      ui.flushLabel.textContent = `흘려보내는 중 · ${Math.round(state.flushProgress * 100)}%`;
      waterJets.visible = true;
      showerGlow.intensity = 3 + state.flushProgress * 5;
      if (state.flushProgress >= 1) finishFlush();
    }
    if (waterJets?.visible) {
      waterJets.children.forEach((jet, index) => {
        jet.material.opacity = 0.42 + Math.sin(now * 0.012 + jet.userData.phase) * 0.14;
        jet.scale.y = 0.94 + Math.sin(now * 0.01 + index) * 0.04;
      });
    }
  }

  function qaCompleteTwist() {
    if (!['open', 'seal'].includes(state.stage)) return false;
    if (state.stage === 'seal' && !state.oRingSeated) return false;
    state.twistProgress = TWIST_TARGET;
    state.twistComplete = false;
    updateTwistVisual();
    return true;
  }

  buildBathroom();

  return {
    start,
    update,
    qa: {
      state() {
        return {
          active: state.active,
          stage: state.stage,
          clues: [...state.clues],
          prepare: [...state.prepare],
          selectedProduct: state.selectedProduct,
          purchasedProduct: state.purchasedProduct,
          purchaseErrors: state.purchaseErrors,
          twistProgress: state.twistProgress,
          filterInstalled: state.filterInstalled,
          oRingSeated: state.oRingSeated,
          sealed: state.sealed,
          flushProgress: state.flushProgress,
          tested: state.tested,
          completed: state.completed,
        };
      },
      inspectAll() { data.clues.forEach((clue) => inspectClue(clue.id)); },
      selectProduct,
      checkPrepare() { ['water', 'pressure', 'dry'].forEach(togglePrepare); },
      completeTwist: qaCompleteTwist,
      installFilter,
      seatORing,
      completeFlush: finishFlush,
      compatibility(id) {
        const product = data.products.find((item) => item.id === id);
        return compatibility(product);
      },
    },
  };
}
