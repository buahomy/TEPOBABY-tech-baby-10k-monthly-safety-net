// Step-by-step traces for the Roadmap animations. Each tracer runs its concept's algorithm on a
// small sample and records, at every step, which line of the Python template is running, a short
// note, and a snapshot of the data (arrays with pointers, hash maps, trees, graphs, grids…).

import { conceptById } from "./concepts";

export type Cell = string | number;
export type Pt = { id: string; label: Cell; x: number; y: number; note?: string };
export type Panel =
  | { t: "array"; label?: string; items: Cell[]; ptr?: Record<number, string>; hl?: number[]; ok?: number[]; dim?: number[]; win?: [number, number] }
  | { t: "map"; label: string; entries: [Cell, Cell][]; hl?: Cell }
  | { t: "stack"; label: string; items: Cell[] }
  | { t: "list"; vals: Cell[]; next: (number | null)[]; ptr: Record<number, string> }
  | { t: "nodes"; nodes: Pt[]; edges: { a: string; b: string; label?: string; hl?: boolean }[]; directed?: boolean; hl?: string[]; done?: string[]; soft?: string[]; height?: number }
  | { t: "grid"; label?: string; cells: Cell[][]; hl?: [number, number][]; ok?: [number, number][]; rowHead?: string[]; colHead?: string[] }
  | { t: "intervals"; label: string; items: number[][]; hl?: number[]; ok?: number[]; max: number }
  | { t: "bits"; rows: { label: string; value: number }[]; width: number; hl?: number[] }
  | { t: "vars"; vars: [string, Cell][] };

export type Step = { line: number; note: string; panels: Panel[] };

function recorder(id: string) {
  const code = conceptById.get(id)!.python.split("\n");
  const steps: Step[] = [];
  const step = (needle: string, note: string, panels: Panel[]) => {
    const i = code.findIndex((l) => l.includes(needle));
    if (i < 0) console.warn(`[viz] ${id}: no line contains "${needle}"`);
    steps.push({ line: i + 1, note, panels: JSON.parse(JSON.stringify(panels)) });
  };
  return { steps, step };
}

const ptrs = (pairs: [number | null | undefined, string][]) => {
  const out: Record<number, string> = {};
  for (const [i, name] of pairs) if (i !== null && i !== undefined && i >= 0) out[i] = out[i] ? `${out[i]},${name}` : name;
  return out;
};

// ---- Arrays & Hashing: Two Sum with a hash map ----
function arrays() {
  const { steps, step } = recorder("arrays");
  const nums = [3, 8, 5, 1, 7];
  const target = 12;
  const seen = new Map<number, number>();
  const view = (i: number | null, extra: Partial<{ hl: number[]; ok: number[]; key: number; need: number }> = {}) => [
    { t: "array", label: "nums", items: nums, ptr: ptrs([[i, "i"]]), hl: extra.hl ?? (i !== null ? [i] : []), ok: extra.ok } as Panel,
    { t: "map", label: "seen (value → index)", entries: [...seen.entries()], hl: extra.key } as Panel,
    { t: "vars", vars: [["target", target], ["need", extra.need ?? "–"]] } as Panel,
  ];
  step("seen = {}", "Start with an empty hash map.", view(null));
  for (let i = 0; i < nums.length; i++) {
    const n = nums[i];
    const need = target - n;
    step("for i, n", `i = ${i}, n = ${n}.`, view(i));
    step("need = target - n", `need = ${target} − ${n} = ${need}.`, view(i, { need }));
    if (seen.has(need)) {
      step("if need in seen", `${need} is in the map (index ${seen.get(need)}), found in O(1).`, view(i, { need, key: need }));
      step("return [seen[need], i]", `Answer: [${seen.get(need)}, ${i}] since ${need} + ${n} = ${target}.`, view(i, { need, ok: [seen.get(need)!, i], hl: [] }));
      break;
    }
    step("if need in seen", `${need} isn't in the map yet.`, view(i, { need }));
    seen.set(n, i);
    step("seen[n] = i", `Remember ${n} → index ${i}.`, view(i, { need, key: n }));
  }
  return steps;
}

