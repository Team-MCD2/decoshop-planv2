import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import {
  createDefaultShelf,
  MAX_SHELF_HEIGHT_CM,
  MIN_SHELF_HEIGHT_CM,
  MIN_SHELF_CAPACITY,
  MAX_SHELF_CAPACITY,
  MAX_SHELVES_PER_SECTION,
} from '../data/storeLayout';

export default function SectionDetail() {
  const { state, dispatch, selectedSection } = useStore();
  // "Edit shelves" toggle. When on, the list switches to editable forms
  // (height/capacity inputs + delete) and the click-to-drill is disabled.
  const [editing, setEditing] = useState<boolean>(false);

  if (!selectedSection || state.drillLevel !== 'section') return null;

  const shelfCount = selectedSection.shelves.length;
  const totalQty = selectedSection.shelves.reduce(
    (sum, sh) => sum + sh.items.reduce((s, it) => s + (it.qty ?? 1), 0),
    0,
  );
  const canAddShelf = shelfCount < MAX_SHELVES_PER_SECTION;

  const handleAddShelf = (): void => {
    if (!canAddShelf) return;
    dispatch({
      type: 'ADD_SHELF',
      sectionId: selectedSection.id,
      shelf: createDefaultShelf(selectedSection),
    });
  };

  const handleRemoveShelf = (shelfId: string): void => {
    dispatch({ type: 'REMOVE_SHELF', sectionId: selectedSection.id, shelfId });
  };

  const handleUpdateShelf = (
    shelfId: string,
    key: 'hauteur_cm' | 'capacite',
    raw: string,
  ): void => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return;
    const clamped = key === 'hauteur_cm'
      ? Math.max(MIN_SHELF_HEIGHT_CM, Math.min(MAX_SHELF_HEIGHT_CM, n))
      : Math.max(MIN_SHELF_CAPACITY, Math.min(MAX_SHELF_CAPACITY, n));
    dispatch({
      type: 'UPDATE_SHELF',
      sectionId: selectedSection.id,
      shelfId,
      updates: { [key]: clamped },
    });
  };

  // Sort shelves by height (ascending) for stable display in edit mode.
  // We don't mutate the underlying array — just sort the rendered slice.
  const displayShelves = editing
    ? [...selectedSection.shelves].sort((a, b) => a.hauteur_cm - b.hauteur_cm)
    : selectedSection.shelves;

  return (
    <div className="panel">
      <div className="panel__header">
        <button
          type="button"
          className="panel__close"
          aria-label="Fermer"
          title="Fermer"
          onClick={() => dispatch({ type: 'DRILL_BACK' })}
        >✕</button>
        <div className="panel__title">
          <span style={{ color: selectedSection.color }}>●</span>
          {selectedSection.label}
        </div>
        {selectedSection.desc && (
          <p className="panel__desc">{selectedSection.desc}</p>
        )}
        <div className="panel__tags">
          <span
            className="panel__tag"
            style={{ background: `${selectedSection.color}22`, color: selectedSection.color }}
          >
            {shelfCount} étagère{shelfCount > 1 ? 's' : ''}
          </span>
          <span className="panel__tag" style={{ background: 'rgba(250,204,21,0.1)', color: '#FACC15' }}>
            {totalQty} article{totalQty !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="panel__body">
        <div className="section-label section-label--with-action">
          <span>Étagères</span>
          <button
            type="button"
            className={`section-label__toggle${editing ? ' section-label__toggle--active' : ''}`}
            onClick={() => setEditing((v) => !v)}
            title={editing ? 'Terminer l’édition' : 'Modifier les étagères (hauteur, capacité, ajout/suppression)'}
          >
            {editing ? '✓ Terminé' : '✎ Édition'}
          </button>
        </div>

        {shelfCount === 0 && !editing && (
          <div className="empty-state" style={{ height: 'auto', padding: '24px 0' }}>
            <div className="empty-state__icon">📚</div>
            <div className="empty-state__text">Aucune étagère</div>
            <div className="empty-state__hint">
              Cliquez sur « ✎ Édition » pour en ajouter.
            </div>
          </div>
        )}

        {displayShelves.map((shelf) => {
          const count = shelf.items.reduce((s, it) => s + (it.qty ?? 1), 0);
          const cap = shelf.capacite ?? 12;
          const pct = Math.min(100, (count / cap) * 100);

          if (editing) {
            return (
              <div key={shelf.id} className="shelf-row shelf-row--editing">
                <div className="shelf-row__icon">📦</div>
                <div className="shelf-row__info">
                  <div className="shelf-row__title">
                    Étagère {shelf.index + 1}
                  </div>
                  <div className="shelf-row__edit-fields">
                    <label className="shelf-row__edit-label">
                      <span>Hauteur</span>
                      <input
                        type="number"
                        className="shelf-row__edit-input"
                        value={shelf.hauteur_cm}
                        min={MIN_SHELF_HEIGHT_CM}
                        max={MAX_SHELF_HEIGHT_CM}
                        step={1}
                        onChange={(e) => handleUpdateShelf(shelf.id, 'hauteur_cm', e.target.value)}
                      />
                      <span className="shelf-row__edit-unit">cm</span>
                    </label>
                    <label className="shelf-row__edit-label">
                      <span>Capacité</span>
                      <input
                        type="number"
                        className="shelf-row__edit-input"
                        value={cap}
                        min={MIN_SHELF_CAPACITY}
                        max={MAX_SHELF_CAPACITY}
                        step={1}
                        onChange={(e) => handleUpdateShelf(shelf.id, 'capacite', e.target.value)}
                      />
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  className="product-item__delete"
                  onClick={() => handleRemoveShelf(shelf.id)}
                  title={`Supprimer l’étagère ${shelf.index + 1}`}
                  aria-label={`Supprimer l’étagère ${shelf.index + 1}`}
                >
                  ✕
                </button>
              </div>
            );
          }

          return (
            <div
              key={shelf.id}
              className="shelf-row"
              onClick={() => dispatch({ type: 'SELECT_SHELF', id: shelf.id })}
            >
              <div className="shelf-row__icon">📦</div>
              <div className="shelf-row__info">
                <div className="shelf-row__title">
                  Étagère {shelf.index + 1}
                </div>
                <div className="shelf-row__sub">
                  Hauteur: {shelf.hauteur_cm} cm
                </div>
                <div className="shelf-row__bar">
                  <div className="shelf-row__bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="shelf-row__count">
                {count}/{cap}
              </div>
              <span className="shelf-row__arrow">→</span>
            </div>
          );
        })}

        {editing && (
          <button
            type="button"
            className="add-product__submit"
            style={{ width: '100%', marginTop: '12px' }}
            onClick={handleAddShelf}
            disabled={!canAddShelf}
            title={canAddShelf
              ? 'Ajouter une étagère'
              : `Maximum ${MAX_SHELVES_PER_SECTION} étagères par section`}
          >
            + Ajouter une étagère
          </button>
        )}
      </div>
    </div>
  );
}
