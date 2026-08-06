import { writeFile } from 'node:fs/promises';

const port = process.env.CDP_PORT ?? '9223';
const endpoint = `http://127.0.0.1:${port}`;
const target = await fetch(`${endpoint}/json/new?http://127.0.0.1:5173/`, { method: 'PUT' }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const errors = [];
const steps = [];
let shop = null;
let nextId = 1;

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
});

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
    throw new Error(detail);
  }
  return result.result.value;
}

async function screenshot(path) {
  const { data } = await command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(path, Buffer.from(data, 'base64'));
}

async function drag(from, to) {
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', buttons: 1, clickCount: 1 });
  const pressedState = await evaluate(`window.__BUILD_LAB_QA__.dragState()`);
  for (let index = 1; index <= 18; index += 1) {
    const progress = index / 18;
    await command('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
      button: 'left',
      buttons: 1,
    });
    await wait(16);
  }
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', buttons: 0, clickCount: 1 });
  return pressedState;
}

await command('Page.enable');
await command('Runtime.enable');
await command('Log.enable');
await command('Page.bringToFront');
await command('Emulation.setFocusEmulationEnabled', { enabled: true });
await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await command('Page.navigate', { url: 'http://127.0.0.1:5173/' });

for (let attempt = 0; attempt < 50; attempt += 1) {
  if (await evaluate(`document.querySelector('#loading-screen').hidden && !document.querySelector('#start-button').disabled`)) break;
  await wait(400);
}

const intro = await evaluate(`({
  mode: document.querySelector('#app').dataset.mode,
  title: document.querySelector('#title').textContent.trim(),
  koreanBrand: document.querySelector('.brand b').textContent.trim()
})`);
await screenshot('/Users/yunsu/pc-build-lab/qa/intro-neural4d.png');

await evaluate(`document.querySelector('#start-button').click()`);
await wait(800);
shop = await evaluate(`({
  visible: !document.querySelector('#shop').hidden,
  optionCount: document.querySelectorAll('.shop-option').length,
  categoryCount: document.querySelectorAll('.shop-category').length,
  cartCount: document.querySelector('#cart-count').textContent,
  totalText: document.querySelector('#cart-total').textContent,
  state: window.__BUILD_LAB_QA__.shoppingState()
})`);
await screenshot('/Users/yunsu/pc-build-lab/qa/shop-real-products.png');

for (const categoryIndex of [0, 1, 2]) {
  await evaluate(`document.querySelector('[data-shop-category="${categoryIndex}"]').click()`);
  await wait(80);
  await evaluate(`document.querySelectorAll('[data-shop-option]')[1].click()`);
  await wait(80);
}
shop.afterChoices = await evaluate(`window.__BUILD_LAB_QA__.shoppingState()`);
await evaluate(`document.querySelector('[data-shop-category="10"]').click()`);
await wait(500);
shop.gpuOptions = await evaluate(`({
  count: document.querySelectorAll('.shop-option').length,
  names: [...document.querySelectorAll('.shop-option .product-copy strong')].map((node) => node.textContent.trim()),
  localImages: [...document.querySelectorAll('.shop-option img')].every((image) => new URL(image.src).origin === location.origin)
})`);
await screenshot('/Users/yunsu/pc-build-lab/qa/shop-famous-gpus.png');
for (let attempt = 0; attempt < 100; attempt += 1) {
  if (await evaluate(`!document.querySelector('#purchase-button').disabled`)) break;
  await wait(120);
}
shop.modelStatus = await evaluate(`({
  ready: !document.querySelector('#purchase-button').disabled,
  label: document.querySelector('#pc-model-status').textContent.trim()
})`);
await evaluate(`document.querySelector('#purchase-button').click()`);
for (let attempt = 0; attempt < 60; attempt += 1) {
  if (await evaluate(`!document.querySelector('#workspace').hidden`)) break;
  await wait(100);
}
const fanBefore = await evaluate(`window.__BUILD_LAB_QA__.fanMotionState()`);
await wait(450);
const fanAfter = await evaluate(`window.__BUILD_LAB_QA__.fanMotionState()`);
shop.assemblyFansMoved = fanBefore.some((value, index) => Math.abs(value - fanAfter[index]) > 0.0001);
shop.caseGlass = await evaluate(`window.__BUILD_LAB_QA__.caseGlassState()`);
await screenshot('/Users/yunsu/pc-build-lab/qa/assembly-purchased-products.png');

