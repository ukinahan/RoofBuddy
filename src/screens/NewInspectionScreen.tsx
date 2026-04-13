import React, { useState } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { v4 as uuidv4 } from 'uuid';
import { RootStackParamList, Inspection } from '../types';
import { addInspection } from '../services/storage';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NewInspection'>;

export default function NewInspectionScreen() {
  const navigation = useNavigation<Nav>();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [address, setAddress] = useState('');
  const [ref, setRef] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid = customerName.trim().length > 0 && address.trim().length > 0;

  const handleCreate = async () => {
    if (!isValid) {
      Alert.alert('Required Fields', 'Please enter a customer name and property address.');
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const inspection: Inspection = {
      id: uuidv4(),
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      address: address.trim(),
      ref: ref.trim(),
      inspectorName: inspectorName.trim() || 'Inspector',
      date: now.split('T')[0],
      notes: notes.trim(),
      photos: [],
      quote: { lineItems: [] },
      createdAt: now,
      updatedAt: now,
    };

    await addInspection(inspection);
    setSaving(false);
    navigation.replace('Inspection', { inspectionId: inspection.id });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>CUSTOMER</Text>

        <TextInput
          style={styles.input}
          placeholder="Customer Name *"
          value={customerName}
          onChangeText={setCustomerName}
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
          placeholder="Eircode *"
          value={address}
          onChangeText={setAddress}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          placeholder="Ref: (e.g. Castlemartyr Golf Clubhouse)"
          value={ref}
          onChangeText={setRef}
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
});
