# Erzeugt alle 3D-Modelle für Noten-Raum 3D in Blender und exportiert sie als GLB.
# Aufruf (PowerShell):
#   & "C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe" -b --python tools\build_models.py -- models\noten-raum.glb
# Danach mit tools\embed_models.ps1 in models.js einbetten (damit es auch per Doppelklick ohne Server läuft).
import bpy, bmesh, sys, math, random
from mathutils import Matrix, Vector

random.seed(444)
out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "noten-raum.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------- Materialien ----------
MATS = {}
def mat(name, color, rough=0.85, metal=0.0, emit=None, strength=1.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit:
        p.inputs["Emission Color"].default_value = (*emit, 1)
        p.inputs["Emission Strength"].default_value = strength
    MATS[name] = m
    return m

def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

def M(name, hexc, **kw):
    return mat(name, srgb(hexc), **kw)

def E(name, hexc, strength=2.0, rough=0.5):
    c = srgb(hexc)
    return mat(name, c, rough=rough, emit=c, strength=strength)

# ---------- Baukasten ----------
class Model:
    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []

    def _mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _finish(self, res, m):
        verts = res["verts"]
        idx = self._mi(m)
        faces = set()
        for v in verts:
            for f in v.link_faces:
                faces.add(f)
        for f in faces:
            f.material_index = idx
        return verts

    @staticmethod
    def T(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
        r = (Matrix.Rotation(rot[2], 4, "Z") @ Matrix.Rotation(rot[1], 4, "Y") @ Matrix.Rotation(rot[0], 4, "X"))
        return Matrix.Translation(loc) @ r @ Matrix.Diagonal((*scale, 1))

    def box(self, m, size, loc=(0, 0, 0), rot=(0, 0, 0)):
        res = bmesh.ops.create_cube(self.bm, size=1.0, matrix=self.T(loc, rot, size))
        return self._finish(res, m)

    def cyl(self, m, r1, r2, h, loc=(0, 0, 0), rot=(0, 0, 0), seg=12, scale=(1, 1, 1)):
        # Kegel/Zylinder mit Basis bei loc (nicht Mitte): nach oben verschoben.
        mtx = self.T(loc, rot, scale) @ Matrix.Translation((0, 0, h / 2))
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                                    radius1=r1, radius2=r2, depth=h, matrix=mtx)
        return self._finish(res, m)

    def sphere(self, m, r, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), seg=12, rings=8):
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=r,
                                        matrix=self.T(loc, rot, scale))
        return self._finish(res, m)

    def ico(self, m, r, loc=(0, 0, 0), scale=(1, 1, 1), sub=1, jitter=0.0, rot=(0, 0, 0)):
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=r,
                                         matrix=self.T(loc, rot, scale))
        if jitter:
            c = Vector(loc)
            for v in res["verts"]:
                d = (v.co - c)
                v.co = c + d * (1 + random.uniform(-jitter, jitter))
        return self._finish(res, m)

    def build(self):
        me = bpy.data.meshes.new(self.name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        for p in me.polygons:
            p.use_smooth = False
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob

# ---------- Materialliste ----------
gold = M("Gold", "#d9a93a", rough=0.35, metal=0.9)
stone = M("Stein", "#6d6d74", rough=1)
stoneDark = M("SteinDunkel", "#45454c", rough=1)
moonGlow = E("MondLicht", "#e8f0ff", 3.0)
wood = M("Holz", "#6b4423")
woodDark = M("HolzDunkel", "#3e2614")
leaf = M("Blatt", "#2f7a3a")
leafDark = M("BlattDunkel", "#1f5a2c")
palmLeaf = M("Palmblatt", "#4f9a3a")
sand = M("Sand", "#e2b77a")
sunOrange = E("Sonne", "#ff8a3c", 2.5)
sunsetHill = M("Abendhuegel", "#8a4b5a")
lanternRed = E("Laterne", "#ff6a2a", 2.2)
snow = M("Schnee", "#f2f8ff", rough=0.7)
ice = M("Eis", "#9fdcff", rough=0.15, metal=0.1)
iceGlow = E("EisLeuchten", "#8fe6ff", 1.2, rough=0.2)
carrot = M("Karotte", "#ff7a1a")
coal = M("Kohle", "#1b1b1f")
grass = M("Gras", "#4a8f3c")
mushRed = M("PilzRot", "#d8322b", rough=0.6)
white = M("Weiss", "#f4efe2")
discoBase = M("DiscoBoden", "#2a0f45", rough=0.4)
neonPink = E("NeonPink", "#ff3ad0", 3.0)
neonCyan = E("NeonCyan", "#3affea", 3.0)
neonYellow = E("NeonGelb", "#ffe23a", 3.0)
mirror = M("Spiegel", "#d8dde6", rough=0.08, metal=1.0)
blackBox = M("Lautsprecher", "#18181d", rough=0.6)
greyRing = M("Membran", "#4a4a55", rough=0.5)
seaSand = M("Meeressand", "#d8c08a")
seaBlue = M("Meer", "#1f5f8f")
coralPink = M("KoralleRosa", "#ff6f91", rough=0.7)
coralOrange = M("KoralleOrange", "#ff9a3c", rough=0.7)
seaweed = M("Seetang", "#2e9a5a")
fishYellow = M("FischGelb", "#ffd23a", rough=0.5)
fishBlue = M("FischBlau", "#3a8cff", rough=0.5)
bubble = M("Blase", "#cdeeff", rough=0.05)
noteStone = M("Notenstein", "#77777a", rough=1)

# ---------- Mini-Figuren für den Shop (Sockelradius 0.5) ----------
def pedestal(md, top):
    md.cyl(gold, 0.53, 0.53, 0.05, loc=(0, 0, 0), seg=28)
    md.cyl(top, 0.5, 0.5, 0.07, loc=(0, 0, 0.05), seg=28)
    return 0.12

def mini_ruin():
    md = Model("mini_0"); z = pedestal(md, stoneDark)
    for i in range(7):
        a = math.radians(200 + i * 20)
        h = random.choice([0.12, 0.2, 0.32, 0.26])
        md.box(stone, (0.1, 0.07, h), loc=(math.cos(a) * 0.38, math.sin(a) * 0.38 + 0.12, z + h / 2), rot=(0, 0, a + math.pi / 2))
    for x, y, h in [(-0.25, -0.15, 0.36), (0.27, -0.12, 0.22), (0.05, 0.25, 0.3)]:
        md.cyl(stone, 0.05, 0.045, h, loc=(x, y, z), seg=10)
    md.box(noteStone, (0.13, 0.1, 0.035), loc=(0.02, -0.18, z + 0.018), rot=(0, 0, 0.4))
    md.box(noteStone, (0.13, 0.1, 0.035), loc=(-0.06, -0.02, z + 0.018), rot=(0, 0, -0.3))
    md.ico(moonGlow, 0.09, loc=(0.18, 0.18, z + 0.55), sub=2)
    for _ in range(6):
        md.ico(stoneDark, 0.03, loc=(random.uniform(-0.35, 0.35), random.uniform(-0.35, 0.0), z + 0.015), sub=1, jitter=0.3)
    return md.build()

def palm(md, base, s=1.0):
    x, y, z = base
    pts = []
    for i in range(5):
        pts.append((x + i * 0.012 * s, y, z + i * 0.07 * s))
        md.cyl(wood, 0.035 * s, 0.03 * s, 0.075 * s, loc=pts[-1], rot=(0, 0.1, 0), seg=8)
    tx, ty, tz = x + 0.06 * s, y, z + 0.36 * s
    for k in range(6):
        a = k * math.pi / 3
        md.cyl(palmLeaf, 0.04 * s, 0.0, 0.28 * s, loc=(tx, ty, tz), rot=(1.1, 0, a), seg=4, scale=(1.6, 0.4, 1))
    md.sphere(woodDark, 0.025 * s, loc=(tx, ty + 0.03 * s, tz - 0.02 * s), seg=8, rings=5)

def mini_sunset():
    md = Model("mini_1"); z = pedestal(md, sand)
    md.cyl(sunOrange, 0.26, 0.26, 0.03, loc=(0, 0.28, z + 0.05), rot=(math.pi / 2, 0, 0), seg=28)
    md.sphere(sunsetHill, 0.3, loc=(-0.22, 0.2, z), scale=(1.1, 0.6, 0.45), seg=14, rings=8)
    md.sphere(sunsetHill, 0.25, loc=(0.25, 0.22, z), scale=(1.0, 0.6, 0.38), seg=14, rings=8)
    palm(md, (-0.18, -0.12, z), 1.0)
    palm(md, (0.22, -0.02, z), 0.75)
    md.sphere(lanternRed, 0.05, loc=(0.05, -0.25, z + 0.06), scale=(1, 1, 1.3), seg=10, rings=6)
    return md.build()

def crystal(md, base, s=1.0, m=None):
    x, y, z = base
    m = m or ice
    md.cyl(m, 0.06 * s, 0.0, 0.36 * s, loc=(x, y, z), seg=6)
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        md.cyl(m, 0.04 * s, 0.0, 0.22 * s, loc=(x + math.cos(a) * 0.04 * s, y + math.sin(a) * 0.04 * s, z), rot=(0.45, 0, a + math.pi / 2), seg=6)

def mini_ice():
    md = Model("mini_2"); z = pedestal(md, snow)
    md.sphere(snow, 0.2, loc=(-0.12, 0.12, z), scale=(1, 1, 0.8), seg=16, rings=10)
    md.box(ice, (0.1, 0.09, 0.08), loc=(-0.12, -0.05, z + 0.04))
    crystal(md, (0.25, 0.15, z), 1.0, iceGlow)
    crystal(md, (0.3, -0.15, z), 0.7, ice)
    crystal(md, (-0.32, -0.22, z), 0.6, iceGlow)
    # Schneemann
    md.sphere(snow, 0.07, loc=(0.06, -0.2, z + 0.06), seg=10, rings=7)
    md.sphere(snow, 0.05, loc=(0.06, -0.2, z + 0.16), seg=10, rings=7)
    md.cyl(carrot, 0.012, 0.0, 0.05, loc=(0.06, -0.245, z + 0.165), rot=(math.pi / 2, 0, 0), seg=6)
    return md.build()

def pine(md, base, s=1.0):
    x, y, z = base
    md.cyl(woodDark, 0.03 * s, 0.025 * s, 0.1 * s, loc=(x, y, z), seg=8)
    for i, (r, h) in enumerate([(0.16, 0.2), (0.12, 0.17), (0.08, 0.15)]):
        md.cyl(leafDark if i % 2 else leaf, r * s, 0.0, h * s, loc=(x, y, z + (0.08 + i * 0.1) * s), seg=8)

def mini_forest():
    md = Model("mini_3"); z = pedestal(md, grass)
    pine(md, (-0.2, 0.15, z), 1.3)
    pine(md, (0.18, 0.2, z), 1.0)
    pine(md, (0.3, -0.1, z), 0.7)
    pine(md, (-0.33, -0.15, z), 0.8)
    md.cyl(white, 0.025, 0.02, 0.08, loc=(0.02, -0.15, z), seg=8)
    md.sphere(mushRed, 0.06, loc=(0.02, -0.15, z + 0.08), scale=(1, 1, 0.6), seg=12, rings=6)
    md.ico(stone, 0.06, loc=(-0.05, 0.0, z + 0.02), sub=1, jitter=0.25)
    return md.build()

def mini_disco():
    md = Model("mini_4"); z = pedestal(md, discoBase)
    cols = [neonPink, neonCyan, neonYellow]
    for i in range(4):
        for j in range(4):
            md.box(cols[(i + j) % 3], (0.11, 0.11, 0.02), loc=(-0.18 + i * 0.12, -0.18 + j * 0.12, z + 0.01))
    md.cyl(greyRing, 0.006, 0.006, 0.25, loc=(0, 0, z + 0.4), seg=6)
    md.ico(mirror, 0.1, loc=(0, 0, z + 0.4), sub=2)
    for x in (-0.36, 0.36):
        md.box(blackBox, (0.12, 0.1, 0.24), loc=(x, 0.15, z + 0.12))
        md.cyl(greyRing, 0.035, 0.035, 0.01, loc=(x, 0.098, z + 0.08), rot=(math.pi / 2, 0, 0), seg=12)
        md.cyl(greyRing, 0.025, 0.025, 0.01, loc=(x, 0.098, z + 0.18), rot=(math.pi / 2, 0, 0), seg=12)
    return md.build()

def coral(md, base, s=1.0, m=None):
    x, y, z = base
    m = m or coralPink
    md.cyl(m, 0.03 * s, 0.022 * s, 0.18 * s, loc=(x, y, z), seg=8)
    for k in range(3):
        a = k * 2.1 + 0.3
        bx, by = x + math.cos(a) * 0.01 * s, y + math.sin(a) * 0.01 * s
        md.cyl(m, 0.02 * s, 0.015 * s, 0.14 * s, loc=(bx, by, z + 0.12 * s), rot=(0.6, 0, a + math.pi / 2), seg=8)
        tip = (bx + math.cos(a) * 0.08 * s, by + math.sin(a) * 0.08 * s, z + 0.24 * s)
        md.sphere(m, 0.025 * s, loc=tip, seg=8, rings=5)

def fish(md, loc, s=1.0, m=None, yaw=0.0):
    m = m or fishYellow
    x, y, z = loc
    md.sphere(m, 0.06 * s, loc=(x, y, z), scale=(1.5, 0.55, 1.0), rot=(0, 0, yaw), seg=12, rings=7)
    tx, ty = x - math.cos(yaw) * 0.1 * s, y - math.sin(yaw) * 0.1 * s
    md.cyl(m, 0.05 * s, 0.0, 0.07 * s, loc=(tx, ty, z), rot=(0, -math.pi / 2, yaw), seg=4, scale=(0.3, 1, 1))

def mini_ocean():
    md = Model("mini_5"); z = pedestal(md, seaSand)
    coral(md, (-0.2, 0.12, z), 1.3, coralPink)
    coral(md, (0.25, 0.18, z), 1.0, coralOrange)
    for i in range(5):
        x = -0.35 + i * 0.07
        md.cyl(seaweed, 0.025, 0.0, 0.3 + (i % 2) * 0.12, loc=(x + 0.5 * (i % 2) * 0.1, -0.25 + i * 0.02, z), rot=(0.12 * (i - 2), 0, 0), seg=5)
    fish(md, (0.05, -0.05, z + 0.3), 1.0, fishYellow, 0.3)
    fish(md, (-0.15, 0.0, z + 0.45), 0.7, fishBlue, -2.6)
    for i in range(5):
        md.sphere(bubble, 0.018 + 0.006 * i, loc=(0.28, -0.15, z + 0.15 + i * 0.09), seg=8, rings=5)
    md.box(seaBlue, (0.0001, 0.0001, 0.0001), loc=(0, 0, z))
    return md.build()

# ---------- Große Deko-Modelle (Meter) ----------
def deco_pine():
    md = Model("deco_pine")
    md.cyl(woodDark, 0.18, 0.14, 1.0, seg=8)
    for i, (r, h) in enumerate([(1.3, 1.6), (1.0, 1.4), (0.7, 1.2), (0.4, 0.9)]):
        md.cyl(leafDark if i % 2 else leaf, r, 0.0, h, loc=(0, 0, 0.8 + i * 0.85), seg=9)
    return md.build()

def deco_palm():
    md = Model("deco_palm")
    x = 0.0
    for i in range(8):
        md.cyl(wood, 0.16 - i * 0.008, 0.15 - i * 0.008, 0.5, loc=(x, 0, i * 0.47), rot=(0, 0.08 + i * 0.015, 0), seg=8)
        x += 0.05 + i * 0.012
    top = (x, 0, 3.7)
    for k in range(7):
        a = k * math.tau / 7
        md.cyl(palmLeaf, 0.22, 0.0, 1.9, loc=top, rot=(1.25, 0, a), seg=4, scale=(1.8, 0.3, 1))
    for k in range(3):
        a = k * 2.1
        md.sphere(woodDark, 0.13, loc=(top[0] + math.cos(a) * 0.15, math.sin(a) * 0.15, top[2] - 0.12), seg=8, rings=6)
    return md.build()

def deco_crystal():
    md = Model("deco_crystal")
    for k, (r, h, tilt) in enumerate([(0.32, 2.4, 0), (0.22, 1.6, 0.45), (0.2, 1.4, 0.5), (0.18, 1.2, 0.55), (0.15, 0.9, 0.6)]):
        a = k * 1.4
        off = 0 if k == 0 else 0.18
        md.cyl(iceGlow if k % 2 == 0 else ice, r, 0.0, h, loc=(math.cos(a) * off, math.sin(a) * off, 0), rot=(tilt, 0, a + math.pi / 2), seg=6)
    return md.build()

def deco_mushroom():
    md = Model("deco_mushroom")
    md.cyl(white, 0.13, 0.1, 0.55, seg=10)
    md.sphere(mushRed, 0.42, loc=(0, 0, 0.55), scale=(1, 1, 0.55), seg=16, rings=8)
    for k in range(7):
        a = k * math.tau / 7
        md.sphere(white, 0.05, loc=(math.cos(a) * 0.27, math.sin(a) * 0.27, 0.72), seg=6, rings=4)
    md.sphere(white, 0.06, loc=(0, 0, 0.78), seg=6, rings=4)
    return md.build()

def deco_coral():
    md = Model("deco_coral")
    coral(md, (0, 0, 0), 7.0, coralPink)
    coral(md, (0.5, 0.3, 0), 5.0, coralOrange)
    return md.build()

def deco_seaweed():
    md = Model("deco_seaweed")
    for k in range(6):
        a = k * math.tau / 6
        x, y = math.cos(a) * 0.3, math.sin(a) * 0.3
        h = 0.0
        for s in range(5):
            seg_h = 0.6 - s * 0.05
            md.cyl(seaweed, 0.09 - s * 0.015, 0.075 - s * 0.015, seg_h, loc=(x + math.sin(s + k) * 0.08, y, h), rot=(0.1 * math.sin(s * 1.7 + k), 0.1 * math.cos(s + k), 0), seg=5)
            h += seg_h * 0.95
    return md.build()

def deco_fish():
    md = Model("deco_fish")
    fish(md, (0, 0, 0), 4.0, fishYellow, 0.0)
    return md.build()

def deco_discoball():
    md = Model("deco_discoball")
    md.cyl(greyRing, 0.02, 0.02, 3.0, loc=(0, 0, 0.5), seg=6)
    md.ico(mirror, 0.6, loc=(0, 0, 0), sub=2)
    return md.build()

def deco_speaker():
    md = Model("deco_speaker")
    md.box(blackBox, (0.9, 0.7, 1.7), loc=(0, 0, 0.85))
    md.cyl(greyRing, 0.3, 0.3, 0.04, loc=(0, -0.35, 0.55), rot=(math.pi / 2, 0, 0), seg=16)
    md.cyl(greyRing, 0.18, 0.18, 0.04, loc=(0, -0.35, 1.25), rot=(math.pi / 2, 0, 0), seg=16)
    md.box(neonPink, (0.92, 0.72, 0.05), loc=(0, 0, 1.72))
    return md.build()

def deco_lantern():
    md = Model("deco_lantern")
    md.cyl(woodDark, 0.03, 0.03, 2.2, seg=6)
    md.sphere(lanternRed, 0.25, loc=(0, 0, 2.45), scale=(1, 1, 1.25), seg=12, rings=8)
    md.cyl(woodDark, 0.12, 0.12, 0.05, loc=(0, 0, 2.72), seg=10)
    md.cyl(woodDark, 0.1, 0.1, 0.05, loc=(0, 0, 2.12), seg=10)
    return md.build()

def deco_rock():
    md = Model("deco_rock")
    md.ico(stone, 0.6, loc=(0, 0, 0.25), scale=(1.3, 1, 0.75), sub=1, jitter=0.25)
    md.ico(stoneDark, 0.35, loc=(0.6, 0.3, 0.12), scale=(1, 1.2, 0.7), sub=1, jitter=0.3)
    return md.build()

def deco_column():
    md = Model("deco_column")
    md.box(stoneDark, (0.9, 0.9, 0.25), loc=(0, 0, 0.125))
    md.cyl(stone, 0.32, 0.3, 2.4, loc=(0, 0, 0.25), seg=12)
    md.ico(stone, 0.35, loc=(0.6, 0.2, 0.15), sub=1, jitter=0.2, scale=(1, 1, 0.6))
    return md.build()

def deco_snowman():
    md = Model("deco_snowman")
    md.sphere(snow, 0.55, loc=(0, 0, 0.5), seg=14, rings=9)
    md.sphere(snow, 0.4, loc=(0, 0, 1.3), seg=14, rings=9)
    md.sphere(snow, 0.28, loc=(0, 0, 1.9), seg=14, rings=9)
    md.cyl(carrot, 0.06, 0.0, 0.35, loc=(0, -0.26, 1.92), rot=(math.pi / 2, 0, 0), seg=8)
    for x in (-0.1, 0.1):
        md.sphere(coal, 0.04, loc=(x, -0.25, 2.0), seg=6, rings=4)
    for zc in (1.2, 1.4):
        md.sphere(coal, 0.045, loc=(0, -0.39, zc), seg=6, rings=4)
    md.cyl(coal, 0.22, 0.22, 0.05, loc=(0, 0, 2.1), seg=12)
    md.cyl(coal, 0.15, 0.15, 0.3, loc=(0, 0, 2.12), seg=12)
    return md.build()

builders = [mini_ruin, mini_sunset, mini_ice, mini_forest, mini_disco, mini_ocean,
            deco_pine, deco_palm, deco_crystal, deco_mushroom, deco_coral, deco_seaweed, deco_fish,
            deco_discoball, deco_speaker, deco_lantern, deco_rock, deco_column, deco_snowman]
for i, b in enumerate(builders):
    ob = b()
    ob.location = (i * 3.0, 0, 0)  # nur zur Übersicht in Blender; three.js setzt eigene Positionen

bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True)
print("EXPORTED", out, len(builders), "models")
