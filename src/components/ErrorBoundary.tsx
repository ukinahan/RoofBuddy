import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { captureError } from '../services/sentry';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Catches render-time exceptions from anywhere in the
 * tree and shows a recovery screen instead of the OS-level white screen of death.
 *
 * Errors are reported to Sentry (if configured) and the user can tap "Try Again"
 * to remount the tree. This does not catch async errors, event-handler errors,
 * or errors in setTimeout/Promise callbacks — those still need explicit
 * try/catch in the calling code.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureError(error, { componentStack: info.componentStack });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.inner}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            RoofBuddy hit an unexpected error. Your saved inspections, customers and
            photos are still on your device — they have not been lost.
          </Text>
          <Text style={styles.body}>
            Tap below to try again. If this keeps happening, take a screenshot and
            send it to support.
          </Text>
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Details</Text>
            <Text style={styles.errorText}>{this.state.error.message}</Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a3c5e' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  icon: { fontSize: 56, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: 'white', textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: 12, lineHeight: 21 },
  errorBox: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 14, marginVertical: 18 },
  errorTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  errorText: { color: 'white', fontSize: 13, fontFamily: 'Menlo' },
  btn: { backgroundColor: 'white', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#1a3c5e', fontWeight: '800', fontSize: 16 },
});
