"""
Samruk Travel intro airliner, modelled procedurally in Blender.

Run headless with Blender or with the `bpy` Python module:

    blender -b -P tools/blender/build_airliner.py -- out.glb
    python tools/blender/build_airliner.py out.glb      # with `pip install bpy`

Then compress the geometry with Draco (the pip `bpy` build has no Draco bridge):

    python tools/blender/draco_pack.py out.glb assets/intro/airliner.glb

Named nodes are kept, which lets the page spin the fans and blink the lights.

Axes (Blender): +X nose, +Y port wing, +Z up. The glTF exporter turns this into
+X nose, +Y up for three.js. One unit is about 3.8 m; the fuselage is 10 units long.

Every surface is built from dense lofted rings and Catmull-Clark subdivision,
so the silhouettes stay smooth at full-screen size.
"""

import math
import os
import sys

import bpy  # must come first when running as the pip `bpy` module
import bmesh
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
OUT = os.path.abspath(ARGS[0] if ARGS else "airliner.glb")
PREVIEW = os.environ.get("AIRLINER_PREVIEW")  # optional PNG path for a Cycles test render

R = 0.53          # fuselage radius
RZ = 1.04 * R     # fuselage is slightly taller than wide
NOSE_X = 5.0
TAIL_X = -5.0


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


# --------------------------------------------------------------------------- scene

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]


MATS = {}


