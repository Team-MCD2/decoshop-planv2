// react-refresh wants component-only files for HMR; this Provider exports its
// hook + types alongside the component so all consumers have one import path.
// Splitting them out (per the rule) trades a tiny HMR win for more files —
// against the boss's #1 simplicity mandate. Disable the rule for this file.
/* eslint-disable react-refresh/only-export-components */
import {
  createContext, useContext, useReducer, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import type { AppState, AppAction, Section, Item } from '../types/domain';
import {
  DEFAULT_SECTIONS, DEFAULT_ZONES,
  // Aliased to free the names for the DB-backed equivalents in `../lib/db`.
  // localStorage is the synchronous cache + offline fallback; the DB is the
  // source of truth when reachable.
  loadLayout as loadLocalLayout,
  saveLayout as saveLocalLayout,
} from '../data/storeLayout';
import {
  loadLayout as loadDbLayout,
  migrateLocalStorageToDb,
  createDebouncedSave,
  type DbError,
} from '../lib/db';

/* ═══════════════════════════════════════════════════════════════ */
/* REDUCER                                                         */
/* ═══════════════════════════════════════════════════════════════ */

const initialState: AppState = {
  mode: 'inventory',
  sections: DEFAULT_SECTIONS,
  zones: DEFAULT_ZONES,
  drillLevel: 'store',
  selectedSectionId: null,
  selectedShelfId: null,
  zoom: 1,
  panX: 0,
  panY: 0,
};

function updateSection(sections: Section[], id: string, updater: (s: Section) => Section): Section[] {
  return sections.map((s) => (s.id === id ? updater(s) : s));
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_MODE':
      // Preserve the user's drill state across mode toggles (fluency).
      // Structure mode has no shelf-level concept, so if they're at 'shelf'
      // when toggling INTO structure, drop them up to 'section'.
      return {
        ...state,
        mode: action.mode,
        drillLevel: action.mode === 'structure' && state.drillLevel === 'shelf'
          ? 'section'
          : state.drillLevel,
        selectedShelfId: action.mode === 'structure' ? null : state.selectedShelfId,
      };

    case 'SELECT_SECTION':
      return { ...state, drillLevel: 'section', selectedSectionId: action.id, selectedShelfId: null };

    case 'SELECT_SHELF':
      return { ...state, drillLevel: 'shelf', selectedShelfId: action.id };

    case 'DRILL_BACK':
      if (state.drillLevel === 'shelf') return { ...state, drillLevel: 'section', selectedShelfId: null };
      if (state.drillLevel === 'section') return { ...state, drillLevel: 'store', selectedSectionId: null };
      return state;

    case 'DRILL_HOME':
      return { ...state, drillLevel: 'store', selectedSectionId: null, selectedShelfId: null };

    case 'MOVE_SECTION':
      return { ...state, sections: updateSection(state.sections, action.id, (s) => ({ ...s, x: action.x, y: action.y })) };

    case 'RESIZE_SECTION':
      return { ...state, sections: updateSection(state.sections, action.id, (s) => ({ ...s, w: action.w, h: action.h })) };

    case 'ADD_SECTION':
      return { ...state, sections: [...state.sections, action.section] };

    case 'DELETE_SECTION':
      return {
        ...state,
        sections: state.sections.filter((s) => s.id !== action.id),
        selectedSectionId: state.selectedSectionId === action.id ? null : state.selectedSectionId,
        drillLevel: state.selectedSectionId === action.id ? 'store' : state.drillLevel,
      };

    case 'UPDATE_SECTION':
      return { ...state, sections: updateSection(state.sections, action.id, (s) => ({ ...s, ...action.updates })) };

    case 'MOVE_ZONE':
      return { ...state, zones: state.zones.map((z) => (z.id === action.id ? { ...z, x: action.x, y: action.y } : z)) };

    case 'ADD_PRODUCT': {
      return {
        ...state,
        sections: updateSection(state.sections, action.sectionId, (sec) => ({
          ...sec,
          shelves: sec.shelves.map((sh) =>
            sh.id === action.shelfId ? { ...sh, items: [...sh.items, action.item] } : sh,
          ),
        })),
      };
    }

    case 'REMOVE_PRODUCT': {
      return {
        ...state,
        sections: updateSection(state.sections, action.sectionId, (sec) => ({
          ...sec,
          shelves: sec.shelves.map((sh) =>
            sh.id === action.shelfId ? { ...sh, items: sh.items.filter((it) => it.id !== action.itemId) } : sh,
          ),
        })),
      };
    }

    case 'UPDATE_PRODUCT': {
      return {
        ...state,
        sections: updateSection(state.sections, action.sectionId, (sec) => ({
          ...sec,
          shelves: sec.shelves.map((sh) =>
            sh.id === action.shelfId
              ? {
                  ...sh,
                  items: sh.items.map((it) =>
                    it.id === action.itemId ? { ...it, ...action.updates } : it,
                  ),
                }
              : sh,
          ),
        })),
      };
    }

    case 'MOVE_PRODUCT': {
      // Scan the section to locate the item and its source shelf, then perform
      // a single-pass update: remove from source, append to target. No-op if
      // source === target or the item isn't found.
      return {
        ...state,
        sections: updateSection(state.sections, action.sectionId, (sec) => {
          let movingItem: Item | null = null;
          let sourceShelfId: string | null = null;
          for (const sh of sec.shelves) {
            const found = sh.items.find((it) => it.id === action.itemId);
            if (found) {
              movingItem = found;
              sourceShelfId = sh.id;
              break;
            }
          }
          if (!movingItem || !sourceShelfId || sourceShelfId === action.toShelfId) return sec;
          return {
            ...sec,
            shelves: sec.shelves.map((sh) => {
              if (sh.id === sourceShelfId) {
                return { ...sh, items: sh.items.filter((it) => it.id !== action.itemId) };
              }
              if (sh.id === action.toShelfId) {
                return { ...sh, items: [...sh.items, movingItem!] };
              }
              return sh;
            }),
          };
        }),
      };
    }

    case 'ADD_SHELF': {
      return {
        ...state,
        sections: updateSection(state.sections, action.sectionId, (sec) => ({
          ...sec,
          shelves: [...sec.shelves, action.shelf],
        })),
      };
    }

    case 'REMOVE_SHELF': {
      // If the user was drilled into the shelf we're deleting, drop them up
      // to the section level so they don't see a stale "ghost" shelf detail.
      const wasViewing = state.selectedShelfId === action.shelfId;
      return {
        ...state,
        sections: updateSection(state.sections, action.sectionId, (sec) => ({
          ...sec,
          shelves: sec.shelves.filter((sh) => sh.id !== action.shelfId),
        })),
        selectedShelfId: wasViewing ? null : state.selectedShelfId,
        drillLevel: wasViewing && state.drillLevel === 'shelf' ? 'section' : state.drillLevel,
      };
    }

    case 'UPDATE_SHELF': {
      return {
        ...state,
        sections: updateSection(state.sections, action.sectionId, (sec) => ({
          ...sec,
          shelves: sec.shelves.map((sh) =>
            sh.id === action.shelfId ? { ...sh, ...action.updates } : sh,
          ),
        })),
      };
    }

    case 'SET_ZOOM':
      return { ...state, zoom: Math.min(2.5, Math.max(0.4, action.zoom)) };

    case 'ZOOM_BY':
      // Reducer-side clamping — callers just send the delta they sense.
      return { ...state, zoom: Math.min(2.5, Math.max(0.4, state.zoom + action.delta)) };

    case 'SET_PAN':
      return { ...state, panX: action.x, panY: action.y };

    case 'LOAD_STATE':
      return { ...state, sections: action.sections, zones: action.zones };

    default:
      return state;
  }
}

