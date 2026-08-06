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
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
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

async function centerOf(selector) {
  return evaluate(`(() => { const r = document.querySelector('${selector}').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, width: r.width, height: r.height }; })()`);
}

async function circularTurn(selector, direction) {
  const rect = await centerOf(selector);
  const radius = Math.min(rect.width, rect.height) * 0.39;
  const point = (angle) => ({ x: rect.x + Math.cos(angle) * radius, y: rect.y + Math.sin(angle) * radius });
  const start = point(0);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: start.x, y: start.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let index = 1; index <= 48; index += 1) {
    const current = point(direction * Math.PI * 2.08 * (index / 48));
    await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: current.x, y: current.y, button: 'left', buttons: 1 });
    await wait(3);
  }
  const end = point(direction * Math.PI * 2.08);
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: end.x, y: end.y, button: 'left', buttons: 0, clickCount: 1 });
}

async function dragFilter() {
  const start = await centerOf('#shower-filter-piece');
  const end = await centerOf('#shower-filter-slot');
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: start.x, y: start.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let index = 1; index <= 18; index += 1) {
    const ratio = index / 18;
    await command('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
      button: 'left',
      buttons: 1,
    });
    await wait(8);
  }
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: end.x, y: end.y, button: 'left', buttons: 0, clickCount: 1 });
}

await mkdir('/Users/yunsu/pc-build-lab/qa', { recursive: true });
await command('Page.enable');
await command('Runtime.enable');
await command('Log.enable');
await command('Page.bringToFront');
await command('Emulation.setFocusEmulationEnabled', { enabled: true });
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await command('Page.navigate', { url: 'http://127.0.0.1:5173/' });

for (let attempt = 0; attempt < 90; attempt += 1) {
  if (await evaluate(`document.querySelector('#loading-screen').hidden && !document.querySelector('#shower-start-button').disabled`)) break;
  await wait(180);
}

const report = {};
report.lobby = await evaluate(`({
  mode: document.querySelector('#app').dataset.mode,
  modules: [...document.querySelectorAll('.module-card b')].map((node) => node.textContent.trim()),
  showerEnabled: !document.querySelector('#shower-start-button').disabled
})`);
await screenshot('module-lobby.png');

await evaluate(`document.querySelector('#shower-start-button').click()`);
await wait(420);
report.started = await evaluate(`({ visible: !document.querySelector('#shower-workspace').hidden, state: window.__SHOWER_FILTER_QA__.state() })`);
await screenshot('shower-01-inspection.png');

await evaluate(`[...document.querySelectorAll('[data-shower-clue]')].forEach((button) => button.click())`);
report.inspected = await evaluate(`({
  state: window.__SHOWER_FILTER_QA__.state(),
  specs: [...document.querySelectorAll('#shower-spec-sheet b')].map((node) => node.textContent.trim()),
  actionEnabled: !document.querySelector('#shower-action').disabled
})`);
await evaluate(`document.querySelector('#shower-action').click()`);
await wait(140);

await evaluate(`document.querySelector('[data-shower-product="atojet-signature-refill"]').click()`);
await evaluate(`document.querySelector('#shower-action').click()`);
await wait(90);
report.wrongChoice = await evaluate(`({
  state: window.__SHOWER_FILTER_QA__.state(),
  feedback: document.querySelector('#shower-feedback').textContent.trim(),
  failedChecks: window.__SHOWER_FILTER_QA__.compatibility('atojet-signature-refill').filter((item) => !item.pass).map((item) => item.label)
})`);
await screenshot('shower-02-wrong-filter.png');

await evaluate(`document.querySelector('[data-shower-product="atojet-pure-filter-1pack"]').click()`);
await evaluate(`document.querySelector('#shower-action').click()`);
await wait(480);
report.purchase = await evaluate(`window.__SHOWER_FILTER_QA__.state()`);

await evaluate(`[...document.querySelectorAll('[data-shower-prepare]')].forEach((button) => button.click())`);
await evaluate(`document.querySelector('#shower-action').click()`);
await wait(160);
await circularTurn('#shower-twist-dial', -1);
await wait(600);
report.opened = await evaluate(`window.__SHOWER_FILTER_QA__.state()`);

await dragFilter();
await wait(180);
report.dragged = await evaluate(`window.__SHOWER_FILTER_QA__.state()`);
await screenshot('shower-05-filter-installed.png');
await evaluate(`document.querySelector('#shower-action').click()`);
await wait(100);

await evaluate(`document.querySelector('#shower-oring-button').click()`);
await circularTurn('#shower-seal-dial', 1);
await wait(600);
report.sealed = await evaluate(`window.__SHOWER_FILTER_QA__.state()`);

const flush = await centerOf('#shower-flush-button');
await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: flush.x, y: flush.y, button: 'left', buttons: 1, clickCount: 1 });
await wait(2800);
await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: flush.x, y: flush.y, button: 'left', buttons: 0, clickCount: 1 });
await wait(120);
report.tested = await evaluate(`({
  state: window.__SHOWER_FILTER_QA__.state(),
  results: [...document.querySelectorAll('#shower-test-results span')].map((node) => node.textContent.trim())
})`);
await evaluate(`document.querySelector('#shower-action').click()`);
await wait(850);
report.completed = await evaluate(`({
  completionVisible: !document.querySelector('#shower-completion').hidden,
  state: window.__SHOWER_FILTER_QA__.state(),
  result: document.querySelector('.shower-result-water').textContent.trim(),
  solvedProblem: document.querySelector('.shower-learning').textContent.trim()
})`);
await screenshot('shower-07-completion-bathroom.png');

report.errors = errors;
await writeFile('/tmp/shower-filter-qa.json', JSON.stringify(report, null, 2));
socket.close();

if (!report.lobby.showerEnabled || report.lobby.modules.length !== 4 || !report.started.visible) process.exitCode = 1;
if (report.inspected.state.clues.length !== 5 || !report.inspected.actionEnabled) process.exitCode = 1;
if (report.wrongChoice.state.purchaseErrors !== 1 || report.wrongChoice.state.stage !== 'shop') process.exitCode = 1;
if (report.opened.stage !== 'install' || !report.dragged.filterInstalled) process.exitCode = 1;
if (report.sealed.stage !== 'test' || !report.sealed.sealed) process.exitCode = 1;
if (!report.tested.state.tested || !report.completed.completionVisible || !report.completed.state.completed || errors.length) process.exitCode = 1;
