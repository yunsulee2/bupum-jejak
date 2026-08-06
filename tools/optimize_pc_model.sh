#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_MODEL="$PROJECT_ROOT/public/models/pc-lab.glb"
MOBILE_MODEL="$PROJECT_ROOT/public/models/pc-lab-mobile.glb"
WORK_DIR="$(mktemp -d /tmp/bupum-pc-model.XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

CLI=(npx --yes @gltf-transform/cli@4.4.2)
MESHOPT_ARGS=(--level high --quantize-position 16 --quantize-normal 12 --quantize-texcoord 14)

"${CLI[@]}" meshopt "$SOURCE_MODEL" "$WORK_DIR/desktop.glb" "${MESHOPT_ARGS[@]}"
"${CLI[@]}" resize "$SOURCE_MODEL" "$WORK_DIR/mobile-raw.glb" --width 2048 --height 2048 --filter lanczos3
"${CLI[@]}" meshopt "$WORK_DIR/mobile-raw.glb" "$WORK_DIR/mobile.glb" "${MESHOPT_ARGS[@]}"

mv "$WORK_DIR/desktop.glb" "$SOURCE_MODEL"
mv "$WORK_DIR/mobile.glb" "$MOBILE_MODEL"
echo "PC 모델 최적화 완료: $SOURCE_MODEL / $MOBILE_MODEL"
