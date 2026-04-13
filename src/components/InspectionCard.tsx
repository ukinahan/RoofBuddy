import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Inspection } from '../types';

interface Props {
  inspection: Inspection;
  onPress: () => void;
  onDelete: () => void;
}

export default function InspectionCard({ inspection, onPress, onDelete }: Props) {
  const allAnnotations = inspection.photos.flatMap((p) => p.annotations);
  const highCount = allAnnotations.filter((a) => a.severity === 'high').length;
  const totalConcerns = allAnnotations.length;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.row}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🏠</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.name} numberOfLines={1}>{inspection.customerName}</Text>
          <Text style={styles.address} numberOfLines={1}>{inspection.address}</Text>
          <Text style={styles.date}>{new Date(inspection.date).toLocaleDateString()}</Text>
        </View>
        <View style={styles.rightContainer}>
          <Text style={styles.photoCount}>{inspection.photos.length} photo{inspection.photos.length !== 1 ? 's' : ''}</Text>
          {totalConcerns > 0 && (
            <View style={[styles.badge, highCount > 0 ? styles.badgeHigh : styles.badgeNormal]}>
              <Text style={styles.badgeText}>{totalConcerns} concern{totalConcerns !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
        <Text style={styles.arrowText}>View →</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconContainer: {
    width: 44,
    height: 44,
    backgroundColor: '#e8f0fa',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 22 },
  textContainer: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#222' },
  address: { fontSize: 13, color: '#666', marginTop: 2 },
  date: { fontSize: 12, color: '#999', marginTop: 2 },
  rightContainer: { alignItems: 'flex-end', marginLeft: 8 },
  photoCount: { fontSize: 12, color: '#999' },
  badge: { marginTop: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeHigh: { backgroundColor: '#ffebee' },
  badgeNormal: { backgroundColor: '#e8f5e9' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#333' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  deleteBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  deleteBtnText: { color: '#c0392b', fontSize: 13 },
  arrowText: { color: '#1a3c5e', fontSize: 13, fontWeight: '600' },
});
