// The NeetCode 150 judge, shared by the server (which runs our reference solutions to get each test's
// expected answer) and the browser (which runs the student's JavaScript and compares answers).
//
// A test case is LeetCode's format: one JSON value per line, one line per parameter. Answers are
// plain JSON: linked lists become arrays, trees become level-order arrays with trailing nulls removed.

// ---- Data structures (LeetCode's JavaScript definitions) ----

export function ListNode(val, next) {
  this.val = val === undefined ? 0 : val;
  this.next = next === undefined ? null : next;
}

export function TreeNode(val, left, right) {
  this.val = val === undefined ? 0 : val;
  this.left = left === undefined ? null : left;
  this.right = right === undefined ? null : right;
}

// Copy List with Random Pointer uses (val, next, random); Clone Graph uses (val, neighbors).
export function _Node(val, a, b) {
  this.val = val === undefined ? 0 : val;
  if (Array.isArray(a)) {
    this.neighbors = a;
  } else {
    this.next = a === undefined ? null : a;
    this.random = b === undefined ? null : b;
    this.neighbors = [];
  }
}

export function buildList(arr) {
  const dummy = new ListNode();
  let t = dummy;
  for (const v of arr || []) t = t.next = new ListNode(v);
  return dummy.next;
}

export function listToArray(head) {
  const out = [];
  for (let n = head, i = 0; n; n = n.next, i++) {
    if (i > 100000) throw new Error("The returned list has a cycle.");
    out.push(n.val);
  }
  return out;
}

export function buildTree(arr) {
  if (!arr || !arr.length || arr[0] === null) return null;
  const root = new TreeNode(arr[0]);
  const q = [root];
  let i = 1;
  for (let h = 0; h < q.length && i < arr.length; h++) {
    const node = q[h];
    if (i < arr.length && arr[i] !== null) q.push((node.left = new TreeNode(arr[i])));
    i++;
    if (i < arr.length && arr[i] !== null) q.push((node.right = new TreeNode(arr[i])));
    i++;
  }
  return root;
}

