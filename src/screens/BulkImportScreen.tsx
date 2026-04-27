import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { v4 as uuidv4 } from 'uuid';
import { RootStackParamList, InspectionPhoto } from '../types';
import { getInspection, updateInspection } from '../services/storage';
import { distanceBetween, getCurrentLocation } from '../services/location';
import { geocodeAddress } from '../services/maps';
import { track } from '../services/analytics';

type Nav = NativeStackNavigationProp<RootStackParamList, 'BulkImport'>;
type Route = RouteProp<RootStackParamList, 'BulkImport'>;

interface PendingPhoto {
  uri: string;
  width: number;
  height: number;
  exif?: { GPSLatitude?: number; GPSLongitude?: number; GPSAltitude?: number; DateTimeOriginal?: string } | null;
  selected: boolean;
  /** Distance in metres from job address (if known + photo has GPS). */
  distanceM?: number;
}

const SUGGEST_RADIUS_M = 250;

export default function BulkImportScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { inspectionId } = route.params;

  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    track('bulk_import_opened');
    pickPhotos();
  }, []);

  const pickPhotos = async () => {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Photo library access is required to import drone photos.');
        navigation.goBack();
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 50,
        quality: 1,
        exif: true,
      });
      if (result.canceled || !result.assets?.length) {
        navigation.goBack();
        return;
      }

      // Resolve job centre (address or current GPS) for proximity grouping
      const insp = await getInspection(inspectionId);
      let centre: { latitude: number; longitude: number } | null = null;
      if (insp?.address) {
        const g = await geocodeAddress(insp.address);
        if (g) centre = { latitude: g.lat, longitude: g.lng };
      }
      if (!centre) {
        const fix = await getCurrentLocation(2000);
        if (fix) centre = { latitude: fix.latitude, longitude: fix.longitude };
      }

      const pending: PendingPhoto[] = result.assets.map((a) => {
        const lat = (a.exif as any)?.GPSLatitude;
        const lng = (a.exif as any)?.GPSLongitude;
        const distance =
          centre && typeof lat === 'number' && typeof lng === 'number'
            ? distanceBetween(centre, { latitude: lat, longitude: lng })
            : undefined;
        const autoSelect = distance == null || distance <= SUGGEST_RADIUS_M;
        return {
          uri: a.uri,
          width: a.width,
          height: a.height,
          exif: a.exif as any,
          distanceM: distance,
          selected: autoSelect,
        };
      });
      setPhotos(pending);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (idx: number) =>
    setPhotos((prev) => prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p)));

  const selectAll = () => setPhotos((prev) => prev.map((p) => ({ ...p, selected: true })));
  const selectNone = () => setPhotos((prev) => prev.map((p) => ({ ...p, selected: false })));
  const selectNearby = () =>
    setPhotos((prev) => prev.map((p) => ({ ...p, selected: p.distanceM != null && p.distanceM <= SUGGEST_RADIUS_M })));

  const importSelected = async () => {
    const chosen = photos.filter((p) => p.selected);
    if (chosen.length === 0) {
      Alert.alert('Nothing selected', 'Pick at least one photo to import.');
      return;
    }
    setImporting(true);
    try {
      const insp = await getInspection(inspectionId);
      if (!insp) return;
      const dir = FileSystem.documentDirectory + 'photos/';
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

      const newPhotos: InspectionPhoto[] = [];
      for (const p of chosen) {
        const m = await ImageManipulator.manipulateAsync(
          p.uri,
          [{ resize: { width: 1600 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        );
        const dest = dir + uuidv4() + '.jpg';
        await FileSystem.copyAsync({ from: m.uri, to: dest });

        const lat = (p.exif as any)?.GPSLatitude;
        const lng = (p.exif as any)?.GPSLongitude;
        const alt = (p.exif as any)?.GPSAltitude;
        const taken = (p.exif as any)?.DateTimeOriginal as string | undefined;

        newPhotos.push({
          id: uuidv4(),
          uri: dest,
          takenAt: taken ? safeParseExifDate(taken) : new Date().toISOString(),
          notes: '',
          severity: 'none',
          drawings: [],
          width: m.width,
          height: m.height,
          latitude: typeof lat === 'number' ? lat : undefined,
          longitude: typeof lng === 'number' ? lng : undefined,
          altitude: typeof alt === 'number' ? alt : undefined,
        });
      }

      await updateInspection({ ...insp, photos: [...insp.photos, ...newPhotos] });
      track('bulk_import_completed', { count: newPhotos.length });
      Alert.alert('Imported', `${newPhotos.length} photo${newPhotos.length === 1 ? '' : 's'} added to the inspection.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setImporting(false);
    }
  };

  const nearbyCount = photos.filter((p) => p.distanceM != null && p.distanceM <= SUGGEST_RADIUS_M).length;
  const hasGpsAny = photos.some((p) => p.distanceM != null);

  if (busy) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a3c5e" />
        <Text style={styles.dim}>Reading photo metadata…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.summary}>
          {photos.length} photo{photos.length === 1 ? '' : 's'} ·{' '}
          {photos.filter((p) => p.selected).length} selected
          {hasGpsAny ? ` · ${nearbyCount} near job site` : ''}
        </Text>
        <View style={styles.toolRow}>
          {hasGpsAny && (
            <TouchableOpacity style={styles.toolBtn} onPress={selectNearby}>
              <Text style={styles.toolBtnText}>Nearby</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.toolBtn} onPress={selectAll}>
            <Text style={styles.toolBtnText}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={selectNone}>
            <Text style={styles.toolBtnText}>None</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={photos}
        keyExtractor={(_, i) => String(i)}
        numColumns={3}
        contentContainerStyle={styles.grid}
        renderItem={({ item, index }) => (
          <TouchableOpacity onPress={() => toggle(index)} style={styles.cell}>
            <Image source={{ uri: item.uri }} style={styles.thumb} />
            {item.selected && <View style={styles.checkmark}><Text style={styles.checkmarkText}>✓</Text></View>}
            {item.distanceM != null && (
              <View style={styles.distance}>
                <Text style={styles.distanceText}>
                  {item.distanceM < 1000 ? `${Math.round(item.distanceM)}m` : `${(item.distanceM / 1000).toFixed(1)}km`}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => navigation.goBack()}>
          <Text style={styles.btnGhostText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, importing && { opacity: 0.6 }]}
          onPress={importSelected}
          disabled={importing}
        >
          <Text style={styles.btnPrimaryText}>
            {importing ? 'Importing…' : `Import ${photos.filter((p) => p.selected).length}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function safeParseExifDate(exifDate: string): string {
  // EXIF format: "YYYY:MM:DD HH:MM:SS"
  const m = exifDate.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return new Date().toISOString();
  const [_, y, mo, d, h, mi, s] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { color: '#64748b', marginTop: 12 },
  toolbar: { padding: 12, borderBottomWidth: 1, borderColor: '#e2e8f0', gap: 8 },
  summary: { color: '#0f172a', fontSize: 14, fontWeight: '600' },
  toolRow: { flexDirection: 'row', gap: 8 },
  toolBtn: { backgroundColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  toolBtnText: { color: '#1e293b', fontWeight: '600', fontSize: 12 },
  grid: { padding: 4 },
  cell: { flex: 1 / 3, aspectRatio: 1, padding: 2, position: 'relative' },
  thumb: { width: '100%', height: '100%', borderRadius: 6, backgroundColor: '#f1f5f9' },
  checkmark: {
    position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center',
  },
  checkmarkText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  distance: {
    position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(15,23,42,0.75)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  distanceText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  bottomBar: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1, borderColor: '#e2e8f0' },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#1a3c5e' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnGhost: { backgroundColor: '#e2e8f0' },
  btnGhostText: { color: '#334155', fontWeight: '700' },
});
