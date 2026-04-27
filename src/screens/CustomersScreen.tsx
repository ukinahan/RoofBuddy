import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Customer, RootStackParamList } from '../types';
import { loadCustomers, findOrCreateCustomerByNameAddress } from '../services/customers';
import { loadInspections } from '../services/storage';
import { useT } from '../services/i18n';
import { useResponsive } from '../utils/responsive';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CustomersList'>;

export default function CustomersScreen() {
  const navigation = useNavigation<Nav>();
  const t = useT();
  const { contentMaxWidth } = useResponsive();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    // Backfill: ensure every inspection has a customer record.
    const inspections = await loadInspections();
    for (const i of inspections) {
      if (!i.customerId && i.customerName) {
        await findOrCreateCustomerByNameAddress(i.customerName, i.address, i.customerEmail);
      }
    }
    const list = await loadCustomers();
    setCustomers(list);

    // Count inspections per customer (by id, falling back to name+address)
    const byId: Record<string, number> = {};
    for (const i of inspections) {
      const key =
        i.customerId ??
        list.find(
          (c) =>
            c.name.trim().toLowerCase() === (i.customerName || '').trim().toLowerCase() &&
            c.address.trim().toLowerCase() === (i.address || '').trim().toLowerCase()
        )?.id;
      if (key) byId[key] = (byId[key] ?? 0) + 1;
    }
    setCounts(byId);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.email, c.address, c.phone].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [customers, search]);

  return (
    <View style={styles.container}>
      <View style={[styles.searchWrap, { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('customers.search.placeholder')}
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={[styles.list, { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>{t('customers.title')}</Text>
            <Text style={styles.emptySubtitle}>{t('customers.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}
            activeOpacity={0.8}
          >
            <View style={styles.avatar}><Text style={styles.avatarText}>{(item.name || '?')[0].toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.sub} numberOfLines={1}>{item.address || item.email || '—'}</Text>
            </View>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{counts[item.id] ?? 0}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchInput: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#222',
  },
  list: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a3c5e',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: 'white', fontWeight: '700', fontSize: 18 },
  name: { fontSize: 15, fontWeight: '700', color: '#222' },
  sub: { fontSize: 13, color: '#666', marginTop: 2 },
  countPill: { backgroundColor: '#e8f0fa', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countPillText: { color: '#1a3c5e', fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#777', textAlign: 'center', paddingHorizontal: 32 },
});
