import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Annotation } from '../types';

interface Props {
  annotation: Annotation;
  imageWidth: number;
  imageHeight: number;
  onLongPress: () => void;
}

const SEVERITY_COLOR: Record<string, string> = {
  high: '#d32f2f',
  medium: '#f57c00',
  low: '#388e3c',
};

const PIN_SIZE = 28;

export default function AnnotationPin({ annotation, imageWidth, imageHeight, onLongPress }: Props) {
  const color = SEVERITY_COLOR[annotation.severity] ?? '#666';
  const left = annotation.x * imageWidth - PIN_SIZE / 2;
  const top = annotation.y * imageHeight - PIN_SIZE / 2;

  return (
    <TouchableOpacity
      style={[styles.pin, { left, top, borderColor: color, backgroundColor: color }]}
      onLongPress={onLongPress}
      activeOpacity={0.75}
    >
      <Text style={styles.pinText}>!</Text>
      {/* Subtle pulse ring */}
      <View style={[styles.ring, { borderColor: color }]} pointerEvents="none" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pin: {
    position: 'absolute',
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  },
  pinText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 16,
  },
  ring: {
    position: 'absolute',
    width: PIN_SIZE + 10,
    height: PIN_SIZE + 10,
    borderRadius: (PIN_SIZE + 10) / 2,
    borderWidth: 2,
    opacity: 0.4,
    top: -7,
    left: -7,
  },
});
