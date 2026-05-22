'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function acceptQuote(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!token || !name) return { ok: false, error: 'Please type your name to accept.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('accept_public_quote', {
    p_token: token,
    p_name: name,
  });
  if (error) return { ok: false, error: error.message };
  if (data !== true) {
    return { ok: false, error: 'This quote has already been accepted or the link has expired.' };
  }
  revalidatePath(`/quote/${token}`);
  return { ok: true };
}
