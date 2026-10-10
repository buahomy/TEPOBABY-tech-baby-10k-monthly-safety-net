// The 18 NeetCode roadmap concepts: what each one works on, what it does, its runtime, and a
// skeleton template in Python and JavaScript. The Python template is the code the Roadmap animates
// line by line (see viz.ts); the Card Game's "Hint: template" shows these skeletons too.

export type ConceptInfo = {
  id: string;
  label: string;
  inputs: string[];
  what: string;
  time: string;
  space: string;
  runtimeNote: string;
  python: string;
  javascript: string;
};

export const CONCEPT_INFO: ConceptInfo[] = [
  {
    id: "arrays",
    label: "Arrays & Hashing",
    inputs: ["Array", "String", "Hash map / set"],
    what: "Trade memory for speed: a hash map or set remembers what you've seen, so each lookup is O(1) instead of rescanning the array.",
    time: "O(n)",
    space: "O(n)",
    runtimeNote: "One pass; every hash map lookup and insert is O(1) on average.",
    python: `def two_sum(nums, target):
    seen = {}                    # value -> index
    for i, n in enumerate(nums):
        need = target - n
        if need in seen:         # O(1) lookup
            return [seen[need], i]
        seen[n] = i
    return []`,
    javascript: `function twoSum(nums, target) {
  const seen = new Map();        // value -> index
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) {        // O(1) lookup
      return [seen.get(need), i];
    }
    seen.set(nums[i], i);
  }
  return [];
}`,
  },
  {
    id: "twoPointers",
    label: "Two Pointers",
    inputs: ["Sorted array", "String", "Linked list"],
    what: "Two indexes walk toward each other (or in the same direction). Each step uses what you know, like sorted order, to rule out a whole set of pairs at once.",
    time: "O(n)",
    space: "O(1)",
    runtimeNote: "Each step moves one pointer, so there are at most n steps.",
    python: `def pair_sum(nums, target):   # nums is sorted
    l, r = 0, len(nums) - 1
    while l < r:
        total = nums[l] + nums[r]
        if total == target:
            return [l, r]
        elif total < target:
            l += 1               # need a bigger sum
        else:
            r -= 1               # need a smaller sum
    return []`,
    javascript: `function pairSum(nums, target) { // nums is sorted
  let l = 0, r = nums.length - 1;
  while (l < r) {
    const total = nums[l] + nums[r];
    if (total === target) return [l, r];
    if (total < target) l++;     // need a bigger sum
    else r--;                    // need a smaller sum
  }
  return [];
}`,
  },
  {
    id: "stack",
    label: "Stack",
    inputs: ["Array", "String (brackets, tokens)"],
    what: "Last in, first out. A monotonic stack keeps items that are still waiting for an answer (like the next bigger value) and pops them the moment it arrives.",
    time: "O(n)",
    space: "O(n)",
    runtimeNote: "Each index is pushed once and popped at most once.",
    python: `def next_greater(nums):
    res = [-1] * len(nums)
    stack = []                   # indexes still waiting
    for i, n in enumerate(nums):
        while stack and nums[stack[-1]] < n:
            j = stack.pop()
            res[j] = n           # n is j's next greater
        stack.append(i)
    return res`,
    javascript: `function nextGreater(nums) {
  const res = new Array(nums.length).fill(-1);
  const stack = [];              // indexes still waiting
  for (let i = 0; i < nums.length; i++) {
    while (stack.length && nums[stack[stack.length - 1]] < nums[i]) {
      const j = stack.pop();
      res[j] = nums[i];          // nums[i] is j's next greater
    }
    stack.push(i);
  }
  return res;
}`,
  },
  {
    id: "binarySearch",
    label: "Binary Search",
    inputs: ["Sorted array", "Rotated sorted array", "Range of possible answers", "2-D sorted matrix"],
    what: "Check the middle and throw away the half that can't hold the answer. It also works on an answer range (\"smallest speed that works\") whenever the condition flips only once.",
    time: "O(log n)",
    space: "O(1)",
    runtimeNote: "The search range halves every step.",
    python: `def binary_search(nums, target):
    l, r = 0, len(nums) - 1
    while l <= r:
        m = (l + r) // 2
        if nums[m] == target:
            return m
        elif nums[m] < target:
            l = m + 1            # answer is to the right
        else:
            r = m - 1            # answer is to the left
    return -1`,
    javascript: `function binarySearch(nums, target) {
  let l = 0, r = nums.length - 1;
  while (l <= r) {
    const m = Math.floor((l + r) / 2);
    if (nums[m] === target) return m;
    if (nums[m] < target) l = m + 1;  // answer is to the right
    else r = m - 1;                   // answer is to the left
  }
  return -1;
}`,
  },
  {
    id: "slidingWindow",
    label: "Sliding Window",
    inputs: ["String", "Array (contiguous substring / subarray)"],
    what: "Keep a window [l, r] over a contiguous range. Grow it on the right; shrink it from the left as soon as it breaks the rule. Never restart from scratch.",
    time: "O(n)",
    space: "O(k)",
    runtimeNote: "Each element enters and leaves the window at most once; k is the window's contents (distinct characters).",
    python: `def longest_unique(s):
    seen = set()
    l = best = 0
    for r in range(len(s)):
        while s[r] in seen:      # window broke the rule: shrink
            seen.remove(s[l])
            l += 1
        seen.add(s[r])
        best = max(best, r - l + 1)
    return best`,
    javascript: `function longestUnique(s) {
  const seen = new Set();
  let l = 0, best = 0;
  for (let r = 0; r < s.length; r++) {
    while (seen.has(s[r])) {     // window broke the rule: shrink
      seen.delete(s[l]);
      l++;
    }
    seen.add(s[r]);
    best = Math.max(best, r - l + 1);
  }
  return best;
}`,
  },
  {
    id: "linkedList",
    label: "Linked List",
    inputs: ["Linked list (ListNode)", "Array as an implicit list (i → nums[i])"],
    what: "Rewire next pointers in place. Keep a pointer to the node before (prev) and the one after (nxt) so nothing gets lost; dummy heads and fast/slow pointers are the other staples.",
    time: "O(n)",
    space: "O(1)",
    runtimeNote: "One pass over the nodes, using a few pointers.",
    python: `def reverse(head):
    prev, curr = None, head
    while curr:
        nxt = curr.next          # save the rest of the list
        curr.next = prev         # flip the pointer
        prev = curr
        curr = nxt
    return prev`,
    javascript: `function reverse(head) {
  let prev = null, curr = head;
  while (curr) {
    const nxt = curr.next;       // save the rest of the list
    curr.next = prev;            // flip the pointer
    prev = curr;
    curr = nxt;
  }
  return prev;
}`,
  },
  {
    id: "trees",
    label: "Trees",
    inputs: ["Binary tree (TreeNode)", "Binary search tree", "Preorder / inorder arrays"],
    what: "Solve each subtree with recursion (DFS), then combine the answers at the parent. Use BFS with a queue when the question is about levels.",
    time: "O(n)",
    space: "O(h)",
    runtimeNote: "Every node is visited once; the recursion stack is as deep as the tree's height h.",
    python: `def max_depth(node):
    if not node:
        return 0
    left = max_depth(node.left)
    right = max_depth(node.right)
    return 1 + max(left, right)`,
    javascript: `function maxDepth(node) {
  if (!node) return 0;
  const left = maxDepth(node.left);
  const right = maxDepth(node.right);
  return 1 + Math.max(left, right);
}`,
  },
  {
    id: "tries",
    label: "Tries",
    inputs: ["List of words", "Prefix strings", "2-D board of letters"],
    what: "A prefix tree. Each node is one character, and words that share a prefix share a path, so looking up a word or prefix costs its length, not the number of words.",
    time: "O(L)",
    space: "O(total chars)",
    runtimeNote: "Insert and search take O(L) for a word of length L.",
    python: `class TrieNode:
    def __init__(self):
        self.children = {}
        self.end = False

def insert(root, word):
    node = root
    for ch in word:
        if ch not in node.children:
            node.children[ch] = TrieNode()
        node = node.children[ch]
    node.end = True`,
    javascript: `class TrieNode {
  constructor() {
    this.children = {};
    this.end = false;
  }
}

function insert(root, word) {
  let node = root;
  for (const ch of word) {
    if (!(ch in node.children)) node.children[ch] = new TrieNode();
    node = node.children[ch];
  }
  node.end = true;
}`,
  },
  {
    id: "heap",
    label: "Heap / Priority Queue",
    inputs: ["Array", "Stream of numbers", "k", "Points / pairs with a priority"],
    what: "Always hand back the smallest (or largest) item fast. A size-k min-heap keeps the k largest so far; two heaps track a running median.",
    time: "O(n log k)",
    space: "O(k)",
    runtimeNote: "Push and pop are O(log k); peeking at the top is O(1).",
    python: `import heapq

def kth_largest(nums, k):
    heap = []                    # min-heap of the k largest so far
    for n in nums:
        heapq.heappush(heap, n)
        if len(heap) > k:
            heapq.heappop(heap)  # drop the smallest
    return heap[0]`,
    javascript: `// LeetCode's JS runtime has MinPriorityQueue (@datastructures-js)
function kthLargest(nums, k) {
  const heap = new MinPriorityQueue(); // the k largest so far
  for (const n of nums) {
    heap.enqueue(n);
    if (heap.size() > k) heap.dequeue(); // drop the smallest
  }
  return heap.front();
}`,
  },
  {
    id: "backtracking",
    label: "Backtracking",
    inputs: ["Array of choices", "String", "2-D board", "n (board size)"],
    what: "Explore a decision tree: make a choice, recurse, then undo it and try the next one. Prune branches that can't work.",
    time: "O(n · 2ⁿ)",
    space: "O(n)",
    runtimeNote: "Subsets has 2ⁿ leaves (permutations have n!); the recursion is n deep.",
    python: `def subsets(nums):
    res, path = [], []
    def backtrack(i):
        if i == len(nums):
            res.append(path[:])
            return
        path.append(nums[i])     # choose nums[i]
        backtrack(i + 1)         # explore with it
        path.pop()               # undo the choice
        backtrack(i + 1)         # explore without it
    backtrack(0)
    return res`,
    javascript: `function subsets(nums) {
  const res = [], path = [];
  function backtrack(i) {
    if (i === nums.length) {
      res.push([...path]);
      return;
    }
    path.push(nums[i]);          // choose nums[i]
    backtrack(i + 1);            // explore with it
    path.pop();                  // undo the choice
    backtrack(i + 1);            // explore without it
  }
  backtrack(0);
  return res;
}`,
  },
  {
    id: "graphs",
    label: "Graphs",
    inputs: ["Adjacency list", "Edge list", "2-D grid (cells are nodes)"],
    what: "Visit nodes through their neighbors with BFS (a queue, level by level) or DFS (recursion), marking visited so nothing is processed twice. Add topological sort and union-find for dependencies and connectivity.",
    time: "O(V + E)",
    space: "O(V)",
    runtimeNote: "Each node and each edge is handled once.",
    python: `from collections import deque

def bfs(graph, start):
    visited = {start}
    q = deque([start])
    while q:
        node = q.popleft()
        for nei in graph[node]:
            if nei not in visited:
                visited.add(nei)
                q.append(nei)
    return visited`,
    javascript: `function bfs(graph, start) {
  const visited = new Set([start]);
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const node = q[h];
    for (const nei of graph[node]) {
      if (!visited.has(nei)) {
        visited.add(nei);
        q.push(nei);
      }
    }
  }
  return visited;
}`,
  },
  {
    id: "advGraphs",
    label: "Advanced Graphs",
    inputs: ["Weighted edge list", "Weighted adjacency list", "Grid with costs"],
    what: "Shortest paths and spanning trees on weighted graphs. Dijkstra always expands the closest unfinished node from a min-heap; Prim's, Bellman-Ford and topological sort fill out the toolbox.",
    time: "O(E log E)",
    space: "O(V + E)",
    runtimeNote: "Every edge can push once onto the heap, and each push or pop is O(log E).",
    python: `import heapq

def dijkstra(graph, src):        # graph[u] = [(v, w), ...]
    dist = {}
    heap = [(0, src)]
    while heap:
        d, u = heapq.heappop(heap)
        if u in dist:
            continue             # already found a shorter path
        dist[u] = d
        for v, w in graph[u]:
            if v not in dist:
                heapq.heappush(heap, (d + w, v))
    return dist`,
    javascript: `function dijkstra(graph, src) { // graph[u] = [[v, w], ...]
  const dist = new Map();
  const heap = new MinPriorityQueue((x) => x[0]);
  heap.enqueue([0, src]);
  while (!heap.isEmpty()) {
    const [d, u] = heap.dequeue();
    if (dist.has(u)) continue;     // already found a shorter path
    dist.set(u, d);
    for (const [v, w] of graph[u]) {
      if (!dist.has(v)) heap.enqueue([d + w, v]);
    }
  }
  return dist;
}`,
  },
  {
    id: "oneDP",
    label: "1-D DP",
    inputs: ["Array", "String", "Target amount"],
    what: "Write the answer for i in terms of smaller answers (i − 1, i − 2, …), then fill a 1-D table bottom-up so each subproblem is solved once.",
    time: "O(n)",
    space: "O(n)",
    runtimeNote: "One pass to fill the table; it often shrinks to O(1) with two variables.",
    python: `def rob(nums):
    dp = [0] * (len(nums) + 1)   # dp[i] = best from first i houses
    dp[1] = nums[0]
    for i in range(2, len(nums) + 1):
        skip = dp[i - 1]
        take = dp[i - 2] + nums[i - 1]
        dp[i] = max(skip, take)
    return dp[-1]`,
    javascript: `function rob(nums) {
  const dp = new Array(nums.length + 1).fill(0); // dp[i] = best from first i houses
  dp[1] = nums[0];
  for (let i = 2; i <= nums.length; i++) {
    const skip = dp[i - 1];
    const take = dp[i - 2] + nums[i - 1];
    dp[i] = Math.max(skip, take);
  }
  return dp[nums.length];
}`,
  },
  {
    id: "twoDP",
    label: "2-D DP",
    inputs: ["Two strings", "2-D grid", "Array + target / capacity"],
    what: "The state needs two indexes (i in one string, j in the other, or a row and column), so the answers live in a grid filled from the base cases.",
    time: "O(m · n)",
    space: "O(m · n)",
    runtimeNote: "Every cell is filled once in O(1); keeping just one row cuts space to O(n).",
    python: `def lcs(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) - 1, -1, -1):
        for j in range(len(b) - 1, -1, -1):
            if a[i] == b[j]:
                dp[i][j] = 1 + dp[i + 1][j + 1]
            else:
                dp[i][j] = max(dp[i + 1][j], dp[i][j + 1])
    return dp[0][0]`,
    javascript: `function lcs(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = 1 + dp[i + 1][j + 1];
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp[0][0];
}`,
  },
  {
    id: "greedy",
    label: "Greedy",
    inputs: ["Array", "Intervals", "Counts / frequencies"],
    what: "Make the locally best choice at each step and never look back, when you can argue it never hurts the final answer (Kadane's, jump game reach, gas station).",
    time: "O(n)",
    space: "O(1)",
    runtimeNote: "One pass with a few running variables (O(n log n) when you sort first).",
    python: `def max_subarray(nums):
    best = nums[0]
    cur = 0
    for n in nums:
        if cur < 0:
            cur = 0              # a negative running sum only hurts
        cur += n
        best = max(best, cur)
    return best`,
    javascript: `function maxSubarray(nums) {
  let best = nums[0], cur = 0;
  for (const n of nums) {
    if (cur < 0) cur = 0;        // a negative running sum only hurts
    cur += n;
    best = Math.max(best, cur);
  }
  return best;
}`,
  },
  {
    id: "intervals",
    label: "Intervals",
    inputs: ["List of [start, end] pairs", "Query points"],
    what: "Sort by start time, then sweep left to right: two intervals overlap when the next start is no later than the current end.",
    time: "O(n log n)",
    space: "O(n)",
    runtimeNote: "Sorting dominates; the sweep itself is O(n).",
    python: `def merge(intervals):
    intervals.sort(key=lambda x: x[0])
    res = [intervals[0]]
    for start, end in intervals[1:]:
        last = res[-1]
        if start <= last[1]:     # overlaps: extend
            last[1] = max(last[1], end)
        else:
            res.append([start, end])
    return res`,
    javascript: `function merge(intervals) {
  intervals.sort((x, y) => x[0] - y[0]);
  const res = [intervals[0]];
  for (const [start, end] of intervals.slice(1)) {
    const last = res[res.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end); // overlaps: extend
    else res.push([start, end]);
  }
  return res;
}`,
  },
  {
    id: "math",
    label: "Math & Geometry",
    inputs: ["2-D matrix", "Integer", "Digit strings", "Points"],
    what: "Use index arithmetic and math facts instead of brute force: rotate a matrix with transpose + reverse, walk a spiral with shrinking bounds, multiply digit by digit.",
    time: "O(n²)",
    space: "O(1)",
    runtimeNote: "Every cell of the n × n matrix is touched a constant number of times, in place.",
    python: `def rotate(matrix):
    n = len(matrix)
    for i in range(n):           # 1) transpose
        for j in range(i + 1, n):
            matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]
    for row in matrix:           # 2) reverse each row
        row.reverse()`,
    javascript: `function rotate(matrix) {
  const n = matrix.length;
  for (let i = 0; i < n; i++) {         // 1) transpose
    for (let j = i + 1; j < n; j++) {
      [matrix[i][j], matrix[j][i]] = [matrix[j][i], matrix[i][j]];
    }
  }
  for (const row of matrix) row.reverse(); // 2) reverse each row
}`,
  },
  {
    id: "bits",
    label: "Bit Manipulation",
    inputs: ["32-bit integer", "Array of integers"],
    what: "Work on the binary form directly: n & (n − 1) clears the lowest 1-bit, x ^ x = 0 cancels pairs, and shifts read bits one at a time.",
    time: "O(k)",
    space: "O(1)",
    runtimeNote: "One loop per 1-bit (k ≤ 32).",
    python: `def count_ones(n):
    count = 0
    while n:
        n &= n - 1               # clears the lowest 1-bit
        count += 1
    return count`,
    javascript: `function countOnes(n) {
  let count = 0;
  while (n) {
    n &= n - 1;                  // clears the lowest 1-bit
    count++;
  }
  return count;
}`,
  },
];

export const conceptById = new Map(CONCEPT_INFO.map((c) => [c.id, c]));
