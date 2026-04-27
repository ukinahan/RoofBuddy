import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import { RootStackParamList, Inspection, QuoteLineItem, CompanyProfile } from '../types';
import { getInspection, updateInspection } from '../services/storage';
import { Loading, LoadFailure } from '../components/LoadFailure';
import { generateQuotePDF, shareQuotePDF, emailQuote } from '../services/report';
import { loadCompanyProfile, DEFAULT_COMPANY } from '../services/company';
import { loadLocale, formatCurrencyWith, formatLength, formatArea, LocaleSettings } from '../services/locale';
import { getRateBook, CATEGORIES, RateItem } from '../services/rateBook';
import { useResponsive } from '../utils/responsive';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Quote'>;
type Route = RouteProp<RootStackParamList, 'Quote'>;

const DEFAULT_LOCALE: LocaleSettings = { region: 'IE', language: 'en', units: 'metric', currency: 'EUR' };

export default function QuoteScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { inspectionId } = route.params;

  const { contentMaxWidth } = useResponsive();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(DEFAULT_COMPANY);
  const [locale, setLocale] = useState<LocaleSettings>(DEFAULT_LOCALE);
  const formatCurrency = (n: number) => formatCurrencyWith(n, locale);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<QuoteLineItem | null>(null);
  const [fieldQty, setFieldQty] = useState('');
  const [fieldDesc, setFieldDesc] = useState('');
  const [fieldPrice, setFieldPrice] = useState('');
  const [rateBookVisible, setRateBookVisible] = useState(false);
  const [rateCategory, setRateCategory] = useState<RateItem['category']>('tiles');

  useEffect(() => {
    (async () => {
      const profile = await loadCompanyProfile();
      setCompanyProfile(profile);
      const l = await loadLocale();
      setLocale(l);
    })();
  }, []);

  const load = useCallback(async () => {
    const data = await getInspection(inspectionId);
    setInspection(data);
    setLoading(false);
  }, [inspectionId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveItems = async (items: QuoteLineItem[]) => {
    if (!inspection) return;
    const updated = { ...inspection, quote: { lineItems: items } };
    await updateInspection(updated);
    setInspection(updated);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFieldQty('');
    setFieldDesc('');
    setFieldPrice('');
    setModalVisible(true);
  };

  const openEditModal = (item: QuoteLineItem) => {
    setEditingItem(item);
    setFieldQty(item.qty);
    setFieldDesc(item.description);
    setFieldPrice(item.totalPrice > 0 ? item.totalPrice.toString() : '');
    setModalVisible(true);
  };

  const handleSaveItem = async () => {
    if (!fieldDesc.trim()) {
      Alert.alert('Required', 'Please enter a description for this line item.');
      return;
    }
    const price = parseFloat(fieldPrice.replace(/[^0-9.]/g, '')) || 0;
    const items = inspection?.quote.lineItems ?? [];

    let updatedItems: QuoteLineItem[];
    if (editingItem) {
      updatedItems = items.map((i) =>
        i.id === editingItem.id
          ? { ...i, qty: fieldQty.trim(), description: fieldDesc.trim(), totalPrice: price }
          : i
      );
    } else {
      updatedItems = [
        ...items,
        { id: uuidv4(), qty: fieldQty.trim(), description: fieldDesc.trim(), totalPrice: price },
      ];
    }

    await saveItems(updatedItems);
    setModalVisible(false);
  };

  const handlePullFromPhotos = useCallback(() => {
    if (!inspection) return;
    let totalAreaM2 = 0;
    let totalLengthM = 0;
    let areaCount = 0;
    let lengthCount = 0;
    let uncalibratedPhotos = 0;

    for (const photo of inspection.photos) {
      const ppm = photo.pixelsPerMeter;
      const measurements = (photo.drawings ?? []).filter(
        (d) => d.shape === 'measure-line' || d.shape === 'measure-area',
      );
      if (measurements.length === 0) continue;
      if (!ppm || ppm <= 0) {
        uncalibratedPhotos += 1;
        continue;
      }
      for (const d of measurements) {
        if (d.shape === 'measure-line') {
          const [x1, y1, x2, y2] = d.data.split(',').map(Number);
          const px = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
          totalLengthM += px / ppm;
          lengthCount += 1;
        } else if (d.shape === 'measure-area') {
          const [, , w, h] = d.data.split(',').map(Number);
          totalAreaM2 += (w / ppm) * (h / ppm);
          areaCount += 1;
        }
      }
    }

    if (lengthCount === 0 && areaCount === 0) {
      const msg = uncalibratedPhotos > 0
        ? `No measurements found. ${uncalibratedPhotos} photo(s) have measurements but aren\u2019t calibrated yet \u2014 open them and tap \u{1F3AF} Calibrate.`
        : 'No on-photo measurements found. Open a photo, calibrate the scale, then draw a Length or Area measurement.';
      Alert.alert('Nothing to pull', msg);
      return;
    }

    const newItems: QuoteLineItem[] = [];
    if (areaCount > 0) {
      newItems.push({
        id: uuidv4(),
        qty: formatArea(totalAreaM2, locale.units),
        description: `Roof area measured from ${areaCount} photo region(s)`,
        totalPrice: 0,
      });
    }
    if (lengthCount > 0) {
      newItems.push({
        id: uuidv4(),
        qty: formatLength(totalLengthM, locale.units),
        description: `Linear works measured from ${lengthCount} photo line(s)`,
        totalPrice: 0,
      });
    }

    const summary = newItems.map((i) => `\u2022 ${i.qty} \u2014 ${i.description}`).join('\n');
    const warn = uncalibratedPhotos > 0
      ? `\n\nNote: ${uncalibratedPhotos} photo(s) had measurements but no calibration and were skipped.`
      : '';
    Alert.alert(
      'Add to quote?',
      `${summary}\n\nPrices are blank \u2014 tap each line to set them.${warn}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async () => {
            const items = inspection.quote.lineItems ?? [];
            await saveItems([...items, ...newItems]);
          },
        },
      ],
    );
  }, [inspection, locale]);

  const handleDeleteItem = (id: string) => {
    Alert.alert('Remove Line Item', 'Remove this item from the quote?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const items = (inspection?.quote.lineItems ?? []).filter((i) => i.id !== id);
          await saveItems(items);
        },
      },
    ]);
  };

  const handleGenerate = async () => {
    if (!inspection) return;
    setGenerating(true);
    setPdfUri(null);
    try {
      const uri = await generateQuotePDF(inspection);
      setPdfUri(uri);
    } catch (err: unknown) {
      Alert.alert('PDF Error', err instanceof Error ? err.message : 'Could not generate PDF.');
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!pdfUri) return;
    try { await shareQuotePDF(pdfUri); }
    catch (err: unknown) { Alert.alert('Share Error', err instanceof Error ? err.message : 'Could not share.'); }
  };

  const handleEmail = async () => {
    if (!inspection || !pdfUri) return;
    try { await emailQuote(inspection, pdfUri); }
    catch (err: unknown) { Alert.alert('Email Error', err instanceof Error ? err.message : 'Could not open mail.'); }
  };

  if (loading) {
    return <Loading label="Loading quote…" />;
  }
  if (!inspection) {
    return (
      <LoadFailure
        title="Inspection not found"
        message="We couldn’t open this quote. The inspection may have been deleted."
        onRetry={load}
        onBack={() => navigation.goBack()}
      />
    );
  }

  const items = inspection.quote.lineItems;
  const subTotal = items.reduce((s, i) => s + i.totalPrice, 0);
  const vat = subTotal * companyProfile.vatRate;
  const grandTotal = subTotal + vat;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' },
        ]}
      >

        {/* Header info */}
        <View style={styles.headerCard}>
          <Text style={styles.headerRef}>Ref: {inspection.ref || '—'}</Text>
          <Text style={styles.headerCustomer}>{inspection.customerName}</Text>
          <Text style={styles.headerAddress}>{inspection.address}</Text>
          <Text style={styles.headerDate}>{new Date(inspection.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </View>

        {/* Line items */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>QTY</Text>
          <Text style={[styles.tableHeaderCell, { flex: 3 }]}>DESCRIPTION</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>TOTAL</Text>
        </View>

        {items.map((item) => (
          <TouchableOpacity key={item.id} style={styles.tableRow} onPress={() => openEditModal(item)} onLongPress={() => handleDeleteItem(item.id)} activeOpacity={0.7}>
            <Text style={[styles.tableCell, { flex: 0.7, color: '#555' }]}>{item.qty}</Text>
            <Text style={[styles.tableCell, { flex: 3 }]}>{item.description}</Text>
            <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', fontWeight: '600' }]}>{formatCurrency(item.totalPrice)}</Text>
          </TouchableOpacity>
        ))}

        {items.length === 0 && (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>No line items yet. Tap below to add works.</Text>
          </View>
        )}

        <TouchableOpacity style={styles.addItemBtn} onPress={openAddModal} activeOpacity={0.85}>
          <Text style={styles.addItemText}>+ Add Line Item</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pullBtn} onPress={handlePullFromPhotos} activeOpacity={0.85}>
          <Text style={styles.pullBtnText}>{'\u{1F4D0} Pull from Photo Measurements'}</Text>
        </TouchableOpacity>

        {/* Totals */}
        {items.length > 0 && (
          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Sub Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(subTotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>VAT @ {(companyProfile.vatRate * 100).toFixed(1)}%</Text>
              <Text style={styles.totalValue}>{formatCurrency(vat)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(grandTotal)}</Text>
            </View>
          </View>
        )}

        {/* Generate button */}
        <TouchableOpacity
          style={[styles.generateBtn, (generating || items.length === 0) && styles.btnDisabled]}
          onPress={handleGenerate}
          disabled={generating || items.length === 0}
          activeOpacity={0.85}
        >
          {generating
            ? <ActivityIndicator color="white" size="small" />
            : <Text style={styles.generateBtnText}>{pdfUri ? '🔄  Regenerate Quote PDF' : '📄  Generate Quote PDF'}</Text>
          }
        </TouchableOpacity>

        {/* Share / Send */}
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

      {/* Add / Edit item modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Line Item' : 'Add Line Item'}</Text>

              {!editingItem && (
                <TouchableOpacity
                  style={styles.rateBookOpen}
                  onPress={() => setRateBookVisible(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.rateBookOpenText}>{'\u{1F4D6}  Pick from rate book'}</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.modalLabel}>Quantity (e.g. 104 m², 1 No., Allow)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 104 m²"
                value={fieldQty}
                onChangeText={setFieldQty}
                returnKeyType="next"
              />

              <Text style={styles.modalLabel}>Description of Works</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 100 }]}
                placeholder="Describe the work items..."
                value={fieldDesc}
                onChangeText={setFieldDesc}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={styles.modalLabel}>Total Price (ex VAT)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 19650"
                value={fieldPrice}
                onChangeText={setFieldPrice}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={handleSaveItem}>
                  <Text style={styles.modalSaveText}>{editingItem ? 'Save Changes' : 'Add Item'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Rate book picker */}
      <Modal visible={rateBookVisible} transparent animationType="slide" onRequestClose={() => setRateBookVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}> 
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>Rate book ({locale.region})</Text>
              <TouchableOpacity onPress={() => setRateBookVisible(false)}>
                <Text style={{ fontSize: 22, color: '#666' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 8 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setRateCategory(c.key)}
                  style={[styles.catChip, rateCategory === c.key && styles.catChipActive]}
                >
                  <Text style={[styles.catChipText, rateCategory === c.key && styles.catChipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView style={{ maxHeight: 380 }}>
              {getRateBook(locale.region)
                .filter((r) => r.category === rateCategory)
                .map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.rateRow}
                    onPress={() => {
                      setFieldQty('1 ' + r.unit);
                      setFieldDesc(r.description);
                      setFieldPrice(r.unitPrice.toString());
                      setRateBookVisible(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rateLabel}>{r.label}</Text>
                      <Text style={styles.rateDesc} numberOfLines={2}>{r.description}</Text>
                    </View>
                    <Text style={styles.ratePrice}>{formatCurrency(r.unitPrice)}<Text style={styles.rateUnit}>/{r.unit}</Text></Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <Text style={styles.rateNote}>Suggested prices only. Adjust for access, pitch and local labour.</Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 16 },
  headerRef: { fontSize: 15, fontWeight: '700', color: '#1a3c5e' },
  headerCustomer: { fontSize: 14, color: '#333', marginTop: 4 },
  headerAddress: { fontSize: 13, color: '#666', marginTop: 2 },
  headerDate: { fontSize: 12, color: '#999', marginTop: 2 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1a3c5e', borderRadius: 8, padding: 10, marginBottom: 2 },
  tableHeaderCell: { color: 'white', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', backgroundColor: 'white', padding: 12, marginBottom: 2, borderRadius: 6, alignItems: 'flex-start' },
  tableCell: { fontSize: 13, color: '#222', lineHeight: 18 },
  emptyRow: { backgroundColor: 'white', borderRadius: 8, padding: 24, alignItems: 'center', marginBottom: 2 },
  emptyText: { color: '#999', fontSize: 14, textAlign: 'center' },
  addItemBtn: { borderWidth: 2, borderColor: '#1a3c5e', borderStyle: 'dashed', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8, marginBottom: 8 },
  addItemText: { color: '#1a3c5e', fontSize: 14, fontWeight: '700' },
  pullBtn: { backgroundColor: '#e8f1ff', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 16 },
  pullBtnText: { color: '#1a3c5e', fontSize: 13, fontWeight: '600' },
  totalsCard: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  totalLabel: { fontSize: 14, color: '#555' },
  totalValue: { fontSize: 14, color: '#222' },
  grandTotalRow: { borderBottomWidth: 0, marginTop: 4, borderTopWidth: 2, borderTopColor: '#1a3c5e', paddingTop: 10 },
  grandTotalLabel: { fontSize: 16, fontWeight: '700', color: '#1a3c5e' },
  grandTotalValue: { fontSize: 16, fontWeight: '700', color: '#1a3c5e' },
  generateBtn: { backgroundColor: '#2e8b57', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.5 },
  generateBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
  shareRow: { flexDirection: 'row', gap: 10 },
  shareBtn: { flex: 1, backgroundColor: '#1a3c5e', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  emailBtn: { flex: 1, backgroundColor: '#c0392b', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  shareIcon: { fontSize: 22, marginBottom: 2 },
  shareBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1a3c5e', marginBottom: 16 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  modalInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 12, fontSize: 14, color: '#222', backgroundColor: '#fafafa', marginBottom: 14 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  modalCancelText: { color: '#555', fontSize: 14, fontWeight: '600' },
  modalSave: { flex: 2, backgroundColor: '#1a3c5e', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  modalSaveText: { color: 'white', fontSize: 14, fontWeight: '700' },
  // Rate book
  rateBookOpen: { backgroundColor: '#e8f1ff', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 14 },
  rateBookOpenText: { color: '#1a3c5e', fontWeight: '700', fontSize: 13 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0' },
  catChipActive: { backgroundColor: '#1a3c5e' },
  catChipText: { fontSize: 12, fontWeight: '600', color: '#555' },
  catChipTextActive: { color: 'white' },
  rateRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'center' },
  rateLabel: { fontSize: 14, fontWeight: '700', color: '#222' },
  rateDesc: { fontSize: 12, color: '#777', marginTop: 2 },
  ratePrice: { fontSize: 14, fontWeight: '700', color: '#1a3c5e', marginLeft: 12 },
  rateUnit: { fontSize: 11, color: '#888', fontWeight: '500' },
  rateNote: { fontSize: 11, color: '#999', textAlign: 'center', marginTop: 12 },
});
