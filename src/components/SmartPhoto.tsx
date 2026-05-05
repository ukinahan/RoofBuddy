/**
 * <SmartPhoto> — wraps RN's <Image> with a Supabase Storage fallback so a
 * photo still renders when the local file is missing.
 *
 * Why: stored photo URIs can become invalid for a few reasons —
 *   - iOS rotates the app's container UUID across reinstalls / TestFlight
 *     upgrades, so absolute file:// paths captured before the rotation no
 *     longer resolve.
 *   - The inspection was synced from another device but the photo bytes
 *     have not yet been pulled to disk.
 *   - The local cache was cleared.
 *
 * Strategy: try the resolved local URI first (fast, offline, no auth round
 * trip). On load failure, request a 1-hour signed URL from the `photos`
 * bucket and retry with that. This works for both inspections owned by the
 * current user and for shared inspections — the photo path follows the
 * inspection owner's user-id, which we receive from props (or fall back to
 * the current user as the previous behaviour).
 */
import React, { useEffect, useState } from 'react';
import { Image, ImageProps } from 'react-native';
import { InspectionPhoto } from '../types';
import { resolvePhotoUri } from '../services/photoUri';
import { getSupabase, isSupabaseConfigured } from '../services/supabase';

interface Props extends Omit<ImageProps, 'source'> {
  photo: InspectionPhoto;
  /** Owner user-id for the inspection (used to build the storage path).
   *  When omitted, falls back to the current user. */
  ownerId?: string;
}

async function fetchSignedUrl(photoId: string, ownerId?: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = getSupabase();
    if (!sb) return null;
    let owner = ownerId;
    if (!owner) {
      const { data: userData } = await sb.auth.getUser();
      owner = userData.user?.id;
    }
    if (!owner) return null;
    const { data, error } = await sb.storage
      .from('photos')
      .createSignedUrl(`${owner}/${photoId}.jpg`, 60 * 60);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export default function SmartPhoto({ photo, ownerId, onError, ...rest }: Props) {
  const localUri = resolvePhotoUri(photo.uri);
  const [uri, setUri] = useState<string>(localUri);
  const [triedCloud, setTriedCloud] = useState(false);

  // Reset when the underlying photo changes (so swapping between photos in
  // a list doesn't get stuck on the previous one's signed URL).
  useEffect(() => {
    setUri(resolvePhotoUri(photo.uri));
    setTriedCloud(false);
  }, [photo.id, photo.uri]);

  return (
    <Image
      {...rest}
      source={{ uri }}
      onError={async (e) => {
        if (!triedCloud) {
          setTriedCloud(true);
          const signed = await fetchSignedUrl(photo.id, ownerId);
          if (signed) {
            setUri(signed);
            return;
          }
        }
        onError?.(e);
      }}
    />
  );
}
