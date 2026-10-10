// Resume intake for Ginny: read the PDF, strip personal info, keep only the useful sections.
//
// PII mitigation (before anything is sent to a hosted API like Voyage AI):
//   1. Redact direct identifiers locally: name (the header line), email, phone, street address,
//      LinkedIn / GitHub / personal URLs.
//   2. Keep only Work Experience, Projects, Skills and Education. Summary, objective, references
//      and other header info are dropped.
//   3. Only the sanitized, sectioned text is stored (Upstash Redis on Vercel, server/data/resumes
//      locally) and sent for embedding. The original PDF is kept only in local development
//      (owner-only files); the deployed app never stores it.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "../store.js";

// pdf.js (inside unpdf) uses Promise.try, which arrived in Node 22.
if (!Promise.try) Promise.try = (fn, ...args) => new Promise((resolve) => resolve(fn(...args)));
const { getDocumentProxy } = await import("unpdf");

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.RESUME_STORE_DIR || path.join(here, "..", "data", "resumes");
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

// ---- PDF → lines ----

export async function pdfToLines(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer.subarray(0, 5).toString() !== "%PDF-") {
    throw { status: 400, message: "That file isn't a PDF." };
  }
  if (buffer.length > MAX_PDF_BYTES) throw { status: 400, message: "Resume PDF must be under 5 MB." };

  // isEvalSupported: false closes pdf.js's font-eval code path (CVE-2024-4367).
  const pdf = await getDocumentProxy(new Uint8Array(buffer), { isEvalSupported: false });
  const lines = [];
  for (let n = 1; n <= Math.min(pdf.numPages, 6); n++) {
    const page = await pdf.getPage(n);
    const { items } = await page.getTextContent();
    let line = "";
    let lastY = null;
    for (const it of items) {
      const y = it.transform?.[5];
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2 && line.trim()) {
        lines.push(line.trim());
        line = "";
      }
      line += it.str;
      if (it.hasEOL) {
        if (line.trim()) lines.push(line.trim());
        line = "";
      }
      if (y !== undefined) lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
  }
  await pdf.destroy();
  if (!lines.join("").trim()) throw { status: 400, message: "Couldn't read text from that PDF. Is it a scanned image?" };
  return lines;
}