/* ═══════════════════════════════════════════════════════════════ */
/* CONTEXT                                                         */
/* ═══════════════════════════════════════════════════════════════ */

/** DB connection state — drives the status pill in the UI. */
export type DbSyncStatus = 'pending' | 'connected' | 'offline' | 'saving';

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  selectedSection: Section | null;
  totalItems: (sectionId: string) => number;
  /** Live DB sync status. */
  dbStatus: DbSyncStatus;
  /** Last error from a failed save/load (null after any success). */
  dbLastError: DbError | null;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  // Cold-start hydrate from localStorage — synchronous, instant first paint.
  // The DB sync effect below will (asynchronously) overwrite this with the
  // authoritative server state once we know the DB is reachable.
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    const saved = loadLocalLayout();
    if (saved && saved.sections.length > 0) {
      return { ...init, sections: saved.sections, zones: saved.zones };
    }
    return init;
  });

  // ─── DB sync layer (Sprint A.5) ──────────────────────────────────────────
  // Source of truth   : public.plan_* tables in Supabase (via RPCs).
  // Cache / fallback  : localStorage (synchronous, offline-safe).
  const [dbStatus, setDbStatus] = useState<DbSyncStatus>('pending');
  const [dbLastError, setDbLastError] = useState<DbError | null>(null);

  // Read the latest status from inside effects without listing it as a dep
  // (which would loop: save → 'saving' → effect re-runs → another save).
  const dbStatusRef = useRef<DbSyncStatus>(dbStatus);
  useEffect(() => { dbStatusRef.current = dbStatus; }, [dbStatus]);

  // Debounced DB saver: coalesces rapid edits (drag, resize, fast clicks)
  // into one `plan_replace_layout` RPC call after 800ms of inactivity.
  const dbSaverRef = useRef(createDebouncedSave(800, {
    onSaveStart: () => setDbStatus('saving'),
    onResult: (result) => {
      if (result.ok) {
        setDbStatus('connected');
        setDbLastError(null);
      } else {
        setDbStatus('offline');
        setDbLastError(result.error);
      }
    },
  }));

  // One-shot mount sync: load DB → hydrate-or-migrate → fall back to
  // localStorage on failure. Runs exactly once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await loadDbLayout();
      if (cancelled) return;
      if (!result.ok) {
        setDbStatus('offline');
        setDbLastError(result.error);
        return; // stay on the localStorage cache already in state
      }
      setDbStatus('connected');
      setDbLastError(null);
      const empty = !result.existed
        || (result.snapshot.sections.length === 0 && result.snapshot.zones.length === 0);
      if (empty) {
        // First connect for this shop — push our localStorage cache up.
        const mig = await migrateLocalStorageToDb();
        if (cancelled) return;
        if (mig.ok && mig.status === 'migrated') {
          // Refetch to capture server-side normalisation (article_id
          // resolution, dropped placements).
          const refreshed = await loadDbLayout();
          if (!cancelled && refreshed.ok && refreshed.snapshot.sections.length > 0) {
            dispatch({
              type: 'LOAD_STATE',
              sections: refreshed.snapshot.sections,
              zones: refreshed.snapshot.zones,
            });
          }
        }
      } else {
        // DB has authoritative data — overwrite local in-memory state.
        dispatch({
          type: 'LOAD_STATE',
          sections: result.snapshot.sections,
          zones: result.snapshot.zones,
        });
      }
    })();
    return () => { cancelled = true; };
    // Empty deps: runs exactly once on mount. dispatch identity is stable
    // and module-scoped imports don't need to be listed.
  }, []);

  // Autosave: synchronous localStorage write + debounced DB save.
  // - localStorage: always (offline-safe cache).
  // - DB:           only when reachable (skipped on 'pending' and 'offline').
  // We read dbStatus from the ref so this effect only re-runs on actual
  // data changes, not when the saver flips status during its own lifecycle.
  useEffect(() => {
    saveLocalLayout(state.sections, state.zones);
    const status = dbStatusRef.current;
    if (status === 'connected' || status === 'saving') {
      dbSaverRef.current.schedule({
        version: 1,
        sections: state.sections,
        zones: state.zones,
      });
    }
  }, [state.sections, state.zones]);

  // Flush any pending debounced save before the user closes the tab so the
  // last edit isn't lost. The save is fire-and-forget but the synchronous
  // schedule-cancel + start completes before the tab teardown.
  useEffect(() => {
    const onBeforeUnload = () => {
      if (dbSaverRef.current.isPending()) {
        void dbSaverRef.current.flush();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const selectedSection = state.selectedSectionId
    ? state.sections.find((s) => s.id === state.selectedSectionId) ?? null
    : null;

  // Plain function — React Compiler handles memoization automatically.
  const totalItems = (sectionId: string): number => {
    const sec = state.sections.find((s) => s.id === sectionId);
    if (!sec) return 0;
    return sec.shelves.reduce((sum, sh) => sum + sh.items.length, 0);
  };

  return (
    <StoreContext.Provider value={{
      state, dispatch, selectedSection, totalItems,
      dbStatus, dbLastError,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}
