import { writeFile } from 'node:fs/promises';

const port = process.env.CDP_PORT ?? '9240';
const endpoint = `http://127.0.0.1:${port}`;
const target = await fetch(`${endpoint}/json/new?http://127.0.0.1:5173/`, { method: 'PUT' }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
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

await command('Page.enable');
await command('Runtime.enable');
await command('Page.bringToFront');
await command('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
await command('Page.navigate', { url: 'http://127.0.0.1:5173/' });

for (let attempt = 0; attempt < 100; attempt += 1) {
  if (await evaluate(`document.querySelector('#loading-screen')?.hidden && !document.querySelector('#start-button')?.disabled`)) break;
  await wait(160);
}
await evaluate(`Promise.all([document.fonts.ready, fetch('/images/home-diy-hero-v1.avif').then((response) => response.blob())])`);
await wait(350);

const report = await evaluate(`(() => ({
  background: getComputedStyle(document.querySelector('.intro'), '::before').backgroundImage,
  backgroundPosition: getComputedStyle(document.querySelector('.intro'), '::before').backgroundPosition,
  cards: [...document.querySelectorAll('.module-card')].map((card) => {
    const title = card.querySelector('.module-card-copy b');
    const rect = title.getBoundingClientRect();
    return {
      text: title.textContent.trim(),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      overflow: getComputedStyle(title).overflow,
      color: getComputedStyle(title).color,
    };
  }),
}))()`);
const { data } = await command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
await writeFile('/Users/yunsu/pc-build-lab/qa/home-diy-lobby-mobile.png', Buffer.from(data, 'base64'));
await writeFile('/tmp/pc-build-lab-lobby-background-qa.json', JSON.stringify(report, null, 2));
socket.close();
await fetch(`${endpoint}/json/close/${target.id}`);

if (!report.background.includes('home-diy-hero-v1.avif') || !report.backgroundPosition.startsWith('82%')) process.exitCode = 1;
if (report.cards.some((card) => card.width < 180 || card.height < 18 || card.overflow !== 'visible')) process.exitCode = 1;
