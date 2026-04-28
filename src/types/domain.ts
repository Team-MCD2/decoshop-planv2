/**
 * DecoShop Plan V2 — Domain types
 * Simplified from V1: 2D only, no rotation, no collision cascade.
 * Coordinates in metres from top-left origin.
 */

/* ── Geometric Primitives ─────────────────────────────────── */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Block {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  locked?: boolean;
}

/* ── Store ────────────────────────────────────────────────── */

export interface Store {
  width: number;
  height: number;
  name?: string;
  address?: string;
  surface?: string;
}

/* ── Items / Products ─────────────────────────────────────── */

export interface Item {
  id: string;
  title: string;
  sku?: string;
  vendor?: string;
  price?: number | null;
  qty?: number | null;
  image?: string;
  /** Links to public.articles.id when synced */
  article_id?: string | null;
}

/* ── Shelf ────────────────────────────────────────────────── */

export interface Shelf {
  id: string;
  index: number;
  hauteur_cm: number;
  capacite?: number;
  items: Item[];
}

/* ── Section ──────────────────────────────────────────────── */

export interface Section extends Block {
  number?: number | null;
  label: string;
  category?: string;
  color?: string;
  icon?: string;
  desc?: string;
  shelves: Shelf[];
  isComptoir?: boolean;
}

/* ── Zone ─────────────────────────────────────────────────── */

export interface Zone extends Block {
  label: string;
  type?: string;
  color?: string;
  icon?: string;
  desc?: string;
}

/* ── App State ────────────────────────────────────────────── */

export type AppMode = 'structure' | 'inventory';

export type DrillLevel = 'store' | 'section' | 'shelf';

export interface AppState {
  mode: AppMode;
  sections: Section[];
  zones: Zone[];
  drillLevel: DrillLevel;
  selectedSectionId: string | null;
  selectedShelfId: string | null;
  zoom: number;
  panX: number;
  panY: number;
}

/* ── Actions ──────────────────────────────────────────────── */

export type AppAction =
  | { type: 'SET_MODE'; mode: AppMode }
  | { type: 'SELECT_SECTION'; id: string }
  | { type: 'SELECT_SHELF'; id: string }
  | { type: 'DRILL_BACK' }
  | { type: 'DRILL_HOME' }
  | { type: 'MOVE_SECTION'; id: string; x: number; y: number }
  | { type: 'RESIZE_SECTION'; id: string; w: number; h: number }
  | { type: 'ADD_SECTION'; section: Section }
  | { type: 'DELETE_SECTION'; id: string }
  | { type: 'UPDATE_SECTION'; id: string; updates: Partial<Section> }
  | { type: 'MOVE_ZONE'; id: string; x: number; y: number }
  | { type: 'ADD_PRODUCT'; sectionId: string; shelfId: string; item: Item }
  | { type: 'REMOVE_PRODUCT'; sectionId: string; shelfId: string; itemId: string }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_PAN'; x: number; y: number }
  | { type: 'LOAD_STATE'; sections: Section[]; zones: Zone[] };
