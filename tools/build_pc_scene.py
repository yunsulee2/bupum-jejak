"""Generate the original BUILD//LAB desktop PC asset pack.

The scene uses a decimeter-like working scale so the representative 503 x 240 x
509 mm chassis and 305 x 244 mm ATX board retain realistic proportions. Product
logos and proprietary industrial designs are intentionally excluded.
"""

from math import cos, pi, sin
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "public" / "models" / "pc-lab.glb"
SOURCE_PATH = ROOT / "assets" / "pc-lab-source.blend"
NEURAL4D_CASE_PATH = ROOT / "assets" / "neural4d" / "atx-case-source.glb"
MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
SOURCE_PATH.parent.mkdir(parents=True, exist_ok=True)


def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def material(name, color, metallic=0.0, roughness=0.45, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, alpha)
    mat.metallic = metallic
    mat.roughness = roughness
    principled = mat.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = (*color, alpha)
        principled.inputs["Metallic"].default_value = metallic
        principled.inputs["Roughness"].default_value = roughness
        principled.inputs["Alpha"].default_value = alpha
    if alpha < 1.0:
        mat.surface_render_method = "DITHERED"
        mat.diffuse_color = (*color, alpha)
    return mat


def root(name, part_id=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    if part_id:
        obj["part_id"] = part_id
    return obj


def integrate_neural4d_case(case_root, triangle_budget=180_000):
    """Replace the procedural outer shell with an optimized Neural4D PBR asset.

    The existing animated fans and assembly landmarks stay in place so the web
    interaction contract and Unreal part IDs remain stable.
    """
    if not NEURAL4D_CASE_PATH.exists():
        print(f"NEURAL4D_CASE: skipped ({NEURAL4D_CASE_PATH} not found)")
        return

    existing = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(NEURAL4D_CASE_PATH))
    imported = [obj for obj in bpy.context.scene.objects if obj not in existing]
    artifacts = [obj for obj in imported if obj.type == "MESH" and len(obj.data.polygons) <= 100]
    artifact_set = set(artifacts)
    imported = [obj for obj in imported if obj not in artifact_set]
    for obj in artifacts:
        bpy.data.objects.remove(obj, do_unlink=True)
    imported_set = set(imported)
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("Neural4D case GLB did not contain a mesh")

    source_faces = sum(len(obj.data.polygons) for obj in meshes)
    decimate_ratio = min(1.0, triangle_budget / max(1, source_faces))
    if decimate_ratio < 0.999:
        for obj in meshes:
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            modifier = obj.modifiers.new("game_ready_decimation", "DECIMATE")
            modifier.ratio = decimate_ratio
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)

    bounds = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    source_min = Vector((min(point.x for point in bounds), min(point.y for point in bounds), min(point.z for point in bounds)))
    source_max = Vector((max(point.x for point in bounds), max(point.y for point in bounds), max(point.z for point in bounds)))
    source_center = (source_min + source_max) * 0.5
    source_size = source_max - source_min

    neural_shell = root("neural4d_case_shell")
    neural_shell.parent = case_root
    neural_shell["generator"] = "Neural4D-2.5"
    neural_shell["generation_uuid"] = "ec8c1ffb-b35c-44f4-a8df-3027346cd87f"
    for obj in [item for item in imported if item.parent not in imported_set]:
        world = obj.matrix_world.copy()
        obj.parent = neural_shell
        obj.matrix_world = world

    target_size = Vector((2.32, 4.90, 4.94))
    target_center = Vector((0.0, 0.0, 2.55))
    # Neural4D's side-view asset uses X=depth, Y=width, Z=height. The training
    # scene uses X=width, Y=depth, Z=height, so rotate once around Z.
    neural_shell.scale = Vector((
        target_size.y / max(source_size.x, 0.0001),
        target_size.x / max(source_size.y, 0.0001),
        target_size.z / max(source_size.z, 0.0001),
    ))
    neural_shell.rotation_euler.z = -pi / 2
    scaled_center = Vector((
        source_center.x * neural_shell.scale.x,
        source_center.y * neural_shell.scale.y,
        source_center.z * neural_shell.scale.z,
    ))
    rotated_center = Vector((scaled_center.y, -scaled_center.x, scaled_center.z))
    neural_shell.location = target_center - rotated_center

    for index, obj in enumerate(meshes):
        obj.name = f"neural4d_case_detail_{index:02d}"
        obj["neural4d_asset"] = True
        for polygon in obj.data.polygons:
            polygon.use_smooth = True

    preserved_prefixes = (
        "front_fan_", "rear_fan", "motherboard_tray", "psu_shroud",
        "rear_io_opening", "expansion_slot_", "case_glass_",
    )
    procedural_objects = [
        obj for obj in list(case_root.children)
        if obj is not neural_shell and not obj.name.startswith(preserved_prefixes)
    ]
    procedural_shell = root("procedural_case_shell")
    procedural_shell.parent = case_root
    for obj in procedural_objects:
        world = obj.matrix_world.copy()
        obj.parent = procedural_shell
        obj.matrix_world = world

    optimized_faces = sum(len(obj.data.polygons) for obj in meshes)
    print(f"NEURAL4D_CASE: imported {source_faces} faces, optimized to {optimized_faces}")


