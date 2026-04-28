import { useStore } from '../hooks/useStore';

export default function Breadcrumb() {
  const { state, dispatch, selectedSection } = useStore();

  if (state.drillLevel === 'store') return null;

  const shelf = state.drillLevel === 'shelf' && selectedSection
    ? selectedSection.shelves.find((sh) => sh.id === state.selectedShelfId) ?? null
    : null;

  return (
    <nav className="breadcrumb">
      <button className="breadcrumb__item breadcrumb__item--link" onClick={() => dispatch({ type: 'DRILL_HOME' })}>
        🏪 Magasin
      </button>

      {selectedSection && (
        <>
          <span className="breadcrumb__sep">›</span>
          <button
            className={`breadcrumb__item ${state.drillLevel === 'section' ? 'breadcrumb__item--active' : 'breadcrumb__item--link'}`}
            onClick={() => state.drillLevel === 'shelf' ? dispatch({ type: 'DRILL_BACK' }) : undefined}
          >
            {selectedSection.label}
          </button>
        </>
      )}

      {shelf && (
        <>
          <span className="breadcrumb__sep">›</span>
          <span className="breadcrumb__item breadcrumb__item--active">
            Étagère {shelf.index + 1}
          </span>
        </>
      )}
    </nav>
  );
}
