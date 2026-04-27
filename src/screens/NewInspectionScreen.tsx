import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { v4 as uuidv4 } from 'uuid';
import { RootStackParamList, Inspection, Customer } from '../types';
import { addInspection } from '../services/storage';
import { loadCompanyProfile } from '../services/company';
import {
  loadCustomers,
  findOrCreateCustomerByNameAddress,
  getCustomer,
} from '../services/customers';
import { loadLocale, getPostcodeLabel, Region } from '../services/locale';
import { useResponsive } from '../utils/responsive';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NewInspection'>;
type Route = RouteProp<RootStackParamList, 'NewInspection'>;

export default function NewInspectionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { contentMaxWidth } = useResponsive();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [address, setAddress] = useState('');
  const [ref, setRef] = useState('');
  const [scopeOfWorks, setScopeOfWorks] = useState('Roof Survey');
  const [inspectorName, setInspectorName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [defaultInspector, setDefaultInspector] = useState('');
  const [region, setRegion] = useState<Region>('IE');
  const [linkedCustomerId, setLinkedCustomerId] = useState<string | undefined>(
    route.params?.customerId
  );

  // Customer picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    (async () => {
      const profile = await loadCompanyProfile();
      setDefaultInspector(profile.defaultPersonnel);
      const locale = await loadLocale();
      setRegion(locale.region);
      const list = await loadCustomers();
      setCustomers(list);

      // Pre-fill from passed customerId
      if (route.params?.customerId) {
        const c = await getCustomer(route.params.customerId);
        if (c) {
          setCustomerName(c.name);
          setCustomerEmail(c.email);
          setAddress(c.address);
        }
      }
    })();
  }, [route.params?.customerId]);

  const isValid = customerName.trim().length > 0 && address.trim().length > 0;

  const pickCustomer = (c: Customer) => {
    setCustomerName(c.name);
    setCustomerEmail(c.email);
    setAddress(c.address);
    setLinkedCustomerId(c.id);
    setPickerOpen(false);
  };

  const handleCreate = async () => {
    if (!isValid) {
      Alert.alert('Required Fields', 'Please enter a customer name and property address.');
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();

    // Find or create the linked Customer
    const customer =
      linkedCustomerId
        ? await getCustomer(linkedCustomerId)
        : null;
    const linked =
      customer ??
      (await findOrCreateCustomerByNameAddress(customerName, address, customerEmail));

    const inspection: Inspection = {
      id: uuidv4(),
      customerId: linked.id,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      address: address.trim(),
      ref: ref.trim(),
      inspectorName: inspectorName.trim() || defaultInspector,
      date: now.split('T')[0],
      notes: notes.trim(),
      conditions: '',
      scopeOfWorks: scopeOfWorks.trim() || 'Roof Survey',
      overview: '',
      reportNo: '01',
      conclusion: '',
      costOfRepairs: 0,
      photos: [],
      quote: { lineItems: [] },
      createdAt: now,
      updatedAt: now,
    };

    await addInspection(inspection);
    setSaving(false);
    navigation.replace('Inspection', { inspectionId: inspection.id });
  };

  const postcodeLabel = getPostcodeLabel(region);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' },
        ]}
      >
        <Text style={styles.sectionLabel}>CUSTOMER</Text>

        {customers.length > 0 && (
          <TouchableOpacity style={styles.pickBtn} onPress={() => setPickerOpen(true)}>
            <Text style={styles.pickBtnText}>👥 Pick existing customer</Text>
          </TouchableOpacity>
        )}

        <TextInput
          style={styles.input}
          placeholder="Customer Name *"
          value={customerName}
          onChangeText={(v) => { setCustomerName(v); setLinkedCustomerId(undefined); }}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          placeholder="Customer Email (optional)"
          value={customerEmail}
          onChangeText={setCustomerEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          placeholder={`${postcodeLabel} or address *`}
          value={address}
          onChangeText={(v) => { setAddress(v); setLinkedCustomerId(undefined); }}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          placeholder="Ref: (e.g. project name)"
          value={ref}
          onChangeText={setRef}
          autoCapitalize="sentences"
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          placeholder="Scope of Works (e.g. Roof Survey)"
          value={scopeOfWorks}
          onChangeText={setScopeOfWorks}
          autoCapitalize="sentences"
          returnKeyType="next"
        />

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>INSPECTOR</Text>
        <TextInput
          style={styles.input}
          placeholder="Inspector Name"
          value={inspectorName}
          onChangeText={setInspectorName}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>NOTES</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="General notes about this inspection (optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.button, !isValid && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={!isValid || saving}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {saving ? 'Creating…' : 'Start Taking Photos →'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pick Customer</Text>
            <FlatList
              data={customers}
              keyExtractor={(c) => c.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalRow} onPress={() => pickCustomer(item)}>
                  <Text style={styles.modalRowName}>{item.name}</Text>
                  <Text style={styles.modalRowSub} numberOfLines={1}>{item.address}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#eee' }} />}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a3c5e',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
    color: '#222',
  },
  multiline: { minHeight: 100, paddingTop: 12 },
  button: {
    backgroundColor: '#1a3c5e',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontSize: 15, fontWeight: '700' },
  pickBtn: {
    backgroundColor: '#e8f0fa', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#cfe0f3',
  },
  pickBtnText: { color: '#1a3c5e', fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1a3c5e', marginBottom: 12 },
  modalRow: { paddingVertical: 12 },
  modalRowName: { fontSize: 15, fontWeight: '600', color: '#222' },
  modalRowSub: { fontSize: 13, color: '#666', marginTop: 2 },
  modalClose: { paddingVertical: 14, alignItems: 'center' },
  modalCloseText: { color: '#1a3c5e', fontWeight: '700' },
});
