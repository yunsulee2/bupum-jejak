import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getRenderProfile } from '../src/render-quality.js';

const [viteConfig, packageJson] = await Promise.all([
  readFile(new URL('../vite.config.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
]);

test('mobile rendering uses a balanced profile while desktop keeps high-detail assets', () => {
  const mobile = getRenderProfile({ viewportWidth: 390, devicePixelRatio: 3, deviceMemory: 4, coarsePointer: true });
  const desktop = getRenderProfile({ viewportWidth: 1440, devicePixelRatio: 2, deviceMemory: 16, coarsePointer: false });
  assert.equal(mobile.pixelRatio, 1.35);
  assert.equal(mobile.shadowMapSize, 1024);
  assert.match(mobile.modelUrl, /pc-lab-mobile\.glb/);
  assert.equal(desktop.pixelRatio, 1.8);
  assert.equal(desktop.shadowMapSize, 2048);
  assert.match(desktop.modelUrl, /pc-lab\.glb/);
});

test('build output is split and protected by a repeatable performance gate', () => {
  assert.match(viteConfig, /manualChunks/);
  assert.match(viteConfig, /three\/src\/Three\.js/);
  assert.match(viteConfig, /manifest: true/);
  assert.match(packageJson.scripts.verify, /check:performance/);
  assert.match(packageJson.scripts['assets:optimize'], /optimize_pc_model/);
});
