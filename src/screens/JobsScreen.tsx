import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, SectionList } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Inspection, RootStackParamList } from '../types';
import { loadInspections } from '../services/storage';
import InspectionCard from '../components/InspectionCard';
import { useT } from '../services/i18n';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Jobs'>;

export default function JobsScreen() {
  const navigation = useNavigation<Nav>();
  const t = useT();
  const [data, setData] = useState<Inspection[]>([]);

  const load = useCallback(async () => {
    setData(await loadInspections());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = new Date().toISOString().slice(0, 10);
  const todayItems = data.filter((i) => i.date === today);
  const upcoming = data.filter((i) => i.date > today);
  const recent = data.filter((i) => i.date < today).slice(0, 10);

  const sections = [
    { title: t('jobs.section.today'), data: todayItems },
    { title: t('jobs.section.upcoming'), data: upcoming },
    { title: t('jobs.section.recent'), data: recent },
  ].filter((s) => s.data.length > 0);

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <InspectionCard
            inspection={item}
            onPress={() => navigation.navigate('Inspection', { inspectionId: item.id })}
            onDelete={() => { /* delete from main list */ }}
          />
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>{t('jobs.title')}</Text>
            <Text style={styles.emptySub}>{t('jobs.empty')}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  sectionHeader: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1, color: '#1a3c5e',
    backgroundColor: '#f5f5f5', paddingTop: 12, paddingBottom: 6, textTransform: 'uppercase',
  },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#777', textAlign: 'center', paddingHorizontal: 32 },
});
