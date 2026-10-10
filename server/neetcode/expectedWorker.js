// Runs one reference solution on a student's custom input, off the main thread (see customExpected).
import { parentPort, workerData } from "node:worker_threads";
import { parseCase, runCase } from "../../shared/ncJudge.js";
import { referenceEntry } from "./reference.js";

const { slug, meta, input } = workerData;
try {
  const expected = runCase(slug, meta, referenceEntry(slug, meta), parseCase(input));
  parentPort.postMessage({ ok: true, expected });
} catch (err) {
  parentPort.postMessage({ ok: false, error: err.message });
}
