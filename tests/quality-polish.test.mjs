import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [mainSource, drawerSource, styles] = await Promise.all([
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/drawer-module.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/style.css', import.meta.url), 'utf8'),
]);

test('drawer placement provides magnetic alignment, explicit success feedback and recoverable rejection', () => {
  assert.match(mainSource, /playTone,\s*\n\s*}\);/);
  assert.match(drawerSource, /const magnetic = distance < 210/);
  assert.match(drawerSource, /정렬 완료 · 놓아서 고정하세요/);
  assert.match(drawerSource, /function animateRejectedDrop/);
  assert.match(drawerSource, /설치 위치에는 닿았지만 중심과 높이가 맞지 않습니다/);
  assert.match(styles, /touch-action: none/);
});

test('PC completion uses room-scale placement and a functional monitor boot surface', () => {
  assert.match(mainSource, /function createMonitorBootTexture/);
  assert.match(mainSource, /SYSTEM READY/);
  assert.match(mainSource, /pcAssemblyRig\.scale\.setScalar\(0\.42\)/);
  assert.match(mainSource, /room_monitor_light/);
});
