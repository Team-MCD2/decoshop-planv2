import { useEffect } from 'react';
import { StoreProvider, useStore } from './hooks/useStore';
import Header from './components/Header';
import Breadcrumb from './components/Breadcrumb';
import FloorPlan from './components/FloorPlan';
import SectionDetail from './components/SectionDetail';
import ShelfDetail from './components/ShelfDetail';
import StructurePanel from './components/StructurePanel';
import OnboardingHint from './components/OnboardingHint';
import ErrorBoundary from './components/ErrorBoundary';

function AppContent() {
  const { state, dispatch } = useStore();

  const showInventoryPanel = state.drillLevel === 'section' || state.drillLevel === 'shelf';

  // Global keyboard nav: Escape and Backspace drill back one level.
  // - Skipped while the user is typing in an input/textarea/contenteditable
  //   so editing labels/numbers/etc. doesn't bail out of their work.
  // - No-op at the 'store' level (already at the top).
  useEffect(() => {
    const isEditableTarget = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      if (state.drillLevel === 'store') return;
      if (e.key !== 'Escape' && e.key !== 'Backspace') return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      dispatch({ type: 'DRILL_BACK' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.drillLevel, dispatch]);

  return (
    <div className="app">
      <Header />
      <Breadcrumb />
      <OnboardingHint />
      <div className="app__main">
        <FloorPlan />
        {state.mode === 'structure' && <StructurePanel />}
        {state.mode === 'inventory' && showInventoryPanel && state.drillLevel === 'section' && <SectionDetail />}
        {state.mode === 'inventory' && showInventoryPanel && state.drillLevel === 'shelf' && <ShelfDetail />}
        {state.mode === 'inventory' && !showInventoryPanel && (
          <div className="panel">
            <div className="empty-state">
              <div className="empty-state__icon">👆</div>
              <div className="empty-state__text">
                Cliquez sur une section pour voir ses étagères
              </div>
              <div className="empty-state__hint">
                Mode Inventaire — gérez les articles par section et étagère
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </ErrorBoundary>
  );
}
