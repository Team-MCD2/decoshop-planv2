/**
 * DecoShop Plan V2 — Store Layout Seed Data
 * Real DecoShop Toulouse floor plan: 14 sections + 6 functional zones.
 * Carried from V1, simplified (no rotation, no P-shape collision).
 */

import type { Section, Shelf, Store, Zone } from '../types/domain';
import { generateId } from '../lib/ids';

/* ═══════════════════════════════════════════════════════════════ */
/* STORE DIMENSIONS (metres)                                      */
/* ═══════════════════════════════════════════════════════════════ */

export const STORE: Store = {
  width: 11.5,
  height: 9.5,
  name: 'DecoShop Toulouse',
  address: '58 Rue Jacques Babinet, 31100 Toulouse',
  surface: '~250m²',
};

export const SCALE = 70; // px per metre

/* ═══════════════════════════════════════════════════════════════ */
/* SHELF BUILDER                                                   */
/* ═══════════════════════════════════════════════════════════════ */

/* Shared constants used by the shelf-management UI (Sprint D.3). */
export const DEFAULT_SHELF_CAPACITY = 12;
export const MAX_SHELF_HEIGHT_CM = 220;
export const MIN_SHELF_HEIGHT_CM = 0;
export const MIN_SHELF_CAPACITY = 1;
export const MAX_SHELF_CAPACITY = 50;
export const MAX_SHELVES_PER_SECTION = 12;

export function buildShelves(sectionId: string, heights: number[]): Shelf[] {
  return heights.map((h, i) => ({
    id: `${sectionId}-shelf-${i}`,
    index: i,
    hauteur_cm: h,
    capacite: DEFAULT_SHELF_CAPACITY,
    items: [],
  }));
}

/**
 * Build a fresh `Shelf` with sensible defaults for a section.
 *
 * Picks a height 40 cm above the tallest existing shelf (or 0 cm if the
 * section is empty), clamped to [0, 220] cm. Index is the next slot. ID
 * uses the project-wide `generateId('shelf')` so it can't collide across
 * runtime sessions.
 *
 * Caller is responsible for checking `MAX_SHELVES_PER_SECTION` before
 * dispatching `ADD_SHELF` (the reducer doesn't enforce that limit).
 */
export function createDefaultShelf(section: Section): Shelf {
  const heights = section.shelves.map((s) => s.hauteur_cm);
  const tallest = heights.length > 0 ? Math.max(...heights) : -40;
  const suggested = Math.min(MAX_SHELF_HEIGHT_CM - 10, Math.max(0, tallest + 40));
  return {
    id: generateId('shelf'),
    index: section.shelves.length,
    hauteur_cm: suggested,
    capacite: DEFAULT_SHELF_CAPACITY,
    items: [],
  };
}

/* ═══════════════════════════════════════════════════════════════ */
/* SECTION CATEGORIES                                              */
/* ═══════════════════════════════════════════════════════════════ */

export interface SectionCategory {
  id: string;
  label: string;
  icon: string;
  defaultColor: string;
  defaultW: number;
  defaultH: number;
}

export const SECTION_CATEGORIES: SectionCategory[] = [
  { id: 'cuisine',     label: 'Cuisine',              icon: '🍳', defaultColor: '#CD853F', defaultW: 1.7, defaultH: 1.3 },
  { id: 'arts-table',  label: 'Arts de la table',     icon: '🍽️', defaultColor: '#DAA520', defaultW: 1.7, defaultH: 1.3 },
  { id: 'salon',       label: 'Salon',                icon: '🛋️', defaultColor: '#8B4513', defaultW: 2.5, defaultH: 1.5 },
  { id: 'chambre',     label: 'Chambre adulte',       icon: '🛏️', defaultColor: '#34495E', defaultW: 2.0, defaultH: 1.5 },
  { id: 'chambre-enf', label: 'Chambre enfant',       icon: '🧸', defaultColor: '#A78BFA', defaultW: 1.8, defaultH: 1.3 },
  { id: 'bain',        label: 'Salle de bain',        icon: '🛁', defaultColor: '#A8D8FF', defaultW: 1.5, defaultH: 1.2 },
  { id: 'deco-mur',    label: 'Décoration murale',    icon: '🖼️', defaultColor: '#B8860B', defaultW: 1.2, defaultH: 1.0 },
  { id: 'luminaire',   label: 'Luminaire',            icon: '💡', defaultColor: '#FCD34D', defaultW: 1.2, defaultH: 1.0 },
  { id: 'textile',     label: 'Textile',              icon: '🧶', defaultColor: '#7F8C8D', defaultW: 2.5, defaultH: 1.0 },
  { id: 'spirituel',   label: 'Spirituel & bien-être', icon: '🕯️', defaultColor: '#A0522D', defaultW: 1.5, defaultH: 1.2 },
  { id: 'plantes',     label: 'Plantes & extérieur',  icon: '🌿', defaultColor: '#2F855A', defaultW: 1.5, defaultH: 1.5 },
  { id: 'saison',      label: 'Saisonnier / Promo',   icon: '🎯', defaultColor: '#EF4444', defaultW: 1.8, defaultH: 1.3 },
];

