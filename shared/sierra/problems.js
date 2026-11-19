// Sierra OA practice problems (Interview → Technical → Sierra OA).
//
// Modeled on what candidates report for Sierra's Software Engineer, Agent new-grad CoderPad assessment:
// two easy coding questions plus a TypeScript project that grows in parts. Each problem is one file that
// the student extends part by part; the tests for part N also re-run parts 1..N-1, so a rewrite that
// breaks an earlier part shows up right away.
//
// Text fields use a tiny markdown subset: blank-line paragraphs, "- " bullets, ``` code fences,
// `inline code` and **bold**. Code strings use String.raw so "\n" stays a literal escape in the code.
// The tests live in ./suite.js; `npm run test:unit` checks every reference solution against them.

export const SIERRA_PROBLEMS = [
  {
    id: "intervals",
    title: "Debug log intervals",
    kind: "easy",
    minutes: 12,
    reported: "The one question PracHub labels as Sierra's online assessment.",
    entry: ["mergeLogs", "overlapAndGap"],
    intro:
      "You get debug log segments as `[start, end, text]` tuples. Times are integer seconds and every interval is half-open: `[start, end)`. The input is unsorted and may overlap or leave gaps.",
    parts: [
      {
        title: "Merge overlapping segments",
        prompt: String.raw`Write **mergeLogs(logs)** that sorts the segments by time, merges the ones that overlap into one segment, and joins their texts in time order with a single space.

- Two segments overlap only if the next one starts **before** the current one ends. Touching segments like ` + "`[1, 4)`" + String.raw` and ` + "`[4, 6)`" + String.raw` do **not** merge.
- When two segments start at the same time, put the one that ends first first. If both start and end match, keep input order.
- Don't change the input array.

` + "```" + String.raw`
mergeLogs([[0, 5, "A"], [3, 10, "B"], [12, 15, "C"]])
// [[0, 10, "A B"], [12, 15, "C"]]

mergeLogs([[1, 4, "X"], [4, 6, "Y"], [5, 8, "Z"]])
// [[1, 4, "X"], [4, 8, "Y Z"]]
` + "```",
        hint: "Sort a copy by start (then end, then original index). Walk once, keeping the last merged segment. Merge only when `start < last.end`.",
      },
      {
        title: "Detect any overlap or gap",
        prompt: String.raw`Write **overlapAndGap(logs)** that looks at the original, unmerged input and returns two booleans: ` + "`[anyOverlap, anyGap]`" + String.raw`.

- **Overlap:** some pair of segments shares time.
- **Gap:** between the earliest start and the latest end, some second isn't covered by any segment.
- Touching segments are neither an overlap nor a gap. Empty input returns ` + "`[false, false]`" + String.raw`.
- Say the time and space complexity in a comment.

` + "```" + String.raw`
overlapAndGap([[0, 5, "A"], [3, 10, "B"], [12, 15, "C"]]) // [true, true]
overlapAndGap([[0, 2, "A"], [2, 5, "B"]])                 // [false, false]
` + "```",
        hint: "Sort by start and track the furthest end seen so far. A start before it is an overlap; a start after it is a gap.",
      },
    ],
    starter: String.raw`type Log = [number, number, string];

function mergeLogs(logs: Log[]): Log[] {
  // Part 1
  throw new Error("Not implemented");
}

function overlapAndGap(logs: Log[]): [boolean, boolean] {
  // Part 2
  throw new Error("Not implemented");
}
`,
    reference: String.raw`type Log = [number, number, string];

// O(n log n) time for the sort, O(n) space for the copy.
function mergeLogs(logs: Log[]): Log[] {
  const sorted = logs
    .map((log, i) => ({ log, i }))
    .sort((a, b) => a.log[0] - b.log[0] || a.log[1] - b.log[1] || a.i - b.i);
  const out: Log[] = [];
  for (const { log: [start, end, text] } of sorted) {
    const last = out[out.length - 1];
    if (last && start < last[1]) {
      // touching (start === last end) is not an overlap
      last[1] = Math.max(last[1], end);
      last[2] += " " + text;
    } else {
      out.push([start, end, text]);
    }
  }
  return out;
}

// O(n log n) time, O(n) space.
function overlapAndGap(logs: Log[]): [boolean, boolean] {
  if (logs.length === 0) return [false, false];
  const sorted = [...logs].sort((a, b) => a[0] - b[0]);
  let maxEnd = sorted[0][1];
  let overlap = false;
  let gap = false;
  for (let i = 1; i < sorted.length; i++) {
    const [start, end] = sorted[i];
    if (start < maxEnd) overlap = true;
    else if (start > maxEnd) gap = true;
    maxEnd = Math.max(maxEnd, end);
  }
  return [overlap, gap];
}
`,
  },

  {
    id: "related",
    title: "Related catalog items",
    kind: "easy",
    minutes: 12,
    reported: "aced.io (entry-level Sierra round): find all items related to A, then the items related to those.",
    entry: ["related"],
    intro:
      "An outdoor-gear store keeps a catalog as an adjacency list: `catalog[item]` lists the items shown as \"related\" on that item's page. Some items have no entry at all, and relations can loop back.",
    parts: [
      {
        title: "Everything related to an item",
        prompt: String.raw`Write **related(catalog, item)** that returns every item reachable from ` + "`item`" + String.raw` through related links.

- Closest items first (breadth-first). Items the same distance away keep the order they're listed in.
- Don't include ` + "`item`" + String.raw` itself, and never list an item twice, even when links loop.
- An item with no catalog entry has no related items. An unknown starting item returns ` + "`[]`" + String.raw`.

` + "```" + String.raw`
const catalog = {
  tent: ["stakes", "rainfly"],
  stakes: ["mallet"],
  rainfly: ["tent", "seam-sealer"],
};
related(catalog, "tent") // ["stakes", "rainfly", "mallet", "seam-sealer"]
` + "```",
        hint: "Breadth-first search with a queue and a visited set that starts with the item itself. Use `catalog[x] ?? []` for missing entries.",
      },
      {
        title: "Limit the distance",
        prompt: String.raw`The product page only has room for nearby items. Add an optional third parameter: **related(catalog, item, maxDepth)**.

- ` + "`maxDepth = 1`" + String.raw` returns only direct relations, ` + "`2`" + String.raw` adds their relations, and so on.
- ` + "`maxDepth = 0`" + String.raw` returns ` + "`[]`" + String.raw`. Leaving it out means no limit, so part 1 keeps working.

` + "```" + String.raw`
related(catalog, "tent", 1) // ["stakes", "rainfly"]
` + "```",
        hint: "Process the queue one level at a time (a `frontier` array), and stop after `maxDepth` levels.",
      },
    ],
    starter: String.raw`type Catalog = Record<string, string[]>;

function related(catalog: Catalog, item: string, maxDepth = Infinity): string[] {
  throw new Error("Not implemented");
}
`,
    reference: String.raw`type Catalog = Record<string, string[]>;

// O(V + E) time and space.
function related(catalog: Catalog, item: string, maxDepth = Infinity): string[] {
  const seen = new Set<string>([item]);
  const out: string[] = [];
  let frontier = [item];
  let depth = 0;
  while (frontier.length > 0 && depth < maxDepth) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const neighbor of catalog[current] ?? []) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        out.push(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
    depth++;
  }
  return out;
}
`,
  },

  {
    id: "history",
    title: "Conversation history loader",
    kind: "project",
    minutes: 45,
    reported:
      "The most reported Sierra SWE problem of 2026 (PracHub ×3, aced.io): fetch paginated conversation history, then compact it to a token budget.",
    entry: ["loadHistory", "compactHistory"],
    intro: String.raw`You're building the memory layer of a customer-support agent. Before each model call, the agent loads the customer's conversation from a history service and trims it to fit the model's context window.

The service is given to you as ` + "`api`" + String.raw`:

` + "```" + String.raw`
type Message = { id: string; role: "system" | "user" | "assistant"; text: string; tokens?: number };
type Page = { items: Message[]; nextCursor: string | null };

api.fetchPage(cursor: string | null): Promise<Page>
` + "```" + String.raw`

Call ` + "`api.fetchPage(null)`" + String.raw` for the first page, then pass each ` + "`nextCursor`" + String.raw` back until it's ` + "`null`" + String.raw`.`,
    parts: [
      {
        title: "Fetch every page",
        prompt: String.raw`Write **loadHistory(api)** that returns every message, in order, across all pages.

- A page can be empty and still have a ` + "`nextCursor`" + String.raw`: keep going.
- Stop when ` + "`nextCursor`" + String.raw` is ` + "`null`" + String.raw`.
- If the service hands back a cursor you've already used, throw an error instead of looping forever.`,
        hint: "A do/while loop on the cursor, plus a Set of cursors you've already seen.",
      },
      {
        title: "Survive a flaky service",
        prompt: String.raw`In production the history service sometimes fails with a 503 and sometimes never answers. Add options: **loadHistory(api, { attempts, baseMs, timeoutMs })**.

- Try each page up to ` + "`attempts`" + String.raw` times in total. If the last try fails, throw.
- Give up on a single try after ` + "`timeoutMs`" + String.raw` and retry it. The timeout is per try, not for the whole load.
- Wait between tries with exponential backoff and random jitter: up to ` + "`baseMs * 2^try`" + String.raw` milliseconds.
- Defaults when an option is missing: ` + "`attempts = 3`" + String.raw`, ` + "`baseMs = 50`" + String.raw`, ` + "`timeoutMs = 1000`" + String.raw`.
- Make a fresh ` + "`fetchPage`" + String.raw` call on every try.`,
        hint: "Write a generic `retry(fn, opts)` helper and a `withTimeout(promise, ms)` built on `Promise.race`. Then wrap each fetchPage call: `retry(() => api.fetchPage(cursor), opts)`.",
      },
      {
        title: "Compact to a token budget",
        prompt: String.raw`Write **compactHistory(messages, maxTokens)** that trims a conversation so it fits the model.

- **Always keep every system message**, even if they alone go over the budget.
- Spend the rest of the budget on the **newest** non-system messages. Kept messages must be one unbroken run ending at the newest message: stop at the first message that doesn't fit.
- A message without ` + "`tokens`" + String.raw` costs ` + "`Math.ceil(text.length / 4)`" + String.raw`.
- A total exactly equal to ` + "`maxTokens`" + String.raw` fits.
- Return the kept messages in their original order, and don't change the input.

` + "```" + String.raw`
// budget 10: system (2) is kept, then newest first: m4 (3), m3 (4) fit; m2 (5) doesn't.
compactHistory([sys(2), m1(1), m2(5), m3(4), m4(3)], 10) // [sys, m3, m4]
` + "```",
        hint: "Subtract the system messages' cost, walk the others from newest to oldest, and break at the first one that doesn't fit. Filter the original array by the ids you kept.",
      },
    ],
    starter: String.raw`type Role = "system" | "user" | "assistant";
type Message = { id: string; role: Role; text: string; tokens?: number };
type Page = { items: Message[]; nextCursor: string | null };
type HistoryApi = { fetchPage(cursor: string | null): Promise<Page> };
type Options = { attempts?: number; baseMs?: number; timeoutMs?: number };

async function loadHistory(api: HistoryApi, opts: Options = {}): Promise<Message[]> {
  // Parts 1 and 2
  throw new Error("Not implemented");
}

function compactHistory(messages: Message[], maxTokens: number): Message[] {
  // Part 3
  throw new Error("Not implemented");
}
`,
    reference: String.raw`type Role = "system" | "user" | "assistant";
type Message = { id: string; role: Role; text: string; tokens?: number };
type Page = { items: Message[]; nextCursor: string | null };
type HistoryApi = { fetchPage(cursor: string | null): Promise<Page> };
type Options = { attempts?: number; baseMs?: number; timeoutMs?: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timed out after " + ms + "ms")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function retry<T>(fn: () => Promise<T>, opts: Options): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 50;
  const timeoutMs = opts.timeoutMs ?? 1000;
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await withTimeout(fn(), timeoutMs); // a fresh call on every try
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await sleep(Math.random() * baseMs * 2 ** i); // full jitter
    }
  }
  throw lastError;
}

async function loadHistory(api: HistoryApi, opts: Options = {}): Promise<Message[]> {
  const messages: Message[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  do {
    const current: string | null = cursor;
    const page = await retry(() => api.fetchPage(current), opts);
    messages.push(...page.items);
    cursor = page.nextCursor;
    if (cursor !== null) {
      if (seen.has(cursor)) throw new Error("cursor " + cursor + " repeated: stopping instead of looping");
      seen.add(cursor);
    }
  } while (cursor !== null);
  return messages;
}

const cost = (m: Message) => m.tokens ?? Math.ceil(m.text.length / 4);

function compactHistory(messages: Message[], maxTokens: number): Message[] {
  const keep = new Set<string>();
  let budget = maxTokens;
  for (const m of messages) {
    if (m.role === "system") {
      keep.add(m.id);
      budget -= cost(m);
    }
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "system") continue;
    if (cost(m) > budget) break; // break keeps the history one unbroken run
    keep.add(m.id);
    budget -= cost(m);
  }
  return messages.filter((m) => keep.has(m.id));
}
`,
  },

  {
    id: "inventory",
    title: "Inventory sync",
    kind: "project",
    minutes: 45,
    reported: "InterviewDB lists \"Inventory Sync\" as a Sierra coding question (phone and onsite). This is Tepobaby's practice version.",
    entry: ["syncInventory"],
    intro: String.raw`An outdoor retailer's support agent answers "is this in stock?", so the store's stock numbers must match the warehouse. You're writing the sync job. Two services are given to you:

` + "```" + String.raw`
type Item = { sku: string; qty: number };

warehouse.listStock(cursor: string | null): Promise<{ items: Item[]; nextCursor: string | null }>
store.getStock(): Promise<Record<string, number>>   // sku -> qty
store.setStock(sku: string, qty: number): Promise<void>
` + "```" + String.raw`

Each SKU appears once in the warehouse listing. **syncInventory** returns ` + "`{ updated, failed }`" + String.raw`: the SKUs you wrote and the SKUs you couldn't, both in warehouse order.`,
    parts: [
      {
        title: "Copy the warehouse into the store",
        prompt: String.raw`Write **syncInventory(warehouse, store)** that reads every page of warehouse stock and sets each SKU's quantity in the store.

- Return ` + "`{ updated: [...every sku you set], failed: [] }`" + String.raw`.
- SKUs that are only in the store stay as they are.`,
        hint: "Same cursor loop as any paginated API, then `await store.setStock(sku, qty)` for each item.",
      },
      {
        title: "Only write what changed, and retry",
        prompt: String.raw`Writes are slow and the services are flaky. Add options: **syncInventory(warehouse, store, { attempts, baseMs })**.

- Read the store's current stock once and only call ` + "`setStock`" + String.raw` for SKUs whose quantity is different (or missing). ` + "`updated`" + String.raw` lists only those.
- Retry a failed ` + "`setStock`" + String.raw` or ` + "`listStock`" + String.raw` call up to ` + "`attempts`" + String.raw` tries in total, with exponential backoff and jitter based on ` + "`baseMs`" + String.raw`.
- Defaults: ` + "`attempts = 3`" + String.raw`, ` + "`baseMs = 50`" + String.raw`.`,
        hint: "Diff `item.qty !== current[item.sku]` before writing. Reuse one `retry(fn, opts)` helper for both services.",
      },
      {
        title: "Keep going and report failures",
        prompt: String.raw`One bad SKU shouldn't stop the whole sync.

- If a SKU still fails after every try, don't throw: add it to ` + "`failed`" + String.raw` and carry on with the rest.
- Running the sync again must be safe: it only writes what's still different, so a re-run after an outage retries just the leftovers.`,
        hint: "Wrap each SKU's retried write in try/catch and push to `failed` in the catch. The diff from part 2 already makes re-runs safe.",
      },
    ],
    starter: String.raw`type Item = { sku: string; qty: number };
type StockPage = { items: Item[]; nextCursor: string | null };
type Warehouse = { listStock(cursor: string | null): Promise<StockPage> };
type Store = {
  getStock(): Promise<Record<string, number>>;
  setStock(sku: string, qty: number): Promise<void>;
};
type Options = { attempts?: number; baseMs?: number };
type SyncResult = { updated: string[]; failed: string[] };

async function syncInventory(warehouse: Warehouse, store: Store, opts: Options = {}): Promise<SyncResult> {
  throw new Error("Not implemented");
}
`,
    reference: String.raw`type Item = { sku: string; qty: number };
type StockPage = { items: Item[]; nextCursor: string | null };
type Warehouse = { listStock(cursor: string | null): Promise<StockPage> };
type Store = {
  getStock(): Promise<Record<string, number>>;
  setStock(sku: string, qty: number): Promise<void>;
};
type Options = { attempts?: number; baseMs?: number };
type SyncResult = { updated: string[]; failed: string[] };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function retry<T>(fn: () => Promise<T>, opts: Options): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 50;
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await sleep(Math.random() * baseMs * 2 ** i);
    }
  }
  throw lastError;
}

async function listAll(warehouse: Warehouse, opts: Options): Promise<Item[]> {
  const items: Item[] = [];
  let cursor: string | null = null;
  do {
    const current: string | null = cursor;
    const page = await retry(() => warehouse.listStock(current), opts);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== null);
  return items;
}

async function syncInventory(warehouse: Warehouse, store: Store, opts: Options = {}): Promise<SyncResult> {
  const items = await listAll(warehouse, opts);
  const current = await retry(() => store.getStock(), opts);
  const updated: string[] = [];
  const failed: string[] = [];
  for (const { sku, qty } of items) {
    if (current[sku] === qty) continue; // unchanged: no write, so re-runs are safe
    try {
      await retry(() => store.setStock(sku, qty), opts);
      updated.push(sku);
    } catch {
      failed.push(sku);
    }
  }
  return { updated, failed };
}
`,
  },

  {
    id: "spreadsheet",
    title: "Spreadsheet cells",
    kind: "project",
    minutes: 45,
    reported: "aced.io and VibeEngines: detect circular references between spreadsheet cells, then make it fast.",
    entry: ["Sheet"],
    intro: String.raw`Build the engine behind a tiny spreadsheet. A cell holds a number or a formula that adds cells and whole numbers, like ` + "`\"=A1+B2+3\"`" + String.raw`. Cell names are capital letters followed by digits. A cell that was never set counts as ` + "`0`" + String.raw`.`,
    parts: [
      {
        title: "Set and get",
        prompt: String.raw`Write a class **Sheet** with:

- **set(cell, raw)**: ` + "`raw`" + String.raw` is a number, a numeric string like ` + "`\"7\"`" + String.raw`, or a formula string starting with ` + "`=`" + String.raw`.
- **get(cell)**: the cell's current value. Formulas always reflect the latest values of the cells they read.

` + "```" + String.raw`
const s = new Sheet();
s.set("A1", 2); s.set("B1", "3"); s.set("C1", "=A1+B1+4");
s.get("C1") // 9
s.set("A1", 10);
s.get("C1") // 17
` + "```",
        hint: "Parse a formula into the cells it reads plus a constant. `get` adds the constant to the values of those cells.",
      },
      {
        title: "Reject circular references",
        prompt: String.raw`A formula that ends up reading itself would loop forever.

- **set** must throw an Error when the new formula would create a cycle (including ` + "`\"=A1\"`" + String.raw` on A1).
- When it throws, the sheet is **unchanged**: the cell keeps its old value and formula.
- Shapes that only look like loops are fine: A1 feeding both B1 and C1, which both feed D1, is not a cycle.`,
        hint: "Before changing anything: from each cell the new formula reads, walk the cells they read. If you reach the cell being set, it's a cycle.",
      },
      {
        title: "Make it scale",
        prompt: String.raw`Real sheets have long chains: A50000 reads A49999, which reads A49998, all the way to A1.

- ` + "`get`" + String.raw` must handle a 50,000-cell chain without a stack overflow. Recursion that deep crashes, so use an explicit stack.
- Reading the same cell many times should stay fast: cache values, and clear only the cells downstream of a change when something is set.
- Values must never be stale after a ` + "`set`" + String.raw`.`,
        hint: "Keep a reverse index (cell -> cells that read it). On set, walk it to clear cached values downstream. In get, evaluate with an explicit stack in post-order.",
      },
    ],
    starter: String.raw`class Sheet {
  set(cell: string, raw: number | string): void {
    throw new Error("Not implemented");
  }

  get(cell: string): number {
    throw new Error("Not implemented");
  }
}
`,
    reference: String.raw`type Parsed = { inputs: string[]; constant: number };

function parse(raw: number | string): Parsed {
  if (typeof raw === "number") return { inputs: [], constant: raw };
  if (!raw.startsWith("=")) return { inputs: [], constant: Number(raw) };
  const inputs: string[] = [];
  let constant = 0;
  for (const part of raw.slice(1).split("+")) {
    const token = part.trim();
    if (/^[A-Z]+[0-9]+$/.test(token)) inputs.push(token);
    else constant += Number(token);
  }
  return { inputs, constant };
}

class Sheet {
  private formulas = new Map<string, Parsed>();
  private readers = new Map<string, Set<string>>(); // cell -> cells whose formulas read it
  private cache = new Map<string, number>();

  set(cell: string, raw: number | string): void {
    const next = parse(raw);
    if (this.createsCycle(cell, next.inputs)) throw new Error("Circular reference at " + cell);
    for (const input of this.formulas.get(cell)?.inputs ?? []) this.readers.get(input)?.delete(cell);
    this.formulas.set(cell, next);
    for (const input of next.inputs) {
      if (!this.readers.has(input)) this.readers.set(input, new Set());
      this.readers.get(input)!.add(cell);
    }
    this.invalidate(cell);
  }

  get(cell: string): number {
    // Post-order evaluation with an explicit stack: no recursion, so long chains can't overflow.
    const stack: [string, boolean][] = [[cell, false]];
    while (stack.length > 0) {
      const [current, ready] = stack.pop()!;
      if (this.cache.has(current)) continue;
      const formula = this.formulas.get(current);
      if (!formula) {
        this.cache.set(current, 0);
        continue;
      }
      if (ready) {
        let sum = formula.constant;
        for (const input of formula.inputs) sum += this.cache.get(input)!;
        this.cache.set(current, sum);
      } else {
        stack.push([current, true]);
        for (const input of formula.inputs) if (!this.cache.has(input)) stack.push([input, false]);
      }
    }
    return this.cache.get(cell)!;
  }

  private createsCycle(cell: string, inputs: string[]): boolean {
    const stack = [...inputs];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === cell) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      stack.push(...(this.formulas.get(current)?.inputs ?? []));
    }
    return false;
  }

  private invalidate(cell: string): void {
    // A cell that isn't cached can't have cached readers (computing a reader caches its inputs first),
    // so the walk stops there. That keeps building a long chain O(n) instead of O(n^2).
    const stack = [cell];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current) || !this.cache.has(current)) continue;
      seen.add(current);
      this.cache.delete(current);
      for (const reader of this.readers.get(current) ?? []) stack.push(reader);
    }
  }
}
`,
  },

  {
    id: "editor",
    title: "Undo/redo text editor",
    kind: "project",
    minutes: 30,
    reported: "Reported Sierra question: a keyboard object with undo/redo whose requirements grow mid-problem.",
    entry: ["Editor"],
    intro: "Build the text box behind a chat composer. Requirements arrive one part at a time, like they do in the interview.",
    parts: [
      {
        title: "Type and backspace",
        prompt: String.raw`Write a class **Editor** with:

- **type(text)**: adds ` + "`text`" + String.raw` at the end.
- **backspace()**: removes the last character. Does nothing on an empty editor.
- **getText()**: the current text.`,
        hint: "A string field is enough for now, but think ahead: part 3 adds a cursor.",
      },
      {
        title: "Undo and redo",
        prompt: String.raw`Add **undo()** and **redo()**.

- ` + "`undo`" + String.raw` reverts the most recent edit (a ` + "`type`" + String.raw` or a ` + "`backspace`" + String.raw`). ` + "`redo`" + String.raw` re-applies the most recently undone edit.
- Any new edit clears everything you could redo.
- A backspace that deletes nothing isn't an edit. Undo and redo with nothing to do are no-ops.`,
        hint: "Two stacks of snapshots. An edit pushes the old state onto undo and clears redo; undo moves the current state to redo.",
      },
      {
        title: "Add a cursor",
        prompt: String.raw`Now the text box has a cursor (it starts at the end).

- **left(n = 1)** and **right(n = 1)** move it, stopping at either end.
- ` + "`type`" + String.raw` inserts at the cursor and moves the cursor past the new text. ` + "`backspace`" + String.raw` deletes the character before the cursor.
- Cursor moves aren't edits. ` + "`undo`" + String.raw` restores both the text **and the cursor** to how they were right before that edit; ` + "`redo`" + String.raw` restores both to right after it.`,
        hint: "Make a snapshot `{ text, cursor }` and store snapshots on both stacks.",
      },
    ],
    starter: String.raw`class Editor {
  type(text: string): void {
    throw new Error("Not implemented");
  }

  backspace(): void {
    throw new Error("Not implemented");
  }

  getText(): string {
    throw new Error("Not implemented");
  }
}
`,
    reference: String.raw`type Snapshot = { text: string; cursor: number };

class Editor {
  private state: Snapshot = { text: "", cursor: 0 };
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];

  private edit(next: Snapshot): void {
    this.undoStack.push(this.state);
    this.redoStack = [];
    this.state = next;
  }

  type(text: string): void {
    const { text: t, cursor } = this.state;
    this.edit({ text: t.slice(0, cursor) + text + t.slice(cursor), cursor: cursor + text.length });
  }

  backspace(): void {
    const { text, cursor } = this.state;
    if (cursor === 0) return; // deletes nothing: not an edit
    this.edit({ text: text.slice(0, cursor - 1) + text.slice(cursor), cursor: cursor - 1 });
  }

  getText(): string {
    return this.state.text;
  }

  undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(this.state);
    this.state = previous;
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.state);
    this.state = next;
  }

  left(n = 1): void {
    this.state = { ...this.state, cursor: Math.max(0, this.state.cursor - n) };
  }

  right(n = 1): void {
    this.state = { ...this.state, cursor: Math.min(this.state.text.length, this.state.cursor + n) };
  }
}
`,
  },

  {
    id: "markdown",
    title: "Header-aware Markdown chunks",
    kind: "project",
    minutes: 40,
    reported: "PracHub and 1point3acres (Sierra technical screen, 2026): split Markdown into chunks under a size limit.",
    entry: ["splitMarkdown"],
    intro:
      "The agent's knowledge base is written in Markdown, and each chunk sent to the model has a size limit. A chunk that starts in the middle of a section loses its context, so it has to repeat the headers it sits under.",
    parts: [
      {
        title: "Split with header context",
        prompt: String.raw`Write **splitMarkdown(markdown, maxSize)** that returns the document as ordered chunks, each at most ` + "`maxSize`" + String.raw` characters.

- Split the input on ` + "`\"\\n\"`" + String.raw` and keep blank lines. Empty input returns ` + "`[]`" + String.raw`.
- A header is a line that starts with 1 to 6 ` + "`#`" + String.raw` followed by a space (` + "`#tag`" + String.raw` is not a header). A level-L header replaces the active headers at level L and deeper.
- Build chunks greedily: start at the next unused line, put its active parent headers first, then add following lines while the chunk still fits.
- If a chunk's first line is itself a header, repeat only that header's parents, not the header twice.
- Size is the final string length, counting the repeated headers and every ` + "`\"\\n\"`" + String.raw` between lines. Join lines with ` + "`\"\\n\"`" + String.raw`, no trailing newline.
- You can assume any single line plus its headers fits.

` + "```" + String.raw`
splitMarkdown("# A\nline1\nline2\n## B\nline3", 14)
// ["# A\nline1", "# A\nline2\n## B", "# A\n## B\nline3"]
` + "```",
        hint: "First pass: record each line's parent headers. Second pass: greedy packing, tracking the joined length.",
      },
    ],
    starter: String.raw`function splitMarkdown(markdown: string, maxSize: number): string[] {
  throw new Error("Not implemented");
}
`,
    reference: String.raw`function splitMarkdown(markdown: string, maxSize: number): string[] {
  if (markdown === "") return [];
  const lines = markdown.split("\n");
  const context: string[][] = []; // headers to repeat if a chunk starts at line i
  const active: string[] = []; // active[level - 1] = header line
  for (const line of lines) {
    const match = /^(#{1,6}) /.exec(line);
    if (match) {
      const level = match[1].length;
      context.push(active.slice(0, level - 1).filter(Boolean)); // only its parents
      active.length = level - 1; // clear this level and deeper
      active[level - 1] = line;
    } else {
      context.push(active.filter(Boolean));
    }
  }
  const chunks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const parts = [...context[i], lines[i]];
    let size = parts.join("\n").length;
    i++;
    while (i < lines.length && size + 1 + lines[i].length <= maxSize) {
      size += 1 + lines[i].length;
      parts.push(lines[i]);
      i++;
    }
    chunks.push(parts.join("\n"));
  }
  return chunks;
}
`,
  },
  // ---------- 1point3acres version: stdin easy questions ----------
  // From 1point3acres post #1192604 (new grad, 2026-10-10): two very easy questions, one was "find the max",
  // with input on standard input ("5\n3 -2 9 4 1\n"). Only maximum element is the reported question;
  // the other three are the same style, so the stdin parsing becomes automatic.
  {
    id: "stdin-max",
    title: "Maximum element",
    kind: "stdin",
    minutes: 5,
    reported: "The reported one: \"one was finding the max\" (1point3acres #1192604). Same input format and test cases.",
    entry: [],
    intro:
      "A whole program, like the real question: read standard input, print the answer. The first line is `n`, the second line has `n` integers.",
    parts: [
      {
        title: "Print the largest number",
        prompt: String.raw`Read ` + "`n`" + String.raw` and then ` + "`n`" + String.raw` integers from standard input, and print the largest one.

- Values can be negative (as low as ` + "`-1000000000`" + String.raw`), so don't start the maximum at 0.
- ` + "`n`" + String.raw` is at least 1 and can be up to 100,000.

` + "```" + String.raw`
input             output
5                 9
3 -2 9 4 1

4                 -3
-8 -3 -12 -5
` + "```",
        hint: "Start the maximum at the first number, not 0: every number can be negative. A plain loop is safest; `Math.max(...nums)` works too but spreading a huge array can overflow the stack.",
      },
    ],
    starter: String.raw`// Read all of standard input, then print the answer with console.log.
const data: number[] = require("fs").readFileSync(0, "utf8").trim().split(/\s+/).map(Number);
const n = data[0];
const nums = data.slice(1, n + 1);

// TODO: print the largest number in nums
`,
    reference: String.raw`const data: number[] = require("fs").readFileSync(0, "utf8").trim().split(/\s+/).map(Number);
const n = data[0];
const nums = data.slice(1, n + 1);

// O(n) time, O(1) extra space (O(n) to hold the input).
let best = nums[0];
for (const x of nums) if (x > best) best = x;
console.log(best);
`,
  },
  {
    id: "stdin-second",
    title: "Second largest",
    kind: "stdin",
    minutes: 6,
    reported: "Same style as the reported max question, one step harder: duplicates and a \"no answer\" case.",
    entry: [],
    intro: "Read `n`, then `n` integers. Print the second-largest **distinct** value.",
    parts: [
      {
        title: "Second-largest distinct value",
        prompt: String.raw`Print the second-largest **distinct** value. If every number is the same (or ` + "`n`" + String.raw` is 1), print ` + "`NONE`" + String.raw`.

` + "```" + String.raw`
input             output
5                 4
3 -2 9 4 9

3                 NONE
6 6 6
` + "```",
        hint: "Track two values, `first` and `second`, starting at `-Infinity`. Skip numbers equal to `first`. At the end, `second === -Infinity` means NONE.",
      },
    ],
    starter: String.raw`const data: number[] = require("fs").readFileSync(0, "utf8").trim().split(/\s+/).map(Number);
const n = data[0];
const nums = data.slice(1, n + 1);

// TODO: print the second-largest distinct value, or NONE
`,
    reference: String.raw`const data: number[] = require("fs").readFileSync(0, "utf8").trim().split(/\s+/).map(Number);
const n = data[0];
const nums = data.slice(1, n + 1);

let first = -Infinity;
let second = -Infinity;
for (const x of nums) {
  if (x > first) {
    second = first;
    first = x;
  } else if (x < first && x > second) {
    second = x;
  }
}
console.log(second === -Infinity ? "NONE" : second);
`,
  },
  {
    id: "stdin-reverse",
    title: "Reverse the words",
    kind: "stdin",
    minutes: 5,
    reported: "Same style: a one-line string input, where extra spaces are the trap.",
    entry: [],
    intro: "Standard input is one line of text. Print its words in reverse order.",
    parts: [
      {
        title: "Words in reverse order",
        prompt: String.raw`Print the words of the line in reverse order, separated by single spaces. Words are separated by one or more spaces, and the line may start or end with spaces. A line with no words prints an empty line.

` + "```" + String.raw`
input                       output
the sky is blue             blue is sky the
"  hello   world  "         world hello
` + "```",
        hint: "`line.trim().split(/\\s+/)` gives the words, but on an empty line it gives `[\"\"]`. Filter out empty strings, then `reverse().join(\" \")`.",
      },
    ],
    starter: String.raw`const line: string = require("fs").readFileSync(0, "utf8").split("\n")[0];

// TODO: print the words of line in reverse order
`,
    reference: String.raw`const line: string = require("fs").readFileSync(0, "utf8").split("\n")[0];

const words = line.split(/\s+/).filter(Boolean);
console.log(words.reverse().join(" "));
`,
  },
  {
    id: "stdin-prefix",
    title: "Running totals",
    kind: "stdin",
    minutes: 5,
    reported: "Same style, but the output is a whole line, so the formatting has to be exact.",
    entry: [],
    intro: "Read `n`, then `n` integers. Print the running totals on one line.",
    parts: [
      {
        title: "Prefix sums on one line",
        prompt: String.raw`Print the running totals (prefix sums), separated by single spaces, on one line.

` + "```" + String.raw`
input             output
4                 1 3 6 10
1 2 3 4

3                 -5 0 1000000000
-5 5 1000000000
` + "```",
        hint: "Keep a running `sum`, push it after each number, then print `totals.join(\" \")` once. Printing inside the loop puts each total on its own line.",
      },
    ],
    starter: String.raw`const data: number[] = require("fs").readFileSync(0, "utf8").trim().split(/\s+/).map(Number);
const n = data[0];
const nums = data.slice(1, n + 1);

// TODO: print the running totals on one line
`,
    reference: String.raw`const data: number[] = require("fs").readFileSync(0, "utf8").trim().split(/\s+/).map(Number);
const n = data[0];
const nums = data.slice(1, n + 1);

const totals: number[] = [];
let sum = 0;
for (const x of nums) {
  sum += x;
  totals.push(sum);
}
console.log(totals.join(" "));
`,
  },
];

export const sierraProblemById = new Map(SIERRA_PROBLEMS.map((p) => [p.id, p]));