// ---- Two Pointers: pair sum in a sorted array ----
function twoPointers() {
  const { steps, step } = recorder("twoPointers");
  const nums = [1, 3, 4, 6, 8, 11];
  const target = 10;
  let [l, r] = [0, nums.length - 1];
  const view = (total: Cell = "–", ok?: number[]) => [
    { t: "array", label: "nums (sorted)", items: nums, ptr: ptrs([[l, "l"], [r, "r"]]), hl: ok ? [] : [l, r], ok } as Panel,
    { t: "vars", vars: [["target", target], ["total", total]] } as Panel,
  ];
  step("l, r = 0", "Start at both ends.", view());
  while (l < r) {
    const total = nums[l] + nums[r];
    step("while l < r", `l = ${l}, r = ${r}.`, view());
    step("total = nums[l] + nums[r]", `${nums[l]} + ${nums[r]} = ${total}.`, view(total));
    if (total === target) {
      step("return [l, r]", `${total} = target. Found [${l}, ${r}].`, view(total, [l, r]));
      break;
    }
    if (total < target) {
      step("elif total < target", `${total} < ${target}: every pair with nums[l] is too small, so move l right.`, view(total));
      l++;
      step("l += 1", `l → ${l}.`, view(total));
    } else {
      step("else:", `${total} > ${target}: every pair with nums[r] is too big, so move r left.`, view(total));
      r--;
      step("r -= 1", `r → ${r}.`, view(total));
    }
  }
  return steps;
}

// ---- Stack: next greater element with a monotonic stack ----
function stack() {
  const { steps, step } = recorder("stack");
  const nums = [2, 1, 5, 3, 4];
  const res = nums.map(() => -1 as number);
  const st: number[] = [];
  const view = (i: number | null, hlRes?: number) => [
    { t: "array", label: "nums", items: nums, ptr: ptrs([[i, "i"]]), hl: i !== null ? [i] : [] } as Panel,
    { t: "stack", label: "stack (index:value) → top", items: st.map((j) => `${j}:${nums[j]}`) } as Panel,
    { t: "array", label: "res", items: res, ok: hlRes !== undefined ? [hlRes] : [] } as Panel,
  ];
  step("res = [-1]", "Every answer starts as -1 (no bigger value to the right).", view(null));
  nums.forEach((n, i) => {
    step("for i, n", `i = ${i}, n = ${n}.`, view(i));
    while (st.length && nums[st[st.length - 1]] < n) {
      step("while stack and", `Top of stack holds ${nums[st[st.length - 1]]} < ${n}.`, view(i));
      const j = st.pop()!;
      step("j = stack.pop()", `Pop index ${j}: it's been waiting for something bigger.`, view(i));
      res[j] = n;
      step("res[j] = n", `res[${j}] = ${n}.`, view(i, j));
    }
    st.push(i);
    step("stack.append(i)", `Push index ${i}; it waits for a bigger value.`, view(i));
  });
  step("return res", "Indexes left on the stack never saw a bigger value: they stay -1.", view(null));
  return steps;
}

// ---- Binary Search ----
function binarySearch() {
  const { steps, step } = recorder("binarySearch");
  const nums = [1, 3, 5, 7, 9, 11, 13, 15, 17];
  const target = 13;
  let [l, r] = [0, nums.length - 1];
  let m: number | null = null;
  const view = (ok?: number[]) => [
    {
      t: "array",
      label: "nums (sorted)",
      items: nums,
      ptr: ptrs([[l, "l"], [m, "m"], [r, "r"]]),
      hl: m !== null && !ok ? [m] : [],
      ok,
      dim: nums.map((_, i) => i).filter((i) => i < l || i > r),
    } as Panel,
    { t: "vars", vars: [["target", target], ["range size", Math.max(0, r - l + 1)]] } as Panel,
  ];
  step("l, r = 0", `Search all ${nums.length} items for ${target}.`, view());
  while (l <= r) {
    step("while l <= r", `Range [${l}, ${r}] isn't empty.`, view());
    m = Math.floor((l + r) / 2);
    step("m = (l + r) // 2", `Middle index m = ${m}, nums[m] = ${nums[m]}.`, view());
    if (nums[m] === target) {
      step("return m", `nums[${m}] = ${target}. Found it in ${steps.filter((s) => s.note.startsWith("Middle")).length} checks.`, view([m]));
      break;
    }
    if (nums[m] < target) {
      step("elif nums[m] < target", `${nums[m]} < ${target}: the left half can't hold it.`, view());
      l = m + 1;
      step("l = m + 1", `Drop the left half: l → ${l}.`, view());
    } else {
      step("else:", `${nums[m]} > ${target}: the right half can't hold it.`, view());
      r = m - 1;
      step("r = m - 1", `Drop the right half: r → ${r}.`, view());
    }
  }
  return steps;
}