for (let index = 0; index < 14; index += 1) {
  const before = await evaluate(`({
    number: document.querySelector('#step-current').textContent,
    title: document.querySelector('#step-title').textContent.trim(),
    variants: document.querySelectorAll('.variant-card').length,
    purchasedVariant: document.querySelector('.variant-card.is-selected b')?.textContent.trim()
  })`);
  if (index === 0) await screenshot('/Users/yunsu/pc-build-lab/qa/drag-guide-korean.png');
  if (index === 6) await screenshot('/Users/yunsu/pc-build-lab/qa/pc-assembly-position-after.png');
  if (index === 12) await screenshot('/Users/yunsu/pc-build-lab/qa/neural4d-case-assembly.png');
  if (index === 13) await screenshot('/Users/yunsu/pc-build-lab/qa/cable-position-before.png');
  const points = await evaluate(`window.__BUILD_LAB_QA__.dragPoints()`);
  const debug = index === 13 ? await evaluate(`window.__BUILD_LAB_QA__.partDebug('cables')`) : null;
  const pickDebug = await evaluate(`window.__BUILD_LAB_QA__.pickDebug(${points.from.x}, ${points.from.y})`);
  const pressedState = await drag(points.from, points.to);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const progressed = await evaluate(`document.querySelector('#app').dataset.mode === 'complete' || document.querySelector('#step-current').textContent !== '${before.number}'`);
    if (progressed) break;
    await wait(100);
  }
  const after = await evaluate(`({
    number: document.querySelector('#step-current').textContent,
    mode: document.querySelector('#app').dataset.mode,
    count: document.querySelector('#part-count').textContent,
    toast: document.querySelector('#toast').textContent
  })`);
  steps.push({ before, points, debug, pickDebug, pressedState, after });
  if (after.mode !== 'complete' && after.number === before.number) break;
  await wait(760);
}

await wait(1700);
const completion = await evaluate(`({
  mode: document.querySelector('#app').dataset.mode,
  completionVisible: !document.querySelector('#completion').hidden,
  score: document.querySelector('#score-value').textContent,
  errors: document.querySelector('#error-value').textContent,
  total: document.querySelector('#completion-total').textContent,
  power: window.__BUILD_LAB_QA__.powerState(),
  room: window.__BUILD_LAB_QA__.roomState()
})`);
await screenshot('/Users/yunsu/pc-build-lab/qa/final-neural4d-room.png');

completion.cameraBefore = await evaluate(`window.__BUILD_LAB_QA__.cameraState()`);
await drag({ x: 320, y: 470 }, { x: 510, y: 545 });
await wait(600);
completion.cameraAfter = await evaluate(`window.__BUILD_LAB_QA__.cameraState()`);
completion.cameraMoved = completion.cameraBefore.position.some((value, index) => Math.abs(value - completion.cameraAfter.position[index]) > 0.02);
await screenshot('/Users/yunsu/pc-build-lab/qa/final-camera-orbit.png');

const cableDebug = steps.find((step) => step.debug)?.debug;
const cableCompact = Boolean(cableDebug && Math.max(...cableDebug.currentSize) < 1.8);

const report = { intro, shop, steps, completion, cableCompact, errors };
await writeFile('/tmp/pc-build-lab-drag-qa.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
socket.close();
await fetch(`${endpoint}/json/close/${target.id}`).catch(() => null);
await wait(100);
process.exit(errors.length || !completion.completionVisible || !completion.cameraMoved || !cableCompact || shop.gpuOptions.count !== 6 || !shop.gpuOptions.localImages || !shop.assemblyFansMoved || shop.caseGlass.count !== 2 || !shop.caseGlass.transparent ? 1 : 0);
