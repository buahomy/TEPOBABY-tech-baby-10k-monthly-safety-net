// Runs a student's Python 3 against test cases with Pyodide (CPython compiled to WebAssembly),
// loaded from jsDelivr the first time Python is used. Mirrors LeetCode's Python environment:
// typing, collections, heapq, etc. are imported, and ListNode / TreeNode / Node are defined.
// The harness below is the Python twin of runCase() in shared/ncJudge.js.

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

type Job = { code: string; slug: string; meta: unknown; inputs: string[] };

const HARNESS = String.raw`
import json, sys, io, time, traceback, collections

PRELUDE = '''
from typing import *
import collections, heapq, math, bisect, itertools, functools, string, re, random, operator
from collections import *
from heapq import *
from bisect import *
from itertools import *
from functools import lru_cache, cache, reduce, cmp_to_key
from math import inf, gcd, sqrt, ceil, floor, log2, comb, factorial

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
'''

NODE_RANDOM = '''
class Node:
    def __init__(self, x=0, next=None, random=None):
        self.val = int(x)
        self.next = next
        self.random = random
'''

NODE_GRAPH = '''
class Node:
    def __init__(self, val=0, neighbors=None):
        self.val = val
        self.neighbors = neighbors if neighbors is not None else []
'''

sys.setrecursionlimit(4000)

def _err(e):
    lines = traceback.format_exception(type(e), e, e.__traceback__)
    keep = [l for l in lines if 'File "solution.py"' in l]
    where = ""
    if keep:
        import re as _re
        m = _re.search(r"line (\d+)", keep[-1])
        if m: where = " (line " + m.group(1) + ")"
    msg = f"{type(e).__name__}: {e}" if str(e) else type(e).__name__
    return msg if "line" in msg else msg + where

def compile_user(code, slug):
    env = {"__name__": "solution"}
    exec(PRELUDE, env)
    if slug == "copy-list-with-random-pointer": exec(NODE_RANDOM, env)
    if slug == "clone-graph": exec(NODE_GRAPH, env)
    exec(compile(code, "solution.py", "exec"), env)
    return env

def build_list(arr, env):
    dummy = env["ListNode"](); t = dummy
    for v in arr or []:
        t.next = env["ListNode"](v); t = t.next
    return dummy.next

def list_to_arr(head):
    out = []; n = head; i = 0
    while n:
        if i > 100000: raise Exception("The returned list has a cycle.")
        out.append(n.val); n = n.next; i += 1
    return out

def build_tree(arr, env):
    if not arr or arr[0] is None: return None
    T = env["TreeNode"]; root = T(arr[0]); q = [root]; i = 1; h = 0
    while h < len(q) and i < len(arr):
        node = q[h]; h += 1
        if i < len(arr) and arr[i] is not None:
            node.left = T(arr[i]); q.append(node.left)
        i += 1
        if i < len(arr) and arr[i] is not None:
            node.right = T(arr[i]); q.append(node.right)
        i += 1
    return root

def tree_to_arr(root):
    out = []; q = [root]; h = 0
    while h < len(q):
        if h > 200000: raise Exception("The returned tree is too big (or has a cycle).")
        n = q[h]; h += 1
        if n is not None:
            out.append(n.val); q.append(n.left); q.append(n.right)
        else:
            out.append(None)
    while out and out[-1] is None: out.pop()
    return out

def plain(v):
    if isinstance(v, bool) or v is None or isinstance(v, (int, str)): return v
    if isinstance(v, float):
        if v != v or v in (float("inf"), float("-inf")): return str(v)
        return v
    if isinstance(v, (list, tuple, set, frozenset, collections.deque)): return [plain(x) for x in v]
    if isinstance(v, dict): return {str(k): plain(x) for k, x in v.items()}
    if hasattr(v, "val") and hasattr(v, "next"): return list_to_arr(v)
    if hasattr(v, "val") and hasattr(v, "left"): return tree_to_arr(v)
    return str(v)

def ser(typ, v):
    if typ == "void": return None
    if typ == "ListNode": return list_to_arr(v)
    if typ == "TreeNode": return tree_to_arr(v)
    return plain(v)

def build_arg(typ, v, env):
    if typ == "ListNode": return build_list(v, env)
    if typ == "ListNode[]": return [build_list(x, env) for x in (v or [])]
    if typ == "TreeNode": return build_tree(v, env)
    return json.loads(json.dumps(v))

def find_node(root, val):
    st = [root]
    while st:
        n = st.pop()
        if n is None: continue
        if n.val == val: return n
        st.append(n.left); st.append(n.right)
    return None

def method(env, name):
    if name in env and callable(env[name]) and not isinstance(env[name], type): return env[name]
    if "Solution" not in env: raise Exception("Define class Solution with a method " + name + ".")
    s = env["Solution"]()
    if not hasattr(s, name): raise Exception("class Solution needs a method named " + name + ".")
    return getattr(s, name)

def run_case(slug, meta, env, args):
    if slug == "serialize-and-deserialize-binary-tree":
        if "Codec" not in env: raise Exception("Define class Codec with serialize and deserialize.")
        ser_, deser = env["Codec"](), env["Codec"]()
        s = ser_.serialize(build_tree(args[0], env))
        if not isinstance(s, str): raise Exception("serialize must return a string.")
        return tree_to_arr(deser.deserialize(s))
    if slug == "encode-and-decode-strings":
        if "Codec" not in env: raise Exception("Define class Codec with encode and decode.")
        c = env["Codec"]()
        s = c.encode(list(args[0]))
        if not isinstance(s, str): raise Exception("encode must return a string.")
        return plain(c.decode(s))
    if meta.get("classname"):
        name = meta["classname"]
        if name not in env: raise Exception("Define the " + name + " class.")
        ops, op_args = args
        obj = env[name](*json.loads(json.dumps(op_args[0] or [])))
        out = [None]
        methods = {m["name"]: m for m in meta.get("methods", [])}
        for i in range(1, len(ops)):
            if not hasattr(obj, ops[i]): raise Exception(name + " needs a " + ops[i] + " method.")
            r = getattr(obj, ops[i])(*json.loads(json.dumps(op_args[i] or [])))
            out.append(ser(methods.get(ops[i], {}).get("return", {}).get("type", ""), r))
        return out

    f = method(env, meta["name"])
    if slug == "linked-list-cycle":
        head = build_list(args[0], env)
        if args[1] >= 0:
            tail = head; at = None; i = 0
            while tail:
                if i == args[1]: at = tail
                if not tail.next: break
                tail = tail.next; i += 1
            if tail: tail.next = at
        return f(head)
    if slug == "lowest-common-ancestor-of-a-binary-search-tree":
        root = build_tree(args[0], env)
        r = f(root, find_node(root, args[1]), find_node(root, args[2]))
        return r.val if r is not None else None
    if slug == "copy-list-with-random-pointer":
        N = env["Node"]
        nodes = [N(v) for v, _ in args[0]]
        for i, n in enumerate(nodes):
            n.next = nodes[i + 1] if i + 1 < len(nodes) else None
            n.random = None if args[0][i][1] is None else nodes[args[0][i][1]]
        orig = set(map(id, nodes))
        res = f(nodes[0] if nodes else None)
        out = []; idx = {}; n = res; i = 0
        while n:
            if id(n) in orig: raise Exception("The copy reuses nodes from the original list. Build new nodes.")
            if i > 100000: raise Exception("The returned list has a cycle.")
            idx[id(n)] = i; out.append(n); n = n.next; i += 1
        return [[n.val, (idx.get(id(n.random), -1) if n.random is not None else None)] for n in out]
    if slug == "clone-graph":
        N = env["Node"]; adj = args[0] or []
        nodes = [N(i + 1) for i in range(len(adj))]
        for i, nb in enumerate(adj): nodes[i].neighbors = [nodes[v - 1] for v in nb]
        orig = set(map(id, nodes))
        res = f(nodes[0] if nodes else None)
        if res is None: return []
        seen = {res.val: res}; q = [res]; h = 0
        while h < len(q):
            if id(q[h]) in orig: raise Exception("The clone reuses nodes from the original graph. Build new nodes.")
            for nb in q[h].neighbors or []:
                if nb.val not in seen:
                    seen[nb.val] = nb; q.append(nb)
            h += 1
        n = max(seen)
        return [[x.val for x in (seen[i + 1].neighbors if (i + 1) in seen else [])] for i in range(n)]

    params = meta["params"]
    built = [build_arg(p["type"], args[i], env) for i, p in enumerate(params)]
    ret = f(*built)
    pi = (meta.get("output") or {}).get("paramindex")
    if meta["return"]["type"] == "void" and pi is not None:
        return ser(params[pi]["type"], built[pi])
    return ser(meta["return"]["type"], ret)

_JOB = None
_ENV = None

def start(job_json):
    global _JOB, _ENV
    _JOB = json.loads(job_json)
    try:
        _ENV = compile_user(_JOB["code"], _JOB["slug"])
        return json.dumps({"ok": True})
    except BaseException as e:
        return json.dumps({"ok": False, "error": _err(e)})

def run_one(i):
    args = [json.loads(l) for l in _JOB["inputs"][i].split("\n") if l.strip()]
    buf = io.StringIO(); old = sys.stdout; sys.stdout = buf
    t0 = time.perf_counter()
    try:
        out = run_case(_JOB["slug"], _JOB["meta"], _ENV, args)
        res = {"ok": True, "out": plain(out)}
    except RecursionError:
        res = {"ok": False, "error": "RecursionError: maximum recursion depth exceeded"}
    except BaseException as e:
        res = {"ok": False, "error": _err(e)}
    finally:
        sys.stdout = old
    res["ms"] = (time.perf_counter() - t0) * 1000
    res["stdout"] = buf.getvalue()[-4000:]
    return json.dumps(res)
`;

