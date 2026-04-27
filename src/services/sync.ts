/**
 * Cloud sync — last-write-wins on `updatedAt`.
 *
 * Pushes/pulls inspections, customers and company profile JSON between this
 * device and Supabase, and uploads/downloads photo binaries to/from the
 * `photos` Storage bucket.
 *
 * Photo binaries: each photo file is stored at `<userId>/<photoId>.jpg` in
 * the `photos` bucket. Once uploaded, the photo's `cloudUploaded` flag is
 * set so we don't re-upload on every sync. On pull, any photo whose local
 * file is missing is downloaded from the bucket and rewritten to the local
 * documents directory.
 *
 * Conflict resolution is intentionally simple: whichever side has the newer
 * `updatedAt` wins. There is no merge — if two devices edit the same record
 * offline, the later write overwrites the earlier one.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Network from 'expo-network';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { loadInspections, saveInspections } from './storage';
import { loadCustomers, saveCustomers } from './customers';
import { loadCompanyProfile, saveCompanyProfile } from './company';
import { resolvePhotoUri } from './photoUri';
import { loadCloudSyncSettings } from './syncSettings';
import { Inspection, Customer, CompanyProfile, InspectionPhoto } from '../types';

const LAST_SYNC_KEY = '@roof_inspector:last_synced_at';
const PHOTOS_BUCKET = 'photos';

export interface SyncResult {
  pushed: { inspections: number; customers: number; profile: boolean; photos: number };
  pulled: { inspections: number; customers: number; profile: boolean; photos: number };
  at: string;
}

/** Progress events emitted by `syncNow` so UI can render a progress bar.
 *  `phase` describes what's being worked on; `current/total` apply to the
 *  per-photo loop and are 0/0 outside that loop. */
export interface SyncProgress {
  phase: 'inspections' | 'customers' | 'profile' | 'photos' | 'done';
  current: number;
  total: number;
  message: string;
}

export type SyncProgressCallback = (p: SyncProgress) => void;

