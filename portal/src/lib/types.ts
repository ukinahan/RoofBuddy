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
  createdAt?: string;
  updatedAt?: string;
}

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
