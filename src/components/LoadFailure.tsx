import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface CenteredProps {
  children?: React.ReactNode;
}

export function Centered({ children }: CenteredProps) {
  return <View style={styles.centered}>{children}</View>;
}

export function Loading({ label }: { label?: string }) {
  return (
    <Centered>
      <ActivityIndicator size="large" color="#1a3c5e" />
      {label ? <Text style={styles.loadingLabel}>{label}</Text> : null}
    </Centered>
  );
}

interface LoadFailureProps {
  /** Short headline */
  title?: string;
  /** Longer explanation, optional */
  message?: string;
  /** Retry callback. If omitted, only "Go Back" is shown. */
  onRetry?: () => void;
  /** Back / dismiss callback. Pass `navigation.goBack` from the screen. */
  onBack?: () => void;
}

/**
 * Standard "we couldn't load this thing" screen. Use whenever a screen depends
 * on async data that may fail or return null (deleted record, corrupt store,
 * etc.) instead of returning <View /> and showing a blank page.
 */
export function LoadFailure({
  title = 'Could not load',
  message = "We couldn't open this. The record may have been deleted or the data is corrupted.",
  onRetry,
  onBack,
}: LoadFailureProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🚫</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{message}</Text>
      <View style={styles.row}>
        {onRetry && (
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onRetry}>
            <Text style={styles.btnPrimaryText}>Try Again</Text>
          </TouchableOpacity>
        )}
        {onBack && (
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onBack}>
            <Text style={styles.btnSecondaryText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingLabel: { marginTop: 12, color: '#666', fontSize: 13 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, backgroundColor: '#f5f5f5' },
  icon: { fontSize: 48, marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '800', color: '#1a3c5e', marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  btnPrimary: { backgroundColor: '#1a3c5e' },
  btnPrimaryText: { color: 'white', fontWeight: '700' },
  btnSecondary: { backgroundColor: 'white', borderWidth: 1, borderColor: '#1a3c5e' },
  btnSecondaryText: { color: '#1a3c5e', fontWeight: '700' },
});
