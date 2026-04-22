import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as FileSystem from 'expo-file-system/legacy';
import { v4 as uuidv4 } from 'uuid';
import { RootStackParamList, InspectionPhoto } from '../types';
import { getInspection, updateInspection } from '../services/storage';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Camera'>;
type Route = RouteProp<RootStackParamList, 'Camera'>;

export default function CameraScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { inspectionId } = route.params;

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturing, setCapturing] = useState(false);
  const [photosTaken, setPhotosTaken] = useState(0);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    // Lock to landscape when camera opens
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      // Restore portrait when leaving camera
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const takePhoto = async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (!photo) return;

      // Copy to app documents for persistence
      const dir = FileSystem.documentDirectory + 'photos/';
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const dest = dir + uuidv4() + '.jpg';
      await FileSystem.copyAsync({ from: photo.uri, to: dest });

      const inspection = await getInspection(inspectionId);
      if (!inspection) return;

      const newPhoto: InspectionPhoto = {
        id: uuidv4(),
        uri: dest,
        takenAt: new Date().toISOString(),
        notes: '',
        severity: 'none',
        annotations: [],
        drawings: [],
      };

      await updateInspection({ ...inspection, photos: [...inspection.photos, newPhoto] });
      setPhotosTaken((n) => n + 1);
    } catch (err) {
      Alert.alert('Capture Failed', 'Could not save photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera access is required to take roof photos.</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} ratio="4:3" />

      {/* Top controls */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.topBtnText}>✕ Done{photosTaken > 0 ? ` (${photosTaken})` : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.topBtn}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
        >
          <Text style={styles.topBtnText}>⇄ Flip</Text>
        </TouchableOpacity>
      </View>

      {/* Grid overlay to help with framing */}
      <View style={styles.gridOverlay} pointerEvents="none">
        <View style={styles.gridRow}>
          <View style={styles.gridCell} /><View style={styles.gridCell} /><View style={styles.gridCell} />
        </View>
        <View style={styles.gridRow}>
          <View style={styles.gridCell} /><View style={styles.gridCell} /><View style={styles.gridCell} />
        </View>
        <View style={styles.gridRow}>
          <View style={styles.gridCell} /><View style={styles.gridCell} /><View style={styles.gridCell} />
        </View>
      </View>

      {/* Shutter */}
      <View style={styles.shutterContainer}>
        <Text style={styles.hint}>Tap to capture each area of the roof</Text>
        <TouchableOpacity
          style={[styles.shutter, capturing && styles.shutterCapturing]}
          onPress={takePhoto}
          disabled={capturing}
          activeOpacity={0.7}
        >
          <View style={styles.shutterInner} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  camera: { ...StyleSheet.absoluteFillObject },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  topBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  topBtnText: { color: 'white', fontSize: 15, fontWeight: '600' },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  gridRow: { flex: 1, flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.2)' },
  gridCell: { flex: 1, borderLeftWidth: 0.5, borderLeftColor: 'rgba(255,255,255,0.2)' },
  shutterContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 48,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingTop: 16,
  },
  hint: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 16 },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'white',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterCapturing: { opacity: 0.5 },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'white' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  permissionText: { fontSize: 16, textAlign: 'center', color: '#333', marginBottom: 20 },
  permissionBtn: { backgroundColor: '#1a3c5e', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10 },
  permissionBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
});
