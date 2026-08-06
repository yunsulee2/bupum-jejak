import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const script = await readFile(path.join(root, 'src/main.js'), 'utf8');
const fluorescentScript = await readFile(path.join(root, 'src/fluorescent-module.js'), 'utf8');
const showerScript = await readFile(path.join(root, 'src/shower-filter-module.js'), 'utf8');
const style = await readFile(path.join(root, 'src/style.css'), 'utf8');
const data = JSON.parse(await readFile(path.join(root, 'public/data/desktop-atx.json'), 'utf8'));
const catalog = JSON.parse(await readFile(path.join(root, 'public/data/store-catalog.json'), 'utf8'));
const fluorescentData = JSON.parse(await readFile(path.join(root, 'public/data/fluorescent-lab.json'), 'utf8'));
const showerData = JSON.parse(await readFile(path.join(root, 'public/data/shower-filter-lab.json'), 'utf8'));

test('gaming room module has a complete fourteen-step guided assembly', () => {
  assert.equal(data.parts.length, 14);
  assert.equal(data.steps.length, 14);
  assert.deepEqual(data.steps.map((step) => step.partId), [
    'desk-frame', 'desk-top', 'chair-base', 'chair-body', 'monitor-stand', 'monitor-panel',
    'cpu', 'ssd', 'ram', 'cooler', 'psu', 'motherboard', 'gpu', 'cables',
  ]);
  assert.ok(data.parts.every((part) => part.nodeNames.length > 0));
  assert.equal(data.parts.find((part) => part.id === 'gpu').variants.length, 6);
  assert.ok(data.parts.filter((part) => part.id !== 'gpu').every((part) => part.variants.length === 2));
  assert.ok(data.steps.every((step) => step.guide && step.dropTolerance > 0));
});

