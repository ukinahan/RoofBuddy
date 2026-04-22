import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Inspection, InspectionPhoto, DrawingPath, DrawingShape, PhotoSeverity } from '../types';
import { getInspection, updateInspection } from '../services/storage';
import DrawingCanvas from '../components/DrawingCanvas';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PhotoDetail'>;
type Route = RouteProp<RootStackParamList, 'PhotoDetail'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_HEIGHT = SCREEN_WIDTH * 0.75;

const DRAW_COLORS = ['#FF3B30', '#FF9500', '#34C759', '#007AFF', '#AF52DE', '#FFCC00', '#FFFFFF'];

const SEVERITY_OPTIONS: Array<{ value: PhotoSeverity; label: string; color: string }> = [
  { value: 'none', label: 'None', color: '#999' },
  { value: 'low', label: 'Low', color: '#388e3c' },
  { value: 'medium', label: 'Medium', color: '#f57c00' },
  { value: 'high', label: 'High', color: '#d32f2f' },
];

const SHAPE_TOOLS: Array<{ shape: DrawingShape; icon: string; label: string }> = [
  { shape: 'freehand', icon: '✏️', label: 'Draw' },
  { shape: 'rectangle', icon: '▭', label: 'Box' },
  { shape: 'circle', icon: '○', label: 'Circle' },
  { shape: 'arrow', icon: '→', label: 'Arrow' },
];

type ActiveMode = 'view' | 'draw';

