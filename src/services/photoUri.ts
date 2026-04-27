/**
 * Photo URI resolver.
 *
 * Background: iOS rotates the app's container UUID across reinstalls (and
 * sometimes across major TestFlight updates), which invalidates absolute
 * `file:///var/mobile/Containers/Data/Application/<UUID>/Documents/...` URIs
 * stored in AsyncStorage. The files themselves survive in Documents, but the
 * stored URI prefix no longer matches the current container — the result is
 * "black photos" everywhere they're rendered.
 *
 * Fix: at render/read time, take whatever URI we have stored, find the
 * `Documents/<knownSubdir>/...` portion, and rebuild it against the *current*
 * `FileSystem.documentDirectory`. Newly captured photos can also be stored as
 * relative paths (e.g. `photos/abc.jpg`) and resolved the same way.
 */
import * as FileSystem from 'expo-file-system/legacy';

const KNOWN_SUBDIRS = ['photos/', 'company/'];

/** Convert a stored URI (absolute file://, relative subpath, or data: URI)
 *  into an absolute file:// URI rooted at the *current* documentDirectory. */
export function resolvePhotoUri(stored: string | undefined | null): string {
  if (!stored) return '';
  // Pass through inline data URIs and remote http(s) URLs unchanged.
  if (stored.startsWith('data:') || stored.startsWith('http://') || stored.startsWith('https://')) {
    return stored;
  }

  const docDir = FileSystem.documentDirectory ?? '';

  // Already-relative path like "photos/abc.jpg".
  for (const sub of KNOWN_SUBDIRS) {
    if (stored.startsWith(sub)) return docDir + stored;
  }

  // Absolute file:// URI — extract everything after the last "Documents/" segment
  // and re-root it on the current documentDirectory.
  const docsIdx = stored.indexOf('/Documents/');
  if (docsIdx >= 0) {
    const tail = stored.substring(docsIdx + '/Documents/'.length);
    return docDir + tail;
  }

  // Last-ditch: try matching by known subdir anywhere in the path.
  for (const sub of KNOWN_SUBDIRS) {
    const idx = stored.indexOf('/' + sub);
    if (idx >= 0) return docDir + stored.substring(idx + 1);
  }

  return stored;
}

/** Build a relative path for a freshly captured photo file (so the stored
 *  value is portable across container UUIDs from day one). */
export function relativePhotoPath(filename: string): string {
  return 'photos/' + filename;
}
