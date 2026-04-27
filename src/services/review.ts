/**
 * App Store / Play Store rating prompt.
 * - Counts "delight" events (e.g. PDF generated successfully).
 * - Asks the OS to show the rating sheet after the 3rd delight event,
 *   then never again (the OS itself rate-limits to ~3 prompts/year anyway).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const COUNT_KEY = 'review.delightCount';
const PROMPTED_KEY = 'review.prompted';
const THRESHOLD = 3;

/** Call this after a moment of user delight (PDF emailed, report shared, etc). */
export async function recordDelightAndMaybePrompt(): Promise<void> {
  try {
    const prompted = await AsyncStorage.getItem(PROMPTED_KEY);
    if (prompted === '1') return;

    const raw = await AsyncStorage.getItem(COUNT_KEY);
    const next = (raw ? parseInt(raw, 10) : 0) + 1;
    await AsyncStorage.setItem(COUNT_KEY, String(next));

    if (next < THRESHOLD) return;

    const available = await StoreReview.isAvailableAsync();
    if (!available) return;
    const has = await StoreReview.hasAction();
    if (!has) return;

    await StoreReview.requestReview();
    await AsyncStorage.setItem(PROMPTED_KEY, '1');
  } catch {
    /* never throw from a UX hint */
  }
}
