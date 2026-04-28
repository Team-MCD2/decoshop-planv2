import { useStore } from '../hooks/useStore';
import type { AppMode } from '../types/domain';

export default function Header() {
  const { state, dispatch } = useStore();

  const setMode = (mode: AppMode) => dispatch({ type: 'SET_MODE', mode });

  return (
    <header className="header">
      <div className="header__brand">
        <img
          className="header__logo"
          src="/apple-touch-icon.png"
          alt="DecoShop"
          width={36}
          height={36}
        />
        <div>
          <div className="header__title">DecoShop Toulouse</div>
          <div className="header__subtitle">Plan du magasin</div>
        </div>
      </div>

      <div className="mode-toggle">
        <button
          className={`mode-toggle__btn ${state.mode === 'structure' ? 'mode-toggle__btn--active' : ''}`}
          onClick={() => setMode('structure')}
        >
          <span className="mode-toggle__icon">🏗️</span>
          Structure
        </button>
        <button
          className={`mode-toggle__btn ${state.mode === 'inventory' ? 'mode-toggle__btn--active' : ''}`}
          onClick={() => setMode('inventory')}
        >
          <span className="mode-toggle__icon">📦</span>
          Inventaire
        </button>
      </div>
    </header>
  );
}
