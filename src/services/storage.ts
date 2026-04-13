import AsyncStorage from '@react-native-async-storage/async-storage';
import { Inspection } from '../types';

const INSPECTIONS_KEY = '@roof_inspector:inspections';

/** Fill in missing fields for inspections saved before new fields were added. */
function normalizeInspection(i: Inspection): Inspection {
  return {
    ref: '',
    conditions: '',
    scopeOfWorks: 'Roof Survey',
    overview: '',
    reportNo: '01',
    conclusion: '',
    costOfRepairs: 0,
    ...i,
    quote: i.quote ?? { lineItems: [] },
    photos: (i.photos ?? []).map((p) => ({
      annotations: [],
      drawings: [],
      ...p,
    })),
  };
}

/** Load all inspections from device storage. Returns [] if nothing saved yet. */
export async function loadInspections(): Promise<Inspection[]> {
  try {
    const raw = await AsyncStorage.getItem(INSPECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Inspection[];
    return parsed.map(normalizeInspection);
  } catch {
    return [];
  }
}

/** Persist the full inspections array (overwrites existing). */
export async function saveInspections(inspections: Inspection[]): Promise<void> {
  await AsyncStorage.setItem(INSPECTIONS_KEY, JSON.stringify(inspections));
}

/** Add a new inspection. */
export async function addInspection(inspection: Inspection): Promise<void> {
  const all = await loadInspections();
  all.unshift(inspection);
  await saveInspections(all);
}

/** Replace an existing inspection by id (used after adding photos / notes). */
export async function updateInspection(updated: Inspection): Promise<void> {
  const all = await loadInspections();
  const idx = all.findIndex((i) => i.id === updated.id);
  if (idx !== -1) {
    all[idx] = { ...updated, updatedAt: new Date().toISOString() };
  } else {
    all.unshift(updated);
  }
  await saveInspections(all);
}

/** Remove an inspection and all of its photos from storage. */
export async function deleteInspection(id: string): Promise<void> {
  const all = await loadInspections();
  await saveInspections(all.filter((i) => i.id !== id));
}

/** Get a single inspection by id. */
export async function getInspection(id: string): Promise<Inspection | null> {
  const all = await loadInspections();
  return all.find((i) => i.id === id) ?? null;
}
