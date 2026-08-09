import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDirectory = path.join(root, 'dist/assets');
const manifestPath = path.join(root, 'dist/.vite/manifest.json');
const limits = {
  entryJavaScript: 20 * 1024,
  javascriptChunk: 500 * 1024,
  desktopModel: 7 * 1024 * 1024,
  mobileModel: 4 * 1024 * 1024,
  lobbyHero: 200 * 1024,
};

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const entry = Object.values(manifest).find((item) => item.isEntry);
if (!entry) throw new Error('Vite 진입 청크를 찾지 못했습니다.');

const failures = [];
const entrySize = (await stat(path.join(root, 'dist', entry.file))).size;
if (entrySize > limits.entryJavaScript) {
  failures.push(`첫 화면 JS ${entrySize}B > ${limits.entryJavaScript}B`);
}

const scripts = (await readdir(assetsDirectory)).filter((file) => file.endsWith('.js'));
for (const file of scripts) {
  const size = (await stat(path.join(assetsDirectory, file))).size;
  if (size > limits.javascriptChunk) failures.push(`${file} ${size}B > ${limits.javascriptChunk}B`);
}

const desktopModel = (await stat(path.join(root, 'public/models/pc-lab.glb'))).size;
const mobileModel = (await stat(path.join(root, 'public/models/pc-lab-mobile.glb'))).size;
const lobbyHero = (await stat(path.join(root, 'public/images/home-assembly-studio-hero-v2.jpg'))).size;
if (desktopModel > limits.desktopModel) failures.push(`데스크톱 3D 모델 ${desktopModel}B > ${limits.desktopModel}B`);
if (mobileModel > limits.mobileModel) failures.push(`모바일 3D 모델 ${mobileModel}B > ${limits.mobileModel}B`);
if (mobileModel >= desktopModel) failures.push('모바일 3D 모델이 데스크톱 모델보다 작지 않습니다.');
if (lobbyHero > limits.lobbyHero) failures.push(`로비 배경 이미지 ${lobbyHero}B > ${limits.lobbyHero}B`);

if (failures.length) {
  console.error(`성능 예산 초과\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ entrySize, desktopModel, mobileModel, lobbyHero, chunks: scripts.length }, null, 2));
}