export async function syncNow(onProgress?: SyncProgressCallback): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Cloud sync is not configured for this build.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase client unavailable.');

  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error('Not signed in. Open Settings → Cloud sync first.');
  const userId = user.id;

  const settings = await loadCloudSyncSettings();
  const emit = (p: SyncProgress) => { try { onProgress?.(p); } catch { /* swallow */ } };

  const result: SyncResult = {
    pushed: { inspections: 0, customers: 0, profile: false, photos: 0 },
    pulled: { inspections: 0, customers: 0, profile: false, photos: 0 },
    at: new Date().toISOString(),
  };

  // ── Inspections ──────────────────────────────────────────────────────────
  emit({ phase: 'inspections', current: 0, total: 0, message: 'Syncing inspections…' });
  {
    const localList = await loadInspections();
    const localMap = new Map(localList.map((i) => [i.id, i]));

    const { data: serverRows, error } = await sb
      .from('inspections')
      .select('id, data, updated_at')
      .eq('user_id', userId);
    if (error) throw new Error(`Pull inspections: ${error.message}`);

    const merged = new Map(localMap);
    for (const row of serverRows ?? []) {
      const serverInsp = row.data as Inspection;
      const local = localMap.get(row.id);
      if (!local || (serverInsp.updatedAt ?? '') > (local.updatedAt ?? '')) {
        merged.set(row.id, serverInsp);
        result.pulled.inspections += 1;
      }
    }

    const serverMap = new Map((serverRows ?? []).map((r) => [r.id, r.data as Inspection]));
    const toPush = localList.filter((i) => {
      const remote = serverMap.get(i.id);
      return !remote || (i.updatedAt ?? '') > (remote.updatedAt ?? '');
    });
    if (toPush.length > 0) {
      const { error: pushErr } = await sb
        .from('inspections')
        .upsert(
          toPush.map((i) => ({
            id: i.id,
            user_id: userId,
            data: i,
            updated_at: i.updatedAt ?? new Date().toISOString(),
          })),
          { onConflict: 'id' }
        );
      if (pushErr) throw new Error(`Push inspections: ${pushErr.message}`);
      result.pushed.inspections = toPush.length;
    }

    await saveInspections(Array.from(merged.values()));
  }

  // ── Customers ────────────────────────────────────────────────────────────
  emit({ phase: 'customers', current: 0, total: 0, message: 'Syncing customers…' });
  {
    const localList = await loadCustomers();
    const localMap = new Map(localList.map((c) => [c.id, c]));

    const { data: serverRows, error } = await sb
      .from('customers')
      .select('id, data, updated_at')
      .eq('user_id', userId);
    if (error) throw new Error(`Pull customers: ${error.message}`);

    const merged = new Map(localMap);
    for (const row of serverRows ?? []) {
      const serverCust = row.data as Customer;
      const local = localMap.get(row.id);
      if (!local || (serverCust.updatedAt ?? '') > (local.updatedAt ?? '')) {
        merged.set(row.id, serverCust);
        result.pulled.customers += 1;
      }
    }

    const serverMap = new Map((serverRows ?? []).map((r) => [r.id, r.data as Customer]));
    const toPush = localList.filter((c) => {
      const remote = serverMap.get(c.id);
      return !remote || (c.updatedAt ?? '') > (remote.updatedAt ?? '');
    });
    if (toPush.length > 0) {
      const { error: pushErr } = await sb
        .from('customers')
        .upsert(
          toPush.map((c) => ({
            id: c.id,
            user_id: userId,
            data: c,
            updated_at: c.updatedAt ?? new Date().toISOString(),
          })),
          { onConflict: 'id' }
        );
      if (pushErr) throw new Error(`Push customers: ${pushErr.message}`);
      result.pushed.customers = toPush.length;
    }

    await saveCustomers(Array.from(merged.values()));
  }

  // ── Company profile ──────────────────────────────────────────────────────
  emit({ phase: 'profile', current: 0, total: 0, message: 'Syncing profile…' });
  {
    const local = await loadCompanyProfile();
    const localUpdated = (local as any).updatedAt as string | undefined;

    const { data: serverRow, error } = await sb
      .from('company_profiles')
      .select('data, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`Pull profile: ${error.message}`);

    const serverProfile = serverRow?.data as CompanyProfile | undefined;
    const serverUpdated = (serverProfile as any)?.updatedAt as string | undefined;

    if (serverProfile && (!localUpdated || (serverUpdated ?? '') > (localUpdated ?? ''))) {
      await saveCompanyProfile(serverProfile);
      result.pulled.profile = true;
    } else {
      const stamped = { ...local, updatedAt: localUpdated ?? new Date().toISOString() } as any;
      const { error: pushErr } = await sb
        .from('company_profiles')
        .upsert(
          { user_id: userId, data: stamped, updated_at: stamped.updatedAt },
          { onConflict: 'user_id' }
        );
      if (pushErr) throw new Error(`Push profile: ${pushErr.message}`);
      result.pushed.profile = true;
    }
  }

  // ── Photo binaries ───────────────────────────────────────────────────────
  // We sync photos AFTER inspections have been merged so we have the union
  // of local + server photo metadata. For each photo:
  //   - if the local file exists and `cloudUploaded` is not yet true → resize
  //     to settings.photoMaxWidth and upload
  //   - if the local file is missing → try to download from the bucket
  //
  // Failures are swallowed per-photo so one bad upload doesn't abort the
  // whole sync. Counts come back in `result.pushed.photos` / `pulled.photos`,
  // and per-photo progress is emitted via `onProgress` so the UI can render
  // a real progress bar.
  {
    const allInspections = await loadInspections();
    let mutated = false;

    // Pre-compute total number of photos so the UI can show "x of N".
    const totalPhotos = allInspections.reduce((n, i) => n + i.photos.length, 0);
    let processed = 0;
    emit({
      phase: 'photos',
      current: 0,
      total: totalPhotos,
      message: totalPhotos === 0 ? 'No photos to sync' : `Preparing ${totalPhotos} photos…`,
    });

    for (const insp of allInspections) {
      for (let i = 0; i < insp.photos.length; i++) {
        const photo = insp.photos[i];
        const cloudPath = `${userId}/${photo.id}.jpg`;
        const localUri = resolvePhotoUri(photo.uri);
        const info = localUri ? await FileSystem.getInfoAsync(localUri).catch(() => null) : null;

        if (info?.exists) {
          // Local file present → upload if we haven't already.
          if (!photo.cloudUploaded) {
            try {
              // Apply user's size cap before reading bytes — this is what
              // keeps cellular sync usage bearable.
              let uploadUri = localUri;
              try {
                const resized = await ImageManipulator.manipulateAsync(
                  localUri,
                  [{ resize: { width: settings.photoMaxWidth } }],
                  { compress: settings.photoQuality, format: ImageManipulator.SaveFormat.JPEG },
                );
                uploadUri = resized.uri;
              } catch {
                // If resize fails for any reason, fall back to the original
                // bytes — we'd rather upload a too-large file than skip it.
              }
              const base64 = await FileSystem.readAsStringAsync(uploadUri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              const bytes = decodeBase64(base64);
              const { error: upErr } = await sb.storage
                .from(PHOTOS_BUCKET)
                .upload(cloudPath, bytes, {
                  contentType: 'image/jpeg',
                  upsert: true,
                });
              if (!upErr) {
                insp.photos[i] = { ...photo, cloudUploaded: true };
                result.pushed.photos += 1;
                mutated = true;
              }
            } catch {
              // best-effort; skip on failure
            }
          }
        } else {
          // Local file missing → attempt download.
          try {
            const { data, error: dlErr } = await sb.storage
              .from(PHOTOS_BUCKET)
              .download(cloudPath);
            if (!dlErr && data) {
              const dir = FileSystem.documentDirectory + 'photos/';
              await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
              const dest = dir + photo.id + '.jpg';
              const base64 = await blobToBase64(data);
              await FileSystem.writeAsStringAsync(dest, base64, {
                encoding: FileSystem.EncodingType.Base64,
              });
              insp.photos[i] = { ...photo, uri: dest, cloudUploaded: true };
              result.pulled.photos += 1;
              mutated = true;
            }
          } catch {
            // best-effort; skip on failure
          }
        }

        processed += 1;
        emit({
          phase: 'photos',
          current: processed,
          total: totalPhotos,
          message: `Photos: ${processed} of ${totalPhotos}`,
        });
      }
    }

    if (mutated) await saveInspections(allInspections);
  }

  await AsyncStorage.setItem(LAST_SYNC_KEY, result.at);
  emit({ phase: 'done', current: 1, total: 1, message: 'Sync complete' });
  return result;
}

// Helper: decode base64 string into a Uint8Array we can hand to Supabase
// Storage. (The JS SDK accepts Blob/File/ArrayBuffer/Uint8Array but Blob
// support in React Native is unreliable, so we go through bytes directly.)
function decodeBase64(b64: string): Uint8Array {
  // atob is available in Hermes and on web; on older RN runtimes Buffer would
  // be the fallback, but Expo SDK 54 + Hermes ships atob.
  const bin = (globalThis as any).atob(b64) as string;
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Helper: read a Blob into a base64 string. Used for storage.download().
async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.substring(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export async function lastSyncedAt(): Promise<string | null> {
  try { return await AsyncStorage.getItem(LAST_SYNC_KEY); }
  catch { return null; }
}

const BACKGROUND_SYNC_MIN_INTERVAL_MS = 60_000; // don't auto-sync more than once a minute
let backgroundSyncInFlight = false;

/** Best-effort silent sync triggered by app launch / app foregrounding.
 *  No-ops if the user isn't signed in, sync isn't configured, or we synced
 *  very recently. Errors are swallowed so the UI never sees a popup. */
export async function triggerBackgroundSync(): Promise<void> {
  if (backgroundSyncInFlight) return;
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  if (!sb) return;

  // Cheap session check before doing any work.
  const { data: sessionData } = await sb.auth.getSession().catch(() => ({ data: { session: null } } as any));
  if (!sessionData.session) return;

  // Respect the user's "WiFi only" preference. With expo-network we can
  // actually detect the connection type — when wifiOnly is on we skip the
  // silent auto-sync unless we're confidently on WiFi (or a wired/Ethernet
  // connection on iPad). Manual "Sync now" is unaffected.
  const settings = await loadCloudSyncSettings().catch(() => null);
  if (settings?.wifiOnly) {
    try {
      const state = await Network.getNetworkStateAsync();
      const onWifi =
        state.type === Network.NetworkStateType.WIFI ||
        state.type === Network.NetworkStateType.ETHERNET;
      if (!onWifi) return;
    } catch {
      // If we can't determine the network, err on the side of caution
      // and skip background sync.
      return;
    }
  }

  // Throttle: skip if we synced within the cooldown window.
  const last = await AsyncStorage.getItem(LAST_SYNC_KEY).catch(() => null);
  if (last) {
    const ageMs = Date.now() - new Date(last).getTime();
    if (ageMs >= 0 && ageMs < BACKGROUND_SYNC_MIN_INTERVAL_MS) return;
  }

  backgroundSyncInFlight = true;
  try {
    await syncNow();
  } catch {
    // intentionally silent
  } finally {
    backgroundSyncInFlight = false;
  }
}
