import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import { CompanyProfile } from '../types';
import { loadCompanyProfile, saveCompanyProfile, DEFAULT_COMPANY } from '../services/company';

const LOGO_DIR = `${FileSystem.documentDirectory}company/`;
const LOGO_PATH = `${LOGO_DIR}logo.png`;

export default function CompanyProfileScreen() {
  const navigation = useNavigation();
  const [profile, setProfile] = useState<CompanyProfile>({ ...DEFAULT_COMPANY });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await loadCompanyProfile();
      setProfile(p);
      setLoaded(true);
    })();
  }, []);

  const updateField = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const handlePickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 2],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        await FileSystem.makeDirectoryAsync(LOGO_DIR, { intermediates: true });
        await FileSystem.copyAsync({
          from: result.assets[0].uri,
          to: LOGO_PATH,
        });
        updateField('logoUri', LOGO_PATH);
      } catch {
        Alert.alert('Error', 'Could not save the logo image.');
      }
    }
  };

  const handleRemoveLogo = () => {
    Alert.alert('Remove Logo', 'Remove your custom logo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await FileSystem.deleteAsync(LOGO_PATH, { idempotent: true });
          } catch { /* ignore */ }
          updateField('logoUri', '');
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!profile.name.trim()) {
      Alert.alert('Required', 'Please enter a company name.');
      return;
    }
    setSaving(true);
    // Parse address into addressLines
    const lines = profile.address
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
    const updated: CompanyProfile = {
      ...profile,
      name: profile.name.trim(),
      shortName: profile.shortName.trim() || profile.name.trim(),
      nameLine1: profile.nameLine1.trim() || profile.name.trim(),
      nameLine2: profile.nameLine2.trim(),
      addressLines: lines,
    };
    await saveCompanyProfile(updated);
    setSaving(false);
    Alert.alert('Saved', 'Company profile updated.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  if (!loaded) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <Text style={styles.sectionTitle}>Company Logo</Text>
        <View style={styles.logoSection}>
          {profile.logoUri ? (
            <Image source={{ uri: profile.logoUri }} style={styles.logoPreview} resizeMode="contain" />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoPlaceholderText}>No custom logo</Text>
            </View>
          )}
          <View style={styles.logoButtons}>
            <TouchableOpacity style={styles.logoBtn} onPress={handlePickLogo}>
              <Text style={styles.logoBtnText}>{profile.logoUri ? 'Change' : 'Upload Logo'}</Text>
            </TouchableOpacity>
            {profile.logoUri ? (
              <TouchableOpacity style={[styles.logoBtn, styles.logoBtnDanger]} onPress={handleRemoveLogo}>
                <Text style={[styles.logoBtnText, { color: '#d32f2f' }]}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Company Details */}
        <Text style={styles.sectionTitle}>Company Details</Text>
        <Field label="Company Name" value={profile.name} onChangeText={(v) => updateField('name', v)} />
        <Field label="Display Name (Line 1)" value={profile.nameLine1} onChangeText={(v) => updateField('nameLine1', v)} placeholder="e.g. Acme Roofing" />
        <Field label="Display Name (Line 2)" value={profile.nameLine2} onChangeText={(v) => updateField('nameLine2', v)} placeholder="e.g. Solutions Ltd." />
        <Field label="Short Name" value={profile.shortName} onChangeText={(v) => updateField('shortName', v)} placeholder="Used in letter sign-off" />
        <Field label="Services Tagline" value={profile.services} onChangeText={(v) => updateField('services', v)} placeholder="e.g. Copper | Zinc | PVC Roofing" />
        <Field label="Address" value={profile.address} onChangeText={(v) => updateField('address', v)} placeholder="Comma-separated lines" />
        <Field label="Eircode / Postcode" value={profile.eircode} onChangeText={(v) => updateField('eircode', v)} />
        <Field label="Phone" value={profile.tel} onChangeText={(v) => updateField('tel', v)} keyboardType="phone-pad" />
        <Field label="Email" value={profile.email} onChangeText={(v) => updateField('email', v)} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Website" value={profile.website} onChangeText={(v) => updateField('website', v)} autoCapitalize="none" />

        {/* Tax & Registration */}
        <Text style={styles.sectionTitle}>Tax &amp; Registration</Text>
        <Field label="VAT Number" value={profile.vatNumber} onChangeText={(v) => updateField('vatNumber', v)} />
        <Field label="C2 / Registration Number" value={profile.c2Number} onChangeText={(v) => updateField('c2Number', v)} />
        <Field
          label="VAT Rate (%)"
          value={String(profile.vatRate * 100)}
          onChangeText={(v) => {
            const n = parseFloat(v);
            if (!isNaN(n)) updateField('vatRate', n / 100);
          }}
          keyboardType="decimal-pad"
        />

        {/* Personnel */}
        <Text style={styles.sectionTitle}>Personnel</Text>
        <Field label="Signatory Name" value={profile.signatoryName} onChangeText={(v) => updateField('signatoryName', v)} />
        <Field label="Signatory Title" value={profile.signatoryTitle} onChangeText={(v) => updateField('signatoryTitle', v)} placeholder="e.g. Managing Director" />
        <Field label="Default Inspector" value={profile.defaultPersonnel} onChangeText={(v) => updateField('defaultPersonnel', v)} placeholder="Name & phone shown on reports" />

        {/* Quote Defaults */}
        <Text style={styles.sectionTitle}>Quote Defaults</Text>
        <Field
          label="Deposit (%)"
          value={String(profile.depositPercent)}
          onChangeText={(v) => {
            const n = parseInt(v, 10);
            if (!isNaN(n)) updateField('depositPercent', n);
          }}
          keyboardType="number-pad"
        />
        <Field
          label="Quote Valid (days)"
          value={String(profile.quoteValidDays)}
          onChangeText={(v) => {
            const n = parseInt(v, 10);
            if (!isNaN(n)) updateField('quoteValidDays', n);
          }}
          keyboardType="number-pad"
        />

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Profile'}</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Reusable Field ──────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'decimal-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#bbb"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a3c5e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logoPreview: {
    width: 220,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  logoPlaceholder: {
    width: 220,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#e8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoPlaceholderText: { color: '#999', fontSize: 13 },
  logoButtons: { flexDirection: 'row', gap: 12 },
  logoBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1a3c5e',
  },
  logoBtnDanger: { borderColor: '#d32f2f' },
  logoBtnText: { fontSize: 13, fontWeight: '600', color: '#1a3c5e' },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4 },
  fieldInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222',
  },
  saveBtn: {
    backgroundColor: '#1a3c5e',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
