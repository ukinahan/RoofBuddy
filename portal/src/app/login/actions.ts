'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Send a 6/8-digit OTP code to the user's email. Same flow the mobile app
 * uses (Supabase auth `signInWithOtp` with `shouldCreateUser: true`).
 */
export async function sendCode(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { ok: false, error: 'Email is required.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Verify the OTP code the user typed. On success, Supabase sets the auth
 * cookies via the SSR helpers and we redirect to the dashboard.
 */
export async function verifyCode(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const email = String(formData.get('email') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  const next = String(formData.get('next') ?? '/');

  if (!email || !code) return { ok: false, error: 'Email and code are required.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) return { ok: false, error: error.message };

  redirect(next || '/');
}