type Pyodide = {
  runPython: (code: string) => unknown;
  globals: { get: (name: string) => (...a: unknown[]) => string };
};

let ready: Promise<Pyodide> | null = null;

function load() {
  ready ??= (async () => {
    const mod = await import(/* @vite-ignore */ `${PYODIDE}pyodide.mjs`);
    const py: Pyodide = await mod.loadPyodide({ indexURL: PYODIDE });
    py.runPython(HARNESS);
    return py;
  })();
  return ready;
}

self.onmessage = async (e: MessageEvent<Job | { type: "warm" }>) => {
  if ("type" in e.data) {
    try {
      await load();
      self.postMessage({ type: "ready" });
    } catch {
      self.postMessage({ type: "loadError" });
    }
    return;
  }
  const job = e.data;
  let py: Pyodide;
  try {
    py = await load();
  } catch {
    self.postMessage({ type: "compile", error: "Couldn't load Python in your browser. Check your connection and try again." });
    return;
  }
  const started = JSON.parse(py.globals.get("start")(JSON.stringify(job)));
  if (!started.ok) {
    self.postMessage({ type: "compile", error: started.error });
    return;
  }
  const runOne = py.globals.get("run_one");
  for (let i = 0; i < job.inputs.length; i++) {
    self.postMessage({ type: "case", i, ...JSON.parse(runOne(i)) });
  }
  self.postMessage({ type: "done" });
};
