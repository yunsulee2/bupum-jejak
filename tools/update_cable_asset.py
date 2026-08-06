"""Patch cable source/installed states into the existing Neural4D Blender asset."""

from math import pi
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "assets" / "pc-lab-source.blend"
MODEL_PATH = ROOT / "public" / "models" / "pc-lab.glb"


def remove_tree(obj):
    for child in list(obj.children):
        remove_tree(child)
    bpy.data.objects.remove(obj, do_unlink=True)


def new_group(name, parent):
    group = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(group)
    group.parent = parent
    return group


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


def torus(name, location, major, minor, material, parent):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=40,
        minor_segments=8,
        location=location,
        rotation=(0, 0, 0),
    )
    obj = finish(bpy.context.object, name, material, parent)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


cables = bpy.data.objects.get("part_cables")
if cables is None:
    raise RuntimeError("part_cables was not found in the Blender source")

for group_name in ("cable_installed_routes", "cable_loose_bundle"):
    existing = bpy.data.objects.get(group_name)
    if existing:
        remove_tree(existing)

installed = new_group("cable_installed_routes", cables)
route_prefixes = ("atx24_lane_", "eps8_lane_", "gpu12_lane_")
connector_names = {"atx24_connector", "eps8_connector", "gpu12_connector"}
for obj in list(cables.children):
    if obj is installed or not (obj.name.startswith(route_prefixes) or obj.name in connector_names):
        continue
    world = obj.matrix_world.copy()
    obj.parent = installed
    obj.matrix_world = world

black = bpy.data.materials.get("POLYMER soft black")
gold = bpy.data.materials.get("CONTACT gold")
if black is None or gold is None:
    raise RuntimeError("Cable materials were not found in the Blender source")

loose = new_group("cable_loose_bundle", cables)
for cable_index, center_x in enumerate((-0.48, 0.0, 0.48)):
    for loop_index, loop_radius in enumerate((0.21, 0.26, 0.31)):
        torus(
            f"cable_loose_{cable_index}_loop_{loop_index}",
            (center_x, 0.0, 2.58 + loop_index * 0.018),
            loop_radius,
            0.026,
            black,
            loose,
        )
    box(f"cable_loose_{cable_index}_strap", (center_x, 0.0, 2.64), (0.12, 0.68, 0.08), gold, loose, 0.015)
    connector_y = 0.42 if cable_index % 2 == 0 else -0.42
    box(f"cable_loose_{cable_index}_connector", (center_x, connector_y, 2.62), (0.22, 0.16, 0.15), black, loose, 0.018)

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
print(f"CABLE_ASSET_UPDATED: {MODEL_PATH}")