def finish(obj, name, mat, parent=None, bevel=0.02):
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    if bevel > 0:
        mod = obj.modifiers.new("precision_edge", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    if parent:
        obj.parent = parent
    return obj


def box(name, loc, dims, mat, parent=None, bevel=0.02, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.scale = (dims[0] / 2, dims[1] / 2, dims[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, parent, bevel)


def cylinder(name, loc, radius, depth, mat, parent=None, rotation=(0, 0, 0), vertices=32, bevel=0.012):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    return finish(bpy.context.object, name, mat, parent, bevel)


def torus(name, loc, major, minor, mat, parent=None, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=40,
        minor_segments=8,
        location=loc,
        rotation=rotation,
    )
    return finish(bpy.context.object, name, mat, parent, 0)


def text_label(name, body, loc, size, mat, parent, rotation=(pi / 2, 0, pi / 2), extrude=0.006):
    """Small raised product marking that survives the glTF export as geometry."""
    bpy.ops.object.text_add(location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = extrude
    obj.data.bevel_depth = extrude * 0.28
    obj.data.bevel_resolution = 1
    obj.data.materials.append(mat)
    obj.name = name
    obj.parent = parent
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    return obj


def fan_blade(name, center, radius, depth, angle, mat, parent, normal):
    """Create a swept axial-fan vane instead of a rectangular placeholder."""
    inner = radius * 0.19
    outer = radius * 0.82
    profile = (
        (inner, angle - 0.34),
        (inner * 1.42, angle + 0.22),
        (outer, angle + 0.48),
        (outer * 0.92, angle - 0.04),
    )
    half = depth * 0.34
    vertices = []
    for offset in (-half, half):
        for distance, theta in profile:
            a = cos(theta) * distance
            b = sin(theta) * distance
            if normal == "x":
                vertices.append((offset, a, b))
            elif normal == "y":
                vertices.append((a, offset, b))
            else:
                vertices.append((a, b, offset))
    faces = [
        (0, 1, 2, 3), (7, 6, 5, 4),
        (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0),
    ]
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = center
    return finish(obj, name, mat, parent, 0.012)


def cable_segment(name, start, end, radius, mat, parent):
    start_v = Vector(start)
    end_v = Vector(end)
    midpoint = (start_v + end_v) / 2
    direction = end_v - start_v
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=radius, depth=direction.length, location=midpoint)
    obj = bpy.context.object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    return finish(obj, name, mat, parent, 0.008)


def cable_path(name, points, radius, mat, parent):
    for index in range(len(points) - 1):
        cable_segment(f"{name}_{index:02d}", points[index], points[index + 1], radius, mat, parent)


def fan(name, center, radius, depth, frame_mat, blade_mat, parent, normal="x", blades=7):
    rotation = (0, pi / 2, 0) if normal == "x" else (pi / 2, 0, 0) if normal == "y" else (0, 0, 0)
    torus(f"{name}_ring", center, radius, radius * 0.055, frame_mat, parent, rotation)
    torus(f"{name}_barrier_ring", center, radius * 0.87, radius * 0.018, frame_mat, parent, rotation)
    cylinder(f"{name}_hub", center, radius * 0.19, depth * 1.02, frame_mat, parent, rotation, 40, 0.018)
    for index in range(blades):
        angle = index * (2 * pi / blades)
        fan_blade(f"{name}_blade_{index:02d}", center, radius, depth, angle, blade_mat, parent, normal)


clean_scene()

MAT = {
    "case": material("CASE anodized graphite", (0.065, 0.075, 0.078), 0.78, 0.25),
    "case_edge": material("CASE machined edge", (0.16, 0.18, 0.18), 0.9, 0.18),
    "black": material("POLYMER soft black", (0.018, 0.022, 0.024), 0.15, 0.46),
    "pcb": material("PCB deep teal", (0.018, 0.095, 0.085), 0.32, 0.32),
    "pcb_black": material("PCB graphite", (0.025, 0.032, 0.033), 0.3, 0.34),
    "silver": material("METAL brushed aluminum", (0.43, 0.47, 0.47), 0.88, 0.2),
    "dark_silver": material("METAL gunmetal", (0.16, 0.19, 0.19), 0.84, 0.24),
    "gold": material("CONTACT gold", (0.72, 0.45, 0.07), 0.82, 0.2),
    "copper": material("THERMAL copper", (0.58, 0.20, 0.07), 0.82, 0.22),
    "white": material("LABEL ceramic", (0.74, 0.80, 0.79), 0.1, 0.42),
    "mint": material("LED_MINT status", (0.08, 0.82, 0.62), 0.2, 0.18),
    "amber": material("LED_AMBER diagnostic", (1.0, 0.42, 0.06), 0.15, 0.18),
    "wood": material("BENCH walnut", (0.17, 0.075, 0.035), 0.05, 0.56),
    "rubber": material("RUBBER ESD", (0.025, 0.06, 0.06), 0.0, 0.82),
    "glass": material("GLASS tempered smoked", (0.12, 0.18, 0.18), 0.08, 0.12, 0.24),
    "red": material("MARKER warning", (0.7, 0.055, 0.025), 0.12, 0.36),
    "msi_pcb": material("MSI 8-layer matte black PCB", (0.012, 0.016, 0.017), 0.16, 0.48),
    "msi_armor": material("MSI gunmetal thermal armor", (0.12, 0.135, 0.14), 0.76, 0.24),
    "msi_edge": material("MSI brushed accent", (0.38, 0.42, 0.42), 0.86, 0.17),
    "steel": material("PCIe stainless steel", (0.56, 0.59, 0.59), 0.92, 0.15),
    "capacitor": material("Japanese capacitor black", (0.035, 0.04, 0.043), 0.48, 0.31),
    "coil": material("VRM choke gunmetal", (0.12, 0.125, 0.125), 0.72, 0.27),
    "asus_shroud": material("ASUS Dual polymer", (0.055, 0.06, 0.064), 0.18, 0.29),
    "asus_accent": material("ASUS Dual silver accent", (0.48, 0.50, 0.50), 0.78, 0.18),
    "rgb_diffuser": material("ARGB frosted diffuser", (0.36, 0.82, 0.92), 0.12, 0.16),
    "label_black": material("Product label ink", (0.007, 0.009, 0.01), 0.05, 0.58),
    "nickel": material("Nickel plated copper", (0.53, 0.55, 0.54), 0.92, 0.14),
    "interaction_proxy": material("INTERACTION invisible collider", (0.0, 0.0, 0.0), 0.0, 1.0, 0.001),
}


# Environment and dedicated assembly surface.
environment = root("environment")
box("workbench_top", (0, 0, -0.34), (12.0, 9.0, 0.42), MAT["wood"], environment, 0.09)
box("esd_mat", (0, -3.85, -0.08), (3.35, 3.05, 0.06), MAT["rubber"], environment, 0.025)
for y in (-5.05, -2.66):
    box(f"esd_marker_{y}", (-1.42, y, -0.035), (0.035, 1.85, 0.012), MAT["mint"], environment, 0)

# A smoked side panel rests safely behind the chassis.
box("tempered_glass_panel", (2.1, 3.25, 0.12), (2.15, 4.7, 0.06), MAT["glass"], environment, 0.035, (0, 0.12, -0.11))
for z in (0.02, 0.21):
    cylinder(f"glass_fastener_{z}", (1.25, 2.05 + z, 0.18), 0.045, 0.055, MAT["case_edge"], environment)


# Chassis, always present as the assembly base.
case = root("part_case", "case")
box("case_far_panel", (1.12, 0, 2.55), (0.10, 5.0, 5.08), MAT["case"], case, 0.035)
box("case_top", (0, 0, 5.05), (2.38, 5.0, 0.11), MAT["case"], case, 0.035)
box("case_bottom", (0, 0, 0.10), (2.38, 5.0, 0.18), MAT["case"], case, 0.035)
box("case_rear", (0, 2.46, 2.55), (2.38, 0.10, 5.0), MAT["case"], case, 0.025)
box("motherboard_tray", (0.88, 0.25, 3.0), (0.10, 3.35, 3.75), MAT["dark_silver"], case, 0.02)
box("psu_shroud", (0.15, 0.75, 1.05), (1.92, 3.4, 0.12), MAT["case"], case, 0.025)

# Open-side structural rails and feet.
for y in (-2.45, 2.45):
    box(f"case_vertical_rail_{y}", (-1.1, y, 2.55), (0.14, 0.14, 5.0), MAT["case_edge"], case, 0.025)
for z in (0.16, 4.98):
    box(f"case_long_rail_{z}", (-1.1, 0, z), (0.14, 4.9, 0.14), MAT["case_edge"], case, 0.025)
for x in (-0.82, 0.82):
    for y in (-1.9, 1.9):
        box(f"case_foot_{x}_{y}", (x, y, -0.16), (0.34, 0.48, 0.28), MAT["black"], case, 0.05)

# Aquarium-style tempered glass closes the open side and front while preserving
# a clear view of the assembly. A dark corner post makes the joined panes read
# as a real enclosure rather than two floating transparent planes.
box("case_glass_panel_side", (-1.175, 0.0, 2.62), (0.035, 4.72, 4.55), MAT["glass"], case, 0.008)
box("case_glass_panel_front", (0.0, -2.505, 2.62), (2.22, 0.035, 4.55), MAT["glass"], case, 0.008)
box("case_glass_corner_post", (-1.18, -2.50, 2.62), (0.10, 0.10, 4.72), MAT["case_edge"], case, 0.02)
for z in (0.32, 4.90):
    box(f"case_glass_side_rail_{z}", (-1.18, 0.0, z), (0.10, 4.78, 0.10), MAT["case_edge"], case, 0.015)
    box(f"case_glass_front_rail_{z}", (0.0, -2.51, z), (2.28, 0.10, 0.10), MAT["case_edge"], case, 0.015)

# Front wood-airflow treatment and case fans.
for index in range(13):
    x = -1.02 + index * 0.17
    box(f"front_wood_slat_{index:02d}", (x, -2.53, 2.55), (0.085, 0.12, 4.72), MAT["wood"], case, 0.025)
for z in (1.05, 2.55, 4.05):
    fan(f"front_fan_{z}", (0, -2.34, z), 0.56, 0.09, MAT["case_edge"], MAT["black"], case, normal="y")
fan("rear_fan", (0.24, 2.36, 4.08), 0.48, 0.09, MAT["case_edge"], MAT["black"], case, normal="y")

# Rear I/O and expansion slots.
box("rear_io_opening", (0.72, 2.39, 3.75), (0.72, 0.05, 1.2), MAT["black"], case, 0.01)
for index in range(7):
    box(f"expansion_slot_{index:02d}", (-0.48, 2.39, 1.25 + index * 0.21), (0.88, 0.06, 0.12), MAT["silver"], case, 0.008)


# MSI MAG B850 TOMAHAWK MAX WIFI. The 243.84 x 304.8 mm ATX outline,
# integrated I/O armor, long VRM sink, four M.2 shields and three full-length
# slots follow MSI's product layout instead of using a generic green board.
motherboard = root("part_motherboard", "motherboard")
motherboard["product_model"] = "MSI MAG B850 TOMAHAWK MAX WIFI"
motherboard["reference_dimensions_mm"] = "243.84 x 304.8"
box("motherboard_pcb", (0.79, 0.22, 3.0), (0.075, 2.4384, 3.048), MAT["msi_pcb"], motherboard, 0.018)

# Nine plated ATX mounting points.
screw_points = [
    (-0.82, 4.25), (0.18, 4.25), (1.10, 4.25),
    (-0.82, 3.0), (0.18, 3.0), (1.10, 3.0),
    (-0.82, 1.72), (0.18, 1.72), (1.10, 1.72),
]
for index, (y, z) in enumerate(screw_points):
    torus(f"atx_mount_{index:02d}", (0.742, y, z), 0.055, 0.018, MAT["gold"], motherboard, (0, pi / 2, 0))

# AM5 socket, retention frame, 14+2 power stages and extended thermal armor.
box("am5_socket_base", (0.70, -0.26, 3.66), (0.16, 0.64, 0.64), MAT["black"], motherboard, 0.025)
box("am5_socket_frame", (0.59, -0.26, 3.66), (0.06, 0.72, 0.72), MAT["silver"], motherboard, 0.025)
box("vrm_heatsink_top", (0.59, -0.12, 4.43), (0.35, 1.52, 0.36), MAT["msi_armor"], motherboard, 0.055)
box("vrm_heatsink_top_cap", (0.405, -0.12, 4.43), (0.028, 1.23, 0.13), MAT["msi_edge"], motherboard, 0.008)
box("vrm_heatsink_side", (0.59, 0.78, 3.92), (0.35, 0.34, 1.34), MAT["msi_armor"], motherboard, 0.055)
box("io_armor", (0.55, 1.18, 4.00), (0.45, 0.43, 1.04), MAT["msi_armor"], motherboard, 0.055)
box("io_armor_silver_line", (0.315, 1.17, 3.98), (0.018, 0.34, 0.72), MAT["msi_edge"], motherboard, 0.006, (0.18, 0, 0))
for index in range(14):
    y = -0.80 + index * 0.105
    box(f"vrm_choke_top_{index:02d}", (0.675, y, 4.19), (0.12, 0.072, 0.10), MAT["coil"], motherboard, 0.012)
    cylinder(f"vrm_cap_top_{index:02d}", (0.67, y, 4.03), 0.034, 0.13, MAT["capacitor"], motherboard, (0, pi / 2, 0), 20, 0.004)
for index in range(7):
    z = 3.26 + index * 0.13
    box(f"vrm_choke_side_{index:02d}", (0.675, 0.55, z), (0.12, 0.085, 0.10), MAT["coil"], motherboard, 0.012)

# Four DDR5 slots with individual latches.
for index, y in enumerate((-1.02, -0.78, -0.54, -0.30)):
    box(f"dimm_slot_{index}", (0.67, y, 3.35), (0.17, 0.082, 1.63), MAT["black"], motherboard, 0.010)
    box(f"dimm_latch_top_{index}", (0.64, y, 4.22), (0.21, 0.13, 0.10), MAT["white"] if index in (1, 3) else MAT["black"], motherboard, 0.012)
    box(f"dimm_latch_bottom_{index}", (0.64, y, 2.48), (0.21, 0.13, 0.10), MAT["black"], motherboard, 0.012)

# Steel Armor II primary PCIe 5.0 slot plus secondary expansion slots.
for index, z in enumerate((2.52, 1.92, 1.48)):
    slot_width = 1.96 if index == 0 else 1.62
    box(f"pcie_slot_{index}", (0.67, 0.08, z), (0.15, slot_width, 0.105), MAT["steel"] if index == 0 else MAT["black"], motherboard, 0.010)
    if index == 0:
        box("pcie_slot_inner_black", (0.575, 0.08, z), (0.035, slot_width - 0.10, 0.055), MAT["black"], motherboard, 0.004)
        box("pcie_ez_release", (0.59, -0.95, z), (0.22, 0.18, 0.16), MAT["mint"], motherboard, 0.025)

# Four distinct EZ M.2 Shield Frozr covers and the lower chipset sink.
for index, (y, z, length) in enumerate(((0.05, 2.82, 1.80), (0.25, 2.22, 1.66), (0.10, 1.67, 1.78), (0.58, 1.23, 0.86))):
    box(f"m2_shield_{index}", (0.55, y, z), (0.26, length, 0.25), MAT["msi_armor"], motherboard, 0.035)
    box(f"m2_shield_edge_{index}", (0.405, y - length * 0.28, z + 0.07), (0.018, length * 0.30, 0.045), MAT["msi_edge"], motherboard, 0.004)
box("chipset_heatsink", (0.53, -0.66, 1.46), (0.30, 0.68, 0.62), MAT["msi_armor"], motherboard, 0.075)
box("chipset_badge", (0.365, -0.66, 1.46), (0.018, 0.38, 0.27), MAT["label_black"], motherboard, 0.012)

# Main, CPU and supplemental PCIe power headers plus SATA and fan headers.
box("atx_24pin_header", (0.61, -1.00, 2.98), (0.29, 0.18, 0.76), MAT["black"], motherboard, 0.018)
for index, y in enumerate((0.84, 1.12)):
    box(f"cpu_8pin_header_{index}", (0.62, y, 4.42), (0.28, 0.25, 0.27), MAT["black"], motherboard, 0.018)
for index, z in enumerate((1.62, 1.83, 2.04, 2.25)):
    box(f"sata_port_{index}", (0.61, -1.05, z), (0.25, 0.18, 0.14), MAT["black"], motherboard, 0.012)
for index, y in enumerate((-0.75, -0.48, -0.20, 0.08, 0.36, 0.64)):
    box(f"system_fan_header_{index}", (0.63, y, 1.53), (0.18, 0.13, 0.10), MAT["black"], motherboard, 0.006)

# Rear I/O connectors: USB, Type-C, HDMI, LAN, Wi-Fi and audio stack.
io_ports = (
    (0.94, 4.17, 0.18, 0.17, MAT["red"]),
    (1.13, 4.17, 0.16, 0.17, MAT["black"]),
    (0.95, 3.92, 0.17, 0.16, MAT["mint"]),
    (1.16, 3.92, 0.17, 0.16, MAT["mint"]),
    (0.95, 3.68, 0.18, 0.15, MAT["steel"]),
    (1.17, 3.68, 0.16, 0.15, MAT["black"]),
)
for index, (y, z, width, height, mat) in enumerate(io_ports):
    box(f"rear_io_port_{index}", (0.30, y, z), (0.20, width, height), mat, motherboard, 0.010)
for index, z in enumerate((3.42, 3.57, 3.72, 3.87, 4.02)):
    cylinder(f"audio_jack_{index}", (0.28, 1.30, z), 0.048, 0.20, (MAT["red"], MAT["mint"], MAT["black"], MAT["silver"], MAT["amber"])[index], motherboard, (0, pi / 2, 0), 20, 0.004)

# Dense surface population: IC packages, capacitors, debug LEDs and printed IDs.
for index in range(28):
    y = -0.82 + (index % 7) * 0.25
    z = 1.72 + (index // 7) * 0.43
    if -0.65 < y < 0.25 and 3.24 < z < 4.05:
        continue
    cylinder(f"board_cap_{index:02d}", (0.65, y, z), 0.030, 0.13, MAT["capacitor"], motherboard, (0, pi / 2, 0), 18, 0.004)
for index in range(20):
    y = -0.86 + (index % 5) * 0.38
    z = 1.66 + (index // 5) * 0.39
    box(f"board_ic_{index:02d}", (0.64, y, z), (0.10, 0.13, 0.12), MAT["black"], motherboard, 0.006)
for index, z in enumerate((4.30, 4.36, 4.42, 4.48)):
    box(f"ez_debug_led_{index}", (0.54, -1.03, z), (0.10, 0.055, 0.038), MAT["mint"] if index == 0 else MAT["amber"], motherboard, 0.006)
text_label("msi_mag_label", "MAG", (0.34, 0.85, 4.36), 0.16, MAT["white"], motherboard, (pi / 2, 0, -pi / 2), 0.004)
text_label("msi_tomahawk_label", "TOMAHAWK", (0.35, 0.38, 2.22), 0.085, MAT["white"], motherboard, (pi / 2, 0, -pi / 2), 0.003)
text_label("msi_b850_label", "B850", (0.34, -0.66, 1.47), 0.105, MAT["white"], motherboard, (pi / 2, 0, -pi / 2), 0.003)


# AMD Ryzen 5 9600X AM5 package with the recognizable notched IHS silhouette.
cpu = root("part_cpu", "cpu")
cpu["product_model"] = "AMD Ryzen 5 9600X"
box("cpu_substrate", (0.51, -0.26, 3.66), (0.055, 0.42, 0.42), MAT["pcb"], cpu, 0.020)
box("cpu_heat_spreader_center", (0.455, -0.26, 3.66), (0.068, 0.30, 0.30), MAT["nickel"], cpu, 0.025)
for index, (y, z, dy, dz) in enumerate((
    (-0.26, 3.47, 0.18, 0.10), (-0.26, 3.85, 0.18, 0.10),
    (-0.45, 3.66, 0.10, 0.18), (-0.07, 3.66, 0.10, 0.18),
    (-0.40, 3.52, 0.08, 0.08), (-0.12, 3.52, 0.08, 0.08),
    (-0.40, 3.80, 0.08, 0.08), (-0.12, 3.80, 0.08, 0.08),
)):
    box(f"cpu_ihs_lobe_{index}", (0.455, y, z), (0.068, dy, dz), MAT["nickel"], cpu, 0.012)
box("cpu_orientation_marker", (0.413, -0.445, 3.475), (0.010, 0.065, 0.065), MAT["amber"], cpu, 0.004, (pi / 4, 0, 0))
text_label("cpu_ryzen_label", "RYZEN", (0.412, -0.26, 3.67), 0.065, MAT["label_black"], cpu, (pi / 2, 0, -pi / 2), 0.0015)


# SK hynix Platinum P41 2TB M.2 2280 NVMe drive.
ssd = root("part_ssd", "ssd")
ssd["product_model"] = "SK hynix Platinum P41 2TB"
box("ssd_pcb", (0.52, 0.30, 2.83), (0.045, 0.80, 0.22), MAT["pcb_black"], ssd, 0.018)
for index, y in enumerate((0.04, 0.25, 0.47)):
    box(f"ssd_nand_{index}", (0.485, y, 2.83), (0.035, 0.15, 0.15), MAT["black"], ssd, 0.008)
box("ssd_controller", (0.482, 0.66, 2.83), (0.04, 0.11, 0.11), MAT["silver"], ssd, 0.008)
box("ssd_product_label", (0.456, 0.35, 2.83), (0.010, 0.40, 0.18), MAT["white"], ssd, 0.008)
text_label("ssd_p41_label", "P41 2TB", (0.446, 0.35, 2.83), 0.045, MAT["label_black"], ssd, (pi / 2, 0, -pi / 2), 0.001)
for index in range(9):
    box(f"ssd_contact_{index}", (0.48, -0.097 + index * 0.014, 2.83), (0.01, 0.008, 0.14), MAT["gold"], ssd, 0)
torus("ssd_mount_hole", (0.485, 0.69, 2.83), 0.025, 0.009, MAT["gold"], ssd, (0, pi / 2, 0))


# Kingston FURY Beast RGB DDR5 kit. Manufacturer dimensions are represented at
# 133.35 x 42.23 x 7.11 mm with the characteristic split heat spreader and
# continuous diffused light bar.
for suffix, y in (("a", -0.78), ("b", -0.30)):
    ram = root(f"part_ram_{suffix}", "ram")
    ram["product_model"] = "Kingston FURY Beast RGB DDR5"
    ram["reference_dimensions_mm"] = "133.35 x 42.23 x 7.11"
    box(f"ram_{suffix}_pcb", (0.43, y, 3.47), (0.35, 0.071, 1.3335), MAT["pcb_black"], ram, 0.010)
    box(f"ram_{suffix}_spreader_lower", (0.30, y, 3.31), (0.34, 0.095, 0.78), MAT["dark_silver"], ram, 0.025)
    box(f"ram_{suffix}_spreader_upper_a", (0.27, y, 3.77), (0.39, 0.095, 0.46), MAT["msi_armor"], ram, 0.025, (0, -0.08, 0))
    box(f"ram_{suffix}_spreader_upper_b", (0.31, y, 3.95), (0.31, 0.095, 0.28), MAT["dark_silver"], ram, 0.020, (0, 0.10, 0))
    for index in range(5):
        box(f"ram_{suffix}_chevron_{index}", (0.087, y - 0.051, 3.08 + index * 0.21), (0.018, 0.012, 0.14), MAT["label_black"], ram, 0.003, (0, 0.35 if index % 2 else -0.35, 0))
    for index in range(16):
        z = 2.84 + index * 0.078
        box(f"ram_{suffix}_contact_{index:02d}", (0.43, y, z), (0.030, 0.078, 0.050), MAT["gold"], ram, 0)
    box(f"ram_{suffix}_lightbar", (0.20, y, 4.115), (0.39, 0.085, 0.105), MAT["rgb_diffuser"], ram, 0.025)
    for index, z in enumerate((3.02, 3.26, 3.50, 3.74, 3.96)):
        box(f"ram_{suffix}_spreader_notch_{index}", (0.085, y, z), (0.030, 0.12, 0.055), MAT["label_black"], ram, 0.006)
    text_label(f"ram_{suffix}_fury_label", "FURY", (0.072, y - 0.052, 3.58), 0.105, MAT["white"], ram, (pi / 2, 0, -pi / 2), 0.0025)


# Thermalright Peerless Assassin 120 SE ARGB: 125 x 110 x 155 mm dual tower,
# six 6 mm nickel-plated heat pipes and two 120 x 25 mm fans.
cooler = root("part_cooler", "cooler")
cooler["product_model"] = "Thermalright Peerless Assassin 120 SE ARGB"
cooler["reference_dimensions_mm"] = "125 x 110 x 155"
box("interaction_proxy_cooler", (-0.40, -0.34, 3.69), (1.50, 1.14, 1.28), MAT["interaction_proxy"], cooler, 0.012)
for tower_index, tower_y in enumerate((-0.56, 0.04)):
    for index in range(38):
        z = 3.10 + index * 0.031
        box(f"cooler_tower_{tower_index}_fin_{index:02d}", (-0.40, tower_y, z), (1.42, 0.46, 0.012), MAT["silver"], cooler, 0.002)
    box(f"cooler_tower_{tower_index}_top", (-0.40, tower_y, 4.28), (1.44, 0.47, 0.025), MAT["msi_edge"], cooler, 0.006)
    for notch_index, x in enumerate((-1.02, -0.82, 0.02, 0.22)):
        box(f"cooler_tower_{tower_index}_edge_{notch_index}", (x, tower_y, 3.69), (0.06, 0.48, 1.10), MAT["dark_silver"], cooler, 0.008)

# Six U-shaped pipe lanes on both sides of the cold plate.
for pipe_index, y in enumerate((-0.72, -0.54, -0.36, -0.18, 0.00, 0.18)):
    cable_path(
        f"cooler_heatpipe_{pipe_index}",
        ((0.30, y, 3.55), (0.13, y, 3.25), (-0.34, y, 3.10), (-1.02, y, 3.16)),
        0.030,
        MAT["nickel"],
        cooler,
    )
    cylinder(f"cooler_pipe_cap_{pipe_index}", (-1.115, y, 3.18), 0.038, 0.08, MAT["nickel"], cooler, (0, pi / 2, 0), 20, 0.005)
box("cooler_coldplate", (0.32, -0.26, 3.66), (0.16, 0.68, 0.62), MAT["nickel"], cooler, 0.025)
box("cooler_mount_bar", (0.37, -0.26, 3.66), (0.11, 0.92, 0.15), MAT["steel"], cooler, 0.018)
for screw_y in (-0.65, 0.13):
    cylinder(f"cooler_mount_screw_{screw_y}", (0.29, screw_y, 3.66), 0.055, 0.20, MAT["steel"], cooler, (0, pi / 2, 0), 24, 0.006)

# Front and center ARGB fans; the second fan is visible through the fin gap.
for index, y in enumerate((-0.88, -0.25)):
    for side, x in enumerate((-0.94, 0.14)):
        box(f"cooler_fan_frame_{index}_vertical_{side}", (x, y, 3.69), (0.10, 0.16, 1.20), MAT["black"], cooler, 0.025)
    for side, z in enumerate((3.15, 4.23)):
        box(f"cooler_fan_frame_{index}_horizontal_{side}", (-0.40, y, z), (1.20, 0.16, 0.10), MAT["black"], cooler, 0.025)
    fan(f"cooler_fan_{index}", (-0.40, y - 0.09, 3.69), 0.525, 0.13, MAT["rgb_diffuser"], MAT["black"], cooler, normal="y", blades=9)
text_label("cooler_thermalright_label", "THERMALRIGHT", (-1.145, -0.25, 3.88), 0.075, MAT["white"], cooler, (pi / 2, 0, -pi / 2), 0.0025)


# CORSAIR RM850e ATX 3.1. Its compact 140 x 150 x 86 mm enclosure, 120 mm
# intake fan, modular connector bank and rear exhaust are modeled explicitly.
psu = root("part_psu", "psu")
psu["product_model"] = "CORSAIR RM850e ATX 3.1"
psu["reference_dimensions_mm"] = "140 x 150 x 86"
box("psu_body", (0, 1.02, 0.66), (1.50, 1.40, 0.86), MAT["case"], psu, 0.045)
box("psu_top_inset", (0, 1.02, 1.095), (1.28, 1.18, 0.025), MAT["label_black"], psu, 0.018)
fan("psu_fan", (0, 1.02, 1.12), 0.535, 0.055, MAT["case_edge"], MAT["black"], psu, normal="z", blades=9)
for ring_index, radius in enumerate((0.18, 0.30, 0.42, 0.55)):
    torus(f"psu_fan_guard_ring_{ring_index}", (0, 1.02, 1.158), radius, 0.012, MAT["steel"], psu)
for index in range(8):
    angle = index * pi / 4
    start = (cos(angle) * 0.12, 1.02 + sin(angle) * 0.12, 1.16)
    end = (cos(angle) * 0.56, 1.02 + sin(angle) * 0.56, 1.16)
    cable_segment(f"psu_fan_guard_spoke_{index}", start, end, 0.011, MAT["steel"], psu)

# Rear AC input, rocker switch and hexagonal exhaust field.
box("psu_rear_grid", (0, 1.735, 0.66), (1.40, 0.035, 0.76), MAT["dark_silver"], psu, 0.012)
for row, z in enumerate((0.39, 0.52, 0.65, 0.78, 0.91)):
    for col in range(8):
        x = -0.56 + col * 0.16 + (0.08 if row % 2 else 0)
        cylinder(f"psu_exhaust_{row}_{col}", (x, 1.758, z), 0.035, 0.045, MAT["black"], psu, (pi / 2, 0, 0), 6, 0.003)
box("psu_ac_socket", (0.45, 1.78, 0.45), (0.43, 0.08, 0.27), MAT["black"], psu, 0.018)
for index, x in enumerate((0.34, 0.45, 0.56)):
    box(f"psu_ac_pin_{index}", (x, 1.83, 0.45 + (0.07 if index == 1 else -0.03)), (0.035, 0.025, 0.10), MAT["steel"], psu, 0.003)
box("psu_switch", (-0.48, 1.79, 0.42), (0.25, 0.10, 0.15), MAT["red"], psu, 0.018)

# Fully modular Type-4 connector face.
for row, z in enumerate((0.48, 0.70, 0.91)):
    for col, x in enumerate((-0.55, -0.28, 0.00, 0.28, 0.55)):
        if row == 2 and col in (0, 4):
            continue
        width = 0.25 if row < 2 else 0.34
        box(f"psu_modular_port_{row}_{col}", (x, 0.305, z), (width, 0.075, 0.15), MAT["black"], psu, 0.012)
        for pin in range(4 if width > 0.30 else 3):
            cylinder(f"psu_modular_pin_{row}_{col}_{pin}", (x - width * 0.27 + pin * width * 0.18, 0.258, z), 0.013, 0.03, MAT["label_black"], psu, (pi / 2, 0, 0), 10, 0.002)

# Side certification plate and embossed product identification.
box("psu_rating_label", (-0.758, 1.02, 0.66), (0.018, 0.94, 0.56), MAT["white"], psu, 0.006)
box("psu_label_black_band", (-0.770, 1.02, 0.66), (0.010, 0.84, 0.19), MAT["label_black"], psu, 0.002)
text_label("psu_corsair_label", "CORSAIR", (-0.784, 1.02, 0.81), 0.090, MAT["label_black"], psu, (pi / 2, 0, -pi / 2), 0.0025)
text_label("psu_rm850e_label", "RM850e", (-0.786, 1.02, 0.66), 0.115, MAT["white"], psu, (pi / 2, 0, -pi / 2), 0.003)
text_label("psu_850w_label", "850 W", (-0.784, 1.02, 0.49), 0.080, MAT["label_black"], psu, (pi / 2, 0, -pi / 2), 0.002)


# ASUS DUAL GeForce RTX 4070 OC: 267.01 x 133.94 x 51.13 mm, two Axial-tech
# fans and a 2.56-slot shroud. This is intentionally a product-specific hero
# mesh rather than the former stretched three-fan placeholder.
gpu = root("part_gpu", "gpu")
gpu["product_model"] = "ASUS DUAL GeForce RTX 4070 OC"
gpu["reference_dimensions_mm"] = "267.01 x 133.94 x 51.13"
box("gpu_pcb", (-0.015, 0.15, 2.13), (0.085, 2.52, 0.92), MAT["pcb_black"], gpu, 0.018)
box("gpu_backplate", (0.125, 0.15, 2.15), (0.155, 2.67, 1.22), MAT["dark_silver"], gpu, 0.035)
box("gpu_backplate_center", (0.045, 0.10, 2.15), (0.025, 1.42, 0.68), MAT["label_black"], gpu, 0.018)
for index in range(7):
    box(f"gpu_backplate_vent_{index}", (0.035, 1.05 + index * 0.075, 2.19), (0.018, 0.038, 0.55), MAT["black"], gpu, 0.004, (0.06 * (index % 2), 0, 0))

# Visible heatsink stack and nickel heat pipes under the open-edged shroud.
for index in range(34):
    y = -1.12 + index * 0.067
    box(f"gpu_heatsink_fin_{index:02d}", (-0.20, y, 2.13), (0.38, 0.018, 1.04), MAT["silver"], gpu, 0.003)
for index, z in enumerate((1.83, 1.94, 2.05, 2.16)):
    cylinder(f"gpu_heatpipe_{index}", (-0.24 - index * 0.035, 0.15, z), 0.030, 2.27, MAT["nickel"], gpu, (pi / 2, 0, 0), 18, 0.005)

# Angular DUAL shroud with two 100 mm-class Axial-tech fan assemblies.
box("gpu_shroud_center", (-0.405, 0.15, 2.14), (0.43, 2.64, 1.30), MAT["asus_shroud"], gpu, 0.055)
box("gpu_shroud_top_rail", (-0.46, 0.15, 2.76), (0.34, 2.50, 0.11), MAT["asus_accent"], gpu, 0.025)
box("gpu_shroud_bottom_rail", (-0.46, 0.15, 1.52), (0.34, 2.50, 0.10), MAT["asus_shroud"], gpu, 0.025)
for index, (y, rotation) in enumerate(((-0.58, -0.22), (0.82, 0.22))):
    box(f"gpu_asus_silver_sweep_{index}", (-0.64, y, 2.48), (0.035, 0.92, 0.11), MAT["asus_accent"], gpu, 0.025, (rotation, 0, 0))
    box(f"gpu_asus_black_sweep_{index}", (-0.66, y, 1.79), (0.035, 0.88, 0.08), MAT["label_black"], gpu, 0.018, (-rotation, 0, 0))
for y in (-0.50, 0.80):
    fan(f"gpu_fan_{y}", (-0.665, y, 2.14), 0.455, 0.105, MAT["asus_accent"], MAT["black"], gpu, normal="x", blades=9)
    cylinder(f"gpu_fan_badge_{y}", (-0.724, y, 2.14), 0.105, 0.018, MAT["label_black"], gpu, (0, pi / 2, 0), 36, 0.004)
text_label("gpu_asus_label", "ASUS", (-0.738, 0.80, 2.14), 0.070, MAT["white"], gpu, (pi / 2, 0, -pi / 2), 0.0025)
text_label("gpu_dual_label", "DUAL", (-0.700, 0.15, 2.69), 0.105, MAT["white"], gpu, (pi / 2, 0, -pi / 2), 0.003)

# PCIe fingers, stainless bracket, display outputs and single 8-pin power input.
for index in range(22):
    y = -1.00 + index * 0.095
    box(f"gpu_contact_{index:02d}", (0.02, y, 1.62), (0.085, 0.060, 0.075), MAT["gold"], gpu, 0)
box("gpu_io_bracket", (-0.12, 1.52, 2.15), (1.00, 0.075, 1.32), MAT["steel"], gpu, 0.015)
for index, z in enumerate((1.82, 2.07, 2.32, 2.57)):
    box(f"gpu_display_port_{index}", (-0.34, 1.565, z), (0.30, 0.045, 0.125), MAT["black"], gpu, 0.006)
for row in range(5):
    for col in range(3):
        cylinder(f"gpu_bracket_vent_{row}_{col}", (0.16 - col * 0.17, 1.565, 1.76 + row * 0.21), 0.025, 0.08, MAT["black"], gpu, (pi / 2, 0, 0), 14, 0.003)
box("gpu_power_header", (-0.02, -0.63, 2.80), (0.25, 0.38, 0.18), MAT["black"], gpu, 0.014)
for row in range(2):
    for col in range(4):
        cylinder(f"gpu_power_pin_{row}_{col}", (-0.16, -0.76 + col * 0.083, 2.76 + row * 0.075), 0.018, 0.04, MAT["label_black"], gpu, (0, pi / 2, 0), 12, 0.002)
box("gpu_status_led", (-0.17, -0.83, 2.83), (0.035, 0.08, 0.035), MAT["amber"], gpu, 0.006)
text_label("gpu_geforce_top_label", "GEFORCE RTX", (-0.16, 0.42, 2.825), 0.105, MAT["white"], gpu, (0, 0, 0), 0.003)


# Power cable set. Keep the compact, uninstalled kit separate from the routed
# cables so the workbench never shows the final harness floating through the PC.
cables = root("part_cables", "cables")
installed_cables = root("cable_installed_routes")
installed_cables.parent = cables
for lane in range(5):
    offset = lane * 0.035
    cable_path(
        f"atx24_lane_{lane}",
        [(-0.42 + offset, 0.22, 0.72), (-0.7 + offset, -0.25, 1.2), (-0.72 + offset, -0.65, 2.15), (0.48 + offset, -0.96, 2.78)],
        0.022,
        MAT["black"],
        installed_cables,
    )
for lane in range(3):
    offset = lane * 0.038
    cable_path(
        f"eps8_lane_{lane}",
        [(0.0 + offset, 0.22, 0.72), (0.7 + offset, 1.35, 1.45), (0.75 + offset, 1.22, 3.85), (0.50 + offset, 0.91, 4.43)],
        0.022,
        MAT["black"],
        installed_cables,
    )
for lane in range(4):
    offset = lane * 0.034
    cable_path(
        f"gpu12_lane_{lane}",
        [(0.42 + offset, 0.22, 0.72), (0.28 + offset, -0.75, 1.10), (0.15 + offset, -1.10, 2.25), (-0.05 + offset, -1.20, 2.73)],
        0.022,
        MAT["black"],
        installed_cables,
    )
box("atx24_connector", (0.43, -0.98, 2.78), (0.26, 0.20, 0.70), MAT["black"], installed_cables, 0.018)
box("eps8_connector", (0.45, 0.91, 4.43), (0.27, 0.34, 0.26), MAT["black"], installed_cables, 0.018)
box("gpu12_connector", (-0.05, -1.20, 2.73), (0.25, 0.42, 0.18), MAT["black"], installed_cables, 0.018)

# Three neatly tied coils are the draggable source state. Their combined center
# matches the routed harness center, so the established drag target stays valid.
loose_cables = root("cable_loose_bundle")
loose_cables.parent = cables
for cable_index, center_x in enumerate((-0.48, 0.0, 0.48)):
    for loop_index, loop_radius in enumerate((0.21, 0.26, 0.31)):
        torus(
            f"cable_loose_{cable_index}_loop_{loop_index}",
            (center_x, 0.0, 2.58 + loop_index * 0.018),
            loop_radius,
            0.026,
            MAT["black"],
            loose_cables,
        )
    box(f"cable_loose_{cable_index}_strap", (center_x, 0.0, 2.64), (0.12, 0.68, 0.08), MAT["gold"], loose_cables, 0.015)
    connector_y = 0.42 if cable_index % 2 == 0 else -0.42
    box(f"cable_loose_{cable_index}_connector", (center_x, connector_y, 2.62), (0.22, 0.16, 0.15), MAT["black"], loose_cables, 0.018)


# Precision screwdriver and sorted fasteners reinforce the training context.
box("driver_handle", (-2.35, -3.8, 0.05), (0.30, 1.18, 0.28), MAT["black"], environment, 0.12, (0, 0, -0.28))
cylinder("driver_shaft", (-2.03, -3.0, 0.05), 0.035, 1.05, MAT["silver"], environment, (pi / 2, 0, -0.28), 20, 0.006)
for index in range(9):
    x = 2.65 + (index % 3) * 0.18
    y = -3.95 + (index // 3) * 0.18
    cylinder(f"atx_screw_loose_{index:02d}", (x, y, 0.02), 0.055, 0.08, MAT["dark_silver"], environment, (0, 0, 0), 20, 0.005)


# Neural4D supplies the high-frequency exterior geometry and PBR texture set.
# Assembly-critical internals and animated fans remain deterministic above.
integrate_neural4d_case(case)


# Use smooth shading for circular hardware while keeping machined edges crisp.
for obj in bpy.context.scene.objects:
    if obj.type == "MESH" and ("fan" in obj.name or "cap" in obj.name or "cable" in obj.name or "heatpipe" in obj.name):
        for polygon in obj.data.polygons:
            polygon.use_smooth = True

bpy.context.scene.unit_settings.system = "METRIC"
bpy.context.scene.unit_settings.scale_length = 0.1

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

print(f"BUILD_LAB_ASSET: {MODEL_PATH}")
print(f"BUILD_LAB_SOURCE: {SOURCE_PATH}")
