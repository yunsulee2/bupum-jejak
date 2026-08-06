import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const script = await readFile(path.join(root, 'src/main.js'), 'utf8');
const bulbScript = await readFile(path.join(root, 'src/bulb-module.js'), 'utf8');
const style = await readFile(path.join(root, 'src/style.css'), 'utf8');
const data = JSON.parse(await readFile(path.join(root, 'public/data/desktop-atx.json'), 'utf8'));
const catalog = JSON.parse(await readFile(path.join(root, 'public/data/store-catalog.json'), 'utf8'));
const bulbData = JSON.parse(await readFile(path.join(root, 'public/data/bulb-lab.json'), 'utf8'));

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

test('the lobby offers computer assembly and bulb replacement as distinct modules', () => {
  assert.match(html, /id="start-button"/);
  assert.match(html, /게이밍 컴퓨터 조립/);
  assert.match(html, /id="bulb-start-button"/);
  assert.match(html, /전구 교체 진단/);
  assert.match(script, /function startBulbExperience/);
  assert.match(script, /createBulbModule/);
  assert.match(style, /\.module-card--bulb/);
});

test('bulb diagnosis teaches inspection, compatibility, safety, rotation and testing', () => {
  assert.equal(bulbData.clues.length, 4);
  assert.equal(bulbData.products.length, 6);
  assert.deepEqual(Object.keys(bulbData.scenario.required), [
    'base', 'lumens', 'cct', 'dimmable', 'shape', 'maxDiameterMm', 'voltage',
  ]);
  assert.match(html, /현장 관찰/);
  assert.match(html, /규격 비교·구매/);
  assert.match(html, /안전 준비/);
  assert.match(html, /반시계 방향 회전/);
  assert.match(html, /점등 검증/);
  assert.match(bulbScript, /function compatibility/);
  assert.match(bulbScript, /function wrongProductFeedback/);
  assert.match(bulbScript, /function addTurnDelta/);
  assert.match(bulbScript, /function powerOn/);
  assert.match(html, /소켓·배선 수리는 전기 전문가/);
  assert.match(style, /\.bulb-turn-dial/);
});

test('only one bulb candidate matches every discovered field condition', () => {
  const required = bulbData.scenario.required;
  const compatible = bulbData.products.filter((product) => (
    product.base === required.base
    && product.lumens === required.lumens
    && product.cct === required.cct
    && product.dimmable === required.dimmable
    && product.shape === required.shape
    && product.diameterMm <= required.maxDiameterMm
  ));
  assert.equal(compatible.length, 1);
  assert.equal(compatible[0].id, 'solhetta-e26-806-warm-dim');
  assert.ok(bulbData.products.every((product) => product.price > 0 && product.source.startsWith('https://')));
  assert.ok(bulbData.scenario.stopConditions.length >= 3);
});
