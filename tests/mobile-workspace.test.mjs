import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [markup, drawerSource, styles] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/drawer-module.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/style.css', import.meta.url), 'utf8'),
]);

test('mobile drawer assembly keeps the 3D work area available behind a collapsible guide', () => {
  assert.match(markup, /id="drawer-guide-toggle"/);
  assert.match(markup, /aria-expanded="true"/);
  assert.match(drawerSource, /setGuideCollapsed\(true\)/);
  assert.match(drawerSource, /안내 펼치기/);
  assert.match(styles, /\.drawer-workspace \{ position: absolute; inset: 62px 0 0; overflow: hidden; background: transparent; pointer-events: none; \}/);
  assert.match(styles, /transform: translateY\(calc\(100% - 106px\)\)/);
  assert.match(styles, /\.drawer-workspace \.drawer-view \{ flex: 1 1 auto;/);
});
