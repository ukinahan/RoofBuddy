/**
 * Server helpers for the portal-only features built on migration 005:
 * pipeline stages, scheduling, activity log, tracking events, warranty
 * reminders, public-quote tokens, and global search.
 */
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
  ActivityEntry,
  Inspection,
  PipelineStage,
  TrackingEvent,
  WarrantyReminder,
} from './types';

interface InspectionRow {
  id: string;
  user_id: string;
  data: Inspection;
  updated_at: string;
  pipeline_stage: PipelineStage | null;
  scheduled_at: string | null;
  completed_at: string | null;
  latitude: number | null;
  longitude: number | null;
  customer_name: string | null;
  address: string | null;
  quote_total: number | null;
}

export interface InspectionSummary {
  id: string;
  ownerId: string;
  customerName: string;
  address: string;
  date: string;
  pipelineStage: PipelineStage;
  scheduledAt: string | null;
  completedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  quoteTotal: number | null;
  currency: string;
  photoCount: number;
}

function toSummary(row: InspectionRow): InspectionSummary {
  const d = row.data ?? ({} as Inspection);
  return {
    id: row.id,
    ownerId: row.user_id,
    customerName: row.customer_name ?? d.customerName ?? '',
    address: row.address ?? d.address ?? '',
    date: d.date,
    pipelineStage: (row.pipeline_stage ?? d.pipelineStage ?? 'inspected') as PipelineStage,
    scheduledAt: row.scheduled_at,
    completedAt: row.completed_at,
    latitude: row.latitude,
    longitude: row.longitude,
    quoteTotal: row.quote_total,
    currency: d.quoteCurrency ?? 'EUR',
    photoCount: d.photos?.length ?? 0,
  };
}

export async function listInspectionSummaries(): Promise<InspectionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('inspections')
    .select(
      'id, user_id, data, updated_at, pipeline_stage, scheduled_at, completed_at, latitude, longitude, customer_name, address, quote_total',
    )
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as InspectionRow[] | null ?? []).map(toSummary);
}

/** Update just the pipeline stage (used by the board's drag-and-drop). */
export async function setInspectionStage(id: string, stage: PipelineStage) {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('inspections')
    .select('data')
    .eq('id', id)
    .maybeSingle();
  if (!row) return { ok: false, error: 'not_found' };
  const next: Inspection = {
    ...((row.data as Inspection) ?? {}),
    pipelineStage: stage,
    completedAt:
      stage === 'completed'
        ? (row.data as Inspection).completedAt ?? new Date().toISOString()
        : (row.data as Inspection).completedAt,
  };
  const { error } = await supabase
    .from('inspections')
    .update({ data: next, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/pipeline');
  revalidatePath('/');
  revalidatePath('/calendar');
  return { ok: true };
}

/** Update / clear the scheduled-at date for an inspection. */
export async function setInspectionSchedule(id: string, scheduledAt: string | null) {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('inspections')
    .select('data')
    .eq('id', id)
    .maybeSingle();
  if (!row) return { ok: false, error: 'not_found' };
  const current = row.data as Inspection;
  const next: Inspection = {
    ...current,
    scheduledAt: scheduledAt ?? undefined,
    pipelineStage:
      scheduledAt && (current.pipelineStage === 'accepted' || !current.pipelineStage)
        ? 'scheduled'
        : current.pipelineStage,
  };
  const { error } = await supabase
    .from('inspections')
    .update({ data: next, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/calendar');
  revalidatePath('/pipeline');
  return { ok: true };
}

export async function listActivity(inspectionId: string): Promise<ActivityEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('inspection_activity')
    .select('id, inspection_id, actor_email, action, details, created_at')
    .eq('inspection_id', inspectionId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id as number,
    inspectionId: r.inspection_id as string,
    actorEmail: r.actor_email as string | null,
    action: r.action as string,
    details: (r.details as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
  }));
}

export async function listTrackingEvents(inspectionId: string): Promise<TrackingEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tracking_events')
    .select('id, inspection_id, kind, created_at')
    .eq('inspection_id', inspectionId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id as number,
    inspectionId: r.inspection_id as string,
    kind: r.kind as TrackingEvent['kind'],
    createdAt: r.created_at as string,
  }));
}

export async function listWarrantyReminders(): Promise<WarrantyReminder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('warranty_reminders')
    .select('id, inspection_id, due_on, reason, dismissed_at')
    .order('due_on', { ascending: true });
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id as number,
    inspectionId: r.inspection_id as string,
    dueOn: r.due_on as string,
    reason: r.reason as string,
    dismissedAt: r.dismissed_at as string | null,
  }));
}

export async function dismissWarrantyReminder(id: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('warranty_reminders')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/warranty');
  return { ok: true };
}

/** Create (or reuse) a public quote token. */
export async function createPublicQuoteToken(
  inspectionId: string,
): Promise<{ token: string } | { error: string }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('public_quote_tokens')
    .select('token')
    .eq('inspection_id', inspectionId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.token) return { token: existing.token as string };
  const { data: userData } = await supabase.auth.getUser();
  const { data: row } = await supabase
    .from('inspections')
    .select('user_id')
    .eq('id', inspectionId)
    .maybeSingle();
  if (!row || !userData.user) return { error: 'not_found' };
  const { data, error } = await supabase
    .from('public_quote_tokens')
    .insert({ inspection_id: inspectionId, owner_user_id: row.user_id })
    .select('token')
    .single();
  if (error) return { error: error.message };
  return { token: data.token as string };
}
