/**
 * Server-side data access helpers. Each function uses the cookie-bound
 * Supabase client so the row-level security policies (`user_id = auth.uid()`,
 * plus the `_shared` policies that grant access to data owned by users who
 * have invited the current user via `account_shares`) automatically scope
 * results.
 *
 * Because the result set may include both rows the user owns AND rows shared
 * with them by other users, every record carries its owning `userId` so
 * callers can build the correct Storage path for photos
 * (`<owner_user_id>/<photo_id>.jpg`).
 */
import { createClient } from '@/lib/supabase/server';
import type { Inspection, Customer, CompanyProfile } from './types';

export interface OwnedInspection { inspection: Inspection; ownerId: string }
export interface OwnedCustomer { customer: Customer; ownerId: string }

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function listInspections(): Promise<OwnedInspection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('inspections')
    .select('id, user_id, data, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    inspection: row.data as Inspection,
    ownerId: row.user_id as string,
  }));
}

export async function getInspection(id: string): Promise<OwnedInspection | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('inspections')
    .select('user_id, data')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { inspection: data.data as Inspection, ownerId: data.user_id as string };
}

export async function listCustomers(): Promise<OwnedCustomer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .select('id, user_id, data, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    customer: row.data as Customer,
    ownerId: row.user_id as string,
  }));
}

export async function getCompanyProfile(ownerId?: string): Promise<CompanyProfile | null> {
  const supabase = await createClient();
  let q = supabase.from('company_profiles').select('data');
  if (ownerId) q = q.eq('user_id', ownerId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as CompanyProfile | undefined) ?? null;
}

/** Build a 5-minute signed URL for a photo stored in the `photos` bucket. */
export async function signPhotoUrl(ownerId: string, photoId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(`${ownerId}/${photoId}.jpg`, 60 * 5);
  if (error) return null;
  return data?.signedUrl ?? null;
}
