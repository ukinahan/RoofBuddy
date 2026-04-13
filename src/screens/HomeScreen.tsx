import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
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

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <View style={styles.container}>
      <FlatList
        data={inspections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏠</Text>
            <Text style={styles.emptyTitle}>No Inspections Yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the button below to start your first roof inspection.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <InspectionCard
            inspection={item}
            onPress={() => navigation.navigate('Inspection', { inspectionId: item.id })}
            onDelete={() => handleDelete(item)}
          />
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewInspection')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+ New Inspection</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
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
});
