// AI Agent: rebuilds the curated resume as a one-page PDF in EB Garamond, with the student's header
// (name, email, phone, location, clickable links) and clickable project links. Runs in the browser with jsPDF; the header never
// leaves this device except inside the PDF the student downloads. The same PDF (minus nothing) is
// what the agent re-scores: the server reads it back with Ginny's parser, which strips the header.
//
// One page: if the content runs long, the font steps down (10.5 → 10 → 9.5 pt), then the least
// relevant bullets (the last ones of the last entries) are dropped until it fits.

import type { Curated } from "./agentResults";
import { canSaveLocally, pushKey } from "./accountSync";

export type ResumeHeader = { name: string; email: string; phone: string; location: string; links: string };

const HEADER_KEY = "tepobaby.resumeHeader";

export function loadHeader(): ResumeHeader {
  try {
    return { name: "", email: "", phone: "", location: "", links: "", ...JSON.parse(localStorage.getItem(HEADER_KEY) || "{}") };
  } catch {
    return { name: "", email: "", phone: "", location: "", links: "" };
  }
}

export function saveHeader(h: ResumeHeader) {
  try {
    if (!canSaveLocally()) return;
    localStorage.setItem(HEADER_KEY, JSON.stringify(h));
    pushKey(HEADER_KEY);
  } catch {
    // ignore
  }
}

const PAGE = { w: 612, h: 792 }; // US Letter, points
const MARGIN = { x: 46, top: 40, bottom: 38 };

