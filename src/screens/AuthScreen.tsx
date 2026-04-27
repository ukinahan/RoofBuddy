import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Switch,
} from 'react-native';
import {
  isSupabaseConfigured,
  signInWithMagicLink,
  verifyOtpCode,
  getCurrentUserEmail,
  signOut,
} from '../services/supabase';
import { syncNow, lastSyncedAt, SyncProgress } from '../services/sync';
import {
  loadCloudSyncSettings,
  saveCloudSyncSettings,
  CloudSyncSettings,
  DEFAULT_SETTINGS,
} from '../services/syncSettings';

/**
 * Cloud sync sign-in screen. Disabled (read-only "coming soon") when the
 * Supabase env vars are not set, so the screen is safe to ship in any build.
 */
export default function AuthScreen() {
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [settings, setSettings] = useState<CloudSyncSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    getCurrentUserEmail().then(setSignedInAs);
    lastSyncedAt().then(setLastSync);
    loadCloudSyncSettings().then(setSettings);
  }, []);

  const updateSettings = (patch: Partial<CloudSyncSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveCloudSyncSettings(next).catch(() => {/* ignore */});
  };

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert('Email required', 'Enter your email to receive a sign-in link.');
      return;
    }
    setBusy(true);
    const res = await signInWithMagicLink(email.trim());
    setBusy(false);
    if (!res.ok) {
      Alert.alert('Sign-in failed', res.error ?? 'Unknown error');
      return;
    }
    setMagicSent(true);
  };

  const handleSignOut = async () => {
    await signOut();
    setSignedInAs(null);
    setMagicSent(false);
    setCode('');
  };

  const handleVerify = async () => {
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      Alert.alert('Code required', 'Enter the code from your email.');
      return;
    }
    setVerifying(true);
    const res = await verifyOtpCode(email.trim(), trimmed);
    setVerifying(false);
    if (!res.ok) {
      Alert.alert('Sign-in failed', res.error ?? 'Code was invalid or expired. Request a new one.');
      return;
    }
    const who = await getCurrentUserEmail();
    setSignedInAs(who);
    setMagicSent(false);
    setCode('');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.icon}>☁️</Text>
      <Text style={styles.title}>Cloud Sync</Text>
      <Text style={styles.body}>
        Sign in to back up your inspections to the cloud and access them on
        another device. Your data continues to live on this device — sync is
        an extra safety net.
      </Text>

      {!configured ? (
        <View style={styles.disabledCard}>
          <Text style={styles.disabledTitle}>Coming soon</Text>
          <Text style={styles.disabledBody}>
            Cloud sync isn't enabled in this build yet. It will be available in
            a future release. For now, use Settings → Export all data to keep
            an off-device backup.
          </Text>
        </View>
      ) : signedInAs ? (
        <View style={styles.card}>
          <Text style={styles.signedInLabel}>Signed in as</Text>
          <Text style={styles.signedInEmail}>{signedInAs}</Text>
          {lastSync && (
            <Text style={styles.lastSync}>Last synced: {new Date(lastSync).toLocaleString()}</Text>
          )}

          {syncing && progress && (
            <View style={styles.progressWrap}>
              <Text style={styles.progressLabel}>{progress.message}</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width:
                        progress.total > 0
                          ? `${Math.min(100, Math.round((progress.current / progress.total) * 100))}%`
                          : progress.phase === 'done' ? '100%' : '15%',
                    },
                  ]}
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, syncing && { opacity: 0.6 }, { marginTop: 14 }]}
            onPress={async () => {
              setSyncing(true);
              setProgress({ phase: 'inspections', current: 0, total: 0, message: 'Starting…' });
              try {
                const r = await syncNow(setProgress);
                setLastSync(r.at);
                Alert.alert(
                  'Sync complete',
                  `Pushed: ${r.pushed.inspections} inspections, ${r.pushed.customers} customers, ${r.pushed.photos} photos${r.pushed.profile ? ', profile' : ''}.\n` +
                  `Pulled: ${r.pulled.inspections} inspections, ${r.pulled.customers} customers, ${r.pulled.photos} photos${r.pulled.profile ? ', profile' : ''}.`
                );
              } catch (err: unknown) {
                Alert.alert('Sync failed', err instanceof Error ? err.message : 'Unknown error');
              } finally {
                setSyncing(false);
                setProgress(null);
              }
            }}
            disabled={syncing}
          >
            {syncing
              ? <ActivityIndicator color="white" />
              : <Text style={styles.btnPrimaryText}>Sync now</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleSignOut}>
            <Text style={styles.btnSecondaryText}>Sign out</Text>
          </TouchableOpacity>

          {/* Sync preferences */}
          <View style={styles.settingsBlock}>
            <Text style={styles.settingsTitle}>Sync preferences</Text>

            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingLabel}>Sync on WiFi only</Text>
                <Text style={styles.settingHint}>
                  Auto-sync only runs when you're on WiFi (or Ethernet). When
                  on cellular, use Sync now manually to avoid mobile data charges.
                </Text>
              </View>
              <Switch
                value={settings.wifiOnly}
                onValueChange={(v) => updateSettings({ wifiOnly: v })}
                disabled={syncing}
              />
            </View>

            <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Photo upload size</Text>
                <Text style={styles.settingHint}>
                  Smaller = less data. Larger = more detail in cloud copy.
                </Text>
                <View style={styles.chipRow}>
                  {[
                    { w: 800, q: 0.6, label: 'Small (~80 KB)' },
                    { w: 1200, q: 0.7, label: 'Medium (~150 KB)' },
                    { w: 1600, q: 0.8, label: 'Large (~280 KB)' },
                  ].map((opt) => {
                    const active = settings.photoMaxWidth === opt.w;
                    return (
                      <TouchableOpacity
                        key={opt.w}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => updateSettings({ photoMaxWidth: opt.w, photoQuality: opt.q })}
                        disabled={syncing}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : magicSent ? (
        <View style={styles.card}>
          <Text style={styles.checkIcon}>✉️</Text>
          <Text style={styles.h2}>Check your email</Text>
          <Text style={styles.body}>
            We sent a sign-in code to {email}. Enter it below.
          </Text>
          <Text style={styles.label}>Code from email</Text>
          <TextInput
            style={[styles.input, { fontSize: 22, letterSpacing: 4, textAlign: 'center' }]}
            placeholder="— — — — — —"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            autoFocus
            editable={!verifying}
          />
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, verifying && { opacity: 0.6 }]}
            onPress={handleVerify}
            disabled={verifying}
          >
            {verifying ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>Verify code</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => { setMagicSent(false); setCode(''); }}
          >
            <Text style={styles.btnSecondaryText}>Use a different email</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@yourcompany.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, busy && { opacity: 0.6 }]}
            onPress={handleSend}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>Send sign-in link</Text>}
          </TouchableOpacity>
          <Text style={styles.smallNote}>
            No password needed. We'll email you a sign-in code.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#f5f5f5' },
  icon: { fontSize: 48, textAlign: 'center', marginTop: 20, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a3c5e', textAlign: 'center', marginBottom: 12 },
  h2: { fontSize: 18, fontWeight: '700', color: '#1a3c5e', textAlign: 'center', marginBottom: 8 },
  body: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  card: { backgroundColor: 'white', borderRadius: 14, padding: 20, marginTop: 10 },
  disabledCard: { backgroundColor: '#fff8e7', borderRadius: 14, padding: 20, marginTop: 10, borderWidth: 1, borderColor: '#f5d97a' },
  disabledTitle: { fontSize: 16, fontWeight: '800', color: '#8a6d00', marginBottom: 8 },
  disabledBody: { fontSize: 13, color: '#5e4a00', lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '700', color: '#1a3c5e', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 14 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#1a3c5e' },
  btnPrimaryText: { color: 'white', fontWeight: '800', fontSize: 15 },
  btnSecondary: { backgroundColor: 'white', borderWidth: 1, borderColor: '#1a3c5e', marginTop: 12 },
  btnSecondaryText: { color: '#1a3c5e', fontWeight: '700', fontSize: 14 },
  smallNote: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 12 },
  signedInLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.6 },
  signedInEmail: { fontSize: 16, fontWeight: '700', color: '#1a3c5e', marginTop: 4 },
  lastSync: { fontSize: 12, color: '#888', marginTop: 6 },
  checkIcon: { fontSize: 40, textAlign: 'center', color: '#2e8b57', marginBottom: 8 },
  progressWrap: { marginTop: 14 },
  progressLabel: { fontSize: 12, color: '#1a3c5e', fontWeight: '600', marginBottom: 6 },
  progressTrack: { height: 8, backgroundColor: '#e6ecf2', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#1a3c5e' },
  settingsBlock: { marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  settingsTitle: { fontSize: 12, fontWeight: '800', color: '#1a3c5e', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  settingRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  settingLabel: { fontSize: 14, fontWeight: '700', color: '#222' },
  settingHint: { fontSize: 12, color: '#777', marginTop: 4, lineHeight: 17 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#ccc', backgroundColor: 'white' },
  chipActive: { backgroundColor: '#1a3c5e', borderColor: '#1a3c5e' },
  chipText: { fontSize: 12, color: '#444', fontWeight: '600' },
  chipTextActive: { color: 'white' },
});
