import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const STAGES = ['inspect', 'shop', 'safety', 'remove', 'install', 'test', 'dispose'];
const TURN_TARGET = Math.PI / 2;
const STAGE_COPY = {
  inspect: {
    code: '진단 01',
    title: '형광등을 사기 전에<br />기구부터 확인하세요',
    copy: '길이가 비슷해도 램프 코드·핀·소비전력·안정기가 다를 수 있습니다. 천장 기구의 다섯 단서를 조사하세요.',
  },
  shop: {
    code: '판별 02',
    title: '포장 표기를 비교해<br />호환 램프를 고르세요',
    copy: 'G13과 1200 mm만 맞는다고 끝이 아닙니다. 형광·LED 구분과 소비전력, 안정기 방식, 색온도까지 대조하세요.',
  },
  safety: {
    code: '안전 03',
    title: '유리관을 잡기 전에<br />전원을 차단하세요',
    copy: '벽 스위치와 조명 회로 차단기를 끄고 램프가 식었는지 확인합니다. 금이나 그을림이 보이면 작업을 멈춥니다.',
  },
  remove: {
    code: '분리 04',
    title: '양끝을 잡고<br />90°만 돌리세요',
    copy: '유리관 중앙을 누르지 말고 양쪽 끝을 같은 힘으로 잡습니다. G13 핀이 소켓 홈과 평행해질 때까지만 돌립니다.',
  },
  install: {
    code: '장착 05',
    title: 'G13 핀을 넣고<br />90° 잠그세요',
    copy: '양쪽 두 핀을 소켓 홈에 동시에 넣은 뒤 반대 방향으로 90° 돌립니다. 두 끝이 같은 높이인지 확인하세요.',
  },
  test: {
    code: '검증 06',
    title: '전원을 복구하고<br />점등 상태를 보세요',
    copy: '램프와 공구에서 손을 뗀 뒤 전원을 복구합니다. 즉시 점등되는지, 떨림·이상 소음·과열이 없는지 확인하세요.',
  },
  dispose: {
    code: '배출 07',
    title: '기존 형광등을<br />어디에 버릴까요?',
    copy: '폐형광등은 수은을 포함하므로 일반 쓰레기나 유리병 수거함에 넣지 않습니다. 깨지지 않은 상태로 전용 수거함을 찾으세요.',
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

function createTube({ powered = false } = {}) {
  const tube = new THREE.Group();
  const glassMaterial = physical(powered ? 0xe9f9ff : 0xe5e8e5, {
    roughness: 0.16,
    clearcoat: 0.75,
    clearcoatRoughness: 0.08,
    transmission: 0.22,
    thickness: 0.18,
    transparent: true,
    opacity: 0.92,
    emissive: powered ? 0xbdefff : 0x111616,
    emissiveIntensity: powered ? 4.2 : 0.06,
  });
  const glass = cylinder(tube, 0.105, 4, [0, 0, 0], glassMaterial, 64, 'x');
  glass.name = 'T8_glass_26mm';

  const capMaterial = physical(0xd6d8d4, { roughness: 0.34, metalness: 0.68, clearcoat: 0.3 });
  for (const side of [-1, 1]) {
    const cap = cylinder(tube, 0.112, 0.18, [side * 2.05, 0, 0], capMaterial, 48, 'x');
    cap.name = `G13_cap_${side < 0 ? 'left' : 'right'}`;
    for (const z of [-0.047, 0.047]) {
      const pin = cylinder(tube, 0.012, 0.16, [side * 2.19, 0, z], physical(0xb7a76e, { roughness: 0.22, metalness: 0.88 }), 18, 'x');
      pin.name = 'G13_pin';
    }
  }

  const print = box(tube, [0.72, 0.006, 0.11], [-1.25, -0.103, 0], physical(0x7e8583, { roughness: 0.7 }), 0.005);
  print.name = 'FHF32SS_EX_D_print';
  tube.userData.glassMaterial = glassMaterial;
  return tube;
}

function formatWon(value) {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}

export function createFluorescentModule({
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
    workspace: $('#fluorescent-workspace'),
    completion: $('#fluorescent-completion'),
    menu: $('#fluorescent-menu-button'),
    restart: $('#fluorescent-restart-button'),
    stepCode: $('#fluorescent-step-code'),
    title: $('#fluorescent-title'),
    copy: $('#fluorescent-copy'),
    progress: $('#fluorescent-progress-fill'),
    routeProgress: $('#fluorescent-route-progress'),
    route: [...document.querySelectorAll('[data-fluorescent-stage]')],
    inspection: $('#fluorescent-inspection'),
    clues: $('#fluorescent-clues'),
    clueCount: $('#fluorescent-clue-count'),
    specSheet: $('#fluorescent-spec-sheet'),
    shop: $('#fluorescent-shop'),
    products: $('#fluorescent-products'),
    compare: $('#fluorescent-compare'),
    safety: $('#fluorescent-safety'),
    safetyButtons: [...document.querySelectorAll('[data-safety]')],
    safetyCount: $('#fluorescent-safety-count'),
    turn: $('#fluorescent-turn'),
    turnDial: $('#fluorescent-turn-dial'),
    turnHand: $('#fluorescent-dial-hand'),
    turnLabel: $('#fluorescent-turn-label'),
    turnCount: $('#fluorescent-turn-count'),
    turnDirection: $('#fluorescent-turn-direction'),
    turnHelp: $('#fluorescent-turn-help'),
    test: $('#fluorescent-test'),
    testLabel: $('#fluorescent-test-label'),
    disposal: $('#fluorescent-disposal'),
    disposalOptions: $('#fluorescent-disposal-options'),
    feedback: $('#fluorescent-feedback'),
    action: $('#fluorescent-action'),
    errorCount: $('#fluorescent-error-count'),
    purchasePrice: $('#fluorescent-purchase-price'),
  };

  const state = {
    active: false,
    stage: 'inspect',
    clues: new Set(),
    safety: new Set(),
    selectedProduct: null,
    purchasedProduct: null,
    selectedDisposal: null,
    purchaseErrors: 0,
    disposalErrors: 0,
    turnProgress: 0,
    turnDirection: 1,
    turning: false,
    turnComplete: false,
    lastAngle: 0,
    powered: false,
    completed: false,
  };

  const root = new THREE.Group();
  root.name = 'FLUORESCENT_REPLACEMENT_LAB';
  root.visible = false;
  scene.add(root);

  const coolLight = new THREE.PointLight(0xc9f3ff, 0, 14, 1.2);
  coolLight.position.set(0, 4.2, 0);
  root.add(coolLight);

  let oldTube;
  let newTube;
  let ballastMarker;
  let socketMarkerLeft;
  let socketMarkerRight;
  let fixtureMarker;
  let tubeMarker;

  function buildScene() {
    const wall = physical(0x444943, { roughness: 0.92, metalness: 0 });
    const floorMat = physical(0x30291f, { roughness: 0.78, metalness: 0.02 });
    const wood = physical(0x59412b, { roughness: 0.6, metalness: 0.02, clearcoat: 0.22 });
    const charcoal = physical(0x171b1b, { roughness: 0.36, metalness: 0.62 });
    const whiteMetal = physical(0xd9dcd8, { roughness: 0.34, metalness: 0.54, clearcoat: 0.25 });
    const socketMat = physical(0xf0ede4, { roughness: 0.62, metalness: 0.04 });

    // Keep the same room composition as the previous module.
    box(root, [13, 0.2, 10], [0, -0.08, 0], floorMat, 0);
    box(root, [13, 6.8, 0.2], [0, 3.3, -4.2], wall, 0);
    box(root, [0.2, 6.8, 10], [-6.4, 3.3, 0], physical(0x333a37, { roughness: 0.9 }), 0);
    box(root, [13, 0.18, 10], [0, 6.65, 0], physical(0x555b56, { roughness: 0.92 }), 0);
    box(root, [4.3, 0.22, 1.25], [1.7, 1.05, -2.7], wood, 0.08);
    for (const x of [-0.25, 3.65]) box(root, [0.18, 1.1, 0.18], [x, 0.5, -2.7], charcoal, 0.04);
    box(root, [1.55, 1.05, 0.08], [1.7, 2.25, -4.05], physical(0x161b1b, { roughness: 0.5, metalness: 0.3 }), 0.03);
    box(root, [1.38, 0.88, 0.04], [1.7, 2.25, -3.99], physical(0x8e775d, { roughness: 0.82 }), 0.01);
    cylinder(root, [0.37, 0.46], 0.62, [3.2, 1.45, -2.7], physical(0x8b9d88, { roughness: 0.72 }), 48);
    for (let index = 0; index < 9; index += 1) {
      const leaf = box(root, [0.08, 0.8, 0.18], [3.2, 1.95, -2.7], physical(0x50755b, { roughness: 0.78 }), 0.04);
      leaf.rotation.z = (index - 4) * 0.23;
      leaf.rotation.y = index * 0.78;
    }

    // Ceiling-mounted open fluorescent fixture, lowered slightly for training visibility.
    const fixture = new THREE.Group();
    fixture.name = 'HF32_ceiling_fixture';
    fixture.position.set(0, 4.75, 0);
    root.add(fixture);
    box(fixture, [4.85, 0.22, 1.48], [0, 0.18, 0], whiteMetal, 0.08);
    box(fixture, [4.6, 0.07, 0.44], [0, -0.04, -0.55], physical(0xf2f3ef, { roughness: 0.42, metalness: 0.35 }), 0.03);
    box(fixture, [4.6, 0.07, 0.44], [0, -0.04, 0.55], physical(0xf2f3ef, { roughness: 0.42, metalness: 0.35 }), 0.03);

    for (const x of [-2.16, 2.16]) {
      const socket = box(fixture, [0.24, 0.38, 0.46], [x, -0.05, 0], socketMat, 0.07);
      socket.name = `G13_socket_${x < 0 ? 'left' : 'right'}`;
      box(socket, [0.035, 0.13, 0.22], [x < 0 ? 0.12 : -0.12, -0.08, 0], charcoal, 0.01);
    }
    const ballast = box(fixture, [1.45, 0.22, 0.38], [0, -0.01, 0.47], charcoal, 0.04);
    ballast.name = 'HF32_electronic_ballast';
    const ballastLabel = box(ballast, [1.08, 0.008, 0.23], [0, -0.115, 0], physical(0xe7e9e4, { roughness: 0.75 }), 0.01);
    ballastLabel.name = 'ballast_label_32W_1lamp';
    for (let index = 0; index < 4; index += 1) box(ballastLabel, [0.75 - index * 0.08, 0.006, 0.009], [0, -0.006, -0.075 + index * 0.05], charcoal, 0);

    oldTube = createTube();
    oldTube.name = 'existing_FHF32SS_EX_D';
    oldTube.position.set(0, 4.45, 0);
    root.add(oldTube);

    newTube = createTube();
    newTube.name = 'replacement_FHF32SS_EX_D';
    newTube.position.set(1.7, 1.42, -2.65);
    newTube.rotation.z = 0.04;
    newTube.visible = false;
    root.add(newTube);

    // Removed acrylic diffuser remains on the table, so the room stays believable.
    const diffuser = box(root, [4.65, 0.06, 1.34], [1.0, 1.35, -2.25], physical(0xd9eff2, {
      roughness: 0.2,
      transmission: 0.5,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    }), 0.08);
    diffuser.rotation.y = -0.08;

    const markerMaterial = physical(0x9edfff, { roughness: 0.2, emissive: 0x36aee8, emissiveIntensity: 2.4, transparent: true, opacity: 0.62 });
    fixtureMarker = box(root, [4.95, 0.04, 1.6], [0, 4.58, 0], markerMaterial.clone(), 0.08);
    fixtureMarker.visible = false;
    tubeMarker = box(root, [4.35, 0.025, 0.31], [0, 4.45, 0], markerMaterial.clone(), 0.12);
    tubeMarker.visible = false;
    socketMarkerLeft = box(root, [0.32, 0.47, 0.55], [-2.16, 4.7, 0], markerMaterial.clone(), 0.08);
    socketMarkerRight = box(root, [0.32, 0.47, 0.55], [2.16, 4.7, 0], markerMaterial.clone(), 0.08);
    socketMarkerLeft.visible = false;
    socketMarkerRight.visible = false;
    ballastMarker = box(root, [1.55, 0.05, 0.48], [0, 4.61, 0.47], markerMaterial.clone(), 0.05);
    ballastMarker.visible = false;

    const fill = new THREE.SpotLight(0xe1f4ff, 18, 22, Math.PI / 4, 0.65, 1.4);
    fill.position.set(4, 8, 6);
    fill.target.position.set(0, 3.5, 0);
    fill.castShadow = true;
    root.add(fill, fill.target);
    const roomFill = new THREE.PointLight(0x8eb7b8, 3.2, 16, 1.7);
    roomFill.position.set(-4.5, 4.4, 2.2);
    root.add(roomFill);
  }

  function specMarkup() {
    const found = (id) => state.clues.has(id);
    return [
      ['printing', '램프 코드', 'FHF32SS · 32 W'],
      ['pins', '관·핀 규격', 'T8 Ø26 · G13'],
      ['length', '길이', '약 1,198 mm'],
      ['ballast', '안정기', '전자식 HF32'],
      ['color', '빛 색', 'EX-D · 6500 K'],
    ].map(([id, label, value]) => `<span class="${found(id) ? '' : 'is-unknown'}"><small>${label}</small><b>${found(id) ? value : '미확인'}</b></span>`).join('');
  }

  function renderClues() {
    ui.clues.innerHTML = data.clues.map((clue) => `<button class="fluorescent-clue${state.clues.has(clue.id) ? ' is-found' : ''}" type="button" data-clue="${clue.id}">
      <small>${clue.code}</small><b>${clue.name}</b><span>${state.clues.has(clue.id) ? clue.value : '3D 천장등에서 확인하기'}</span>
    </button>`).join('');
    ui.clues.querySelectorAll('[data-clue]').forEach((button) => button.addEventListener('click', () => inspectClue(button.dataset.clue)));
    ui.clueCount.textContent = `${state.clues.size} / ${data.clues.length} 발견`;
    ui.specSheet.innerHTML = specMarkup();
  }

  function focusClue(clue) {
    tubeMarker.visible = ['printing', 'color'].includes(clue.id);
    fixtureMarker.visible = clue.id === 'length';
    socketMarkerLeft.visible = clue.id === 'pins';
    socketMarkerRight.visible = clue.id === 'pins';
    ballastMarker.visible = clue.id === 'ballast';
    const views = {
      tube: [new THREE.Vector3(5.8, 4.8, 5.8), new THREE.Vector3(0, 4.45, 0)],
      socket: [new THREE.Vector3(5.1, 4.7, 2.65), new THREE.Vector3(2.08, 4.5, 0)],
      fixture: [new THREE.Vector3(5.8, 6.2, 6.5), new THREE.Vector3(0, 4.65, 0)],
      ballast: [new THREE.Vector3(2.7, 5.65, 3.4), new THREE.Vector3(0, 4.72, 0.45)],
    };
    const [position, target] = views[clue.camera];
    tweenCamera(position, target, 620);
  }

  function setFeedback(message, tone = '') {
    ui.feedback.className = `fluorescent-feedback${tone ? ` is-${tone}` : ''}`;
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
    const ballastLabel = (value) => ({
      HF32: '전자식 HF32',
      FL20: 'FL20 전용',
      FPL36: 'FPL36 전용',
      EM_OR_AC: '자기식 안정기 또는 AC 직결',
    })[value] ?? value;
    return [
      { label: '램프 방식', pass: product.technology === required.technology && product.form === required.form, actual: product.technology === 'led' ? 'LED T8' : product.form, need: '형광 T8' },
      { label: '소켓', pass: product.base === required.base, actual: product.base, need: required.base },
      { label: '소비전력', pass: product.watts === required.watts, actual: `${product.watts} W`, need: `${required.watts} W` },
      { label: '길이', pass: Math.abs(product.lengthMm - required.lengthMm) <= 5, actual: `${product.lengthMm} mm`, need: `약 ${required.lengthMm} mm` },
      { label: '색온도', pass: product.cct === required.cct, actual: `${product.cct} K`, need: `${required.cct} K` },
      { label: '안정기', pass: product.ballast === required.ballast, actual: ballastLabel(product.ballast), need: ballastLabel(required.ballast) },
    ];
  }

  function renderProducts() {
    ui.products.innerHTML = data.products.map((product) => `<button type="button" class="fluorescent-product${state.selectedProduct === product.id ? ' is-selected' : ''}" data-product="${product.id}" style="--fluorescent-accent:${product.accent}">
      <span class="fluorescent-product-visual"><i></i></span>
      <span class="fluorescent-product-copy"><small>${product.maker} · ${product.base}</small><b>${product.name}</b><span>${product.pack}</span><strong>${formatWon(product.price)}</strong></span>
    </button>`).join('');
    ui.products.querySelectorAll('[data-product]').forEach((button) => button.addEventListener('click', () => selectProduct(button.dataset.product)));
  }

  function selectProduct(id) {
    state.selectedProduct = id;
    const product = data.products.find((item) => item.id === id);
    const checks = compatibility(product);
    renderProducts();
    const allPass = checks.every((check) => check.pass);
    ui.compare.className = `fluorescent-compare ${allPass ? 'is-pass' : 'is-fail'}`;
    ui.compare.innerHTML = `<b>${allPass ? '이 천장등에 사용할 수 있는 규격입니다.' : '겉모양이 비슷해도 맞지 않는 항목이 있습니다.'}</b><br />${checks.map((check) => `<span class="${check.pass ? 'is-match' : 'is-mismatch'}">${check.pass ? '✓' : '×'} ${check.label} ${check.actual}</span>`).join(' · ')}`;
    ui.action.disabled = false;
    setFeedback(allPass ? '브랜드가 달라도 여섯 호환 항목이 맞으면 선택할 수 있습니다.' : '구매를 시도하면 실제로 설치할 수 없는 이유를 확인할 수 있습니다.');
  }

  function wrongProductFeedback(product, checks) {
    const failed = checks.filter((check) => !check.pass);
    const consequences = [];
    if (failed.some((item) => item.label === '램프 방식')) consequences.push('이 LED 대체관은 현재 HF32 안정기에 그대로 연결하는 제품이 아닙니다');
    if (failed.some((item) => item.label === '소켓')) consequences.push('소켓 핀 배열이 달라 물리적으로 장착되지 않습니다');
    if (failed.some((item) => item.label === '길이')) consequences.push('양쪽 소켓에 동시에 닿지 않습니다');
    if (failed.some((item) => item.label === '소비전력' || item.label === '안정기')) consequences.push('점등 실패·깜박임·안정기 과열 위험이 있습니다');
    if (failed.some((item) => item.label === '색온도')) consequences.push('기존 방의 흰빛과 색이 달라집니다');
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
    newTube.visible = true;
    setFeedback(`<b>${product.name}</b>을 ${formatWon(product.price)}에 선택했습니다. 안전 준비로 이동합니다.`, 'success');
    window.setTimeout(() => setStage('safety'), 420);
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
    setFeedback(state.safety.size === 3 ? '전원 차단과 유리관 상태를 모두 확인했습니다. 양끝을 잡고 분리할 수 있습니다.' : '스위치만 끄는 데서 끝내지 말고 세 항목을 모두 확인하세요.', state.safety.size === 3 ? 'success' : '');
  }

  function resetTurn(direction) {
    state.turnProgress = 0;
    state.turnDirection = direction;
    state.turning = false;
    state.turnComplete = false;
    updateTurnVisual();
  }

  function updateTurnVisual() {
    const percent = Math.min(1, state.turnProgress / TURN_TARGET);
    const signedRotation = state.turnProgress * state.turnDirection;
    ui.turnHand.style.transform = `rotate(${signedRotation}rad)`;
    ui.turnDial.setAttribute('aria-valuenow', String(Math.round(percent * 100)));
    ui.turnCount.textContent = `${Math.round(percent * 90)}° / 90°`;
    if (state.stage === 'remove') {
      oldTube.rotation.x = signedRotation;
      oldTube.position.y = 4.45 - percent * 0.08;
    } else if (state.stage === 'install') {
      newTube.rotation.set(Math.PI / 2 + signedRotation, 0, 0);
      newTube.position.lerpVectors(new THREE.Vector3(0, 3.88, 0), new THREE.Vector3(0, 4.45, 0), percent);
    }
    if (percent >= 1 && !state.turnComplete) completeTurn();
  }

  function addTurnDelta(delta) {
    if (!['remove', 'install'].includes(state.stage)) return;
    const directed = delta * state.turnDirection;
    if (directed > 0) state.turnProgress = Math.min(TURN_TARGET, state.turnProgress + directed);
    else state.turnProgress = Math.max(0, state.turnProgress + directed * 0.18);
    updateTurnVisual();
  }

  function completeTurn() {
    if (state.turnComplete) return;
    state.turnComplete = true;
    state.turning = false;
    if (state.stage === 'remove') {
      setFeedback('G13 핀이 홈과 평행해졌습니다. 유리관을 수평으로 유지해 아래로 분리합니다.', 'success');
      window.setTimeout(() => {
        oldTube.visible = false;
        newTube.visible = true;
        newTube.position.set(0, 3.88, 0);
        newTube.rotation.set(Math.PI / 2, 0, 0);
        setStage('install');
      }, 520);
    } else {
      setFeedback('양끝 G13 소켓이 같은 각도로 잠겼습니다. 램프가 수평이고 흔들리지 않습니다.', 'success');
      window.setTimeout(() => setStage('test'), 520);
    }
  }

  function renderDisposal() {
    ui.disposalOptions.innerHTML = data.disposalOptions.map((option) => `<button type="button" data-disposal="${option.id}" class="${state.selectedDisposal === option.id ? 'is-selected' : ''}">
      <i>${option.correct ? '♻' : '×'}</i><span><b>${option.name}</b><small>${option.description}</small></span><em>선택</em>
    </button>`).join('');
    ui.disposalOptions.querySelectorAll('[data-disposal]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedDisposal = button.dataset.disposal;
        renderDisposal();
        ui.action.disabled = false;
        setFeedback('배출 방법을 확정하면 왜 맞거나 틀린지 확인할 수 있습니다.');
      });
    });
  }

  function attemptDisposal() {
    const option = data.disposalOptions.find((item) => item.id === state.selectedDisposal);
    if (!option?.correct) {
      state.disposalErrors += 1;
      setFeedback('<b>배출 방법이 잘못되었습니다.</b> 폐형광등은 수은을 포함하므로 일반 종량제 봉투나 유리병 수거함이 아니라 전용 수거함에 깨지지 않게 배출해야 합니다.', 'error');
      return;
    }
    finishExperience();
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
      item.classList.toggle('is-active', item.dataset.fluorescentStage === stage);
      item.classList.toggle('is-done', itemIndex < index);
    });
    ui.inspection.hidden = stage !== 'inspect';
    ui.shop.hidden = stage !== 'shop';
    ui.safety.hidden = stage !== 'safety';
    ui.turn.hidden = !['remove', 'install'].includes(stage);
    ui.test.hidden = stage !== 'test';
    ui.disposal.hidden = stage !== 'dispose';
    ui.action.hidden = false;
    ui.action.disabled = true;

    if (stage === 'inspect') {
      ui.action.innerHTML = '현장 규격 확정 <span>→</span>';
      ui.action.disabled = state.clues.size !== data.clues.length;
    } else if (stage === 'shop') {
      ui.action.innerHTML = '선택한 형광등 구매 <span>→</span>';
      ui.action.disabled = !state.selectedProduct;
      renderProducts();
      tweenCamera(new THREE.Vector3(7.2, 5.4, 8.3), new THREE.Vector3(0, 4.0, -0.2), 720);
      setFeedback('형광 T8 · G13 · 32 W · 약 1,198 mm · 6500 K · HF32 안정기를 제품 포장과 대조하세요.');
    } else if (stage === 'safety') {
      ui.action.innerHTML = '안전 조건 확인하고 분리 <span>→</span>';
      ui.action.disabled = state.safety.size !== 3;
      tweenCamera(new THREE.Vector3(6.2, 5.4, 6.8), new THREE.Vector3(0, 4.25, 0), 680);
      setFeedback('형광램프는 긴 유리관입니다. 전원을 차단하고 파손 여부를 양끝까지 확인하세요.');
    } else if (stage === 'remove') {
      resetTurn(1);
      ui.turnLabel.textContent = '핀 홈에 맞춰 90° 돌리기';
      ui.turnDirection.textContent = '↷';
      ui.turnHelp.textContent = '유리관 중앙을 누르지 않고 양끝을 잡아 두 G13 핀이 소켓 홈과 평행해질 때까지만 90도 돌립니다.';
      ui.action.innerHTML = '90° 회전해 분리하세요 <span>↷</span>';
      tweenCamera(new THREE.Vector3(5.5, 4.7, 5.3), new THREE.Vector3(0, 4.4, 0), 600);
      setFeedback('다이얼을 시계 방향으로 1/4바퀴 그리세요. 90° 이상 억지로 돌리지 않습니다.');
    } else if (stage === 'install') {
      resetTurn(-1);
      ui.turnLabel.textContent = 'G13 핀을 넣고 90° 잠그기';
      ui.turnDirection.textContent = '↶';
      ui.turnHelp.textContent = '양쪽 핀을 홈에 동시에 넣고 반시계 방향으로 90도 돌려 수평 위치에서 잠급니다.';
      ui.action.innerHTML = '90° 회전해 잠그세요 <span>↶</span>';
      setFeedback('새 램프의 두 핀이 양쪽 소켓 홈에 들어갔습니다. 반대 방향으로 1/4바퀴 돌리세요.');
    } else if (stage === 'test') {
      ui.action.innerHTML = '전원 복구하고 점등 시험 <span>●</span>';
      ui.action.disabled = false;
      ui.testLabel.textContent = '차단기 내려감 · 스위치 꺼짐';
      tweenCamera(new THREE.Vector3(7.2, 5.6, 7.8), new THREE.Vector3(0, 3.9, -0.2), 760);
      setFeedback('램프에서 손을 떼고 디퓨저는 아직 열어 둔 상태입니다. 전원을 복구해 이상 여부를 먼저 확인하세요.');
    } else if (stage === 'dispose') {
      state.selectedDisposal = null;
      ui.action.innerHTML = '선택한 방법으로 배출 <span>♻</span>';
      renderDisposal();
      setFeedback('점등은 끝났지만 기존 형광램프 처리까지가 교체 작업입니다.');
    }
    setSessionLabel(`형광등 교체 · ${index + 1}/7 ${ui.route[index].querySelector('b').textContent}`);
  }

  function action() {
    if (state.stage === 'inspect') setStage('shop');
    else if (state.stage === 'shop') attemptPurchase();
    else if (state.stage === 'safety') setStage('remove');
    else if (state.stage === 'test') powerOn();
    else if (state.stage === 'dispose') attemptDisposal();
  }

  function powerOn() {
    state.powered = true;
    coolLight.intensity = 34;
    newTube.userData.glassMaterial.emissive.setHex(0xbdefff);
    newTube.userData.glassMaterial.emissiveIntensity = 4.5;
    newTube.userData.glassMaterial.color.setHex(0xe9f9ff);
    ui.testLabel.textContent = '즉시 점등 · 떨림·이상 소음 없음';
    setFeedback('점등 성공: 6500 K 주광색으로 안정적으로 켜졌습니다. 이제 기존 폐형광등을 올바르게 배출하세요.', 'success');
    ui.action.disabled = true;
    window.setTimeout(() => setStage('dispose'), 620);
  }

  function finishExperience() {
    state.completed = true;
    const purchased = data.products.find((product) => product.id === state.purchasedProduct);
    ui.errorCount.textContent = `${state.purchaseErrors}회`;
    ui.purchasePrice.textContent = formatWon(purchased?.price ?? 0);
    setSessionLabel('형광등 교체 · 배출까지 완료');
    tweenCamera(new THREE.Vector3(8.2, 5.8, 9.2), new THREE.Vector3(0, 3.6, -0.5), 820);
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
    if (state.turnProgress < TURN_TARGET) state.turning = true;
  });
  const endPointer = (event) => {
    if (ui.turnDial.hasPointerCapture(event.pointerId)) ui.turnDial.releasePointerCapture(event.pointerId);
    state.turning = false;
    if (state.turnProgress >= TURN_TARGET && !state.turnComplete) completeTurn();
  };
  ui.turnDial.addEventListener('pointerup', endPointer);
  ui.turnDial.addEventListener('pointercancel', endPointer);
  ui.turnDial.addEventListener('keydown', (event) => {
    const wanted = state.stage === 'remove' ? 'ArrowRight' : 'ArrowLeft';
    if (event.code !== wanted) return;
    event.preventDefault();
    addTurnDelta(Math.PI / 12 * state.turnDirection);
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
    tweenCamera(new THREE.Vector3(7.4, 5.7, 8.4), new THREE.Vector3(0, 3.9, -0.3), 840);
  }

  function update(now) {
    if (!state.active) return;
    [tubeMarker, fixtureMarker, socketMarkerLeft, socketMarkerRight, ballastMarker].forEach((marker, index) => {
      if (marker?.visible) marker.material.opacity = 0.4 + Math.sin(now * 0.006 + index) * 0.2;
    });
    if (state.powered) coolLight.intensity = 33 + Math.sin(now * 0.002) * 0.4;
  }

  function qaAdvanceTurn() {
    if (!['remove', 'install'].includes(state.stage)) return false;
    state.turnProgress = TURN_TARGET;
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
          selectedDisposal: state.selectedDisposal,
          purchaseErrors: state.purchaseErrors,
          disposalErrors: state.disposalErrors,
          turnProgress: state.turnProgress,
          powered: state.powered,
          completed: state.completed,
        };
      },
      inspectAll() { data.clues.forEach((clue) => inspectClue(clue.id)); },
      selectProduct,
      checkSafety() { ['switch', 'breaker', 'cool'].forEach(toggleSafety); },
      completeTurn: qaAdvanceTurn,
      selectDisposal(id) {
        state.selectedDisposal = id;
        renderDisposal();
        ui.action.disabled = false;
      },
      compatibility(id) {
        const product = data.products.find((item) => item.id === id);
        return compatibility(product);
      },
    },
  };
}
