import { writeFile } from 'node:fs/promises';

const port = process.env.CDP_PORT ?? '9223';
const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:4173/';
const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(appUrl)}`, { method: 'PUT' })
  .then((response) => response.json());
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
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
});

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function waitFor(expression, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await evaluate(expression)) return;
    await wait(100);
  }
  throw new Error(`대기 시간 초과: ${expression}`);
}

await command('Page.enable');
await command('Runtime.enable');
await command('Log.enable');
await command('Network.enable');
await command('Network.clearBrowserCache');
await command('Network.setCacheDisabled', { cacheDisabled: true });
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await command('Page.navigate', { url: appUrl });
await waitFor(`document.readyState === 'complete' && document.querySelector('#loading-screen').hidden`);

const lobby = await evaluate(`(() => {
  const navigation = performance.getEntriesByType('navigation')[0];
  const paints = Object.fromEntries(performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime]));
  const resources = performance.getEntriesByType('resource').map((entry) => ({
    name: entry.name,
    type: entry.initiatorType,
    transferSize: entry.transferSize,
    duration: entry.duration,
  }));
  return {
    mode: document.querySelector('#app').dataset.mode,
    domInteractive: navigation.domInteractive,
    loadEventEnd: navigation.loadEventEnd,
    firstContentfulPaint: paints['first-contentful-paint'] ?? null,
    transferSize: resources.reduce((total, entry) => total + entry.transferSize, navigation.transferSize),
    resources,
  };
})()`);

await evaluate(`document.querySelector('#drawer-start-button').click()`);
await waitFor(`document.querySelector('#app').dataset.mode === 'drawer' && typeof window.__DRAWER_LAB_QA__ === 'object'`);
const drawer = await evaluate(`(async () => {
  const resources = performance.getEntriesByType('resource').map((entry) => ({
    name: entry.name,
    type: entry.initiatorType,
    transferSize: entry.transferSize,
    duration: entry.duration,
  }));
  const frameIntervals = await new Promise((resolve) => {
    const samples = [];
    let previous = performance.now();
    function sample(now) {
      samples.push(now - previous);
      previous = now;
      if (samples.length >= 90) resolve(samples.slice(5));
      else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  const sorted = [...frameIntervals].sort((a, b) => a - b);
  return {
    mode: document.querySelector('#app').dataset.mode,
    transferSize: resources.reduce((total, entry) => total + entry.transferSize, 0),
    resources,
    averageFrameMs: frameIntervals.reduce((total, value) => total + value, 0) / frameIntervals.length,
    p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
  };
})()`);

await command('Network.clearBrowserCache');
await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await command('Page.navigate', { url: appUrl });
await waitFor(`document.readyState === 'complete' && document.querySelector('#loading-screen').hidden`);
await evaluate(`document.querySelector('#start-button').click()`);
await waitFor(`!document.querySelector('#shop').hidden`);
await waitFor(`document.querySelector('#pc-model-status').dataset.state === 'ready'`, 180);
const mobilePc = await evaluate(`(() => ({
  status: document.querySelector('#pc-model-status').textContent.trim(),
  purchaseEnabled: !document.querySelector('#purchase-button').disabled,
  modelResources: performance.getEntriesByType('resource')
    .filter((entry) => /pc-lab.*\\.glb/.test(entry.name))
    .map((entry) => ({ name: entry.name, transferSize: entry.transferSize, duration: entry.duration })),
}))()`);

const initialHeavyResources = lobby.resources.filter((entry) => /\/assets\/(?:app-|three-|drawer-|fluorescent-|shower-)|pc-lab.*\.glb/.test(entry.name));
const drawerLoadedPcModel = drawer.resources.some((entry) => /pc-lab.*\.glb/.test(entry.name));
const mobileLoadedBalancedModel = mobilePc.modelResources.length === 1 && mobilePc.modelResources[0].name.includes('pc-lab-mobile.glb');
const report = {
  measuredAt: new Date().toISOString(),
  url: appUrl,
  lobby,
  drawer,
  mobilePc,
  assertions: {
    initialHeavyResources: initialHeavyResources.map((entry) => entry.name),
    drawerLoadedPcModel,
    mobileLoadedBalancedModel,
  },
  errors,
};

await writeFile('/tmp/bupum-performance-qa.json', JSON.stringify(report, null, 2));
socket.close();

console.log(JSON.stringify({
  lobby: {
    firstContentfulPaint: lobby.firstContentfulPaint,
    loadEventEnd: lobby.loadEventEnd,
    transferSize: lobby.transferSize,
    requests: lobby.resources.length + 1,
  },
  drawer: {
    transferSize: drawer.transferSize,
    averageFrameMs: drawer.averageFrameMs,
    p95FrameMs: drawer.p95FrameMs,
  },
  mobilePc,
  assertions: report.assertions,
  errors,
}, null, 2));

if (initialHeavyResources.length || drawerLoadedPcModel || !mobileLoadedBalancedModel || !mobilePc.purchaseEnabled || errors.length) process.exitCode = 1;