// ---- Sliding Window: longest substring without repeats ----
function slidingWindow() {
  const { steps, step } = recorder("slidingWindow");
  const s = "abcbad".split("");
  const seen = new Set<string>();
  let l = 0;
  let best = 0;
  const view = (r: number | null) => [
    { t: "array", label: "s", items: s, ptr: ptrs([[l, "l"], [r, "r"]]), win: r !== null && r >= l ? [l, r] : undefined, hl: r !== null ? [r] : [] } as Panel,
    { t: "map", label: "seen (window letters)", entries: [...seen].map((c) => [c, "✓"] as [Cell, Cell]) } as Panel,
    { t: "vars", vars: [["best", best]] } as Panel,
  ];
  step("l = best = 0", "Empty window at the start.", view(null));
  for (let r = 0; r < s.length; r++) {
    step("for r in range", `Grow the window: r = ${r} ('${s[r]}').`, view(r));
    while (seen.has(s[r])) {
      step("while s[r] in seen", `'${s[r]}' is already in the window: it breaks the rule.`, view(r));
      seen.delete(s[l]);
      step("seen.remove(s[l])", `Drop '${s[l]}' from the left.`, view(r));
      l++;
      step("l += 1", `l → ${l}.`, view(r));
    }
    seen.add(s[r]);
    step("seen.add(s[r])", `Add '${s[r]}'. Window = "${s.slice(l, r + 1).join("")}".`, view(r));
    best = Math.max(best, r - l + 1);
    step("best = max", `Window length ${r - l + 1}; best = ${best}.`, view(r));
  }
  step("return best", `Longest window without repeats: ${best}.`, view(null));
  return steps;
}

// ---- Linked List: reverse in place ----
function linkedList() {
  const { steps, step } = recorder("linkedList");
  const vals = [1, 2, 3, 4];
  const next: (number | null)[] = [1, 2, 3, null];
  let prev: number | null = null;
  let curr: number | null = 0;
  let nxt: number | null | undefined;
  const at = (x: number | null | undefined) => (x === null ? -1 : x);
  const view = () => {
    const p: Record<number, string> = {};
    for (const [i, name] of [
      [at(prev), "prev"],
      [at(curr), "curr"],
      [nxt === undefined ? undefined : at(nxt), "nxt"],
    ] as [number | undefined, string][]) {
      if (i === undefined) continue;
      const k = i === -1 ? (name === "prev" ? -1 : vals.length) : i;
      p[k] = p[k] ? `${p[k]},${name}` : name;
    }
    return [{ t: "list", vals, next: [...next], ptr: p } as Panel];
  };
  step("prev, curr = None, head", "prev starts at None, curr at the head.", view());
  while (curr !== null) {
    step("while curr", `curr is node ${vals[curr]}.`, view());
    nxt = next[curr];
    step("nxt = curr.next", `Save the rest of the list: nxt = ${nxt === null ? "None" : vals[nxt]}.`, view());
    next[curr] = prev;
    step("curr.next = prev", `Flip ${vals[curr]}'s pointer to ${prev === null ? "None" : vals[prev]}.`, view());
    prev = curr;
    step("prev = curr", `prev → ${vals[prev]}.`, view());
    curr = nxt;
    step("curr = nxt", `curr → ${curr === null ? "None" : vals[curr]}.`, view());
  }
  nxt = undefined;
  step("return prev", `prev (${vals[prev!]}) is the new head: 4 → 3 → 2 → 1.`, view());
  return steps;
}

// ---- Trees: max depth with DFS ----
function trees() {
  const { steps, step } = recorder("trees");
  // [3,9,20,null,null,15,7]
  const T: Record<string, { v: number; l?: string; r?: string; x: number; y: number }> = {
    a: { v: 3, l: "b", r: "c", x: 0.5, y: 0.12 },
    b: { v: 9, x: 0.25, y: 0.45 },
    c: { v: 20, l: "d", r: "e", x: 0.75, y: 0.45 },
    d: { v: 15, x: 0.62, y: 0.8 },
    e: { v: 7, x: 0.88, y: 0.8 },
  };
  const depth: Record<string, number> = {};
  const callStack: string[] = [];
  const view = (cur?: string) => [
    {
      t: "nodes",
      nodes: Object.entries(T).map(([id, n]) => ({ id, label: n.v, x: n.x, y: n.y, note: depth[id] !== undefined ? `d=${depth[id]}` : undefined })),
      edges: Object.entries(T).flatMap(([id, n]) => [n.l, n.r].filter(Boolean).map((c) => ({ a: id, b: c! }))),
      directed: true,
      hl: cur ? [cur] : [],
      done: Object.keys(depth),
      soft: callStack,
    } as Panel,
    { t: "stack", label: "call stack → top", items: callStack.map((id) => `max_depth(${T[id].v})`) } as Panel,
  ];
  const dfs = (id: string): number => {
    const n = T[id];
    callStack.push(id);
    step("if not node", `Visit ${n.v}.`, view(id));
    let left = 0;
    if (n.l) {
      step("left = max_depth(node.left)", `Recurse into ${n.v}'s left child.`, view(id));
      left = dfs(n.l);
    } else step("return 0", `${n.v} has no left child: that call returns 0.`, view(id));
    let right = 0;
    if (n.r) {
      step("right = max_depth(node.right)", `left = ${left}. Recurse into ${n.v}'s right child.`, view(id));
      right = dfs(n.r);
    } else step("return 0", `${n.v} has no right child: that call returns 0.`, view(id));
    depth[id] = 1 + Math.max(left, right);
    step("return 1 + max(left, right)", `${n.v} returns 1 + max(${left}, ${right}) = ${depth[id]}.`, view(id));
    callStack.pop();
    return depth[id];
  };
  const d = dfs("a");
  steps[steps.length - 1].note += ` The tree's depth is ${d}.`;
  return steps;
}