export function treeToArray(root) {
  const out = [];
  const q = [root];
  for (let h = 0; h < q.length; h++) {
    if (h > 200000) throw new Error("The returned tree is too big (or has a cycle).");
    const n = q[h];
    if (n) {
      out.push(n.val);
      q.push(n.left, n.right);
    } else out.push(null);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

// ---- Priority queues (LeetCode's JavaScript runtime ships @datastructures-js/priority-queue) ----

class Heap {
  constructor(cmp) {
    this.a = [];
    this.cmp = cmp;
  }
  size() {
    return this.a.length;
  }
  isEmpty() {
    return !this.a.length;
  }
  front() {
    return this.a.length ? this.a[0] : null;
  }
  toArray() {
    return [...this.a].sort(this.cmp);
  }
  clear() {
    this.a = [];
  }
  enqueue(x) {
    const a = this.a;
    a.push(x);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (this.cmp(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
    return this;
  }
  push(x) {
    return this.enqueue(x);
  }
  dequeue() {
    const a = this.a;
    if (!a.length) return null;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.cmp(a[l], a[m]) < 0) m = l;
        if (r < a.length && this.cmp(a[r], a[m]) < 0) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
  pop() {
    return this.dequeue();
  }
}

const keyed = (opt, sign) => {
  const key = typeof opt === "function" ? opt : opt?.priority || ((x) => x);
  return (x, y) => sign * (key(x) - key(y));
};
export class MinPriorityQueue extends Heap {
  constructor(opt) {
    super(keyed(opt, 1));
  }
}
export class MaxPriorityQueue extends Heap {
  constructor(opt) {
    super(keyed(opt, -1));
  }
}
export class PriorityQueue extends Heap {
  constructor(opt) {
    super(typeof opt === "function" ? opt : opt?.compare || ((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
  }
}

// ---- Test cases ----

export function parseCase(text) {
  return String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

export const isDesign = (meta) => !!meta.classname;

/** What the student's code must define, so the runner can pull it out by name. */
export function entryNames(slug, meta) {
  if (slug === "serialize-and-deserialize-binary-tree") return ["serialize", "deserialize", "Codec"];
  if (slug === "encode-and-decode-strings") return ["encode", "decode", "Codec"];
  if (isDesign(meta)) return [meta.classname];
  return [meta.name, "Solution"];
}

const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

function buildArg(type, value) {
  if (type === "ListNode") return buildList(value);
  if (type === "ListNode[]") return (value || []).map(buildList);
  if (type === "TreeNode") return buildTree(value);
  return clone(value);
}

function serialize(type, value) {
  if (type === "void") return null;
  if (type === "ListNode") return listToArray(value);
  if (type === "TreeNode") return treeToArray(value);
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value, (_k, v) => (v instanceof Set ? [...v] : v)));
}

function findNode(root, val) {
  const st = [root];
  while (st.length) {
    const n = st.pop();
    if (!n) continue;
    if (n.val === val) return n;
    st.push(n.left, n.right);
  }
  return null;
}

/**
 * Runs one test case against JavaScript code: `entry` maps names from entryNames() to what the code
 * defined. Returns the answer as plain JSON.
 */
export function runCase(slug, meta, entry, args) {
  const fn = (name) => {
    if (typeof entry[name] === "function") return entry[name];
    const Sol = entry.Solution;
    if (typeof Sol === "function") {
      const s = new Sol();
      if (typeof s[name] === "function") return s[name].bind(s);
    }
    throw new Error(`Define a function named ${name}.`);
  };

  if (slug === "serialize-and-deserialize-binary-tree") {
    let ser = entry.serialize;
    let des = entry.deserialize;
    if (!ser && entry.Codec) {
      const c = new entry.Codec();
      ser = c.serialize.bind(c);
      des = c.deserialize.bind(c);
    }
    if (!ser || !des) throw new Error("Define serialize and deserialize.");
    const s = ser(buildTree(args[0]));
    if (typeof s !== "string") throw new Error("serialize must return a string.");
    return treeToArray(des(s));
  }
  if (slug === "encode-and-decode-strings") {
    let enc = entry.encode;
    let dec = entry.decode;
    if (!enc && entry.Codec) {
      const c = new entry.Codec();
      enc = c.encode.bind(c);
      dec = c.decode.bind(c);
    }
    if (!enc || !dec) throw new Error("Define encode and decode.");
    const s = enc(clone(args[0]));
    if (typeof s !== "string") throw new Error("encode must return a string.");
    return dec(s);
  }

  if (isDesign(meta)) {
    const Cls = entry[meta.classname];
    if (typeof Cls !== "function") throw new Error(`Define the ${meta.classname} class.`);
    const [ops, opArgs] = args;
    const out = [null];
    const obj = new Cls(...clone(opArgs[0] || []));
    for (let i = 1; i < ops.length; i++) {
      if (typeof obj[ops[i]] !== "function") throw new Error(`${meta.classname} needs a ${ops[i]} method.`);
      const m = meta.methods.find((x) => x.name === ops[i]);
      const r = obj[ops[i]](...clone(opArgs[i] || []));
      out.push(serialize(m?.return?.type || "", r));
    }
    return out;
  }

  const f = fn(meta.name);

  if (slug === "linked-list-cycle") {
    const head = buildList(args[0]);
    if (args[1] >= 0) {
      let tail = head;
      let at = null;
      for (let i = 0; tail; i++) {
        if (i === args[1]) at = tail;
        if (!tail.next) break;
        tail = tail.next;
      }
      if (tail) tail.next = at;
    }
    return f(head);
  }
  if (slug === "lowest-common-ancestor-of-a-binary-search-tree") {
    const root = buildTree(args[0]);
    const r = f(root, findNode(root, args[1]), findNode(root, args[2]));
    return r ? r.val : null;
  }
  if (slug === "copy-list-with-random-pointer") {
    const nodes = (args[0] || []).map(([v]) => new _Node(v, null, null));
    nodes.forEach((n, i) => {
      n.next = nodes[i + 1] || null;
      n.random = args[0][i][1] === null ? null : nodes[args[0][i][1]];
    });
    const orig = new Set(nodes);
    const res = f(nodes[0] || null);
    const out = [];
    const idx = new Map();
    for (let n = res, i = 0; n; n = n.next, i++) {
      if (orig.has(n)) throw new Error("The copy reuses nodes from the original list. Build new nodes.");
      if (i > 100000) throw new Error("The returned list has a cycle.");
      idx.set(n, i);
      out.push(n);
    }
    return out.map((n) => [n.val, n.random ? (idx.get(n.random) ?? -1) : null]);
  }
  if (slug === "clone-graph") {
    const adj = args[0] || [];
    const nodes = adj.map((_, i) => new _Node(i + 1, []));
    adj.forEach((nb, i) => (nodes[i].neighbors = nb.map((v) => nodes[v - 1])));
    const orig = new Set(nodes);
    const res = f(nodes[0] || null);
    if (!res) return [];
    const seen = new Map();
    const q = [res];
    seen.set(res.val, res);
    for (let h = 0; h < q.length; h++) {
      if (orig.has(q[h])) throw new Error("The clone reuses nodes from the original graph. Build new nodes.");
      for (const nb of q[h].neighbors || [])
        if (!seen.has(nb.val)) {
          seen.set(nb.val, nb);
          q.push(nb);
        }
    }
    const n = Math.max(...seen.keys());
    return Array.from({ length: n }, (_, i) => (seen.get(i + 1)?.neighbors || []).map((x) => x.val));
  }

  const built = meta.params.map((p, i) => buildArg(p.type, args[i]));
  const ret = f(...built);
  const pi = meta.output?.paramindex;
  if (meta.return.type === "void" && pi !== undefined) return serialize(meta.params[pi].type, built[pi]);
  return serialize(meta.return.type, ret);
}

// ---- Comparing answers ----

const canon = (v) => JSON.stringify(v);
const sortCanon = (arr) => [...arr].sort((a, b) => (canon(a) < canon(b) ? -1 : canon(a) > canon(b) ? 1 : 0));

function equal(a, b, float) {
  if (float && typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b));
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equal(x, b[i], float));
  return canon(a) === canon(b);
}

function topoOk(args, out) {
  const [n, pre] = args;
  if (!Array.isArray(out)) return false;
  if (out.length === 0) return null; // only right if there's no valid order (checked by caller)
  if (out.length !== n || new Set(out).size !== n || out.some((x) => !Number.isInteger(x) || x < 0 || x >= n)) return false;
  const pos = new Map(out.map((c, i) => [c, i]));
  return pre.every(([a, b]) => pos.get(b) < pos.get(a));
}

function alienOk(args, out) {
  const words = args[0];
  if (typeof out !== "string") return false;
  const letters = new Set(words.join(""));
  if (out.length !== letters.size || new Set(out).size !== out.length || [...out].some((c) => !letters.has(c))) return false;
  const pos = new Map([...out].map((c, i) => [c, i]));
  for (let i = 0; i + 1 < words.length; i++) {
    const [a, b] = [words[i], words[i + 1]];
    let j = 0;
    while (j < a.length && j < b.length && a[j] === b[j]) j++;
    if (j < a.length && j < b.length) {
      if (pos.get(a[j]) >= pos.get(b[j])) return false;
    } else if (a.length > b.length) return false;
  }
  return true;
}

/** True if `actual` is an accepted answer. `mode` is the problem's judge setting from problems.js. */
export function accepts(mode, expected, actual, args) {
  try {
    if (mode === "topo") return expected.length === 0 ? Array.isArray(actual) && actual.length === 0 : topoOk(args, actual) === true;
    if (mode === "alien") return expected === "" ? actual === "" : alienOk(args, actual);
    if (mode === "longestPal") {
      const str = args[0];
      return typeof actual === "string" && actual.length === expected.length && str.includes(actual) && [...actual].reverse().join("") === actual;
    }
    if (!Array.isArray(expected) || !Array.isArray(actual)) return equal(actual, expected, mode === "float");
    if (mode === "anyOrder") return equal(sortCanon(actual), sortCanon(expected));
    if (mode === "outer") return equal(sortCanon(actual), sortCanon(expected));
    if (mode === "deep") {
      const norm = (x) => sortCanon(x.map((y) => (Array.isArray(y) ? sortCanon(y) : y)));
      return equal(norm(actual), norm(expected));
    }
    return equal(actual, expected, mode === "float");
  } catch {
    return false;
  }
}
