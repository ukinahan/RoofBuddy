import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Inspection, InspectionPhoto, DrawingPath, DrawingShape, PhotoSeverity } from '../types';
import { DAMAGE_PRESETS } from '../services/damagePresets';
import { getInspection, updateInspection } from '../services/storage';
import { resolvePhotoUri } from '../services/photoUri';
import { loadLocale, LocaleSettings, formatLength } from '../services/locale';
import { useT } from '../services/i18n';
import DrawingCanvas from '../components/DrawingCanvas';
import SmartPhoto from '../components/SmartPhoto';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PhotoDetail'>;
type Route = RouteProp<RootStackParamList, 'PhotoDetail'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
// Default fallback for photos captured before width/height were persisted (4:3 landscape).
const DEFAULT_PHOTO_W = 1600;
const DEFAULT_PHOTO_H = 1200;

const DRAW_COLORS = ['#FF3B30', '#FF9500', '#34C759', '#007AFF', '#AF52DE', '#FFCC00', '#FFFFFF'];

const SEVERITY_OPTIONS: Array<{ value: PhotoSeverity; label: string; color: string }> = [
  { value: 'none', label: 'None', color: '#999' },
  { value: 'low', label: 'Low', color: '#388e3c' },
  { value: 'medium', label: 'Medium', color: '#f57c00' },
  { value: 'high', label: 'High', color: '#d32f2f' },
];