let fonts: Promise<Record<string, string>> | null = null;
function loadFonts() {
  const toB64 = (buf: ArrayBuffer) => {
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  fonts ??= Promise.all(
    ["Regular", "SemiBold", "Italic"].map(async (w) => {
      const res = await fetch(`/fonts/EBGaramond-${w}.ttf`);
      if (!res.ok) throw new Error("Couldn't load the resume font.");
      return [w, toB64(await res.arrayBuffer())] as const;
    }),
  )
    .then(Object.fromEntries)
    .catch((e) => {
      fonts = null;
      throw e;
    });
  return fonts;
}

const linkUrl = (l: string) => (/^https?:\/\//i.test(l) ? l : `https://${l}`);
const linkLabel = (l: string) => l.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

type Entry = Curated["entries"][number];

/** Builds the PDF. Returns its bytes and how many bullets had to be dropped to fit one page. */
export async function buildResumePdf(header: ResumeHeader, curated: Curated, education: string[]): Promise<{ bytes: Uint8Array; dropped: number }> {
  const [{ jsPDF }, f] = await Promise.all([import("jspdf"), loadFonts()]);

  const render = (entries: Entry[], size: number, draw: boolean) => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    doc.addFileToVFS("EBG-R.ttf", f.Regular);
    doc.addFont("EBG-R.ttf", "EBGaramond", "normal");
    doc.addFileToVFS("EBG-B.ttf", f.SemiBold);
    doc.addFont("EBG-B.ttf", "EBGaramond", "bold");
    doc.addFileToVFS("EBG-I.ttf", f.Italic);
    doc.addFont("EBG-I.ttf", "EBGaramond", "italic");
    const width = PAGE.w - MARGIN.x * 2;
    const lh = size * 1.22;
    let y = MARGIN.top;

    // Header: name, then contact details and links on one centered line.
    doc.setFont("EBGaramond", "bold");
    doc.setFontSize(size + 9);
    doc.setTextColor(17, 17, 17);
    if (draw) doc.text(header.name || "Your Name", PAGE.w / 2, y + size + 6, { align: "center" });
    y += size + 6 + size * 1.55; // room below the name's descenders
    const items = [
      ...[header.email, header.phone, header.location].map((t) => t.trim()).filter(Boolean).map((t) => ({ text: t, url: t.includes("@") ? `mailto:${t}` : "" })),
      ...header.links
        .split(/[\n,]+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => ({ text: linkLabel(l), url: linkUrl(l) })),
    ];
    if (items.length) {
      doc.setFont("EBGaramond", "normal");
      doc.setFontSize(size - 0.5);
      const sep = "  ·  ";
      const total = items.reduce((w, it, i) => w + doc.getTextWidth(it.text) + (i ? doc.getTextWidth(sep) : 0), 0);
      let x = Math.max(MARGIN.x, (PAGE.w - total) / 2);
      for (const [i, it] of items.entries()) {
        if (i && draw) doc.text(sep, x, y);
        if (i) x += doc.getTextWidth(sep);
        if (draw) {
          if (it.url) {
            doc.setTextColor(30, 64, 175);
            doc.textWithLink(it.text, x, y, { url: it.url });
            doc.setTextColor(17, 17, 17);
          } else doc.text(it.text, x, y);
        }
        x += doc.getTextWidth(it.text);
      }
      y += lh + 2;
    }

    const heading = (title: string) => {
      y += 5;
      doc.setFont("EBGaramond", "bold");
      doc.setFontSize(size + 1);
      if (draw) {
        doc.text(title.toUpperCase(), MARGIN.x, y);
        doc.setDrawColor(60, 60, 60);
        doc.setLineWidth(0.6);
        doc.line(MARGIN.x, y + 3, PAGE.w - MARGIN.x, y + 3);
      }
      y += lh + 2;
    };

    const section = (title: string, list: Entry[]) => {
      if (!list.length) return;
      heading(title);
      for (const e of list) {
        doc.setFont("EBGaramond", "bold");
        doc.setFontSize(size);
        const head = [e.title, e.org].filter(Boolean).join(", ");
        if (draw) doc.text(head, MARGIN.x, y);
        // Project link, clickable, right after the title.
        if (e.link) {
          const x = MARGIN.x + doc.getTextWidth(head);
          doc.setFont("EBGaramond", "normal");
          if (draw) {
            doc.text("  ·  ", x, y);
            doc.setTextColor(30, 64, 175);
            doc.textWithLink(linkLabel(e.link), x + doc.getTextWidth("  ·  "), y, { url: linkUrl(e.link) });
            doc.setTextColor(17, 17, 17);
          }
          doc.setFont("EBGaramond", "bold");
        }
        if (e.dates) {
          doc.setFont("EBGaramond", "italic");
          if (draw) doc.text(e.dates, PAGE.w - MARGIN.x, y, { align: "right" });
        }
        y += lh;
        doc.setFont("EBGaramond", "normal");
        for (const b of e.bullets) {
          const lines = doc.splitTextToSize(b.text, width - 12) as string[];
          lines.forEach((line, i) => {
            if (draw) {
              if (i === 0) doc.text("•", MARGIN.x + 2, y);
              doc.text(line, MARGIN.x + 12, y);
            }
            y += lh;
          });
        }
        y += 2;
      }
    };

    section("Experience", entries.filter((e) => e.kind !== "project"));
    section("Projects", entries.filter((e) => e.kind === "project"));
    if (curated.skills.length) {
      heading("Skills");
      doc.setFont("EBGaramond", "normal");
      doc.setFontSize(size);
      for (const line of doc.splitTextToSize(curated.skills.join(", "), width) as string[]) {
        if (draw) doc.text(line, MARGIN.x, y);
        y += lh;
      }
    }
    if (education.length) {
      heading("Education");
      doc.setFont("EBGaramond", "normal");
      doc.setFontSize(size);
      for (const ed of education)
        for (const line of doc.splitTextToSize(ed, width) as string[]) {
          if (draw) doc.text(line, MARGIN.x, y);
          y += lh;
        }
    }
    return { doc, fits: y <= PAGE.h - MARGIN.bottom };
  };

  // Fit to one page: smaller type first, then drop the least relevant bullets.
  let entries = curated.entries.map((e) => ({ ...e, bullets: [...e.bullets] }));
  let dropped = 0;
  for (const size of [10.5, 10, 9.5]) {
    if (render(entries, size, false).fits) return { bytes: new Uint8Array(render(entries, size, true).doc.output("arraybuffer")), dropped };
  }
  while (!render(entries, 9.5, false).fits) {
    const last = [...entries].reverse().find((e) => e.bullets.length > 1);
    if (!last) break;
    last.bullets.pop();
    dropped++;
    entries = entries.map((e) => (e.entryId === last.entryId ? last : e));
  }
  return { bytes: new Uint8Array(render(entries, 9.5, true).doc.output("arraybuffer")), dropped };
}

export function downloadPdf(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const toBase64 = (bytes: Uint8Array) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
