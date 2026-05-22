/**
 * Shared Inspection / Customer / CompanyProfile types — kept in sync with
 * the mobile app's `src/types/index.ts`. Only the fields the web portal
 * actually reads are listed; the mobile app may store additional fields
 * inside the `data` jsonb that we don't bother to type here.
 */

export type PhotoSeverity = 'high' | 'medium' | 'low' | 'none';

export interface DrawingPath {
  id: string;
  shape: 'freehand' | 'rectangle' | 'circle' | 'arrow' | 'line';
  data: string;
  color: string;
  strokeWidth: number;
}

export interface InspectionPhoto {
  id: string;
  uri: string;
  takenAt: string;
  notes: string;
  severity: PhotoSeverity;
  drawings: DrawingPath[];
  drawingViewport?: { width: number; height: number };
  width?: number;
  height?: number;
  pixelsPerMeter?: number;
  damageTags?: string[];
  cloudUploaded?: boolean;
}

export interface QuoteLineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
}

export type PipelineStage =
  | 'lead'
  | 'inspected'
  | 'quoted'
  | 'accepted'
  | 'scheduled'
  | 'completed';

export const PIPELINE_STAGES: { value: PipelineStage; label: string; color: string }[] = [
  { value: 'lead',       label: 'Lead',       color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { value: 'inspected',  label: 'Inspected',  color: 'bg-sky-100 text-sky-800 border-sky-300' },
  { value: 'quoted',     label: 'Quoted',     color: 'bg-violet-100 text-violet-800 border-violet-300' },
  { value: 'accepted',   label: 'Accepted',   color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'scheduled',  label: 'Scheduled',  color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'completed',  label: 'Completed',  color: 'bg-green-100 text-green-800 border-green-300' },
];

export interface Inspection {
  id: string;
  customerId?: string;
  customerName: string;
  address: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  inspectorName?: string;
  date: string;
  notes?: string;
  photos: InspectionPhoto[];
  quoteItems?: QuoteLineItem[];
  quoteCurrency?: string;
  status?: 'draft' | 'sent' | 'approved' | 'archived';
  pipelineStage?: PipelineStage;
  scheduledAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityEntry {
  id: number;
  inspectionId: string;
  actorEmail: string | null;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface TrackingEvent {
  id: number;
  inspectionId: string;
  kind: 'pdf_view' | 'quote_view' | 'email_open' | 'quote_accepted';
  createdAt: string;
}

export interface WarrantyReminder {
  id: number;
  inspectionId: string;
  dueOn: string;
  reason: string;
  dismissedAt: string | null;
}

export type ShareRole = 'viewer' | 'editor' | 'admin';

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  postcode?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyProfile {
  name: string;
  shortName?: string;
  email?: string;
  tel?: string;
  address?: string;
  logoUri?: string;
  vatNumber?: string;
  updatedAt?: string;
  [key: string]: unknown;
}
