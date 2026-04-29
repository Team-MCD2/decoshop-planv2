import { useRef, useState } from 'react';
import { useStore } from '../hooks/useStore';
import { generateId } from '../lib/ids';
import { buildShelves } from '../data/storeLayout';
import type { Section } from '../types/domain';

export default function StructurePanel() {
  const { state, dispatch, selectedSection } = useStore();

  // Inline 2-step delete confirmation. `armedFor` holds the ID of the
  // section the user has armed for deletion (or null = nothing armed).
  // Storing the ID rather than a boolean means switching to a different
  // section auto-disarms via derived state — no useEffect needed (which
  // would trigger the `react-hooks/set-state-in-effect` lint).
  const [armedFor, setArmedFor] = useState<string | null>(null);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isArmed = armedFor !== null && armedFor === selectedSection?.id;

  if (state.mode !== 'structure') return null;

  const handleAddSection = () => {
    const newId = generateId('sec');
    dispatch({
      type: 'ADD_SECTION',
      section: {
        id: newId,
        label: 'Nouvelle Section',
        number: state.sections.length + 1,
        color: '#D4AF37',
        x: 1,
        y: 1,
        w: 1.5,
        h: 1.2,
        rotation: 0,
        // 4 default shelves at floor/low/mid/high — immediately usable.
        // Heights match the seed-data convention in `data/storeLayout.ts`.
        shelves: buildShelves(newId, [0, 60, 120, 180]),
      },
    });
    dispatch({ type: 'SELECT_SECTION', id: newId });
  };

  // Generic key/value typing — at every call site, `value` is checked
  // against `Section[K]` (so `'locked'` can only receive a boolean, etc.).
  // The `as Partial<Section>` cast on the dispatch payload is localised
  // here because TypeScript can't preserve a generic key's literal type
  // inside an object literal (see microsoft/TypeScript#13948).
  // Inputs bind directly to `selectedSection` — the dispatch updates the
  // reducer, which re-renders this panel with the fresh value. No staging
  // buffer needed; that was the source of the setState-in-effect lint.
  const handleChange = <K extends keyof Section>(key: K, value: Section[K]): void => {
    if (!selectedSection) return;
    dispatch({
      type: 'UPDATE_SECTION',
      id: selectedSection.id,
      updates: { [key]: value } as Partial<Section>,
    });
  };

  const handleDelete = () => {
    if (!selectedSection) return;
    if (!isArmed) {
      // First click — arm THIS section and auto-disarm after 3s.
      setArmedFor(selectedSection.id);
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
      armTimerRef.current = setTimeout(() => setArmedFor(null), 3000);
      return;
    }
    // Second click within 3s — actually delete.
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
    dispatch({ type: 'DELETE_SECTION', id: selectedSection.id });
    setArmedFor(null);
  };

  return (
    <div className="panel">
      <div className="panel__header">
        <div className="panel__title">Mode Structure</div>
        <p className="panel__desc">
          Ajoutez, déplacez, redimensionnez et tournez les sections.
        </p>
        <button
          onClick={handleAddSection}
          className="add-product__submit"
          style={{ width: '100%', marginTop: '12px' }}
        >
          + Nouvelle Section
        </button>
      </div>

      <div className="panel__body">
        {!selectedSection ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏗️</div>
            <div className="empty-state__text">Aucune section sélectionnée</div>
            <div className="empty-state__hint">
              Cliquez sur une section sur le plan pour la modifier.
            </div>
          </div>
        ) : (
          <div className="edit-form">
            <div className="section-label">Propriétés de la section</div>
            
            <div className="form-group">
              <label>Étiquette courte</label>
              <input
                type="text"
                className="add-product__input"
                value={selectedSection.label}
                onChange={(e) => handleChange('label', e.target.value)}
                placeholder="ex. Section 1"
              />
            </div>

            <div className="form-group">
              <label>Description (affichée sur le plan)</label>
              <input
                type="text"
                className="add-product__input"
                value={selectedSection.desc ?? ''}
                onChange={(e) => handleChange('desc', e.target.value)}
                placeholder="ex. Cuisine / Arts de la table"
              />
            </div>

            <div className="form-group">
              <label>Numéro</label>
              <input
                type="number"
                className="add-product__input"
                value={selectedSection.number ?? ''}
                onChange={(e) => handleChange('number', parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="form-group">
              <label>Couleur</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="color"
                  value={selectedSection.color || '#D4AF37'}
                  onChange={(e) => handleChange('color', e.target.value)}
                  style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  className="add-product__input"
                  value={selectedSection.color || ''}
                  onChange={(e) => handleChange('color', e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Largeur (m)</label>
                <input
                  type="number"
                  step="0.1"
                  className="add-product__input"
                  value={selectedSection.w}
                  onChange={(e) => handleChange('w', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Hauteur (m)</label>
                <input
                  type="number"
                  step="0.1"
                  className="add-product__input"
                  value={selectedSection.h}
                  onChange={(e) => handleChange('h', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Rotation (degrés)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={selectedSection.rotation ?? 0}
                  onChange={(e) => handleChange('rotation', parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ width: '40px', fontSize: '12px', textAlign: 'right' }}>{selectedSection.rotation ?? 0}°</span>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedSection.locked ?? false}
                  onChange={(e) => handleChange('locked', e.target.checked)}
                />
                Verrouiller la position
              </label>
            </div>

            <button
              onClick={handleDelete}
              className="product-item__delete"
              style={{
                width: '100%',
                height: '36px',
                marginTop: '24px',
                background: isArmed ? '#EF4444' : 'rgba(239, 68, 68, 0.1)',
                color: isArmed ? '#FFFFFF' : '#EF4444',
                borderRadius: '8px',
                fontWeight: isArmed ? 700 : 500,
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
            >
              {isArmed
                ? 'Cliquer à nouveau pour confirmer'
                : 'Supprimer la section'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
