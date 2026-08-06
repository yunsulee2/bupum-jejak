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

async function circularTurn(direction) {
  const rect = await evaluate(`(() => { const r = document.querySelector('#fluorescent-turn-dial').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const radius = Math.min(rect.width, rect.height) * 0.42;
  const point = (angle) => ({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
  const start = point(0);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: start.x, y: start.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let index = 1; index <= 18; index += 1) {
    const current = point(direction * Math.PI * 0.56 * (index / 18));
    await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: current.x, y: current.y, button: 'left', buttons: 1 });
    await wait(2);
  }
  const end = point(direction * Math.PI * 0.56);
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

for (let attempt = 0; attempt < 80; attempt += 1) {
  if (await evaluate(`document.querySelector('#loading-screen').hidden && !document.querySelector('#fluorescent-start-button').disabled`)) break;
  await wait(180);
}

const report = {};
report.lobby = await evaluate(`({
  mode: document.querySelector('#app').dataset.mode,
  title: document.querySelector('#title').textContent.trim(),
  modules: [...document.querySelectorAll('.module-card b')].map((node) => node.textContent.trim()),
  fluorescentEnabled: !document.querySelector('#fluorescent-start-button').disabled
})`);
await screenshot('module-lobby.png');

await evaluate(`document.querySelector('#fluorescent-start-button').click()`);
await wait(350);
report.started = await evaluate(`({ visible: !document.querySelector('#fluorescent-workspace').hidden, qa: window.__FLUORESCENT_LAB_QA__.state() })`);
await screenshot('fluorescent-01-inspection.png');

await evaluate(`[...document.querySelectorAll('[data-clue]')].forEach((button) => button.click())`);
await wait(120);
report.inspected = await evaluate(`({
  clues: window.__FLUORESCENT_LAB_QA__.state().clues,
  actionEnabled: !document.querySelector('#fluorescent-action').disabled,
  specs: [...document.querySelectorAll('#fluorescent-spec-sheet b')].map((node) => node.textContent.trim())
})`);

await evaluate(`document.querySelector('#fluorescent-action').click()`);
await wait(120);
await evaluate(`document.querySelector('[data-product="ledvance-t8-led-em"]').click()`);
await evaluate(`document.querySelector('#fluorescent-action').click()`);
await wait(80);
report.wrongChoice = await evaluate(`({
  stage: window.__FLUORESCENT_LAB_QA__.state().stage,
  errors: window.__FLUORESCENT_LAB_QA__.state().purchaseErrors,
  feedback: document.querySelector('#fluorescent-feedback').textContent.trim(),
  failedChecks: window.__FLUORESCENT_LAB_QA__.compatibility('ledvance-t8-led-em').filter((item) => !item.pass).map((item) => item.label)
})`);
await screenshot('fluorescent-03-wrong-product-feedback.png');

await evaluate(`document.querySelector('[data-product="kumho-fhf32-daylight"]').click()`);
await evaluate(`document.querySelector('#fluorescent-action').click()`);
await wait(460);
report.purchase = await evaluate(`window.__FLUORESCENT_LAB_QA__.state()`);

await evaluate(`[...document.querySelectorAll('[data-safety]')].forEach((button) => button.click())`);
await evaluate(`document.querySelector('#fluorescent-action').click()`);
await wait(160);
await circularTurn(1);
await wait(560);
report.removed = await evaluate(`window.__FLUORESCENT_LAB_QA__.state()`);

await circularTurn(-1);
await wait(560);
report.installed = await evaluate(`window.__FLUORESCENT_LAB_QA__.state()`);

await evaluate(`document.querySelector('#fluorescent-action').click()`);
await wait(660);
report.tested = await evaluate(`window.__FLUORESCENT_LAB_QA__.state()`);
await evaluate(`document.querySelector('[data-disposal="general"]').click()`);
await evaluate(`document.querySelector('#fluorescent-action').click()`);
report.wrongDisposal = await evaluate(`({ state: window.__FLUORESCENT_LAB_QA__.state(), feedback: document.querySelector('#fluorescent-feedback').textContent.trim() })`);
await evaluate(`document.querySelector('[data-disposal="collection"]').click()`);
await evaluate(`document.querySelector('#fluorescent-action').click()`);
await wait(780);
report.completed = await evaluate(`({
  completionVisible: !document.querySelector('#fluorescent-completion').hidden,
  state: window.__FLUORESCENT_LAB_QA__.state(),
  result: document.querySelector('.fluorescent-result-light').textContent.trim(),
  solvedProblem: document.querySelector('.fluorescent-learning').textContent.trim()
})`);
await screenshot('fluorescent-07-completion-room.png');

report.errors = errors;
await writeFile('/tmp/fluorescent-lab-qa.json', JSON.stringify(report, null, 2));
socket.close();

if (!report.lobby.fluorescentEnabled || !report.started.visible || report.inspected.clues.length !== 5) process.exitCode = 1;
if (report.wrongChoice.errors !== 1 || report.wrongChoice.stage !== 'shop') process.exitCode = 1;
if (report.removed.stage !== 'install' || report.installed.stage !== 'test' || report.tested.stage !== 'dispose') process.exitCode = 1;
if (report.wrongDisposal.state.disposalErrors !== 1 || report.wrongDisposal.state.stage !== 'dispose') process.exitCode = 1;
if (!report.completed.completionVisible || !report.completed.state.powered || errors.length) process.exitCode = 1;
