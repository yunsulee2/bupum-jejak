import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [mainSource, styles] = await Promise.all([
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/style.css', import.meta.url), 'utf8'),
]);

test('home-repair modules load their code and data only when selected', () => {
  assert.doesNotMatch(mainSource, /import \{ create(?:Fluorescent|ShowerFilter|Drawer)Module/);
  assert.match(mainSource, /import\('\.\/fluorescent-module\.js'\)/);
  assert.match(mainSource, /import\('\.\/shower-filter-module\.js'\)/);
  assert.match(mainSource, /import\('\.\/drawer-module\.js'\)/);

  const initialLoader = mainSource.match(/async function loadExperience\(\) \{([\s\S]*?)\n\}\n\nfunction animate/)?.[1] ?? '';
  assert.match(initialLoader, /desktop-atx\.json/);
  assert.match(initialLoader, /store-catalog\.json/);
  assert.doesNotMatch(initialLoader, /fluorescent-lab|shower-filter-lab|drawer-lab/);
});

test('module cards expose loading and retry states', () => {
  assert.match(mainSource, /aria-busy/);
  assert.match(mainSource, /불러오기 실패 · 다시 누르세요/);
  assert.match(styles, /module-card\[data-load-state="loading"\]/);
  assert.match(styles, /@keyframes module-loading/);
});
