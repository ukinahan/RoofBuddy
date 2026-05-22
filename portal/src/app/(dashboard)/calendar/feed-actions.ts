'use server';
import { createClient } from '@/lib/supabase/server';

export async function getCalendarFeedToken(): Promise<{ token: string | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_or_create_calendar_token');
  if (error) return { token: null, error: error.message };
  return { token: (data as string | null) ?? null };
}