def material(name, color, metallic=0.0, rough=0.4, coat=0.0, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = srgb(color)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    if coat and "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.08
    if emit:
        b.inputs["Emission Color"].default_value = srgb(emit)
        b.inputs["Emission Strength"].default_value = emit_strength
    MATS[name] = m
    return m


def make_materials():
    material("Paint_White", "#F3F5F8", rough=0.3, coat=0.6)
    material("Paint_Blue", "#0A84A6", rough=0.28, coat=0.6)
    material("Paint_Gold", "#E9B32C", metallic=0.55, rough=0.3, coat=0.4)
    material("Paint_Belly", "#DCE3EA", rough=0.38, coat=0.3)
    material("Glass", "#0B1520", metallic=0.4, rough=0.06, coat=1.0)
    material("Metal_Lip", "#C4CAD1", metallic=1.0, rough=0.2)
    material("Metal_Dark", "#2A2F36", metallic=0.85, rough=0.42)
    material("Fan_Dark", "#14181D", metallic=0.75, rough=0.32)
    material("Panel_Line", "#9AA6B2", rough=0.5)
    material("Light_Red", "#FF2A1F", emit="#FF2A1F", emit_strength=6.0)
    material("Light_Green", "#1FFF6A", emit="#1FFF6A", emit_strength=6.0)
    material("Light_White", "#FFFFFF", emit="#FFFFFF", emit_strength=8.0)


def new_object(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(MATS[m])
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def shade_smooth(ob):
    me = ob.data
    if hasattr(me, "shade_smooth"):
        me.shade_smooth()
    else:
        for p in me.polygons:
            p.use_smooth = True


def apply_subsurf(ob, levels):
    mod = ob.modifiers.new("Subsurf", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels
    mod.quality = 3
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)
    shade_smooth(ob)


def mirror_copy(ob, name):
    """Mirror an object across the XZ plane (port -> starboard)."""
    me = ob.data.copy()
    me.name = name
    for v in me.vertices:
        v.co.y = -v.co.y
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    cp = bpy.data.objects.new(name, me)
    cp.location = ob.location.copy()
    cp.location.y = -cp.location.y
    bpy.context.scene.collection.objects.link(cp)
    return cp


# --------------------------------------------------------------------------- fuselage

def fuselage_section(x):
    """Return (center_z, radius_y, radius_z) of the fuselage cross-section at x."""
    nose0 = 3.75
    tail0 = -1.8
    if x >= nose0:
        s = min(1.0, (x - nose0) / (NOSE_X - nose0))
        k = max(0.0, 1 - s ** 2.35) ** 0.5
        zc = -0.2 * R * s ** 1.6
        return zc, R * k, RZ * k * (1 - 0.05 * s)
    if x <= tail0:
        s = min(1.0, (tail0 - x) / (tail0 - TAIL_X))
        z_top = RZ - 0.28 * R * s ** 1.9
        z_bot = -RZ + 1.62 * R * s ** 1.25
        ry = R * (1 - 0.86 * s ** 1.35)
        return (z_top + z_bot) / 2, ry, (z_top - z_bot) / 2
    return 0.0, R, RZ


def fuselage_stations():
    xs = []
    # dense near the nose and the tail where curvature is high
    for i in range(64):
        t = i / 63
        xs.append(lerp(NOSE_X, 3.6, 1 - (1 - t) ** 2.2))
    for i in range(1, 56):
        xs.append(lerp(3.6, -1.7, i / 55))
    for i in range(1, 66):
        t = i / 65
        xs.append(lerp(-1.7, TAIL_X, t))
    return xs


def windshield_zone(x, y, z, zc):
    """Cockpit glazing. A slanted band seen from the side; where it climbs over the
    nose top it becomes the front panes. Posts split it by angle around the axis."""
    if not (3.97 <= x <= 4.66):
        return False
    z_hi = 0.425 - 0.12 * (x - 4.0)
    z_lo = 0.245 - 0.1 * (x - 4.0)
    if not (z_lo <= z <= z_hi):
        return False
    phi = math.degrees(math.atan2(abs(y), z - zc))
    if phi < 1.6:                    # centre post
        return False
    if 31 < phi < 35.5:              # front / side post
        return False
    if phi >= 35.5 and x > 4.5:      # side panes stop where the front panes start
        return False
    if 4.125 < x < 4.165 and phi > 35:
        return False
    return True


def build_fuselage():
    seg = 128
    xs = fuselage_stations()
    bm = bmesh.new()
    rings = []
    for x in xs[1:]:
        zc, ry, rz = fuselage_section(x)
        ring = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            ring.append(bm.verts.new((x, ry * math.sin(a), zc + rz * math.cos(a))))
        rings.append(ring)
    zc, _, _ = fuselage_section(NOSE_X)
    tip = bm.verts.new((NOSE_X, 0.0, zc))
    for j in range(seg):
        bm.faces.new((tip, rings[0][(j + 1) % seg], rings[0][j]))
    for r0, r1 in zip(rings, rings[1:]):
        for j in range(seg):
            bm.faces.new((r0[j], r0[(j + 1) % seg], r1[(j + 1) % seg], r1[j]))
    # APU exhaust cap
    last = rings[-1]
    zc, _, _ = fuselage_section(TAIL_X)
    inner = bm.verts.new((TAIL_X + 0.06, 0.0, zc))
    for j in range(seg):
        bm.faces.new((last[j], last[(j + 1) % seg], inner))
    bm.normal_update()

    # livery: 0 white, 1 blue swoosh, 2 gold pinstripe, 3 glass, 4 dark (APU), 5 belly grey
    for f in bm.faces:
        c = f.calc_center_median()
        x = c.x
        zc, ry, rz = fuselage_section(max(TAIL_X, min(NOSE_X, x)))
        yn = c.y / max(ry, 1e-4)
        zn = (c.z - zc) / max(rz, 1e-4)
        if x < TAIL_X + 0.1:
            f.material_index = 4
            continue
        # white/blue split sits under the gold pinstripe decal, so its face steps never show
        f.material_index = 1 if zn < swoosh_zn(x) else 0
    ob = new_object("Fuselage", bm, ["Paint_White", "Paint_Blue", "Paint_Gold", "Glass", "Metal_Dark", "Paint_Belly"])
    shade_smooth(ob)
    return ob


def swoosh_zn(x):
    """Normalised height of the white/blue livery split; it climbs over the tail."""
    return -0.42 + 1.62 * smoothstep(-0.6, -4.1, x) - 0.62 * smoothstep(4.25, 4.95, x)


def skin_point(x, phi, off=0.0):
    """Point on the fuselage skin at station x and angle phi (0 = top, +pi/2 = port side)."""
    zc, ry, rz = fuselage_section(x)
    p = Vector((x, ry * math.sin(phi), zc + rz * math.cos(phi)))
    n = Vector((0.0, math.sin(phi) / max(ry, 1e-4), math.cos(phi) / max(rz, 1e-4)))
    # tilt the normal forward/back with the local slope of the section
    zc2, ry2, rz2 = fuselage_section(x + 0.01)
    p2 = Vector((x + 0.01, ry2 * math.sin(phi), zc2 + rz2 * math.cos(phi)))
    t = (p2 - p).normalized()
    side = Vector((0.0, math.cos(phi), -math.sin(phi)))
    n = t.cross(side).normalized()
    if n.dot(Vector((0.0, math.sin(phi), math.cos(phi)))) < 0:
        n = -n
    return p + n * off


def chaikin(poly, it=3, q=0.25):
    """Corner-cutting; a small q keeps straight sides and gives small corner radii."""
    for _ in range(it):
        out = []
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            out.append(((1 - q) * a[0] + q * b[0], (1 - q) * a[1] + q * b[1]))
            out.append((q * a[0] + (1 - q) * b[0], q * a[1] + (1 - q) * b[1]))
        poly = out
    return poly


def skin_strip(name, rows, mat, off=0.0025):
    """A ribbon in (x, phi-degrees) skin space: rows of (x, phi_a, phi_b), both sides."""
    bm = bmesh.new()
    for side in (1, -1):
        prev = None
        for x, pa, pb in rows:
            a = bm.verts.new(skin_point(x, side * math.radians(pa), off))
            b = bm.verts.new(skin_point(x, side * math.radians(pb), off))
            if prev:
                q = (prev[0], a, b, prev[1])
                bm.faces.new(q if side > 0 else q[::-1])
            prev = (a, b)
    bm.normal_update()
    ob = new_object(name, bm, [mat])
    shade_smooth(ob)
    return ob


def skin_decal(name, polys, mat, off=0.0035, subdiv=3):
    """Polygons given in (x, phi-degrees) skin space, mirrored to both sides and wrapped
    exactly onto the analytic fuselage surface."""
    bm = bmesh.new()
    for poly in polys:
        for side in (1, -1):
            vs = [bm.verts.new((px, side * ph, 0.0)) for px, ph in poly]
            f = bm.faces.new(vs if side > 0 else vs[::-1])
            res = bmesh.ops.triangulate(bm, faces=[f])
            faces = res["faces"]
            for _ in range(subdiv):
                edges = list({e for fc in faces for e in fc.edges})
                r2 = bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=True)
                newf = [g for g in r2["geom"] if isinstance(g, bmesh.types.BMFace)]
                faces = list(set(faces) | set(newf))
                faces = [fc for fc in faces if fc.is_valid]
                faces = bmesh.ops.triangulate(bm, faces=faces)["faces"]
    for v in bm.verts:
        x, ph = v.co.x, math.radians(v.co.y)
        v.co = skin_point(x, ph, off)
    bm.normal_update()
    ob = new_object(name, bm, [mat])
    shade_smooth(ob)
    return ob


def build_cockpit():
    """Windshield and side windows as crisp decals in (x, phi) skin space."""
    panes = [
        [(4.475, 3.0), (4.655, 3.0), (4.64, 31.5), (4.455, 33.0)],
        [(4.255, 37.0), (4.44, 37.5), (4.5, 62.0), (4.27, 66.0)],
        [(4.04, 41.0), (4.215, 38.5), (4.225, 66.5), (4.05, 68.0)],
    ]
    return skin_decal("Cockpit", [chaikin(p, 3, 0.16) for p in panes], "Glass", 0.003, 2)


def build_pinstripe():
    """Gold pinstripe that follows the swoosh line from nose to the top of the tail."""
    rows = []
    for i in range(241):
        x = lerp(4.9, -4.05, i / 240)
        zn = swoosh_zn(x)
        taper = smoothstep(4.9, 4.5, x) * smoothstep(-4.05, -3.7, x)
        hw = 0.05 * taper + 0.002
        a1 = math.degrees(math.acos(max(-1.0, min(1.0, zn + hw))))
        a2 = math.degrees(math.acos(max(-1.0, min(1.0, zn - hw))))
        rows.append((x, a1, a2))
    return skin_strip("Pinstripe", rows, "Paint_Gold")


def surface_point(x, zn, side):
    """A point on the fuselage skin at station x, normalised height zn, side +1/-1."""
    zc, ry, rz = fuselage_section(x)
    z = zc + rz * zn
    y = side * ry * math.sqrt(max(0.0, 1 - zn * zn))
    return Vector((x, y, z))


def build_windows():
    bm = bmesh.new()
    zn = 0.3
    pitch = 0.104
    xs = [3.1 - i * pitch for i in range(56)]
    xs = [x for x in xs if not (-2.95 < x < -2.6) and not (0.15 < x < 0.42)]
    w, h, seg = 0.034, 0.05, 16
    for side in (1, -1):
        for x in xs:
            c = surface_point(x, zn, side)
            n = Vector((0, c.y, c.z - fuselage_section(x)[0])).normalized()
            up = Vector((0, 0, 1))
            up = (up - n * up.dot(n)).normalized()
            fwd = Vector((1, 0, 0))
            ring = []
            for k in range(seg):
                a = 2 * math.pi * k / seg
                # rounded rectangle via superellipse
                ca, sa = math.cos(a), math.sin(a)
                px = w * math.copysign(abs(ca) ** 0.6, ca)
                pz = h * math.copysign(abs(sa) ** 0.6, sa)
                p = c + fwd * px + up * pz + n * 0.004
                ring.append(bm.verts.new(p))
            cen = bm.verts.new(c + n * 0.0055)
            for k in range(seg):
                if side > 0:
                    bm.faces.new((cen, ring[k], ring[(k + 1) % seg]))
                else:
                    bm.faces.new((cen, ring[(k + 1) % seg], ring[k]))
    ob = new_object("Windows", bm, ["Glass"])
    shade_smooth(ob)
    return ob


def build_doors():
    """Thin panel lines for the passenger doors, wrapped on the skin."""
    bm = bmesh.new()
    seg = 40
    doors = [(3.42, 0.16, 0.2), (-2.78, 0.16, 0.2), (0.285, 0.07, 0.11)]
    for side in (1, -1):
        for x0, hw, hh in doors:
            outer, inner = [], []
            for k in range(seg):
                a = 2 * math.pi * k / seg
                ca, sa = math.cos(a), math.sin(a)
                ex = math.copysign(abs(ca) ** 0.35, ca)
                ez = math.copysign(abs(sa) ** 0.35, sa)
                for lst, grow in ((outer, 1.0), (inner, 0.0)):
                    x = x0 + ex * (hw + 0.007 * grow)
                    zn = 0.06 + ez * (hh + 0.014 * grow) / RZ
                    p = surface_point(x, zn, side)
                    n = Vector((0, p.y, p.z - fuselage_section(x)[0])).normalized()
                    lst.append(bm.verts.new(p + n * 0.0035))
            for k in range(seg):
                q = (outer[k], outer[(k + 1) % seg], inner[(k + 1) % seg], inner[k])
                bm.faces.new(q if side > 0 else q[::-1])
    ob = new_object("Doors", bm, ["Panel_Line"])
    shade_smooth(ob)
    return ob


def build_titles():
    """'Samruk Travel' lettering on both sides, bent onto the fuselage."""
    font = None
    for path in ("/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        if os.path.exists(path):
            font = bpy.data.fonts.load(path)
            break
    objs = []
    for side in (1, -1):
        cu = bpy.data.curves.new("TitleCurve", "FONT")
        cu.body = "Samruk Travel"
        if font:
            cu.font = font
        cu.size = 0.3
        cu.align_x = "CENTER"
        cu.resolution_u = 6
        tob = bpy.data.objects.new("TitleTmp", cu)
        bpy.context.scene.collection.objects.link(tob)
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(tob.evaluated_get(dg))
        bpy.data.objects.remove(tob)
        # text lies in its local XY plane; map X -> fuselage x, Y -> height
        cx, zn0 = 0.95, 0.42
        for v in me.vertices:
            u, w = v.co.x, v.co.y
            # starboard (side -1) reads nose-ward, port reads tail-ward: both left-to-right
            x = cx + u if side < 0 else cx - u
            zc, ry, rz = fuselage_section(x)
            zn = max(-1.0, min(1.0, zn0 + w / rz))
            v.co = skin_point(x, side * math.acos(zn), 0.004)
        me.materials.append(MATS["Paint_Blue"])
        ob = bpy.data.objects.new("Title_" + ("L" if side > 0 else "R"), me)
        bpy.context.scene.collection.objects.link(ob)
        objs.append(ob)
    return objs


# --------------------------------------------------------------------------- lifting surfaces

def airfoil(n_half=36, camber=0.02, camber_pos=0.4):
    """Unit-chord NACA 4-digit airfoil, closed trailing edge. Returns [(x, yc, yt_sign)]."""
    pts = []
    xs = [0.5 * (1 - math.cos(math.pi * i / n_half)) for i in range(n_half + 1)]

    def yt(x):
        return 5 * (0.2969 * math.sqrt(x) - 0.1260 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1036 * x ** 4)

    def yc(x):
        m, p = camber, camber_pos
        if m == 0:
            return 0.0
        return m / p ** 2 * (2 * p * x - x * x) if x < p else m / (1 - p) ** 2 * (1 - 2 * p + 2 * p * x - x * x)

    for x in reversed(xs):           # upper surface, TE -> LE
        pts.append((x, yc(x), yt(x)))
    for x in xs[1:-1]:               # lower surface, LE -> TE (TE shared)
        pts.append((x, yc(x), -yt(x)))
    return pts


def loft(name, sections, foil, mats, cap_root=True, cap_tip=True):
    """sections: list of (le: Vector, chord_dir: Vector, normal: Vector, chord, thickness)."""
    bm = bmesh.new()
    rings = []
    for le, cdir, nrm, chord, thick in sections:
        ring = []
        for fx, fc, ft in foil:
            p = le + cdir * (fx * chord) + nrm * ((fc + ft * thick) * chord)
            ring.append(bm.verts.new(p))
        rings.append(ring)
    m = len(foil)
    for r0, r1 in zip(rings, rings[1:]):
        for j in range(m):
            bm.faces.new((r0[j], r0[(j + 1) % m], r1[(j + 1) % m], r1[j]))
    if cap_root:
        bm.faces.new(list(reversed(rings[0])))
    if cap_tip:
        bm.faces.new(rings[-1])
    bm.normal_update()
    # make outward normals consistent
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_object(name, bm, mats)


def wing_sections():
    secs = []
    y_root, y_crank, y_tip = 0.25, 1.75, 4.55
    sweep = math.tan(math.radians(27))
    dihedral = math.tan(math.radians(6))
    z_root = -0.31
    n_main = 48

    def le_x(y):
        if y <= y_crank:
            return 1.15 - (y - y_root) * sweep
        return 1.15 - (y_crank - y_root) * sweep - (y - y_crank) * sweep

    def te_x(y):
        if y <= y_crank:
            return -0.92
        t = (y - y_crank) / (y_tip - y_crank)
        return lerp(-0.92, -1.46, t)

    for i in range(n_main + 1):
        t = i / n_main
        y = lerp(y_root, y_tip, 1 - (1 - t) ** 1.15)
        lx, tx = le_x(y), te_x(y)
        chord = lx - tx
        z = z_root + (y - y_root) * dihedral
        thick = lerp(0.15, 0.1, smoothstep(y_root, y_tip, y))
        twist = math.radians(-2.5) * smoothstep(y_root, y_tip, y)
        cdir = Vector((-math.cos(twist), 0, -math.sin(twist)))
        nrm = Vector((-math.sin(twist), 0, math.cos(twist)))
        secs.append((Vector((lx, y, z)), cdir, nrm, chord, thick))

    # sharklet: blend upward through an arc, then a swept, tapered blade
    le_tip, _, _, chord_tip, _ = secs[-1]
    rho = 0.17
    cant = math.radians(78)
    n_arc, n_blade = 14, 18
    for i in range(1, n_arc + 1):
        a = cant * (i / n_arc)
        y = le_tip.y + rho * math.sin(a)
        z = le_tip.z + rho * (1 - math.cos(a))
        frac = i / n_arc
        chord = lerp(chord_tip, chord_tip * 0.8, frac)
        lx = le_tip.x - 0.12 * frac
        nrm = Vector((0, -math.sin(a), math.cos(a)))
        secs.append((Vector((lx, y, z)), Vector((-1, 0, 0)), nrm, chord, 0.1))
    base = secs[-1][0].copy()
    up = Vector((0, math.cos(cant), math.sin(cant)))
    nrm = Vector((0, -math.sin(cant), math.cos(cant)))
    chord0 = secs[-1][3]
    for i in range(1, n_blade + 1):
        t = i / n_blade
        h = 0.5 * t
        p = base + up * h + Vector((-0.34 * t ** 1.1, 0, 0))
        chord = lerp(chord0, 0.14, t ** 0.9)
        thick = lerp(0.1, 0.07, t)
        if i == n_blade:
            chord, thick = 0.1, 0.03
        secs.append((p, Vector((-1, 0, 0)), nrm, chord, thick))
    return secs


def build_wing():
    foil = airfoil(26, 0.022, 0.42)
    ob = loft("Wing_L", wing_sections(), foil, ["Paint_White", "Paint_Blue", "Paint_Gold", "Panel_Line"])
    apply_subsurf(ob, 1)
    me = ob.data
    for p in me.polygons:
        c = p.center
        # winglet in brand blue with a gold tip, flaps hinge line in grey
        if c.y > 4.55 + 0.05 and c.z > 0.2:
            p.material_index = 2 if c.z > 0.56 else 1
        elif c.y > 4.48:
            p.material_index = 1
    return ob


def build_hstab():
    secs = []
    sweep = math.tan(math.radians(32))
    for i in range(31):
        t = i / 30
        y = lerp(0.12, 1.78, t)
        lx = -3.32 - (y - 0.12) * sweep
        chord = lerp(1.05, 0.36, t)
        z = 0.14 + (y - 0.12) * math.tan(math.radians(6))
        thick = 0.1
        if i == 30:
            chord, thick = 0.3, 0.04
        secs.append((Vector((lx, y, z)), Vector((-1, 0, 0)), Vector((0, 0, 1)), chord, thick))
    ob = loft("HStab_L", secs, airfoil(24, 0.0), ["Paint_Blue"])
    apply_subsurf(ob, 1)
    return ob


def point_in_poly(x, y, poly):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def build_fin():
    secs = []
    sweep = math.tan(math.radians(38))
    for i in range(51):
        t = i / 50
        z = lerp(0.3, 2.2, t)
        lx = -2.42 - (z - 0.3) * sweep
        chord = lerp(1.95, 0.62, t)
        thick = 0.11
        if i == 50:
            chord, thick = 0.55, 0.04
        # spanwise direction is +Z, thickness along Y
        secs.append((Vector((lx, 0.0, z)), Vector((-1, 0, 0)), Vector((0, 1, 0)), chord, thick))
    ob = loft("Fin", secs, airfoil(28, 0.0), ["Paint_Blue", "Paint_Gold", "Paint_White"])
    apply_subsurf(ob, 1)
    for p in ob.data.polygons:
        if p.center.z > 2.12:
            p.material_index = 1
    return ob


def build_fin_logo(fin):
    """Gold sun and white mountains, projected onto both sides of the fin."""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(fin, dg)
    sun_c, sun_r = (-3.74, 1.45), 0.3
    sun = [(sun_c[0] + sun_r * math.cos(2 * math.pi * k / 72), sun_c[1] + sun_r * math.sin(2 * math.pi * k / 72)) for k in range(72)]
    peaks = [(-2.95, 0.68), (-3.24, 0.98), (-3.4, 0.87), (-3.82, 1.25), (-4.08, 1.01), (-4.22, 1.09), (-4.5, 0.68)]
    objs = []
    for name, poly, mat in (("FinSun", sun, "Paint_Gold"), ("FinPeaks", peaks, "Paint_White")):
        for side in (1, -1):
            bm = bmesh.new()
            vs = [bm.verts.new((px, 0.0, pz)) for px, pz in poly]
            f = bm.faces.new(vs)
            bmesh.ops.triangulate(bm, faces=[f])
            for _ in range(4 if name == "FinPeaks" else 2):
                bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
                bmesh.ops.triangulate(bm, faces=bm.faces[:])
            keep = []
            for v in bm.verts:
                hit = tree.ray_cast(Vector((v.co.x, side * 2.0, v.co.z)), Vector((0, -side, 0)))
                if hit[0] is None:
                    keep.append(v)
                    continue
                v.co = hit[0] + Vector((0, side * 0.005, 0))
            if side < 0:
                bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
            ob = new_object(f"{name}_{'L' if side > 0 else 'R'}", bm, [mat])
            shade_smooth(ob)
            objs.append(ob)
    return objs


# --------------------------------------------------------------------------- engines

def lathe(name, profile, seg, mats, mat_of=None, origin=Vector((0, 0, 0))):
    """Revolve a list of (x, r) around the X axis. mat_of(i) gives a material index per profile span."""
    bm = bmesh.new()
    rings = []
    for x, r in profile:
        ring = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            ring.append(bm.verts.new(origin + Vector((x, r * math.sin(a), r * math.cos(a)))))
        rings.append(ring)
    for i, (r0, r1) in enumerate(zip(rings, rings[1:])):
        for j in range(seg):
            f = bm.faces.new((r0[j], r1[j], r1[(j + 1) % seg], r0[(j + 1) % seg]))
            if mat_of:
                f.material_index = mat_of(i)
    bm.normal_update()
    return new_object(name, bm, mats)


def nacelle_profile():
    L = 1.5
    prof = []
    # inner duct from the fan face forward to the lip
    for i in range(10):
        t = i / 9
        prof.append((lerp(0.2, 0.012, t), lerp(0.228, 0.24, t)))
    # rounded lip (half torus), inner -> outer
    for i in range(1, 18):
        a = math.pi * i / 17
        prof.append((0.012 - 0.022 * math.sin(a), 0.255 - 0.015 * math.cos(a)))
    # outer cowl
    for i in range(1, 50):
        t = i / 49
        x = lerp(0.012, L, t)
        r = 0.27 + 0.038 * math.sin(math.pi * min(1.0, t / 0.75)) ** 0.8 - 0.05 * smoothstep(0.62, 1.0, t)
        prof.append((x, r))
    # trailing edge into the bypass nozzle
    prof.append((L + 0.01, 0.2))
    prof.append((L - 0.12, 0.196))
    return [(-x, r) for x, r in prof], L


def build_engine(side):
    y = 1.55 * side
    cx, cz = 1.32, -0.6
    origin = Vector((cx, y, cz))
    prof, L = nacelle_profile()
    n_duct, n_lip = 10, 17

    def mat_of(i):
        if i < n_duct - 1:
            return 2
        if i < n_duct - 1 + n_lip + 4:
            return 1
        if i > len(prof) - 5:
            return 3
        if 30 < i < 33:
            return 4
        return 0

    tag = "L" if side > 0 else "R"
    nac = lathe("Nacelle_" + tag, prof, 96, ["Paint_White", "Metal_Lip", "Fan_Dark", "Metal_Dark", "Paint_Gold"], mat_of, origin)
    shade_smooth(nac)

    # core nozzle and exhaust plug
    core = []
    for i in range(30):
        t = i / 29
        core.append((-(L - 0.14) - 0.32 * t, lerp(0.17, 0.135, t)))
    for i in range(1, 26):
        t = i / 25
        core.append((-(L + 0.18) - 0.3 * t, 0.12 * (1 - t ** 1.6) + 0.004))
    cob = lathe("Core_" + tag, core, 64, ["Metal_Dark"], None, origin)
    shade_smooth(cob)

    # pylon: rounded fairing between the nacelle and the wing
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 1.5
        v.co.y *= 0.085
        v.co.z *= 0.34
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
    py = new_object("Pylon_" + tag, bm, ["Paint_White"])
    py.location = (cx - 0.72, y, cz + 0.36)
    apply_subsurf(py, 2)

    # fan: separate node so the page can spin it
    bm = bmesh.new()
    blades = 22
    rr = 0.226
    for b in range(blades):
        a0 = 2 * math.pi * b / blades
        quads = []
        for k in range(9):
            t = k / 8
            r = lerp(0.07, rr, t)
            twist = math.radians(lerp(48, 18, t))
            half = lerp(0.05, 0.075, t)
            row = []
            for s in (-1, 1):
                ang = a0 + s * half / r * math.cos(twist)
                dx = s * half * math.sin(twist)
                row.append(bm.verts.new((dx, r * math.sin(ang), r * math.cos(ang))))
            quads.append(row)
        for r0, r1 in zip(quads, quads[1:]):
            bm.faces.new((r0[0], r1[0], r1[1], r0[1]))
    # hub disc and spinner cone
    hub = []
    for j in range(48):
        a = 2 * math.pi * j / 48
        hub.append(bm.verts.new((0.0, 0.075 * math.sin(a), 0.075 * math.cos(a))))
    bm.faces.new(list(reversed(hub)))
    sp_rings = [hub]
    for i in range(1, 16):
        t = i / 15
        r = 0.075 * math.cos(t * math.pi / 2) ** 0.8
        x = 0.16 * math.sin(t * math.pi / 2)
        if i == 15:
            break
        ring = [bm.verts.new((x, r * math.sin(2 * math.pi * j / 48), r * math.cos(2 * math.pi * j / 48))) for j in range(48)]
        sp_rings.append(ring)
    tipv = bm.verts.new((0.16, 0, 0))
    for r0, r1 in zip(sp_rings, sp_rings[1:]):
        for j in range(48):
            f = bm.faces.new((r0[j], r1[j], r1[(j + 1) % 48], r0[(j + 1) % 48]))
            f.material_index = 1
    for j in range(48):
        f = bm.faces.new((sp_rings[-1][j], tipv, sp_rings[-1][(j + 1) % 48]))
        f.material_index = 1
    fan = new_object("Fan_" + tag, bm, ["Fan_Dark", "Metal_Lip"])
    fan.location = (cx - 0.2, y, cz)
    shade_smooth(fan)
    return [nac, cob, py, fan]


def build_fairing():
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=48, radius=1.0)
    for v in bm.verts:
        v.co.x *= 1.75
        v.co.y *= 0.6
        v.co.z *= 0.3
    ob = new_object("BellyFairing", bm, ["Paint_Blue"])
    ob.location = (0.15, 0, -0.36)
    shade_smooth(ob)
    return ob


def build_lights():
    objs = []

    def blob(name, mat, loc, r=0.022):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=r)
        ob = new_object(name, bm, [mat])
        ob.location = loc
        shade_smooth(ob)
        objs.append(ob)

    blob("Beacon_Top", "Light_Red", (0.6, 0, RZ + 0.005))
    blob("Beacon_Bottom", "Light_Red", (-0.9, 0, -RZ + 0.02))
    blob("Nav_L", "Light_Red", (-1.02, 4.6, 0.16))
    blob("Nav_R", "Light_Green", (-1.02, -4.6, 0.16))
    blob("Strobe_Tail", "Light_White", (TAIL_X + 0.03, 0, fuselage_section(TAIL_X)[0]), 0.018)
    return objs


