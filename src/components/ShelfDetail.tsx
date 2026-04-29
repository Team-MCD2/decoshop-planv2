import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { SECTION_PRODUCTS } from '../data/storeLayout';
import { generateId } from '../lib/ids';
import type { Item } from '../types/domain';

export default function ShelfDetail() {
  const { state, dispatch, selectedSection } = useStore();
  const [customName, setCustomName] = useState('');

  // Resolve the targets up-front. They may be null until the user has
  // drilled into a section + shelf; the early return below handles that.
  const shelf = selectedSection && state.drillLevel === 'shelf'
    ? selectedSection.shelves.find((sh) => sh.id === state.selectedShelfId) ?? null
    : null;
  const sectionId = selectedSection?.id ?? null;
  const shelfId = shelf?.id ?? null;

  if (!selectedSection || state.drillLevel !== 'shelf') return null;
  if (!shelf) return null;

  // Plain functions — React Compiler memoizes the component automatically.
  // Manual useCallback would be flagged by `react-hooks/preserve-manual-memoization`.
  const addProduct = (name: string): void => {
    if (!name.trim() || !sectionId || !shelfId) return;
    const item: Item = {
      id: generateId('item'),
      title: name.trim(),
      qty: 1,
    };
    dispatch({ type: 'ADD_PRODUCT', sectionId, shelfId, item });
    setCustomName('');
  };

  const removeProduct = (itemId: string): void => {
    if (!sectionId || !shelfId) return;
    dispatch({ type: 'REMOVE_PRODUCT', sectionId, shelfId, itemId });
  };

  const sectionNumber = selectedSection.number ?? 0;
  const suggestions = SECTION_PRODUCTS[sectionNumber] ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addProduct(customName);
  };

  // Inline quantity stepper. Reducer-side it's just a partial-update on the
  // item; we clamp here so the UI never sends out-of-range values.
  const QTY_MIN = 1;
  const QTY_MAX = 99;
  const updateQty = (itemId: string, nextQty: number): void => {
    if (!sectionId || !shelfId) return;
    const clamped = Math.max(QTY_MIN, Math.min(QTY_MAX, Math.round(nextQty)));
    dispatch({
      type: 'UPDATE_PRODUCT',
      sectionId,
      shelfId,
      itemId,
      updates: { qty: clamped },
    });
  };

  // Total count = sum of qty across all items (a line of qty=5 counts as 5).
  // This is what the user thinks of as “how many products on this shelf”.
  const totalQty = shelf.items.reduce((sum, it) => sum + (it.qty ?? 1), 0);

  // Sprint E.5 — move products between shelves with ↑/↓. Sort by height
  // ascending so ↑ = higher shelf and ↓ = lower shelf, matching the user's
  // mental model. Compute prev/next once so the per-row buttons stay cheap.
  const sortedShelves = [...selectedSection.shelves].sort((a, b) => a.hauteur_cm - b.hauteur_cm);
  const currentIdx = sortedShelves.findIndex((s) => s.id === shelf.id);
  const prevShelfId = currentIdx > 0 ? sortedShelves[currentIdx - 1].id : null;
  const nextShelfId = currentIdx < sortedShelves.length - 1 ? sortedShelves[currentIdx + 1].id : null;

  const moveProduct = (itemId: string, toShelfId: string | null): void => {
    if (!sectionId || !toShelfId) return;
    dispatch({ type: 'MOVE_PRODUCT', sectionId, itemId, toShelfId });
  };

  return (
    <div className="panel">
      <div className="panel__header">
        <div className="panel__title">
          <span style={{ color: selectedSection.color }}>●</span>
          {selectedSection.label} — Étagère {shelf.index + 1}
        </div>
        <p className="panel__desc">
          Hauteur: {shelf.hauteur_cm} cm · Capacité: {shelf.capacite ?? 12} articles
        </p>
        <div className="panel__tags">
          <span className="panel__tag" style={{ background: 'rgba(250,204,21,0.1)', color: '#FACC15' }}>
            {totalQty} / {shelf.capacite ?? 12} articles
          </span>
        </div>
      </div>

      <div className="panel__body">
        {/* Product list */}
        {shelf.items.length > 0 ? (
          <>
            <div className="section-label">Articles sur cette étagère</div>
            {shelf.items.map((item, i) => {
              const qty = item.qty ?? 1;
              return (
                <div key={item.id} className="product-item">
                  <div
                    className="product-item__index"
                    style={{ background: selectedSection.color }}
                  >
                    {i + 1}
                  </div>
                  <span className="product-item__name">{item.title}</span>
                  <div className="product-item__qty" role="group" aria-label={`Quantité de ${item.title}`}>
                    <button
                      type="button"
                      className="product-item__qty-btn"
                      onClick={() => updateQty(item.id, qty - 1)}
                      disabled={qty <= QTY_MIN}
                      aria-label="Diminuer la quantité"
                      title="Diminuer"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className="product-item__qty-input"
                      value={qty}
                      min={QTY_MIN}
                      max={QTY_MAX}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (Number.isFinite(n)) updateQty(item.id, n);
                      }}
                      aria-label="Quantité"
                    />
                    <button
                      type="button"
                      className="product-item__qty-btn"
                      onClick={() => updateQty(item.id, qty + 1)}
                      disabled={qty >= QTY_MAX}
                      aria-label="Augmenter la quantité"
                      title="Augmenter"
                    >
                      +
                    </button>
                  </div>
                  <div className="product-item__move" role="group" aria-label={`Déplacer ${item.title}`}>
                    <button
                      type="button"
                      className="product-item__move-btn"
                      onClick={() => moveProduct(item.id, prevShelfId)}
                      disabled={!prevShelfId}
                      title={prevShelfId ? 'Étagère supérieure' : 'Aucune étagère au-dessus'}
                      aria-label="Déplacer vers l'étagère supérieure"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="product-item__move-btn"
                      onClick={() => moveProduct(item.id, nextShelfId)}
                      disabled={!nextShelfId}
                      title={nextShelfId ? 'Étagère inférieure' : 'Aucune étagère en-dessous'}
                      aria-label="Déplacer vers l'étagère inférieure"
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    className="product-item__delete"
                    onClick={() => removeProduct(item.id)}
                    title="Supprimer"
                    aria-label={`Supprimer ${item.title}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </>
        ) : (
          <div className="empty-state" style={{ height: 'auto', padding: '24px 0' }}>
            <div className="empty-state__icon">📭</div>
            <div className="empty-state__text">Aucun article</div>
            <div className="empty-state__hint">Ajoutez des produits ci-dessous</div>
          </div>
        )}

        {/* Add product */}
        <div className="add-product">
          <div className="add-product__label">Ajouter un article</div>

          {suggestions.length > 0 && (
            <div className="add-product__suggestions">
              {suggestions
                .filter((s) => !shelf.items.some((it) => it.title === s))
                .slice(0, 8)
                .map((s) => (
                  <button key={s} className="add-product__chip" onClick={() => addProduct(s)}>
                    + {s}
                  </button>
                ))}
            </div>
          )}

          <form className="add-product__input-row" onSubmit={handleSubmit}>
            <input
              className="add-product__input"
              type="text"
              placeholder="Nom de l'article…"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <button className="add-product__submit" type="submit">
              Ajouter
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
