import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, TextInput,
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, MapPressEvent, Region } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import { RootStackParamList, RoofMeasurement } from '../types';
import { getInspection, updateInspection } from '../services/storage';
import { geocodeAddress } from '../services/maps';
import { getCurrentLocation } from '../services/location';
import { polygonAreaSqM, sqMtoSqFt, sqMtoSquares, applyPitch } from '../utils/geometry';
import { track } from '../services/analytics';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RoofMeasure'>;
type Route = RouteProp<RootStackParamList, 'RoofMeasure'>;

type Pt = { latitude: number; longitude: number };

export default function RoofMeasureScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { inspectionId } = route.params;

  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<Pt[]>([]);
  const [pitch, setPitch] = useState<string>('25');
  const [label, setLabel] = useState<string>('');

  useEffect(() => {
    track('roof_measure_opened');
    (async () => {
      const insp = await getInspection(inspectionId);
      if (!insp) {
        Alert.alert('Inspection not found');
        navigation.goBack();
        return;
      }
      // Try address first, then GPS, then a sensible default.
      let center: Pt | null = null;
      if (insp.address) {
        const g = await geocodeAddress(insp.address);
        if (g) center = { latitude: g.lat, longitude: g.lng };
      }
      if (!center) {
        const fix = await getCurrentLocation(2500);
        if (fix) center = { latitude: fix.latitude, longitude: fix.longitude };
      }
      if (!center) center = { latitude: 53.349805, longitude: -6.26031 }; // Dublin fallback

      setRegion({
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: 0.0008,
        longitudeDelta: 0.0008,
      });
      setLoading(false);
    })();
  }, [inspectionId]);

  const onMapPress = (e: MapPressEvent) => {
    const c = e.nativeEvent.coordinate;
    setPoints((prev) => [...prev, { latitude: c.latitude, longitude: c.longitude }]);
  };

  const undo = () => setPoints((p) => p.slice(0, -1));
  const clear = () => setPoints([]);

  const flatM2 = useMemo(() => polygonAreaSqM(points), [points]);
  const pitchDeg = parseFloat(pitch) || 0;
  const slopedM2 = applyPitch(flatM2, pitchDeg);

  const onSave = async () => {
    if (points.length < 3) {
      Alert.alert('Add at least 3 points', 'Tap the map at each corner of the roof to draw a polygon.');
      return;
    }
    const insp = await getInspection(inspectionId);
    if (!insp) return;
    const measurement: RoofMeasurement = {
      id: uuidv4(),
      points,
      areaSqM: slopedM2,
      pitchDegrees: pitchDeg || undefined,
      label: label.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    const measurements = [...(insp.measurements ?? []), measurement];
    await updateInspection({ ...insp, measurements });
    track('roof_measure_saved', {
      vertices: points.length, sqM: Math.round(slopedM2), pitch: pitchDeg,
    });
    Alert.alert('Saved', `Measurement of ${Math.round(sqMtoSqFt(slopedM2))} sq ft saved.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  if (loading || !region) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1a3c5e" />
        <Text style={styles.loadingText}>Loading satellite map…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          mapType="satellite"
          initialRegion={region}
          onPress={onMapPress}
          showsUserLocation
          showsCompass
        >
          {points.length >= 3 && (
            <Polygon
              coordinates={points}
              strokeColor="#22d3ee"
              strokeWidth={3}
              fillColor="rgba(34, 211, 238, 0.25)"
            />
          )}
          {points.map((p, i) => (
            <Marker key={i} coordinate={p} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.dot}>
                <Text style={styles.dotText}>{i + 1}</Text>
              </View>
            </Marker>
          ))}
        </MapView>

        <ScrollView style={styles.bottom} contentContainerStyle={styles.bottomContent}>
          <View style={styles.statsRow}>
            <Stat label="Flat area" value={`${Math.round(sqMtoSqFt(flatM2))} ft²`} sub={`${flatM2.toFixed(0)} m²`} />
            <Stat label="With pitch" value={`${Math.round(sqMtoSqFt(slopedM2))} ft²`} sub={`${sqMtoSquares(slopedM2).toFixed(1)} sq`} />
            <Stat label="Vertices" value={`${points.length}`} sub="tap map to add" />
          </View>

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lbl}>Pitch (degrees)</Text>
              <TextInput
                style={styles.input}
                value={pitch}
                onChangeText={setPitch}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.lbl}>Label (optional)</Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder="e.g. Front slope"
              />
            </View>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={undo} disabled={points.length === 0}>
              <Text style={styles.btnGhostText}>Undo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={clear} disabled={points.length === 0}>
              <Text style={styles.btnGhostText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onSave} disabled={points.length < 3}>
              <Text style={styles.btnPrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLbl}>{label}</Text>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  map: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  loadingText: { marginTop: 12, color: '#475569' },
  dot: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#22d3ee',
    borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  dotText: { color: '#0f172a', fontSize: 10, fontWeight: '800' },
  bottom: { backgroundColor: '#fff', maxHeight: 280 },
  bottomContent: { padding: 12, gap: 10 },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 10, padding: 10 },
  statLbl: { color: '#64748b', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statVal: { color: '#0f172a', fontSize: 20, fontWeight: '800', marginTop: 2 },
  statSub: { color: '#64748b', fontSize: 11, marginTop: 2 },
  formRow: { flexDirection: 'row', gap: 10 },
  lbl: { color: '#475569', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, backgroundColor: '#fff' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#1a3c5e' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnGhost: { backgroundColor: '#e2e8f0' },
  btnGhostText: { color: '#334155', fontWeight: '700', fontSize: 14 },
});
