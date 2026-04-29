/**
 * Supabase client singleton for DecoShop Plan V2.
 *
 * The client is created even when env vars are missing (with empty strings)
 * so all type-level imports keep working. The `hasSupabaseConfig` flag lets
 * the data-access layer skip RPC calls cleanly when the env isn't set —
 * we fall back to localStorage instead of throwing on every save.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl    = (import.meta.env.VITE_SUPABASE_URL    as string | undefined) ?? '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

/** True iff both env vars are populated (non-empty strings). */
export const hasSupabaseConfig: boolean = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig && typeof console !== 'undefined') {
  console.warn(
    '[DecoShop] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Running in localStorage-only mode — see .env.example.',
  );
}

// `createClient` accepts empty strings without throwing; the actual
// network call is what fails. The data-access layer guards on
// `hasSupabaseConfig` before issuing RPCs.
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://invalid.supabase.co',
  supabaseAnonKey || 'invalid',
);
