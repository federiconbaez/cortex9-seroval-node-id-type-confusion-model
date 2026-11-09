#!/usr/bin/env python3
"""Independent derivation of fixtures/expected.tsv, in Python.

Re-implements the decision of the two seroval diffs (50926b3, 3edc78b) and
the advisory's "<= 1.6.3" sentence without reading src/model.js. Values are
tagged tuples: ("SEQ",), ("STREAM",), ("OBJ", keys), ("CALLABLE_ON", branded).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Stop(Exception):
    pass


def walk(state, node):
    kind = node["t"]
    if kind in ("num", "str"):
        return ("PRIM", node["s"])
    if kind == "ref":
        if node["i"] not in state["vals"]:
            raise Stop("UNKNOWN_REF")
        return state["vals"][node["i"]]
    if kind in ("obj", "seq", "stream", "plugin"):
        nid = node["i"]
        if nid in state["m"] and nid in state["vals"]:
            raise Stop("REUSED_ID_REJECTED")
        if kind == "obj":
            val = ("OBJ", tuple(node.get("p", {})))
            state["vals"][nid] = val
            for child in node.get("p", {}).values():
                walk(state, child)
            return val
        if kind == "seq":
            state["vals"][nid] = ("SEQ",)
            state["marks"][nid] = "Sequence"
            for child in node.get("a", []):
                walk(state, child)
            return ("SEQ",)
        if kind == "stream":
            state["vals"][nid] = ("STREAM",)
            state["marks"][nid] = "StreamConstructor"
            return ("STREAM",)
        val = ("CALLABLE_ON", bool(node.get("brand")))
        state["vals"][nid] = val
        return val
    if kind in ("iter", "aiter"):
        src_node = node["a"][0]
        src = walk(state, src_node)
        want = "Sequence" if kind == "iter" else "StreamConstructor"
        genuine = ("SEQ",) if kind == "iter" else ("STREAM",)
        ver = state["ver"]
        if ver == "pre" and state["marks"].get(src_node.get("i")) != want:
            raise Stop("NODE_TYPE_MISMATCH")
        if ver == "post" and src != genuine:
            raise Stop("MALFORMED_NODE")
        if src == genuine:
            return ("ITER",)
        # pre / v163 accept a non-genuine source past this point
        if kind == "iter":
            state["forged"] = True
        elif src[0] == "CALLABLE_ON":
            state["calls"] += 1
        else:
            raise Stop("NO_ON_METHOD")
        return ("ITER",)
    raise Stop("MALFORMED_INPUT")


def run(tree, ver):
    state = {"ver": ver, "vals": {}, "marks": {}, "m": set(tree.get("m", [])),
             "calls": 0, "forged": False}
    try:
        walk(state, tree["t"])
    except Stop as stop:
        return str(stop), state["calls"]
    if state["calls"]:
        return "FOREIGN_ON_INVOKED", state["calls"]
    if state["forged"]:
        return "FORGED_SEQUENCE_ACCEPTED", 0
    return "OK", 0


def serializer(value, ver):
    if value == "genuine-sequence":
        return "SEQUENCE"
    if value == "genuine-stream":
        return "STREAM"
    if ver == "pre" and "__SEROVAL_SEQUENCE__" in value:
        return "SEQUENCE_BRAND_TRUSTED"
    if ver == "pre" and "__SEROVAL_STREAM__" in value:
        return "STREAM_BRAND_TRUSTED"
    return "PLAIN_OBJECT"


def main():
    cases = json.loads((ROOT / "fixtures/cases.json").read_text(encoding="utf-8"))
    out = ["id\tversion\tlabel\tforeign_calls"]
    for g in cases["graphs"]:
        for ver in ("v163", "pre", "post"):
            label, calls = run(g["tree"], ver)
            out.append(f"{g['id']}\t{ver}\t{label}\t{calls}")
    for s in cases["serializer"]:
        for ver in ("pre", "post"):
            out.append(f"{s['id']}\t{ver}\t{serializer(s['value'], ver)}\t0")
    sys.stdout.write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
