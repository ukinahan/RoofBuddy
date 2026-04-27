import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { RootStackParamList } from '../types';
import {
  LocaleSettings, Region, Language, Units, CurrencyCode,
  loadLocale, saveLocale, getRegionDefaults,
} from '../services/locale';
import { useT } from '../services/i18n';
import { exportBackupAndShare, wipeAllData } from '../services/backup';
import { resetOnboarding } from '../services/onboarding';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

const REGIONS: Region[] = ['IE', 'UK', 'US', 'CA', 'AU', 'ES'];
const LANGUAGES: Array<{ code: Language; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'ga', label: 'Gaeilge' },
  { code: 'es', label: 'Español' },
];
const CURRENCIES: CurrencyCode[] = ['EUR', 'GBP', 'USD', 'CAD', 'AUD'];

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const t = useT();
  const [locale, setLocale] = useState<LocaleSettings | null>(null);

  useEffect(() => { loadLocale().then(setLocale); }, []);

  const update = async (patch: Partial<LocaleSettings>) => {
    if (!locale) return;
    let next = { ...locale, ...patch } as LocaleSettings;
    if (patch.region) {
      const def = getRegionDefaults(patch.region);
      next = { ...next, currency: def.currency, units: def.units };
    }
    setLocale(next);
    await saveLocale(next);
  };

  if (!locale) return <View />;

  const version = (Constants.expoConfig?.version) ?? '—';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Section title={t('settings.section.locale')}>
        <PickerRow label={t('settings.field.region')} value={locale.region}
          options={REGIONS} display={(r) => r} onChange={(r) => update({ region: r as Region })} />
        <PickerRow label={t('settings.field.language')} value={locale.language}
          options={LANGUAGES.map((l) => l.code)}
          display={(c) => LANGUAGES.find((l) => l.code === c)?.label ?? c}
          onChange={(l) => {
            update({ language: l as Language }).then(() => {
              Alert.alert('Restart Required', 'Reopen the app to fully apply the language change.');
            });
          }} />
        <PickerRow label={t('settings.field.units')} value={locale.units}
          options={['metric', 'imperial']}
          display={(u) => u === 'metric' ? t('settings.units.metric') : t('settings.units.imperial')}
          onChange={(u) => update({ units: u as Units })} />
        <PickerRow label={t('settings.field.currency')} value={locale.currency}
          options={CURRENCIES} display={(c) => c}
          onChange={(c) => update({ currency: c as CurrencyCode })} />
      </Section>

      <Section title={t('settings.section.company')}>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('CompanyProfile')}>
          <Text style={styles.linkText}>{t('settings.openCompany')}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Auth')}>
          <Text style={styles.linkText}>Cloud sync (sign in)</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </Section>

      <Section title={t('settings.section.about')}>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>{t('settings.about.version')}</Text>
          <Text style={styles.aboutValue}>{version}</Text>
        </View>
      </Section>

      <Section title="Data">
        <TouchableOpacity
          style={styles.linkRow}
          onPress={async () => {
            try {
              await exportBackupAndShare(version);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Could not export.';
              Alert.alert('Export failed', msg);
            }
          }}
        >
          <Text style={styles.linkText}>Export all data (JSON)</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => {
            Alert.alert(
              'Wipe all data?',
              'This permanently deletes every customer, inspection, photo and setting on this device. This cannot be undone. Export a backup first if you might want this data later.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Continue',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert(
                      'Are you absolutely sure?',
                      'Last chance. Tap "Wipe Everything" to permanently erase all data.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Wipe Everything',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await wipeAllData();
                              await resetOnboarding();
                              Alert.alert('Done', 'All data has been erased. Please close and reopen the app.');
                            } catch (err: unknown) {
                              const msg = err instanceof Error ? err.message : 'Could not wipe data.';
                              Alert.alert('Wipe failed', msg);
                            }
                          },
                        },
                      ]
                    );
                  },
                },
              ]
            );
          }}
        >
          <Text style={[styles.linkText, { color: '#c0392b' }]}>Wipe all data…</Text>
          <Text style={[styles.chevron, { color: '#c0392b' }]}>›</Text>
        </TouchableOpacity>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function PickerRow<T extends string>({
  label, value, options, display, onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  display: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.pickerRow}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.pickerOptions}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.opt, value === opt && styles.optActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.optText, value === opt && styles.optTextActive]}>{display(opt)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1, color: '#1a3c5e',
    paddingHorizontal: 16, marginBottom: 6, textTransform: 'uppercase',
  },
  sectionBody: { backgroundColor: 'white', marginHorizontal: 12, borderRadius: 12, paddingVertical: 4 },
  pickerRow: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  pickerLabel: { fontSize: 13, color: '#555', fontWeight: '600', marginBottom: 8 },
  pickerOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#eef2f6' },
  optActive: { backgroundColor: '#1a3c5e' },
  optText: { color: '#1a3c5e', fontSize: 13, fontWeight: '600' },
  optTextActive: { color: 'white' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  linkText: { color: '#1a3c5e', fontWeight: '600', fontSize: 15 },
  chevron: { fontSize: 22, color: '#999' },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  aboutLabel: { color: '#555', fontWeight: '600' },
  aboutValue: { color: '#222' },
});
