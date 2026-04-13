import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { v4 as uuidv4 } from 'uuid';
import { RootStackParamList, Inspection, InspectionPhoto } from '../types';
import { getInspection, updateInspection } from '../services/storage';
import PhotoCard from '../components/PhotoCard';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Inspection'>;
type Route = RouteProp<RootStackParamList, 'Inspection'>;

export default function InspectionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { inspectionId } = route.params;

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await getInspection(inspectionId);
    setInspection(data);
    setLoading(false);
  }, [inspectionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /** Saves an image from the given URI into the app's document directory
   *  so it persists after the user navigates away from camera roll. */
  const persistImage = async (tempUri: string): Promise<string> => {
    const dir = FileSystem.documentDirectory + 'photos/';
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const dest = dir + uuidv4() + '.jpg';
    await FileSystem.copyAsync({ from: tempUri, to: dest });
    return dest;
  };

  const addPhoto = async (tempUri: string) => {
    if (!inspection) return;
    const uri = await persistImage(tempUri);
    const photo: InspectionPhoto = {
      id: uuidv4(),
      uri,
      takenAt: new Date().toISOString(),
      notes: '',
      annotations: [],
      drawings: [],
    };
    const updated = { ...inspection, photos: [...inspection.photos, photo] };
    await updateInspection(updated);
    setInspection(updated);
  };

  const handleCamera = () => {
    navigation.navigate('Camera', { inspectionId });
  };

  const handleLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      for (const asset of result.assets) {
        await addPhoto(asset.uri);
      }
    }
  };

  if (loading || !inspection) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a3c5e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Info Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerName}>{inspection.customerName}</Text>
        {inspection.ref ? <Text style={styles.bannerRef}>Ref: {inspection.ref}</Text> : null}
        <Text style={styles.bannerAddress}>{inspection.address}</Text>
        <Text style={styles.bannerDate}>{new Date(inspection.date).toLocaleDateString()}</Text>
      </View>

      {/* Photo Grid */}
      <FlatList
        data={inspection.photos}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No photos yet. Tap a button below to add photos.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <PhotoCard
            photo={item}
            onPress={() =>
              navigation.navigate('PhotoDetail', {
                inspectionId,
                photoId: item.id,
              })
            }
          />
        )}
      />

      {/* Bottom Buttons */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.btnCamera} onPress={handleCamera} activeOpacity={0.85}>
          <Text style={styles.btnText}>📷  Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnLibrary} onPress={handleLibrary} activeOpacity={0.85}>
          <Text style={styles.btnText}>🖼  Library</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnQuote}
          onPress={() => navigation.navigate('Quote', { inspectionId })}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>💶  Quote</Text>
        </TouchableOpacity>
        {inspection.photos.length > 0 && (
          <TouchableOpacity
            style={styles.btnReport}
            onPress={() => navigation.navigate('Report', { inspectionId })}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>📄  Report</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  banner: {
    backgroundColor: '#1a3c5e',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerName: { color: 'white', fontSize: 16, fontWeight: '700' },
  bannerRef: { color: '#f0c060', fontSize: 13, marginTop: 2, fontWeight: '600' },
  bannerAddress: { color: '#b0c8e0', fontSize: 13, marginTop: 2 },
  bannerDate: { color: '#7aafd4', fontSize: 12, marginTop: 2 },
  grid: { padding: 8, paddingBottom: 110 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 12,
    paddingBottom: 28,
    gap: 10,
  },
  btnCamera: {
    flex: 1,
    backgroundColor: '#1a3c5e',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnLibrary: {
    flex: 1,
    backgroundColor: '#2e6da4',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnQuote: {
    flex: 1,
    backgroundColor: '#8b5e2e',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnReport: {
    flex: 1,
    backgroundColor: '#2e8b57',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: 'white', fontSize: 14, fontWeight: '600' },
});
