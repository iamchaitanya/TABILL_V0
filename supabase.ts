import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Defaults keep cloud sync working even when the build has no `.env` (for
 * example a CI or Git-connected deployment). The publishable key is designed to
 * be public — RLS is what protects the data. Set the VITE_ vars to override.
 */
const DEFAULT_URL = 'https://gwyqvxqfgauxnungmutg.supabase.co';
const DEFAULT_ANON_KEY = 'sb_publishable_n1lVbkn7i64IhO0N_G-7Zg_-PIQMKHF';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || DEFAULT_ANON_KEY;

/** True when build-time Supabase env vars are present. */
export const isCloudConfigured = Boolean(url && anonKey);

/**
 * Browser client. Uses the *publishable* key only — Row Level Security is what
 * protects the data. A secret/service_role key must never reach this bundle.
 */
export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'iotabill_auth',
      },
    })
  : null;

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
}

/**
 * Google's own client ID, shared with the Supabase Google provider. Used by
 * Google Identity Services so the consent screen shows this app instead of the
 * Supabase redirect domain.
 */
export const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ||
  '995880603989-fvbccu5c1d376siq5kh5f75tkb41j9ns.apps.googleusercontent.com';

/**
 * Exchanges a Google ID token (from Google Identity Services) for a Supabase
 * session. No redirect to `*.supabase.co` is involved.
 */
export async function signInWithGoogleIdToken(idToken: string): Promise<void> {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw error;
}

export async function signOutCloud(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
