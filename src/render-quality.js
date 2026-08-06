import { publicUrl } from './public-url.js';

export function getRenderProfile({
  viewportWidth = globalThis.innerWidth ?? 1440,
  devicePixelRatio = globalThis.devicePixelRatio ?? 1,
  deviceMemory = globalThis.navigator?.deviceMemory,
  coarsePointer = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false,
} = {}) {
  const compact = viewportWidth <= 820 || coarsePointer;
  const memoryConstrained = Number.isFinite(deviceMemory) && deviceMemory <= 4;
  const balanced = compact || memoryConstrained;

  return {
    balanced,
    pixelRatio: Math.min(devicePixelRatio, balanced ? 1.35 : 1.8),
    shadowMapSize: balanced ? 1024 : 2048,
    modelUrl: publicUrl(balanced
      ? '/models/pc-lab-mobile.glb?v=meshopt-20260807-1'
      : '/models/pc-lab.glb?v=meshopt-20260807-1'),
  };
}