const SHAPE_TOOLS: Array<{ shape: DrawingShape; icon: string; label: string }> = [
  { shape: 'freehand', icon: '\u270F\uFE0F', label: 'Draw' },
  { shape: 'rectangle', icon: '\u25AD', label: 'Box' },
  { shape: 'circle', icon: '\u25CB', label: 'Circle' },
  { shape: 'arrow', icon: '\u2192', label: 'Arrow' },
  { shape: 'measure-line', icon: '\u{1F4CF}', label: 'Length' },
  { shape: 'measure-area', icon: '\u25A2', label: 'Area' },
  { shape: 'calibration', icon: '\u{1F3AF}', label: 'Calibrate' },
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
  const [isDrawingActive, setIsDrawingActive] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const [locale, setLocale] = useState<LocaleSettings | null>(null);
  const t = useT();

  // Calibration modal state
  const [pendingCalibration, setPendingCalibration] = useState<DrawingPath | null>(null);
  const [calibrationInput, setCalibrationInput] = useState('');

  useEffect(() => { loadLocale().then(setLocale); }, []);

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

  // ─ Prev / Next photo navigation ────────────────────────────────────────
  const photoIndex = inspection?.photos.findIndex((p) => p.id === photoId) ?? -1;
  const total = inspection?.photos.length ?? 0;
  const hasPrev = photoIndex > 0;
  const hasNext = photoIndex >= 0 && photoIndex < total - 1;

  const goTo = useCallback(
    async (offset: number) => {
      if (!inspection || !photo) return;
      const target = inspection.photos[photoIndex + offset];
      if (!target) return;
      // Persist any pending notes before swiping away.
      if (notes !== photo.notes) {
        await savePhoto({ ...photo, notes });
      }
      navigation.setParams({ photoId: target.id } as any);
    },
    [inspection, photo, photoIndex, notes, navigation]
  );

  useLayoutEffect(() => {
    if (total <= 1) return;
    navigation.setOptions({
      title: `Photo ${photoIndex + 1} of ${total}`,
      headerLeft: hasPrev
        ? () => (
            <TouchableOpacity onPress={() => goTo(-1)} style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>←</Text>
            </TouchableOpacity>
          )
        : undefined,
      headerRight: hasNext
        ? () => (
            <TouchableOpacity onPress={() => goTo(1)} style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>→</Text>
            </TouchableOpacity>
          )
        : undefined,
    });
  }, [navigation, photoIndex, total, hasPrev, hasNext, goTo]);

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

  const handleSaveNotesAndExit = async () => {
    if (!photo) return;
    await savePhoto({ ...photo, notes });
    navigation.goBack();
  };

  const handleDrawingAdded = async (path: DrawingPath) => {
    if (!photo) return;
    // Calibration is captured separately — ask user for the real-world length.
    if (path.shape === 'calibration') {
      setPendingCalibration(path);
      setCalibrationInput('');
      return;
    }
    await savePhoto({
      ...photo,
      drawings: [...(photo.drawings ?? []), path],
      drawingViewport: { width: canvasW, height: canvasH },
    });
  };

  const handleConfirmCalibration = async () => {
    if (!photo || !pendingCalibration) return;
    const metres = parseFloat(calibrationInput.replace(',', '.'));
    if (!Number.isFinite(metres) || metres <= 0) {
      Alert.alert('Invalid value', 'Enter a positive number in metres.');
      return;
    }
    const [x1, y1, x2, y2] = pendingCalibration.data.split(',').map(Number);
    const px = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const ppm = px / metres;
    const finalisedPath: DrawingPath = {
      ...pendingCalibration,
      data: `${pendingCalibration.data}|${metres}`,
    };
    // Replace any existing calibration line with this one (only one calibration per photo).
    const otherDrawings = (photo.drawings ?? []).filter((d) => d.shape !== 'calibration');
    await savePhoto({
      ...photo,
      pixelsPerMeter: ppm,
      drawings: [...otherDrawings, finalisedPath],
      drawingViewport: { width: canvasW, height: canvasH },
    });
    setPendingCalibration(null);
    setCalibrationInput('');

    // Offer to apply this scale to other uncalibrated photos in the same
    // inspection. Only meaningful if photos were taken at a similar distance —
    // we ask rather than assume.
    if (inspection) {
      const uncalibrated = inspection.photos.filter(
        (p) => p.id !== photoId && (!p.pixelsPerMeter || p.pixelsPerMeter <= 0),
      );
      if (uncalibrated.length > 0) {
        Alert.alert(
          'Apply scale to other photos?',
          `Use this calibration (${ppm.toFixed(0)} px/m) for the ${uncalibrated.length} other uncalibrated photo(s) in this inspection? Only do this if those photos were taken from a similar distance.`,
          [
            { text: 'No, just this one', style: 'cancel' },
            {
              text: 'Yes, apply to all',
              onPress: async () => {
                if (!inspection) return;
                const updatedPhotos = inspection.photos.map((p) =>
                  p.id === photoId || (p.pixelsPerMeter && p.pixelsPerMeter > 0)
                    ? p
                    : { ...p, pixelsPerMeter: ppm },
                );
                const updatedInspection = { ...inspection, photos: updatedPhotos };
                await updateInspection(updatedInspection);
                setInspection(updatedInspection);
              },
            },
          ],
        );
      }
    }
  };

  const handleCancelCalibration = () => {
    setPendingCalibration(null);
    setCalibrationInput('');
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

  // Canvas size matches the photo's real aspect so drawings stay aligned with no
  // letterboxing or stretch. Falls back to 4:3 landscape for legacy photos.
  const photoW = photo.width ?? DEFAULT_PHOTO_W;
  const photoH = photo.height ?? DEFAULT_PHOTO_H;
  const canvasW = SCREEN_WIDTH;
  const canvasH = SCREEN_WIDTH * (photoH / photoW);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}
        scrollEnabled={!isDrawingActive}
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

        <View style={[styles.imageContainer, { width: canvasW, height: canvasH }]}>
          <SmartPhoto photo={photo} style={{ width: canvasW, height: canvasH }} resizeMode="contain" />
          <DrawingCanvas
            width={canvasW} height={canvasH}
            drawings={photo.drawings ?? []}
            activeShape={activeShape} activeColor={activeColor} strokeWidth={strokeWidth}
            enabled={mode === 'draw'} onDrawingAdded={handleDrawingAdded}
            pixelsPerMeter={photo.pixelsPerMeter}
            units={locale?.units ?? 'metric'}
            onDrawStart={() => setIsDrawingActive(true)}
            onDrawEnd={() => setIsDrawingActive(false)}
          />
          {mode === 'draw' && <Text style={styles.hintBadge}>Draw on the photo</Text>}
        </View>

        {mode === 'draw' && (
          <View style={styles.drawToolbar}>
            {/* Calibration status banner */}
            {(activeShape === 'measure-line' || activeShape === 'measure-area') && !photo.pixelsPerMeter && (
              <View style={styles.calibBanner}>
                <Text style={styles.calibBannerText}>
                  {'\u26A0\uFE0F  Tap \u{1F3AF} Calibrate first \u2014 measurements will show in pixels until then.'}
                </Text>
              </View>
            )}
            {photo.pixelsPerMeter && (
              <View style={styles.calibInfo}>
                <Text style={styles.calibInfoText}>
                  {`\u2705 Calibrated (${photo.pixelsPerMeter.toFixed(0)} px/m)`}
                </Text>
                <TouchableOpacity onPress={async () => {
                  Alert.alert('Reset calibration?', 'Existing measurements will lose their scale.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset', style: 'destructive', onPress: async () => {
                        await savePhoto({
                          ...photo,
                          pixelsPerMeter: undefined,
                          drawings: (photo.drawings ?? []).filter((d) => d.shape !== 'calibration'),
                        });
                      },
                    },
                  ]);
                }}>
                  <Text style={styles.calibResetText}>Reset</Text>
                </TouchableOpacity>
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolRow}>
              {SHAPE_TOOLS.map(({ shape, icon, label }) => (
                <TouchableOpacity key={shape} style={[styles.shapeTool, activeShape === shape && styles.shapeToolActive]} onPress={() => setActiveShape(shape)}>
                  <Text style={styles.shapeIcon}>{icon}</Text>
                  <Text style={styles.shapeLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
          <Text style={styles.sectionTitle}>Damage Found</Text>
          <Text style={styles.damageHint}>Tap any that apply. Counts roll up into the report.</Text>
          <View style={styles.damageWrap}>
            {DAMAGE_PRESETS.map((d) => {
              const active = (photo.damageTags ?? []).includes(d.key);
              return (
                <TouchableOpacity
                  key={d.key}
                  style={[styles.damageChip, active && styles.damageChipActive]}
                  onPress={async () => {
                    const current = photo.damageTags ?? [];
                    const next = active ? current.filter((k) => k !== d.key) : [...current, d.key];
                    await savePhoto({ ...photo, damageTags: next });
                  }}
                >
                  <Text style={[styles.damageChipText, active && styles.damageChipTextActive]}>
                    {d.icon} {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inspector Notes</Text>
          <TextInput style={styles.notesInput} placeholder="Add notes about this photo…" value={notes} onChangeText={setNotes} multiline numberOfLines={4} textAlignVertical="top" onBlur={handleSaveNotes}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
          />
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNotesAndExit} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Save Notes</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Calibration modal */}
      <Modal visible={!!pendingCalibration} transparent animationType="fade" onRequestClose={handleCancelCalibration}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set scale</Text>
            <Text style={styles.modalBody}>
              How long is the line you just drew, in metres? Use a known reference like a brick course or roof tile.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={calibrationInput}
              onChangeText={setCalibrationInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 1.5"
              autoFocus
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={handleCancelCalibration}>
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleConfirmCalibration}>
                <Text style={styles.modalBtnPrimaryText}>Save scale</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  imageContainer: { backgroundColor: '#000', position: 'relative' },
  image: { width: '100%', height: '100%' },
  hintBadge: { position: 'absolute', bottom: 8, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 12, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  drawToolbar: { backgroundColor: '#1e1e1e', paddingVertical: 10, paddingHorizontal: 12 },
  toolRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 10, gap: 8 },
  shapeTool: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#444', marginRight: 6, minWidth: 64 },
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
  damageHint: { fontSize: 12, color: '#777', marginTop: -6, marginBottom: 10 },
  damageWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  damageChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0' },
  damageChipActive: { backgroundColor: '#1a3c5e', borderColor: '#1a3c5e' },
  damageChipText: { fontSize: 12, fontWeight: '600', color: '#555' },
  damageChipTextActive: { color: 'white' },
  notesInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 10, fontSize: 14, minHeight: 80, color: '#222', marginBottom: 10 },
  saveBtn: { backgroundColor: '#1a3c5e', paddingVertical: 11, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  calibBanner: { backgroundColor: 'rgba(255,149,0,0.18)', borderRadius: 6, padding: 8, marginBottom: 8 },
  calibBannerText: { color: '#FFB84D', fontSize: 12, textAlign: 'center' },
  calibInfo: { backgroundColor: 'rgba(52,199,89,0.15)', borderRadius: 6, padding: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calibInfoText: { color: '#7BE495', fontSize: 12 },
  calibResetText: { color: '#FF3B30', fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: 'white', borderRadius: 14, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a3c5e', marginBottom: 8 },
  modalBody: { fontSize: 13, color: '#555', marginBottom: 14, lineHeight: 18 },
  modalInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 14 },
  modalRow: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnPrimary: { backgroundColor: '#1a3c5e' },
  modalBtnPrimaryText: { color: 'white', fontWeight: '700' },
  modalBtnSecondary: { backgroundColor: '#eee' },
  modalBtnSecondaryText: { color: '#333', fontWeight: '600' },
});
