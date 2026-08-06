"""Unreal Editor script: import the shared Blender-generated GLB asset."""

from pathlib import Path

import unreal


project_dir = Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
workspace_root = project_dir.parents[1]
model_path = workspace_root / "public" / "models" / "pc-lab.glb"

if not model_path.exists():
    raise FileNotFoundError(f"BUILD//LAB model not found: {model_path}")

task = unreal.AssetImportTask()
task.filename = str(model_path)
task.destination_path = "/Game/BuildLab/Meshes/DesktopATX"
task.automated = True
task.replace_existing = True
task.save = True

unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])

if task.imported_object_paths:
    unreal.log(f"BUILD//LAB imported {len(task.imported_object_paths)} assets")
    for object_path in task.imported_object_paths:
        unreal.log(f"  {object_path}")
else:
    unreal.log_error("BUILD//LAB import produced no assets. Check Interchange glTF support.")
