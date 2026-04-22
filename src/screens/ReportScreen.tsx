import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Inspection } from '../types';
import { getInspection, updateInspection } from '../services/storage';
import { generatePDF, sharePDF, emailReport } from '../services/report';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Report'>;
type Route = RouteProp<RootStackParamList, 'Report'>;

export default function ReportScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { inspectionId } = route.params;

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);

  // ── Report detail fields ────────────────────────────────────────────────
  const [conditions, setConditions] = useState('');
  const [scopeOfWorks, setScopeOfWorks] = useState('Roof Survey');
  const [overview, setOverview] = useState('');
  const [reportNo, setReportNo] = useState('01');
  const [conclusion, setConclusion] = useState('');
  const [costOfRepairs, setCostOfRepairs] = useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const data = await getInspection(inspectionId);
        setInspection(data);
        if (data) {
          setConditions(data.conditions || '');
          setScopeOfWorks(data.scopeOfWorks || 'Roof Survey');
          setOverview(data.overview || '');
          setReportNo(data.reportNo || '01');
          setConclusion(data.conclusion || '');
          setCostOfRepairs(data.costOfRepairs ? data.costOfRepairs.toString() : '');
        }
        setLoading(false);
      })();
    }, [inspectionId])
  );

  const buildUpdatedInspection = (): Inspection => ({
    ...inspection!,
    conditions: conditions.trim(),
    scopeOfWorks: scopeOfWorks.trim() || 'Roof Survey',
    overview: overview.trim(),
    reportNo: reportNo.trim() || '01',
    conclusion: conclusion.trim(),
    costOfRepairs: parseFloat(costOfRepairs) || 0,
  });

  const handleSaveDetails = async () => {
    if (!inspection) return;
    const updated = buildUpdatedInspection();
    await updateInspection(updated);
    setInspection(updated);
    Alert.alert('Saved', 'Report details have been saved.');
  };

  const handleGenerate = async () => {
    if (!inspection) return;
    setGenerating(true);
    setPdfUri(null);
    try {
      const updated = buildUpdatedInspection();
      await updateInspection(updated);
      setInspection(updated);
      const uri = await generatePDF(updated);
      setPdfUri(uri);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not generate PDF.';
      Alert.alert('PDF Error', msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!pdfUri) return;
    try {
      await sharePDF(pdfUri);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not share.';
      Alert.alert('Share Error', msg);
    }
  };

  const handleEmail = async () => {
    if (!inspection || !pdfUri) return;
    try {
      await emailReport(inspection, pdfUri);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not open mail.';
      Alert.alert('Email Error', msg);
    }
  };

  if (loading || !inspection) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a3c5e" />
      </View>
    );
  }

  const highCount = inspection.photos.filter((p) => p.severity === 'high').length;
  const medCount = inspection.photos.filter((p) => p.severity === 'medium').length;
  const lowCount = inspection.photos.filter((p) => p.severity === 'low').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Summary card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Inspection Summary</Text>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Customer</Text><Text style={styles.infoValue}>{inspection.customerName}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Address</Text><Text style={styles.infoValue}>{inspection.address}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Date</Text><Text style={styles.infoValue}>{new Date(inspection.date).toLocaleDateString()}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Photos</Text><Text style={styles.infoValue}>{inspection.photos.length}</Text></View>
      </View>

      {/* Report details card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Report Details</Text>

        <Text style={styles.fieldLabel}>Conditions</Text>
        <TextInput
          style={styles.detailInput}
          placeholder="e.g. Cloudy and Dry"
          value={conditions}
          onChangeText={setConditions}
          autoCapitalize="sentences"
        />

        <Text style={styles.fieldLabel}>Scope of Works</Text>
        <TextInput
          style={styles.detailInput}
          placeholder="e.g. Roof Survey"
          value={scopeOfWorks}
          onChangeText={setScopeOfWorks}
          autoCapitalize="sentences"
        />

        <Text style={styles.fieldLabel}>Overview / Reason for Survey</Text>
        <TextInput
          style={[styles.detailInput, styles.detailMultiline]}
          placeholder="e.g. Investigate and carry out a survey of the roof following reported leaks"
          value={overview}
          onChangeText={setOverview}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Text style={styles.fieldLabel}>Report No</Text>
        <TextInput
          style={styles.detailInput}
          placeholder="01"
          value={reportNo}
          onChangeText={setReportNo}
        />

        <Text style={styles.fieldLabel}>Conclusion</Text>
        <TextInput
          style={[styles.detailInput, styles.detailMultiline]}
          placeholder="Summary of findings and recommended works…"
          value={conclusion}
          onChangeText={setConclusion}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.fieldLabel}>Cost of Repairs ex-VAT (€)</Text>
        <TextInput
          style={styles.detailInput}
          placeholder="e.g. 6300"
          value={costOfRepairs}
          onChangeText={setCostOfRepairs}
          keyboardType="decimal-pad"
        />

        <TouchableOpacity style={styles.saveDetailsBtn} onPress={handleSaveDetails} activeOpacity={0.85}>
          <Text style={styles.saveDetailsBtnText}>Save Details</Text>
        </TouchableOpacity>
      </View>

      {/* Concern counts */}
      <View style={styles.countRow}>
        <View style={[styles.countCard, styles.highCard]}>
          <Text style={styles.countNumber}>{highCount}</Text>
          <Text style={styles.countLabel}>High</Text>
        </View>
        <View style={[styles.countCard, styles.medCard]}>
          <Text style={styles.countNumber}>{medCount}</Text>
          <Text style={styles.countLabel}>Medium</Text>
        </View>
        <View style={[styles.countCard, styles.lowCard]}>
          <Text style={styles.countNumber}>{lowCount}</Text>
          <Text style={styles.countLabel}>Low</Text>
        </View>
      </View>

      {/* Photo thumbnails */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Photos ({inspection.photos.length})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {inspection.photos.map((p, idx) => {
            const sev = p.severity || 'none';
            const sevColor = sev === 'high' ? '#d32f2f' : sev === 'medium' ? '#f57c00' : sev === 'low' ? '#388e3c' : '#999';
            return (
            <View key={p.id} style={styles.thumb}>
              <Image source={{ uri: p.uri }} style={styles.thumbImg} />
              <View style={[styles.thumbBadge, { backgroundColor: sevColor }]}>
                <Text style={styles.thumbBadgeText}>{sev === 'none' ? '–' : sev[0].toUpperCase()}</Text>
              </View>
            </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Generate PDF button */}
      <TouchableOpacity
        style={[styles.generateBtn, generating && styles.btnDisabled]}
        onPress={handleGenerate}
        disabled={generating}
        activeOpacity={0.85}
      >
        {generating ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <ActivityIndicator color="white" size="small" />
            <Text style={styles.generateBtnText}>Building Report…</Text>
          </View>
        ) : (
          <Text style={styles.generateBtnText}>
            {pdfUri ? '🔄  Regenerate PDF' : '📄  Generate PDF Report'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Share / Send buttons — only appear after PDF is generated */}
      {pdfUri && (
        <View style={styles.shareRow}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Text style={styles.shareIcon}>📤</Text>
            <Text style={styles.shareBtnText}>Share / Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.emailBtn} onPress={handleEmail} activeOpacity={0.85}>
            <Text style={styles.shareIcon}>✉️</Text>
            <Text style={styles.shareBtnText}>Send to Customer</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1a3c5e', marginBottom: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  infoLabel: { fontSize: 13, color: '#888' },
  infoValue: { fontSize: 13, color: '#222', fontWeight: '500', flex: 1, textAlign: 'right' },
  countRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  countCard: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  highCard: { backgroundColor: '#ffebee', borderWidth: 1, borderColor: '#ef9a9a' },
  medCard: { backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ffcc80' },
  lowCard: { backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#a5d6a7' },
  countNumber: { fontSize: 28, fontWeight: '700' },
  countLabel: { fontSize: 11, color: '#555', marginTop: 2 },
  thumb: { position: 'relative', marginRight: 10 },
  thumbImg: { width: 80, height: 80, borderRadius: 8 },
  thumbBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#1a3c5e',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  thumbBadgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
  generateBtn: {
    backgroundColor: '#2e8b57',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.6 },
  generateBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  shareRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  shareBtn: {
    flex: 1,
    backgroundColor: '#1a3c5e',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  emailBtn: {
    flex: 1,
    backgroundColor: '#c0392b',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  shareIcon: { fontSize: 22, marginBottom: 2 },
  shareBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 0.5, marginTop: 10, marginBottom: 4 },
  detailInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#222',
  },
  detailMultiline: { minHeight: 80, paddingTop: 9 },
  saveDetailsBtn: {
    marginTop: 14,
    backgroundColor: '#2e5e9e',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveDetailsBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },
});
