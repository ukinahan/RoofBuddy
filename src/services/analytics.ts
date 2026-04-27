/**
 * Lightweight analytics — uses Sentry breadcrumbs (already wired) so we
 * don't add a new paid service. Free tier of Sentry covers this fully.
 *
 * If Sentry isn't initialized, all calls silently no-op.
 */
import * as Sentry from '@sentry/react-native';

type EventProps = Record<string, string | number | boolean | undefined>;

export function track(name: string, props?: EventProps) {
  try {
    Sentry.addBreadcrumb({
      category: 'analytics',
      message: name,
      level: 'info',
      data: props,
    });
  } catch {
    // never throw from analytics
  }
}

export function setUserContext(props: { id?: string; email?: string }) {
  try {
    Sentry.setUser({ id: props.id, email: props.email });
  } catch {
    /* no-op */
  }
}
