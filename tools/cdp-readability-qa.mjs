import { mkdir, writeFile } from 'node:fs/promises';

const port = process.env.CDP_PORT ?? '9240';
const endpoint = `http://127.0.0.1:${port}`;
const target = await fetch(`${endpoint}/json/new?http://127.0.0.1:5173/`, { method: 'PUT' }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const errors = [];
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
  if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  }
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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}

async function screenshot(name) {
  const { data } = await command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(`/Users/yunsu/pc-build-lab/qa/${name}`, Buffer.from(data, 'base64'));
}

async function navigate(width, height, mobile = false) {
  await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await command('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(`document.querySelector('#loading-screen')?.hidden && !document.querySelector('#start-button')?.disabled`)) return;
    await wait(160);
  }
  throw new Error('The module lobby did not become ready.');
}

await mkdir('/Users/yunsu/pc-build-lab/qa', { recursive: true });
await command('Page.enable');
await command('Runtime.enable');
await command('Log.enable');
await command('Page.bringToFront');
await command('Emulation.setFocusEmulationEnabled', { enabled: true });

const report = {};

await navigate(1440, 900);
report.desktopLobby = await evaluate(`(() => {
  const size = (selector) => Number.parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
  return {
    moduleLabel: size('.module-card-copy small'),
    moduleTitle: size('.module-card-copy b'),
    moduleDescription: size('.module-card-copy em'),
    topStatus: size('.session-meta'),
  };
})()`);
await screenshot('readability-lobby-desktop.png');

await evaluate(`document.querySelector('#shower-start-button').click()`);
await wait(550);
report.desktopShower = await evaluate(`(() => {
  const route = document.querySelector('.shower-route');
  const view = document.querySelector('.shower-view:not([hidden])');
  const guide = document.querySelector('.shower-guide-panel');
  const size = (selector) => Number.parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
  return {
    routeTitle: size('.shower-route b'),
    guideBody: size('.shower-guide-heading > p:last-child'),
    clueTitle: size('.shower-clue b'),
    action: size('.shower-action'),
    routeScrollsWhenNeeded: getComputedStyle(route).overflowY === 'auto',
    detailScrollsWhenNeeded: getComputedStyle(view).overflowY === 'auto',
    guideWidth: Math.round(guide.getBoundingClientRect().width),
    viewportWidth: innerWidth,
  };
})()`);
await screenshot('readability-shower-desktop.png');

await navigate(1440, 900);
await evaluate(`document.querySelector('#start-button').click()`);
await wait(700);
report.desktopShop = await evaluate(`(() => {
  const stage = document.querySelector('.shop-stage');
  const options = document.querySelector('.shop-options');
  return {
    visible: !document.querySelector('#shop').hidden,
    stageBody: Number.parseFloat(getComputedStyle(document.querySelector('.shop-stage-heading > p:last-child')).fontSize),
    productBody: Number.parseFloat(getComputedStyle(document.querySelector('.product-copy > p')).fontSize),
    optionsScrollWhenNeeded: getComputedStyle(options).overflowY === 'auto',
    stageWidth: Math.round(stage.getBoundingClientRect().width),
  };
})()`);
await screenshot('readability-shop-desktop.png');

await evaluate(`document.querySelector('#purchase-button').click()`);
await wait(1100);
report.desktopAssembly = await evaluate(`(() => {
  const panel = document.querySelector('.guide-panel');
  const inventory = document.querySelector('.inventory-panel');
  return {
    visible: !document.querySelector('#workspace').hidden,
    guideScrolls: panel.scrollHeight > panel.clientHeight,
    guideOverflow: getComputedStyle(panel).overflowY,
    guideWidth: Math.round(panel.getBoundingClientRect().width),
    inventoryWidth: Math.round(inventory.getBoundingClientRect().width),
    viewportWidth: innerWidth,
    bodyText: Number.parseFloat(getComputedStyle(document.querySelector('.step-copy')).fontSize),
    partTitle: Number.parseFloat(getComputedStyle(document.querySelector('.part-copy b')).fontSize),
  };
})()`);
await screenshot('readability-assembly-desktop.png');

