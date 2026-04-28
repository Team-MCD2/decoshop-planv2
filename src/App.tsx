import { StoreProvider, useStore } from './hooks/useStore';
import Header from './components/Header';
import Breadcrumb from './components/Breadcrumb';
import FloorPlan from './components/FloorPlan';
import SectionDetail from './components/SectionDetail';
import ShelfDetail from './components/ShelfDetail';

function AppContent() {
  const { state } = useStore();

  const showPanel = state.drillLevel === 'section' || state.drillLevel === 'shelf';

  return (
    <div className="app">
      <Header />
      <Breadcrumb />
      <div className="app__main">
        <FloorPlan />
        {showPanel && state.drillLevel === 'section' && <SectionDetail />}
        {showPanel && state.drillLevel === 'shelf' && <ShelfDetail />}
        {!showPanel && state.mode === 'inventory' && (
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
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
