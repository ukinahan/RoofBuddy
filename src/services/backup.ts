import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadInspections } from './storage';
import { loadCustomers } from './customers';
import { loadCompanyProfile } from './company';
import { loadLocale } from './locale';

const SCHEMA_VERSION = 1;

export interface BackupBundle {
  schemaVersion: number;
  exportedAt: string;
  appVersion?: string;
  inspections: unknown[];
  customers: unknown[];
  companyProfile: unknown;
  locale: unknown;
}

export async function buildBackup(appVersion?: string): Promise<BackupBundle> {
  const [inspections, customers, companyProfile, locale] = await Promise.all([
    loadInspections(),
    loadCustomers(),
    loadCompanyProfile(),
    loadLocale(),
  ]);
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion,
    inspections,
    customers,
    companyProfile,
    locale,
  };
}

/**
 * Write a JSON backup to a temp file and trigger the share sheet so the user
 * can email it to themselves, save to Files / iCloud Drive / Dropbox, or send
 * to AirDrop. Returns the file URI on success.
 */
export async function exportBackupAndShare(appVersion?: string): Promise<string | null> {
  const bundle = await buildBackup(appVersion);
  const json = JSON.stringify(bundle, null, 2);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const uri = `${FileSystem.documentDirectory}roofbuddy-backup-${stamp}.json`;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Save RoofBuddy Backup' });
  }
  return uri;
}

/**
 * Delete every key under the @roof_inspector: namespace from AsyncStorage and
 * remove the photos directory on disk. Irreversible. Caller must confirm.
 */
export async function wipeAllData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const ours = keys.filter((k) => k.startsWith('@roof_inspector:'));
  if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  // Remove photo files
  try {
    const photosDir = `${FileSystem.documentDirectory}photos/`;
    const info = await FileSystem.getInfoAsync(photosDir);
    if (info.exists) {
      await FileSystem.deleteAsync(photosDir, { idempotent: true });
    }
  } catch {
    // best-effort
  }
}
