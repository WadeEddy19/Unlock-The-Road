import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { UnitsProvider } from './src/context/UnitsContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />
      <AuthProvider>
        <UnitsProvider>
          <AppNavigator />
        </UnitsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}