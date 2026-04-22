// ─── Annotation ─────────────────────────────────────────────────────────────
export interface Annotation {
  id: string;
  /** Horizontal position as a fraction of the image width (0.0 – 1.0) */
  x: number;
  /** Vertical position as a fraction of the image height (0.0 – 1.0) */
  y: number;
  note: string;
  severity: 'low' | 'medium' | 'high';
  createdAt: string;
}

// ─── Drawing ─────────────────────────────────────────────────────────────────
export type DrawingShape = 'freehand' | 'rectangle' | 'circle' | 'arrow';

export interface DrawingPath {
  id: string;
  shape: DrawingShape;
  /** SVG path data string (freehand) or encoded rect/circle params */
  data: string;
  color: string;
  strokeWidth: number;
  createdAt: string;
}

// ─── Photo ───────────────────────────────────────────────────────────────────
export type PhotoSeverity = 'none' | 'low' | 'medium' | 'high';

export interface InspectionPhoto {
  id: string;
  /** Local file URI saved by expo-file-system */
  uri: string;
  /** ISO datetime the photo was captured */
  takenAt: string;
  /** Free-text notes typed by the inspector for this photo */
  notes: string;
  /** Overall severity rating for this photo */
  severity: PhotoSeverity;
  annotations: Annotation[];
  drawings: DrawingPath[];
  /** Pixel dimensions of the drawing canvas when drawings were made */
  drawingViewport?: { width: number; height: number };
}

// ─── Quote ───────────────────────────────────────────────────────────────────
export interface QuoteLineItem {
  id: string;
  /** Free-text quantity, e.g. "104 m²", "1 No.", "Allow" */
  qty: string;
  /** Multi-line description of the work */
  description: string;
  /** Total price for this line (ex-VAT) */
  totalPrice: number;
}

export interface Quote {
  lineItems: QuoteLineItem[];
}

// ─── Inspection ──────────────────────────────────────────────────────────────
export interface Inspection {
  id: string;
  customerName: string;
  customerEmail: string;
  address: string;
  /** Free-text job reference, e.g. "Castlemartyr Golf Clubhouse" */
  ref: string;
  /** ISO date (YYYY-MM-DD) */
  date: string;
  /** General notes about the entire inspection */
  notes: string;
  inspectorName: string;

  // ── Project Overview fields (appear on Page 2 of the report) ─────────────
  /** Weather conditions during the survey e.g. "Cloudy and Dry" */
  conditions: string;
  /** Scope of works e.g. "Roof Survey" */
  scopeOfWorks: string;
  /** Brief overview / reason for survey */
  overview: string;
  /** Report reference number e.g. "01" */
  reportNo: string;

  // ── Conclusion (last page of the report) ──────────────────────────────────
  conclusion: string;
  /** Cost of repairs ex-VAT */
  costOfRepairs: number;

  photos: InspectionPhoto[];
  quote: Quote;
  createdAt: string;
  updatedAt: string;
}

// ─── Company Profile ─────────────────────────────────────────────────────────
export interface CompanyProfile {
  name: string;
  shortName: string;
  nameLine1: string;
  nameLine2: string;
  services: string;
  address: string;
  addressLines: string[];
  eircode: string;
  tel: string;
  email: string;
  website: string;
  c2Number: string;
  vatNumber: string;
  vatRate: number;
  signatoryName: string;
  signatoryTitle: string;
  defaultPersonnel: string;
  depositPercent: number;
  quoteValidDays: number;
  /** Local file URI of custom logo, or empty to use bundled default */
  logoUri: string;
}

// ─── Navigation ──────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Home: undefined;
  NewInspection: undefined;
  Inspection: { inspectionId: string };
  Camera: { inspectionId: string };
  PhotoDetail: { inspectionId: string; photoId: string };
  Report: { inspectionId: string };
  Quote: { inspectionId: string };
  CompanyProfile: undefined;
};


