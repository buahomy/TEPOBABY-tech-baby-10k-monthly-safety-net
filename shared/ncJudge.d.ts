// Types for shared/ncJudge.js (used by the browser app).

export type NcMeta = {
  name: string;
  params: { name: string; type: string }[];
  return: { type: string };
  classname?: string;
  methods?: { name: string; params: { name: string; type: string }[]; return?: { type: string } }[];
  output?: { paramindex: number };
};

export function parseCase(text: string): unknown[];
export function entryNames(slug: string, meta: NcMeta): string[];
export function runCase(slug: string, meta: NcMeta, entry: Record<string, unknown>, args: unknown[]): unknown;
export function accepts(mode: string | undefined, expected: unknown, actual: unknown, args: unknown[]): boolean;
export function isDesign(meta: NcMeta): boolean;

export const ListNode: unknown;
export const TreeNode: unknown;
export const _Node: unknown;
export const MinPriorityQueue: unknown;
export const MaxPriorityQueue: unknown;
export const PriorityQueue: unknown;
