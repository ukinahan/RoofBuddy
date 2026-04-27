/**
 * Crash + error telemetry. No-op when SENTRY_DSN is not configured.
 *
 * To enable:
 *   1. npm i @sentry/react-native
 *   2. Set SENTRY_DSN in .env (and EAS Secrets for production builds)
 *   3. Run `npx sentry-wizard -i reactNative` once to wire native projects
 *      (only needed if you stop using Expo Go and start using EAS dev builds)
 */

import Constants from 'expo-constants';

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const extra = (Constants.expoConfig?.extra ?? (Constants as any).manifest?.extra) as
    | { sentryDsn?: string }
    | undefined;
  const dsn = extra?.sentryDsn;
  if (!dsn) return; // disabled

  try {
    // Lazy require so the package is optional until the user installs it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn,
      enableAutoSessionTracking: true,
      tracesSampleRate: 0.1,
    });
    initialized = true;
  } catch {
    // @sentry/react-native not installed yet; silently no-op.
  }
}

export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (!initialized) {
    if (__DEV__) console.warn('[sentry-noop]', err, context);
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native');
    Sentry.withScope((scope: any) => {
      if (context) scope.setExtras(context);
      Sentry.captureException(err);
    });
  } catch { /* ignore */ }
}
