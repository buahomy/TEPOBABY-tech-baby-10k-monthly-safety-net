// Tests and mock services for the Sierra OA practice problems (see ./problems.js).
//
// SIERRA_SUITES[problemId][partIndex] is a list of { name, run(mod) } tests. `mod` holds the student's
// top-level functions and classes (the problem's `entry` names). A test throws an Error with a plain
// explanation when it fails. The mocks answer on a macrotask (setTimeout 0) so a runaway loop still lets
// per-test timeouts fire, and they refuse after too many calls instead of spinning forever.

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const MAX_CALLS = 2000;

function show(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function eq(actual, expected, label = "result") {
  if (show(actual) !== show(expected)) throw new Error(`${label}: expected ${show(expected)}, got ${show(actual)}`);
}

export function ok(cond, message) {
  if (!cond) throw new Error(message);
}

async function rejects(promiseOrFn, message) {
  try {
    await (typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn);
  } catch {
    return;
  }
  throw new Error(message);
}

function throwsSync(fn, message) {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(message);
}

function need(mod, name) {
  const v = mod[name];
  if (typeof v !== "function") throw new Error(`Define a top-level ${name} (function or class).`);
  return v;
}

// ---------- mock services ----------

/** A paginated service. pages: { start: { items, next }, p1: {...} }. failures/hangs: cursor key -> count. */
export function pagedApi(pages, { failures = {}, hangs = {} } = {}) {
  const fails = { ...failures };
  const hang = { ...hangs };
  const calls = [];
  async function fetchPage(cursor) {
    calls.push(cursor);
    if (calls.length > MAX_CALLS) throw new Error("Too many calls to the service: is your loop stuck?");
    await tick();
    const key = cursor ?? "start";
    if (hang[key] > 0) {
      hang[key]--;
      return new Promise(() => {}); // never answers
    }
    if (fails[key] > 0) {
      fails[key]--;
      throw new Error("503 Service Unavailable");
    }
    const page = pages[key];
    if (!page) throw new Error(`400 Unknown cursor ${show(cursor)}`);
    return { items: page.items.map((x) => ({ ...x })), nextCursor: page.next };
  }
  return { fetchPage, calls, callsFor: (key) => calls.filter((c) => (c ?? "start") === key).length };
}

/** Splits items into pages of `size`: cursors start, p1, p2, ... */
export function pagesOf(items, size) {
  const pages = {};
  const count = Math.max(1, Math.ceil(items.length / size));
  for (let i = 0; i < count; i++) {
    pages[i === 0 ? "start" : `p${i}`] = { items: items.slice(i * size, i * size + size), next: i + 1 < count ? `p${i + 1}` : null };
  }
  return pages;
}

export function makeMessages(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `m${i}`,
      role: i === 0 ? "system" : i % 2 ? "user" : "assistant",
      text: `message ${i}`,
      tokens: ((i * 7) % 20) + 5,
    });
  }
  return out;
}

const ids = (list) => (Array.isArray(list) ? list.map((m) => m && m.id) : list);

function historyApi(messages, size, faults) {
  return pagedApi(pagesOf(messages, size), faults);
}

function warehouseApi(items, size, faults) {
  const api = pagedApi(pagesOf(items, size), faults);
  return { listStock: api.fetchPage, calls: api.calls, callsFor: api.callsFor };
}

function storeApi(initial = {}, { failOnce = [], failAlways = [] } = {}) {
  const data = { ...initial };
  const once = new Set(failOnce);
  let always = new Set(failAlways);
  const setCalls = [];
  let getCalls = 0;
  return {
    data,
    setCalls,
    get getCalls() {
      return getCalls;
    },
    heal() {
      always = new Set();
    },
    async getStock() {
      getCalls++;
      await tick();
      return { ...data };
    },
    async setStock(sku, qty) {
      setCalls.push(sku);
      if (setCalls.length > MAX_CALLS) throw new Error("Too many setStock calls: is your loop stuck?");
      await tick();
      if (always.has(sku)) throw new Error(`500 Could not write ${sku}`);
      if (once.has(sku)) {
        once.delete(sku);
        throw new Error(`503 Could not write ${sku}`);
      }
      data[sku] = qty;
    },
  };
}

