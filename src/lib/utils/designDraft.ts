/**
 * Keeping a customer's design between visits, and giving it an identity.
 *
 * Placing artwork carefully takes twenty minutes, and until now a stray refresh
 * threw all of it away. A draft is saved on the device — the shopper is
 * anonymous, so there is no account to hang it on — keyed by product, so two
 * products in the same store do not overwrite each other.
 *
 * Two things are stored that are not just geometry:
 *
 * - **An id**, generated once and kept for the life of the design. It rides
 *   along with the order, so when somebody adjusts their shirt and buys again
 *   the store sees revision two of one design rather than two unrelated orders.
 * - **A revision count**, which is what that number is read from.
 *
 * Uploaded pictures are the easy part here, unlike a studio with no server
 * behind it: an image element already points at its full-resolution original in
 * R2 by URL, so a restored draft shows the real artwork rather than a broken
 * `blob:` handle. Only the geometry and the URLs are written, never file bytes,
 * which is also why a draft stays comfortably inside the storage quota.
 */

import type { DesignElement } from './designElements.js';

/** Bumped when the shape changes; an older save is dropped rather than guessed at. */
export const FORMAT = 1;

const KEY_PREFIX = 'ammoura-design';

/**
 * The most we will try to write.
 *
 * Browsers give an origin somewhere around 5MB and throw once it is gone, so
 * this leaves room rather than discovering the ceiling by hitting it. The quota
 * error is caught as well — this is the polite path, not the only guard.
 */
export const MAX_BYTES = 512 * 1024;

/** How long a draft is worth restoring. Beyond this the product may have changed. */
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface DesignDraft {
  format: number;
  /** Stable across every revision of this design. */
  designId: string;
  /** How many times this design has been added to a cart. */
  revision: number;
  productId: string;
  savedAt: number;
  /** Elements per zone id. */
  zones: Record<string, DesignElement[]>;
}

/**
 * Storage, narrowed to the three calls this uses.
 *
 * Declared structurally so the tests can hand over a Map and a quota that bites
 * at a known size, rather than trying to fill a real browser's.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SaveResult =
  { ok: true; bytes: number } | { ok: false; reason: 'too-large' | 'quota' | 'unavailable' };

export function draftKey(productId: string): string {
  return `${KEY_PREFIX}:${productId}`;
}

/**
 * Unguessable, because it is the handle a store groups revisions under.
 *
 * `crypto.randomUUID` where it exists; the fallback is only for old browsers
 * and dev environments, and collisions there are a cosmetic grouping problem,
 * not a security one.
 */
export function newDesignId(): string {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `d-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function pack(
  productId: string,
  zones: Record<string, DesignElement[]>,
  designId: string,
  revision = 0,
  now = Date.now()
): DesignDraft {
  return { format: FORMAT, designId, revision, productId, savedAt: now, zones };
}

/** Write a draft, or say why it could not be written. Never throws. */
export function saveDraft(storage: StorageLike | null | undefined, draft: DesignDraft): SaveResult {
  if (!storage) return { ok: false, reason: 'unavailable' };
  const json = JSON.stringify(draft);
  const bytes = json.length;
  if (bytes > MAX_BYTES) return { ok: false, reason: 'too-large' };
  try {
    storage.setItem(draftKey(draft.productId), json);
    return { ok: true, bytes };
  } catch {
    return { ok: false, reason: 'quota' };
  }
}

/**
 * Read a draft back, or null.
 *
 * A save from an older format, a different product, or one too old to trust is
 * dropped rather than half-restored — a design that comes back subtly wrong is
 * worse than one that comes back empty.
 */
export function loadDraft(
  storage: StorageLike | null | undefined,
  productId: string,
  now = Date.now()
): DesignDraft | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(draftKey(productId));
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const draft = parsed as Partial<DesignDraft> | null;
  if (!draft || draft.format !== FORMAT) return null;
  if (draft.productId !== productId) return null;
  if (typeof draft.savedAt !== 'number' || now - draft.savedAt > MAX_AGE_MS) return null;
  if (!draft.zones || typeof draft.zones !== 'object') return null;
  if (typeof draft.designId !== 'string' || !draft.designId) return null;
  return {
    format: FORMAT,
    designId: draft.designId,
    revision: typeof draft.revision === 'number' ? draft.revision : 0,
    productId,
    savedAt: draft.savedAt,
    zones: draft.zones as Record<string, DesignElement[]>
  };
}

export function clearDraft(storage: StorageLike | null | undefined, productId: string): void {
  if (!storage) return;
  try {
    storage.removeItem(draftKey(productId));
  } catch {
    // A storage that refuses to forget is not worth failing a checkout over.
  }
}

/** True when a draft has anything in it worth offering to restore. */
export function draftHasWork(draft: DesignDraft | null): boolean {
  if (!draft) return false;
  return Object.values(draft.zones).some((els) => Array.isArray(els) && els.length > 0);
}
