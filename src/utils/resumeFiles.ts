// AI Agent: the original resume PDFs the student uploaded, so they can open them again.
// Signed in: stored in their account (/api/me/files), so they open on any device; a copy is also kept
// on this device (IndexedDB) for speed. Guests: on this device only.

import { isSignedIn } from "./accountSync";

const DB = "tepobaby-files";
const STORE = "resumes";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined; // storage blocked (private mode): the list still shows, without "View"
  }
}

// Fallback when the browser blocks IndexedDB (private browsing, some Home Screen apps): keep files in
// memory, so View still works until the page is closed.
const memory = new Map<string, Blob>();

const XHR = { "X-Requested-With": "XmlHttpRequest" };

export async function saveResumeFile(id: string, file: Blob) {
  memory.set(id, file);
  await run("readwrite", (s) => s.put(file, id));
  if (isSignedIn()) {
    const res = await fetch(`/api/me/files/${encodeURIComponent(id)}`, { method: "PUT", headers: { ...XHR, "Content-Type": "application/pdf" }, body: file }).catch(() => null);
    if (!res?.ok) throw new Error("Couldn't save this PDF to your account. It's kept on this device for now.");
  }
}

export async function getResumeFile(id: string): Promise<Blob | undefined> {
  const here = (await run<Blob>("readonly", (s) => s.get(id) as IDBRequest<Blob>)) ?? memory.get(id);
  if (here || !isSignedIn()) return here;
  // Not on this device yet: fetch it from the account and keep a copy here.
  const res = await fetch(`/api/me/files/${encodeURIComponent(id)}`).catch(() => null);
  if (!res?.ok) return undefined;
  const blob = new Blob([await res.arrayBuffer()], { type: "application/pdf" });
  memory.set(id, blob);
  await run("readwrite", (s) => s.put(blob, id));
  return blob;
}

export async function deleteResumeFile(id: string) {
  memory.delete(id);
  await run("readwrite", (s) => s.delete(id));
  if (isSignedIn()) await fetch(`/api/me/files/${encodeURIComponent(id)}`, { method: "DELETE", headers: XHR }).catch(() => {});
}

/** Ids of the PDFs that can be opened: on this device, plus (signed in) in the account. */
export async function storedIds(): Promise<string[]> {
  const ids = new Set([...((await run("readonly", (s) => s.getAllKeys())) ?? []).map(String), ...memory.keys()]);
  if (isSignedIn()) {
    const res = await fetch("/api/me/files").catch(() => null);
    if (res?.ok) for (const id of (await res.json()).ids as string[]) ids.add(id);
  }
  return [...ids];
}

/** Signed in: uploads PDFs that are only on this device (e.g. from before this existed) to the account. */
export async function uploadLocalFiles(validIds: string[]) {
  if (!isSignedIn()) return;
  const res = await fetch("/api/me/files").catch(() => null);
  if (!res?.ok) return;
  const inAccount = new Set((await res.json()).ids as string[]);
  const here = ((await run("readonly", (s) => s.getAllKeys())) ?? []).map(String);
  for (const id of here.filter((x) => validIds.includes(x) && !inAccount.has(x))) {
    const blob = await run<Blob>("readonly", (s) => s.get(id) as IDBRequest<Blob>);
    if (blob) await fetch(`/api/me/files/${encodeURIComponent(id)}`, { method: "PUT", headers: { ...XHR, "Content-Type": "application/pdf" }, body: blob }).catch(() => {});
  }
}

/** Opens a stored PDF in a new tab. The tab is opened first so phones don't block it as a pop-up. */
export async function viewResumeFile(id: string): Promise<boolean> {
  const tab = window.open("", "_blank");
  const blob = await getResumeFile(id);
  if (!blob) {
    tab?.close();
    return false;
  }
  const url = URL.createObjectURL(blob);
  if (tab) tab.location.href = url;
  else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}
