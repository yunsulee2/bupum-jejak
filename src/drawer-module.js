import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const STAGES = ['kit', 'frame', 'lock', 'rails', 'square', 'drawers', 'anchor', 'test'];
const STAGE_COPY = {
  kit: {
    title: '설명서를 펼치고<br />부품부터 구분하세요',
    copy: '비슷해 보이는 판재도 구멍과 마감면의 방향이 다릅니다. 키트를 고른 뒤 수량과 판재 표시부터 확인하세요.',
  },
  frame: {
    title: '안쪽과 바깥쪽을 보고<br />골조를 먼저 세우세요',
    copy: '좌우 측판의 레일 구멍은 서로 마주 보고, 상판과 바닥판의 마감면은 바깥쪽을 향해야 합니다. 3D 부품을 빛나는 윤곽까지 직접 끌어 놓으세요.',
  },
  lock: {
    title: '캠락의 화살표를<br />연결 볼트에 맞추세요',
    copy: '캠락은 방향이 맞아야 볼트 머리를 안쪽으로 당깁니다. 먼저 홈의 화살표 방향을 고르고 멈추는 지점까지만 손으로 잠그세요.',
  },
  rails: {
    title: 'L·R과 앞쪽을 확인해<br />레일 세 쌍을 맞추세요',
    copy: '좌우를 바꾸거나 앞뒤로 뒤집으면 서랍이 끝까지 들어가지 않습니다. 레일 각인과 전면 표시를 판별한 뒤 3D 세트를 끌어 장착하세요.',
  },
  square: {
    title: '뒤판을 대기 전에<br />골조의 직각을 맞추세요',
    copy: '뒤판은 단순한 덮개가 아니라 골조가 비틀리지 않게 잡아 줍니다. 네 모서리를 맞추고 두 대각선 길이가 같은지 확인하세요.',
  },
  drawers: {
    title: '아래 칸부터 수평으로<br />서랍을 끼워 넣으세요',
    copy: '한쪽 레일만 먼저 걸면 레일이 비틀릴 수 있습니다. 양쪽을 같은 높이에 맞춘 채 아래·가운데·위 순서로 직접 끌어 넣으세요.',
  },
  anchor: {
    title: '서랍을 열기 전에<br />벽 고정 계획을 세우세요',
    copy: '서랍장은 열린 서랍의 무게로 앞으로 넘어질 수 있습니다. 벽 재질을 확인하고 그 재질에 맞는 나사와 앵커를 선택해야 합니다.',
  },
  test: {
    title: '한 칸씩 열고 닫아<br />조립 결과를 검증하세요',
    copy: '세 서랍을 각각 열어 걸림, 좌우 틈, 레일 소음과 끝단 스토퍼를 확인합니다. 소프트클로징 키트는 마지막 구간의 감속도 확인하세요.',
  },
};

function physical(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? 0.48,
    metalness: options.metalness ?? 0.04,
    clearcoat: options.clearcoat ?? 0.12,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.36,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
    depthWrite: options.depthWrite ?? true,
  });
}

function box(parent, size, position, material, radius = 0.04) {
  const maxRadius = Math.min(radius, ...size.map((value) => value / 4));
  const geometry = radius
    ? new RoundedBoxGeometry(size[0], size[1], size[2], 3, maxRadius)
    : new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radius, height, position, material, axis = 'y', segments = 28) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
  mesh.position.set(...position);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function formatWon(value) {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}

function createWoodGrainTexture(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  context.fillStyle = '#eee9df';
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let line = 0; line < 110; line += 1) {
    const y = (line / 110) * canvas.height;
    const alpha = 0.025 + (line % 7) * 0.006;
    context.strokeStyle = `rgba(57, 35, 20, ${alpha})`;
    context.lineWidth = line % 9 === 0 ? 2 : 1;
    context.beginPath();
    for (let x = -20; x <= canvas.width + 20; x += 12) {
      const wave = Math.sin(x * 0.032 + line * 0.71) * (2 + (line % 5));
      if (x === -20) context.moveTo(x, y + wave);
      else context.lineTo(x, y + wave);
    }
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.4, 3.2);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

