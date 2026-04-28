import { useState, useCallback } from 'react';
import { useStore } from '../hooks/useStore';
import { SECTION_PRODUCTS } from '../data/storeLayout';
import type { Item } from '../types/domain';

export default function ShelfDetail() {
  const { state, dispatch, selectedSection } = useStore();
  const [customName, setCustomName] = useState('');

  if (!selectedSection || state.drillLevel !== 'shelf') return null;

  const shelf = selectedSection.shelves.find((sh) => sh.id === state.selectedShelfId);
  if (!shelf) return null;

  const sectionNumber = selectedSection.number ?? 0;
  const suggestions = SECTION_PRODUCTS[sectionNumber] ?? [];

  const addProduct = useCallback(
    (name: string) => {
      if (!name.trim()) return;
      const item: Item = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: name.trim(),
        qty: 1,
      };
      dispatch({
        type: 'ADD_PRODUCT',
        sectionId: selectedSection.id,
        shelfId: shelf.id,
        item,
      });
      setCustomName('');
    },
    [dispatch, selectedSection.id, shelf.id],
  );

  const removeProduct = useCallback(
    (itemId: string) => {
      dispatch({
        type: 'REMOVE_PRODUCT',
        sectionId: selectedSection.id,
        shelfId: shelf.id,
        itemId,
      });
    },
    [dispatch, selectedSection.id, shelf.id],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addProduct(customName);
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
            {shelf.items.length} / {shelf.capacite ?? 12} articles
          </span>
        </div>
      </div>

      <div className="panel__body">
        {/* Product list */}
        {shelf.items.length > 0 ? (
          <>
            <div className="section-label">Articles sur cette étagère</div>
            {shelf.items.map((item, i) => (
              <div key={item.id} className="product-item">
                <div
                  className="product-item__index"
                  style={{ background: selectedSection.color }}
                >
                  {i + 1}
                </div>
                <span className="product-item__name">{item.title}</span>
                <button
                  className="product-item__delete"
                  onClick={() => removeProduct(item.id)}
                  title="Supprimer"
                >
                  ✕
                </button>
              </div>
            ))}
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