# --------------------------------------------------------------------------- main

def main():
    reset_scene()
    make_materials()
    parts = [build_fuselage(), build_windows(), build_doors(), build_fairing(), build_cockpit(), build_pinstripe()]
    parts += build_titles()
    wing = build_wing()
    parts += [wing, mirror_copy(wing, "Wing_R")]
    hs = build_hstab()
    parts += [hs, mirror_copy(hs, "HStab_R")]
    fin = build_fin()
    parts.append(fin)
    parts += build_fin_logo(fin)
    parts += build_engine(1) + build_engine(-1)
    parts += build_lights()

    tris = 0
    for o in parts:
        t = sum(len(p.vertices) - 2 for p in o.data.polygons)
        tris += t
        print(f"[airliner]   {o.name:16s} {t:7d}")
    print(f"[airliner] objects={len(parts)} triangles={tris}")

    if PREVIEW:
        render_preview(PREVIEW)

    for o in bpy.context.scene.objects:
        o.select_set(o.type == "MESH")
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_normals=True,
        export_materials="EXPORT",
    )
    print(f"[airliner] wrote {OUT}")


def render_preview(path):
    scn = bpy.context.scene
    scn.render.engine = "CYCLES"
    scn.cycles.device = "CPU"
    scn.cycles.samples = 24
    scn.render.resolution_x = 1280
    scn.render.resolution_y = 720
    world = bpy.data.worlds.new("Sky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = srgb("#9DB0E0")
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    scn.world = world
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 4.0
    so = bpy.data.objects.new("Sun", sun)
    so.rotation_euler = (math.radians(40), math.radians(-20), math.radians(30))
    scn.collection.objects.link(so)
    cam = bpy.data.cameras.new("Cam")
    cam.lens = 50
    co = bpy.data.objects.new("Cam", cam)
    view = os.environ.get("AIRLINER_VIEW", "34")
    if view == "nose":
        co.location = (8.2, -3.0, 1.4)
        d = Vector((4.3, 0, 0.15)) - co.location
        co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    elif view == "side":
        co.location = (0, -22, 0.4)
        co.rotation_euler = (math.radians(90), 0, 0)
    elif view == "front":
        co.location = (16, -6, 2.5)
        co.rotation_euler = (math.radians(82), 0, math.radians(70))
    else:
        co.location = (11, -14, 5)
        co.rotation_euler = (math.radians(72), 0, math.radians(38))
    scn.collection.objects.link(co)
    scn.camera = co
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)


main()
