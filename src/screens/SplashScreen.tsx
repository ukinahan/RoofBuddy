import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Text, Animated, StyleSheet } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { loadCompanyProfile } from '../services/company';

export default function SplashScreen() {
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Three dots, each fading in/out with a staggered delay
  const dot1 = useRef(new Animated.Value(0.2)).current;
  const dot2 = useRef(new Animated.Value(0.2)).current;
  const dot3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    (async () => {
      try {
        const profile = await loadCompanyProfile();
        if (profile.logoUri) {
          const info = await FileSystem.getInfoAsync(profile.logoUri);
          if (info.exists) {
            setLogoUri(profile.logoUri);
          }
        }
      } catch { /* use default */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1,   duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.2, duration: 400, useNativeDriver: true }),
          Animated.delay(800 - delay),
        ])
      );

    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 267);
    const a3 = pulse(dot3, 534);

    a1.start();
    a2.start();
    a3.start();

    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.container}>
      {logoUri ? (
        <Image
          source={{ uri: logoUri }}
          style={styles.logo}
          resizeMode="contain"
        />
      ) : (
        <View style={styles.appNameWrap}>
          <Text style={styles.appName}>Roof Report</Text>
          <Text style={styles.appTagline}>Inspection Reports</Text>
        </View>
      )}
      <View style={styles.dotsRow}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: dot }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f6f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 260,
    height: 180,
    marginBottom: 48,
  },
  appNameWrap: {
    alignItems: 'center',
    marginBottom: 48,
  },
  appName: {
    fontSize: 36,
    fontWeight: '900',
    color: '#1a3c5e',
    letterSpacing: 1,
  },
  appTagline: {
    fontSize: 14,
    color: '#888',
    marginTop: 6,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1a3c5e',
  },
});
