import React, { useCallback, useState } from 'react';
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
import { RootStackParamList, Inspection, QuoteLineItem } from '../types';
import { getInspection, updateInspection } from '../services/storage';
import { generateQuotePDF, shareQuotePDF, emailQuote } from '../services/report';
import { COMPANY } from '../services/company';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Quote'>;
type Route = RouteProp<RootStackParamList, 'Quote'>;

const formatCurrency = (amount: number) =>
  '€' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export default function QuoteScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { inspectionId } = route.params;

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<QuoteLineItem | null>(null);
  const [fieldQty, setFieldQty] = useState('');
  const [fieldDesc, setFieldDesc] = useState('');
  const [fieldPrice, setFieldPrice] = useState('');

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

  if (loading || !inspection) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1a3c5e" /></View>;
  }

  const items = inspection.quote.lineItems;
  const subTotal = items.reduce((s, i) => s + i.totalPrice, 0);
  const vat = subTotal * COMPANY.vatRate;
  const grandTotal = subTotal + vat;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

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

        {/* Totals */}
        {items.length > 0 && (
          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Sub Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(subTotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>VAT @ {(COMPANY.vatRate * 100).toFixed(1)}%</Text>
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

        {/* Share / Email */}
        {pdfUri && (
          <View style={styles.shareRow}>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <Text style={styles.shareBtnText}>📤  Share / Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emailBtn} onPress={handleEmail} activeOpacity={0.85}>
              <Text style={styles.shareBtnText}>✉️  Email to Customer</Text>
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

              <Text style={styles.modalLabel}>Total Price (ex VAT) €</Text>
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
  addItemBtn: { borderWidth: 2, borderColor: '#1a3c5e', borderStyle: 'dashed', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8, marginBottom: 16 },
  addItemText: { color: '#1a3c5e', fontSize: 14, fontWeight: '700' },
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
  shareBtn: { flex: 1, backgroundColor: '#1a3c5e', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  emailBtn: { flex: 1, backgroundColor: '#c0392b', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  shareBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },
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
});
