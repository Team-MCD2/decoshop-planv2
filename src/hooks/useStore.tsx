import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import type { AppState, AppAction, Section, Item } from '../types/domain';
import { DEFAULT_SECTIONS, DEFAULT_ZONES, loadLayout, saveLayout } from '../data/storeLayout';

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
      return { ...state, mode: action.mode, drillLevel: 'store', selectedSectionId: null, selectedShelfId: null };

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

    case 'SET_ZOOM':
      return { ...state, zoom: action.zoom };

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

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  selectedSection: Section | null;
  totalItems: (sectionId: string) => number;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    const saved = loadLayout();
    if (saved && saved.sections.length > 0) {
      return { ...init, sections: saved.sections, zones: saved.zones };
    }
    return init;
  });

  // Auto-save to localStorage on every state change
  useEffect(() => {
    saveLayout(state.sections, state.zones);
  }, [state.sections, state.zones]);

  const selectedSection = state.selectedSectionId
    ? state.sections.find((s) => s.id === state.selectedSectionId) ?? null
    : null;

  const totalItems = useCallback(
    (sectionId: string): number => {
      const sec = state.sections.find((s) => s.id === sectionId);
      if (!sec) return 0;
      return sec.shelves.reduce((sum, sh) => sum + sh.items.length, 0);
    },
    [state.sections],
  );

  return (
    <StoreContext.Provider value={{ state, dispatch, selectedSection, totalItems }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}
