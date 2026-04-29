import { createContext, useContext } from 'react';

/** Shape of the toast API surface — kept tiny so we don't accidentally
 *  grow this into a notifications system. One pill at a time. */
export interface ToastContextValue {
  showToast: (message: string) => void;
}

/**
 * Toast context. Lives in `src/hooks/` (not `src/components/`) because
 * `react-refresh/only-export-components` requires that any `*.tsx` file
 * exporting a hook NOT also export components — co-locating the hook with
 * its provider would prevent fast-refresh from working cleanly.
 *
 * The provider component lives in `src/components/Toast.tsx` and imports
 * this context.
 */
export const ToastContext = createContext<ToastContextValue | null>(null);

/** Access the toast API from any descendant of `<ToastProvider>`. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
