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

// ---------- stdin programs (the 1point3acres-style easy questions) ----------
//
// The program is a whole script that reads standard input and prints the answer, like CoderPad's
// stdin questions. It runs with small Node shims: require("fs").readFileSync(0 | "/dev/stdin"),
// process.stdin data/end events, require("readline") line events and `for await`, process.stdout.write
// and console.log (both go to stdout; console.error goes to the debug log).

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function emitter() {
  const handlers = {};
  return {
    on(name, fn) {
      (handlers[name] ||= []).push(fn);
      return this;
    },
    once(name, fn) {
      return this.on(name, fn);
    },
    emit(name, ...args) {
      for (const fn of handlers[name] || []) fn(...args);
    },
  };
}

/** Compiles a stdin program once; throws on a syntax error (shown as a compile error). */
export function compileStdinProgram(tsCode) {
  const js = transform(tsCode, { transforms: ["typescript"], disableESTransforms: true }).code;
  return new Function("console", "require", "process", "module", "exports", `"use strict";\n${js}`);
}

/** Runs a compiled stdin program on `input`; resolves to what it printed. */
export async function runStdinProgram(program, input, debug = () => {}) {
  let out = "";
  const write = (s) => {
    out += String(s);
    return true;
  };
  const fmt = (a) => a.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" ");
  const consoleShim = { log: (...a) => write(fmt(a) + "\n"), info: (...a) => write(fmt(a) + "\n"), error: (...a) => debug(fmt(a)), warn: (...a) => debug(fmt(a)) };

  const stdin = Object.assign(emitter(), { setEncoding() {}, resume() {}, fd: 0 });
  const readers = [];
  const readFileSync = (path) => {
    if (path === 0 || path === "/dev/stdin") return input;
    throw new Error(`Only standard input can be read here (got ${JSON.stringify(path)}).`);
  };
  const createInterface = () => {
    const rl = emitter();
    const queue = [];
    let done = false;
    let wake = null;
    rl.close = () => {};
    rl[Symbol.asyncIterator] = () => ({
      async next() {
        while (!queue.length && !done) await new Promise((r) => (wake = r));
        return queue.length ? { value: queue.shift(), done: false } : { value: undefined, done: true };
      },
    });
    readers.push({
      feed(lines) {
        for (const l of lines) {
          queue.push(l);
          rl.emit("line", l);
        }
        done = true;
        rl.emit("close");
        wake?.();
      },
    });
    return rl;
  };
  const modules = { fs: { readFileSync }, "node:fs": { readFileSync }, readline: { createInterface }, "node:readline": { createInterface } };
  const requireShim = (name) => {
    if (modules[name]) return modules[name];
    throw new Error(`require("${name}") isn't available here.`);
  };
  const processShim = { stdin, stdout: { write }, stderr: { write: (s) => (debug(String(s)), true) }, argv: [], env: {}, exit() {} };
  const mod = { exports: {} };

  program(consoleShim, requireShim, processShim, mod, mod.exports);
  await tick();
  stdin.emit("data", input);
  stdin.emit("end");
  const lines = input.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  for (const r of readers) r.feed(lines);
  for (let i = 0; i < 5; i++) await tick();
  return out;
}

/** Loads the student's code for any problem: stdin programs get `__stdin(input)`, the rest their entry names. */
export function loadProblemModule(problem, tsCode, consoleShim = console) {
  if (problem.kind !== "stdin") return loadSierraModule(tsCode, problem.entry, consoleShim);
  const program = compileStdinProgram(tsCode);
  return { __stdin: (input) => runStdinProgram(program, input, (s) => consoleShim.error(s)) };
}
