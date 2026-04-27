// ─── Drawing ─────────────────────────────────────────────────────────────────
export type DrawingShape =
  | 'freehand'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  /** Straight line whose pixel length is converted to a real-world distance via the photo's calibration. */
  | 'measure-line'
  /** Rectangle whose pixel area is converted to a real-world area via calibration. */
  | 'measure-area'
  /** Special line drawn during calibration. data format: "x1,y1,x2,y2|metres". */
  | 'calibration';

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
  drawings: DrawingPath[];
  /** Pixel dimensions of the drawing canvas when drawings were made */
  drawingViewport?: { width: number; height: number };
  /** Native pixel dimensions of the saved JPEG file. Photos captured before this field was introduced may be undefined; assume 4:3 landscape (1600×1200). */
  width?: number;
  height?: number;
  /** Calibration value: how many on-screen pixels equal 1 metre. Set when the user calibrates against a known reference in the photo. */
  pixelsPerMeter?: number;
  /** Tags from the damage preset list (broken_tile, missing_flashing, moss, etc). Used by the report summary to count occurrences across all photos. */
  damageTags?: string[];
  /** Set after the photo binary has been uploaded to Supabase Storage. Used by sync to skip already-uploaded photos. */
  cloudUploaded?: boolean;
  /** GPS coordinates captured at photo time (best-effort, may be undefined if location permission denied or unavailable). */
  latitude?: number;
  longitude?: number;
  /** Horizontal accuracy in metres (smaller = more precise). */
  locationAccuracy?: number;
  /** Altitude in metres above sea level, if available. */
  altitude?: number;
  /** Pitch reading in degrees, if the user used the Pitch Detector while taking this photo. */
  pitchDegrees?: number;
}

// ─── Roof Measurement (drawn polygon over satellite map) ────────────────────
export interface RoofMeasurement {
  id: string;
  /** Vertex list (polygon) in lat/lng order */
  points: Array<{ latitude: number; longitude: number }>;
  /** Calculated area in square metres */
  areaSqM: number;
  /** Optional pitch in degrees (multiplier applied to area for slope correction) */
  pitchDegrees?: number;
  /** Free-text label, e.g. "Front slope", "Garage" */
  label?: string;
  createdAt: string;
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

// ─── Customer ────────────────────────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Inspection ───────────────────────────────────────────────────────────────
export interface Inspection {
  id: string;
  /** Optional link to a Customer record. */
  customerId?: string;
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
  /** Roof measurements drawn on satellite map (Sprint 3). Optional/backwards compatible. */
  measurements?: RoofMeasurement[];
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
  /** When true, photos taken with the in-app camera are also saved to the device's Photos library. */
  saveToPhotos: boolean;
}

// ─── Navigation ──────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Home: undefined;
  NewInspection: { customerId?: string } | undefined;
  Inspection: { inspectionId: string };
  Camera: { inspectionId: string };
  PhotoDetail: { inspectionId: string; photoId: string };
  Report: { inspectionId: string };
  Quote: { inspectionId: string };
  CompanyProfile: undefined;
  CustomersList: undefined;
  CustomerDetail: { customerId: string };
  Settings: undefined;
  Jobs: undefined;
  Auth: undefined;
  /** Sprint 3: interactive satellite map for tracing the roof outline + auto-area. */
  RoofMeasure: { inspectionId: string };
  /** Sprint 3: tilt-based pitch detector. */
  PitchDetector: { inspectionId?: string; photoId?: string } | undefined;
  /** Sprint 3: bulk import drone photos from library. */
  BulkImport: { inspectionId: string };
};


