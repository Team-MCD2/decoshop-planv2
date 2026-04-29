/**
 * Typed Supabase data-access layer for DecoShop Plan V2.
 *
 * Two RPCs do all the heavy lifting (defined in `sql/002_plan_rpcs.sql`):
 *   - `plan_load_layout()`           → atomic full-snapshot fetch
 *   - `plan_replace_layout(payload)` → atomic full-snapshot save
 *
 * Everything else (retry, debounce, error classification, localStorage→DB
 * migration) is built on top so the React side just calls
 * `loadLayout()` / `saveLayout()` and gets a discriminated `{ ok, ... }` back.
 */

import { supabase, hasSupabaseConfig } from './supabase';
import type { Section, Zone } from '../types/domain';

/** Snapshot shape exchanged with the DB. Identical to client-side state. */
export interface LayoutSnapshot {
  version: number;
  sections: Section[];
  zones: Zone[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Result types — discriminated by `ok`. Functions never throw.
// ─────────────────────────────────────────────────────────────────────────────

export type LoadLayoutResult =
  | { ok: true; snapshot: LayoutSnapshot; existed: boolean }
  | { ok: false; error: DbError };

export type SaveLayoutResult =
  | { ok: true; summary: SaveSummary }
  | { ok: false; error: DbError };

/** Returned by `plan_replace_layout` — counts + timestamp. */
export interface SaveSummary {
  sections_inserted: number;
  zones_inserted: number;
  shelves_inserted: number;
  items_inserted: number;
  /** Items submitted with an article_id that didn't resolve to public.articles. */
  article_ids_unresolved: number;
  saved_at: string;
}

/** Normalized error for the UI to render. */
export interface DbError {
  code: 'network' | 'auth' | 'validation' | 'rls' | 'config' | 'unknown';
  message: string;
  /** Underlying Supabase / fetch error — for debugging only, never user-facing. */
  cause?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Map a raw Supabase / fetch error to our typed `DbError`. */
function classifyError(raw: unknown): DbError {
  const e = raw as { code?: string; message?: string; details?: string };
  const message = e?.message ?? String(raw);
  const code = e?.code ?? '';

  if (/network|fetch|failed to fetch/i.test(message)) {
    return { code: 'network', message: 'Connexion à la base impossible. Vérifie ta connexion internet.', cause: raw };
  }
  if (code === '42501' || /permission denied|RLS|row.level security/i.test(message)) {
    return { code: 'rls', message: 'Accès refusé. Vérifie la configuration RLS sur les tables plan_*.', cause: raw };
  }
  if (code === '401' || /jwt|invalid.*key|auth/i.test(message)) {
    return { code: 'auth', message: 'Authentification Supabase invalide. Vérifie VITE_SUPABASE_ANON_KEY.', cause: raw };
  }
  if (code.startsWith('22') || /must be|invalid input|json/i.test(message)) {
    return { code: 'validation', message: `Payload invalide : ${message}`, cause: raw };
  }
  return { code: 'unknown', message: message || 'Erreur inconnue', cause: raw };
}

const NO_CONFIG: DbError = {
  code: 'config',
  message: 'Supabase non configuré. Sauvegarde locale uniquement.',
};

/** Retry network errors with exponential backoff. Other errors don't retry. */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelayMs = 300,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const classified = classifyError(err);
      if (classified.code !== 'network' || attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the full DecoShop floor plan from Supabase.
 *
 * - Returns `{ ok: true, snapshot, existed: false }` when the DB is reachable
 *   but empty (no rows yet) — the caller should seed defaults.
 * - Returns `{ ok: false, error }` when the DB is unreachable or RLS denies.
 *   The caller should fall back to localStorage.
 *
 * Network failures retry with backoff (3 attempts max). Determinist failures
 * (auth / RLS / validation) do NOT retry.
 */
export async function loadLayout(): Promise<LoadLayoutResult> {
  if (!hasSupabaseConfig) return { ok: false, error: NO_CONFIG };

  try {
    const result = await withRetry(async () => {
      const { data, error } = await supabase.rpc('plan_load_layout');
      if (error) throw error;
      return data;
    });

    if (!result || typeof result !== 'object') {
      return {
        ok: false,
        error: { code: 'unknown', message: 'Réponse RPC inattendue.', cause: result },
      };
    }

    const r = result as {
      version?: number;
      exists?: boolean;
      sections?: Section[];
      zones?: Zone[];
    };

    return {
      ok: true,
      existed: r.exists !== false,
      snapshot: {
        version: r.version ?? 1,
        sections: Array.isArray(r.sections) ? r.sections : [],
        zones: Array.isArray(r.zones) ? r.zones : [],
      },
    };
  } catch (err) {
    return { ok: false, error: classifyError(err) };
  }
}

/**
 * Atomic snapshot save via the `plan_replace_layout` RPC.
 *
 * The whole layout is replaced in one transaction — there is no concept of
 * partial save, so a network failure mid-call leaves the DB in its previous
 * state (Postgres rolls back). Items with `article_id` that don't match a
 * row in `public.articles` get their FK coerced to NULL, and the count of
 * such drops is reported in `summary.article_ids_unresolved`.
 */
export async function saveLayout(snapshot: LayoutSnapshot): Promise<SaveLayoutResult> {
  if (!hasSupabaseConfig) return { ok: false, error: NO_CONFIG };

  try {
    const summary = await withRetry(async () => {
      const { data, error } = await supabase.rpc('plan_replace_layout', {
        p_payload: snapshot,
      });
      if (error) throw error;
      return data as SaveSummary;
    });
    return { ok: true, summary };
  } catch (err) {
    return { ok: false, error: classifyError(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage → DB migration (one-shot, idempotent)
// ─────────────────────────────────────────────────────────────────────────────

/** Same key the V2 app already uses in storeLayout.ts. */
const LEGACY_LAYOUT_KEY = 'decoshop-plan-v2';
const MIGRATION_FLAG_KEY = 'decoshop-plan-v2:db-migrated';

export type MigrationResult =
  | { ok: true; status: 'skipped'; reason: 'already-migrated' | 'no-local-data' | 'no-config' }
  | { ok: true; status: 'migrated'; summary: SaveSummary }
  | { ok: false; error: DbError };

/**
 * Push the localStorage cache up to the DB on first connect.
 *
 * Idempotent: a `decoshop-plan-v2:db-migrated` flag is set after the first
 * successful run so subsequent app loads skip this entirely. Call this only
 * after `loadLayout()` returned `existed: false` — otherwise you'd wipe the
 * DB's authoritative state with stale local data.
 */
export async function migrateLocalStorageToDb(): Promise<MigrationResult> {
  if (!hasSupabaseConfig) {
    return { ok: true, status: 'skipped', reason: 'no-config' };
  }
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ok: true, status: 'skipped', reason: 'no-local-data' };
  }
  if (window.localStorage.getItem(MIGRATION_FLAG_KEY) === '1') {
    return { ok: true, status: 'skipped', reason: 'already-migrated' };
  }

  const raw = window.localStorage.getItem(LEGACY_LAYOUT_KEY);
  if (!raw) {
    window.localStorage.setItem(MIGRATION_FLAG_KEY, '1');
    return { ok: true, status: 'skipped', reason: 'no-local-data' };
  }

  let parsed: { sections?: Section[]; zones?: Zone[] };
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      error: { code: 'validation', message: 'Données localStorage corrompues.', cause: err },
    };
  }

  const result = await saveLayout({
    version: 1,
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    zones: Array.isArray(parsed.zones) ? parsed.zones : [],
  });
  // Rebuild the failure result explicitly: SaveLayoutResult and
  // MigrationResult share the same { ok: false; error } shape but are
  // structurally distinct types, so a direct return is rejected by TS.
  if (!result.ok) return { ok: false, error: result.error };

  // Only flag as migrated AFTER a successful save — otherwise a transient
  // network failure would skip the migration permanently on the next boot.
  window.localStorage.setItem(MIGRATION_FLAG_KEY, '1');
  return { ok: true, status: 'migrated', summary: result.summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// Debounced saver — coalesces rapid edits into one RPC call
// ─────────────────────────────────────────────────────────────────────────────

export interface DebouncedSaveOptions {
  delayMs?: number;
  /** Called synchronously when an actual save fires. */
  onSaveStart?: () => void;
  /** Called when the save resolves (success or error). */
  onResult?: (result: SaveLayoutResult) => void;
}

export interface DebouncedSaver {
  /** Cancel any pending timer and queue a fresh save with this snapshot. */
  schedule: (snapshot: LayoutSnapshot) => void;
  /** Run any pending save immediately and resolve when the in-flight one is done. */
  flush: () => Promise<SaveLayoutResult | null>;
  /** True if a timer is armed OR a save is in flight. */
  isPending: () => boolean;
  /** Latest non-null error (cleared on success). */
  lastError: () => DbError | null;
}

export function createDebouncedSave(
  delayMs: number = 800,
  opts: DebouncedSaveOptions = {},
): DebouncedSaver {
  const finalDelay = opts.delayMs ?? delayMs;
  const { onSaveStart, onResult } = opts;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: LayoutSnapshot | null = null;
  let inFlight: Promise<SaveLayoutResult> | null = null;
  let lastErr: DbError | null = null;

  const doSave = async (): Promise<SaveLayoutResult | null> => {
    if (!pending) return null;
    const snapshot = pending;
    pending = null;
    timer = null;
    onSaveStart?.();
    inFlight = saveLayout(snapshot);
    const result = await inFlight;
    inFlight = null;
    lastErr = result.ok ? null : result.error;
    onResult?.(result);
    return result;
  };

  return {
    schedule(snapshot) {
      pending = snapshot;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void doSave(); }, finalDelay);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (inFlight) await inFlight;
      return doSave();
    },
    isPending: () => timer !== null || inFlight !== null,
    lastError: () => lastErr,
  };
}