const stock = (n) => Array.from({ length: n }, (_, i) => ({ sku: `SKU${i + 1}`, qty: (i * 3) % 7 }));
const count = (list, v) => list.filter((x) => x === v).length;
const FAST = { attempts: 4, baseMs: 1, timeoutMs: 100 };

// ---------- suites ----------

const LOGS = [
  [0, 5, "A"],
  [3, 10, "B"],
  [12, 15, "C"],
];

const CATALOG = {
  tent: ["stakes", "rainfly"],
  stakes: ["mallet"],
  rainfly: ["tent", "seam-sealer"],
  mallet: [],
  lantern: ["batteries", "fuel"],
  batteries: [],
};

export const SIERRA_SUITES = {
  intervals: [
    [
      { name: "Merges the example", run: (m) => eq(need(m, "mergeLogs")(LOGS), [[0, 10, "A B"], [12, 15, "C"]]) },
      {
        name: "Touching segments don't merge",
        run: (m) => eq(need(m, "mergeLogs")([[1, 4, "X"], [4, 6, "Y"], [5, 8, "Z"]]), [[1, 4, "X"], [4, 8, "Y Z"]]),
      },
      { name: "Sorts unsorted input", run: (m) => eq(need(m, "mergeLogs")([[12, 15, "C"], [0, 5, "A"], [3, 10, "B"]]), [[0, 10, "A B"], [12, 15, "C"]]) },
      { name: "Same start: shorter segment's text first", run: (m) => eq(need(m, "mergeLogs")([[0, 5, "A"], [0, 3, "B"]]), [[0, 5, "B A"]]) },
      { name: "Absorbs segments inside a longer one", run: (m) => eq(need(m, "mergeLogs")([[0, 10, "A"], [2, 3, "B"], [4, 5, "C"]]), [[0, 10, "A B C"]]) },
      { name: "Empty input", run: (m) => eq(need(m, "mergeLogs")([]), []) },
      {
        name: "Doesn't change the input",
        run: (m) => {
          const input = [[3, 10, "B"], [0, 5, "A"]];
          need(m, "mergeLogs")(input);
          eq(input, [[3, 10, "B"], [0, 5, "A"]], "input after the call");
        },
      },
    ],
    [
      { name: "Example: overlap and gap", run: (m) => eq(need(m, "overlapAndGap")(LOGS), [true, true]) },
      { name: "Touching is neither", run: (m) => eq(need(m, "overlapAndGap")([[0, 2, "A"], [2, 5, "B"]]), [false, false]) },
      { name: "Empty input", run: (m) => eq(need(m, "overlapAndGap")([]), [false, false]) },
      { name: "Overlap without a gap", run: (m) => eq(need(m, "overlapAndGap")([[0, 5, "A"], [3, 8, "B"]]), [true, false]) },
      { name: "Gap without an overlap", run: (m) => eq(need(m, "overlapAndGap")([[3, 4, "B"], [0, 2, "A"]]), [false, true]) },
      { name: "A long segment covers what looks like a gap", run: (m) => eq(need(m, "overlapAndGap")([[0, 10, "A"], [2, 3, "B"], [5, 6, "C"]]), [true, false]) },
      { name: "Gap after a long segment", run: (m) => eq(need(m, "overlapAndGap")([[11, 12, "C"], [2, 3, "B"], [0, 10, "A"]]), [true, true]) },
    ],
  ],

  related: [
    [
      { name: "Breadth-first, closest first", run: (m) => eq(need(m, "related")(CATALOG, "tent"), ["stakes", "rainfly", "mallet", "seam-sealer"]) },
      { name: "Item with no relations", run: (m) => eq(need(m, "related")(CATALOG, "mallet"), []) },
      { name: "Unknown item", run: (m) => eq(need(m, "related")(CATALOG, "kayak"), []) },
      { name: "Related items without their own entry", run: (m) => eq(need(m, "related")(CATALOG, "lantern"), ["batteries", "fuel"]) },
      {
        name: "Loops don't repeat items or include the start",
        run: (m) => eq(need(m, "related")({ a: ["b"], b: ["c", "a"], c: ["a", "b"] }, "a"), ["b", "c"]),
      },
    ],
    [
      { name: "maxDepth 1: direct relations only", run: (m) => eq(need(m, "related")(CATALOG, "tent", 1), ["stakes", "rainfly"]) },
      { name: "maxDepth 2", run: (m) => eq(need(m, "related")(CATALOG, "tent", 2), ["stakes", "rainfly", "mallet", "seam-sealer"]) },
      { name: "maxDepth 0", run: (m) => eq(need(m, "related")(CATALOG, "tent", 0), []) },
      {
        name: "Depth counts levels, not items",
        run: (m) => eq(need(m, "related")({ a: ["b", "c"], b: ["d"], c: ["e"], d: ["f"] }, "a", 2), ["b", "c", "d", "e"]),
      },
    ],
  ],

  history: [
    [
      {
        name: "Returns every message in order across pages",
        run: async (m) => {
          const msgs = makeMessages(23);
          eq(ids(await need(m, "loadHistory")(historyApi(msgs, 5))), ids(msgs), "message ids");
        },
      },
      {
        name: "Starts with cursor null",
        run: async (m) => {
          const api = historyApi(makeMessages(7), 3);
          await need(m, "loadHistory")(api);
          eq(api.calls[0], null, "first cursor");
          eq(api.calls.length, 3, "number of fetchPage calls");
        },
      },
      {
        name: "Empty conversation",
        run: async (m) => eq(ids(await need(m, "loadHistory")(pagedApi({ start: { items: [], next: null } }))), [], "message ids"),
      },
      {
        name: "Keeps going past an empty page",
        run: async (m) => {
          const [a, b, c] = makeMessages(3);
          const api = pagedApi({ start: { items: [a, b], next: "x1" }, x1: { items: [], next: "x2" }, x2: { items: [c], next: null } });
          eq(ids(await need(m, "loadHistory")(api)), ["m0", "m1", "m2"], "message ids");
        },
      },
      {
        name: "Throws on a repeating cursor instead of looping",
        run: async (m) => {
          const [a, b] = makeMessages(2);
          const api = pagedApi({ start: { items: [a], next: "loop" }, loop: { items: [b], next: "loop" } });
          await rejects(need(m, "loadHistory")(api), "Expected an error when the service repeats a cursor.");
          ok(api.calls.length < 10, `Called the service ${api.calls.length} times before stopping.`);
        },
      },
    ],
    [
      {
        name: "Retries a page that fails twice",
        run: async (m) => {
          const msgs = makeMessages(12);
          const api = historyApi(msgs, 4, { failures: { p1: 2 } });
          eq(ids(await need(m, "loadHistory")(api, FAST)), ids(msgs), "message ids");
          eq(api.callsFor("p1"), 3, "tries for page p1");
        },
      },
      {
        name: "Times out a hanging call and retries it",
        run: async (m) => {
          const msgs = makeMessages(12);
          const api = historyApi(msgs, 4, { hangs: { p2: 1 } });
          eq(ids(await need(m, "loadHistory")(api, FAST)), ids(msgs), "message ids");
          eq(api.callsFor("p2"), 2, "tries for page p2");
        },
      },
      {
        name: "Gives up after `attempts` tries",
        run: async (m) => {
          const api = historyApi(makeMessages(8), 4, { failures: { p1: 99 } });
          await rejects(need(m, "loadHistory")(api, FAST), "Expected loadHistory to throw once every try failed.");
          eq(api.callsFor("p1"), 4, "tries for page p1 with attempts: 4");
        },
      },
      {
        name: "Timeout is per try, not for the whole load",
        run: async (m) => {
          const msgs = makeMessages(40);
          const slow = historyApi(msgs, 4);
          const api = {
            calls: slow.calls,
            fetchPage: async (c) => {
              await new Promise((r) => setTimeout(r, 30));
              return slow.fetchPage(c);
            },
          };
          eq(ids(await need(m, "loadHistory")(api, { attempts: 2, baseMs: 1, timeoutMs: 80 })), ids(msgs), "message ids");
        },
      },
      {
        name: "Works with default options",
        run: async (m) => {
          const msgs = makeMessages(6);
          eq(ids(await need(m, "loadHistory")(historyApi(msgs, 3, { failures: { start: 1 } }))), ids(msgs), "message ids");
        },
      },
    ],
    [
      {
        name: "Under budget: keeps everything",
        run: (m) => {
          const msgs = makeMessages(5);
          eq(ids(need(m, "compactHistory")(msgs, 10000)), ids(msgs), "kept ids");
        },
      },
      {
        name: "Drops the oldest messages first",
        run: (m) => {
          const msgs = [
            { id: "sys", role: "system", text: "s", tokens: 2 },
            { id: "m1", role: "user", text: "a", tokens: 1 },
            { id: "m2", role: "assistant", text: "b", tokens: 5 },
            { id: "m3", role: "user", text: "c", tokens: 4 },
            { id: "m4", role: "assistant", text: "d", tokens: 3 },
          ];
          eq(ids(need(m, "compactHistory")(msgs, 10)), ["sys", "m3", "m4"], "kept ids");
        },
      },
      {
        name: "Stops at the first message that doesn't fit",
        run: (m) => {
          const msgs = [
            { id: "m1", role: "user", text: "a", tokens: 1 },
            { id: "m2", role: "assistant", text: "b", tokens: 9 },
            { id: "m3", role: "user", text: "c", tokens: 2 },
          ];
          eq(ids(need(m, "compactHistory")(msgs, 4)), ["m3"], "kept ids (m1 would fit, but keeping it would leave a hole)");
        },
      },
      {
        name: "A total exactly equal to the budget fits",
        run: (m) => {
          const msgs = [
            { id: "sys", role: "system", text: "s", tokens: 3 },
            { id: "m1", role: "user", text: "a", tokens: 4 },
            { id: "m2", role: "assistant", text: "b", tokens: 3 },
          ];
          eq(ids(need(m, "compactHistory")(msgs, 10)), ["sys", "m1", "m2"], "kept ids");
        },
      },
      {
        name: "System messages stay even over budget",
        run: (m) => {
          const msgs = [
            { id: "sys", role: "system", text: "s", tokens: 50 },
            { id: "m1", role: "user", text: "a", tokens: 1 },
          ];
          eq(ids(need(m, "compactHistory")(msgs, 10)), ["sys"], "kept ids");
        },
      },
      {
        name: "Newest message too big: only system messages",
        run: (m) => {
          const msgs = [
            { id: "sys", role: "system", text: "s", tokens: 2 },
            { id: "m1", role: "user", text: "a", tokens: 1 },
            { id: "m2", role: "user", text: "b", tokens: 99 },
          ];
          eq(ids(need(m, "compactHistory")(msgs, 10)), ["sys"], "kept ids");
        },
      },
      {
        name: "Missing tokens: estimate ceil(text.length / 4)",
        run: (m) => {
          const msgs = [
            { id: "m1", role: "user", text: "x".repeat(9) }, // 3 tokens
            { id: "m2", role: "assistant", text: "x".repeat(8) }, // 2 tokens
            { id: "m3", role: "user", text: "x".repeat(5) }, // 2 tokens
          ];
          eq(ids(need(m, "compactHistory")(msgs, 5)), ["m2", "m3"], "kept ids");
          eq(ids(need(m, "compactHistory")(msgs, 7)), ["m1", "m2", "m3"], "kept ids at budget 7");
        },
      },
      { name: "Empty conversation", run: (m) => eq(need(m, "compactHistory")([], 10), []) },
      {
        name: "Doesn't change the input",
        run: (m) => {
          const msgs = makeMessages(6);
          const before = show(msgs);
          need(m, "compactHistory")(msgs, 20);
          eq(show(msgs), before, "input after the call");
        },
      },
    ],
  ],

  inventory: [
    [
      {
        name: "Copies every SKU into an empty store",
        run: async (m) => {
          const items = stock(12);
          const store = storeApi();
          const result = await need(m, "syncInventory")(warehouseApi(items, 5), store);
          eq(store.data, Object.fromEntries(items.map((x) => [x.sku, x.qty])), "store stock");
          eq(result, { updated: items.map((x) => x.sku), failed: [] }, "result");
        },
      },
      {
        name: "Leaves store-only SKUs alone",
        run: async (m) => {
          const store = storeApi({ OLD9: 4 });
          await need(m, "syncInventory")(warehouseApi(stock(3), 5), store);
          eq(store.data.OLD9, 4, "OLD9");
        },
      },
      {
        name: "Empty warehouse",
        run: async (m) => {
          const store = storeApi();
          eq(await need(m, "syncInventory")(warehouseApi([], 5), store), { updated: [], failed: [] }, "result");
        },
      },
    ],
    [
      {
        name: "Only writes SKUs whose quantity changed",
        run: async (m) => {
          const items = stock(8);
          const initial = Object.fromEntries(items.map((x) => [x.sku, x.qty]));
          initial.SKU2 = 99;
          initial.SKU5 = 99;
          delete initial.SKU7;
          const store = storeApi(initial);
          const result = await need(m, "syncInventory")(warehouseApi(items, 3), store, { attempts: 3, baseMs: 1 });
          eq(store.setCalls, ["SKU2", "SKU5", "SKU7"], "setStock calls");
          eq(result, { updated: ["SKU2", "SKU5", "SKU7"], failed: [] }, "result");
        },
      },
      {
        name: "Retries a write that fails once",
        run: async (m) => {
          const items = stock(4);
          const store = storeApi({}, { failOnce: ["SKU2"] });
          const result = await need(m, "syncInventory")(warehouseApi(items, 4), store, { attempts: 3, baseMs: 1 });
          eq(store.data.SKU2, items[1].qty, "SKU2 in the store");
          eq(count(store.setCalls, "SKU2"), 2, "setStock calls for SKU2");
          eq(result.updated, items.map((x) => x.sku), "updated");
        },
      },
      {
        name: "Retries a warehouse page that fails once",
        run: async (m) => {
          const items = stock(7);
          const store = storeApi();
          const result = await need(m, "syncInventory")(warehouseApi(items, 3, { failures: { p1: 1 } }), store, { attempts: 3, baseMs: 1 });
          eq(result.updated, items.map((x) => x.sku), "updated");
        },
      },
    ],
    [
      {
        name: "Reports a SKU that keeps failing and carries on",
        run: async (m) => {
          const items = stock(5);
          const store = storeApi({}, { failAlways: ["SKU3"] });
          const result = await need(m, "syncInventory")(warehouseApi(items, 5), store, { attempts: 3, baseMs: 1 });
          eq(result, { updated: ["SKU1", "SKU2", "SKU4", "SKU5"], failed: ["SKU3"] }, "result");
          eq(count(store.setCalls, "SKU3"), 3, "tries for SKU3 with attempts: 3");
        },
      },
      {
        name: "Re-running retries only what's left",
        run: async (m) => {
          const items = stock(5);
          const store = storeApi({}, { failAlways: ["SKU3"] });
          const sync = need(m, "syncInventory");
          await sync(warehouseApi(items, 5), store, { attempts: 2, baseMs: 1 });
          store.heal();
          store.setCalls.length = 0;
          const second = await sync(warehouseApi(items, 5), store, { attempts: 2, baseMs: 1 });
          eq(second, { updated: ["SKU3"], failed: [] }, "second run");
          eq(store.setCalls, ["SKU3"], "setStock calls in the second run");
        },
      },
      {
        name: "Nothing changed: writes nothing",
        run: async (m) => {
          const items = stock(6);
          const store = storeApi(Object.fromEntries(items.map((x) => [x.sku, x.qty])));
          const result = await need(m, "syncInventory")(warehouseApi(items, 4), store, { attempts: 2, baseMs: 1 });
          eq(result, { updated: [], failed: [] }, "result");
          eq(store.setCalls.length, 0, "setStock calls");
        },
      },
    ],
  ],

  spreadsheet: [
    [
      {
        name: "Numbers",
        run: (m) => {
          const s = new (need(m, "Sheet"))();
          s.set("A1", 5);
          eq(s.get("A1"), 5, "A1");
        },
      },
      {
        name: "A formula adds cells and constants",
        run: (m) => {
          const s = new (need(m, "Sheet"))();
          s.set("A1", 2);
          s.set("B1", "3");
          s.set("C1", "=A1+B1+4");
          eq(s.get("C1"), 9, "C1");
        },
      },
      {
        name: "Cells that were never set count as 0",
        run: (m) => {
          const s = new (need(m, "Sheet"))();
          s.set("A1", "=Z9+1");
          eq(s.get("A1"), 1, "A1");
          eq(s.get("Q7"), 0, "Q7");
        },
      },
      {
        name: "Formulas see the latest values",
        run: (m) => {
          const s = new (need(m, "Sheet"))();
          s.set("A1", 1);
          s.set("B1", "=A1+1");
          s.set("C1", "=B1+A1");
          eq(s.get("C1"), 3, "C1");
          s.set("A1", 10);
          eq(s.get("B1"), 11, "B1 after A1 changed");
          eq(s.get("C1"), 21, "C1 after A1 changed");
          s.set("B1", 0);
          eq(s.get("C1"), 10, "C1 after B1 became a number");
        },
      },
    ],
    [
      {
        name: "A cell can't read itself",
        run: (m) => {
          const s = new (need(m, "Sheet"))();
          throwsSync(() => s.set("A1", "=A1"), 'Expected set("A1", "=A1") to throw.');
        },
      },
      {
        name: "Rejects an indirect cycle and leaves the sheet unchanged",
        run: (m) => {
          const s = new (need(m, "Sheet"))();
          s.set("C1", 5);
          s.set("A1", "=B1");
          s.set("B1", "=C1");
          throwsSync(() => s.set("C1", "=A1"), 'Expected set("C1", "=A1") to throw (A1 -> B1 -> C1 -> A1).');
          eq(s.get("C1"), 5, "C1 after the rejected set");
          eq(s.get("A1"), 5, "A1 after the rejected set");
          s.set("C1", 7);
          eq(s.get("A1"), 7, "A1 after a valid set");
        },
      },
      {
        name: "A diamond is not a cycle",
        run: (m) => {
          const s = new (need(m, "Sheet"))();
          s.set("A1", 1);
          s.set("B1", "=A1");
          s.set("C1", "=A1");
          s.set("D1", "=B1+C1");
          eq(s.get("D1"), 2, "D1");
        },
      },
    ],
    [
      {
        name: "50,000-cell chain without a stack overflow",
        run: (m) => {
          const s = new (need(m, "Sheet"))();
          const N = 50000;
          for (let i = N; i >= 2; i--) s.set(`A${i}`, `=A${i - 1}+1`);
          s.set("A1", 1);
          eq(s.get(`A${N}`), N, `A${N}`);
        },
      },
      {
        name: "Repeated reads stay fast and fresh",
        run: (m) => {
          const s = new (need(m, "Sheet"))();
          const N = 20000;
          for (let i = N; i >= 2; i--) s.set(`A${i}`, `=A${i - 1}+1`);
          s.set("A1", 1);
          const t0 = Date.now();
          for (let k = 0; k < 300; k++) eq(s.get(`A${N}`), N, `A${N}`);
          s.set("A1", 10);
          eq(s.get(`A${N}`), N + 9, `A${N} after A1 changed`);
          ok(Date.now() - t0 < 2500, "300 reads took too long: cache computed values.");
        },
      },
    ],
  ],

  editor: [
    [
      {
        name: "Types text",
        run: (m) => {
          const e = new (need(m, "Editor"))();
          e.type("hello");
          e.type(" world");
          eq(e.getText(), "hello world", "text");
        },
      },
      {
        name: "Backspace removes the last character",
        run: (m) => {
          const e = new (need(m, "Editor"))();
          e.type("abc");
          e.backspace();
          eq(e.getText(), "ab", "text");
        },
      },
      {
        name: "Backspace on empty does nothing",
        run: (m) => {
          const e = new (need(m, "Editor"))();
          e.backspace();
          eq(e.getText(), "", "text");
        },
      },
    ],
    [
      {
        name: "Undo reverts edits one at a time",
        run: (m) => {
          const e = new (need(m, "Editor"))();
          e.type("a");
          e.type("b");
          e.undo();
          eq(e.getText(), "a", "after one undo");
          e.undo();
          eq(e.getText(), "", "after two undos");
          e.undo();
          eq(e.getText(), "", "undo with nothing left");
        },
      },
      {
        name: "Redo re-applies",
        run: (m) => {
          const e = new (need(m, "Editor"))();
          e.type("a");
          e.type("b");
          e.undo();
          e.redo();
          eq(e.getText(), "ab", "after redo");
          e.redo();
          eq(e.getText(), "ab", "redo with nothing to redo");
        },
      },
      {
        name: "A new edit clears redo",
        run: (m) => {
          const e = new (need(m, "Editor"))();
          e.type("a");
          e.type("b");
          e.undo();
          e.type("c");
          e.redo();
          eq(e.getText(), "ac", "text");
        },
      },
      {
        name: "Backspace can be undone; an empty backspace isn't an edit",
        run: (m) => {
          const e = new (need(m, "Editor"))();
          e.type("a");
          e.backspace();
          e.backspace();
          e.undo();
          eq(e.getText(), "a", "text");
        },
      },
    ],
    [
      {
        name: "Types at the cursor",
        run: (m) => {
          const e = new (need(m, "Editor"))();
          e.type("helo");
          e.left();
          e.type("l");
          eq(e.getText(), "hello", "text");
        },
      },
      {
        name: "Cursor stops at both ends",
        run: (m) => {
          const e = new (need(m, "Editor"))();
          e.type("ab");
          e.left(5);
          e.type("X");
          eq(e.getText(), "Xab", "after left(5)");
          e.right(9);
          e.type("!");
          eq(e.getText(), "Xab!", "after right(9)");
        },
      },
      {
        name: "Backspace deletes before the cursor",
        run: (m) => {
          const e = new (need(m, "Editor"))();
          e.type("abc");
          e.left(1);
          e.backspace();
          e.type("Z");
          eq(e.getText(), "aZc", "text");
        },
      },
      {
        name: "Undo restores the cursor too",
        run: (m) => {
          const e = new (need(m, "Editor"))();
          e.type("abc");
          e.left(2);
          e.type("X");
          eq(e.getText(), "aXbc", "after typing X");
          e.undo();
          e.type("Y");
          eq(e.getText(), "aYbc", "typing after undo goes where the cursor was");
        },
      },
      {
        name: "Backspace at the start does nothing",
        run: (m) => {
          const e = new (need(m, "Editor"))();
          e.type("ab");
          e.left(2);
          e.backspace();
          e.undo();
          eq(e.getText(), "", "undo reverts the typing, not the empty backspace");
        },
      },
    ],
  ],

  markdown: [
    [
      { name: "Empty input", run: (m) => eq(need(m, "splitMarkdown")("", 10), []) },
      {
        name: "Everything fits in one chunk",
        run: (m) => eq(need(m, "splitMarkdown")("# Title\nHello\n## Section\nWorld", 100), ["# Title\nHello\n## Section\nWorld"]),
      },
      {
        name: "Repeats parent headers; a header-first chunk repeats only its parents",
        run: (m) => eq(need(m, "splitMarkdown")("# A\nline1\nline2\n## B\nline3", 14), ["# A\nline1", "# A\nline2\n## B", "# A\n## B\nline3"]),
      },
      {
        name: "A new top-level header resets the context",
        run: (m) => eq(need(m, "splitMarkdown")("# A\n## B\nx\n# C\ny", 10), ["# A\n## B\nx", "# C\ny"]),
      },
      { name: "Keeps blank lines", run: (m) => eq(need(m, "splitMarkdown")("# A\n\ntext", 8), ["# A\n", "# A\ntext"]) },
      { name: "#tag is not a header", run: (m) => eq(need(m, "splitMarkdown")("# A\n#tag\nmore", 8), ["# A\n#tag", "# A\nmore"]) },
      {
        name: "Every chunk respects the limit",
        run: (m) => {
          const md = ["# Guide", "intro text here", "## Returns", "Items can be returned in 30 days.", "Keep the receipt.", "### Damaged", "Send a photo.", "## Shipping", "Ships in 2 days."].join("\n");
          const chunks = need(m, "splitMarkdown")(md, 55);
          ok(Array.isArray(chunks) && chunks.length > 1, "Expected several chunks.");
          for (const c of chunks) ok(c.length <= 55, `Chunk is ${c.length} characters: ${show(c)}`);
          ok(chunks.some((c) => c.startsWith("# Guide\n## Returns\n### Damaged")), "Expected a chunk under # Guide > ## Returns > ### Damaged.");
        },
      },
    ],
  ],
};

/** Runs one test with a time limit. Returns { name, passed, error, ms }. */
export async function runSierraTest(test, mod, limitMs = 4000) {
  const t0 = Date.now();
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(() => test.run(mod)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${limitMs / 1000}s (a call that never finishes, or a slow loop).`)), limitMs);
      }),
    ]);
    return { name: test.name, passed: true, ms: Date.now() - t0 };
  } catch (err) {
    return { name: test.name, passed: false, error: (err && err.message) || String(err), ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}
