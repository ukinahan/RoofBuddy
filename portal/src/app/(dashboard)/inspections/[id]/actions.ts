'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Inspection } from '@/lib/types';

export async function saveInspection(insp: Inspection): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Not signed in.' };

  const stamped: Inspection = { ...insp, updatedAt: new Date().toISOString() };

  // Look up the existing row's owner so an assistant editing a shared
  // inspection doesn't accidentally re-parent it to themselves.
  const { data: existing } = await supabase
    .from('inspections')
    .select('user_id')
    .eq('id', insp.id)
    .maybeSingle();

  const ownerId: string = (existing?.user_id as string | undefined) ?? userData.user.id;

  const { error } = await supabase
    .from('inspections')
    .upsert(
      {
        id: insp.id,
        user_id: ownerId,
        data: stamped,
        updated_at: stamped.updatedAt,
      },
      { onConflict: 'id' },
    );

  if (error) return { ok: false, error: error.message };

  revalidatePath('/');
  revalidatePath(`/inspections/${insp.id}`);
  return { ok: true };
}
