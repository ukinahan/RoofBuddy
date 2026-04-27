import { useWindowDimensions } from 'react-native';

/**
 * Responsive layout helper.
 *
 * Returns layout primitives that adapt to phone vs. iPad and
 * portrait vs. landscape. Uses `useWindowDimensions` so values
 * update live on rotation and iPad multitasking (Split View / Slide Over).
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const shortest = Math.min(width, height);
  const isTablet = shortest >= 600;
  const isLandscape = width > height;

  // Number of columns for the photo grid on the inspection screen.
  let photoColumns = 2;
  if (isTablet) photoColumns = isLandscape ? 4 : 3;

  // Number of columns for the inspection list on the home screen.
  const inspectionColumns = isTablet ? 2 : 1;

  // Cap reading-style content (forms, reports) so it stays comfortable
  // on a wide iPad screen instead of stretching edge-to-edge.
  const contentMaxWidth = isTablet ? (isLandscape ? 900 : 720) : width;

  return {
    width,
    height,
    isTablet,
    isLandscape,
    photoColumns,
    inspectionColumns,
    contentMaxWidth,
  };
}
