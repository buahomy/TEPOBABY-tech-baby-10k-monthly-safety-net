// Live job postings from the server's aggregator (server/jobs).

import { Level, WindowId } from "../data/homeFeed";

export type Posting = {
  id: string;
  source: string;
  company: string;
  title: string;
  location: string;
  url: string;
  postedAt: string;
  postedApprox: boolean;
  level: Level;
  sponsorship: "yes" | "no" | "citizens" | null;
  domain: string | null; // company website, used for its logo
  program?: boolean; // rotational / development program
};

export type PostingsResponse = {
  updatedAt: string | null;
  nextUpdateAt: string;
  schedule: string;
  total: number;
  counts: Record<Level, { fresh: number; week: number; open: number }>;
  postings: Posting[];
};

export async function fetchPostings(opts: {
  level: Level;
  window: WindowId;
  hideNoSponsorship: boolean;
  sponsorsOnly?: boolean;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<PostingsResponse> {
  const params = new URLSearchParams({
    level: opts.level,
    window: opts.window,
    limit: String(opts.limit ?? 25),
    offset: String(opts.offset ?? 0),
  });
  if (opts.sponsorsOnly) params.set("visa", "2");
  else if (opts.hideNoSponsorship) params.set("visa", "1");
  const res = await fetch(`/api/postings?${params}`, { signal: opts.signal });
  if (!res.ok) throw new Error("Couldn't load postings.");
  return res.json();
}

/**
 * Calls `onUpdate` whenever the server reports new postings. Returns an unsubscribe function.
 * EventSource reconnects on its own if the connection drops.
 */
export function subscribeToPostings(onUpdate: () => void): () => void {
  // Where live updates aren't available (the deployed app on Vercel answers 204 and the stream
  // closes), check again whenever the student comes back to the app.
  const onVisible = () => {
    if (document.visibilityState === "visible" && (!source || source.readyState === EventSource.CLOSED)) onUpdate();
  };
  document.addEventListener("visibilitychange", onVisible);
  const source = typeof EventSource === "undefined" ? null : new EventSource("/api/postings/stream");
  source?.addEventListener("update", onUpdate);
  return () => {
    source?.close();
    document.removeEventListener("visibilitychange", onVisible);
  };
}

export function timeAgo(iso: string, approx = false): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (approx) {
    const days = Math.floor(mins / 1440);
    return days === 0 ? "today" : `${days}d ago`;
  }
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