// ---- Tries: insert words ----
type TrieN = { id: string; ch: string; kids: Map<string, TrieN>; end: boolean };
function layout(root: TrieN) {
  const pts: Pt[] = [];
  const edges: { a: string; b: string; label?: string }[] = [];
  let leaf = 0;
  const leaves = (n: TrieN): number => (n.kids.size ? [...n.kids.values()].reduce((s, k) => s + leaves(k), 0) : 1);
  const total = Math.max(1, leaves(root));
  const maxDepth = (n: TrieN): number => 1 + Math.max(0, ...[...n.kids.values()].map(maxDepth));
  const D = Math.max(2, maxDepth(root));
  const place = (n: TrieN, depth: number): number => {
    let x: number;
    if (!n.kids.size) x = (leaf++ + 0.5) / total;
    else {
      const xs = [...n.kids.values()].map((k) => {
        edges.push({ a: n.id, b: k.id });
        return place(k, depth + 1);
      });
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    pts.push({ id: n.id, label: n.ch, x, y: 0.1 + (0.8 * depth) / (D - 1), note: n.end ? "end" : undefined });
    return x;
  };
  place(root, 0);
  return { pts, edges };
}

function tries() {
  const { steps, step } = recorder("tries");
  let ids = 0;
  const root: TrieN = { id: "root", ch: "•", kids: new Map(), end: false };
  const words = ["cat", "car", "dog"];
  const view = (cur: TrieN, word: string, idx: number | null) => {
    const { pts, edges } = layout(root);
    const ends: string[] = [];
    const walk = (n: TrieN) => {
      if (n.end) ends.push(n.id);
      n.kids.forEach(walk);
    };
    walk(root);
    return [
      { t: "array", label: "word", items: word.split(""), ptr: ptrs([[idx, "ch"]]), hl: idx !== null ? [idx] : [] } as Panel,
      { t: "nodes", nodes: pts, edges, directed: true, hl: [cur.id], done: ends, height: 130 } as Panel,
    ];
  };
  for (const w of words) {
    let node = root;
    step("node = root", `Insert "${w}": start at the root.`, view(node, w, null));
    for (let i = 0; i < w.length; i++) {
      const c = w[i];
      step("for ch in word", `ch = '${c}'.`, view(node, w, i));
      if (!node.kids.has(c)) {
        step("if ch not in node.children", `No '${c}' child here yet.`, view(node, w, i));
        node.kids.set(c, { id: `n${ids++}`, ch: c, kids: new Map(), end: false });
        step("node.children[ch] = TrieNode()", `Create a node for '${c}'.`, view(node, w, i));
      } else step("if ch not in node.children", `'${c}' already exists: "${w.slice(0, i + 1)}" shares this path.`, view(node, w, i));
      node = node.kids.get(c)!;
      step("node = node.children[ch]", `Move down to '${c}'.`, view(node, w, i));
    }
    node.end = true;
    step("node.end = True", `Mark the end of "${w}".`, view(node, w, null));
  }
  return steps;
}

// ---- Heap: k-th largest with a size-k min-heap ----
function heap() {
  const { steps, step } = recorder("heap");
  const nums = [3, 1, 5, 12, 2, 11];
  const k = 3;
  const h: number[] = [];
  const up = () => {
    for (let i = h.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (h[p] <= h[i]) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  };
  const down = () => {
    for (let i = 0; ; ) {
      const [l, r] = [2 * i + 1, 2 * i + 2];
      let m = i;
      if (l < h.length && h[l] < h[m]) m = l;
      if (r < h.length && h[r] < h[m]) m = r;
      if (m === i) break;
      [h[m], h[i]] = [h[i], h[m]];
      i = m;
    }
  };
  const pos = (i: number) => {
    const d = Math.floor(Math.log2(i + 1));
    const first = 2 ** d - 1;
    return { x: (i - first + 0.5) / 2 ** d, y: 0.15 + d * 0.38 };
  };
  const view = (i: number | null, hlTop = false) => [
    { t: "array", label: "nums", items: nums, ptr: ptrs([[i, "n"]]), hl: i !== null ? [i] : [] } as Panel,
    {
      t: "nodes",
      nodes: h.map((v, j) => ({ id: `h${j}`, label: v, ...pos(j) })),
      edges: h.slice(1).map((_, j) => ({ a: `h${(j + 1 - 1) >> 1}`, b: `h${j + 1}` })),
      directed: true,
      hl: hlTop && h.length ? ["h0"] : [],
      height: 120,
    } as Panel,
    { t: "vars", vars: [["k", k], ["heap size", h.length], ["heap[0] (smallest)", h.length ? h[0] : "–"]] } as Panel,
  ];
  step("heap = []", `Keep only the ${k} largest so far; the smallest of them sits on top.`, view(null));
  nums.forEach((n, i) => {
    step("for n in nums", `n = ${n}.`, view(i));
    h.push(n);
    up();
    step("heapq.heappush", `Push ${n}; it bubbles up to its place (O(log k)).`, view(i));
    if (h.length > k) {
      step("if len(heap) > k", `${h.length} items > k = ${k}.`, view(i, true));
      const top = h[0];
      h[0] = h[h.length - 1];
      h.pop();
      down();
      step("heapq.heappop(heap)", `Pop the smallest (${top}); it can't be among the ${k} largest.`, view(i));
    }
  });
  step("return heap[0]", `The top of the heap, ${h[0]}, is the ${k}rd largest.`, view(null, true));
  return steps;
}

// ---- Backtracking: subsets decision tree ----
function backtracking() {
  const { steps, step } = recorder("backtracking");
  const nums = [1, 2, 3];
  const nodes: Pt[] = [];
  const edges: { a: string; b: string; label?: string }[] = [];
  const build = (id: string, depth: number, lo: number, hi: number, path: number[]) => {
    nodes.push({ id, label: path.length ? path.join("") : "∅", x: (lo + hi) / 2, y: 0.1 + depth * 0.27 });
    if (depth === nums.length) return;
    const mid = (lo + hi) / 2;
    build(`${id}L`, depth + 1, lo, mid, [...path, nums[depth]]);
    build(`${id}R`, depth + 1, mid, hi, path);
    edges.push({ a: id, b: `${id}L`, label: `+${nums[depth]}` }, { a: id, b: `${id}R`, label: "skip" });
  };
  build("s", 0, 0, 1, []);
  const visited: string[] = [];
  const res: string[] = [];
  const path: number[] = [];
  const view = (cur: string) => [
    {
      t: "nodes",
      nodes: nodes.map((n) => ({ ...n, label: visited.includes(n.id) || n.id === cur ? n.label : "" })),
      edges: edges.map((e) => ({ ...e, hl: visited.includes(e.b) || e.b === cur })),
      directed: true,
      hl: [cur],
      done: visited,
      height: 170,
    } as Panel,
    { t: "array", label: "path", items: path.length ? [...path] : ["[ ]"] } as Panel,
    { t: "array", label: "res", items: res.length ? [...res] : ["[ ]"] } as Panel,
  ];
  const go = (i: number, id: string) => {
    step("if i == len(nums)", `backtrack(${i}) with path [${path.join(", ")}].`, view(id));
    if (i === nums.length) {
      res.push(`[${path.join(",")}]`);
      step("res.append(path[:])", `A leaf: save a copy of [${path.join(", ")}].`, view(id));
      visited.push(id);
      return;
    }
    path.push(nums[i]);
    step("path.append(nums[i])", `Choose ${nums[i]}.`, view(id));
    step("# explore with it", `Explore with ${nums[i]}.`, view(id));
    go(i + 1, `${id}L`);
    path.pop();
    step("path.pop()", `Back at [${path.join(", ")}]: undo ${nums[i]}.`, view(id));
    step("# explore without it", `Explore without ${nums[i]}.`, view(id));
    go(i + 1, `${id}R`);
    visited.push(id);
  };
  go(0, "s");
  step("return res", `All ${res.length} subsets (2³).`, view("s"));
  return steps;
}

// ---- Graphs: BFS over an adjacency list ----
const GRAPH_POS: Record<string, [number, number]> = { A: [0.12, 0.5], B: [0.38, 0.15], C: [0.38, 0.85], D: [0.64, 0.5], E: [0.64, 0.95], F: [0.9, 0.5] };
function graphs() {
  const { steps, step } = recorder("graphs");
  const adj: Record<string, string[]> = { A: ["B", "C"], B: ["A", "D"], C: ["A", "D", "E"], D: ["B", "C", "F"], E: ["C"], F: ["D"] };
  const edges: { a: string; b: string; hl?: boolean }[] = [];
  Object.entries(adj).forEach(([a, ns]) => ns.forEach((b) => a < b && edges.push({ a, b })));
  const visited = new Set<string>(["A"]);
  const q = ["A"];
  let head = 0;
  const done: string[] = [];
  const view = (cur?: string, nei?: string) => [
    {
      t: "nodes",
      nodes: Object.entries(GRAPH_POS).map(([id, [x, y]]) => ({ id, label: id, x, y })),
      edges: edges.map((e) => ({ ...e, hl: !!cur && !!nei && ((e.a === cur && e.b === nei) || (e.b === cur && e.a === nei)) })),
      hl: cur ? [cur] : [],
      done,
      soft: [...visited].filter((v) => !done.includes(v) && v !== cur),
      height: 130,
    } as Panel,
    { t: "array", label: "queue (front → back)", items: q.slice(head).length ? q.slice(head) : ["empty"] } as Panel,
    { t: "map", label: "graph (adjacency list)", entries: Object.entries(adj).map(([k, v]) => [k, v.join(", ")] as [Cell, Cell]), hl: cur } as Panel,
  ];
  step("visited = {start}", "Start BFS at A and mark it visited.", view());
  step("q = deque([start])", "The queue holds nodes to explore, in order of distance.", view());
  while (head < q.length) {
    step("while q", `Queue isn't empty.`, view());
    const node = q[head++];
    step("node = q.popleft()", `Take ${node} from the front.`, view(node));
    for (const nei of adj[node]) {
      step("for nei in graph[node]", `Neighbor ${nei}.`, view(node, nei));
      if (!visited.has(nei)) {
        visited.add(nei);
        step("visited.add(nei)", `${nei} is new: mark it visited.`, view(node, nei));
        q.push(nei);
        step("q.append(nei)", `Queue ${nei} for later.`, view(node, nei));
      } else step("if nei not in visited", `${nei} was already visited: skip it.`, view(node, nei));
    }
    done.push(node);
  }
  step("return visited", `Visited every node reachable from A, closest first: ${q.join(" → ")}.`, view());
  return steps;
}

// ---- Advanced Graphs: Dijkstra ----
function advGraphs() {
  const { steps, step } = recorder("advGraphs");
  const pos: Record<string, [number, number]> = { A: [0.1, 0.5], B: [0.45, 0.12], C: [0.45, 0.88], D: [0.75, 0.5], E: [0.95, 0.88] };
  const wEdges: [string, string, number][] = [
    ["A", "B", 4],
    ["A", "C", 1],
    ["C", "B", 2],
    ["B", "D", 1],
    ["C", "D", 5],
    ["D", "E", 3],
  ];
  const adj: Record<string, [string, number][]> = {};
  for (const [a, b, w] of wEdges) {
    (adj[a] ||= []).push([b, w]);
    (adj[b] ||= []).push([a, w]);
  }
  const dist = new Map<string, number>();
  let pq: [number, string][] = [[0, "A"]];
  const view = (cur?: string, via?: string) => [
    {
      t: "nodes",
      nodes: Object.entries(pos).map(([id, [x, y]]) => ({ id, label: id, x, y, note: dist.has(id) ? `${dist.get(id)}` : undefined })),
      edges: wEdges.map(([a, b, w]) => ({ a, b, label: String(w), hl: !!cur && !!via && ((a === cur && b === via) || (b === cur && a === via)) })),
      hl: cur ? [cur] : [],
      done: [...dist.keys()],
      height: 130,
    } as Panel,
    { t: "array", label: "min-heap (dist, node)", items: pq.length ? pq.map(([d, v]) => `(${d},${v})`) : ["empty"], hl: pq.length ? [0] : [] } as Panel,
  ];
  step("heap = [(0, src)]", "Distance 0 to the source A.", view());
  while (pq.length) {
    pq.sort((x, y) => x[0] - y[0]);
    step("while heap", "Pop the closest unfinished node.", view());
    const [d, u] = pq.shift()!;
    step("d, u = heapq.heappop", `Pop (${d}, ${u}).`, view(u));
    if (dist.has(u)) {
      step("continue", `${u} is already final with ${dist.get(u)} ≤ ${d}: skip this stale entry.`, view(u));
      continue;
    }
    dist.set(u, d);
    step("dist[u] = d", `${u}'s shortest distance is final: ${d}.`, view(u));
    for (const [v, w] of adj[u]) {
      if (!dist.has(v)) {
        pq.push([d + w, v]);
        pq = [...pq].sort((x, y) => x[0] - y[0]);
        step("heapq.heappush", `Edge ${u}→${v} (${w}): push (${d + w}, ${v}).`, view(u, v));
      } else step("if v not in dist", `${v} is already final: skip.`, view(u, v));
    }
  }
  step("return dist", `Shortest distances from A: ${[...dist].map(([k, v]) => `${k}=${v}`).join(", ")}.`, view());
  return steps;
}

// ---- 1-D DP: House Robber ----
function oneDP() {
  const { steps, step } = recorder("oneDP");
  const nums = [2, 7, 9, 3, 1];
  const dp: Cell[] = new Array(nums.length + 1).fill(0);
  const view = (i: number | null, house?: number, from: number[] = [], vars: [string, Cell][] = []) => [
    { t: "array", label: "nums (houses)", items: nums, hl: house !== undefined ? [house] : [] } as Panel,
    { t: "array", label: "dp[i] = best from the first i houses", items: dp, ptr: ptrs([[i, "i"]]), hl: from, ok: i !== null ? [i] : [] } as Panel,
    { t: "vars", vars } as Panel,
  ];
  step("dp = [0]", "dp[0] = 0: no houses, no money.", view(null));
  dp[1] = nums[0];
  step("dp[1] = nums[0]", `One house: rob it for ${nums[0]}.`, view(1, 0));
  for (let i = 2; i <= nums.length; i++) {
    step("for i in range", `i = ${i}: consider house ${i - 1} (${nums[i - 1]}).`, view(i, i - 1));
    const skip = dp[i - 1] as number;
    step("skip = dp[i - 1]", `Skip it: keep dp[${i - 1}] = ${skip}.`, view(i, i - 1, [i - 1], [["skip", skip]]));
    const take = (dp[i - 2] as number) + nums[i - 1];
    step("take = dp[i - 2]", `Rob it: dp[${i - 2}] + ${nums[i - 1]} = ${take}.`, view(i, i - 1, [i - 2], [["skip", skip], ["take", take]]));
    dp[i] = Math.max(skip, take);
    step("dp[i] = max", `dp[${i}] = max(${skip}, ${take}) = ${dp[i]}.`, view(i, i - 1, [], [["skip", skip], ["take", take]]));
  }
  step("return dp[-1]", `Best total: ${dp[nums.length]}.`, view(nums.length));
  return steps;
}

// ---- 2-D DP: Longest Common Subsequence ----
function twoDP() {
  const { steps, step } = recorder("twoDP");
  const a = "ace";
  const b = "abcde";
  const dp: Cell[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  const done: [number, number][] = [];
  const view = (cell?: [number, number], deps: [number, number][] = []) => [
    { t: "grid", label: `dp[i][j] = LCS of a[i:] and b[j:]  (a = "${a}", b = "${b}")`, cells: dp.map((r) => [...r]), hl: deps, ok: cell ? [cell] : [], rowHead: [...a.split(""), "∅"], colHead: [...b.split(""), "∅"] } as Panel,
  ];
  step("dp = [[0]", "Base cases: an empty string has an LCS of 0 (last row and column).", view());
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        step("if a[i] == b[j]", `a[${i}] = b[${j}] = '${a[i]}': a match.`, view([i, j]));
        dp[i][j] = 1 + (dp[i + 1][j + 1] as number);
        step("dp[i][j] = 1 + dp", `Take it: 1 + dp[${i + 1}][${j + 1}] = ${dp[i][j]}.`, view([i, j], [[i + 1, j + 1]]));
      } else {
        step("if a[i] == b[j]", `'${a[i]}' ≠ '${b[j]}'.`, view([i, j]));
        dp[i][j] = Math.max(dp[i + 1][j] as number, dp[i][j + 1] as number);
        step("dp[i][j] = max", `Skip one: max(below ${dp[i + 1][j]}, right ${dp[i][j + 1]}) = ${dp[i][j]}.`, view([i, j], [[i + 1, j], [i, j + 1]]));
      }
      done.push([i, j]);
    }
  step("return dp[0][0]", `LCS("${a}", "${b}") = ${dp[0][0]}.`, view([0, 0]));
  return steps;
}

// ---- Greedy: Kadane's maximum subarray ----
function greedy() {
  const { steps, step } = recorder("greedy");
  const nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4];
  let best = nums[0];
  let cur = 0;
  let start = 0;
  let bestRange: [number, number] = [0, 0];
  const view = (i: number | null, showBest = false) => [
    {
      t: "array",
      label: "nums",
      items: nums,
      ptr: ptrs([[i, "n"]]),
      win: showBest ? bestRange : i !== null ? [start, i] : undefined,
      hl: i !== null ? [i] : [],
      ok: showBest ? Array.from({ length: bestRange[1] - bestRange[0] + 1 }, (_, k) => bestRange[0] + k) : [],
    } as Panel,
    { t: "vars", vars: [["cur", cur], ["best", best]] } as Panel,
  ];
  step("best = nums[0]", `best starts at ${best}.`, view(null));
  nums.forEach((n, i) => {
    step("for n in nums", `n = ${n}.`, view(i));
    if (cur < 0) {
      step("if cur < 0", `The running sum ${cur} is negative and would only drag ${n} down.`, view(i));
      cur = 0;
      start = i;
      step("cur = 0", "Drop it: start a new subarray here.", view(i));
    }
    cur += n;
    step("cur += n", `cur = ${cur}.`, view(i));
    if (cur > best) bestRange = [start, i];
    best = Math.max(best, cur);
    step("best = max", `best = ${best}.`, view(i));
  });
  step("return best", `Largest sum: ${best} (indexes ${bestRange[0]}–${bestRange[1]}).`, view(null, true));
  return steps;
}

