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

async function dragCurrent() {
  const points = await evaluate('window.__DRAWER_LAB_QA__.dragPoints()');
  if (!points) return false;
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: points.from.x, y: points.from.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let index = 1; index <= 24; index += 1) {
    const ratio = index / 24;
    await command('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: points.from.x + (points.to.x - points.from.x) * ratio,
      y: points.from.y + (points.to.y - points.from.y) * ratio,
      button: 'left',
      buttons: 1,
    });
    await wait(10);
  }
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: points.to.x, y: points.to.y, button: 'left', buttons: 0, clickCount: 1 });
  await wait(650);
  return points;
}

await mkdir('/Users/yunsu/pc-build-lab/qa', { recursive: true });
await command('Page.enable');
await command('Runtime.enable');
await command('Log.enable');
await command('Page.bringToFront');
await command('Emulation.setFocusEmulationEnabled', { enabled: true });
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await command('Page.navigate', { url: 'http://127.0.0.1:5173/' });

for (let attempt = 0; attempt < 100; attempt += 1) {
  if (await evaluate(`document.querySelector('#loading-screen').hidden && !document.querySelector('#drawer-start-button').disabled`)) break;
  await wait(180);
}

const report = {};
report.lobby = await evaluate(`({
  mode: document.querySelector('#app').dataset.mode,
  modules: [...document.querySelectorAll('.module-card b')].map((node) => node.textContent.trim()),
  cards: [...document.querySelectorAll('.module-card')].map((node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }),
  drawerEnabled: !document.querySelector('#drawer-start-button').disabled,
  bodyOverflow: document.body.scrollHeight - innerHeight
})`);
await screenshot('drawer-00-lobby.png');

await evaluate(`document.querySelector('#drawer-start-button').click()`);
await wait(900);
report.started = await evaluate(`({ visible: !document.querySelector('#drawer-workspace').hidden, state: window.__DRAWER_LAB_QA__.state() })`);
await screenshot('drawer-01-kit-parts.png');

await evaluate(`document.querySelector('[data-drawer-kit="oak-softclose"]').click(); [...document.querySelectorAll('[data-drawer-inventory]')].forEach((button) => button.click())`);
report.kit = await evaluate(`({ state: window.__DRAWER_LAB_QA__.state(), actionEnabled: !document.querySelector('#drawer-action').disabled })`);
await evaluate(`document.querySelector('#drawer-action').click()`);
await wait(850);

report.firstDragPoints = await dragCurrent();
report.afterFirstDrag = await evaluate(`window.__DRAWER_LAB_QA__.state()`);
if (!report.afterFirstDrag.installed.includes('side-set')) await evaluate(`window.__DRAWER_LAB_QA__.installCurrent()`);
report.secondDragPoints = await dragCurrent();
report.frame = await evaluate(`window.__DRAWER_LAB_QA__.state()`);
if (!report.frame.installed.includes('top-base-set')) await evaluate(`window.__DRAWER_LAB_QA__.installCurrent()`);
await wait(650);
await screenshot('drawer-02-frame-assembled.png');
await evaluate(`document.querySelector('#drawer-action').click()`);
await wait(500);

await evaluate(`document.querySelector('[data-drawer-lock="outside"]').click()`);
report.wrongCam = await evaluate(`({ state: window.__DRAWER_LAB_QA__.state(), feedback: document.querySelector('#drawer-feedback').textContent.trim() })`);
await evaluate(`document.querySelector('[data-drawer-lock="bolt"]').click(); document.querySelector('#drawer-action').click()`);
await wait(520);
await evaluate(`document.querySelector('[data-drawer-rail="markings"]').click()`);
report.railDragPoints = await dragCurrent();
if (!(await evaluate(`window.__DRAWER_LAB_QA__.state().installed.includes('rail-set')`))) await evaluate(`window.__DRAWER_LAB_QA__.installCurrent()`);
await wait(650);
report.rails = await evaluate(`window.__DRAWER_LAB_QA__.state()`);
await screenshot('drawer-04-rails.png');
await evaluate(`document.querySelector('#drawer-action').click()`);
await wait(450);

report.backDragPoints = await dragCurrent();
if (!(await evaluate(`window.__DRAWER_LAB_QA__.state().installed.includes('back-panel')`))) await evaluate(`window.__DRAWER_LAB_QA__.installCurrent()`);
await wait(650);
await evaluate(`document.querySelector('[data-drawer-diagonal="skew"]').click(); document.querySelector('[data-drawer-diagonal="equal"]').click()`);
report.square = await evaluate(`window.__DRAWER_LAB_QA__.state()`);
await screenshot('drawer-05-square-back.png');
await evaluate(`document.querySelector('#drawer-action').click()`);
await wait(450);