await navigate(375, 812, true);
report.mobileLobby = await evaluate(`(() => {
  const picker = document.querySelector('.module-picker');
  const intro = document.querySelector('.intro');
  return {
    columns: getComputedStyle(picker).gridTemplateColumns.split(' ').length,
    lobbyScrollsWhenNeeded: getComputedStyle(intro).overflowY === 'auto',
    cardTitle: Number.parseFloat(getComputedStyle(document.querySelector('.module-card-copy b')).fontSize),
    cardDescription: Number.parseFloat(getComputedStyle(document.querySelector('.module-card-copy em')).fontSize),
  };
})()`);
await screenshot('readability-lobby-mobile.png');

await evaluate(`document.querySelector('#start-button').click()`);
await wait(700);
report.mobileShop = await evaluate(`({
  visible: !document.querySelector('#shop').hidden,
  bodyText: Number.parseFloat(getComputedStyle(document.querySelector('.shop-stage-heading > p:last-child')).fontSize),
  productText: Number.parseFloat(getComputedStyle(document.querySelector('.product-copy > p')).fontSize),
  pageScrollsWhenNeeded: getComputedStyle(document.querySelector('#shop')).overflowY === 'auto',
})`);
await screenshot('readability-shop-mobile.png');

await evaluate(`document.querySelector('#purchase-button').click()`);
await wait(1100);
report.mobileAssembly = await evaluate(`(() => {
  const panel = document.querySelector('.guide-panel');
  const copy = document.querySelector('.step-copy');
  return {
    visible: !document.querySelector('#workspace').hidden,
    guideScrolls: panel.scrollHeight > panel.clientHeight,
    guideOverflow: getComputedStyle(panel).overflowY,
    guideHeight: Math.round(panel.getBoundingClientRect().height),
    viewportHeight: innerHeight,
    bodyText: Number.parseFloat(getComputedStyle(copy).fontSize),
    bodyVisible: getComputedStyle(copy).display !== 'none',
    inventoryHeight: Math.round(document.querySelector('.inventory-panel').getBoundingClientRect().height),
  };
})()`);
await screenshot('readability-assembly-mobile.png');

report.errors = errors;
await writeFile('/tmp/pc-build-lab-readability-qa.json', JSON.stringify(report, null, 2));
socket.close();
await fetch(`${endpoint}/json/close/${target.id}`);

if (report.desktopLobby.moduleLabel < 9 || report.desktopLobby.moduleDescription < 10) process.exitCode = 1;
if (report.desktopShower.guideBody < 12 || !report.desktopShower.routeScrollsWhenNeeded || !report.desktopShower.detailScrollsWhenNeeded) process.exitCode = 1;
if (report.desktopShower.guideWidth / report.desktopShower.viewportWidth > 0.36) process.exitCode = 1;
if (!report.desktopShop.visible || report.desktopShop.stageBody < 12 || report.desktopShop.productBody < 11 || !report.desktopShop.optionsScrollWhenNeeded) process.exitCode = 1;
if (!report.desktopAssembly.visible || !report.desktopAssembly.guideScrolls || report.desktopAssembly.guideOverflow !== 'auto') process.exitCode = 1;
if (report.desktopAssembly.bodyText < 12 || report.desktopAssembly.partTitle < 11) process.exitCode = 1;
if ((report.desktopAssembly.guideWidth + report.desktopAssembly.inventoryWidth) / report.desktopAssembly.viewportWidth > 0.52) process.exitCode = 1;
if (report.mobileLobby.columns !== 1 || !report.mobileLobby.lobbyScrollsWhenNeeded) process.exitCode = 1;
if (!report.mobileShop.visible || report.mobileShop.bodyText < 12 || report.mobileShop.productText < 11) process.exitCode = 1;
if (!report.mobileAssembly.visible || !report.mobileAssembly.guideScrolls || report.mobileAssembly.guideOverflow !== 'auto') process.exitCode = 1;
if (!report.mobileAssembly.bodyVisible || report.mobileAssembly.bodyText < 11 || errors.length) process.exitCode = 1;