// ---- Intervals: merge overlapping ----
function intervals() {
  const { steps, step } = recorder("intervals");
  const input = [
    [1, 3],
    [8, 10],
    [2, 6],
    [15, 18],
    [9, 12],
  ];
  let sorted = input.map((x) => [...x]);
  const res: number[][] = [];
  const view = (cur: number | null, okRes?: number) => [
    { t: "intervals", label: "intervals", items: sorted, hl: cur !== null ? [cur] : [], max: 19 } as Panel,
    { t: "intervals", label: "res (merged)", items: res, ok: okRes !== undefined ? [okRes] : [], max: 19 } as Panel,
  ];
  step("intervals.sort", "Unsorted: overlaps could be anywhere.", view(null));
  sorted = [...sorted].sort((x, y) => x[0] - y[0]);
  step("intervals.sort", "Sort by start time so overlaps sit next to each other.", view(null));
  res.push([...sorted[0]]);
  step("res = [intervals[0]]", `Start with [${sorted[0]}].`, view(0, 0));
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    step("for start, end", `Next: [${s}, ${e}].`, view(i));
    const last = res[res.length - 1];
    step("last = res[-1]", `Last merged: [${last}].`, view(i, res.length - 1));
    if (s <= last[1]) {
      step("if start <= last[1]", `${s} ≤ ${last[1]}: they overlap.`, view(i, res.length - 1));
      last[1] = Math.max(last[1], e);
      step("last[1] = max", `Extend the end to ${last[1]}: [${last}].`, view(i, res.length - 1));
    } else {
      step("else:", `${s} > ${last[1]}: no overlap.`, view(i));
      res.push([s, e]);
      step("res.append", `Start a new interval [${s}, ${e}].`, view(i, res.length - 1));
    }
  }
  step("return res", `Merged: ${res.map((x) => `[${x}]`).join(" ")}.`, view(null));
  return steps;
}

