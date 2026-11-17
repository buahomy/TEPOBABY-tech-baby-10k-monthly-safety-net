// Turns a student's TypeScript into callable functions/classes (browser worker and Node tests).
// Sucrase strips the types; the code then runs in a function scope and hands back the problem's
// entry names (top-level functions or classes the student defined).

import { transform } from "sucrase";

export function loadSierraModule(tsCode, entry, consoleShim = console) {
  const js = transform(tsCode, { transforms: ["typescript"], disableESTransforms: true }).code;
  const grab = entry.map((n) => `${JSON.stringify(n)}: typeof ${n} !== "undefined" ? ${n} : undefined`).join(", ");
  const factory = new Function("console", `"use strict";\n${js}\n;return { ${grab} };`);
  return factory(consoleShim);
}
