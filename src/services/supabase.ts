/**
 * Supabase client wrapper. Cloud sync is OPT-IN — when SUPABASE_URL and
 * SUPABASE_ANON_KEY are not set, `supabase` is null and the rest of the app
 * keeps working in offline-only mode.
 *
 * Status: SCAFFOLDING ONLY. Sign-in UI is wired up but actual data push/pull
 * is not implemented yet. See sync.ts.
 */
import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

const SUPABASE_URL = extra.supabaseUrl ?? '';
const SUPABASE_ANON_KEY = extra.supabaseAnonKey ?? '';

export const isSupabaseConfigured = (): boolean =>
  !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage as any,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.email ?? null;
}

export async function signInWithMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Cloud sync is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to your build.' };
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function verifyOtpCode(email: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Cloud sync is not configured.' };
  const { error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}
