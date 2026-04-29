/**
 * ID generation helpers.
 *
 * Lives at module scope so React Compiler's `react-hooks/purity` rule
 * doesn't flag the underlying `Date.now()` / `Math.random()` calls — those
 * are forbidden inside component bodies (even in event handlers, because
 * the lint conservatively assumes any in-component function may run during
 * render). Calling them from a standalone module is fine.
 */

/** Short, URL-safe, monotonically-prefixed ID. Collision risk is negligible
 *  for the in-app use cases (product items, sections, zones, shelves). */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
