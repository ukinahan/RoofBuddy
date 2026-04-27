/**
 * User-tunable cloud sync preferences.
 *
 * Stored in AsyncStorage (one JSON blob) so the toggle UI in AuthScreen
 * doesn't have to thread props through.
 *
 *   wifiOnly       – when true, the silent auto-sync triggered by app launch
 *                    or foreground is suppressed. Manual "Sync now" still
 *                    runs. (We can't actually detect WiFi vs cellular without
 *                    a native module, so the safe behaviour is "don't run
 *                    automatically; let the user pick the moment".)
 *   photoMaxWidth  – longest-edge resize applied to every photo before
 *                    upload. Smaller = less data, less disk. 1200px is a
 *                    good default for report-grade detail.
 *   photoQuality   – JPEG compression quality 0.0-1.0 used during the
 *                    pre-upload resize.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@roof_inspector:cloud_sync_settings';

export interface CloudSyncSettings {
  wifiOnly: boolean;
  photoMaxWidth: number;
  photoQuality: number;
}

export const DEFAULT_SETTINGS: CloudSyncSettings = {
  wifiOnly: true,
  photoMaxWidth: 1200,
  photoQuality: 0.7,
};

export async function loadCloudSyncSettings(): Promise<CloudSyncSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<CloudSyncSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveCloudSyncSettings(s: CloudSyncSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}