// ---- Redaction ----

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const PHONE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const URLS = /\b((https?:\/\/)?(www\.)?(linkedin\.com|github\.com|gitlab\.com|twitter\.com|x\.com)\/[^\s|,]+|https?:\/\/[^\s|,]+|\b[\w-]+\.(dev|io|me|com|net|org)\/?[^\s|,]*)/gi;
const ADDRESS =
  /\b\d{1,6}\s+[A-Za-z0-9.\s]{2,40}\b(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl|apt|suite)\b\.?(\s*(#|apt|suite|unit)\s*\w+)?(,\s*[A-Za-z\s]+)?(,\s*[A-Z]{2})?(\s+\d{5}(-\d{4})?)?/gi;
const ZIP_LINE = /\b[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}\s+\d{5}(-\d{4})?\b/g;

function redactLine(line, counts) {
  const sub = (re, key, label) =>
    (line = line.replace(re, () => {
      counts[key] = (counts[key] || 0) + 1;
      return label;
    }));
  sub(EMAIL, "email", "[email]");
  sub(URLS, "url", "[link]");
  sub(PHONE, "phone", "[phone]");
  sub(ADDRESS, "address", "[address]");
  sub(ZIP_LINE, "address", "[address]");
  return line;
}

const looksLikeName = (s) => /^[A-Z][a-zA-Z'.-]+(\s+[A-Z][a-zA-Z'.-]+){1,3}$/.test(s.trim()) && s.length <= 40;

// ---- Sections ----

const HEADINGS = [
  ["experience", /^(work\s+|professional\s+|relevant\s+|technical\s+)?(experience|employment|work history|internships?)$/i],
  ["projects", /^((personal|academic|technical|selected|relevant)\s+)?projects?$/i],
  ["skills", /^((technical|core|relevant)\s+)?(skills|technologies|tech stack|tools|languages(\s*&\s*tools)?)(\s*&\s*\w+)?$/i],
  ["education", /^(education|academics|academic background)$/i],
  ["drop", /^(summary|profile|objective|about( me)?|references|interests|hobbies|activities|leadership|awards|honors|certifications?|volunteer(ing)?|publications)$/i],
];

function headingOf(line) {
  const clean = line.replace(/[:|•\-–—]+$/g, "").trim();
  if (clean.length > 40) return null;
  for (const [key, re] of HEADINGS) if (re.test(clean)) return key;
  return null;
}

/**
 * Sanitizes resume lines: drops the name/contact header, redacts identifiers, keeps only
 * Experience / Projects / Skills / Education. Returns { sections, text, redactions }.
 */
export function sanitize(lines) {
  const counts = {};
  const sections = { experience: [], projects: [], skills: [], education: [] };
  let current = null; // null = header (before the first section heading)
  let sawHeading = false;

  for (const raw of lines) {
    const h = headingOf(raw);
    if (h) {
      current = h;
      sawHeading = true;
      continue;
    }
    if (!current) {
      // Header block: name + contact info. Never kept.
      if (looksLikeName(raw)) counts.name = (counts.name || 0) + 1;
      else redactLine(raw, counts);
      continue;
    }
    if (current === "drop") continue;
    const line = redactLine(raw, counts).replace(/\s+/g, " ").trim();
    if (line && !/^\[(email|link|phone|address)\]([\s|,]*\[(email|link|phone|address)\])*$/.test(line)) sections[current].push(line);
  }

  // No recognizable headings: keep everything after the first 2 lines (header), redacted.
  if (!sawHeading) {
    for (const raw of lines.slice(2)) {
      const line = redactLine(raw, counts).trim();
      if (line) sections.experience.push(line);
    }
    counts.name = (counts.name || 0) + (looksLikeName(lines[0] || "") ? 1 : 0);
  }

  const text = Object.entries(sections)
    .filter(([, v]) => v.length)
    .map(([k, v]) => `${k.toUpperCase()}\n${v.join("\n")}`)
    .join("\n\n");
  if (text.length < 80) throw { status: 400, message: "Couldn't find Experience, Projects, Skills or Education sections in that resume." };
  return { sections, text, redactions: counts };
}

// ---- Private storage (signed-in students) ----

const fileFor = (sub, ext) => path.join(DIR, `${Buffer.from(sub).toString("base64url")}.${ext}`);

async function writePrivate(file, data) {
  await fs.mkdir(DIR, { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, data, { mode: 0o600 });
  await fs.rename(tmp, file);
}

export async function saveResume(sub, buffer, fileName) {
  const lines = await pdfToLines(buffer);
  const sanitized = sanitize(lines);
  const meta = {
    fileName: String(fileName || "resume.pdf").replace(/[^\w.\- ()]/g, "").slice(0, 120) || "resume.pdf",
    uploadedAt: new Date().toISOString(),
    bytes: buffer.length,
    sanitized,
  };
  if (store.usingRedis) {
    await store.set("resumes", sub, meta);
  } else {
    await writePrivate(fileFor(sub, "pdf"), buffer);
    await writePrivate(fileFor(sub, "json"), JSON.stringify(meta));
  }
  return meta;
}

export async function loadResume(sub) {
  if (store.usingRedis) return store.get("resumes", sub);
  try {
    return JSON.parse(await fs.readFile(fileFor(sub, "json"), "utf8"));
  } catch {
    return null;
  }
}

export async function deleteResume(sub) {
  if (store.usingRedis) return store.del("resumes", sub);
  await Promise.allSettled([fs.unlink(fileFor(sub, "pdf")), fs.unlink(fileFor(sub, "json"))]);
}

export const publicMeta = (m) =>
  m && { fileName: m.fileName, uploadedAt: m.uploadedAt, bytes: m.bytes, redactions: m.sanitized.redactions };