export function createDrawerModule({
  data,
  scene,
  camera,
  controls,
  renderer,
  pcRoot,
  globalFloor,
  grid,
  setSessionLabel,
  tweenCamera,
}) {
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    workspace: $('#drawer-workspace'),
    completion: $('#drawer-completion'),
    menu: $('#drawer-menu-button'),
    restart: $('#drawer-restart-button'),
    route: [...document.querySelectorAll('[data-drawer-stage]')],
    routeProgress: $('#drawer-route-progress'),
    stepCode: $('#drawer-step-code'),
    title: $('#drawer-title'),
    copy: $('#drawer-copy'),
    progress: $('#drawer-progress-fill'),
    views: new Map(STAGES.map((stage) => [stage, $(`#drawer-${stage}`)])),
    kits: $('#drawer-kits'),
    inventory: $('#drawer-inventory'),
    inventoryCount: $('#drawer-inventory-count'),
    frameCount: $('#drawer-frame-count'),
    frameTask: $('#drawer-frame-task'),
    frameParts: [...document.querySelectorAll('[data-drawer-frame-part]')],
    lockChoices: [...document.querySelectorAll('[data-drawer-lock]')],
    railChoices: [...document.querySelectorAll('[data-drawer-rail]')],
    railState: $('#drawer-rail-state'),
    railDrag: $('#drawer-rail-drag'),
    squareState: $('#drawer-square-state'),
    diagonalChoices: $('#drawer-diagonal-choices'),
    diagonalButtons: [...document.querySelectorAll('[data-drawer-diagonal]')],
    drawerCount: $('#drawer-drawer-count'),
    drawerTask: $('#drawer-drawer-task'),
    drawerSlots: [...document.querySelectorAll('[data-drawer-slot]')],
    wallChoices: [...document.querySelectorAll('[data-drawer-wall]')],
    anchorPlan: $('#drawer-anchor-plan'),
    anchorChoices: [...document.querySelectorAll('[data-drawer-anchor]')],
    testCount: $('#drawer-test-count'),
    testButtons: [...document.querySelectorAll('[data-drawer-test]')],
    feedback: $('#drawer-feedback'),
    action: $('#drawer-action'),
    dragCoach: $('#drawer-drag-coach'),
    dragDistance: $('#drawer-drag-distance'),
    resultKit: $('#drawer-result-kit'),
    resultFinish: $('#drawer-result-finish'),
    resultRail: $('#drawer-result-rail'),
    errorCount: $('#drawer-error-count'),
  };

  const state = {
    active: false,
    stage: 'kit',
    kitId: null,
    inventory: new Set(),
    installed: new Set(),
    camLocked: false,
    railOrientation: false,
    diagonalChecked: false,
    wall: null,
    anchorPlan: null,
    tests: new Set(),
    errors: 0,
    dragging: null,
    testing: false,
    completed: false,
  };

  const root = new THREE.Group();
  root.name = 'THREE_DRAWER_FLATPACK_LAB';
  root.visible = false;
  scene.add(root);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const parts = new Map();
  const drawers = new Map();
  const camDiscs = [];
  let targetHelper = null;
  let anchorBrackets = null;

  const panelMaterial = physical(0xe9ebe5, { roughness: 0.56, clearcoat: 0.1 });
  const edgeMaterial = physical(0xc9cec7, { roughness: 0.63 });
  const drawerMaterial = physical(0xf5f5ef, { roughness: 0.58 });
  const railMaterial = physical(0xa8afb0, { roughness: 0.24, metalness: 0.88, clearcoat: 0.32 });
  const railDarkMaterial = physical(0x343b3c, { roughness: 0.32, metalness: 0.78 });
  const hardwareMaterial = physical(0xc6cbca, { roughness: 0.2, metalness: 0.9, clearcoat: 0.42 });
  const darkMaterial = physical(0x272b2c, { roughness: 0.52, metalness: 0.35 });
  const rugMaterial = physical(0x253331, { roughness: 0.95, metalness: 0 });
  const woodGrain = createWoodGrainTexture(renderer);
  panelMaterial.map = woodGrain;
  panelMaterial.bumpMap = woodGrain;
  panelMaterial.bumpScale = 0.018;
  drawerMaterial.map = woodGrain;
  drawerMaterial.bumpMap = woodGrain;
  drawerMaterial.bumpScale = 0.012;

  function addPanelDetails(panel, size, side = 'front') {
    const edge = side === 'front' ? size[2] / 2 + 0.004 : -size[2] / 2 - 0.004;
    box(panel, [size[0] * 0.92, 0.018, 0.014], [0, size[1] / 2 - 0.12, edge], edgeMaterial, 0);
    box(panel, [size[0] * 0.92, 0.018, 0.014], [0, -size[1] / 2 + 0.12, edge], edgeMaterial, 0);
  }

  function createSidePanel(x) {
    const group = new THREE.Group();
    group.position.set(x, 2.7, -1.05);
    const panel = box(group, [0.2, 5.2, 2.35], [0, 0, 0], panelMaterial, 0.035);
    addPanelDetails(panel, [0.2, 5.2, 2.35], x < 0 ? 'front' : 'back');
    const insideX = x < 0 ? 0.115 : -0.115;
    for (const y of [-1.58, 0, 1.58]) {
      for (const z of [-0.68, 0.05, 0.68]) {
        const hole = cylinder(group, 0.038, 0.018, [insideX, y, z], darkMaterial, 'x', 18);
        hole.material = darkMaterial;
      }
    }
    return group;
  }

  function createHorizontalPanel(y, isTop) {
    const group = new THREE.Group();
    group.position.set(0, y, -1.05);
    box(group, [4.4, 0.2, 2.35], [0, 0, 0], panelMaterial, 0.045);
    box(group, [4.18, 0.025, 2.15], [0, isTop ? 0.112 : -0.112, 0], edgeMaterial, 0.02);
    for (const x of [-1.75, 1.75]) {
      cylinder(group, 0.07, 0.026, [x, isTop ? -0.115 : 0.115, 0.68], hardwareMaterial, 'y', 24);
    }
    return group;
  }

  function createRail(x, y) {
    const group = new THREE.Group();
    group.position.set(x, y, -1.05);
    box(group, [0.07, 0.13, 1.86], [0, 0, 0], railMaterial, 0.015);
    box(group, [0.082, 0.075, 1.3], [x < 0 ? 0.015 : -0.015, 0.01, 0.15], railDarkMaterial, 0.012);
    for (const z of [-0.62, 0, 0.62]) {
      cylinder(group, 0.034, 0.012, [x < 0 ? 0.046 : -0.046, 0, z], hardwareMaterial, 'x', 20);
    }
    const stop = box(group, [0.11, 0.24, 0.13], [0, 0.03, 0.84], railDarkMaterial, 0.025);
    stop.userData.frontStop = true;
    return group;
  }

  function createDrawer(id, y) {
    const group = new THREE.Group();
    group.name = id;
    const sideOffset = 1.88;
    box(group, [3.78, 0.12, 1.82], [0, -0.5, -0.05], drawerMaterial, 0.025);
    box(group, [0.15, 0.96, 1.84], [-sideOffset, -0.02, -0.05], drawerMaterial, 0.028);
    box(group, [0.15, 0.96, 1.84], [sideOffset, -0.02, -0.05], drawerMaterial, 0.028);
    box(group, [3.78, 0.96, 0.14], [0, -0.02, -0.92], drawerMaterial, 0.025);
    const front = box(group, [4.08, 1.55, 0.18], [0, 0.03, 0.96], panelMaterial, 0.045);
    addPanelDetails(front, [4.08, 1.55, 0.18]);
    box(group, [1.06, 0.09, 0.08], [0, 0.1, 1.085], darkMaterial, 0.04);
    cylinder(group, 0.055, 1.02, [0, 0.11, 1.14], hardwareMaterial, 'x', 28);
    const target = new THREE.Vector3(0, y, -1.0);
    drawers.set(id, group);
    return { group, target };
  }

  function saveFinalChildren(group) {
    return group.children.map((child) => ({
      child,
      position: child.position.clone(),
      quaternion: child.quaternion.clone(),
    }));
  }

  function addPart(id, group, source, target, targetBox, sourceLayout = null) {
    group.name = `drawer-part-${id}`;
    group.position.copy(source);
    const finalChildren = saveFinalChildren(group);
    if (sourceLayout) sourceLayout(group.children);
    group.traverse((object) => { object.userData.drawerPartId = id; });
    parts.set(id, { id, group, source: source.clone(), target: target.clone(), targetBox, finalChildren });
    root.add(group);
  }

  function buildRoom() {
    const wall = physical(0xc8c1b5, { roughness: 0.82, metalness: 0, clearcoat: 0.02 });
    const sideWall = physical(0xa9aaa2, { roughness: 0.86, metalness: 0 });
    const floorMat = physical(0x73523b, { roughness: 0.72, metalness: 0, clearcoat: 0.16 });
    const trim = physical(0xe7e2d8, { roughness: 0.62, metalness: 0 });
    box(root, [14, 0.18, 11], [0, -0.1, 0], floorMat, 0);
    box(root, [14, 7.2, 0.18], [0, 3.5, -4.45], wall, 0);
    box(root, [0.18, 7.2, 11], [-6.4, 3.5, 0], sideWall, 0);
    box(root, [13.6, 0.25, 0.16], [0, 0.12, -4.31], trim, 0.02);
    box(root, [0.16, 0.25, 10.6], [-6.25, 0.12, 0], trim, 0.02);
    box(root, [7.2, 0.06, 5.4], [0.2, 0.015, -0.3], rugMaterial, 0.08);

    const nightstand = new THREE.Group();
    box(nightstand, [1.6, 0.16, 1.45], [0, 1.2, 0], physical(0x463a31, { roughness: 0.52 }), 0.05);
    for (const x of [-0.62, 0.62]) for (const z of [-0.52, 0.52]) box(nightstand, [0.11, 1.2, 0.11], [x, 0.6, z], darkMaterial, 0.035);
    cylinder(nightstand, 0.1, 0.65, [0, 1.6, 0], hardwareMaterial, 'y', 32);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 0.7, 32, 1, true), physical(0xe7b96d, { roughness: 0.45, transparent: true, opacity: 0.82, side: THREE.DoubleSide }));
    shade.position.set(0, 2.12, 0);
    nightstand.add(shade);
    nightstand.position.set(4.8, 0, -2.4);
    root.add(nightstand);

    const plant = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.72, 32), physical(0x9e6b4b, { roughness: 0.77 }));
    pot.position.y = 0.36;
    plant.add(pot);
    for (let index = 0; index < 9; index += 1) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 12), physical(index % 2 ? 0x355b42 : 0x497553, { roughness: 0.78 }));
      const angle = (index / 9) * Math.PI * 2;
      leaf.scale.set(0.7, 1.8, 0.45);
      leaf.position.set(Math.cos(angle) * 0.4, 1.0 + (index % 3) * 0.3, Math.sin(angle) * 0.4);
      leaf.rotation.z = Math.cos(angle) * 0.5;
      plant.add(leaf);
    }
    plant.position.set(-5.3, 0, -3.4);
    root.add(plant);

    const frame = new THREE.Group();
    box(frame, [2.1, 1.45, 0.08], [0, 0, 0], physical(0x252829, { roughness: 0.44 }), 0.03);
    box(frame, [1.82, 1.17, 0.02], [0, 0, 0.06], physical(0xb5c5bf, { roughness: 0.75 }), 0);
    frame.position.set(3.7, 5.4, -4.28);
    root.add(frame);

    const warm = new THREE.PointLight(0xffbb78, 7, 10, 2);
    warm.position.set(4.8, 2.5, -2.35);
    root.add(warm);
    const fill = new THREE.SpotLight(0xa8fff0, 8, 17, Math.PI / 4, 0.7, 1.3);
    fill.position.set(-4.5, 7.4, 4.4);
    fill.target.position.set(0, 2.4, -1.0);
    root.add(fill, fill.target);
  }

  function buildAssembly() {
    const sideSet = new THREE.Group();
    sideSet.add(createSidePanel(-2.1), createSidePanel(2.1));
    addPart(
      'side-set',
      sideSet,
      new THREE.Vector3(2.55, 0, 1.45),
      new THREE.Vector3(),
      new THREE.Box3(new THREE.Vector3(-2.25, 0.05, -2.25), new THREE.Vector3(2.25, 5.35, 0.15)),
      (children) => {
        children[0].position.set(-0.75, 2.7, -1.05);
        children[1].position.set(0.75, 2.7, -1.05);
      },
    );

    const topBase = new THREE.Group();
    topBase.add(createHorizontalPanel(5.3, true), createHorizontalPanel(0.1, false));
    addPart(
      'top-base-set',
      topBase,
      new THREE.Vector3(-3.0, 0, 1.25),
      new THREE.Vector3(),
      new THREE.Box3(new THREE.Vector3(-2.25, 0, -2.25), new THREE.Vector3(2.25, 5.4, 0.15)),
      (children) => {
        children[0].position.set(-1.15, 2.25, -1.05);
        children[0].rotation.z = Math.PI / 2;
        children[1].position.set(1.15, 2.25, -1.05);
        children[1].rotation.z = -Math.PI / 2;
      },
    );

    const railSet = new THREE.Group();
    for (const y of [1.05, 2.7, 4.35]) {
      railSet.add(createRail(-1.96, y), createRail(1.96, y));
    }
    addPart(
      'rail-set',
      railSet,
      new THREE.Vector3(2.8, 0, 1.7),
      new THREE.Vector3(),
      new THREE.Box3(new THREE.Vector3(-2.08, 0.82, -2.05), new THREE.Vector3(2.08, 4.58, 0)),
      (children) => {
        children.forEach((child, index) => {
          child.position.set(-0.32 + (index % 2) * 0.64, 0.46 + Math.floor(index / 2) * 0.26, -0.1 + (index % 2) * 0.22);
          child.rotation.y = index % 2 ? -Math.PI / 2 : Math.PI / 2;
        });
      },
    );

    const backSet = new THREE.Group();
    const back = new THREE.Group();
    back.position.set(0, 2.7, -2.23);
    box(back, [4.18, 5.02, 0.075], [0, 0, 0], physical(0xb8ad9d, { roughness: 0.82 }), 0.01);
    for (let x = -1.75; x <= 1.75; x += 0.5) {
      for (const y of [-2.28, 2.28]) cylinder(back, 0.021, 0.05, [x, y, 0.055], hardwareMaterial, 'z', 14);
    }
    backSet.add(back);
    addPart(
      'back-panel',
      backSet,
      new THREE.Vector3(2.8, 0, 0.45),
      new THREE.Vector3(),
      new THREE.Box3(new THREE.Vector3(-2.12, 0.12, -2.3), new THREE.Vector3(2.12, 5.25, -2.14)),
    );

    const drawerSources = [
      new THREE.Vector3(-2.75, 0.72, 1.85),
      new THREE.Vector3(2.75, 0.72, 1.85),
      new THREE.Vector3(0, 0.72, 2.75),
    ];
    [1.05, 2.7, 4.35].forEach((y, index) => {
      const id = `drawer-${index + 1}`;
      const { group, target } = createDrawer(id, y);
      addPart(
        id,
        group,
        drawerSources[index],
        target,
        new THREE.Box3(new THREE.Vector3(-2.08, y - 0.72, -2.05), new THREE.Vector3(2.08, y + 0.74, 0.18)),
      );
    });

    const cams = new THREE.Group();
    for (const x of [-1.75, 1.75]) {
      for (const y of [0.3, 5.1]) {
        const cam = cylinder(cams, 0.1, 0.055, [x, y, -0.05], hardwareMaterial, 'z', 28);
        const arrow = box(cam, [0.035, 0.13, 0.025], [0, 0.035, 0.035], darkMaterial, 0.01);
        arrow.position.y = 0.035;
        camDiscs.push(cam);
      }
    }
    cams.visible = false;
    root.add(cams);

    anchorBrackets = new THREE.Group();
    for (const x of [-1.55, 1.55]) {
      box(anchorBrackets, [0.34, 0.08, 0.52], [x, 5.05, -2.27], hardwareMaterial, 0.025);
      box(anchorBrackets, [0.34, 0.52, 0.08], [x, 5.28, -2.49], hardwareMaterial, 0.025);
      cylinder(anchorBrackets, 0.04, 0.09, [x, 5.32, -2.55], darkMaterial, 'z', 20);
    }
    anchorBrackets.visible = false;
    root.add(anchorBrackets);
  }

  function renderKits() {
    ui.kits.innerHTML = data.kits.map((kit) => `
      <button type="button" class="drawer-kit-card${state.kitId === kit.id ? ' is-selected' : ''}" data-drawer-kit="${kit.id}" style="--kit-accent:${kit.colors.accent};--kit-panel:${kit.colors.panel}">
        <i><span></span><span></span><span></span></i>
        <span><small>${kit.difficulty} · ${kit.subtitle}</small><b>${kit.name}</b><em>${kit.finish}</em><strong>참고 ${formatWon(kit.referencePrice)}</strong></span>
      </button>
    `).join('');
    ui.kits.querySelectorAll('[data-drawer-kit]').forEach((button) => {
      button.addEventListener('click', () => selectKit(button.dataset.drawerKit));
    });
  }

  function renderInventory() {
    ui.inventory.innerHTML = data.inventory.map((item) => `
      <button type="button" data-drawer-inventory="${item.code}" class="${state.inventory.has(item.code) ? 'is-checked' : ''}">
        <i>${item.code}</i><span><b>${item.name} <em>${item.count}개</em></b><small>${item.check}</small></span><strong>${state.inventory.has(item.code) ? '✓' : '확인'}</strong>
      </button>
    `).join('');
    ui.inventory.querySelectorAll('[data-drawer-inventory]').forEach((button) => {
      button.addEventListener('click', () => toggleInventory(button.dataset.drawerInventory));
    });
    ui.inventoryCount.textContent = `${state.inventory.size} / ${data.inventory.length} 확인`;
  }

  function selectKit(id) {
    const kit = data.kits.find((item) => item.id === id);
    if (!kit) return;
    state.kitId = id;
    panelMaterial.color.set(kit.colors.panel);
    edgeMaterial.color.set(kit.colors.edge);
    drawerMaterial.color.set(kit.colors.drawer);
    ui.workspace.style.setProperty('--drawer-accent', kit.colors.accent);
    renderKits();
    updateKitReady();
    setFeedback(`${kit.name}을 선택했습니다. 이제 설명서 부품표를 눌러 실제 수량과 방향 단서를 확인하세요.`, 'success');
  }

  function toggleInventory(code) {
    if (state.inventory.has(code)) state.inventory.delete(code);
    else state.inventory.add(code);
    renderInventory();
    updateKitReady();
    const item = data.inventory.find((entry) => entry.code === code);
    setFeedback(`${item.name}: ${item.check}`);
  }

  function updateKitReady() {
    const ready = Boolean(state.kitId) && state.inventory.size === data.inventory.length;
    ui.action.disabled = !ready;
    if (ready) setFeedback('키트와 부품 7종을 모두 확인했습니다. 바닥 보호재 위에서 골조 조립을 시작할 수 있습니다.', 'success');
  }

  function setFeedback(message, tone = 'info') {
    ui.feedback.textContent = message;
    ui.feedback.dataset.tone = tone;
  }

  function currentPartId() {
    if (state.stage === 'frame') {
      if (!state.installed.has('side-set')) return 'side-set';
      if (!state.installed.has('top-base-set')) return 'top-base-set';
    }
    if (state.stage === 'rails' && state.railOrientation && !state.installed.has('rail-set')) return 'rail-set';
    if (state.stage === 'square' && !state.installed.has('back-panel')) return 'back-panel';
    if (state.stage === 'drawers') {
      return ['drawer-1', 'drawer-2', 'drawer-3'].find((id) => !state.installed.has(id)) ?? null;
    }
    return null;
  }

  function refreshTarget() {
    if (targetHelper) {
      root.remove(targetHelper);
      targetHelper.geometry.dispose();
      targetHelper.material.dispose();
      targetHelper = null;
    }
    const id = currentPartId();
    if (!id) return;
    const part = parts.get(id);
    targetHelper = new THREE.Box3Helper(part.targetBox.clone(), 0x75e6c6);
    targetHelper.name = `drawer-target-${id}`;
    targetHelper.material.transparent = true;
    targetHelper.material.opacity = 0.72;
    targetHelper.material.depthTest = false;
    root.add(targetHelper);
  }

  function updateFrameUi() {
    const done = ['side-set', 'top-base-set'].filter((id) => state.installed.has(id)).length;
    ui.frameCount.textContent = `${done} / 2 결합`;
    ui.frameParts.forEach((item) => {
      const installed = state.installed.has(item.dataset.drawerFramePart);
      item.classList.toggle('is-done', installed);
      item.querySelector('em').textContent = installed ? '완료' : '대기';
    });
    ui.frameTask.textContent = done === 0 ? '좌·우 측판 세트를 잡으세요' : done === 1 ? '상판·바닥판 세트를 잡으세요' : '골조 네 면의 결합 완료';
    ui.action.disabled = done < 2;
    if (done === 2) setFeedback('골조 네 면이 바닥에 닿은 상태로 결합되었습니다. 캠락 방향을 확인할 차례입니다.', 'success');
  }

  function updateRailUi() {
    const installed = state.installed.has('rail-set');
    ui.railState.textContent = installed ? '3쌍 장착 완료' : state.railOrientation ? '방향 확인 · 장착 대기' : '방향 판별 전';
    ui.railDrag.classList.toggle('is-locked', !state.railOrientation);
    ui.railDrag.querySelector('b').textContent = installed ? '레일 3쌍이 같은 높이에 장착됨' : state.railOrientation ? '3D 레일 세트를 빛나는 위치로 끌어 놓으세요' : '방향을 먼저 판별하세요';
    ui.railDrag.querySelector('em').textContent = installed ? '완료' : state.railOrientation ? '끌기 가능' : '잠김';
    ui.action.disabled = !installed;
  }

  function updateDrawerUi() {
    const ids = ['drawer-1', 'drawer-2', 'drawer-3'];
    const done = ids.filter((id) => state.installed.has(id)).length;
    ui.drawerCount.textContent = `${done} / 3 장착`;
    ui.drawerSlots.forEach((slot) => {
      const installed = state.installed.has(slot.dataset.drawerSlot);
      slot.classList.toggle('is-done', installed);
      slot.querySelector('em').textContent = installed ? '완료' : '대기';
    });
    const labels = ['아래 서랍', '가운데 서랍', '위 서랍'];
    ui.drawerTask.textContent = done < 3 ? `${labels[done]}을 양쪽 레일에 맞추세요` : '세 서랍의 앞판 틈이 일정합니다';
    ui.action.disabled = done < 3;
    if (done === 3) setFeedback('세 서랍이 모두 레일에 들어갔습니다. 사용하기 전에 전도 방지 계획을 완료하세요.', 'success');
  }

  function configureAction(label, disabled = true) {
    ui.action.innerHTML = `${label} <span>→</span>`;
    ui.action.disabled = disabled;
    ui.action.hidden = false;
  }

  function updatePartVisibility(stage) {
    const stageParts = {
      kit: ['side-set', 'top-base-set', 'rail-set', 'back-panel', 'drawer-1', 'drawer-2', 'drawer-3'],
      frame: ['side-set', 'top-base-set'],
      lock: [],
      rails: ['rail-set'],
      square: ['back-panel'],
      drawers: ['drawer-1', 'drawer-2', 'drawer-3'],
      anchor: [],
      test: [],
    }[stage];
    parts.forEach((part, id) => {
      part.group.visible = state.installed.has(id) || stageParts.includes(id);
    });
    anchorBrackets.visible = ['anchor', 'test'].includes(stage);
  }

  function setStage(stage) {
    state.stage = stage;
    const index = STAGES.indexOf(stage);
    const stageData = data.stages[index];
    ui.route.forEach((item, routeIndex) => {
      item.classList.toggle('is-active', routeIndex === index);
      item.classList.toggle('is-done', routeIndex < index);
    });
    ui.views.forEach((view, id) => { view.hidden = id !== stage; });
    ui.routeProgress.textContent = `${String(index + 1).padStart(2, '0')} / ${String(STAGES.length).padStart(2, '0')}`;
    ui.stepCode.textContent = stageData.code;
    ui.title.innerHTML = STAGE_COPY[stage].title;
    ui.copy.textContent = STAGE_COPY[stage].copy;
    ui.progress.style.transform = `scaleX(${(index + 1) / STAGES.length})`;
    setSessionLabel(`서랍장 조립 · ${index + 1}/8 ${stageData.label}`);
    updatePartVisibility(stage);
    refreshTarget();

    if (stage === 'kit') {
      configureAction('키트·부품 확인 완료', true);
      renderKits();
      renderInventory();
      updateKitReady();
      tweenCamera(new THREE.Vector3(10.5, 7.6, 11.8), new THREE.Vector3(0, 2.35, -0.55), 800);
      setFeedback('키트를 하나 고르고 설명서 부품표 7개를 모두 확인하세요.');
    } else if (stage === 'frame') {
      configureAction('골조 결합 확인', true);
      updateFrameUi();
      tweenCamera(new THREE.Vector3(9.2, 6.8, 9.5), new THREE.Vector3(0, 2.55, -0.8), 720);
      setFeedback('먼저 오른쪽에 세워 둔 좌·우 측판 세트를 클릭한 채 빛나는 골조 위치까지 끌어 놓으세요.');
    } else if (stage === 'lock') {
      configureAction('캠락 체결 확인', !state.camLocked);
      camDiscs[0]?.parent && (camDiscs[0].parent.visible = true);
      tweenCamera(new THREE.Vector3(5.2, 3.6, 4.3), new THREE.Vector3(1.6, 2.8, -0.9), 680);
      setFeedback('캠락의 홈에 표시된 화살표가 어느 쪽을 향해야 하는지 고르세요.');
    } else if (stage === 'rails') {
      configureAction('레일 장착 확인', true);
      updateRailUi();
      tweenCamera(new THREE.Vector3(12.4, 8.4, 12.8), new THREE.Vector3(0, 2.05, -0.2), 680);
      setFeedback('L/R 각인과 레일 앞쪽 표시를 먼저 판별해야 3D 레일 세트를 움직일 수 있습니다.');
    } else if (stage === 'square') {
      configureAction('직각·뒤판 확인', true);
      ui.diagonalChoices.classList.toggle('is-locked', !state.installed.has('back-panel'));
      tweenCamera(new THREE.Vector3(11.5, 8.4, 11.8), new THREE.Vector3(0, 2.25, -0.45), 760);
      setFeedback('왼쪽에 세워 둔 얇은 뒤판을 골조 뒷면의 빛나는 윤곽까지 끌어 놓으세요.');
    } else if (stage === 'drawers') {
      configureAction('서랍 3개 장착 확인', true);
      updateDrawerUi();
      tweenCamera(new THREE.Vector3(12.5, 8.2, 12.6), new THREE.Vector3(0, 2.05, -0.15), 720);
      setFeedback('아래 서랍부터 잡아 양쪽 레일 높이가 맞는 빛나는 칸으로 끌어 놓으세요.');
    } else if (stage === 'anchor') {
      configureAction('전도 방지 계획 완료', true);
      anchorBrackets.visible = true;
      tweenCamera(new THREE.Vector3(7.4, 6.2, 5.2), new THREE.Vector3(0, 4.55, -2.1), 720);
      setFeedback('현장 단서를 보고 서랍장 뒤 벽의 재질을 먼저 고르세요.');
    } else if (stage === 'test') {
      configureAction('조립 결과 완료', true);
      tweenCamera(new THREE.Vector3(7.6, 5.5, 7.1), new THREE.Vector3(0, 2.5, -0.55), 720);
      setFeedback('세 서랍을 한 칸씩 시험하세요. 버튼을 누르면 3D 서랍이 실제로 열리고 닫힙니다.');
    }
  }

  function chooseLock(value) {
    ui.lockChoices.forEach((button) => button.classList.remove('is-selected', 'is-error'));
    const button = ui.lockChoices.find((item) => item.dataset.drawerLock === value);
    if (!button) return;
    if (value !== 'bolt') {
      state.errors += 1;
      button.classList.add('is-error');
      setFeedback(value === 'outside' ? '반대 방향입니다. 화살표는 판재 바깥이 아니라 연결 볼트가 들어오는 구멍을 향해야 합니다.' : '방향을 잡기 전에 돌리면 볼트 머리를 물지 못하고 판재만 손상될 수 있습니다.', 'error');
      return;
    }
    button.classList.add('is-selected');
    state.camLocked = true;
    camDiscs.forEach((cam, index) => { cam.rotation.z = Math.PI * 0.58 + index * 0.03; });
    ui.action.disabled = false;
    setFeedback('화살표가 연결 볼트를 향한 상태에서 약 180° 돌려 캠이 볼트 머리를 잡았습니다.', 'success');
  }

  function chooseRail(value) {
    ui.railChoices.forEach((button) => button.classList.remove('is-selected', 'is-error'));
    const button = ui.railChoices.find((item) => item.dataset.drawerRail === value);
    if (!button) return;
    if (value !== 'markings') {
      state.errors += 1;
      button.classList.add('is-error');
      setFeedback('좌우를 바꾸면 정지턱과 해제 구조가 반대로 놓입니다. L/R 각인을 해당 측판에 맞추세요.', 'error');
      return;
    }
    button.classList.add('is-selected');
    state.railOrientation = true;
    updateRailUi();
    refreshTarget();
    setFeedback('좌우와 전면 방향을 확인했습니다. 오른쪽 바닥의 레일 세트를 3D 골조 안쪽으로 끌어 놓으세요.', 'success');
  }

  function chooseDiagonal(value) {
    if (!state.installed.has('back-panel')) return;
    ui.diagonalButtons.forEach((button) => button.classList.remove('is-selected', 'is-error'));
    const button = ui.diagonalButtons.find((item) => item.dataset.drawerDiagonal === value);
    if (!button) return;
    if (value !== 'equal') {
      state.errors += 1;
      button.classList.add('is-error');
      setFeedback('두 값이 1.4 cm 다르면 골조가 마름모로 비틀린 상태입니다. 모서리를 밀어 두 대각선이 같아질 때까지 다시 맞추세요.', 'error');
      return;
    }
    button.classList.add('is-selected');
    state.diagonalChecked = true;
    ui.squareState.textContent = '대각선 83.4 cm · 직각 확인';
    ui.action.disabled = false;
    setFeedback('두 대각선이 83.4 cm로 같습니다. 직각을 유지한 채 뒤판을 고정해 골조가 비틀리지 않게 했습니다.', 'success');
  }

  function chooseWall(value) {
    ui.wallChoices.forEach((button) => button.classList.remove('is-selected', 'is-error'));
    const button = ui.wallChoices.find((item) => item.dataset.drawerWall === value);
    if (!button) return;
    state.wall = value;
    if (value !== 'concrete') {
      state.errors += 1;
      button.classList.add('is-error');
      ui.anchorPlan.classList.add('is-locked');
      setFeedback(value === 'unknown' ? '벽 재질을 확인할 수 없다면 작업을 멈추고 관리사무소나 전문가에게 확인해야 합니다. 이 현장은 도면상 철근콘크리트입니다.' : '이 현장의 단서는 철근콘크리트입니다. 석고보드용 앵커는 같은 방식으로 선택하면 안 됩니다.', 'error');
      return;
    }
    button.classList.add('is-selected');
    ui.anchorPlan.classList.remove('is-locked');
    setFeedback('철근콘크리트 벽임을 확인했습니다. 이제 이 재질에 맞는 체결 계획을 고르세요.', 'success');
  }

  function chooseAnchor(value) {
    if (state.wall !== 'concrete') return;
    ui.anchorChoices.forEach((button) => button.classList.remove('is-selected', 'is-error'));
    const button = ui.anchorChoices.find((item) => item.dataset.drawerAnchor === value);
    if (!button) return;
    if (value !== 'matched') {
      state.errors += 1;
      button.classList.add('is-error');
      setFeedback(value === 'tape' ? '양면테이프는 전도 하중을 견디는 구조용 고정이 아닙니다.' : '가구에 남은 나사가 콘크리트 벽에 적합하다는 보장은 없습니다. 벽 재질과 하중에 맞는 앵커·나사 규격을 확인하세요.', 'error');
      return;
    }
    button.classList.add('is-selected');
    state.anchorPlan = value;
    ui.action.disabled = false;
    setFeedback('동봉 브래킷 위치를 잡고 콘크리트용 앵커·나사 규격을 제조사 지침에 맞춰 확인했습니다.', 'success');
  }

  function screenPoint(world) {
    const rect = renderer.domElement.getBoundingClientRect();
    const projected = world.clone().project(camera);
    return new THREE.Vector2(
      rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
    );
  }

  function setPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }

  function targetCenter(id) {
    return parts.get(id).targetBox.getCenter(new THREE.Vector3());
  }

  function currentCenter(id) {
    return new THREE.Box3().setFromObject(parts.get(id).group, true).getCenter(new THREE.Vector3());
  }

  function beginDrag(event) {
    if (!state.active || ui.workspace.hidden || state.testing) return;
    const id = currentPartId();
    if (!id) return;
    setPointer(event);
    const part = parts.get(id);
    const hit = raycaster.intersectObject(part.group, true)[0];
    if (!hit) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    controls.enabled = false;
    renderer.domElement.setPointerCapture(event.pointerId);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), hit.point);
    state.dragging = {
      id,
      pointerId: event.pointerId,
      plane,
      grabPoint: hit.point.clone(),
      startPosition: part.group.position.clone(),
      startClient: new THREE.Vector2(event.clientX, event.clientY),
      moved: false,
    };
    ui.dragCoach.hidden = false;
    ui.dragCoach.style.left = `${event.clientX}px`;
    ui.dragCoach.style.top = `${event.clientY}px`;
  }

  function moveDrag(event) {
    const drag = state.dragging;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    setPointer(event);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(drag.plane, point)) return;
    parts.get(drag.id).group.position.copy(drag.startPosition).add(point.sub(drag.grabPoint));
    drag.moved ||= drag.startClient.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5;
    const distance = screenPoint(currentCenter(drag.id)).distanceTo(screenPoint(targetCenter(drag.id)));
    const near = distance < 115;
    ui.dragCoach.style.left = `${event.clientX}px`;
    ui.dragCoach.style.top = `${event.clientY}px`;
    ui.dragDistance.textContent = near ? '장착 가능 · 여기서 놓으세요' : `목표까지 ${Math.round(distance)}픽셀`;
    ui.dragCoach.classList.toggle('is-near', near);
    if (targetHelper) targetHelper.material.color.set(near ? 0xbaff9a : 0x75e6c6);
  }

  function animatePart(part, duration = 520) {
    const start = performance.now();
    const groupStart = part.group.position.clone();
    const childStarts = part.finalChildren.map(({ child }) => ({ child, position: child.position.clone(), quaternion: child.quaternion.clone() }));
    return new Promise((resolve) => {
      const tick = (now) => {
        const linear = Math.min(1, (now - start) / duration);
        const t = 1 - ((1 - linear) ** 3);
        part.group.position.lerpVectors(groupStart, part.target, t);
        part.finalChildren.forEach((final, index) => {
          final.child.position.lerpVectors(childStarts[index].position, final.position, t);
          final.child.quaternion.slerpQuaternions(childStarts[index].quaternion, final.quaternion, t);
        });
        if (linear < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  async function installPart(id) {
    const part = parts.get(id);
    await animatePart(part);
    state.installed.add(id);
    if (id === 'back-panel') {
      ui.diagonalChoices.classList.remove('is-locked');
      ui.squareState.textContent = '뒤판 장착 · 대각선 측정 대기';
      setFeedback('뒤판 네 모서리를 맞췄습니다. 이제 두 대각선 중 직각 상태의 측정값을 고르세요.', 'success');
    } else if (id.startsWith('drawer-')) {
      updateDrawerUi();
      if (!ui.action.disabled) setFeedback('세 서랍을 모두 수평으로 삽입했습니다. 전면 틈도 일정합니다.', 'success');
      else setFeedback(`${id === 'drawer-1' ? '아래' : id === 'drawer-2' ? '가운데' : '위'} 서랍 장착 완료. 다음 칸을 같은 높이로 맞춰 넣으세요.`, 'success');
    } else if (id === 'rail-set') {
      updateRailUi();
      setFeedback('L/R 레일 3쌍이 같은 높이에 장착되었습니다. 나사 머리도 레일 면보다 튀어나오지 않습니다.', 'success');
    } else {
      updateFrameUi();
      if (!ui.action.disabled) setFeedback('측판과 상하판이 모두 빛나는 기준 위치에 결합되었습니다.', 'success');
      else setFeedback('좌·우 측판이 서로 마주 보게 섰습니다. 왼쪽의 상판·바닥판 세트를 이어서 끌어 놓으세요.', 'success');
    }
    refreshTarget();
  }

  async function endDrag(event) {
    const drag = state.dragging;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    state.dragging = null;
    controls.enabled = true;
    ui.dragCoach.hidden = true;
    ui.dragCoach.classList.remove('is-near');
    if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    const part = parts.get(drag.id);
    const distance = screenPoint(currentCenter(drag.id)).distanceTo(screenPoint(targetCenter(drag.id)));
    if (drag.moved && distance < 115) {
      await installPart(drag.id);
      return;
    }
    state.errors += drag.moved ? 1 : 0;
    part.group.position.copy(drag.startPosition);
    if (drag.moved) setFeedback('목표 윤곽까지 충분히 닿지 않았습니다. 부품의 중심을 빛나는 상자 안에 맞춰 다시 놓으세요.', 'error');
  }

  async function testDrawer(id) {
    if (state.testing || state.tests.has(id)) return;
    const group = drawers.get(id);
    const button = ui.testButtons.find((item) => item.dataset.drawerTest === id);
    state.testing = true;
    button.classList.add('is-testing');
    button.querySelector('em').textContent = '작동 중';
    const closed = group.position.clone();
    const opened = closed.clone().add(new THREE.Vector3(0, 0, 1.55));
    const move = (to, duration) => new Promise((resolve) => {
      const from = group.position.clone();
      const start = performance.now();
      const tick = (now) => {
        const linear = Math.min(1, (now - start) / duration);
        const t = linear < 0.5 ? 2 * linear * linear : 1 - ((-2 * linear + 2) ** 2) / 2;
        group.position.lerpVectors(from, to, t);
        if (linear < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    await move(opened, 520);
    await new Promise((resolve) => setTimeout(resolve, 220));
    const kit = data.kits.find((item) => item.id === state.kitId);
    await move(closed, kit?.id === 'oak-softclose' ? 780 : 520);
    state.tests.add(id);
    state.testing = false;
    button.classList.remove('is-testing');
    button.classList.add('is-done');
    button.querySelector('em').textContent = '통과';
    ui.testCount.textContent = `${state.tests.size} / 3 통과`;
    ui.action.disabled = state.tests.size < 3;
    setFeedback(`${button.querySelector('b').textContent}: 걸림 없이 수평으로 움직이고 끝단 스토퍼가 정상 작동했습니다.`, 'success');
  }

  function nextStage() {
    if (ui.action.disabled) return;
    if (state.stage === 'kit') setStage('frame');
    else if (state.stage === 'frame') setStage('lock');
    else if (state.stage === 'lock') setStage('rails');
    else if (state.stage === 'rails') setStage('square');
    else if (state.stage === 'square') setStage('drawers');
    else if (state.stage === 'drawers') setStage('anchor');
    else if (state.stage === 'anchor') setStage('test');
    else if (state.stage === 'test') finishExperience();
  }

  function finishExperience() {
    state.completed = true;
    const kit = data.kits.find((item) => item.id === state.kitId);
    ui.resultKit.textContent = kit.name;
    ui.resultFinish.textContent = kit.finish.replace(' 포일', '');
    ui.resultRail.textContent = kit.subtitle.replace('형 측면', '');
    ui.errorCount.textContent = `${state.errors}회`;
    ui.workspace.hidden = true;
    ui.completion.hidden = false;
    setSessionLabel('서랍장 조립 · 작동·안전 검증 완료');
    tweenCamera(new THREE.Vector3(8.8, 6.1, 8.4), new THREE.Vector3(0, 2.55, -0.65), 820);
  }

  ui.lockChoices.forEach((button) => button.addEventListener('click', () => chooseLock(button.dataset.drawerLock)));
  ui.railChoices.forEach((button) => button.addEventListener('click', () => chooseRail(button.dataset.drawerRail)));
  ui.diagonalButtons.forEach((button) => button.addEventListener('click', () => chooseDiagonal(button.dataset.drawerDiagonal)));
  ui.wallChoices.forEach((button) => button.addEventListener('click', () => chooseWall(button.dataset.drawerWall)));
  ui.anchorChoices.forEach((button) => button.addEventListener('click', () => chooseAnchor(button.dataset.drawerAnchor)));
  ui.testButtons.forEach((button) => button.addEventListener('click', () => testDrawer(button.dataset.drawerTest)));
  ui.action.addEventListener('click', nextStage);
  ui.menu.addEventListener('click', () => window.location.reload());
  ui.restart.addEventListener('click', () => window.location.reload());
  renderer.domElement.addEventListener('pointerdown', beginDrag, true);
  renderer.domElement.addEventListener('pointermove', moveDrag, true);
  renderer.domElement.addEventListener('pointerup', endDrag, true);
  renderer.domElement.addEventListener('pointercancel', endDrag, true);

  function start() {
    state.active = true;
    pcRoot.visible = false;
    globalFloor.visible = false;
    grid.visible = false;
    root.visible = true;
    ui.workspace.hidden = false;
    ui.completion.hidden = true;
    controls.minDistance = 3.2;
    controls.maxDistance = 22;
    controls.maxPolarAngle = Math.PI * 0.88;
    setStage('kit');
  }

  function update(now) {
    if (!state.active) return;
    if (targetHelper) targetHelper.material.opacity = 0.5 + Math.sin(now * 0.005) * 0.28;
  }

  async function qaInstallCurrent() {
    const id = currentPartId();
    if (!id) return false;
    await installPart(id);
    return id;
  }

  buildRoom();
  buildAssembly();

  return {
    start,
    update,
    qa: {
      state() {
        return {
          active: state.active,
          stage: state.stage,
          kitId: state.kitId,
          inventory: [...state.inventory],
          installed: [...state.installed],
          camLocked: state.camLocked,
          railOrientation: state.railOrientation,
          diagonalChecked: state.diagonalChecked,
          wall: state.wall,
          anchorPlan: state.anchorPlan,
          tests: [...state.tests],
          errors: state.errors,
          completed: state.completed,
        };
      },
      selectKit,
      checkInventory() { data.inventory.forEach((item) => state.inventory.add(item.code)); renderInventory(); updateKitReady(); },
      next: nextStage,
      installCurrent: qaInstallCurrent,
      chooseLock,
      chooseRail,
      chooseDiagonal,
      chooseWall,
      chooseAnchor,
      testDrawer,
      currentPartId,
      targetState() { return { id: currentPartId(), visible: Boolean(targetHelper?.visible) }; },
      dragPoints() {
        const id = currentPartId();
        if (!id) return null;
        const part = parts.get(id);
        const candidates = [];
        part.group.traverseVisible((object) => {
          if (!object.isMesh) return;
          const world = new THREE.Box3().setFromObject(object, true).getCenter(new THREE.Vector3());
          candidates.push({ world, screen: screenPoint(world) });
        });
        const left = ui.workspace.querySelector('.drawer-route-panel').getBoundingClientRect().right + 18;
        const right = ui.workspace.querySelector('.drawer-guide-panel').getBoundingClientRect().left - 18;
        const pick = candidates.filter(({ screen }) => (
          screen.x >= left && screen.x <= right && screen.y >= 96 && screen.y <= window.innerHeight - 36
        )).sort((a, b) => Math.abs(a.screen.x - (left + right) / 2) - Math.abs(b.screen.x - (left + right) / 2))[0] ?? candidates[0];
        const pickWorld = pick?.world ?? currentCenter(id);
        const delta = targetCenter(id).sub(currentCenter(id));
        const from = screenPoint(pickWorld);
        const to = screenPoint(pickWorld.clone().add(delta));
        return { id, from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } };
      },
    },
  };
}
