// Hidden test cases Submit runs on top of LeetCode's examples: edge cases (empty, single item,
// duplicates, negatives) plus a few bigger inputs. Each test is the list of arguments; the expected
// answers come from the reference solutions. Every input respects the problem's constraints.

let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const randInt = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const range = (n, f = (i) => i) => Array.from({ length: n }, (_, i) => f(i));
const randArr = (n, lo, hi) => range(n, () => randInt(lo, hi));
const letters = (n, abc = "abcdefghijklmnopqrstuvwxyz") => range(n, () => abc[randInt(0, abc.length - 1)]).join("");
const grid = (r, c, f) => range(r, (i) => range(c, (j) => f(i, j)));
const shuffled = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const sortedUnique = (n, lo, hi) => [...new Set(randArr(n, lo, hi))].sort((a, b) => a - b);
const bst = (vals) => {
  // level-order array of a balanced BST built from sorted unique values
  const out = [];
  let level = [[0, vals.length - 1]];
  while (level.some(Boolean)) {
    const next = [];
    for (const r of level) {
      if (!r || r[0] > r[1]) {
        out.push(null);
        next.push(null, null);
        continue;
      }
      const m = (r[0] + r[1]) >> 1;
      out.push(vals[m]);
      next.push([r[0], m - 1], [m + 1, r[1]]);
    }
    level = next;
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
};

const E = {
  // ---- Arrays & Hashing ----
  "contains-duplicate": [[[1]], [[-1, -1]], [range(2000)], [[...range(1999), 1998]]],
  "valid-anagram": [["a", "a"], ["ab", "a"], ["aacc", "ccac"], [letters(3000), letters(3000)]],
  "two-sum": [[[-3, 4, 3, 90], 0], [[0, 4, 3, 0], 0], [[...range(3000, (i) => i * 2), 1], 5997]],
  "group-anagrams": [[[""]], [["a"]], [["abc", "bca", "cab", "xyz", "zyx", "q"]], [["", "", "b"]]],
  "top-k-frequent-elements": [[[1], 1], [[4, 4, 4, 2, 2, 7], 2], [[-1, -1, 5, 5, 5, 3], 1]],
  "encode-and-decode-strings": [[[]], [["#", "3#abc", ""]], [["a,b", "with space", "😀", "12#34"]]],
  "product-of-array-except-self": [[[0, 0]], [[2, 3]], [[-1, 1, 0, -3, 3]], [[1, 0, 2, 3]]],
  "valid-sudoku": [
    [grid(9, 9, () => ".")],
    [grid(9, 9, (r, c) => (r === 0 && (c === 0 || c === 8) ? "5" : "."))],
    [grid(9, 9, (r, c) => ((r === 0 && c === 0) || (r === 2 && c === 2) ? "7" : "."))],
    [grid(9, 9, (r, c) => (r === c ? String(r + 1) : "."))],
  ],
  "longest-consecutive-sequence": [[[]], [[1]], [[1, 2, 0, 1]], [[9, 1, -3, 2, 4, 8, 3, -1, 6, -2, -4, 7]], [shuffled(range(3000, (i) => i * 2))]],

  // ---- Two Pointers ----
  "valid-palindrome": [[" "], ["0P"], ["a."], ["No 'x' in Nixon"]],
  "two-sum-ii-input-array-is-sorted": [[[-1, 0], -1], [[1, 1, 2, 3], 2], [[...range(2000, (i) => i * 3), 6001], 6004]],
  "3sum": [[[0, 0, 0, 0]], [[1, -1]], [[-2, 0, 1, 1, 2]], [[-4, -2, -2, -2, 0, 1, 2, 2, 2, 3, 3, 4, 4, 6, 6]]],
  "container-with-most-water": [[[1, 1]], [[1, 2, 4, 3]], [[2, 3, 10, 5, 7, 8, 9]]],
  "trapping-rain-water": [[[1]], [[5, 4, 1, 2]], [[5, 2, 1, 2, 1, 5]], [randArr(2000, 0, 1000)]],

  // ---- Sliding Window ----
  "best-time-to-buy-and-sell-stock": [[[1]], [[2, 4, 1]], [[3, 3, 3]], [randArr(3000, 0, 10000)]],
  "longest-substring-without-repeating-characters": [[""], [" "], ["dvdf"], ["abba"], [letters(3000)]],
  "longest-repeating-character-replacement": [["A", 0], ["ABAB", 0], ["AAAA", 2], [letters(2000, "ABC"), 5]],
  "permutation-in-string": [["a", "a"], ["ab", "a"], ["adc", "dcda"], ["hello", "ooolleoooleh"]],
  "minimum-window-substring": [["a", "aa"], ["ab", "b"], ["bba", "ab"], ["cabwefgewcwaefgcf", "cae"]],
  "sliding-window-maximum": [[[1], 1], [[1, -1], 1], [[9, 11], 2], [[7, 2, 4], 2], [randArr(2000, -100, 100), 37]],

  // ---- Stack ----
  "valid-parentheses": [["]"], ["(("], ["([{}])"], ["([)]"]],
  "min-stack": [
    [
      ["MinStack", "push", "push", "push", "getMin", "pop", "getMin", "top"],
      [[], [0], [1], [0], [], [], [], []],
    ],
    [
      ["MinStack", "push", "push", "getMin", "pop", "push", "getMin", "top"],
      [[], [2147483646], [-2147483648], [], [], [5], [], []],
    ],
  ],
  "evaluate-reverse-polish-notation": [[["7"]], [["3", "-4", "+"]], [["4", "-3", "/"]], [["-7", "2", "/", "3", "*"]]],
  "generate-parentheses": [[2], [4]],
  "daily-temperatures": [[[50]], [[90, 80, 70]], [[30, 30, 31]], [randArr(3000, 30, 100)]],
  "car-fleet": [[10, [3], [3]], [10, [0, 4, 2], [2, 1, 3]], [12, [10, 8, 0, 5, 3], [2, 4, 1, 1, 3]], [20, [6, 2, 17], [3, 9, 2]]],
  "largest-rectangle-in-histogram": [[[0]], [[2, 4]], [[1, 1, 1, 1]], [[6, 2, 5, 4, 5, 1, 6]], [randArr(2000, 0, 1000)]],

  // ---- Binary Search ----
  "binary-search": [[[5], 5], [[5], -5], [[-3, -1, 0, 4], 4], [range(3000, (i) => i * 2), 4001]],
  "search-a-2d-matrix": [[[[1]], 1], [[[1, 3]], 3], [[[1], [3]], 2], [grid(30, 40, (r, c) => r * 100 + c * 2), 2938]],
  "koko-eating-bananas": [[[1], 1], [[1000000000], 2], [[312884470], 312884469], [[3, 6, 7, 11, 20, 1], 7]],
  "find-minimum-in-rotated-sorted-array": [[[1]], [[2, 1]], [[5, 1, 2, 3, 4]], [[...range(1000, (i) => i + 2000), ...range(1000)]]],
  "search-in-rotated-sorted-array": [[[1], 1], [[3, 1], 1], [[5, 1, 3], 5], [[...range(1000, (i) => i + 2000), ...range(1000)], 999]],
  "time-based-key-value-store": [
    [
      ["TimeMap", "get", "set", "get", "get", "set", "get", "get"],
      [[], ["a", 1], ["a", "x", 5], ["a", 4], ["a", 5], ["a", "y", 10], ["a", 9], ["a", 100]],
    ],
    [
      ["TimeMap", "set", "set", "get", "get", "get"],
      [[], ["love", "high", 10], ["love", "low", 20], ["love", 5], ["love", 15], ["love", 25]],
    ],
  ],
  "median-of-two-sorted-arrays": [[[], [1]], [[2], []], [[1, 1], [1, 1]], [[1, 2, 7], [3, 4, 5, 6, 8]], [sortedUnique(500, -5000, 5000), sortedUnique(301, -5000, 5000)]],

  // ---- Linked List ----
  "reverse-linked-list": [[[]], [[1]], [range(900)]],
  "merge-two-sorted-lists": [[[], []], [[], [0]], [[5], [1, 2, 4]], [[-3, 0, 0, 9], [-3, 1, 100]]],
  "linked-list-cycle": [[[], -1], [[1, 2, 3, 4], 3], [[1, 2, 3, 4], -1], [range(2000), 1000]],
  "reorder-list": [[[1]], [[1, 2]], [[1, 2, 3]], [range(1001)]],
  "remove-nth-node-from-end-of-list": [[[1, 2], 2], [[1, 2, 3], 3], [[1, 2, 3, 4, 5], 1]],
  "copy-list-with-random-pointer": [[[]], [[[1, 0]]], [[[5, null], [6, 0], [7, 2], [8, 1]]]],
  "add-two-numbers": [[[0], [0]], [[5], [5]], [[1], [9, 9, 9, 9]], [[2, 4, 9], [5, 6, 4, 9]]],
  "find-the-duplicate-number": [[[1, 1]], [[1, 1, 2]], [[2, 2, 2, 2, 2]], [[...range(2000, (i) => i + 1), 777]]],
  "lru-cache": [
    [
      ["LRUCache", "put", "get", "put", "get", "get"],
      [[1], [2, 1], [2], [3, 2], [2], [3]],
    ],
    [
      ["LRUCache", "put", "put", "put", "put", "get", "get"],
      [[2], [2, 1], [1, 1], [2, 3], [4, 1], [1], [2]],
    ],
    [
      ["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"],
      [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]],
    ],
  ],
  "merge-k-sorted-lists": [[[[]]], [[[1], [0]]], [[[], [-1, 5, 11], [], [6, 10]]], [range(20, (i) => range(50, (j) => j * 20 + i))]],
  "reverse-nodes-in-k-group": [[[1], 1], [[1, 2], 2], [[1, 2, 3, 4, 5, 6, 7], 3], [[1, 2, 3, 4], 4]],

  // ---- Trees ----
  "invert-binary-tree": [[[1]], [[1, 2]], [[1, null, 2, 3]]],
  "maximum-depth-of-binary-tree": [[[0]], [[1, 2, null, 3, null, 4]], [bst(range(1000))]],
  "diameter-of-binary-tree": [[[1]], [[1, 2, 3, 4, 5, null, null, 6, null, null, 7]], [[4, -7, -3, null, null, -9, -3, 9, -7, -4, null, 6, null, -6, -6, null, null, 0, 6, 5, null, 9, null, null, -1, -4, null, null, null, -2]]],
  "balanced-binary-tree": [[[1, 2, 2, 3, null, null, 3, 4, null, null, 4]], [[1, null, 2, null, 3]], [[1, 2, 3, 4, 5, 6, null, 8]], [bst(range(500))]],
  "same-tree": [[[], []], [[1], []], [[1, 2], [1, null, 2]], [bst(range(300)), bst(range(300))]],
  "subtree-of-another-tree": [[[1, 1], [1]], [[1], [1]], [[3, 4, 5, 1, null, 2], [3, 1, 2]], [[1, 2, 3], [2, 3]]],
  "lowest-common-ancestor-of-a-binary-search-tree": [[[5, 3, 6, 2, 4, null, null, 1], 1, 4], [[5, 3, 6, 2, 4, null, null, 1], 1, 6], [bst(range(200)), 13, 17]],
  "binary-tree-level-order-traversal": [[[1, 2, null, 3, null, 4]], [[0, -1, 2, null, -3]], [bst(range(31))]],
  "binary-tree-right-side-view": [[[1, 2]], [[1, 2, 3, 4]], [[1, 2, 3, null, 5, null, 4, 6]]],
  "count-good-nodes-in-binary-tree": [[[-1, -2, -1]], [[2, null, 4, 10, 8, null, null, 4]], [bst(range(300))]],
  "validate-binary-search-tree": [[[1, 1]], [[2147483647]], [[5, 4, 6, null, null, 3, 7]], [[32, 26, 47, 19, null, null, 56, null, 27]], [bst(range(500))]],
  "kth-smallest-element-in-a-bst": [[[1], 1], [[2, 1, 3], 3], [bst(range(300, (i) => i * 3)), 150]],
  "construct-binary-tree-from-preorder-and-inorder-traversal": [[[1, 2], [2, 1]], [[1, 2], [1, 2]], [[4, 2, 1, 3, 6, 5, 7], [1, 2, 3, 4, 5, 6, 7]]],
  "binary-tree-maximum-path-sum": [[[-3]], [[2, -1]], [[-1, -2, 10, -6, null, -3, -6]], [[5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1]]],
  "serialize-and-deserialize-binary-tree": [[[1]], [[-1, 0, 1]], [[1, null, 2, null, 3, null, 4]], [bst(range(200, (i) => i - 100))]],

  // ---- Tries ----
  "implement-trie-prefix-tree": [
    [
      ["Trie", "search", "startsWith", "insert", "search", "search", "startsWith", "insert", "search", "startsWith"],
      [[], ["a"], ["a"], ["app"], ["app"], ["ap"], ["ap"], ["ap"], ["ap"], ["b"]],
    ],
  ],
  "design-add-and-search-words-data-structure": [
    [
      ["WordDictionary", "addWord", "addWord", "search", "search", "search", "search", "search"],
      [[], ["a"], ["ab"], ["a"], ["a."], ["ab"], [".a"], ["..."]],
    ],
    [
      ["WordDictionary", "search", "addWord", "search", "search"],
      [[], ["."], ["xyz"], ["x.z"], ["x.."]],
    ],
  ],
  "word-search-ii": [
    [[["a"]], ["a"]],
    [[["a", "a"]], ["aaa"]],
    [[["o", "a", "b", "n"], ["o", "t", "a", "e"], ["a", "h", "k", "r"], ["a", "f", "l", "v"]], ["oa", "oaa", "oath", "eat", "rain", "hklf", "hf"]],
  ],

  // ---- Heap / Priority Queue ----
  "kth-largest-element-in-a-stream": [
    [
      ["KthLargest", "add", "add", "add", "add", "add"],
      [[1, []], [-3], [-2], [-4], [0], [4]],
    ],
    [
      ["KthLargest", "add", "add", "add"],
      [[2, [0]], [-1], [1], [-2]],
    ],
  ],
  "last-stone-weight": [[[1]], [[2, 2]], [[10, 4, 2, 10]], [randArr(30, 1, 1000)]],
  "k-closest-points-to-origin": [[[[0, 1]], 1], [[[1, 3], [-2, 2], [2, -2]], 2], [[[3, 3], [5, -1], [-2, 4]], 2]],
  "kth-largest-element-in-an-array": [[[1], 1], [[2, 1], 2], [[-1, -1, -1, 3], 2], [randArr(3000, -10000, 10000), 1500]],
  "task-scheduler": [[["A"], 0], [["A", "A", "A", "B", "B", "B"], 0], [["A", "A", "A", "A", "A", "A", "B", "C", "D", "E", "F", "G"], 2]],
  "design-twitter": [
    [
      ["Twitter", "postTweet", "postTweet", "getNewsFeed", "follow", "getNewsFeed", "unfollow", "getNewsFeed", "follow", "getNewsFeed"],
      [[], [1, 5], [2, 3], [1], [1, 2], [1], [1, 2], [1], [1, 1], [1]],
    ],
    [
      ["Twitter", ...range(12, () => "postTweet"), "getNewsFeed", "follow", "postTweet", "getNewsFeed"],
      [[], ...range(12, (i) => [1, i + 100]), [1], [2, 1], [2, 500], [2]],
    ],
  ],
  "find-median-from-data-stream": [
    [
      ["MedianFinder", "addNum", "findMedian", "addNum", "findMedian", "addNum", "findMedian", "addNum", "findMedian"],
      [[], [-1], [], [-2], [], [-3], [], [-4], []],
    ],
    [
      ["MedianFinder", "addNum", "addNum", "addNum", "addNum", "findMedian"],
      [[], [5], [5], [1], [100], []],
    ],
  ],

  // ---- Backtracking ----
  subsets: [[[5]], [[-1, 1]], [[1, 2, 3, 4]]],
  "combination-sum": [[[1], 1], [[2], 1], [[2, 3, 5], 8], [[7, 3, 2], 18]],
  "combination-sum-ii": [[[1], 1], [[2], 1], [[1, 1, 1, 1, 1], 3], [[3, 1, 3, 5, 1, 1], 8]],
  permutations: [[[0]], [[-1, 2]], [[1, 2, 3, 4]]],
  "subsets-ii": [[[5]], [[1, 1]], [[4, 4, 4, 1, 4]]],
  "word-search": [
    [[["a"]], "a"],
    [[["a", "b"], ["c", "d"]], "abdc"],
    [[["a", "b"], ["c", "d"]], "abcd"],
    [[["a", "a", "a"], ["a", "a", "a"]], "aaaaaaa"],
  ],
  "palindrome-partitioning": [["b"], ["aaa"], ["abba"]],
  "letter-combinations-of-a-phone-number": [["7"], ["79"], ["234"]],
  "n-queens": [[2], [3], [5]],

  // ---- Graphs ----
  "number-of-islands": [
    [[["0"]]],
    [[["1"]]],
    [[["1", "0", "1"], ["0", "1", "0"], ["1", "0", "1"]]],
    [grid(20, 20, (r, c) => ((r * 7 + c * 13) % 5 < 2 ? "1" : "0"))],
  ],
  "max-area-of-island": [[[[0]]], [[[1]]], [[[1, 1, 0], [0, 1, 0], [1, 0, 1]]], [grid(20, 20, (r, c) => ((r * 3 + c * 5) % 7 < 4 ? 1 : 0))]],
  "clone-graph": [[[[2], [1]]], [[[2, 3], [1, 3], [1, 2]]], [[[2, 5], [1, 3], [2, 4], [3, 5], [1, 4]]]],
  "walls-and-gates": [
    [[[0]]],
    [[[2147483647]]],
    [[[2147483647, 2147483647], [2147483647, 0]]],
    [[[0, -1, 2147483647], [-1, 2147483647, 2147483647], [2147483647, 2147483647, 0]]],
  ],
  "rotting-oranges": [[[[0]]], [[[1]]], [[[2, 2], [1, 1], [0, 0], [2, 0]]], [[[2, 1, 1], [1, 1, 1], [0, 1, 2]]]],
  "pacific-atlantic-water-flow": [[[[1]]], [[[1, 1], [1, 1]]], [[[3, 3, 3], [3, 1, 3], [0, 2, 4]]]],
  "surrounded-regions": [
    [[["O"]]],
    [[["X", "X", "X"], ["X", "O", "X"], ["X", "X", "X"]]],
    [[["O", "O", "O"], ["O", "O", "O"], ["O", "O", "O"]]],
    [[["X", "O", "X", "X"], ["X", "O", "O", "X"], ["X", "X", "X", "X"], ["X", "O", "O", "X"], ["X", "X", "X", "O"]]],
  ],
  "course-schedule": [[1, []], [3, [[1, 0], [2, 1], [0, 2]]], [4, [[1, 0], [2, 0], [3, 1], [3, 2]]], [2, [[0, 1], [1, 0]]]],
  "course-schedule-ii": [[1, []], [3, [[1, 0], [2, 1], [0, 2]]], [4, [[1, 0], [2, 0], [3, 1], [3, 2]]], [3, [[1, 0]]]],
  "graph-valid-tree": [[1, []], [2, []], [4, [[0, 1], [2, 3]]], [4, [[0, 1], [0, 2], [0, 3]]]],
  "number-of-connected-components-in-an-undirected-graph": [[1, []], [3, [[0, 1]]], [6, [[0, 1], [2, 3], [4, 5], [1, 2]]]],
  "redundant-connection": [[[[1, 2], [1, 3], [2, 3]]], [[[1, 2], [2, 3], [3, 4], [1, 4], [1, 5]]], [[[3, 4], [1, 2], [2, 4], [3, 5], [2, 5]]]],
  "word-ladder": [["a", "c", ["a", "b", "c"]], ["hot", "dog", ["hot", "dog"]], ["red", "tax", ["ted", "tex", "red", "tax", "tad", "den", "rex", "pee"]]],

  // ---- Advanced Graphs ----
  "network-delay-time": [[[[1, 2, 1]], 2, 2], [[[1, 2, 1], [2, 3, 2], [1, 3, 4]], 3, 1], [[[1, 2, 1], [2, 1, 3]], 2, 2]],
  "reconstruct-itinerary": [
    [[["JFK", "KUL"], ["JFK", "NRT"], ["NRT", "JFK"]]],
    [[["JFK", "AAA"], ["AAA", "JFK"], ["JFK", "BBB"], ["JFK", "CCC"], ["CCC", "JFK"]]],
  ],
  "min-cost-to-connect-all-points": [[[[0, 0]]], [[[-1000000, -1000000], [1000000, 1000000]]], [[...new Set(range(200, () => `${randInt(-1000, 1000)},${randInt(-1000, 1000)}`))].map((k) => k.split(",").map(Number))]],
  "swim-in-rising-water": [[[[0]]], [[[3, 2], [0, 1]]], [shuffled(range(400)).reduce((g, v, i) => (i % 20 ? g[g.length - 1].push(v) : g.push([v]), g), [])]],
  "alien-dictionary": [[["z", "z"]], [["ab", "adc"]], [["abc", "ab"]], [["wrt", "wrtkj"]], [["a", "b", "ca", "cc"]]],
  "cheapest-flights-within-k-stops": [
    [3, [[0, 1, 100], [1, 2, 100], [0, 2, 500]], 0, 2, 0],
    [4, [[0, 1, 1], [0, 2, 5], [1, 2, 1], [2, 3, 1]], 0, 3, 1],
    [2, [[0, 1, 2]], 1, 0, 1],
  ],

  // ---- 1-D DP ----
  "climbing-stairs": [[1], [5], [45]],
  "min-cost-climbing-stairs": [[[0, 0]], [[5, 1]], [[0, 2, 2, 1]], [randArr(1000, 0, 999)]],
  "house-robber": [[[0]], [[2, 1]], [[2, 1, 1, 2]], [randArr(100, 0, 400)]],
  "house-robber-ii": [[[1]], [[1, 2]], [[200, 3, 140, 20, 10]], [randArr(100, 0, 1000)]],
  "longest-palindromic-substring": [["a"], ["ac"], ["aacabdkacaa"], [letters(800, "ab")]],
  "palindromic-substrings": [["a"], ["abba"], ["fdsklf"], [letters(800, "ab")]],
  "decode-ways": [["0"], ["10"], ["2101"], ["2611055971756562"], ["27"]],
  "coin-change": [[[1], 0], [[2], 3], [[186, 419, 83, 408], 6249], [[1, 7, 10], 14]],
  "maximum-product-subarray": [[[-2]], [[0, 2]], [[-2, 3, -4]], [[2, -5, -2, -4, 3]], [[-1, -2, -3, 0]]],
  "word-break": [["a", ["b"]], ["aaaaaaa", ["aaaa", "aaa"]], ["cars", ["car", "ca", "rs"]], ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaab", ["a", "aa", "aaa", "aaaa"]]],
  "longest-increasing-subsequence": [[[1]], [[4, 10, 4, 3, 8, 9]], [[3, 5, 6, 2, 5, 4, 19, 5, 6, 7, 12]], [randArr(1000, -10000, 10000)]],
  "partition-equal-subset-sum": [[[1]], [[2, 2]], [[1, 2, 5]], [[3, 3, 3, 4, 5]], [randArr(100, 1, 100)]],

  // ---- 2-D DP ----
  "unique-paths": [[1, 1], [1, 10], [10, 10], [23, 12]],
  "longest-common-subsequence": [["a", "b"], ["bl", "yby"], ["ezupkr", "ubmrapg"], [letters(500, "abcd"), letters(500, "abcd")]],
  "best-time-to-buy-and-sell-stock-with-cooldown": [[[1]], [[2, 1]], [[1, 2, 4]], [[6, 1, 3, 2, 4, 7]]],
  "coin-change-ii": [[0, [7]], [3, [2]], [10, [10]], [500, [3, 5, 7, 8, 9, 10, 11]]],
  "target-sum": [[[1], 1], [[1], 2], [[0, 0, 0, 0, 0, 0, 0, 0, 1], 1], [[1, 2, 1], 0]],
  "interleaving-string": [["", "", ""], ["a", "", "c"], ["", "b", "b"], ["aabcc", "dbbca", "aadbbbaccc"], ["abababababababababab", "babababababababababa", "babababababababababababababababababababa"]],
  "longest-increasing-path-in-a-matrix": [[[[7]]], [[[1, 2]]], [grid(30, 30, () => randInt(0, 100))]],
  "distinct-subsequences": [["a", "b"], ["aaa", "a"], ["ddd", "dd"], ["babgbag", "bag"]],
  "edit-distance": [["", ""], ["", "a"], ["a", "b"], ["intention", "execution"], [letters(300, "abc"), letters(300, "abc")]],
  "burst-balloons": [[[7]], [[3, 1]], [[9, 76, 64, 21]], [randArr(60, 0, 100)]],
  "regular-expression-matching": [["a", "."], ["ab", ".*c"], ["aaa", "a*a"], ["mississippi", "mis*is*p*."], ["aab", "c*a*b"], ["a", "ab*"]],

  // ---- Greedy ----
  "maximum-subarray": [[[-1]], [[-2, -1]], [[8, -19, 5, -4, 20]], [randArr(3000, -10000, 10000)]],
  "jump-game": [[[0]], [[2, 0, 0]], [[1, 0, 1, 0]], [[...range(1000, () => 1), 0, 0]]],
  "jump-game-ii": [[[0]], [[1, 2]], [[1, 1, 1, 1]], [[2, 1, 1, 1, 4]]],
  "gas-station": [[[5], [4]], [[4], [5]], [[5, 1, 2, 3, 4], [4, 4, 1, 5, 1]], [[3, 1, 1], [1, 2, 2]]],
  "hand-of-straights": [[[1], 1], [[1, 1, 2, 2, 3, 3], 3], [[1, 2, 3, 4, 5, 6], 2], [[8, 10, 12], 3], [[2, 1], 2]],
  "merge-triplets-to-form-target-triplet": [[[[1, 1, 1]], [1, 1, 1]], [[[3, 4, 5], [4, 5, 6]], [3, 2, 5]], [[[2, 5, 3], [2, 3, 4], [1, 2, 5], [5, 2, 3]], [5, 5, 5]]],
  "partition-labels": [["a"], ["abc"], ["caedbdedda"], ["eaaaabaaec"]],
  "valid-parenthesis-string": [["*"], [")("], ["(((*)"], ["((*)"], ["(*)))"]],

  // ---- Intervals ----
  "insert-interval": [[[], [5, 7]], [[[1, 5]], [6, 8]], [[[1, 5]], [0, 0]], [[[3, 5], [12, 15]], [6, 6]], [[[1, 5]], [2, 3]]],
  "merge-intervals": [[[[1, 4]]], [[[1, 4], [0, 0]]], [[[2, 3], [4, 5], [6, 7], [8, 9], [1, 10]]], [[[1, 4], [0, 2], [3, 5]]]],
  "non-overlapping-intervals": [[[[1, 2]]], [[[1, 100], [11, 22], [1, 11], [2, 12]]], [[[0, 2], [1, 3], [2, 4], [3, 5], [4, 6]]]],
  "meeting-rooms": [[[]], [[[1, 5]]], [[[1, 5], [5, 10]]], [[[13, 15], [1, 13], [6, 9]]]],
  "meeting-rooms-ii": [[[[1, 5]]], [[[1, 5], [5, 10]]], [[[1, 10], [2, 7], [3, 19], [8, 12], [10, 20], [11, 30]]]],
  "minimum-interval-to-include-each-query": [[[[1, 1]], [1, 2]], [[[4, 5], [5, 8], [1, 9], [8, 10], [1, 6]], [7, 9, 3, 9, 3]], [[[2, 3], [2, 5], [1, 8], [20, 25]], [2, 19, 5, 22]]],

  // ---- Math & Geometry ----
  "rotate-image": [[[[1]]], [[[1, 2], [3, 4]]], [grid(6, 6, (r, c) => r * 6 + c)]],
  "spiral-matrix": [[[[1]]], [[[1], [2], [3]]], [[[1, 2, 3]]], [grid(5, 7, (r, c) => r * 7 + c)]],
  "set-matrix-zeroes": [[[[0]]], [[[1, 0]]], [[[1, 2, 3, 4], [5, 0, 7, 8], [0, 10, 11, 12], [13, 14, 15, 0]]]],
  "happy-number": [[1], [7], [4], [1111111]],
  "plus-one": [[[0]], [[9]], [[8, 9, 9]], [[...range(100, () => 9)]]],
  "powx-n": [[1.0, -2147483648], [2.0, -2], [-2.0, 3], [0.5, 10], [1.00001, 123456]],
  "multiply-strings": [["0", "52"], ["9", "9"], ["999", "999"], ["123456789", "987654321"]],
  "detect-squares": [
    [
      ["DetectSquares", "add", "add", "add", "add", "count", "count"],
      [[], [[0, 0]], [[0, 1]], [[1, 1]], [[1, 1]], [[1, 0]], [[0, 0]]],
    ],
    [
      ["DetectSquares", "add", "add", "add", "count", "add", "count"],
      [[], [[5, 10]], [[10, 5]], [[10, 10]], [[5, 5]], [[3, 0]], [[0, 0]]],
    ],
  ],

  // ---- Bit Manipulation ----
  "single-number": [[[1]], [[-1, 7, 7]], [[...range(1000), ...range(1000), 31337]]],
  "number-of-1-bits": [[1], [2147483647], [1024]],
  "counting-bits": [[0], [1], [16]],
  "reverse-bits": [[0], [2], [1024], [2147483646]],
  "missing-number": [[[0]], [[1]], [[1, 2]], [shuffled([...range(1000).filter((i) => i !== 413), 1000])]],
  "sum-of-two-integers": [[0, 0], [-1, 1], [-12, -8], [1000, -1000], [-1000, 999]],
  "reverse-integer": [[0], [-120], [1534236469], [-2147483412], [1463847412]],
};

export const EXTRA = Object.fromEntries(Object.entries(E).map(([slug, tests]) => [slug, tests.map((args) => args.map((a) => JSON.stringify(a)).join("\n"))]));
