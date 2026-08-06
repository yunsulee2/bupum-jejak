import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const STAGES = ['inspect', 'shop', 'safety', 'remove', 'install', 'test'];
const STAGE_COPY = {
  inspect: {
    code: '진단 01',
    title: '전구를 사기 전에<br />단서를 찾으세요',
    copy: '모양만 보고 사면 베이스·밝기·색온도·조광 호환성을 놓치기 쉽습니다. 현장의 네 단서를 조사하세요.',
  },
  shop: {
    code: '판별 02',
    title: '포장 표기를 비교해<br />맞는 전구를 고르세요',
    copy: '겉모습과 가격이 비슷해도 결합 규격과 사용 결과는 다릅니다. 발견한 요구 규격을 기준으로 판단하세요.',
  },
  safety: {
    code: '안전 03',
    title: '손을 대기 전에<br />에너지를 차단하세요',
    copy: '벽 스위치, 회로 차단기, 전구 상태를 순서대로 확인합니다. 소켓과 배선에 이상이 있으면 작업 범위를 넘기지 않습니다.',
  },
  remove: {
    code: '분리 04',
    title: '기존 전구를<br />반시계로 푸세요',
    copy: '전구가 식었는지 확인한 뒤 베이스 가까이를 안정적으로 잡고, 아래로 당기지 않은 채 천천히 돌립니다.',
  },
  install: {
    code: '장착 05',
    title: '나사산을 맞추고<br />시계 방향으로 조이세요',
    copy: '전구를 소켓 축과 일직선으로 맞춘 뒤 가볍게 돌립니다. 기울어진 상태에서 힘으로 조이면 나사산이 손상됩니다.',
  },
  test: {
    code: '검증 06',
    title: '전원을 복구하고<br />빛을 검증하세요',
    copy: '작업 구역을 정리한 뒤 차단기와 스위치를 복구해 점등·색온도·밝기·조광 동작을 확인합니다.',
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

function cylinder(parent, radii, height, position, material, segments = 64) {
  const radiusTop = Array.isArray(radii) ? radii[0] : radii;
  const radiusBottom = Array.isArray(radii) ? radii[1] : radii;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createBulbModel({ warm = false } = {}) {
  const bulb = new THREE.Group();
  const glassMaterial = physical(warm ? 0xffd18a : 0xf1f4e9, {
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transmission: 0.58,
    thickness: 0.3,
    transparent: true,
    opacity: 0.82,
    emissive: warm ? 0xff9a35 : 0x000000,
    emissiveIntensity: warm ? 1.6 : 0,
  });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.67, 64, 40), glassMaterial);
  glass.scale.y = 1.14;
  glass.position.y = -0.62;
  glass.castShadow = true;
  bulb.add(glass);

  const neck = cylinder(bulb, [0.38, 0.48], 0.48, [0, 0.02, 0], glassMaterial, 48);
  neck.castShadow = true;
  const ledShell = cylinder(bulb, [0.3, 0.42], 0.38, [0, -0.08, 0], physical(0xf1eee4, { roughness: 0.65 }), 48);
  ledShell.renderOrder = -1;

  const silver = physical(0xa8aaa4, { roughness: 0.28, metalness: 0.82, clearcoat: 0.4 });
  cylinder(bulb, 0.31, 0.7, [0, 0.46, 0], silver, 64);
  for (let index = 0; index < 8; index += 1) {
    const thread = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 8, 64), silver);
    thread.rotation.x = Math.PI / 2;
    thread.position.y = 0.18 + index * 0.075;
    bulb.add(thread);
  }
  cylinder(bulb, 0.2, 0.08, [0, 0.845, 0], physical(0x444440, { roughness: 0.36, metalness: 0.5 }), 40);

  const diode = cylinder(bulb, 0.08, 0.42, [0, -0.53, 0], physical(0xffd78c, {
    emissive: warm ? 0xffb24c : 0x372817,
    emissiveIntensity: warm ? 2.5 : 0.15,
    roughness: 0.3,
  }), 24);
  diode.renderOrder = 2;
  bulb.userData.glassMaterial = glassMaterial;
  bulb.userData.diodeMaterial = diode.material;
  return bulb;
}

function formatWon(value) {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}

