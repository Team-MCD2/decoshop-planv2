/**
 * Top-level error boundary.
 *
 * Catches render-time errors anywhere in the React tree below it and shows
 * a friendly fallback panel with:
 *   - A short, user-readable message in French (boss's audience).
 *   - A "Recharger" button that hard-reloads the page.
 *   - A collapsible technical details section (shown only in dev).
 *
 * Boss's mandate: a single buggy section must never leave the user staring
 * at a blank screen. localStorage is preserved across reloads, so the user
 * loses no work.
 *
 * Implemented as a class component because React 19 still requires that
 * for `getDerivedStateFromError` / `componentDidCatch`. There is no hook
 * equivalent in the public API yet.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to console for dev visibility. In production we'd ship this to a
    // monitoring service; for V2 simplicity we keep it local.
    console.error('[ErrorBoundary] React tree crashed:', error, info);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    const isDev = import.meta.env.DEV;
    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary__card">
          <div className="error-boundary__icon" aria-hidden>⚠️</div>
          <h1 className="error-boundary__title">Une erreur est survenue</h1>
          <p className="error-boundary__message">
            L&apos;application a rencontré un problème inattendu. Vos données
            sont sauvegardées en local — rechargez la page pour continuer.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="error-boundary__reload"
          >
            Recharger la page
          </button>
          {isDev && (
            <details className="error-boundary__details">
              <summary>Détails techniques (dev)</summary>
              <pre className="error-boundary__stack">
{this.state.error.message}
{this.state.error.stack ?? ''}
{this.state.componentStack ?? ''}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
