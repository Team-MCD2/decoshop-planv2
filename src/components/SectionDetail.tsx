import { useStore } from '../hooks/useStore';

export default function SectionDetail() {
  const { state, dispatch, selectedSection } = useStore();

  if (!selectedSection || state.drillLevel !== 'section') return null;

  return (
    <div className="panel">
      <div className="panel__header">
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
            {selectedSection.shelves.length} étagère{selectedSection.shelves.length > 1 ? 's' : ''}
          </span>
          <span className="panel__tag" style={{ background: 'rgba(250,204,21,0.1)', color: '#FACC15' }}>
            {selectedSection.shelves.reduce((sum, sh) => sum + sh.items.length, 0)} article{selectedSection.shelves.reduce((sum, sh) => sum + sh.items.length, 0) !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="panel__body">
        <div className="section-label">Étagères</div>
        {selectedSection.shelves.map((shelf) => {
          const count = shelf.items.length;
          const cap = shelf.capacite ?? 12;
          const pct = Math.min(100, (count / cap) * 100);

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
      </div>
    </div>
  );
}