export default function PhotoDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { inspectionId, photoId } = route.params;

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [photo, setPhoto] = useState<InspectionPhoto | null>(null);
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<ActiveMode>('view');

  const [activeShape, setActiveShape] = useState<DrawingShape>('freehand');
  const [activeColor, setActiveColor] = useState('#FF3B30');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const insp = await getInspection(inspectionId);
    if (!insp) return;
    const p = insp.photos.find((ph) => ph.id === photoId);
    if (!p) return;
    setInspection(insp);
    setPhoto({ ...p, drawings: p.drawings ?? [] });
    setNotes(p.notes);
  }, [inspectionId, photoId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const savePhoto = async (updated: InspectionPhoto) => {
    if (!inspection) return;
    const updatedPhotos = inspection.photos.map((p) => (p.id === photoId ? updated : p));
    const updatedInspection = { ...inspection, photos: updatedPhotos };
    await updateInspection(updatedInspection);
    setInspection(updatedInspection);
    setPhoto(updated);
  };

  const handleSaveNotes = async () => {
    if (!photo) return;
    await savePhoto({ ...photo, notes });
  };

  const handleDrawingAdded = async (path: DrawingPath) => {
    if (!photo) return;
    await savePhoto({
      ...photo,
      drawings: [...(photo.drawings ?? []), path],
      drawingViewport: { width: SCREEN_WIDTH, height: IMAGE_HEIGHT },
    });
  };

  const handleUndoDrawing = async () => {
    if (!photo || !photo.drawings?.length) return;
    const updated = [...photo.drawings];
    updated.pop();
    await savePhoto({ ...photo, drawings: updated });
  };

  const handleClearDrawings = async () => {
    if (!photo) return;
    Alert.alert('Clear All Drawings', 'Remove all drawings from this photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await savePhoto({ ...photo, drawings: [] }); } },
    ]);
  };

  const handleSeverityChange = async (severity: PhotoSeverity) => {
    if (!photo) return;
    await savePhoto({ ...photo, severity });
  };

  if (!photo) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1a3c5e" /></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled">

        <View style={styles.modeBar}>
          {([
            { m: 'view' as ActiveMode, icon: '👁', label: 'View' },
            { m: 'draw' as ActiveMode, icon: '✏️', label: 'Draw' },
          ] as const).map(({ m, icon, label }) => (
            <TouchableOpacity key={m} style={[styles.modeBtn, mode === m && styles.modeBtnActive]} onPress={() => setMode(m)}>
              <Text style={styles.modeBtnIcon}>{icon}</Text>
              <Text style={[styles.modeBtnLabel, mode === m && styles.modeBtnLabelActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.imageContainer}>
          <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="cover" />
          <DrawingCanvas
            width={SCREEN_WIDTH} height={IMAGE_HEIGHT}
            drawings={photo.drawings ?? []}
            activeShape={activeShape} activeColor={activeColor} strokeWidth={strokeWidth}
            enabled={mode === 'draw'} onDrawingAdded={handleDrawingAdded}
          />
          {mode === 'draw' && <Text style={styles.hintBadge}>Draw on the photo</Text>}
        </View>

        {mode === 'draw' && (
          <View style={styles.drawToolbar}>
            <View style={styles.toolRow}>
              {SHAPE_TOOLS.map(({ shape, icon, label }) => (
                <TouchableOpacity key={shape} style={[styles.shapeTool, activeShape === shape && styles.shapeToolActive]} onPress={() => setActiveShape(shape)}>
                  <Text style={styles.shapeIcon}>{icon}</Text>
                  <Text style={styles.shapeLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.colorRow}>
              {DRAW_COLORS.map((c) => (
                <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c }, activeColor === c && styles.colorDotSelected]} onPress={() => setActiveColor(c)} />
              ))}
            </View>
            <View style={styles.strokeRow}>
              <Text style={styles.strokeLabel}>Thickness:</Text>
              {[2, 3, 5, 8].map((w) => (
                <TouchableOpacity key={w} style={[styles.strokeBtn, strokeWidth === w && styles.strokeBtnActive]} onPress={() => setStrokeWidth(w)}>
                  <View style={[styles.strokePreview, { height: w, backgroundColor: strokeWidth === w ? 'white' : '#555' }]} />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.drawActions}>
              <TouchableOpacity style={styles.drawActionBtn} onPress={handleUndoDrawing} disabled={!photo.drawings?.length}>
                <Text style={styles.drawActionText}>↩ Undo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.drawActionBtn, styles.drawActionDanger]} onPress={handleClearDrawings} disabled={!photo.drawings?.length}>
                <Text style={[styles.drawActionText, { color: '#FF3B30' }]}>🗑 Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Severity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Severity Level</Text>
          <View style={styles.severityRow}>
            {SEVERITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.severityBtn,
                  { borderColor: opt.color },
                  (photo.severity || 'none') === opt.value && { backgroundColor: opt.color },
                ]}
                onPress={() => handleSeverityChange(opt.value)}
              >
                <Text
                  style={[
                    styles.severityBtnText,
                    { color: (photo.severity || 'none') === opt.value ? 'white' : opt.color },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inspector Notes</Text>
          <TextInput style={styles.notesInput} placeholder="Add notes about this photo…" value={notes} onChangeText={setNotes} multiline numberOfLines={4} textAlignVertical="top" onBlur={handleSaveNotes}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
          />
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNotes} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Save Notes</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modeBar: { flexDirection: 'row', backgroundColor: '#1a3c5e', paddingVertical: 6, paddingHorizontal: 12, gap: 8 },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
  modeBtnActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  modeBtnIcon: { fontSize: 18 },
  modeBtnLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  modeBtnLabelActive: { color: 'white', fontWeight: '700' },
  imageContainer: { width: SCREEN_WIDTH, height: IMAGE_HEIGHT, backgroundColor: '#000', position: 'relative' },
  image: { width: SCREEN_WIDTH, height: IMAGE_HEIGHT },
  hintBadge: { position: 'absolute', bottom: 8, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 12, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  drawToolbar: { backgroundColor: '#1e1e1e', paddingVertical: 10, paddingHorizontal: 12 },
  toolRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  shapeTool: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#444' },
  shapeToolActive: { borderColor: '#007AFF', backgroundColor: 'rgba(0,122,255,0.2)' },
  shapeIcon: { fontSize: 20, color: 'white' },
  shapeLabel: { fontSize: 10, color: '#aaa', marginTop: 2 },
  colorRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 10 },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorDotSelected: { borderColor: 'white', transform: [{ scale: 1.2 }] },
  strokeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  strokeLabel: { color: '#aaa', fontSize: 12 },
  strokeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', minWidth: 44 },
  strokeBtnActive: { backgroundColor: '#555' },
  strokePreview: { width: 24, borderRadius: 2 },
  drawActions: { flexDirection: 'row', gap: 10 },
  drawActionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#333', alignItems: 'center' },
  drawActionDanger: { backgroundColor: 'rgba(255,59,48,0.12)' },
  drawActionText: { color: 'white', fontSize: 13, fontWeight: '600' },
  section: { margin: 16, backgroundColor: 'white', borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a3c5e', marginBottom: 12 },
  severityRow: { flexDirection: 'row', gap: 8 },
  severityBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 2, alignItems: 'center' },
  severityBtnText: { fontWeight: '700', fontSize: 13 },
  notesInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 10, fontSize: 14, minHeight: 80, color: '#222', marginBottom: 10 },
  saveBtn: { backgroundColor: '#1a3c5e', paddingVertical: 11, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
});
