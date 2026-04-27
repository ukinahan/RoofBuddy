import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, FlatList,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Customer, Inspection, RootStackParamList } from '../types';
import { getCustomer, upsertCustomer, deleteCustomer } from '../services/customers';
import { loadInspections } from '../services/storage';
import { LoadFailure } from '../components/LoadFailure';
import { loadCompanyProfile } from '../services/company';
import { loadLocale, formatCurrencyWith, LocaleSettings } from '../services/locale';
import InspectionCard from '../components/InspectionCard';
import { useT } from '../services/i18n';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CustomerDetail'>;
type Route = RouteProp<RootStackParamList, 'CustomerDetail'>;

export default function CustomerDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { customerId } = route.params;
  const t = useT();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [editing, setEditing] = useState(false);
  const [vatRate, setVatRate] = useState(0);
  const [locale, setLocale] = useState<LocaleSettings | null>(null);

  const load = useCallback(async () => {
    const c = await getCustomer(customerId);
    setCustomer(c);
    const all = await loadInspections();
    setInspections(
      all.filter((i) => {
        if (i.customerId === customerId) return true;
        if (!c) return false;
        return (
          i.customerName?.trim().toLowerCase() === c.name.trim().toLowerCase() &&
          i.address?.trim().toLowerCase() === c.address.trim().toLowerCase()
        );
      })
    );
    const profile = await loadCompanyProfile();
    setVatRate(profile.vatRate ?? 0);
    const l = await loadLocale();
    setLocale(l);
  }, [customerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async () => {
    if (!customer) return;
    await upsertCustomer(customer);
    setEditing(false);
  };

  const handleDelete = () => {
    if (!customer) return;
    Alert.alert('Delete Customer', `Delete ${customer.name}? Their inspections will not be deleted.`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteCustomer(customerId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (!customer) {
    return (
      <LoadFailure
        title="Customer not found"
        message="This customer record may have been deleted."
        onBack={() => navigation.goBack()}
      />
    );
  }

  const totalPhotos = inspections.reduce((sum, i) => sum + (i.photos?.length ?? 0), 0);
  const totalQuotedExVat = inspections.reduce(
    (sum, i) => sum + (i.quote?.lineItems ?? []).reduce((s, li) => s + (li.totalPrice || 0), 0),
    0,
  );
  const totalQuotedIncVat = totalQuotedExVat * (1 + vatRate);
  const lastInspectionDate = inspections.length
    ? inspections.map((i) => i.date).sort().slice(-1)[0]
    : null;
  const fmtMoney = (n: number) => locale ? formatCurrencyWith(n, locale) : `€${n.toFixed(0)}`;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Field label="Name" value={customer.name} editing={editing}
          onChangeText={(v) => setCustomer({ ...customer, name: v })} />
        <Field label="Email" value={customer.email} editing={editing}
          onChangeText={(v) => setCustomer({ ...customer, email: v })} keyboardType="email-address" />
        <Field label="Phone" value={customer.phone} editing={editing}
          onChangeText={(v) => setCustomer({ ...customer, phone: v })} keyboardType="phone-pad" />
        <Field label="Address" value={customer.address} editing={editing}
          onChangeText={(v) => setCustomer({ ...customer, address: v })} />
        <Field label="Notes" value={customer.notes} editing={editing}
          onChangeText={(v) => setCustomer({ ...customer, notes: v })} multiline />

        <View style={styles.actionRow}>
          {editing ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={handleSave}>
              <Text style={styles.btnPrimaryText}>{t('common.save')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.btnPrimary} onPress={() => setEditing(true)}>
              <Text style={styles.btnPrimaryText}>Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btnDanger} onPress={handleDelete}>
            <Text style={styles.btnDangerText}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {inspections.length > 0 && (
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Activity</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{inspections.length}</Text>
              <Text style={styles.statLabel}>Inspections</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{totalPhotos}</Text>
              <Text style={styles.statLabel}>Photos</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{fmtMoney(totalQuotedIncVat)}</Text>
              <Text style={styles.statLabel}>Total quoted</Text>
            </View>
          </View>
          {lastInspectionDate && (
            <Text style={styles.statFootnote}>Last inspection: {lastInspectionDate}</Text>
          )}
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('customers.detail.inspections')} ({inspections.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('NewInspection', { customerId })}>
            <Text style={styles.addLink}>{t('customers.detail.add')}</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={inspections}
          keyExtractor={(i) => i.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <InspectionCard
              inspection={item}
              onPress={() => navigation.navigate('Inspection', { inspectionId: item.id })}
              onDelete={() => { /* deletion handled in Home */ }}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No inspections yet for this customer.</Text>}
        />
      </View>
    </ScrollView>
  );
}

function Field({
  label, value, editing, onChangeText, keyboardType, multiline,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editing ? (
        <TextInput
          style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
          value={value} onChangeText={onChangeText}
          keyboardType={keyboardType} multiline={multiline}
        />
      ) : (
        <Text style={styles.value}>{value || '—'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, margin: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#1a3c5e', letterSpacing: 0.5, marginBottom: 4 },
  value: { fontSize: 15, color: '#222' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, color: '#222', backgroundColor: '#fafafa' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: '#1a3c5e', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnPrimaryText: { color: 'white', fontWeight: '700' },
  btnDanger: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#d32f2f' },
  btnDangerText: { color: '#d32f2f', fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a3c5e' },
  addLink: { color: '#1a3c5e', fontWeight: '700' },
  empty: { color: '#888', textAlign: 'center', padding: 20 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCell: { flex: 1, backgroundColor: '#f5f8fc', borderRadius: 10, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1a3c5e' },
  statLabel: { fontSize: 11, color: '#666', marginTop: 4, textAlign: 'center' },
  statFootnote: { fontSize: 11, color: '#888', marginTop: 10, textAlign: 'center' },
});