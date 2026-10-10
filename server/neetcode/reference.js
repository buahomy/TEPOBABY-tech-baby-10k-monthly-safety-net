// Reference solutions for the NeetCode 150, used only to compute each test case's expected answer.
// They're never sent to the browser. `npm run check:neetcode` verifies every one against the
// example outputs on LeetCode's problem pages.
//
// Each entry is the function (or class) LeetCode asks for, or an object of functions for the
// two-function problems (serialize/deserialize, encode/decode).

import { ListNode, TreeNode, _Node } from "../../shared/ncJudge.js";

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

class MinHeap {
  constructor(cmp = (a, b) => a - b) {
    this.a = [];
    this.cmp = cmp;
  }
  get size() {
    return this.a.length;
  }
  peek() {
    return this.a[0];
  }
  push(x) {
    const a = this.a;
    a.push(x);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (this.cmp(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
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
}

function makeUF(n) {
  const par = Array.from({ length: n }, (_, i) => i);
  const find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
  const union = (a, b) => {
    const [x, y] = [find(a), find(b)];
    if (x === y) return false;
    par[x] = y;
    return true;
  };
  return { find, union };
}

export const REFERENCE = {
  // ---- Arrays & Hashing ----
  "contains-duplicate": (nums) => new Set(nums).size !== nums.length,
  "valid-anagram": (s, t) => [...s].sort().join("") === [...t].sort().join(""),
  "two-sum": (nums, target) => {
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
      if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
      seen.set(nums[i], i);
    }
    return [];
  },
  "group-anagrams": (strs) => {
    const g = new Map();
    for (const s of strs) {
      const k = [...s].sort().join("");
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(s);
    }
    return [...g.values()];
  },
  "top-k-frequent-elements": (nums, k) => {
    const c = new Map();
    for (const n of nums) c.set(n, (c.get(n) || 0) + 1);
    return [...c.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map((e) => e[0]);
  },
  "encode-and-decode-strings": {
    encode: (strs) => strs.map((s) => `${s.length}#${s}`).join(""),
    decode: (s) => {
      const out = [];
      for (let i = 0; i < s.length; ) {
        const j = s.indexOf("#", i);
        const len = Number(s.slice(i, j));
        out.push(s.slice(j + 1, j + 1 + len));
        i = j + 1 + len;
      }
      return out;
    },
  },
  "product-of-array-except-self": (nums) => {
    const n = nums.length;
    const out = new Array(n).fill(1);
    for (let i = 1; i < n; i++) out[i] = out[i - 1] * nums[i - 1];
    for (let i = n - 1, suf = 1; i >= 0; i--) {
      out[i] *= suf;
      suf *= nums[i];
    }
    return out.map((x) => (x === 0 ? 0 : x)); // no -0
  },
  "valid-sudoku": (board) => {
    const seen = new Set();
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++) {
        const v = board[r][c];
        if (v === ".") continue;
        const keys = [`r${r}${v}`, `c${c}${v}`, `b${Math.floor(r / 3)}${Math.floor(c / 3)}${v}`];
        if (keys.some((k) => seen.has(k))) return false;
        keys.forEach((k) => seen.add(k));
      }
    return true;
  },
  "longest-consecutive-sequence": (nums) => {
    const s = new Set(nums);
    let best = 0;
    for (const n of s)
      if (!s.has(n - 1)) {
        let len = 1;
        while (s.has(n + len)) len++;
        best = Math.max(best, len);
      }
    return best;
  },

  // ---- Two Pointers ----
  "valid-palindrome": (s) => {
    const t = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    return t === [...t].reverse().join("");
  },
  "two-sum-ii-input-array-is-sorted": (numbers, target) => {
    let [l, r] = [0, numbers.length - 1];
    while (l < r) {
      const s = numbers[l] + numbers[r];
      if (s === target) return [l + 1, r + 1];
      if (s < target) l++;
      else r--;
    }
    return [];
  },
  "3sum": (nums) => {
    const a = [...nums].sort((x, y) => x - y);
    const out = [];
    for (let i = 0; i < a.length; i++) {
      if (i && a[i] === a[i - 1]) continue;
      let [l, r] = [i + 1, a.length - 1];
      while (l < r) {
        const s = a[i] + a[l] + a[r];
        if (s < 0) l++;
        else if (s > 0) r--;
        else {
          out.push([a[i], a[l], a[r]]);
          l++;
          while (l < r && a[l] === a[l - 1]) l++;
        }
      }
    }
    return out;
  },
  "container-with-most-water": (height) => {
    let [l, r, best] = [0, height.length - 1, 0];
    while (l < r) {
      best = Math.max(best, (r - l) * Math.min(height[l], height[r]));
      if (height[l] < height[r]) l++;
      else r--;
    }
    return best;
  },
  "trapping-rain-water": (height) => {
    let [l, r, lm, rm, w] = [0, height.length - 1, 0, 0, 0];
    while (l < r) {
      if (height[l] < height[r]) {
        lm = Math.max(lm, height[l]);
        w += lm - height[l++];
      } else {
        rm = Math.max(rm, height[r]);
        w += rm - height[r--];
      }
    }
    return w;
  },

  // ---- Sliding Window ----
  "best-time-to-buy-and-sell-stock": (prices) => {
    let [low, best] = [Infinity, 0];
    for (const p of prices) {
      low = Math.min(low, p);
      best = Math.max(best, p - low);
    }
    return best;
  },
  "longest-substring-without-repeating-characters": (s) => {
    const last = new Map();
    let [l, best] = [0, 0];
    for (let r = 0; r < s.length; r++) {
      if (last.has(s[r]) && last.get(s[r]) >= l) l = last.get(s[r]) + 1;
      last.set(s[r], r);
      best = Math.max(best, r - l + 1);
    }
    return best;
  },
  "longest-repeating-character-replacement": (s, k) => {
    const cnt = {};
    let [l, top, best] = [0, 0, 0];
    for (let r = 0; r < s.length; r++) {
      cnt[s[r]] = (cnt[s[r]] || 0) + 1;
      top = Math.max(top, cnt[s[r]]);
      while (r - l + 1 - top > k) cnt[s[l++]]--;
      best = Math.max(best, r - l + 1);
    }
    return best;
  },
  "permutation-in-string": (s1, s2) => {
    const key = (s) => [...s].sort().join("");
    const want = key(s1);
    for (let i = 0; i + s1.length <= s2.length; i++) if (key(s2.slice(i, i + s1.length)) === want) return true;
    return false;
  },
  "minimum-window-substring": (s, t) => {
    const need = {};
    for (const c of t) need[c] = (need[c] || 0) + 1;
    let missing = t.length;
    let [l, bestL, bestLen] = [0, 0, Infinity];
    for (let r = 0; r < s.length; r++) {
      if (need[s[r]] > 0) missing--;
      need[s[r]] = (need[s[r]] || 0) - 1;
      while (missing === 0) {
        if (r - l + 1 < bestLen) [bestL, bestLen] = [l, r - l + 1];
        need[s[l]]++;
        if (need[s[l]] > 0) missing++;
        l++;
      }
    }
    return bestLen === Infinity ? "" : s.slice(bestL, bestL + bestLen);
  },
  "sliding-window-maximum": (nums, k) => {
    const dq = [];
    const out = [];
    let h = 0;
    for (let i = 0; i < nums.length; i++) {
      while (dq.length > h && nums[dq[dq.length - 1]] <= nums[i]) dq.pop();
      dq.push(i);
      if (dq[h] <= i - k) h++;
      if (i >= k - 1) out.push(nums[dq[h]]);
    }
    return out;
  },

  // ---- Stack ----
  "valid-parentheses": (s) => {
    const st = [];
    const pair = { ")": "(", "]": "[", "}": "{" };
    for (const c of s) {
      if (pair[c]) {
        if (st.pop() !== pair[c]) return false;
      } else st.push(c);
    }
    return st.length === 0;
  },
  "min-stack": class {
    constructor() {
      this.s = [];
    }
    push(v) {
      this.s.push([v, this.s.length ? Math.min(v, this.s[this.s.length - 1][1]) : v]);
    }
    pop() {
      this.s.pop();
    }
    top() {
      return this.s[this.s.length - 1][0];
    }
    getMin() {
      return this.s[this.s.length - 1][1];
    }
  },
  "evaluate-reverse-polish-notation": (tokens) => {
    const st = [];
    for (const t of tokens) {
      if (!"+-*/".includes(t) || t.length > 1) st.push(Number(t));
      else {
        const b = st.pop();
        const a = st.pop();
        st.push(t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : Math.trunc(a / b));
      }
    }
    return st[0] === 0 ? 0 : st[0];
  },
  "generate-parentheses": (n) => {
    const out = [];
    const go = (s, open, close) => {
      if (s.length === 2 * n) return out.push(s);
      if (open < n) go(s + "(", open + 1, close);
      if (close < open) go(s + ")", open, close + 1);
    };
    go("", 0, 0);
    return out;
  },
  "daily-temperatures": (temps) => {
    const out = new Array(temps.length).fill(0);
    const st = [];
    temps.forEach((t, i) => {
      while (st.length && temps[st[st.length - 1]] < t) {
        const j = st.pop();
        out[j] = i - j;
      }
      st.push(i);
    });
    return out;
  },
  "car-fleet": (target, position, speed) => {
    const cars = position.map((p, i) => [p, (target - p) / speed[i]]).sort((a, b) => b[0] - a[0]);
    let fleets = 0;
    let slowest = 0;
    for (const [, t] of cars)
      if (t > slowest) {
        fleets++;
        slowest = t;
      }
    return fleets;
  },
  "largest-rectangle-in-histogram": (heights) => {
    const st = [];
    let best = 0;
    const h = [...heights, 0];
    for (let i = 0; i < h.length; i++) {
      let start = i;
      while (st.length && st[st.length - 1][1] > h[i]) {
        const [j, hh] = st.pop();
        best = Math.max(best, hh * (i - j));
        start = j;
      }
      st.push([start, h[i]]);
    }
    return best;
  },

  // ---- Binary Search ----
  "binary-search": (nums, target) => {
    let [l, r] = [0, nums.length - 1];
    while (l <= r) {
      const m = (l + r) >> 1;
      if (nums[m] === target) return m;
      if (nums[m] < target) l = m + 1;
      else r = m - 1;
    }
    return -1;
  },
  "search-a-2d-matrix": (matrix, target) => matrix.some((row) => row.includes(target)),
  "koko-eating-bananas": (piles, h) => {
    let [l, r] = [1, Math.max(...piles)];
    while (l < r) {
      const k = Math.floor((l + r) / 2);
      const hours = piles.reduce((s, p) => s + Math.ceil(p / k), 0);
      if (hours <= h) r = k;
      else l = k + 1;
    }
    return l;
  },
  "find-minimum-in-rotated-sorted-array": (nums) => Math.min(...nums),
  "search-in-rotated-sorted-array": (nums, target) => nums.indexOf(target),
  "time-based-key-value-store": class {
    constructor() {
      this.m = new Map();
    }
    set(key, value, timestamp) {
      if (!this.m.has(key)) this.m.set(key, []);
      this.m.get(key).push([timestamp, value]);
    }
    get(key, timestamp) {
      const arr = this.m.get(key) || [];
      let res = "";
      let [l, r] = [0, arr.length - 1];
      while (l <= r) {
        const m = (l + r) >> 1;
        if (arr[m][0] <= timestamp) {
          res = arr[m][1];
          l = m + 1;
        } else r = m - 1;
      }
      return res;
    }
  },
  "median-of-two-sorted-arrays": (a, b) => {
    const m = [...a, ...b].sort((x, y) => x - y);
    const n = m.length;
    return n % 2 ? m[(n - 1) / 2] : (m[n / 2 - 1] + m[n / 2]) / 2;
  },

  // ---- Linked List ----
  "reverse-linked-list": (head) => {
    let prev = null;
    while (head) [head.next, prev, head] = [prev, head, head.next];
    return prev;
  },
  "merge-two-sorted-lists": (a, b) => {
    const d = new ListNode();
    let t = d;
    while (a && b) {
      if (a.val <= b.val) [t.next, a] = [a, a.next];
      else [t.next, b] = [b, b.next];
      t = t.next;
    }
    t.next = a || b;
    return d.next;
  },
  "linked-list-cycle": (head) => {
    let [s, f] = [head, head];
    while (f && f.next) {
      s = s.next;
      f = f.next.next;
      if (s === f) return true;
    }
    return false;
  },
  "reorder-list": (head) => {
    const nodes = [];
    for (let n = head; n; n = n.next) nodes.push(n);
    let [i, j] = [0, nodes.length - 1];
    while (i < j) {
      nodes[i].next = nodes[j];
      i++;
      if (i === j) break;
      nodes[j].next = nodes[i];
      j--;
    }
    if (nodes.length) nodes[i].next = null;
  },
  "remove-nth-node-from-end-of-list": (head, n) => {
    const d = new ListNode(0, head);
    let [a, b] = [d, d];
    for (let i = 0; i <= n; i++) b = b.next;
    while (b) [a, b] = [a.next, b.next];
    a.next = a.next.next;
    return d.next;
  },
  "copy-list-with-random-pointer": (head) => {
    const m = new Map([[null, null]]);
    for (let n = head; n; n = n.next) m.set(n, new _Node(n.val, null, null));
    for (let n = head; n; n = n.next) {
      m.get(n).next = m.get(n.next);
      m.get(n).random = m.get(n.random);
    }
    return m.get(head);
  },
  "add-two-numbers": (a, b) => {
    const d = new ListNode();
    let [t, carry] = [d, 0];
    while (a || b || carry) {
      const s = (a?.val || 0) + (b?.val || 0) + carry;
      carry = Math.floor(s / 10);
      t = t.next = new ListNode(s % 10);
      a = a?.next;
      b = b?.next;
    }
    return d.next;
  },
  "find-the-duplicate-number": (nums) => {
    const seen = new Set();
    for (const n of nums) {
      if (seen.has(n)) return n;
      seen.add(n);
    }
    return -1;
  },
  "lru-cache": class {
    constructor(capacity) {
      this.cap = capacity;
      this.m = new Map();
    }
    get(key) {
      if (!this.m.has(key)) return -1;
      const v = this.m.get(key);
      this.m.delete(key);
      this.m.set(key, v);
      return v;
    }
    put(key, value) {
      this.m.delete(key);
      this.m.set(key, value);
      if (this.m.size > this.cap) this.m.delete(this.m.keys().next().value);
    }
  },
  "merge-k-sorted-lists": (lists) => {
    const vals = [];
    for (let n of lists) for (; n; n = n.next) vals.push(n.val);
    vals.sort((a, b) => a - b);
    const d = new ListNode();
    let t = d;
    for (const v of vals) t = t.next = new ListNode(v);
    return d.next;
  },
  "reverse-nodes-in-k-group": (head, k) => {
    const vals = [];
    for (let n = head; n; n = n.next) vals.push(n.val);
    for (let i = 0; i + k <= vals.length; i += k) vals.splice(i, k, ...vals.slice(i, i + k).reverse());
    const d = new ListNode();
    let t = d;
    for (const v of vals) t = t.next = new ListNode(v);
    return d.next;
  },

  // ---- Trees ----
  "invert-binary-tree": function invert(root) {
    if (!root) return null;
    [root.left, root.right] = [invert(root.right), invert(root.left)];
    return root;
  },
  "maximum-depth-of-binary-tree": function depth(root) {
    return root ? 1 + Math.max(depth(root.left), depth(root.right)) : 0;
  },
  "diameter-of-binary-tree": (root) => {
    let best = 0;
    const h = (n) => {
      if (!n) return 0;
      const [l, r] = [h(n.left), h(n.right)];
      best = Math.max(best, l + r);
      return 1 + Math.max(l, r);
    };
    h(root);
    return best;
  },
  "balanced-binary-tree": (root) => {
    const h = (n) => {
      if (!n) return 0;
      const [l, r] = [h(n.left), h(n.right)];
      if (l < 0 || r < 0 || Math.abs(l - r) > 1) return -1;
      return 1 + Math.max(l, r);
    };
    return h(root) >= 0;
  },
  "same-tree": function same(p, q) {
    if (!p || !q) return p === q;
    return p.val === q.val && same(p.left, q.left) && same(p.right, q.right);
  },
  "subtree-of-another-tree": (root, sub) => {
    const same = (p, q) => (!p || !q ? p === q : p.val === q.val && same(p.left, q.left) && same(p.right, q.right));
    const go = (n) => !!n && (same(n, sub) || go(n.left) || go(n.right));
    return go(root);
  },
  "lowest-common-ancestor-of-a-binary-search-tree": (root, p, q) => {
    let n = root;
    while (n) {
      if (p.val < n.val && q.val < n.val) n = n.left;
      else if (p.val > n.val && q.val > n.val) n = n.right;
      else return n;
    }
    return null;
  },
  "binary-tree-level-order-traversal": (root) => {
    const out = [];
    let level = root ? [root] : [];
    while (level.length) {
      out.push(level.map((n) => n.val));
      level = level.flatMap((n) => [n.left, n.right]).filter(Boolean);
    }
    return out;
  },
  "binary-tree-right-side-view": (root) => {
    const out = [];
    let level = root ? [root] : [];
    while (level.length) {
      out.push(level[level.length - 1].val);
      level = level.flatMap((n) => [n.left, n.right]).filter(Boolean);
    }
    return out;
  },
  "count-good-nodes-in-binary-tree": (root) => {
    const go = (n, mx) => (n ? (n.val >= mx ? 1 : 0) + go(n.left, Math.max(mx, n.val)) + go(n.right, Math.max(mx, n.val)) : 0);
    return go(root, -Infinity);
  },
  "validate-binary-search-tree": (root) => {
    const go = (n, lo, hi) => !n || (n.val > lo && n.val < hi && go(n.left, lo, n.val) && go(n.right, n.val, hi));
    return go(root, -Infinity, Infinity);
  },
  "kth-smallest-element-in-a-bst": (root, k) => {
    const vals = [];
    const go = (n) => {
      if (!n) return;
      go(n.left);
      vals.push(n.val);
      go(n.right);
    };
    go(root);
    return vals[k - 1];
  },
  "construct-binary-tree-from-preorder-and-inorder-traversal": (preorder, inorder) => {
    const idx = new Map(inorder.map((v, i) => [v, i]));
    let p = 0;
    const go = (l, r) => {
      if (l > r) return null;
      const node = new TreeNode(preorder[p++]);
      const m = idx.get(node.val);
      node.left = go(l, m - 1);
      node.right = go(m + 1, r);
      return node;
    };
    return go(0, inorder.length - 1);
  },
  "binary-tree-maximum-path-sum": (root) => {
    let best = -Infinity;
    const go = (n) => {
      if (!n) return 0;
      const l = Math.max(0, go(n.left));
      const r = Math.max(0, go(n.right));
      best = Math.max(best, n.val + l + r);
      return n.val + Math.max(l, r);
    };
    go(root);
    return best;
  },
  "serialize-and-deserialize-binary-tree": {
    serialize: (root) => {
      const out = [];
      const go = (n) => {
        if (!n) return out.push("N");
        out.push(n.val);
        go(n.left);
        go(n.right);
      };
      go(root);
      return out.join(",");
    },
    deserialize: (data) => {
      const t = data.split(",");
      let i = 0;
      const go = () => {
        const v = t[i++];
        if (v === "N") return null;
        const n = new TreeNode(Number(v));
        n.left = go();
        n.right = go();
        return n;
      };
      return go();
    },
  },

  // ---- Tries ----
  "implement-trie-prefix-tree": class {
    constructor() {
      this.words = new Set();
      this.prefixes = new Set();
    }
    insert(w) {
      this.words.add(w);
      for (let i = 0; i <= w.length; i++) this.prefixes.add(w.slice(0, i));
    }
    search(w) {
      return this.words.has(w);
    }
    startsWith(p) {
      return this.prefixes.has(p);
    }
  },
  "design-add-and-search-words-data-structure": class {
    constructor() {
      this.words = [];
    }
    addWord(w) {
      this.words.push(w);
    }
    search(w) {
      return this.words.some((x) => x.length === w.length && [...w].every((c, i) => c === "." || c === x[i]));
    }
  },
  "word-search-ii": (board, words) => {
    const root = {};
    for (const w of words) {
      let n = root;
      for (const c of w) n = n[c] = n[c] || {};
      n.$ = w;
    }
    const out = new Set();
    const [R, C] = [board.length, board[0].length];
    const go = (r, c, node) => {
      if (r < 0 || c < 0 || r >= R || c >= C) return;
      const ch = board[r][c];
      const nx = node[ch];
      if (!nx) return;
      if (nx.$) out.add(nx.$);
      board[r][c] = "#";
      for (const [dr, dc] of DIRS) go(r + dr, c + dc, nx);
      board[r][c] = ch;
    };
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) go(r, c, root);
    return [...out];
  },

  // ---- Heap / Priority Queue ----
  "kth-largest-element-in-a-stream": class {
    constructor(k, nums) {
      this.k = k;
      this.a = [...nums];
    }
    add(v) {
      this.a.push(v);
      this.a.sort((x, y) => y - x);
      return this.a[this.k - 1];
    }
  },
  "last-stone-weight": (stones) => {
    const a = [...stones];
    while (a.length > 1) {
      a.sort((x, y) => x - y);
      const y = a.pop();
      const x = a.pop();
      if (y !== x) a.push(y - x);
    }
    return a[0] || 0;
  },
  "k-closest-points-to-origin": (points, k) =>
    [...points].sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2)).slice(0, k),
  "kth-largest-element-in-an-array": (nums, k) => [...nums].sort((a, b) => b - a)[k - 1],
  "task-scheduler": (tasks, n) => {
    const cnt = {};
    for (const t of tasks) cnt[t] = (cnt[t] || 0) + 1;
    const f = Object.values(cnt);
    const mx = Math.max(...f);
    const top = f.filter((x) => x === mx).length;
    return Math.max(tasks.length, (mx - 1) * (n + 1) + top);
  },
  "design-twitter": class {
    constructor() {
      this.t = 0;
      this.tweets = [];
      this.follows = new Map();
    }
    postTweet(u, id) {
      this.tweets.push([this.t++, u, id]);
    }
    getNewsFeed(u) {
      const f = this.follows.get(u) || new Set();
      return this.tweets
        .filter(([, a]) => a === u || f.has(a))
        .slice(-10)
        .reverse()
        .map((x) => x[2]);
    }
    follow(a, b) {
      if (a === b) return;
      if (!this.follows.has(a)) this.follows.set(a, new Set());
      this.follows.get(a).add(b);
    }
    unfollow(a, b) {
      this.follows.get(a)?.delete(b);
    }
  },
  "find-median-from-data-stream": class {
    constructor() {
      this.a = [];
    }
    addNum(n) {
      let [l, r] = [0, this.a.length];
      while (l < r) {
        const m = (l + r) >> 1;
        if (this.a[m] < n) l = m + 1;
        else r = m;
      }
      this.a.splice(l, 0, n);
    }
    findMedian() {
      const a = this.a;
      const n = a.length;
      return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
    }
  },

  // ---- Backtracking ----
  subsets: (nums) => {
    const out = [[]];
    for (const n of nums) out.push(...out.map((s) => [...s, n]));
    return out;
  },
  "combination-sum": (cands, target) => {
    const out = [];
    const go = (i, rest, path) => {
      if (rest === 0) return out.push([...path]);
      if (i >= cands.length || rest < 0) return;
      path.push(cands[i]);
      go(i, rest - cands[i], path);
      path.pop();
      go(i + 1, rest, path);
    };
    go(0, target, []);
    return out;
  },
  "combination-sum-ii": (cands, target) => {
    const a = [...cands].sort((x, y) => x - y);
    const out = [];
    const go = (i, rest, path) => {
      if (rest === 0) return out.push([...path]);
      for (let j = i; j < a.length && a[j] <= rest; j++) {
        if (j > i && a[j] === a[j - 1]) continue;
        path.push(a[j]);
        go(j + 1, rest - a[j], path);
        path.pop();
      }
    };
    go(0, target, []);
    return out;
  },
  permutations: (nums) => {
    if (nums.length <= 1) return [[...nums]];
    return nums.flatMap((n, i) => REFERENCE.permutations([...nums.slice(0, i), ...nums.slice(i + 1)]).map((p) => [n, ...p]));
  },
  "subsets-ii": (nums) => {
    const a = [...nums].sort((x, y) => x - y);
    const seen = new Set();
    const out = [];
    for (let mask = 0; mask < 1 << a.length; mask++) {
      const s = a.filter((_, i) => mask & (1 << i));
      const k = s.join(",");
      if (!seen.has(k)) {
        seen.add(k);
        out.push(s);
      }
    }
    return out;
  },
  "word-search": (board, word) => {
    const [R, C] = [board.length, board[0].length];
    const go = (r, c, i) => {
      if (i === word.length) return true;
      if (r < 0 || c < 0 || r >= R || c >= C || board[r][c] !== word[i]) return false;
      const ch = board[r][c];
      board[r][c] = "#";
      const ok = DIRS.some(([dr, dc]) => go(r + dr, c + dc, i + 1));
      board[r][c] = ch;
      return ok;
    };
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (go(r, c, 0)) return true;
    return false;
  },
  "palindrome-partitioning": (s) => {
    const out = [];
    const pal = (t) => t === [...t].reverse().join("");
    const go = (i, path) => {
      if (i === s.length) return out.push([...path]);
      for (let j = i + 1; j <= s.length; j++)
        if (pal(s.slice(i, j))) {
          path.push(s.slice(i, j));
          go(j, path);
          path.pop();
        }
    };
    go(0, []);
    return out;
  },
  "letter-combinations-of-a-phone-number": (digits) => {
    if (!digits) return [];
    const map = { 2: "abc", 3: "def", 4: "ghi", 5: "jkl", 6: "mno", 7: "pqrs", 8: "tuv", 9: "wxyz" };
    let out = [""];
    for (const d of digits) out = out.flatMap((p) => [...map[d]].map((c) => p + c));
    return out;
  },
  "n-queens": (n) => {
    const out = [];
    const cols = [];
    const go = (r) => {
      if (r === n) return out.push(cols.map((c) => ".".repeat(c) + "Q" + ".".repeat(n - c - 1)));
      for (let c = 0; c < n; c++) {
        if (cols.some((cc, rr) => cc === c || Math.abs(cc - c) === r - rr)) continue;
        cols.push(c);
        go(r + 1);
        cols.pop();
      }
    };
    go(0);
    return out;
  },

  // ---- Graphs ----
  "number-of-islands": (grid) => {
    const [R, C] = [grid.length, grid[0].length];
    let count = 0;
    const sink = (r, c) => {
      if (r < 0 || c < 0 || r >= R || c >= C || grid[r][c] !== "1") return;
      grid[r][c] = "0";
      for (const [dr, dc] of DIRS) sink(r + dr, c + dc);
    };
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++)
        if (grid[r][c] === "1") {
          count++;
          sink(r, c);
        }
    return count;
  },
  "max-area-of-island": (grid) => {
    const [R, C] = [grid.length, grid[0].length];
    const area = (r, c) => {
      if (r < 0 || c < 0 || r >= R || c >= C || grid[r][c] !== 1) return 0;
      grid[r][c] = 0;
      return 1 + DIRS.reduce((s, [dr, dc]) => s + area(r + dr, c + dc), 0);
    };
    let best = 0;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) best = Math.max(best, area(r, c));
    return best;
  },
  "clone-graph": (node) => {
    const m = new Map();
    const go = (n) => {
      if (!n) return null;
      if (m.has(n)) return m.get(n);
      const c = new _Node(n.val, []);
      m.set(n, c);
      c.neighbors = n.neighbors.map(go);
      return c;
    };
    return go(node);
  },
  "walls-and-gates": (rooms) => {
    const [R, C] = [rooms.length, rooms[0].length];
    let q = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (rooms[r][c] === 0) q.push([r, c]);
    for (let d = 1; q.length; d++) {
      const next = [];
      for (const [r, c] of q)
        for (const [dr, dc] of DIRS) {
          const [nr, nc] = [r + dr, c + dc];
          if (nr >= 0 && nc >= 0 && nr < R && nc < C && rooms[nr][nc] === 2147483647) {
            rooms[nr][nc] = d;
            next.push([nr, nc]);
          }
        }
      q = next;
    }
  },
  "rotting-oranges": (grid) => {
    const [R, C] = [grid.length, grid[0].length];
    let q = [];
    let fresh = 0;
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        if (grid[r][c] === 2) q.push([r, c]);
        if (grid[r][c] === 1) fresh++;
      }
    let mins = 0;
    while (q.length && fresh) {
      const next = [];
      for (const [r, c] of q)
        for (const [dr, dc] of DIRS) {
          const [nr, nc] = [r + dr, c + dc];
          if (nr >= 0 && nc >= 0 && nr < R && nc < C && grid[nr][nc] === 1) {
            grid[nr][nc] = 2;
            fresh--;
            next.push([nr, nc]);
          }
        }
      q = next;
      mins++;
    }
    return fresh ? -1 : mins;
  },
  "pacific-atlantic-water-flow": (heights) => {
    const [R, C] = [heights.length, heights[0].length];
    const flow = (starts) => {
      const seen = new Set();
      const st = [...starts];
      starts.forEach(([r, c]) => seen.add(r * C + c));
      while (st.length) {
        const [r, c] = st.pop();
        for (const [dr, dc] of DIRS) {
          const [nr, nc] = [r + dr, c + dc];
          if (nr < 0 || nc < 0 || nr >= R || nc >= C || seen.has(nr * C + nc) || heights[nr][nc] < heights[r][c]) continue;
          seen.add(nr * C + nc);
          st.push([nr, nc]);
        }
      }
      return seen;
    };
    const pac = [];
    const atl = [];
    for (let r = 0; r < R; r++) {
      pac.push([r, 0]);
      atl.push([r, C - 1]);
    }
    for (let c = 0; c < C; c++) {
      pac.push([0, c]);
      atl.push([R - 1, c]);
    }
    const [p, a] = [flow(pac), flow(atl)];
    const out = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (p.has(r * C + c) && a.has(r * C + c)) out.push([r, c]);
    return out;
  },
  "surrounded-regions": (board) => {
    const [R, C] = [board.length, board[0].length];
    const keep = (r, c) => {
      if (r < 0 || c < 0 || r >= R || c >= C || board[r][c] !== "O") return;
      board[r][c] = "T";
      for (const [dr, dc] of DIRS) keep(r + dr, c + dc);
    };
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (r === 0 || c === 0 || r === R - 1 || c === C - 1) keep(r, c);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) board[r][c] = board[r][c] === "T" ? "O" : "X";
  },
  "course-schedule": (n, pre) => REFERENCE["course-schedule-ii"](n, pre).length === n,
  "course-schedule-ii": (n, pre) => {
    const adj = Array.from({ length: n }, () => []);
    const indeg = new Array(n).fill(0);
    for (const [a, b] of pre) {
      adj[b].push(a);
      indeg[a]++;
    }
    const q = [];
    indeg.forEach((d, i) => d === 0 && q.push(i));
    for (let h = 0; h < q.length; h++) for (const x of adj[q[h]]) if (--indeg[x] === 0) q.push(x);
    return q.length === n ? q : [];
  },
  "graph-valid-tree": (n, edges) => {
    if (edges.length !== n - 1) return false;
    const uf = makeUF(n);
    return edges.every(([a, b]) => uf.union(a, b));
  },
  "number-of-connected-components-in-an-undirected-graph": (n, edges) => {
    const uf = makeUF(n);
    return edges.reduce((c, [a, b]) => c - (uf.union(a, b) ? 1 : 0), n);
  },
  "redundant-connection": (edges) => {
    const uf = makeUF(edges.length + 1);
    for (const e of edges) if (!uf.union(e[0], e[1])) return e;
    return [];
  },
  "word-ladder": (begin, end, list) => {
    const words = new Set(list);
    if (!words.has(end)) return 0;
    let q = [begin];
    const seen = new Set([begin]);
    for (let steps = 1; q.length; steps++) {
      const next = [];
      for (const w of q) {
        if (w === end) return steps;
        for (let i = 0; i < w.length; i++)
          for (let c = 97; c < 123; c++) {
            const nw = w.slice(0, i) + String.fromCharCode(c) + w.slice(i + 1);
            if (words.has(nw) && !seen.has(nw)) {
              seen.add(nw);
              next.push(nw);
            }
          }
      }
      q = next;
    }
    return 0;
  },

  // ---- Advanced Graphs ----
  "network-delay-time": (times, n, k) => {
    const dist = new Array(n + 1).fill(Infinity);
    dist[k] = 0;
    for (let i = 0; i < n; i++) for (const [u, v, w] of times) if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
    const mx = Math.max(...dist.slice(1));
    return mx === Infinity ? -1 : mx;
  },
  "reconstruct-itinerary": (tickets) => {
    const adj = new Map();
    for (const [a, b] of [...tickets].sort((x, y) => (x[1] < y[1] ? 1 : x[1] > y[1] ? -1 : 0))) {
      if (!adj.has(a)) adj.set(a, []);
      adj.get(a).push(b);
    }
    const out = [];
    const st = ["JFK"];
    while (st.length) {
      const top = st[st.length - 1];
      const next = adj.get(top);
      if (next && next.length) st.push(next.pop());
      else out.push(st.pop());
    }
    return out.reverse();
  },
  "min-cost-to-connect-all-points": (points) => {
    const n = points.length;
    const best = new Array(n).fill(Infinity);
    const used = new Array(n).fill(false);
    best[0] = 0;
    let total = 0;
    for (let it = 0; it < n; it++) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!used[i] && (u < 0 || best[i] < best[u])) u = i;
      used[u] = true;
      total += best[u];
      for (let v = 0; v < n; v++)
        if (!used[v]) best[v] = Math.min(best[v], Math.abs(points[u][0] - points[v][0]) + Math.abs(points[u][1] - points[v][1]));
    }
    return total;
  },
  "swim-in-rising-water": (grid) => {
    const n = grid.length;
    const h = new MinHeap((a, b) => a[0] - b[0]);
    const seen = new Set([0]);
    h.push([grid[0][0], 0, 0]);
    while (h.size) {
      const [t, r, c] = h.pop();
      if (r === n - 1 && c === n - 1) return t;
      for (const [dr, dc] of DIRS) {
        const [nr, nc] = [r + dr, c + dc];
        if (nr < 0 || nc < 0 || nr >= n || nc >= n || seen.has(nr * n + nc)) continue;
        seen.add(nr * n + nc);
        h.push([Math.max(t, grid[nr][nc]), nr, nc]);
      }
    }
    return -1;
  },
  "alien-dictionary": (words) => {
    const letters = [...new Set(words.join(""))];
    const adj = new Map(letters.map((c) => [c, new Set()]));
    for (let i = 0; i + 1 < words.length; i++) {
      const [a, b] = [words[i], words[i + 1]];
      let j = 0;
      while (j < a.length && j < b.length && a[j] === b[j]) j++;
      if (j < a.length && j < b.length) adj.get(a[j]).add(b[j]);
      else if (a.length > b.length) return "";
    }
    const indeg = new Map(letters.map((c) => [c, 0]));
    for (const s of adj.values()) for (const c of s) indeg.set(c, indeg.get(c) + 1);
    const q = letters.filter((c) => indeg.get(c) === 0);
    for (let h = 0; h < q.length; h++)
      for (const c of adj.get(q[h])) {
        indeg.set(c, indeg.get(c) - 1);
        if (indeg.get(c) === 0) q.push(c);
      }
    return q.length === letters.length ? q.join("") : "";
  },
  "cheapest-flights-within-k-stops": (n, flights, src, dst, k) => {
    let price = new Array(n).fill(Infinity);
    price[src] = 0;
    for (let i = 0; i <= k; i++) {
      const next = [...price];
      for (const [a, b, c] of flights) if (price[a] + c < next[b]) next[b] = price[a] + c;
      price = next;
    }
    return price[dst] === Infinity ? -1 : price[dst];
  },

  // ---- 1-D DP ----
  "climbing-stairs": (n) => {
    let [a, b] = [1, 1];
    for (let i = 0; i < n; i++) [a, b] = [b, a + b];
    return a;
  },
  "min-cost-climbing-stairs": (cost) => {
    const dp = [0, 0];
    for (let i = 2; i <= cost.length; i++) dp[i] = Math.min(dp[i - 1] + cost[i - 1], dp[i - 2] + cost[i - 2]);
    return dp[cost.length];
  },
  "house-robber": (nums) => {
    let [a, b] = [0, 0];
    for (const n of nums) [a, b] = [b, Math.max(b, a + n)];
    return b;
  },
  "house-robber-ii": (nums) => {
    if (nums.length === 1) return nums[0];
    const rob = REFERENCE["house-robber"];
    return Math.max(rob(nums.slice(1)), rob(nums.slice(0, -1)));
  },
  "longest-palindromic-substring": (s) => {
    let best = "";
    for (let i = 0; i < s.length; i++)
      for (const [l0, r0] of [
        [i, i],
        [i, i + 1],
      ]) {
        let [l, r] = [l0, r0];
        while (l >= 0 && r < s.length && s[l] === s[r]) [l, r] = [l - 1, r + 1];
        if (r - l - 1 > best.length) best = s.slice(l + 1, r);
      }
    return best;
  },
  "palindromic-substrings": (s) => {
    let count = 0;
    for (let i = 0; i < s.length; i++)
      for (const [l0, r0] of [
        [i, i],
        [i, i + 1],
      ]) {
        let [l, r] = [l0, r0];
        while (l >= 0 && r < s.length && s[l] === s[r]) [l, r, count] = [l - 1, r + 1, count + 1];
      }
    return count;
  },
  "decode-ways": (s) => {
    const dp = new Array(s.length + 1).fill(0);
    dp[s.length] = 1;
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i] === "0") continue;
      dp[i] = dp[i + 1];
      if (i + 1 < s.length && Number(s.slice(i, i + 2)) <= 26) dp[i] += dp[i + 2];
    }
    return dp[0];
  },
  "coin-change": (coins, amount) => {
    const dp = new Array(amount + 1).fill(Infinity);
    dp[0] = 0;
    for (let a = 1; a <= amount; a++) for (const c of coins) if (c <= a) dp[a] = Math.min(dp[a], dp[a - c] + 1);
    return dp[amount] === Infinity ? -1 : dp[amount];
  },
  "maximum-product-subarray": (nums) => {
    let [best, hi, lo] = [nums[0], 1, 1];
    for (const n of nums) {
      [hi, lo] = [Math.max(n, hi * n, lo * n), Math.min(n, hi * n, lo * n)];
      best = Math.max(best, hi);
    }
    return best === 0 ? 0 : best;
  },
  "word-break": (s, dict) => {
    const dp = new Array(s.length + 1).fill(false);
    dp[s.length] = true;
    for (let i = s.length - 1; i >= 0; i--) for (const w of dict) if (s.startsWith(w, i) && dp[i + w.length]) dp[i] = true;
    return dp[0];
  },
  "longest-increasing-subsequence": (nums) => {
    const tails = [];
    for (const n of nums) {
      let [l, r] = [0, tails.length];
      while (l < r) {
        const m = (l + r) >> 1;
        if (tails[m] < n) l = m + 1;
        else r = m;
      }
      tails[l] = n;
    }
    return tails.length;
  },
  "partition-equal-subset-sum": (nums) => {
    const total = nums.reduce((a, b) => a + b, 0);
    if (total % 2) return false;
    let reach = new Set([0]);
    for (const n of nums) reach = new Set([...reach, ...[...reach].map((x) => x + n)]);
    return reach.has(total / 2);
  },

  // ---- 2-D DP ----
  "unique-paths": (m, n) => {
    const row = new Array(n).fill(1);
    for (let i = 1; i < m; i++) for (let j = 1; j < n; j++) row[j] += row[j - 1];
    return row[n - 1];
  },
  "longest-common-subsequence": (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    return dp[0][0];
  },
  "best-time-to-buy-and-sell-stock-with-cooldown": (prices) => {
    let [hold, sold, rest] = [-Infinity, 0, 0];
    for (const p of prices) [hold, sold, rest] = [Math.max(hold, rest - p), hold + p, Math.max(rest, sold)];
    return Math.max(sold, rest);
  },
  "coin-change-ii": (amount, coins) => {
    const dp = new Array(amount + 1).fill(0);
    dp[0] = 1;
    for (const c of coins) for (let a = c; a <= amount; a++) dp[a] += dp[a - c];
    return dp[amount];
  },
  "target-sum": (nums, target) => {
    let ways = new Map([[0, 1]]);
    for (const n of nums) {
      const next = new Map();
      for (const [s, c] of ways) {
        next.set(s + n, (next.get(s + n) || 0) + c);
        next.set(s - n, (next.get(s - n) || 0) + c);
      }
      ways = next;
    }
    return ways.get(target) || 0;
  },
  "interleaving-string": (s1, s2, s3) => {
    if (s1.length + s2.length !== s3.length) return false;
    const memo = new Map();
    const go = (i, j) => {
      if (i === s1.length && j === s2.length) return true;
      const k = i * 1000 + j;
      if (memo.has(k)) return memo.get(k);
      const r = (i < s1.length && s1[i] === s3[i + j] && go(i + 1, j)) || (j < s2.length && s2[j] === s3[i + j] && go(i, j + 1));
      memo.set(k, r);
      return r;
    };
    return go(0, 0);
  },
  "longest-increasing-path-in-a-matrix": (matrix) => {
    const [R, C] = [matrix.length, matrix[0].length];
    const memo = new Map();
    const go = (r, c) => {
      const k = r * C + c;
      if (memo.has(k)) return memo.get(k);
      let best = 1;
      for (const [dr, dc] of DIRS) {
        const [nr, nc] = [r + dr, c + dc];
        if (nr >= 0 && nc >= 0 && nr < R && nc < C && matrix[nr][nc] > matrix[r][c]) best = Math.max(best, 1 + go(nr, nc));
      }
      memo.set(k, best);
      return best;
    };
    let best = 0;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) best = Math.max(best, go(r, c));
    return best;
  },
  "distinct-subsequences": (s, t) => {
    const dp = new Array(t.length + 1).fill(0);
    dp[0] = 1;
    for (const ch of s) for (let j = t.length; j >= 1; j--) if (t[j - 1] === ch) dp[j] += dp[j - 1];
    return dp[t.length];
  },
  "edit-distance": (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[a.length][b.length];
  },
  "burst-balloons": (nums) => {
    const a = [1, ...nums, 1];
    const n = a.length;
    const dp = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let len = 2; len < n; len++)
      for (let l = 0; l + len < n; l++) {
        const r = l + len;
        for (let k = l + 1; k < r; k++) dp[l][r] = Math.max(dp[l][r], dp[l][k] + dp[k][r] + a[l] * a[k] * a[r]);
      }
    return dp[0][n - 1];
  },
  "regular-expression-matching": (s, p) => new RegExp(`^(?:${p})$`).test(s),

  // ---- Greedy ----
  "maximum-subarray": (nums) => {
    let [best, cur] = [-Infinity, 0];
    for (const n of nums) {
      cur = Math.max(n, cur + n);
      best = Math.max(best, cur);
    }
    return best;
  },
  "jump-game": (nums) => {
    let goal = nums.length - 1;
    for (let i = nums.length - 1; i >= 0; i--) if (i + nums[i] >= goal) goal = i;
    return goal === 0;
  },
  "jump-game-ii": (nums) => {
    let [jumps, end, far] = [0, 0, 0];
    for (let i = 0; i < nums.length - 1; i++) {
      far = Math.max(far, i + nums[i]);
      if (i === end) {
        jumps++;
        end = far;
      }
    }
    return jumps;
  },
  "gas-station": (gas, cost) => {
    let [total, tank, start] = [0, 0, 0];
    for (let i = 0; i < gas.length; i++) {
      total += gas[i] - cost[i];
      tank += gas[i] - cost[i];
      if (tank < 0) [tank, start] = [0, i + 1];
    }
    return total < 0 ? -1 : start;
  },
  "hand-of-straights": (hand, size) => {
    if (hand.length % size) return false;
    const cnt = new Map();
    for (const h of hand) cnt.set(h, (cnt.get(h) || 0) + 1);
    for (const k of [...cnt.keys()].sort((a, b) => a - b)) {
      const c = cnt.get(k);
      if (!c) continue;
      for (let i = 0; i < size; i++) {
        if ((cnt.get(k + i) || 0) < c) return false;
        cnt.set(k + i, cnt.get(k + i) - c);
      }
    }
    return true;
  },
  "merge-triplets-to-form-target-triplet": (triplets, target) => {
    const got = [false, false, false];
    for (const t of triplets) {
      if (t.some((v, i) => v > target[i])) continue;
      t.forEach((v, i) => v === target[i] && (got[i] = true));
    }
    return got.every(Boolean);
  },
  "partition-labels": (s) => {
    const last = {};
    [...s].forEach((c, i) => (last[c] = i));
    const out = [];
    let [start, end] = [0, 0];
    for (let i = 0; i < s.length; i++) {
      end = Math.max(end, last[s[i]]);
      if (i === end) {
        out.push(end - start + 1);
        start = i + 1;
      }
    }
    return out;
  },
  "valid-parenthesis-string": (s) => {
    let [lo, hi] = [0, 0];
    for (const c of s) {
      lo += c === "(" ? 1 : -1;
      hi += c === ")" ? -1 : 1;
      if (hi < 0) return false;
      lo = Math.max(lo, 0);
    }
    return lo === 0;
  },

  // ---- Intervals ----
  "insert-interval": (intervals, newInterval) => REFERENCE["merge-intervals"]([...intervals, newInterval]),
  "merge-intervals": (intervals) => {
    const a = intervals.map((x) => [...x]).sort((x, y) => x[0] - y[0]);
    const out = [];
    for (const iv of a) {
      if (out.length && iv[0] <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], iv[1]);
      else out.push(iv);
    }
    return out;
  },
  "non-overlapping-intervals": (intervals) => {
    const a = [...intervals].sort((x, y) => x[1] - y[1]);
    let [end, removed] = [-Infinity, 0];
    for (const [s, e] of a) {
      if (s >= end) end = e;
      else removed++;
    }
    return removed;
  },
  "meeting-rooms": (intervals) => {
    const a = [...intervals].sort((x, y) => x[0] - y[0]);
    return a.every((iv, i) => i === 0 || iv[0] >= a[i - 1][1]);
  },
  "meeting-rooms-ii": (intervals) => {
    const ev = intervals.flatMap(([s, e]) => [
      [s, 1],
      [e, -1],
    ]);
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let [cur, best] = [0, 0];
    for (const [, d] of ev) best = Math.max(best, (cur += d));
    return best;
  },
  "minimum-interval-to-include-each-query": (intervals, queries) =>
    queries.map((q) => intervals.reduce((best, [l, r]) => (l <= q && q <= r ? Math.min(best, r - l + 1) : best), Infinity)).map((x) => (x === Infinity ? -1 : x)),

  // ---- Math & Geometry ----
  "rotate-image": (matrix) => {
    const n = matrix.length;
    const copy = matrix.map((r) => [...r]);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) matrix[j][n - 1 - i] = copy[i][j];
  },
  "spiral-matrix": (matrix) => {
    const out = [];
    let [t, b, l, r] = [0, matrix.length - 1, 0, matrix[0].length - 1];
    while (t <= b && l <= r) {
      for (let j = l; j <= r; j++) out.push(matrix[t][j]);
      for (let i = t + 1; i <= b; i++) out.push(matrix[i][r]);
      if (t < b && l < r) {
        for (let j = r - 1; j >= l; j--) out.push(matrix[b][j]);
        for (let i = b - 1; i > t; i--) out.push(matrix[i][l]);
      }
      [t, b, l, r] = [t + 1, b - 1, l + 1, r - 1];
    }
    return out;
  },
  "set-matrix-zeroes": (matrix) => {
    const rows = new Set();
    const cols = new Set();
    matrix.forEach((row, i) => row.forEach((v, j) => v === 0 && (rows.add(i), cols.add(j))));
    matrix.forEach((row, i) => row.forEach((_, j) => (rows.has(i) || cols.has(j)) && (row[j] = 0)));
  },
  "happy-number": (n) => {
    const seen = new Set();
    while (n !== 1 && !seen.has(n)) {
      seen.add(n);
      n = [...String(n)].reduce((s, d) => s + d * d, 0);
    }
    return n === 1;
  },
  "plus-one": (digits) => {
    const n = BigInt(digits.join("")) + 1n;
    return [...String(n)].map(Number);
  },
  "powx-n": (x, n) => Math.pow(x, n),
  "multiply-strings": (a, b) => String(BigInt(a) * BigInt(b)),
  "detect-squares": class {
    constructor() {
      this.cnt = new Map();
      this.pts = [];
    }
    add([x, y]) {
      const k = `${x},${y}`;
      if (!this.cnt.has(k)) this.pts.push([x, y]);
      this.cnt.set(k, (this.cnt.get(k) || 0) + 1);
    }
    count([x, y]) {
      let total = 0;
      for (const [px, py] of this.pts) {
        if (Math.abs(px - x) !== Math.abs(py - y) || px === x) continue;
        total += (this.cnt.get(`${px},${py}`) || 0) * (this.cnt.get(`${x},${py}`) || 0) * (this.cnt.get(`${px},${y}`) || 0);
      }
      return total;
    }
  },

  // ---- Bit Manipulation ----
  "single-number": (nums) => nums.reduce((a, b) => a ^ b, 0),
  "number-of-1-bits": (n) => [...n.toString(2)].filter((c) => c === "1").length,
  "counting-bits": (n) => Array.from({ length: n + 1 }, (_, i) => [...i.toString(2)].filter((c) => c === "1").length),
  "reverse-bits": (n) => parseInt(n.toString(2).padStart(32, "0").split("").reverse().join(""), 2),
  "missing-number": (nums) => (nums.length * (nums.length + 1)) / 2 - nums.reduce((a, b) => a + b, 0),
  "sum-of-two-integers": (a, b) => a + b,
  "reverse-integer": (x) => {
    const r = Math.sign(x) * Number(String(Math.abs(x)).split("").reverse().join(""));
    return r > 2 ** 31 - 1 || r < -(2 ** 31) ? 0 : r === 0 ? 0 : r;
  },
};

/** The names-to-code map runCase() expects. */
export function referenceEntry(slug, meta) {
  const ref = REFERENCE[slug];
  if (!ref) throw new Error(`No reference solution for ${slug}`);
  if (typeof ref === "object") return ref;
  return { [meta.classname || meta.name]: ref };
}
