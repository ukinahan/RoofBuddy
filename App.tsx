import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { Text, AppState, AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from './src/types';
import { initSentry } from './src/services/sentry';
import { useT } from './src/services/i18n';
import { triggerBackgroundSync } from './src/services/sync';
import ErrorBoundary from './src/components/ErrorBoundary';

import SplashScreen from './src/screens/SplashScreen';
import HomeScreen from './src/screens/HomeScreen';
import NewInspectionScreen from './src/screens/NewInspectionScreen';
import InspectionScreen from './src/screens/InspectionScreen';
import CameraScreen from './src/screens/CameraScreen';
import PhotoDetailScreen from './src/screens/PhotoDetailScreen';
import ReportScreen from './src/screens/ReportScreen';
import QuoteScreen from './src/screens/QuoteScreen';
import CompanyProfileScreen from './src/screens/CompanyProfileScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import CustomerDetailScreen from './src/screens/CustomerDetailScreen';
import JobsScreen from './src/screens/JobsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { isOnboardingComplete } from './src/services/onboarding';

initSentry();

const InspectionsStack = createNativeStackNavigator<RootStackParamList>();
const CustomersStack = createNativeStackNavigator<RootStackParamList>();
const SettingsStack = createNativeStackNavigator<RootStackParamList>();
const JobsStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const stackScreenOptions = {
  headerStyle: { backgroundColor: '#1a3c5e' },
  headerTintColor: 'white',
  headerTitleStyle: { fontWeight: '700' as const },
  contentStyle: { backgroundColor: '#f5f5f5' },
};

function InspectionsStackNav() {
  return (
    <InspectionsStack.Navigator initialRouteName="Home" screenOptions={stackScreenOptions}>
      <InspectionsStack.Screen name="Home" component={HomeScreen} options={{ title: 'Roof Report' }} />
      <InspectionsStack.Screen name="NewInspection" component={NewInspectionScreen} options={{ title: 'New Inspection' }} />
      <InspectionsStack.Screen name="Inspection" component={InspectionScreen} options={{ title: 'Inspection' }} />
      <InspectionsStack.Screen name="Camera" component={CameraScreen} options={{ headerShown: false }} />
      <InspectionsStack.Screen name="PhotoDetail" component={PhotoDetailScreen} options={{ title: 'Photo Detail' }} />
      <InspectionsStack.Screen name="Report" component={ReportScreen} options={{ title: 'Generate Report' }} />
      <InspectionsStack.Screen name="Quote" component={QuoteScreen} options={{ title: 'Customer Quote' }} />
    </InspectionsStack.Navigator>
  );
}

function CustomersStackNav() {
  return (
    <CustomersStack.Navigator screenOptions={stackScreenOptions}>
      <CustomersStack.Screen name="CustomersList" component={CustomersScreen} options={{ title: 'Customers' }} />
      <CustomersStack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Customer' }} />
      <CustomersStack.Screen name="NewInspection" component={NewInspectionScreen} options={{ title: 'New Inspection' }} />
      <CustomersStack.Screen name="Inspection" component={InspectionScreen} options={{ title: 'Inspection' }} />
      <CustomersStack.Screen name="PhotoDetail" component={PhotoDetailScreen} options={{ title: 'Photo Detail' }} />
      <CustomersStack.Screen name="Camera" component={CameraScreen} options={{ headerShown: false }} />
      <CustomersStack.Screen name="Report" component={ReportScreen} options={{ title: 'Generate Report' }} />
      <CustomersStack.Screen name="Quote" component={QuoteScreen} options={{ title: 'Customer Quote' }} />
    </CustomersStack.Navigator>
  );
}

function JobsStackNav() {
  return (
    <JobsStack.Navigator screenOptions={stackScreenOptions}>
      <JobsStack.Screen name="Jobs" component={JobsScreen} options={{ title: 'Jobs' }} />
      <JobsStack.Screen name="Inspection" component={InspectionScreen} options={{ title: 'Inspection' }} />
      <JobsStack.Screen name="PhotoDetail" component={PhotoDetailScreen} options={{ title: 'Photo Detail' }} />
      <JobsStack.Screen name="Camera" component={CameraScreen} options={{ headerShown: false }} />
      <JobsStack.Screen name="Report" component={ReportScreen} options={{ title: 'Generate Report' }} />
      <JobsStack.Screen name="Quote" component={QuoteScreen} options={{ title: 'Customer Quote' }} />
    </JobsStack.Navigator>
  );
}

function SettingsStackNav() {
  return (
    <SettingsStack.Navigator screenOptions={stackScreenOptions}>
      <SettingsStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <SettingsStack.Screen name="CompanyProfile" component={CompanyProfileScreen} options={{ title: 'Company Profile' }} />
      <SettingsStack.Screen name="Auth" component={AuthScreen} options={{ title: 'Cloud Sync' }} />
    </SettingsStack.Navigator>
  );
}

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
}

function MainTabs() {
  const t = useT();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1a3c5e',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { paddingTop: 4 },
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="JobsTab"
        component={JobsStackNav}
        options={{ title: t('tabs.jobs'), tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} /> }}
      />
      <Tab.Screen
        name="InspectionsTab"
        component={InspectionsStackNav}
        options={{ title: t('tabs.inspections'), tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }}
      />
      <Tab.Screen
        name="CustomersTab"
        component={CustomersStackNav}
        options={{ title: t('tabs.customers'), tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} /> }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStackNav}
        options={{ title: t('tabs.settings'), tabBarIcon: ({ focused }) => <TabIcon emoji="⚙" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 2200);
    isOnboardingComplete().then(setOnboarded);
    return () => clearTimeout(timer);
  }, []);

  // Auto-sync: best-effort silent sync on launch and whenever the app
  // returns to the foreground. Internally throttled to once a minute and
  // no-ops if the user isn't signed in to cloud sync.
  useEffect(() => {
    triggerBackgroundSync();
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') triggerBackgroundSync();
    });
    return () => sub.remove();
  }, []);

  if (!ready || onboarded === null) {
    return (
      <>
        <StatusBar style="dark" />
        <SplashScreen />
      </>
    );
  }

  if (!onboarded) {
    return (
      <ErrorBoundary>
        <StatusBar style="light" />
        <OnboardingScreen onDone={() => setOnboarded(true)} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <NavigationContainer>
        <StatusBar style="light" />
        <MainTabs />
      </NavigationContainer>
    </ErrorBoundary>
  );
}