/* ═══════════════════════════════════════════════════════════════ */
/* DEFAULT SECTIONS — seed data for DecoShop Toulouse             */
/* ═══════════════════════════════════════════════════════════════ */

interface SectionSeed extends Omit<Section, 'shelves'> {
  shelves: number[];
}

const HEAD_Y = 0;
const HEAD_HEIGHT = 2.8;
const LINE_Y = HEAD_HEIGHT;
const RIGHT_COL_X = 7.0;
const BODY_LEFT = 0;

const SECTION_DEFS: SectionSeed[] = [
  { id: 'sec-1',  number: 1,  label: 'Section 1',  x: 1.8, y: 8.0, w: 1.8, h: 1.2, color: '#D4AF37', desc: 'Divers / Spirituel / Enfants', shelves: [0, 50, 100, 150] },
  { id: 'sec-2',  number: 2,  label: 'Section 2',  x: 3.7, y: 8.0, w: 1.5, h: 1.2, color: '#CD853F', desc: 'Cuisine / Arts de la table', shelves: [0, 50, 100, 150] },
  { id: 'sec-3',  number: 3,  label: 'Section 3',  x: 5.3, y: 8.0, w: 1.2, h: 1.2, color: '#8B4513', desc: 'Électroménager / Cuisine', shelves: [0, 50, 100, 150] },
  { id: 'sec-4',  number: 4,  label: 'Section 4',  x: RIGHT_COL_X, y: 6.0, w: 4.5, h: 3.2, color: '#1E3A8A', desc: 'Comptoir frontal', shelves: [0, 55], isComptoir: true, locked: true },
  { id: 'sec-5',  number: 5,  label: 'Section 5',  x: 1.5, y: 6.2, w: 1.7, h: 1.3, color: '#A0522D', desc: 'Livres / Spirituel / Cuisine', shelves: [0, 50, 100, 150] },
  { id: 'sec-6',  number: 6,  label: 'Section 6',  x: 3.3, y: 6.2, w: 1.7, h: 1.3, color: '#DAA520', desc: 'Ustensiles / Cuisine', shelves: [0, 50, 100, 150] },
  { id: 'sec-7',  number: 7,  label: 'Section 7',  x: 5.1, y: 6.2, w: 1.7, h: 1.3, color: '#C4A777', desc: 'Céramique / Verre', shelves: [0, 50, 100, 150] },
  { id: 'sec-8',  number: 8,  label: 'Section 8',  x: 1.5, y: 4.8, w: 1.7, h: 1.3, color: '#8B7355', desc: 'Thé & Service / Parfums', shelves: [0, 55, 110] },
  { id: 'sec-9',  number: 9,  label: 'Section 9',  x: 3.3, y: 4.8, w: 1.7, h: 1.3, color: '#B8860B', desc: 'Verrerie / Service', shelves: [0, 50, 100, 150] },
  { id: 'sec-10', number: 10, label: 'Section 10', x: 5.1, y: 4.8, w: 1.7, h: 1.3, color: '#CD853F', desc: 'Collections marque', shelves: [0, 50, 100, 150] },
  { id: 'sec-11', number: 11, label: 'Section 11', x: BODY_LEFT, y: LINE_Y, w: 6.8, h: 1.8, color: '#34495E', desc: 'Voilages & Rideaux', shelves: [0, 55, 110] },
  { id: 'sec-12', number: 12, label: 'Section 12', x: RIGHT_COL_X, y: LINE_Y, w: 4.5, h: 1.0, color: '#7F8C8D', desc: 'Rideaux & Textile canapé', shelves: [0, 50, 100, 150] },
  { id: 'sec-13', number: 13, label: 'Section 13', x: 5.0, y: HEAD_Y, w: 1.5, h: 1.3, color: '#D35400', desc: 'Spirituel / Textile / Cuisine', shelves: [0, 50, 100, 150] },
  { id: 'sec-14', number: 14, label: 'Section 14', x: 8.5, y: HEAD_Y, w: 3.0, h: 1.3, color: '#C0392B', desc: 'Mixte / Palettes', shelves: [0, 50, 100, 150] },
];

export const DEFAULT_SECTIONS: Section[] = SECTION_DEFS.map((s) => ({
  ...s,
  locked: s.locked || false,
  shelves: buildShelves(s.id, s.shelves),
}));

/* ═══════════════════════════════════════════════════════════════ */
/* DEFAULT ZONES                                                   */
/* ═══════════════════════════════════════════════════════════════ */