// ---- Math & Geometry: rotate a matrix 90° ----
function math() {
  const { steps, step } = recorder("math");
  const m = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];
  const view = (hl: [number, number][] = [], ok: [number, number][] = []) => [{ t: "grid", label: "matrix", cells: m.map((r) => [...r]), hl, ok } as Panel];
  step("n = len(matrix)", "Rotate 90° clockwise in place: transpose, then reverse each row.", view());
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++) {
      step("for j in range", `Swap across the diagonal: (${i},${j}) ↔ (${j},${i}).`, view([[i, j], [j, i]]));
      [m[i][j], m[j][i]] = [m[j][i], m[i][j]];
      step("matrix[i][j], matrix[j][i]", `Now ${m[i][j]} and ${m[j][i]} have traded places.`, view([], [[i, j], [j, i]]));
    }
  step("for row in matrix", "Transposed: rows became columns.", view());
  for (let r = 0; r < 3; r++) {
    m[r].reverse();
    step("row.reverse()", `Reverse row ${r}.`, view([], [[r, 0], [r, 1], [r, 2]]));
  }
  step("row.reverse()", "Done: the matrix is rotated 90° clockwise.", view());
  return steps;
}

// ---- Bit Manipulation: count 1-bits with n & (n - 1) ----
function bits() {
  const { steps, step } = recorder("bits");
  let n = 44;
  let count = 0;
  const low = (x: number) => (x ? Math.log2(x & -x) : -1);
  const view = (rows: { label: string; value: number }[], hl: number[] = []) => [
    { t: "bits", rows, width: 8, hl } as Panel,
    { t: "vars", vars: [["n", n], ["count", count]] } as Panel,
  ];
  step("count = 0", `n = ${n} = 0b${n.toString(2)}.`, view([{ label: "n", value: n }]));
  while (n) {
    step("while n", `n = ${n} isn't 0. Its lowest 1-bit is bit ${low(n)}.`, view([{ label: "n", value: n }], [low(n)]));
    const before = n;
    n &= n - 1;
    step("n &= n - 1", `n − 1 flips that bit and everything below it, so n & (n − 1) clears just that bit.`, view([
      { label: "n", value: before },
      { label: "n − 1", value: before - 1 },
      { label: "n & (n−1)", value: n },
    ], [low(before)]));
    count++;
    step("count += 1", `count = ${count}.`, view([{ label: "n", value: n }]));
  }
  step("return count", `${count} one-bits: one loop per 1-bit, not per bit.`, view([{ label: "n", value: n }]));
  return steps;
}

const TRACERS: Record<string, () => Step[]> = {
  arrays,
  twoPointers,
  stack,
  binarySearch,
  slidingWindow,
  linkedList,
  trees,
  tries,
  heap,
  backtracking,
  graphs,
  advGraphs,
  oneDP,
  twoDP,
  greedy,
  intervals,
  math,
  bits,
};

const cache = new Map<string, Step[]>();
export function traceFor(id: string): Step[] {
  if (!cache.has(id)) cache.set(id, TRACERS[id]?.() || []);
  return cache.get(id)!;
}