export function createBulbModule({
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
    workspace: $('#bulb-workspace'),
    completion: $('#bulb-completion'),
    menu: $('#bulb-menu-button'),
    restart: $('#bulb-restart-button'),
    stepCode: $('#bulb-step-code'),
    title: $('#bulb-title'),
    copy: $('#bulb-copy'),
    progress: $('#bulb-progress-fill'),
    routeProgress: $('#bulb-route-progress'),
    route: [...document.querySelectorAll('[data-bulb-stage]')],
    inspection: $('#bulb-inspection'),
    clues: $('#bulb-clues'),
    clueCount: $('#bulb-clue-count'),
    specSheet: $('#bulb-spec-sheet'),
    shop: $('#bulb-shop'),
    products: $('#bulb-products'),
    compare: $('#bulb-compare'),
    safety: $('#bulb-safety'),
    safetyButtons: [...document.querySelectorAll('[data-safety]')],
    safetyCount: $('#bulb-safety-count'),
    turn: $('#bulb-turn'),
    turnDial: $('#bulb-turn-dial'),
    turnHand: $('#bulb-dial-hand'),
    turnLabel: $('#bulb-turn-label'),
    turnCount: $('#bulb-turn-count'),
    turnDirection: $('#bulb-turn-direction'),
    turnHelp: $('#bulb-turn-help'),
    test: $('#bulb-test'),
    testLabel: $('#bulb-test-label'),
    feedback: $('#bulb-feedback'),
    action: $('#bulb-action'),
    errorCount: $('#bulb-error-count'),
    purchasePrice: $('#bulb-purchase-price'),
  };

  const state = {
    active: false,
    stage: 'inspect',
    clues: new Set(),
    safety: new Set(),
    selectedProduct: null,
    purchasedProduct: null,
    purchaseErrors: 0,
    turnProgress: 0,
    turnDirection: -1,
    turning: false,
    turnComplete: false,
    lastAngle: 0,
    powered: false,
    completed: false,
  };

  const root = new THREE.Group();
  root.name = 'BULB_REPLACEMENT_LAB';
  root.visible = false;
  scene.add(root);

  const warmLight = new THREE.PointLight(0xffa644, 0, 12, 1.45);
  warmLight.position.set(0, 2.65, 0.05);
  root.add(warmLight);

  let oldBulb;
  let newBulb;
  let shade;
  let wallSwitch;
  let socketMarker;
  let shadeMarker;
  let switchMarker;

  function buildScene() {
    const wall = physical(0x44453f, { roughness: 0.92, metalness: 0 });
    const floorMat = physical(0x30291f, { roughness: 0.78, metalness: 0.02 });
    const wood = physical(0x59412b, { roughness: 0.6, metalness: 0.02, clearcoat: 0.22 });
    const charcoal = physical(0x171a19, { roughness: 0.36, metalness: 0.62 });
    const brass = physical(0xa87536, { roughness: 0.27, metalness: 0.84, clearcoat: 0.5 });
    const ceramic = physical(0xe3ded0, { roughness: 0.7, metalness: 0 });

    box(root, [13, 0.2, 10], [0, -0.08, 0], floorMat, 0);
    box(root, [13, 6.8, 0.2], [0, 3.3, -4.2], wall, 0);
    box(root, [0.2, 6.8, 10], [-6.4, 3.3, 0], physical(0x333a37, { roughness: 0.9 }), 0);
    box(root, [13, 0.18, 10], [0, 6.65, 0], physical(0x555750, { roughness: 0.92 }), 0);

    // Console table and small domestic details establish scale.
    box(root, [4.3, 0.22, 1.25], [1.7, 1.05, -2.7], wood, 0.08);
    for (const x of [-0.25, 3.65]) box(root, [0.18, 1.1, 0.18], [x, 0.5, -2.7], charcoal, 0.04);
    box(root, [1.55, 1.05, 0.08], [1.7, 2.25, -4.05], physical(0x161b1b, { roughness: 0.5, metalness: 0.3 }), 0.03);
    box(root, [1.38, 0.88, 0.04], [1.7, 2.25, -3.99], physical(0x8e775d, { roughness: 0.82, metalness: 0 }), 0.01);
    cylinder(root, [0.37, 0.46], 0.62, [3.2, 1.45, -2.7], physical(0x8b9d88, { roughness: 0.72 }), 48);
    for (let index = 0; index < 9; index += 1) {
      const leaf = box(root, [0.08, 0.8, 0.18], [3.2, 1.95, -2.7], physical(0x50755b, { roughness: 0.78 }), 0.04);
      leaf.rotation.z = (index - 4) * 0.23;
      leaf.rotation.y = index * 0.78;
    }

    // Pendant fixture: detailed shade, strain relief, ceramic socket and E26 thread.
    cylinder(root, 0.055, 1.75, [0, 5.75, 0], charcoal, 24);
    cylinder(root, 0.36, 0.13, [0, 6.52, 0], charcoal, 48);
    shade = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 1.38, 1.2, 96, 1, true), physical(0x222626, {
      roughness: 0.28,
      metalness: 0.75,
      clearcoat: 0.45,
      side: THREE.DoubleSide,
    }));
    shade.position.set(0, 4.45, 0);
    shade.castShadow = true;
    root.add(shade);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.035, 12, 96), brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 3.85, 0);
    root.add(rim);
    cylinder(root, 0.42, 0.64, [0, 4.27, 0], ceramic, 64);
    cylinder(root, 0.32, 0.54, [0, 4.05, 0], physical(0x514837, { roughness: 0.42, metalness: 0.38 }), 64);

    oldBulb = createBulbModel();
    oldBulb.name = 'existing_E26_bulb';
    oldBulb.position.set(0, 3.32, 0);
    root.add(oldBulb);

    newBulb = createBulbModel({ warm: false });
    newBulb.name = 'replacement_E26_bulb';
    newBulb.position.set(2.2, 1.72, -2.68);
    newBulb.rotation.z = Math.PI / 2;
    newBulb.visible = false;
    root.add(newBulb);

    // Real-world inspection points: fixture label, old print, clearances, dimmer.
    const label = box(root, [0.55, 0.22, 0.025], [0.43, 4.23, 0.29], physical(0xe7e2d5, { roughness: 0.8 }), 0.01);
    label.rotation.y = Math.PI / 4;
    for (let index = 0; index < 3; index += 1) box(label, [0.34 - index * 0.05, 0.012, 0.008], [0, 0.055 - index * 0.055, 0.016], charcoal, 0);

    wallSwitch = box(root, [0.52, 0.78, 0.09], [-3.9, 1.85, -4.04], ceramic, 0.06);
    const dial = cylinder(wallSwitch, 0.16, 0.12, [0, 0.07, 0.08], physical(0xd2ccbd, { roughness: 0.5 }), 48);
    dial.rotation.x = Math.PI / 2;
    box(wallSwitch, [0.18, 0.04, 0.04], [0, 0.07, 0.16], charcoal, 0.01);

    const markerMat = physical(0xffbd66, { roughness: 0.2, emissive: 0xff7b20, emissiveIntensity: 2, transparent: true, opacity: 0.65 });
    socketMarker = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.018, 8, 64), markerMat.clone());
    socketMarker.rotation.x = Math.PI / 2;
    socketMarker.position.set(0, 4.17, 0);
    socketMarker.visible = false;
    root.add(socketMarker);
    shadeMarker = new THREE.Mesh(new THREE.TorusGeometry(1.41, 0.018, 8, 64), markerMat.clone());
    shadeMarker.rotation.x = Math.PI / 2;
    shadeMarker.position.set(0, 3.84, 0);
    shadeMarker.visible = false;
    root.add(shadeMarker);
    switchMarker = box(root, [0.64, 0.9, 0.035], [-3.9, 1.85, -3.97], markerMat.clone(), 0.08);
    switchMarker.visible = false;

    const fill = new THREE.SpotLight(0xffdfb8, 16, 22, Math.PI / 4, 0.65, 1.4);
    fill.position.set(4, 8, 6);
    fill.target.position.set(0, 3, 0);
    fill.castShadow = true;
    root.add(fill, fill.target);
    const roomFill = new THREE.PointLight(0x8eb7b8, 3.2, 16, 1.7);
    roomFill.position.set(-4.5, 4.4, 2.2);
    root.add(roomFill);
  }

  function specMarkup() {
    const found = (id) => state.clues.has(id);
    return [
      ['socket', '베이스', 'E26'],
      ['printing', '밝기·색', '806 lm · 2700 K'],
      ['shape', '형태·크기', 'A60 · Ø65 이하'],
      ['dimmer', '제어', '조광 가능'],
    ].map(([id, label, value]) => `<span class="${found(id) ? '' : 'is-unknown'}"><small>${label}</small><b>${found(id) ? value : '미확인'}</b></span>`).join('');
  }

  function renderClues() {
    ui.clues.innerHTML = data.clues.map((clue) => `<button class="bulb-clue${state.clues.has(clue.id) ? ' is-found' : ''}" type="button" data-clue="${clue.id}">
      <small>${clue.code}</small><b>${clue.name}</b><span>${state.clues.has(clue.id) ? clue.value : '3D 현장에서 확인하기'}</span>
    </button>`).join('');
    ui.clues.querySelectorAll('[data-clue]').forEach((button) => {
      button.addEventListener('click', () => inspectClue(button.dataset.clue));
    });
    ui.clueCount.textContent = `${state.clues.size} / ${data.clues.length} 발견`;
    ui.specSheet.innerHTML = specMarkup();
  }

  function focusClue(clue) {
    socketMarker.visible = clue.id === 'socket';
    shadeMarker.visible = clue.id === 'shape';
    switchMarker.visible = clue.id === 'dimmer';
    const views = {
      socket: [new THREE.Vector3(3.35, 4.9, 4.7), new THREE.Vector3(0, 4.05, 0)],
      bulb: [new THREE.Vector3(2.8, 3.6, 4.35), new THREE.Vector3(0, 3.05, 0)],
      shade: [new THREE.Vector3(4.6, 5.0, 5.4), new THREE.Vector3(0, 4.05, 0)],
      switch: [new THREE.Vector3(-5.25, 2.6, 0.5), new THREE.Vector3(-3.9, 1.85, -4.0)],
    };
    const [position, target] = views[clue.camera];
    tweenCamera(position, target, 650);
  }

  function setFeedback(message, tone = '') {
    ui.feedback.className = `bulb-feedback${tone ? ` is-${tone}` : ''}`;
    ui.feedback.innerHTML = message;
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
    return [
      { label: '베이스', pass: product.base === required.base, actual: product.base, need: required.base },
      { label: '밝기', pass: product.lumens === required.lumens, actual: `${product.lumens} lm`, need: `${required.lumens} lm` },
      { label: '색온도', pass: product.cct === required.cct, actual: `${product.cct} K`, need: `${required.cct} K` },
      { label: '조광', pass: product.dimmable === required.dimmable, actual: product.dimmable ? '가능' : '불가', need: '가능' },
      { label: '크기', pass: product.shape === required.shape && product.diameterMm <= required.maxDiameterMm, actual: `${product.shape} · Ø${product.diameterMm}`, need: `${required.shape} · Ø${required.maxDiameterMm} 이하` },
    ];
  }

  function renderProducts() {
    ui.products.innerHTML = data.products.map((product) => `<button type="button" class="bulb-product${state.selectedProduct === product.id ? ' is-selected' : ''}" data-product="${product.id}" style="--bulb-accent:${product.accent}">
      <span class="bulb-product-visual"><i></i></span>
      <span class="bulb-product-copy"><small>${product.maker} · ${product.base}</small><b>${product.name}</b><span>${product.pack}</span><strong>${formatWon(product.price)}</strong></span>
    </button>`).join('');
    ui.products.querySelectorAll('[data-product]').forEach((button) => {
      button.addEventListener('click', () => selectProduct(button.dataset.product));
    });
  }

  function selectProduct(id) {
    state.selectedProduct = id;
    const product = data.products.find((item) => item.id === id);
    const checks = compatibility(product);
    renderProducts();
    const allPass = checks.every((check) => check.pass);
    ui.compare.className = `bulb-compare ${allPass ? 'is-pass' : 'is-fail'}`;
    ui.compare.innerHTML = `<b>${allPass ? '현장 규격과 모두 일치합니다.' : '비슷해 보여도 맞지 않는 항목이 있습니다.'}</b><br />${checks.map((check) => `<span class="${check.pass ? 'is-match' : 'is-mismatch'}">${check.pass ? '✓' : '×'} ${check.label} ${check.actual}</span>`).join(' · ')}`;
    ui.action.disabled = false;
    setFeedback(allPass ? '구매 전 마지막으로 포장 표기의 다섯 항목을 확인하세요.' : '구매를 시도하면 맞지 않는 이유와 실제 사용 결과를 확인할 수 있습니다.');
  }

  function wrongProductFeedback(product, checks) {
    const failed = checks.filter((check) => !check.pass);
    const consequences = [];
    if (failed.some((item) => item.label === '베이스')) consequences.push('소켓에 물리적으로 체결되지 않습니다');
    if (failed.some((item) => item.label === '밝기')) consequences.push(product.lumens > 806 ? '필요 이상으로 밝고 눈부실 수 있습니다' : '기존보다 어두워집니다');
    if (failed.some((item) => item.label === '색온도')) consequences.push('방의 분위기가 차갑게 달라집니다');
    if (failed.some((item) => item.label === '조광')) consequences.push('조광 시 깜박임·소음·오작동 가능성이 있습니다');
    if (failed.some((item) => item.label === '크기')) consequences.push('조명 갓 안에 맞지 않습니다');
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
    newBulb.visible = true;
    setFeedback(`<b>${product.name}</b>을 ${formatWon(product.price)}에 선택했습니다. 안전 준비로 이동합니다.`, 'success');
    window.setTimeout(() => setStage('safety'), 520);
  }

  function toggleSafety(id) {
    state.safety.add(id);
    ui.safetyButtons.forEach((button) => {
      const checked = state.safety.has(button.dataset.safety);
      button.classList.toggle('is-checked', checked);
      button.querySelector('em').textContent = checked ? '완료 ✓' : '확인';
    });
    ui.safetyCount.textContent = `${state.safety.size} / 3 완료`;
    ui.action.disabled = state.safety.size !== 3;
    setFeedback(state.safety.size === 3 ? '전원 차단과 작업 조건을 모두 확인했습니다. 이제 기존 전구를 분리할 수 있습니다.' : '스위치만 끄는 데서 끝내지 말고 세 항목을 모두 확인하세요.', state.safety.size === 3 ? 'success' : '');
  }

  function resetTurn(direction) {
    state.turnProgress = 0;
    state.turnDirection = direction;
    state.turning = false;
    state.turnComplete = false;
    updateTurnVisual();
  }

  function updateTurnVisual() {
    const target = Math.PI * 4;
    const percent = Math.min(1, state.turnProgress / target);
    const signedRotation = state.turnProgress * state.turnDirection;
    ui.turnHand.style.transform = `rotate(${signedRotation}rad)`;
    ui.turnDial.setAttribute('aria-valuenow', String(Math.round(percent * 100)));
    ui.turnCount.textContent = `${(percent * 2).toFixed(1)} / 2바퀴`;
    if (state.stage === 'remove') {
      oldBulb.rotation.y = signedRotation;
      oldBulb.position.y = 3.32 - percent * 1.3;
    } else if (state.stage === 'install') {
      newBulb.rotation.z = (1 - percent) * (Math.PI / 2);
      newBulb.rotation.y = signedRotation;
      newBulb.position.lerpVectors(new THREE.Vector3(0, 2.02, 0), new THREE.Vector3(0, 3.32, 0), percent);
    }
    if (percent >= 1 && !state.turnComplete) completeTurn();
  }

  function addTurnDelta(delta) {
    if (!['remove', 'install'].includes(state.stage)) return;
    const directed = delta * state.turnDirection;
    if (directed > 0) state.turnProgress = Math.min(Math.PI * 4, state.turnProgress + directed);
    else state.turnProgress = Math.max(0, state.turnProgress + directed * 0.18);
    updateTurnVisual();
  }

  function completeTurn() {
    if (state.turnComplete) return;
    state.turnComplete = true;
    state.turning = false;
    if (state.stage === 'remove') {
      setFeedback('기존 전구를 수직으로 안전하게 분리했습니다. 새 전구를 소켓 축에 맞춥니다.', 'success');
      window.setTimeout(() => {
        oldBulb.visible = false;
        newBulb.visible = true;
        newBulb.position.set(0, 2.02, 0);
        newBulb.rotation.set(0, 0, Math.PI / 2);
        setStage('install');
      }, 620);
    } else {
      setFeedback('저항이 느껴지는 지점까지만 가볍게 체결했습니다. 과도하게 조이지 않았습니다.', 'success');
      window.setTimeout(() => setStage('test'), 620);
    }
  }

  function setStage(stage) {
    state.stage = stage;
    const index = STAGES.indexOf(stage);
    const copy = STAGE_COPY[stage];
    ui.stepCode.textContent = copy.code;
    ui.title.innerHTML = copy.title;
    ui.copy.textContent = copy.copy;
    ui.progress.style.transform = `scaleX(${(index + 1) / STAGES.length})`;
    ui.routeProgress.textContent = `${String(index + 1).padStart(2, '0')} / 06`;
    ui.route.forEach((item, itemIndex) => {
      item.classList.toggle('is-active', item.dataset.bulbStage === stage);
      item.classList.toggle('is-done', itemIndex < index);
    });
    ui.inspection.hidden = stage !== 'inspect';
    ui.shop.hidden = stage !== 'shop';
    ui.safety.hidden = stage !== 'safety';
    ui.turn.hidden = !['remove', 'install'].includes(stage);
    ui.test.hidden = stage !== 'test';
    ui.action.hidden = false;
    ui.action.disabled = true;
    if (stage === 'inspect') {
      ui.action.innerHTML = '현장 규격 확정 <span>→</span>';
      ui.action.disabled = state.clues.size !== data.clues.length;
    } else if (stage === 'shop') {
      ui.action.innerHTML = '선택한 전구 구매 <span>→</span>';
      ui.action.disabled = !state.selectedProduct;
      renderProducts();
      tweenCamera(new THREE.Vector3(6.8, 5.3, 8.2), new THREE.Vector3(0, 3.1, -0.3), 760);
      setFeedback('현장 요구값 E26 · 806 lm · 2700 K · 조광 가능 · A60을 제품 포장과 대조하세요.');
    } else if (stage === 'safety') {
      ui.action.innerHTML = '안전 조건 확인하고 분리 <span>→</span>';
      ui.action.disabled = state.safety.size !== 3;
      tweenCamera(new THREE.Vector3(5.5, 5.5, 7.2), new THREE.Vector3(0, 3.2, 0), 760);
      setFeedback('전구를 만지기 전, 세 가지 안전 조건을 직접 확인하세요.');
    } else if (stage === 'remove') {
      resetTurn(-1);
      ui.turnLabel.textContent = '반시계 방향으로 풀기';
      ui.turnDirection.textContent = '↶';
      ui.turnHelp.textContent = '전구 유리 몸체를 세게 쥐지 않고 베이스 가까이를 잡아 반시계 방향으로 천천히 돌립니다.';
      ui.action.innerHTML = '회전 조작으로 분리하세요 <span>↶</span>';
      tweenCamera(new THREE.Vector3(3.8, 4.0, 5.5), new THREE.Vector3(0, 3.25, 0), 620);
      setFeedback('원을 반시계 방향으로 두 바퀴 그리세요. 반대 방향으로 돌리면 진행도가 조금 되돌아갑니다.');
    } else if (stage === 'install') {
      resetTurn(1);
      ui.turnLabel.textContent = '시계 방향으로 장착하기';
      ui.turnDirection.textContent = '↷';
      ui.turnHelp.textContent = '소켓 축과 일직선인지 확인하고 시계 방향으로 부드럽게 돌립니다. 멈춘 뒤 더 힘을 주지 않습니다.';
      ui.action.innerHTML = '회전 조작으로 장착하세요 <span>↷</span>';
      setFeedback('새 전구가 기울지 않도록 수직 정렬했습니다. 이제 시계 방향으로 두 바퀴 돌리세요.');
    } else if (stage === 'test') {
      ui.action.innerHTML = '전원 복구하고 점등 시험 <span>●</span>';
      ui.action.disabled = false;
      ui.testLabel.textContent = '차단기 내려감 · 스위치 꺼짐';
      tweenCamera(new THREE.Vector3(7.4, 5.4, 8.7), new THREE.Vector3(0, 2.9, -0.3), 820);
      setFeedback('전구와 공구에서 손을 떼고 작업 구역을 정리했습니다. 전원을 복구해 결과를 확인하세요.');
    }
    setSessionLabel(`전구 교체 · ${index + 1}/6 ${ui.route[index].querySelector('b').textContent}`);
  }

  function action() {
    if (state.stage === 'inspect') setStage('shop');
    else if (state.stage === 'shop') attemptPurchase();
    else if (state.stage === 'safety') setStage('remove');
    else if (state.stage === 'test') powerOn();
  }

  function powerOn() {
    state.powered = true;
    state.completed = true;
    warmLight.intensity = 28;
    newBulb.userData.glassMaterial.emissive.setHex(0xff9a35);
    newBulb.userData.glassMaterial.emissiveIntensity = 2.8;
    newBulb.userData.glassMaterial.color.setHex(0xffd18a);
    newBulb.userData.diodeMaterial.emissive.setHex(0xffb24c);
    newBulb.userData.diodeMaterial.emissiveIntensity = 3;
    ui.testLabel.textContent = '점등 정상 · 조광 범위 정상';
    ui.errorCount.textContent = `${state.purchaseErrors}회`;
    const purchased = data.products.find((product) => product.id === state.purchasedProduct);
    ui.purchasePrice.textContent = formatWon(purchased?.price ?? 0);
    setFeedback('점등 성공: 깜박임 없이 2700 K 전구색으로 켜졌고 조광에도 정상 반응합니다.', 'success');
    ui.action.disabled = true;
    setSessionLabel('전구 교체 · 검증 완료');
    tweenCamera(new THREE.Vector3(8.2, 5.8, 9.6), new THREE.Vector3(0, 2.85, -0.5), 900);
    ui.workspace.hidden = true;
    ui.completion.hidden = false;
  }

  function pointerAngle(event) {
    const rect = ui.turnDial.getBoundingClientRect();
    return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2));
  }

  ui.turnDial.addEventListener('pointerdown', (event) => {
    if (!['remove', 'install'].includes(state.stage)) return;
    state.turning = true;
    state.lastAngle = pointerAngle(event);
    ui.turnDial.setPointerCapture(event.pointerId);
  });
  ui.turnDial.addEventListener('pointermove', (event) => {
    if (!state.turning || !ui.turnDial.hasPointerCapture(event.pointerId)) return;
    const angle = pointerAngle(event);
    let delta = angle - state.lastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    state.lastAngle = angle;
    state.turning = false;
    addTurnDelta(delta);
    if (state.turnProgress < Math.PI * 4) state.turning = true;
  });
  const endPointer = (event) => {
    if (ui.turnDial.hasPointerCapture(event.pointerId)) ui.turnDial.releasePointerCapture(event.pointerId);
    state.turning = false;
    if (state.turnProgress >= Math.PI * 4 && !state.turnComplete) completeTurn();
  };
  ui.turnDial.addEventListener('pointerup', endPointer);
  ui.turnDial.addEventListener('pointercancel', endPointer);
  ui.turnDial.addEventListener('keydown', (event) => {
    const wanted = state.stage === 'remove' ? 'ArrowLeft' : 'ArrowRight';
    if (event.code !== wanted) return;
    event.preventDefault();
    addTurnDelta(Math.PI / 6 * state.turnDirection);
  });

  ui.safetyButtons.forEach((button) => button.addEventListener('click', () => toggleSafety(button.dataset.safety)));
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
    controls.minDistance = 2.4;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI * 0.88;
    renderClues();
    setStage('inspect');
    tweenCamera(new THREE.Vector3(7.2, 5.4, 8.5), new THREE.Vector3(0, 3.1, -0.4), 900);
  }

  function update(now) {
    if (!state.active) return;
    if (socketMarker.visible) socketMarker.material.opacity = 0.42 + Math.sin(now * 0.006) * 0.24;
    if (shadeMarker.visible) shadeMarker.material.opacity = 0.42 + Math.sin(now * 0.006) * 0.24;
    if (switchMarker.visible) switchMarker.material.opacity = 0.32 + Math.sin(now * 0.006) * 0.18;
    if (state.powered) warmLight.intensity = 27 + Math.sin(now * 0.0018) * 0.4;
  }

  function qaAdvanceTurn() {
    if (!['remove', 'install'].includes(state.stage)) return false;
    state.turnProgress = Math.PI * 4;
    state.turning = false;
    state.turnComplete = false;
    updateTurnVisual();
    return true;
  }

  buildScene();

  return {
    start,
    update,
    qa: {
      state() {
        return {
          active: state.active,
          stage: state.stage,
          clues: [...state.clues],
          safety: [...state.safety],
          selectedProduct: state.selectedProduct,
          purchasedProduct: state.purchasedProduct,
          purchaseErrors: state.purchaseErrors,
          turnProgress: state.turnProgress,
          powered: state.powered,
          completed: state.completed,
        };
      },
      inspectAll() { data.clues.forEach((clue) => inspectClue(clue.id)); },
      selectProduct,
      checkSafety() { ['switch', 'breaker', 'cool'].forEach(toggleSafety); },
      completeTurn: qaAdvanceTurn,
      compatibility(id) {
        const product = data.products.find((item) => item.id === id);
        return compatibility(product);
      },
    },
  };
}
