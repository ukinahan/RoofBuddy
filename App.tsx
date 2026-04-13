import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from './src/types';

import HomeScreen from './src/screens/HomeScreen';
import NewInspectionScreen from './src/screens/NewInspectionScreen';
import InspectionScreen from './src/screens/InspectionScreen';
import CameraScreen from './src/screens/CameraScreen';
import PhotoDetailScreen from './src/screens/PhotoDetailScreen';
import ReportScreen from './src/screens/ReportScreen';
import QuoteScreen from './src/screens/QuoteScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#1a3c5e' },
          headerTintColor: 'white',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#f5f5f5' },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Roof Inspections' }}
        />
        <Stack.Screen
          name="NewInspection"
          component={NewInspectionScreen}
          options={{ title: 'New Inspection' }}
        />
        <Stack.Screen
          name="Inspection"
          component={InspectionScreen}
          options={{ title: 'Inspection' }}
        />
        <Stack.Screen
          name="Camera"
          component={CameraScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PhotoDetail"
          component={PhotoDetailScreen}
          options={{ title: 'Photo Detail' }}
        />
        <Stack.Screen
          name="Report"
          component={ReportScreen}
          options={{ title: 'Generate Report' }}
        />
        <Stack.Screen
          name="Quote"
          component={QuoteScreen}
          options={{ title: 'Customer Quote' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
