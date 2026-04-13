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
export interface InspectionPhoto {
  id: string;
  /** Local file URI saved by expo-file-system */
  uri: string;
  /** ISO datetime the photo was captured */
  takenAt: string;
  /** Free-text notes typed by the inspector for this photo */
  notes: string;
  annotations: Annotation[];
  drawings: DrawingPath[];
  /** Pixel dimensions of the drawing canvas when drawings were made */
  drawingViewport?: { width: number; height: number };
}

// ─── Inspection ──────────────────────────────────────────────────────────────
export interface Inspection {
  id: string;
  customerName: string;
  customerEmail: string;
  address: string;
  /** ISO date (YYYY-MM-DD) */
  date: string;
  /** General notes about the entire inspection */
  notes: string;
  inspectorName: string;
  photos: InspectionPhoto[];
  createdAt: string;
  updatedAt: string;
}

// ─── Navigation ──────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Home: undefined;
  NewInspection: undefined;
  Inspection: { inspectionId: string };
  Camera: { inspectionId: string };
  PhotoDetail: { inspectionId: string; photoId: string };
  Report: { inspectionId: string };
};