test('the interface exposes real-product shopping, direct dragging, guidance and completion states', () => {
  assert.equal(catalog.categories.length, 4);
  assert.ok(catalog.categories.every((category) => category.options.length === 2));
  assert.ok(catalog.categories.flatMap((category) => category.options).every((option) => option.price > 0 && option.source && option.image));
  assert.ok(data.parts.filter((part) => !part.purchaseKey).flatMap((part) => part.variants).every((option) => option.image));
  assert.match(html, /id="shop"/);
  assert.match(html, /id="cart-total"/);
  assert.match(html, /id="purchase-button"/);
  assert.match(html, /id="part-list"/);
  assert.match(html, /id="variant-list"/);
  assert.match(html, /id="drag-status"/);
  assert.match(html, /구매 확인/);
  assert.match(html, /위치에 놓기/);
  assert.match(html, /id="explode-button"/);
  assert.match(html, /전원 인가 자체 검사/);
  assert.match(script, /function selectPart/);
  assert.match(script, /function beginPartDrag/);
  assert.match(script, /function movePartDrag/);
  assert.match(script, /async function completeDraggedInstall/);
  assert.match(script, /function initializeGamingEffects/);
  assert.match(script, /function animateGamingEffects/);
  assert.match(script, /assemblyStartedAt/);
  assert.match(script, /function configureCaseGlass/);
  assert.match(script, /function buildFurnitureScene/);
  assert.match(script, /function buildRoomScene/);
  assert.match(script, /function applyPurchasedAppearances/);
  assert.match(script, /async function beginAssembly/);
  assert.match(html, /팬 9개 회전 · RGB 조명 동기화/);
  assert.match(script, /function toggleExploded/);
  assert.match(script, /function finishAssembly/);
  assert.match(style, /\.completion-panel/);
  assert.match(style, /\.completion[^{]*\{[^}]*pointer-events:\s*none/s);
  assert.match(style, /\.completion-panel[^{]*\{[^}]*pointer-events:\s*auto/s);
  assert.match(html, /우클릭 끌기/);
  assert.match(script, /function setCableVisualMode/);
  assert.match(script, /function expandByVisibleMeshes/);
  assert.match(script, /function placeCableBundleOnTray/);
});

test('all twenty-eight purchase choices use local real-product images', async () => {
  const productChoices = [
    ...catalog.categories.flatMap((category) => category.options),
    ...data.parts.filter((part) => !part.purchaseKey).flatMap((part) => part.variants),
  ];
  assert.equal(productChoices.length, 28);
  await Promise.all(productChoices.map(async (option) => {
    const image = await stat(path.join(root, 'public', option.image));
    assert.ok(image.size > 20_000, `${option.name} image should be a real local asset`);
  }));
});

test('generated Blender and glTF assets contain production-scale detail', async () => {
  const glb = await stat(path.join(root, 'public/models/pc-lab.glb'));
  const blend = await stat(path.join(root, 'assets/pc-lab-source.blend'));
  const neuralSource = await stat(path.join(root, 'assets/neural4d/atx-case-source.glb'));
  const assetBuilder = await readFile(path.join(root, 'tools/build_pc_scene.py'), 'utf8');
  assert.ok(glb.size > 8_000_000, `expected Neural4D-enhanced GLB, got ${glb.size} bytes`);
  assert.ok(blend.size > 5_000_000, `expected editable Blender source with packed PBR maps, got ${blend.size} bytes`);
  assert.ok(neuralSource.size > 20_000_000, `expected preserved full-quality Neural4D source, got ${neuralSource.size} bytes`);
  assert.match(assetBuilder, /integrate_neural4d_case\(case\)/);
  assert.match(assetBuilder, /cable_loose_bundle/);
  assert.match(assetBuilder, /cable_installed_routes/);
  assert.match(assetBuilder, /case_glass_panel_side/);
  assert.match(assetBuilder, /case_glass_panel_front/);
  assert.match(assetBuilder, /MSI MAG B850 TOMAHAWK MAX WIFI/);
  assert.match(assetBuilder, /ASUS DUAL GeForce RTX 4070 OC/);
  assert.match(assetBuilder, /Kingston FURY Beast RGB DDR5/);
  assert.match(assetBuilder, /Thermalright Peerless Assassin 120 SE ARGB/);
  assert.match(assetBuilder, /CORSAIR RM850e ATX 3\.1/);
  assert.match(assetBuilder, /gpu_heatsink_fin_/);
  assert.match(assetBuilder, /m2_shield_/);
  assert.match(script, /setCaseShellMode/);
});

test('Unreal project and import bridge are provided', async () => {
  const project = await readFile(path.join(root, 'unreal/BuildLab/BuildLab.uproject'), 'utf8');
  const importer = await readFile(path.join(root, 'unreal/BuildLab/Scripts/import_build_lab.py'), 'utf8');
  assert.match(project, /"Name": "BuildLab"/);
  assert.match(importer, /pc-lab\.glb/);
});

test('the lobby offers computer, fluorescent and shower filter modules', () => {
  assert.match(html, /id="start-button"/);
  assert.match(html, /게이밍 컴퓨터 조립/);
  assert.match(html, /id="fluorescent-start-button"/);
  assert.match(html, /형광등 교체 진단/);
  assert.match(script, /function startFluorescentExperience/);
  assert.match(script, /createFluorescentModule/);
  assert.match(style, /\.module-card--fluorescent/);
  assert.match(html, /id="shower-start-button"/);
  assert.match(html, /샤워기 필터 교체/);
  assert.match(script, /function startShowerFilterExperience/);
  assert.match(script, /createShowerFilterModule/);
  assert.match(style, /\.module-card--shower/);
});

test('the main menu represents multiple home assembly tasks instead of only a PC', async () => {
  const hero = await stat(path.join(root, 'public/images/home-diy-hero-v1.jpg'));
  assert.ok(hero.size > 300_000, `expected a detailed home DIY hero image, got ${hero.size} bytes`);
  assert.match(html, /rel="preload" as="image" href="\/images\/home-diy-hero-v1\.jpg"/);
  assert.match(style, /url\('\/images\/home-diy-hero-v1\.jpg'\) center center \/ cover no-repeat/);
  assert.match(style, /\.intro::after \{[^}]*linear-gradient/s);
  assert.match(style, /\.intro::before \{ background-position: 82% center;/);
});

test('fluorescent diagnosis teaches inspection, ballast compatibility, 90-degree replacement and disposal', () => {
  assert.equal(fluorescentData.clues.length, 5);
  assert.equal(fluorescentData.products.length, 6);
  assert.deepEqual(Object.keys(fluorescentData.scenario.required), [
    'lampCode', 'technology', 'form', 'base', 'watts', 'lengthMm', 'diameterMm', 'cct', 'lumens', 'ballast',
  ]);
  assert.match(html, /기구·램프 확인/);
  assert.match(html, /규격 비교·구매/);
  assert.match(html, /안전 준비/);
  assert.match(html, /90° 회전/);
  assert.match(html, /점등 검증/);
  assert.match(html, /폐램프 배출/);
  assert.match(fluorescentScript, /function compatibility/);
  assert.match(fluorescentScript, /function wrongProductFeedback/);
  assert.match(fluorescentScript, /function addTurnDelta/);
  assert.match(fluorescentScript, /function powerOn/);
  assert.match(fluorescentScript, /function attemptDisposal/);
  assert.match(html, /소켓·안정기·배선 수리는 전기 전문가/);
  assert.match(html, /폐형광등 전용 수거함/);
  assert.match(style, /\.fluorescent-turn-dial/);
  assert.match(style, /\.fluorescent-disposal-options/);
});

test('two real fluorescent brands match while similar lengths and pins can still be incompatible', () => {
  const required = fluorescentData.scenario.required;
  const compatible = fluorescentData.products.filter((product) => (
    product.technology === required.technology
    && product.form === required.form
    && product.base === required.base
    && product.watts === required.watts
    && Math.abs(product.lengthMm - required.lengthMm) <= 5
    && product.cct === required.cct
    && product.ballast === required.ballast
  ));
  assert.deepEqual(compatible.map((product) => product.id), ['kumho-fhf32-daylight', 'philips-tld32-daylight']);
  assert.ok(fluorescentData.products.some((product) => product.technology === 'led' && product.base === 'G13'));
  assert.ok(fluorescentData.products.every((product) => product.price > 0 && product.source.startsWith('https://')));
  assert.ok(fluorescentData.scenario.stopConditions.length >= 3);
  assert.equal(fluorescentData.disposalOptions.filter((option) => option.correct).length, 1);
});

test('shower filter training covers diagnosis, purchase, direct placement, sealing and leak testing', () => {
  assert.equal(showerData.clues.length, 5);
  assert.equal(showerData.products.length, 6);
  assert.deepEqual(Object.keys(showerData.scenario.required), [
    'kind', 'brand', 'family', 'generation', 'position', 'form',
  ]);
  assert.match(html, /본체·오염 확인/);
  assert.match(html, /전용 리필 구매/);
  assert.match(html, /하단 캡 분리/);
  assert.match(html, /직접 끌어 수직 삽입/);
  assert.match(html, /O링·캡 밀폐/);
  assert.match(html, /흘려보내기·검증/);
  assert.match(showerScript, /function compatibility/);
  assert.match(showerScript, /function wrongProductFeedback/);
  assert.match(showerScript, /function installFilter/);
  assert.match(showerScript, /function seatORing/);
  assert.match(showerScript, /function finishFlush/);
  assert.match(showerScript, /SHOWER_FILTER_REPLACEMENT_LAB/);
  assert.match(style, /\.shower-drag-stage/);
  assert.match(style, /\.shower-oring-button/);
  assert.match(style, /\.shower-flush-button/);
});

test('only the two genuine standard refill packs fit the selected shower body', async () => {
  const required = showerData.scenario.required;
  const compatible = showerData.products.filter((product) => (
    product.kind === required.kind
    && product.brand === required.brand
    && product.family === required.family
    && product.generation === required.generation
    && product.position === required.position
    && product.form === required.form
  ));
  assert.deepEqual(compatible.map((product) => product.id), [
    'atojet-pure-filter-1pack', 'atojet-pure-filter-3pack',
  ]);
  assert.ok(showerData.products.some((product) => product.family === 'SIGNATURE'));
  assert.ok(showerData.products.some((product) => product.family === 'TRAVEL_MINI'));
  assert.ok(showerData.products.some((product) => product.brand === 'BODYLUV'));
  assert.ok(showerData.products.every((product) => product.price > 0 && product.source.startsWith('https://')));
  assert.ok(showerData.scenario.stopConditions.length >= 3);
  await Promise.all(showerData.products.map(async (product) => {
    const image = await stat(path.join(root, 'public', product.image));
    assert.ok(image.size > 20_000, `${product.name} should use a real local product image`);
  }));
});

test('readability keeps the 3D workspace dominant while detail panels scroll', () => {
  assert.match(style, /Readability pass: larger type, stable 3D canvas, scrollable detail panels/);
  assert.match(style, /\.module-card-copy b \{ font-size: 17px; \}/);
  assert.match(style, /\.fluorescent-guide-heading > p:last-child \{ font-size: 12px; line-height: 1\.65; \}/);
  assert.match(style, /\.fluorescent-view \{[^}]*flex: 1 1 auto;[^}]*overflow-y: auto;/s);
  assert.match(style, /\.fluorescent-route small \{ display: none;/);
  assert.match(style, /\.fluorescent-route > div\.is-active small \{ display: block; \}/);
  assert.match(style, /\.step-copy \{ min-height: 0; font-size: 12px; line-height: 1\.65; \}/);
  assert.match(style, /\.guide-panel \{ overscroll-behavior: contain; \}/);
  assert.match(style, /max-height: 42svh;[^}]*overflow-y: auto;/s);
  assert.match(style, /\.inventory-panel, \.guide-panel, \.tool-dock \{ z-index: 2;/);
});
