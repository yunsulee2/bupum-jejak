import { writeFile } from 'node:fs/promises';

const port = process.env.CDP_PORT ?? '9223';
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
const target = targets.find((item) => item.type === 'page' && item.url.startsWith('http://127.0.0.1:5173/'));
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
  const callback = pending.get(message.id);
  pending.delete(message.id);
  callback(message.result);
});

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}

const evaluation = await command('Runtime.evaluate', {
  expression: `({
    mode: document.querySelector('#app').dataset.mode,
    current: document.querySelector('#step-current').textContent,
    count: document.querySelector('#part-count').textContent,
    completion: !document.querySelector('#completion').hidden,
    title: document.querySelector('#step-title').textContent
  })`,
  returnByValue: true,
});
const capture = await command('Page.captureScreenshot', { format: 'png', fromSurface: true });
await writeFile('/tmp/pc-build-lab-current.json', JSON.stringify(evaluation.result.value, null, 2));
await writeFile('/tmp/pc-build-lab-current.png', Buffer.from(capture.data, 'base64'));
socket.close();
process.exit(0);
