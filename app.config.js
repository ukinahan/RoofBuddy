// Dynamic Expo config so secrets can be injected at build time via EAS env vars
// instead of being hard-coded in source. See .env.example for required vars.

/**
 * Expected env vars (set locally in .env or in EAS Secrets):
 *   GOOGLE_MAPS_API_KEY  – HTTP-referrer / bundle-restricted Google Maps key
 *   SENTRY_DSN           – Optional Sentry project DSN for crash reporting
 */
module.exports = () => ({
  expo: {
    name: 'Roof Report',
    slug: 'roof-inspector',
    scheme: 'roofbuddy',
    version: '1.4.1',
    orientation: 'default',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#1a3c5e',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.roofinspector.app',
      infoPlist: {
        NSCameraUsageDescription:
          'Roof Report needs camera access to take photos of roofs for inspection reports.',
        NSPhotoLibraryUsageDescription:
          'Roof Report needs photo library access to attach existing photos to inspections.',
        NSPhotoLibraryAddUsageDescription:
          'Roof Report saves inspection photos to your photo library.',
        ITSAppUsesNonExemptEncryption: false,
      },
      buildNumber: '24',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1a3c5e',
      },
      package: 'com.roofinspector.app',
      permissions: [
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_AUDIO',
      ],
    },
    web: { favicon: './assets/favicon.png' },
    plugins: [
      'expo-screen-orientation',
      'expo-camera',
      'expo-image-picker',
      'expo-media-library',
      'expo-asset',
      'expo-mail-composer',
      'expo-localization',
      'expo-updates',
    ],
    runtimeVersion: { policy: 'sdkVersion' },
    updates: {
      url: 'https://u.expo.dev/3b15cb1f-1dc4-486c-8499-afbb0c8cba25',
      fallbackToCacheTimeout: 0,
    },
    extra: {
      eas: { projectId: '3b15cb1f-1dc4-486c-8499-afbb0c8cba25' },
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
      sentryDsn: process.env.SENTRY_DSN ?? '',
      supabaseUrl: process.env.SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
    },
    owner: 'ukinahan',
  },
});
