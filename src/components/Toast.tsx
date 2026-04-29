import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ToastContext } from '../hooks/useToast';

/**
 * Lightweight global toast system.
 *
 * - Single message slot (latest replaces previous).
 * - Auto-dismisses after `TOAST_MS` ms.
 * - One pill rendered at the bottom-center of the viewport.
 *
 * The context + `useToast` hook live in `src/hooks/useToast.tsx` because
 * the `react-refresh/only-export-components` rule requires that a `*.tsx`
 * file exporting a hook not also export components.
 *
 * Why no `useCallback` on `showToast`: this project uses React Compiler,
 * and the `react-hooks/preserve-manual-memoization` rule forbids manual
 * memoization. A new function identity per render is fine here because no
 * consumer puts `showToast` in an effect dep array — they call it from
 * event handlers.
 */
const TOAST_MS = 2500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  // Bumped on every showToast() so a rapid second call retriggers the
  // CSS slide-in animation even when the message text is identical.
  const [revision, setRevision] = useState(0);
  const timerRef = useRef<number | null>(null);

  const showToast = (msg: string): void => {
    if (!msg) return;
    setMessage(msg);
    setRevision((r) => r + 1);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setMessage(null);
      timerRef.current = null;
    }, TOAST_MS);
  };

  // Clear the timer if the provider unmounts mid-toast.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <div
          className="toast"
          role="status"
          aria-live="polite"
          // The keyed div forces React to remount on every revision so
          // the slide-in animation replays even for repeated identical text.
          key={revision}
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

