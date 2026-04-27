import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Inspection, RootStackParamList } from '../types';
import { loadInspections, deleteInspection } from '../services/storage';
import InspectionCard from '../components/InspectionCard';
import { useResponsive } from '../utils/responsive';
import { useT } from '../services/i18n';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const t = useT();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { isTablet, isLandscape, inspectionColumns, contentMaxWidth } = useResponsive();
  const splitView = isTablet && isLandscape;

  // Gear icon moved to the Settings tab — no headerRight needed.

  const load = useCallback(async () => {
    const data = await loadInspections();
    setInspections(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDelete = (inspection: Inspection) => {
    Alert.alert(
      'Delete Inspection',
      `Delete the inspection for "${inspection.customerName}" at ${inspection.address}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteInspection(inspection.id);
            await load();
          },
        },
      ]
    );
  };

  /** Filter inspections by a free-text query that matches across customer
   *  name, address, job ref, inspector name, notes, and date string. */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inspections;
    return inspections.filter((i) => {
      const haystack = [
        i.customerName,
        i.customerEmail,
        i.address,
        i.ref,
        i.inspectorName,
        i.notes,
        i.overview,
        i.conclusion,
        new Date(i.date).toLocaleDateString(),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [inspections, search]);

  const list = (
    <>
      {inspections.length > 0 && (
        <View style={[styles.searchWrap, { width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }]}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('home.search.placeholder')}
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <Text style={styles.searchCount}>
              {filtered.length} of {inspections.length}
            </Text>
          )}
        </View>
      )}

      <FlatList
        key={`cols-${splitView ? 1 : inspectionColumns}`}
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={splitView ? 1 : inspectionColumns}
        columnWrapperStyle={!splitView && inspectionColumns > 1 ? { gap: 12 } : undefined}
        contentContainerStyle={[
          styles.list,
          { width: '100%', maxWidth: splitView ? undefined : contentMaxWidth, alignSelf: 'center' },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          inspections.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏠</Text>
              <Text style={styles.emptyTitle}>{t('home.empty.title')}</Text>
              <Text style={styles.emptySubtitle}>{t('home.empty.subtitle')}</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>{t('home.empty.search.title')}</Text>
              <Text style={styles.emptySubtitle}>
                No inspections match "{search.trim()}". Try a different search.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={!splitView && inspectionColumns > 1 ? { flex: 1 } : undefined}>
            <InspectionCard
              inspection={item}
              onPress={() => {
                if (splitView) setSelectedId(item.id);
                else navigation.navigate('Inspection', { inspectionId: item.id });
              }}
              onDelete={() => handleDelete(item)}
            />
          </View>
        )}
      />

      <TouchableOpacity
        style={[
          styles.fab,
          isTablet && { left: undefined, right: undefined, alignSelf: 'center', width: 360 },
        ]}
        onPress={() => navigation.navigate('NewInspection')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>{t('home.fab.new')}</Text>
      </TouchableOpacity>
    </>
  );

  if (splitView) {
    const selected = inspections.find((i) => i.id === selectedId) ?? filtered[0];
    return (
      <View style={[styles.container, { flexDirection: 'row' }]}>
        <View style={{ width: 360, borderRightWidth: 1, borderRightColor: '#e0e0e0' }}>{list}</View>
        <View style={{ flex: 1 }}>
          {selected ? (
            <View style={styles.detailPane}>
              <Text style={styles.detailName}>{selected.customerName}</Text>
              {selected.ref ? <Text style={styles.detailRef}>Ref: {selected.ref}</Text> : null}
              <Text style={styles.detailAddress}>{selected.address}</Text>
              <Text style={styles.detailDate}>{new Date(selected.date).toLocaleDateString()}</Text>
              <Text style={styles.detailMeta}>{selected.photos.length} photo{selected.photos.length !== 1 ? 's' : ''}</Text>
              <TouchableOpacity
                style={styles.openBtn}
                onPress={() => navigation.navigate('Inspection', { inspectionId: selected.id })}
              >
                <Text style={styles.openBtnText}>Open Inspection →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.detailEmpty}>
              <Text style={styles.detailEmptyText}>Select an inspection from the list</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return <View style={styles.container}>{list}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222',
  },
  searchCount: {
    marginLeft: 10,
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  list: { padding: 16, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#777', textAlign: 'center', paddingHorizontal: 32 },
  fab: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    backgroundColor: '#1a3c5e',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: 'white', fontSize: 16, fontWeight: '700' },
  detailPane: { padding: 24 },
  detailName: { fontSize: 22, fontWeight: '800', color: '#1a3c5e' },
  detailRef: { fontSize: 14, color: '#c8941a', marginTop: 4, fontWeight: '700' },
  detailAddress: { fontSize: 15, color: '#444', marginTop: 6 },
  detailDate: { fontSize: 13, color: '#777', marginTop: 4 },
  detailMeta: { fontSize: 13, color: '#999', marginTop: 8 },
  openBtn: { marginTop: 24, backgroundColor: '#1a3c5e', paddingVertical: 14, borderRadius: 12, alignSelf: 'flex-start', paddingHorizontal: 24 },
  openBtnText: { color: 'white', fontWeight: '700' },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  detailEmptyText: { color: '#999', fontSize: 15 },
});
