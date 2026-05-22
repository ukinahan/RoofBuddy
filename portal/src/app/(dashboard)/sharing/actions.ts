'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ShareRow = {
  member_user_id: string;
  member_email: string;
  role: 'viewer' | 'editor' | 'admin';
  created_at: string;
};

export async function listShares(): Promise<{ shares: ShareRow[]; migrationMissing: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_my_shares');
  if (error) {
    // Detect "function does not exist" / missing object errors so the page
    // can show a friendly "run the migration" message instead of crashing.
    const msg = error.message ?? '';
    const missing =
      /(list_my_shares|my_shares)/i.test(msg) &&
      (/does not exist/i.test(msg) || /not found/i.test(msg) || error.code === '42883' || error.code === '42P01' || error.code === 'PGRST202' || error.code === 'PGRST205');
    if (missing) return { shares: [], migrationMissing: true, error: msg };
    return { shares: [], migrationMissing: false, error: msg };
  }
  return { shares: (data ?? []) as ShareRow[], migrationMissing: false };
}

export async function inviteShare(formData: FormData): Promise<{ ok: boolean; status?: string; error?: string }> {
  const email = String(formData.get('email') ?? '').trim();
  const role = String(formData.get('role') ?? 'editor') as 'viewer' | 'editor' | 'admin';
  if (!email) return { ok: false, error: 'Email is required.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('share_with_email', {
    member_email: email,
    member_role: role,
  });
  if (error) return { ok: false, error: error.message };

  const status = (data as Array<{ status: string }> | null)?.[0]?.status;
  if (status !== 'ok') {
    const msg =
      status === 'not_registered'
        ? `${email} hasn't signed in to the portal yet. Ask them to visit https://admin.roofinspector.app and sign in once with this email, then try again.`
        : status === 'self'
        ? "You can't share your account with yourself."
        : status === 'unauthorized'
        ? 'You need to be signed in to invite someone.'
        : status === 'invalid_role'
        ? 'Invalid role.'
        : `Could not grant access (${status}).`;
    return { ok: false, status, error: msg };
  }

  revalidatePath('/sharing');
  return { ok: true, status };
}

export async function revokeShare(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const memberId = String(formData.get('memberId') ?? '');
  if (!memberId) return { ok: false, error: 'Missing member id.' };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('account_shares')
    .delete()
    .eq('owner_user_id', userData.user.id)
    .eq('member_user_id', memberId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/sharing');
  return { ok: true };
}
