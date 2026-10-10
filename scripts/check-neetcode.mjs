// Verifies every reference solution against the example outputs on LeetCode's problem pages (and our
// own write-ups for subscriber-only problems), then checks the extra hidden tests all run.
// Run: npm run check:neetcode

import { accepts, parseCase, runCase } from "../shared/ncJudge.js";
import { getRaw, statementFor } from "../server/neetcode/leetcode.js";
import { PROBLEMS } from "../server/neetcode/problems.js";
import { referenceEntry } from "../server/neetcode/reference.js";
import { EXTRA } from "../server/neetcode/extra.js";

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

export function exampleOutputs(html) {
  return [...decode(html).matchAll(/Output:?\s*(.+)/g)].map((m) => {
    try {
      return { ok: true, value: JSON.parse(m[1].trim()) };
    } catch {
      return { ok: false, text: m[1].trim() };
    }
  });
}

let bad = 0;
let checked = 0;
for (const p of PROBLEMS) {
  const raw = await getRaw(p.slug);
  const outs = exampleOutputs(statementFor(p.slug, raw));
  const entry = referenceEntry(p.slug, raw.meta);
  raw.examples.forEach((ex, i) => {
    const args = parseCase(ex);
    let got;
    try {
      got = runCase(p.slug, raw.meta, entry, args);
    } catch (err) {
      bad++;
      return console.log(`✗ ${p.n}. ${p.slug} example ${i + 1}: threw ${err.message}`);
    }
    const want = outs[i];
    if (!want) return console.log(`? ${p.n}. ${p.slug} example ${i + 1}: no output on the page; got ${JSON.stringify(got)}`);
    if (!want.ok) return console.log(`? ${p.n}. ${p.slug} example ${i + 1}: couldn't read "${want.text}"; got ${JSON.stringify(got)}`);
    checked++;
    if (!accepts(p.judge, want.value, got, args)) {
      bad++;
      console.log(`✗ ${p.n}. ${p.slug} example ${i + 1}: want ${JSON.stringify(want.value)} got ${JSON.stringify(got)}`);
    }
  });
  for (const ex of EXTRA[p.slug] || []) {
    try {
      runCase(p.slug, raw.meta, entry, parseCase(ex));
    } catch (err) {
      bad++;
      console.log(`✗ ${p.n}. ${p.slug} extra ${JSON.stringify(ex).slice(0, 60)}: ${err.message}`);
    }
  }
  if (!EXTRA[p.slug]?.length) console.log(`! ${p.n}. ${p.slug}: no extra tests`);
}
console.log(`\n${checked} example outputs checked, ${bad} problem(s).`);
process.exit(bad ? 1 : 0);
