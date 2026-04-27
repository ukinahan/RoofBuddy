import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { DeviceMotion } from 'expo-sensors';
import { RootStackParamList } from '../types';
import { getInspection, updateInspection } from '../services/storage';
import { track } from '../services/analytics';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PitchDetector'>;
type Route = RouteProp<RootStackParamList, 'PitchDetector'>;

/**
 * Pitch Detector — point the long edge of the phone along the roof slope.
 * Reads device beta (front-back tilt) via DeviceMotion and shows pitch in
 * degrees + roofing-trade rise:run ratio.
 */
export default function PitchDetectorScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const inspectionId = route.params?.inspectionId;
  const photoId = route.params?.photoId;

  const [pitch, setPitch] = useState<number>(0);
  const [hold, setHold] = useState<number | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    track('pitch_detector_opened');
    let cancelled = false;
    (async () => {
      const ok = await DeviceMotion.isAvailableAsync();
      if (!ok || cancelled) {
        Alert.alert('Not supported', 'Device motion sensors are not available on this device.');
        return;
      }
      DeviceMotion.setUpdateInterval(80);
      subRef.current = DeviceMotion.addListener((data) => {
        // beta = front-to-back tilt in radians (positive = top tilted away)
        const beta = data.rotation?.beta ?? 0;
        const deg = Math.abs((beta * 180) / Math.PI);
        // Clamp to 0-90; values >90 indicate phone is upside-down which we treat as 0.
        const clamped = deg > 90 ? Math.max(0, 180 - deg) : deg;
        setPitch(clamped);
      });
    })();
    return () => {
      cancelled = true;
      subRef.current?.remove();
    };
  }, []);

  const reading = hold ?? pitch;
  const rise = Math.round(Math.tan((reading * Math.PI) / 180) * 12);

  const onCapture = () => {
    setHold(pitch);
    track('pitch_captured', { degrees: Math.round(pitch) });
  };

  const onSave = async () => {
    if (hold == null) return;
    const degrees = Math.round(hold * 10) / 10;
    if (inspectionId && photoId) {
      const insp = await getInspection(inspectionId);
      if (insp) {
        const photos = insp.photos.map((p) => (p.id === photoId ? { ...p, pitchDegrees: degrees } : p));
        await updateInspection({ ...insp, photos });
      }
    }
    Alert.alert('Pitch saved', `${degrees}° (${rise}:12 ratio) saved to this photo.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.help}>
        Hold the phone flat against the roof slope (long edge along the slope) and tap Capture.
      </Text>

      <View style={styles.gauge}>
        <Text style={styles.degText}>{Math.round(reading * 10) / 10}°</Text>
        <Text style={styles.ratioText}>{rise}:12</Text>
        <Text style={styles.descText}>{describePitch(reading)}</Text>
      </View>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onCapture}>
          <Text style={styles.btnPrimaryText}>{hold == null ? 'Capture' : 'Re-Capture'}</Text>
        </TouchableOpacity>
        {hold != null && (
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setHold(null)}>
            <Text style={styles.btnSecondaryText}>Live</Text>
          </TouchableOpacity>
        )}
      </View>

      {hold != null && (inspectionId && photoId) && (
        <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={onSave}>
          <Text style={styles.btnPrimaryText}>Save to Photo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function describePitch(deg: number): string {
  if (deg < 5) return 'Flat / low-slope';
  if (deg < 18) return 'Low slope';
  if (deg < 27) return 'Conventional slope';
  if (deg < 38) return 'Medium slope';
  if (deg < 50) return 'Steep slope';
  return 'Very steep — fall protection required';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24, alignItems: 'center', justifyContent: 'center' },
  help: { color: '#cbd5e1', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  gauge: {
    width: 240, height: 240, borderRadius: 120, borderWidth: 4, borderColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center', marginBottom: 28, backgroundColor: '#1e293b',
  },
  degText: { color: '#fff', fontSize: 56, fontWeight: '800' },
  ratioText: { color: '#93c5fd', fontSize: 24, fontWeight: '700', marginTop: 4 },
  descText: { color: '#cbd5e1', fontSize: 12, marginTop: 8, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  btn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10 },
  btnPrimary: { backgroundColor: '#3b82f6' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnSecondary: { backgroundColor: '#334155' },
  btnSecondaryText: { color: '#cbd5e1', fontWeight: '600', fontSize: 16 },
  btnSave: { backgroundColor: '#16a34a', marginTop: 8 },
});
