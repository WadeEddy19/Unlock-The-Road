import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import LocationDetailScreen from '../screens/LocationDetailScreen';
import UnlockedLocationsScreen from '../screens/UnlockedLocationsScreen';

// Auth screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// Main app screens
import MapScreen from '../screens/MapScreen';
import LocationsScreen from '../screens/LocationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TripHistoryScreen from '../screens/TripHistoryScreen';
import TripDetailScreen from '../screens/TripDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const TripStack = createNativeStackNavigator();
const MapStack = createNativeStackNavigator();

const ProfileStack = createNativeStackNavigator();

const LocationStack = createNativeStackNavigator();

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#2E7D32' },
        headerTintColor: '#fff',
      }}
    >
      <ProfileStack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <ProfileStack.Screen
        name="UnlockedLocations"
        component={UnlockedLocationsScreen}
        options={{ title: 'My Locations' }}
      />
      <ProfileStack.Screen
        name="LocationDetail"
        component={LocationDetailScreen}
        options={{ title: 'Location Photos' }}
      />
    </ProfileStack.Navigator>
  );
}

function MapStackScreen() {
  return (
    <MapStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#2E7D32' },
        headerTintColor: '#fff',
      }}
    >
      <MapStack.Screen
        name="MapMain"
        component={MapScreen}
        options={{ title: 'Explore' }}
      />
      <MapStack.Screen
        name="LocationDetail"
        component={LocationDetailScreen}
        options={{ title: 'Location Photos' }}
      />
    </MapStack.Navigator>
  );
}

function AuthStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function LocationStackScreen() {
  return (
    <LocationStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#2E7D32' },
        headerTintColor: '#fff',
      }}
    >
      <LocationStack.Screen
        name="LocationsList"
        component={LocationsScreen}
        options={{ title: 'Locations' }}
      />
      <LocationStack.Screen
        name="LocationDetail"
        component={LocationDetailScreen}
        options={{ title: 'Location Photos' }}
      />
    </LocationStack.Navigator>
  );
}

function TripStackScreen() {
  return (
    <TripStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#2E7D32' },
        headerTintColor: '#fff',
      }}
    >
      <TripStack.Screen
        name="TripHistory"
        component={TripHistoryScreen}
        options={{ title: 'My Trips' }}
      />
      <TripStack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={{ title: 'Trip Details' }}
      />
    </TripStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#2E7D32' },
        headerTintColor: '#fff',
        tabBarActiveTintColor: '#2E7D32',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { paddingBottom: 5, height: 60 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Map"
        component={MapStackScreen}
        options={{
          headerShown: false,
          tabBarLabel: '🗺️ Map',
        }}
      />
      <Tab.Screen
        name="Locations"
        component={LocationStackScreen}
        options={{
          headerShown: false,
          tabBarLabel: '📍 Locations',
        }}
      />
      <Tab.Screen
        name="Trips"
        component={TripStackScreen}
        options={{
          headerShown: false,
          tabBarLabel: '🚗 Trips',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackScreen}
        options={{
          headerShown: false,
          tabBarLabel: '👤 Profile',
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainTabs /> : <AuthStackScreen />}
    </NavigationContainer>
  );
}