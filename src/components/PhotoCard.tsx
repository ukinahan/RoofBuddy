import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { InspectionPhoto } from '../types';

interface Props {
  photo: InspectionPhoto;
  onPress: () => void;
}

const SEVERITY_COLOR: Record<string, string> = {
  high: '#d32f2f',
  medium: '#f57c00',
  low: '#388e3c',
};

export default function PhotoCard({ photo, onPress }: Props) {
  const highCount = photo.annotations.filter((a) => a.severity === 'high').length;
  const dominantColor =
    highCount > 0
      ? SEVERITY_COLOR.high
      : photo.annotations.length > 0
      ? SEVERITY_COLOR.medium
      : '#2e8b57';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="cover" />

      {/* AI badge */}
      {photo.aiAnalyzed && (
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI ✓</Text>
        </View>
      )}

      {/* Concern count badge */}
      {photo.annotations.length > 0 && (
        <View style={[styles.countBadge, { backgroundColor: dominantColor }]}>
          <Text style={styles.countBadgeText}>{photo.annotations.length}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.time} numberOfLines={1}>
          {new Date(photo.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {photo.notes ? <Text style={styles.noteIcon}>📝</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  image: { width: '100%', aspectRatio: 1 },
  aiBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#4285f4',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  aiBadgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
  countBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: { color: 'white', fontSize: 11, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  time: { color: 'white', fontSize: 11 },
  noteIcon: { fontSize: 13 },
});
