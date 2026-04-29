/**
 * One-shot onboarding hint shown at the top of the canvas on first visit.
 *
 * Boss's mandate: the end-user must understand the app without explanation.
 * This banner explains the core gesture (click a section → see shelves)
 * with two short, scannable lines. Dismissible via the × button.
 *
 * Tracked in localStorage under `decoshop-plan-v2:onboarding-seen`. Never
 * shows again after the user dismisses it on a given device.
 */

import { useState } from 'react';
import { useStore } from '../hooks/useStore';

const STORAGE_KEY = 'decoshop-plan-v2:onboarding-seen';

export default function OnboardingHint() {
  const { state } = useStore();

  // Lazy init reads localStorage exactly once on mount — no effect needed.
  // `dismissed=true` means the user has clicked the × button on this device.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  });

  // Hide via derived state when the user drills into a section — the hint
  // is for the store-level view only. If they navigate back to store and
  // haven't explicitly dismissed it yet, it reappears (still helpful).
  if (dismissed) return null;
  if (state.drillLevel !== 'store') return null;

  const dismiss = (): void => {
    setDismissed(true);
    window.localStorage.setItem(STORAGE_KEY, '1');
  };

  const message = state.mode === 'inventory'
    ? 'Cliquez sur une section colorée pour voir ses étagères et gérer ses articles.'
    : 'Cliquez sur une section pour la sélectionner, puis glissez pour la déplacer ou la redimensionner.';

  return (
    <div className="onboarding-hint" role="status">
      <span className="onboarding-hint__icon" aria-hidden>👆</span>
      <span className="onboarding-hint__text">{message}</span>
      <button
        type="button"
        className="onboarding-hint__close"
        onClick={dismiss}
        aria-label="Fermer le tutoriel"
        title="J'ai compris"
      >
        ×
      </button>
    </div>
  );
}
