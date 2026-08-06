import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [bootstrapSource, appSource, styles] = await Promise.all([
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/style.css', import.meta.url), 'utf8'),
]);

test('the lobby and each 3D practice load only when selected', () => {
  assert.match(bootstrapSource, /import\('\.\/app\.js'\)/);
  assert.doesNotMatch(bootstrapSource, /from ['"]three/);
  assert.doesNotMatch(bootstrapSource, /desktop-atx|pc-lab\.glb|fluorescent-lab|shower-filter-lab|drawer-lab/);
  assert.doesNotMatch(appSource, /import \{ create(?:Fluorescent|ShowerFilter|Drawer)Module/);
  assert.match(appSource, /import\('\.\/fluorescent-module\.js'\)/);
  assert.match(appSource, /import\('\.\/shower-filter-module\.js'\)/);
  assert.match(appSource, /import\('\.\/drawer-module\.js'\)/);
  assert.match(appSource, /async function ensurePcData\(\)/);
  assert.match(appSource, /async function ensurePcModel\(\)/);
});

test('module cards expose loading and retry states', () => {
  assert.match(bootstrapSource, /aria-busy/);
  assert.match(bootstrapSource, /불러오기 실패 · 다시 누르세요/);
  assert.match(styles, /module-card\[data-load-state="loading"\]/);
  assert.match(styles, /@keyframes module-loading/);
});