for (let index = 0; index < 3; index += 1) {
  const points = await dragCurrent();
  report[`drawerDrag${index + 1}`] = points;
  if ((await evaluate(`window.__DRAWER_LAB_QA__.state().installed.filter((id) => id.startsWith('drawer-')).length`)) < index + 1) await evaluate(`window.__DRAWER_LAB_QA__.installCurrent()`);
  await wait(620);
}
report.drawers = await evaluate(`window.__DRAWER_LAB_QA__.state()`);
await screenshot('drawer-06-drawers-installed.png');
await evaluate(`document.querySelector('#drawer-action').click()`);
await wait(450);

await evaluate(`document.querySelector('[data-drawer-wall="concrete"]').click(); document.querySelector('[data-drawer-anchor="matched"]').click()`);
report.anchor = await evaluate(`window.__DRAWER_LAB_QA__.state()`);
await screenshot('drawer-07-anchor.png');
await evaluate(`document.querySelector('#drawer-action').click()`);
await wait(500);

for (const id of ['drawer-3', 'drawer-2', 'drawer-1']) {
  await evaluate(`window.__DRAWER_LAB_QA__.testDrawer('${id}')`);
  await wait(1800);
}
report.test = await evaluate(`window.__DRAWER_LAB_QA__.state()`);
await screenshot('drawer-08-motion-test.png');
await evaluate(`document.querySelector('#drawer-action').click()`);
await wait(900);
report.completed = await evaluate(`({
  completionVisible: !document.querySelector('#drawer-completion').hidden,
  state: window.__DRAWER_LAB_QA__.state(),
  result: document.querySelector('.drawer-result-motion').textContent.trim(),
  solvedProblem: document.querySelector('.drawer-learning').textContent.trim(),
  controlsHelp: document.querySelector('.drawer-completion-camera').textContent.trim()
})`);
await screenshot('drawer-09-completion.png');

await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await command('Page.navigate', { url: 'http://127.0.0.1:5173/' });
for (let attempt = 0; attempt < 100; attempt += 1) {
  if (await evaluate(`document.querySelector('#loading-screen').hidden && !document.querySelector('#drawer-start-button').disabled`)) break;
  await wait(180);
}
report.mobileLobby = await evaluate(`({
  width: innerWidth,
  cards: [...document.querySelectorAll('.module-card')].map((node) => { const r = node.getBoundingClientRect(); return { width: r.width, height: r.height }; }),
  introScrollable: document.querySelector('#intro').scrollHeight >= document.querySelector('#intro').clientHeight
})`);
await screenshot('drawer-10-mobile-lobby.png');
await evaluate(`document.querySelector('#drawer-start-button').click()`);
await wait(850);
report.mobileModule = await evaluate(`({
  workspaceVisible: !document.querySelector('#drawer-workspace').hidden,
  guideWidth: document.querySelector('.drawer-guide-panel').getBoundingClientRect().width,
  routeWidth: document.querySelector('.drawer-route-panel').getBoundingClientRect().width,
  workspaceScrollable: document.querySelector('#drawer-workspace').scrollHeight > document.querySelector('#drawer-workspace').clientHeight
})`);
await screenshot('drawer-11-mobile-kit.png');

report.errors = errors;
await writeFile('/tmp/drawer-qa.json', JSON.stringify(report, null, 2));
socket.close();

if (!report.lobby.drawerEnabled || report.lobby.modules.length !== 4 || !report.started.visible) process.exitCode = 1;
if (!report.kit.actionEnabled || report.kit.state.inventory.length !== 7) process.exitCode = 1;
if (!report.frame.installed.includes('top-base-set') || !report.rails.installed.includes('rail-set')) process.exitCode = 1;
if (!report.square.diagonalChecked || report.drawers.installed.filter((id) => id.startsWith('drawer-')).length !== 3) process.exitCode = 1;
if (report.anchor.anchorPlan !== 'matched' || report.test.tests.length !== 3) process.exitCode = 1;
if (!report.completed.completionVisible || !report.completed.state.completed || errors.length) process.exitCode = 1;
if (report.mobileLobby.width !== 390 || !report.mobileModule.workspaceVisible || report.mobileModule.guideWidth > 370) process.exitCode = 1;
