"""Add joined front/side tempered-glass panels to the existing Blender asset."""

from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "assets" / "pc-lab-source.blend"
MODEL_PATH = ROOT / "public" / "models" / "pc-lab.glb"


def finish(obj, name, material, parent, bevel=0.0):
    obj.name = name
    obj.data.materials.append(material)
    obj.parent = parent
    if bevel:
        modifier = obj.modifiers.new("precision_edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


def box(name, location, dimensions, material, parent, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, material, parent, bevel)


case = bpy.data.objects.get("part_case")
glass = bpy.data.materials.get("GLASS tempered smoked")
frame = bpy.data.materials.get("CASE machined edge")
if case is None or glass is None or frame is None:
    raise RuntimeError("Case or glass materials were not found in the Blender source")

for obj in list(bpy.data.objects):
    if obj.name.startswith("case_glass_"):
        bpy.data.objects.remove(obj, do_unlink=True)

box("case_glass_panel_side", (-1.175, 0.0, 2.62), (0.035, 4.72, 4.55), glass, case, 0.008)
box("case_glass_panel_front", (0.0, -2.505, 2.62), (2.22, 0.035, 4.55), glass, case, 0.008)
box("case_glass_corner_post", (-1.18, -2.50, 2.62), (0.10, 0.10, 4.72), frame, case, 0.02)
for rail_index, z in enumerate((0.32, 4.90)):
    box(f"case_glass_side_rail_{rail_index}", (-1.18, 0.0, z), (0.10, 4.78, 0.10), frame, case, 0.015)
    box(f"case_glass_front_rail_{rail_index}", (0.0, -2.51, z), (2.28, 0.10, 0.10), frame, case, 0.015)

bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_PATH))
bpy.ops.export_scene.gltf(
    filepath=str(MODEL_PATH),
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_extras=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)
print(f"CASE_GLASS_UPDATED: {MODEL_PATH}")
