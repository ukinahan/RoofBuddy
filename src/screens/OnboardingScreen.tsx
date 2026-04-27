import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CompanyProfile } from '../types';
import { loadCompanyProfile, saveCompanyProfile } from '../services/company';
import { markOnboardingComplete } from '../services/onboarding';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  onDone: () => void;
}

/**
 * First-run onboarding. Four pages:
 *   1. Welcome / what the app does
 *   2. Set company name + email (minimum to make a usable PDF report)
 *   3. Cloud sync intro (sign in is optional and done from Settings later)
 *   4. Quick-start guide
 *
 * All data is optional — user can tap "Skip for now" at any time. Company
 * profile can be filled in later from the Settings tab.
 */
export default function OnboardingScreen({ onDone }: Props) {
  const [page, setPage] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [tel, setTel] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const goTo = (p: number) => {
    setPage(p);
    scrollRef.current?.scrollTo({ x: p * SCREEN_W, animated: true });
  };

  const finish = async () => {
    // Save whatever the user typed; if they skipped everything, just mark
    // onboarding complete and let DEFAULT_COMPANY act as the placeholder.
    if (companyName.trim() || email.trim() || tel.trim()) {
      const existing = await loadCompanyProfile();
      const next: CompanyProfile = {
        ...existing,
        ...(companyName.trim() && {
          name: companyName.trim(),
          shortName: companyName.trim(),
          nameLine1: companyName.trim(),
        }),
        ...(email.trim() && { email: email.trim() }),
        ...(tel.trim() && { tel: tel.trim() }),
      };
      try {
        await saveCompanyProfile(next);
      } catch (err) {
        Alert.alert('Could not save', 'Your details were not saved. You can set them up later in Settings.');
      }
    }
    await markOnboardingComplete();
    onDone();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={{ width: SCREEN_W * 4 }}
      >
        {/* Page 1: Welcome */}
        <View style={[styles.page, { width: SCREEN_W }]}>
          <Text style={styles.emoji}>🏠</Text>
          <Text style={styles.h1}>Welcome to RoofBuddy</Text>
          <Text style={styles.body}>
            Capture roof photos on-site, mark up problem areas, and generate
            branded PDF reports + customer quotes — all without leaving the app.
          </Text>
          <View style={styles.featureRow}>
            <Feature icon="📸" label="Photos with markup" />
            <Feature icon="📏" label="On-photo measurement" />
            <Feature icon="📄" label="Branded PDF reports" />
          </View>
          <Text style={styles.smallNote}>Works offline. Your data stays on this device.</Text>
        </View>

        {/* Page 2: Company profile */}
        <View style={[styles.page, { width: SCREEN_W }]}>
          <Text style={styles.emoji}>🏢</Text>
          <Text style={styles.h1}>Your business details</Text>
          <Text style={styles.body}>
            These appear on every PDF report and quote you send. You can change
            or skip them later in Settings.
          </Text>
          <View style={styles.formCard}>
            <Field label="Company / trading name" value={companyName} onChange={setCompanyName} placeholder="e.g. O'Sullivan Roofing" />
            <Field label="Contact email" value={email} onChange={setEmail} placeholder="you@yourcompany.ie" keyboardType="email-address" />
            <Field label="Phone" value={tel} onChange={setTel} placeholder="+353…" keyboardType="phone-pad" />
          </View>
        </View>

        {/* Page 3: Cloud sync intro */}
        <View style={[styles.page, { width: SCREEN_W }]}>
          <Text style={styles.emoji}>☁️</Text>
          <Text style={styles.h1}>Back up to the cloud</Text>
          <Text style={styles.body}>
            Optional cloud sync keeps your inspections, customers and photos
            backed up — so a lost or replaced phone doesn't lose your work.
          </Text>
          <View style={styles.steps}>
            <Step n={1} text="Sign in once with your email — no password" />
            <Step n={2} text="Tap Sync now after each job (or let auto-sync run)" />
            <Step n={3} text="Restore everything on a new device by signing in again" />
          </View>
          <Text style={styles.smallNote}>
            You can enable this later in Settings → Cloud Sync. Your data
            always lives on this device first — cloud is an extra safety net.
          </Text>
        </View>

        {/* Page 4: Quick start */}
        <View style={[styles.page, { width: SCREEN_W }]}>
          <Text style={styles.emoji}>🚀</Text>
          <Text style={styles.h1}>You're ready</Text>
          <Text style={styles.body}>Here's the typical flow:</Text>
          <View style={styles.steps}>
            <Step n={1} text="Add a customer in the Customers tab (or skip and create one inline)" />
            <Step n={2} text="Tap + New Inspection in the Inspections tab" />
            <Step n={3} text="Open the camera and capture each problem area" />
            <Step n={4} text="Tap a photo to draw, calibrate the scale, and measure" />
            <Step n={5} text="Generate a Quote and a PDF Report, then email or share" />
          </View>
          <Text style={styles.smallNote}>Tip: hold the device in landscape for roof photos.</Text>
        </View>
      </ScrollView>

      {/* Footer: dots + nav */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <View style={styles.btnRow}>
          {page > 0 ? (
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => goTo(page - 1)}>
              <Text style={styles.btnSecondaryText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={finish}>
              <Text style={styles.btnSecondaryText}>Skip</Text>
            </TouchableOpacity>
          )}
          {page < 3 ? (
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => goTo(page + 1)}>
              <Text style={styles.btnPrimaryText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={finish}>
              <Text style={styles.btnPrimaryText}>Get started</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Feature({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepBubble}><Text style={styles.stepN}>{n}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#1a3c5e' },
  page: { flex: 1, paddingHorizontal: 28, paddingTop: 80, alignItems: 'center' },
  emoji: { fontSize: 64, marginBottom: 18 },
  h1: { fontSize: 26, fontWeight: '800', color: 'white', textAlign: 'center', marginBottom: 14 },
  body: { fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  smallNote: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 18 },
  featureRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 20 },
  feature: { alignItems: 'center', flex: 1 },
  featureIcon: { fontSize: 32, marginBottom: 6 },
  featureLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  formCard: { width: '100%', backgroundColor: 'white', borderRadius: 14, padding: 16, marginTop: 8 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#1a3c5e', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15 },
  steps: { width: '100%', marginTop: 4 },
  step: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  stepBubble: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'white',
    alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2,
  },
  stepN: { color: '#1a3c5e', fontWeight: '800', fontSize: 13 },
  stepText: { flex: 1, color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20 },
  footer: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 36, backgroundColor: '#142d47' },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 4 },
  dotActive: { backgroundColor: 'white', width: 22 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: 'white' },
  btnPrimaryText: { color: '#1a3c5e', fontWeight: '800', fontSize: 16 },
  btnSecondary: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  btnSecondaryText: { color: 'white', fontWeight: '700', fontSize: 15 },
});
