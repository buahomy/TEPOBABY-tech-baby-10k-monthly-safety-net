// AI Agent: the original resume PDFs the student uploaded, kept on this device (IndexedDB) so they can
// open them again. Never sent to Tepobaby's server after the one-time read.

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

export const saveResumeFile = (id: string, file: Blob) => run("readwrite", (s) => s.put(file, id));
export const getResumeFile = (id: string) => run<Blob>("readonly", (s) => s.get(id) as IDBRequest<Blob>);
export const deleteResumeFile = (id: string) => run("readwrite", (s) => s.delete(id));
export const storedIds = async () => ((await run("readonly", (s) => s.getAllKeys())) ?? []).map(String);

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
