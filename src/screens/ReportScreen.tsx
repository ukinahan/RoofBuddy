import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
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
import { getInspection } from '../services/storage';
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

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const data = await getInspection(inspectionId);
        setInspection(data);
        setLoading(false);
      })();
    }, [inspectionId])
  );

  const handleGenerate = async () => {
    if (!inspection) return;
    setGenerating(true);
    setPdfUri(null);
    try {
      const uri = await generatePDF(inspection);
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

  const allAnnotations = inspection.photos.flatMap((p) => p.annotations);
  const highCount = allAnnotations.filter((a) => a.severity === 'high').length;
  const medCount = allAnnotations.filter((a) => a.severity === 'medium').length;
  const lowCount = allAnnotations.filter((a) => a.severity === 'low').length;

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
          {inspection.photos.map((p, idx) => (
            <View key={p.id} style={styles.thumb}>
              <Image source={{ uri: p.uri }} style={styles.thumbImg} />
              <View style={styles.thumbBadge}>
                <Text style={styles.thumbBadgeText}>{p.annotations.length}</Text>
              </View>
            </View>
          ))}
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

      {/* Share / Email buttons — only appear after PDF is generated */}
      {pdfUri && (
        <View style={styles.shareRow}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Text style={styles.shareBtnText}>📤  Share / Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.emailBtn} onPress={handleEmail} activeOpacity={0.85}>
            <Text style={styles.shareBtnText}>✉️  Send to Customer</Text>
          </TouchableOpacity>
        </View>
      )}

      {pdfUri && (
        <Text style={styles.pdfNote}>
          PDF saved to temporary storage. Share or email it before closing the app.
        </Text>
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
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  emailBtn: {
    flex: 1,
    backgroundColor: '#c0392b',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  shareBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },
  pdfNote: { fontSize: 12, color: '#888', textAlign: 'center', paddingHorizontal: 20 },
});
