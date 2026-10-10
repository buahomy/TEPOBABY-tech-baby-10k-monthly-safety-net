// Seven NeetCode 150 problems are subscriber-only on LeetCode, so its API returns no statement or
// starter code for them (it does return their test inputs and signatures). These are our own
// write-ups of those classic problems, in LeetCode's format so they render the same way.

const ex = (n, input, output, explanation) =>
  `<p><strong class="example">Example ${n}:</strong></p>\n<pre>\n<strong>Input:</strong> ${input}\n<strong>Output:</strong> ${output}${
    explanation ? `\n<strong>Explanation:</strong> ${explanation}` : ""
  }\n</pre>`;

const doc = (paras, examples, constraints) =>
  [...paras.map((p) => `<p>${p}</p>`), "<p>&nbsp;</p>", ...examples, "<p>&nbsp;</p>", "<p><strong>Constraints:</strong></p>", `<ul>${constraints.map((c) => `<li>${c}</li>`).join("")}</ul>`].join("\n");

export const PREMIUM = {
  "encode-and-decode-strings": {
    content: doc(
      [
        "Design an algorithm to encode a <strong>list of strings</strong> into a single string, and decode that string back into the original list.",
        "Implement <code>encode(strs)</code>, which turns the list into one string, and <code>decode(s)</code>, which turns that string back into the list. The strings may contain <em>any</em> character, including the one you'd like to use as a separator.",
        "The judge checks that <code>decode(encode(strs))</code> gives back exactly <code>strs</code>.",
      ],
      [ex(1, 'strs = ["Hello","World"]', '["Hello","World"]'), ex(2, 'strs = [""]', '[""]')],
      ["<code>0 &lt;= strs.length &lt; 100</code>", "<code>0 &lt;= strs[i].length &lt; 200</code>", "<code>strs[i]</code> can contain any of the 256 ASCII characters."],
    ),
    snippets: {
      python3: `class Codec:
    def encode(self, strs: List[str]) -> str:
        """Encodes a list of strings to a single string."""


    def decode(self, s: str) -> List[str]:
        """Decodes a single string to a list of strings."""
        `,
      javascript: `/**
 * Encodes a list of strings to a single string.
 * @param {string[]} strs
 * @return {string}
 */
var encode = function(strs) {

};

/**
 * Decodes a single string to a list of strings.
 * @param {string} s
 * @return {string[]}
 */
var decode = function(s) {

};`,
    },
  },

  "walls-and-gates": {
    content: doc(
      [
        "You are given an <code>m x n</code> grid <code>rooms</code> with three possible values:",
        "<code>-1</code> is a wall or obstacle, <code>0</code> is a gate, and <code>2147483647</code> (<code>INF</code>) is an empty room.",
        "Fill each empty room with the number of steps to its <strong>nearest gate</strong>, moving up, down, left or right. If a room can't reach any gate, leave it as <code>INF</code>. Modify <code>rooms</code> in place; don't return anything.",
      ],
      [
        ex(
          1,
          "rooms = [[2147483647,-1,0,2147483647],[2147483647,2147483647,2147483647,-1],[2147483647,-1,2147483647,-1],[0,-1,2147483647,2147483647]]",
          "[[3,-1,0,1],[2,2,1,-1],[1,-1,2,-1],[0,-1,3,4]]",
        ),
        ex(2, "rooms = [[-1]]", "[[-1]]"),
      ],
      ["<code>m == rooms.length</code>, <code>n == rooms[i].length</code>", "<code>1 &lt;= m, n &lt;= 250</code>", "<code>rooms[i][j]</code> is <code>-1</code>, <code>0</code>, or <code>2<sup>31</sup> - 1</code>."],
    ),
    snippets: {
      python3: `class Solution:
    def wallsAndGates(self, rooms: List[List[int]]) -> None:
        """
        Do not return anything, modify rooms in-place instead.
        """
        `,
      javascript: `/**
 * @param {number[][]} rooms
 * @return {void} Do not return anything, modify rooms in-place instead.
 */
var wallsAndGates = function(rooms) {

};`,
    },
  },

  "graph-valid-tree": {
    content: doc(
      [
        "You have a graph of <code>n</code> nodes labeled <code>0</code> to <code>n - 1</code>, and a list of undirected <code>edges</code> where <code>edges[i] = [a<sub>i</sub>, b<sub>i</sub>]</code>.",
        "Return <code>true</code> if the edges make up a <strong>valid tree</strong> (connected, with no cycles), and <code>false</code> otherwise.",
      ],
      [ex(1, "n = 5, edges = [[0,1],[0,2],[0,3],[1,4]]", "true"), ex(2, "n = 5, edges = [[0,1],[1,2],[2,3],[1,3],[1,4]]", "false", "1 → 2 → 3 → 1 is a cycle.")],
      ["<code>1 &lt;= n &lt;= 2000</code>", "<code>0 &lt;= edges.length &lt;= 5000</code>", "<code>0 &lt;= a<sub>i</sub>, b<sub>i</sub> &lt; n</code>, <code>a<sub>i</sub> != b<sub>i</sub></code>", "There are no repeated edges."],
    ),
    snippets: {
      python3: `class Solution:
    def validTree(self, n: int, edges: List[List[int]]) -> bool:
        `,
      javascript: `/**
 * @param {number} n
 * @param {number[][]} edges
 * @return {boolean}
 */
var validTree = function(n, edges) {

};`,
    },
  },

  "number-of-connected-components-in-an-undirected-graph": {
    content: doc(
      [
        "You have a graph of <code>n</code> nodes labeled <code>0</code> to <code>n - 1</code>, and a list of undirected <code>edges</code> where <code>edges[i] = [a<sub>i</sub>, b<sub>i</sub>]</code>.",
        "Return the number of <strong>connected components</strong> in the graph.",
      ],
      [ex(1, "n = 5, edges = [[0,1],[1,2],[3,4]]", "2"), ex(2, "n = 5, edges = [[0,1],[1,2],[2,3],[3,4]]", "1")],
      ["<code>1 &lt;= n &lt;= 2000</code>", "<code>1 &lt;= edges.length &lt;= 5000</code>", "<code>0 &lt;= a<sub>i</sub> &lt;= b<sub>i</sub> &lt; n</code>, <code>a<sub>i</sub> != b<sub>i</sub></code>", "There are no repeated edges."],
    ),
    snippets: {
      python3: `class Solution:
    def countComponents(self, n: int, edges: List[List[int]]) -> int:
        `,
      javascript: `/**
 * @param {number} n
 * @param {number[][]} edges
 * @return {number}
 */
var countComponents = function(n, edges) {

};`,
    },
  },

  "alien-dictionary": {
    content: doc(
      [
        "An alien language uses the English lowercase letters, but in an unknown order.",
        "You're given a list of <code>words</code> from the alien dictionary, <strong>sorted lexicographically</strong> by the rules of that language.",
        'Return a string of the unique letters in the words, sorted in the alien order. If the given order is impossible, return <code>""</code>. If there are several valid orders, return <strong>any</strong> of them.',
        "A string <code>s</code> comes before <code>t</code> if, at the first letter where they differ, <code>s</code>'s letter comes first in the alien order. If one string is a prefix of the other, the shorter one comes first.",
      ],
      [
        ex(1, 'words = ["wrt","wrf","er","ett","rftt"]', '"wertf"'),
        ex(2, 'words = ["z","x"]', '"zx"'),
        ex(3, 'words = ["z","x","z"]', '""', "z comes before x and x comes before z, which is impossible."),
      ],
      ["<code>1 &lt;= words.length &lt;= 100</code>", "<code>1 &lt;= words[i].length &lt;= 100</code>", "<code>words[i]</code> has only lowercase English letters."],
    ),
    snippets: {
      python3: `class Solution:
    def alienOrder(self, words: List[str]) -> str:
        `,
      javascript: `/**
 * @param {string[]} words
 * @return {string}
 */
var alienOrder = function(words) {

};`,
    },
  },

  "meeting-rooms": {
    content: doc(
      [
        "Given an array of meeting time <code>intervals</code> where <code>intervals[i] = [start<sub>i</sub>, end<sub>i</sub>]</code>, decide whether one person could attend <strong>all</strong> the meetings.",
        "A meeting that ends at time <code>t</code> doesn't conflict with one that starts at <code>t</code>.",
      ],
      [ex(1, "intervals = [[0,30],[5,10],[15,20]]", "false"), ex(2, "intervals = [[7,10],[2,4]]", "true")],
      ["<code>0 &lt;= intervals.length &lt;= 10<sup>4</sup></code>", "<code>intervals[i].length == 2</code>", "<code>0 &lt;= start<sub>i</sub> &lt; end<sub>i</sub> &lt;= 10<sup>6</sup></code>"],
    ),
    snippets: {
      python3: `class Solution:
    def canAttendMeetings(self, intervals: List[List[int]]) -> bool:
        `,
      javascript: `/**
 * @param {number[][]} intervals
 * @return {boolean}
 */
var canAttendMeetings = function(intervals) {

};`,
    },
  },

  "meeting-rooms-ii": {
    content: doc(
      [
        "Given an array of meeting time <code>intervals</code> where <code>intervals[i] = [start<sub>i</sub>, end<sub>i</sub>]</code>, return the <strong>minimum number of conference rooms</strong> needed to hold all the meetings.",
        "A room freed at time <code>t</code> can host a meeting that starts at <code>t</code>.",
      ],
      [ex(1, "intervals = [[0,30],[5,10],[15,20]]", "2"), ex(2, "intervals = [[7,10],[2,4]]", "1")],
      ["<code>1 &lt;= intervals.length &lt;= 10<sup>4</sup></code>", "<code>0 &lt;= start<sub>i</sub> &lt; end<sub>i</sub> &lt;= 10<sup>6</sup></code>"],
    ),
    snippets: {
      python3: `class Solution:
    def minMeetingRooms(self, intervals: List[List[int]]) -> int:
        `,
      javascript: `/**
 * @param {number[][]} intervals
 * @return {number}
 */
var minMeetingRooms = function(intervals) {

};`,
    },
  },
};
