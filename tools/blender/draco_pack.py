"""
Re-encode every mesh primitive of a GLB with Draco (KHR_draco_mesh_compression).

The pip `bpy` build ships without Blender's Draco bridge, so build_airliner.py writes
plain geometry and this script compresses it with DracoPy:

    pip install DracoPy pygltflib numpy
    python tools/blender/draco_pack.py raw.glb assets/intro/airliner.glb
"""

import struct
import sys

import DracoPy
import numpy as np
import pygltflib

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_accessor(g, blob, idx):
    acc = g.accessors[idx]
    bv = g.bufferViews[acc.bufferView]
    dt = COMP[acc.componentType]
    n = NCOMP[acc.type]
    off = (bv.byteOffset or 0) + (acc.byteOffset or 0)
    arr = np.frombuffer(blob, dtype=dt, count=acc.count * n, offset=off)
    return arr.reshape(acc.count, n) if n > 1 else arr


def main(src, dst):
    g = pygltflib.GLTF2().load_binary(src)
    blob = g.binary_blob()
    out = bytearray()
    views = []

    def add_view(data):
        while len(out) % 4:
            out.append(0)
        views.append(pygltflib.BufferView(buffer=0, byteOffset=len(out), byteLength=len(data)))
        out.extend(data)
        return len(views) - 1

    accessors = []

    def add_accessor(count, ctype, typ, mn=None, mx=None):
        accessors.append(pygltflib.Accessor(componentType=ctype, count=count, type=typ, min=mn, max=mx))
        return len(accessors) - 1

    raw_total = 0
    for mesh in g.meshes:
        for prim in mesh.primitives:
            pos = read_accessor(g, blob, prim.attributes.POSITION).astype(np.float32)
            nrm = read_accessor(g, blob, prim.attributes.NORMAL).astype(np.float64)  # DracoPy wants doubles here
            idx = read_accessor(g, blob, prim.indices).astype(np.uint32).reshape(-1, 3)
            raw_total += pos.nbytes + nrm.nbytes + idx.nbytes
            enc = DracoPy.encode(pos, idx, quantization_bits=15, compression_level=7,
                                 normals=nrm, normal_quantization_bits=11, preserve_order=False)
            dec = DracoPy.decode(enc)
            # read back the unique ids the encoder gave each attribute (DracoPy writes normals first)
            ids = {"POSITION": 0, "NORMAL": 1}
            if hasattr(dec, "attributes"):
                for a in dec.attributes:
                    name = {0: "POSITION", 1: "NORMAL"}.get(a.get("attribute_type"))
                    if name:
                        ids[name] = a["unique_id"]
            bv = add_view(enc)
            n_verts = len(dec.points)
            p_acc = add_accessor(n_verts, 5126, "VEC3", pos.min(0).tolist(), pos.max(0).tolist())
            n_acc = add_accessor(n_verts, 5126, "VEC3")
            i_acc = add_accessor(len(dec.faces) * 3, 5125 if n_verts > 65535 else 5123, "SCALAR")
            prim.attributes = pygltflib.Attributes(POSITION=p_acc, NORMAL=n_acc)
            prim.indices = i_acc
            prim.extensions = {"KHR_draco_mesh_compression": {"bufferView": bv, "attributes": ids}}

    g.accessors = accessors
    g.bufferViews = views
    g.buffers = [pygltflib.Buffer(byteLength=len(out))]
    for key in ("KHR_draco_mesh_compression",):
        g.extensionsUsed = sorted(set((g.extensionsUsed or []) + [key]))
        g.extensionsRequired = sorted(set((g.extensionsRequired or []) + [key]))
    g.set_binary_blob(bytes(out))
    g.save_binary(dst)
    print(f"[draco] {raw_total / 1e6:.2f} MB raw geometry -> {len(out) / 1e6:.2f} MB, wrote {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
