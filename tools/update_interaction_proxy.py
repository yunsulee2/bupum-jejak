"""Add stable invisible pick volumes to high-detail moving assemblies."""

from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "assets" / "pc-lab-source.blend"
MODEL_PATH = ROOT / "public" / "models" / "pc-lab.glb"


def material():
    name = "INTERACTION invisible collider"
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (0.0, 0.0, 0.0, 0.001)
    mat.surface_render_method = "DITHERED"
    principled = mat.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 0.001)
        principled.inputs["Alpha"].default_value = 0.001
        principled.inputs["Roughness"].default_value = 1.0
    return mat


cooler = bpy.data.objects.get("part_cooler")
if cooler is None:
    raise RuntimeError("part_cooler not found")

existing = bpy.data.objects.get("interaction_proxy_cooler")
if existing:
    bpy.data.objects.remove(existing, do_unlink=True)

bpy.ops.mesh.primitive_cube_add(location=(-0.40, -0.34, 3.69))
proxy = bpy.context.object
proxy.name = "interaction_proxy_cooler"
proxy.scale = (1.50 / 2, 1.14 / 2, 1.28 / 2)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
proxy.data.materials.append(material())
proxy.parent = cooler

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
print(f"INTERACTION_PROXY_UPDATED: {MODEL_PATH}")