export const DEFAULT_ZONES: Zone[] = [
  { id: 'z-bureau',    label: 'Bureau',    type: 'office',    x: 3.2, y: HEAD_Y, w: 1.8, h: HEAD_HEIGHT, color: '#6366F1', icon: '🖥️' },
  { id: 'z-palettes',  label: 'Palettes',  type: 'palettes',  x: 6.6, y: HEAD_Y + 0.3, w: 1.8, h: 2.2, color: '#9CA3AF', icon: '🪵' },
  { id: 'z-entree',    label: 'Entrée',    type: 'entrance',  x: BODY_LEFT, y: 4.6, w: 1.3, h: 3.2, color: '#10B981', icon: '🚪', locked: true },
  { id: 'z-caisse',    label: 'Caisse',    type: 'checkout',  x: 0.2, y: 8.0, w: 1.4, h: 1.2, color: '#F59E0B', icon: '💳', locked: true },
  { id: 'z-meubilier', label: 'Meubilier', type: 'furniture', x: RIGHT_COL_X, y: LINE_Y + 1.1, w: 4.5, h: 1.5, color: '#8B5CF6', icon: '🛋️', desc: 'Canapé, Fauteuil' },
  { id: 'z-stock',     label: 'Stock',     type: 'storage',   x: RIGHT_COL_X, y: 4.6, w: 4.5, h: 1.3, color: '#EF4444', icon: '📦' },
];

/* ═══════════════════════════════════════════════════════════════ */
/* PRODUCT CATALOG (suggested products per section)               */
/* ═══════════════════════════════════════════════════════════════ */

export const SECTION_PRODUCTS: Record<number, string[]> = {
  1:  ['Eau bénite', 'Planche à dessin', 'Lampe lune', 'Mobile bébé', 'Ourson', 'Tapis de prière électronique', 'Veilleuse', 'Lessive', 'Bouteilles en verre', 'Moule à pâtisserie'],
  2:  ['Brûleur d\'encens', 'Kit casseroles', 'Pot à épices', 'Couteau', 'Plateau à thé', 'Plateau inox', 'Saladier inox', 'Plaque induction', 'Cocotte'],
  3:  ['Mélangeur de lait', 'Air fryer', 'Lessive', 'Marmite', 'Kit poêles & casseroles', 'Kit poêles', 'Sopalin', 'Papier toilette'],
  4:  ['Plaid', 'Taie d\'oreiller', 'Drap housse'],
  5:  ['Livre', 'Planche à dessin', 'Coran', 'Boîte Coran', 'Jeu de cartes', 'Poêle fonte pain', 'Boîte bonbons', 'Pot à sucre', 'Pot à épices'],
  6:  ['Couverture micro-ondes', 'Coffret couverts', 'Bouilloire socle', 'Ustensiles bois', 'Couteau', 'Ustensiles inox', 'Set soup lunch box'],
  7:  ['Bouilloire', 'Pot céramique', 'Bol céramique', 'Saladier verre'],
  8:  ['Parfum', 'Verres à thé', 'Pot sucre verre', 'Théière verre', 'Théière céramique', 'Coffret couverts', 'Pot bonbons verre'],
  9:  ['Distributeur 3L', 'Théière plastique', 'Pot à sucre', 'Pot décoration', 'Pot bonbons', 'Carafe & verres', 'Pot verre', 'Bol verre'],
  10: ['Terra', 'Chubby Snack', 'Capital Snack', 'Egg', 'Capital Tea', 'Verre café & saucier', 'Tasse thé & saucier'],
  11: ['Voilage', 'Voilage brodé', 'Rideau linen', 'Rideau velvet', 'Rideau occultant'],
  12: ['Rideau occultant', 'Drap housse canapé'],
  13: ['Drap housse canapé', 'Babouches', 'Voile', 'Lalezar', 'Qamis', 'Coran', 'Porte-Coran', 'Brûleur d\'encens'],
  14: ['Verre à thé', 'Assiette', 'Vase', 'Tableau', 'Four', 'Support', 'Saladier inox', 'Tapis cuisine', 'Air fryer'],
};

/* ═══════════════════════════════════════════════════════════════ */
/* PERSISTENCE — localStorage                                     */
/* ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'decoshop-plan-v2';

export interface SavedLayout {
  version: number;
  updatedAt: string;
  sections: Section[];
  zones: Zone[];
}

export function loadLayout(): SavedLayout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedLayout;
  } catch {
    return null;
  }
}

export function saveLayout(sections: Section[], zones: Zone[]): void {
  const data: SavedLayout = {
    version: 1,
    updatedAt: new Date().toISOString(),
    sections,
    zones,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearLayout(): void {
  localStorage.removeItem(STORAGE_KEY);
}
