import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { useUnits } from '../context/UnitsContext';
import MapView, { Marker, Circle, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { locationAPI, tripAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import UnlockCelebration from '../components/UnlockCelebration';

import {
  startBackgroundTracking,
  stopBackgroundTracking,
  setActiveTripId,
} from '../services/backgroundLocation';


const LOCATION_TYPE_COLORS = {
  national_park: '#2E7D32',
  national_monument: '#E65100',
  national_forest: '#1B5E20',
  state_park: '#4CAF50',
  historic_site: '#6D4C41',
  scenic_viewpoint: '#1565C0',
  point_of_interest: '#7B1FA2',
  city_park: '#66BB6A',
};

const LOCATION_TYPE_EMOJI = {
  national_park: '🏞️',
  national_monument: '🗿',
  national_forest: '🌲',
  state_park: '🌳',
  historic_site: '🏛️',
  scenic_viewpoint: '👀',
  point_of_interest: '📍',
  city_park: '🌿',
};
function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export default function MapScreen({ navigation }) {
  const { refreshUser } = useAuth();
  const mapRef = useRef(null);
  const waypointInterval = useRef(null);
  const activeTripRef = useRef(null);

  const [location, setLocation] = useState(null);
  const [nearbyLocations, setNearbyLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState(null);

  // Trip state
  const [activeTrip, setActiveTrip] = useState(null);
  const [tripRoute, setTripRoute] = useState([]);
  const [tripDistance, setTripDistance] = useState(0);
  const [tripStartTime, setTripStartTime] = useState(null);
  const [tripElapsed, setTripElapsed] = useState('00:00:00');

  const { formatDistance, formatRadius, formatKm } = useUnits();

  useEffect(() => {
    startLocationTracking();
    checkActiveTrip();
  }, []);

  // Trip timer
  useEffect(() => {
    let timer;
    if (activeTrip && tripStartTime) {
      timer = setInterval(() => {
        const diff = Date.now() - tripStartTime;
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTripElapsed(
          `${hours.toString().padStart(2, '0')}:${mins
            .toString()
            .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        );
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeTrip, tripStartTime]);

  const checkActiveTrip = async () => {
    try {
      const response = await tripAPI.getActive();
      if (response.data.trip) {
        const trip = response.data.trip;
        setActiveTrip(trip);
        activeTripRef.current = trip;
        setTripDistance(trip.total_distance_km || 0);
        setTripStartTime(new Date(trip.started_at).getTime());

        // Restore route from waypoints
        if (trip.waypoints?.length > 0) {
          setTripRoute(
            trip.waypoints.map((wp) => ({
              latitude: wp.latitude,
              longitude: wp.longitude,
            }))
          );
        }

        // Resume background tracking
        setActiveTripId(trip.id);
      }
    } catch (error) {
      console.error('Failed to check active trip:', error);
    }
  };

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is needed to find nearby places and unlock locations.'
        );
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation(currentLocation.coords);
      fetchNearby(currentLocation.coords.latitude, currentLocation.coords.longitude);

      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 50,
        },
        (newLocation) => {
          const { latitude, longitude } = newLocation.coords;
          setLocation(newLocation.coords);

          // Add to visible route during active trip
          if (activeTripRef.current) {
            setTripRoute((prev) => {
              const last = prev[prev.length - 1];
              if (!last ||
                  Math.abs(last.latitude - latitude) > 0.0001 ||
                  Math.abs(last.longitude - longitude) > 0.0001) {
                return [...prev, { latitude, longitude }];
              }
              return prev;
            });
          }

          // Keep map centered
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude,
              longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }, 500);
          }
        }
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to get your location.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNearby = async (latitude, longitude) => {
    try {
      const response = await locationAPI.getNearby(latitude, longitude, 50000);
      setNearbyLocations(response.data.locations);
    } catch (error) {
      console.error('Failed to fetch nearby locations:', error);
    }
  };

  const handleStartTrip = () => {
    Alert.prompt(
      'Start a Trip',
      'Give your trip a name (optional):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async (name) => {
            try {
              const response = await tripAPI.start(name || null);
              const trip = response.data.trip;
              setActiveTrip(trip);
              activeTripRef.current = trip;
              setTripRoute([]);
              setTripDistance(0);
              setTripStartTime(Date.now());

              // Add current location as first waypoint
              if (location) {
                await tripAPI.addWaypoint(trip.id, location.latitude, location.longitude);
                setTripRoute([
                  { latitude: location.latitude, longitude: location.longitude },
                ]);
              }

              // Start background tracking
              try {
                await startBackgroundTracking(trip.id);
              } catch (bgError) {
                console.warn('Background tracking not available:', bgError.message);
                // Fall back to foreground-only tracking
                startWaypointRecording(trip.id);
              }
            } catch (error) {
              const message =
                error.response?.data?.errors?.[0] || 'Failed to start trip.';
              Alert.alert('Error', message);
            }
          },
        },
      ],
      'plain-text',
      ''
    );
  };

  const startWaypointRecording = (tripId) => {
    // Clear any existing interval
    if (waypointInterval.current) {
      clearInterval(waypointInterval.current);
    }

    waypointInterval.current = setInterval(async () => {
      try {
        const currentPos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const { latitude, longitude } = currentPos.coords;
        const result = await tripAPI.addWaypoint(tripId, latitude, longitude);

        setTripRoute((prev) => [...prev, { latitude, longitude }]);
        setTripDistance(result.data.total_distance_km);
      } catch (error) {
        console.error('Failed to record waypoint:', error);
      }
    }, 30000); // Every 30 seconds
  };

  const handleEndTrip = () => {
    Alert.alert('End Trip', 'Are you sure you want to end this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Trip',
        style: 'destructive',
        onPress: async () => {
          // Stop tracking immediately
          try { await stopBackgroundTracking(); } catch (e) {}
          if (waypointInterval.current) {
            clearInterval(waypointInterval.current);
            waypointInterval.current = null;
          }

          // Get trip data for summary
          let finalDistance = tripDistance;
          try {
            const tripData = await tripAPI.getTrip(activeTrip.id);
            finalDistance = tripData.data.trip.total_distance_km || 0;
          } catch (e) {}

          // End the trip (ignore if already ended)
          try { await tripAPI.end(activeTrip.id); } catch (e) {}

          // Always show success and clean up
          Alert.alert(
            'Trip Complete! 🎉',
            `Distance: ${formatKm(finalDistance)}\nDuration: ${tripElapsed}`
          );

          setActiveTrip(null);
          activeTripRef.current = null;
          setTripRoute([]);
          setTripDistance(0);
          setTripStartTime(null);
          setTripElapsed('00:00:00');

          try { await refreshUser(); } catch (e) {}
        },
      },
    ]);
  };

  const handleMarkerPress = (loc) => {
    const distance_m = location
      ? Math.round(haversineMeters(
          location.latitude, location.longitude,
          loc.latitude, loc.longitude
        ))
      : undefined;
    setSelectedLocation({ ...loc, distance_m });
    setShowModal(true);
  };

  const handleUnlock = async () => {
    if (!selectedLocation || !location) return;

    setUnlocking(true);
    try {
      const response = await locationAPI.unlock(
        selectedLocation.id,
        location.latitude,
        location.longitude
      );

      setShowModal(false);
      setSelectedLocation(null);

      setCelebrationData(response.data);
      setShowCelebration(true);

      setNearbyLocations((prev) =>
        prev.map((loc) =>
          loc.id === selectedLocation.id ? { ...loc, unlocked: true } : loc
        )
      );

      await refreshUser();
    } catch (error) {
      const message =
        error.response?.data?.errors?.[0] || 'Failed to unlock location.';
      Alert.alert('Unlock Failed', message);
    } finally {
      setUnlocking(false);
    }
  };

  const handleRefresh = () => {
    if (location) {
      fetchNearby(location.latitude, location.longitude);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Finding your location...</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorEmoji}>📍</Text>
        <Text style={styles.errorText}>
          Location access is needed to explore and unlock places.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={startLocationTracking}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        
        showsMyLocationButton
      >
        {/* User location marker — always on top */}
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title="You are here"
          zIndex={999}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.userMarker}>
            <View style={styles.userMarkerDot} />
          </View>
        </Marker>


        {nearbyLocations.map((loc) => (
          <React.Fragment key={loc.id}>
            <Marker
              coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
              title={loc.name}
              zIndex={1}
              pinColor={
                loc.unlocked
                  ? '#FFD700'
                  : LOCATION_TYPE_COLORS[loc.location_type] || '#999'
              }
              onPress={() => handleMarkerPress(loc)}
            />
            {selectedLocation?.id === loc.id && (
              <Circle
                center={{ latitude: loc.latitude, longitude: loc.longitude }}
                radius={loc.unlock_radius}
                fillColor={
                  loc.unlocked
                    ? 'rgba(255, 215, 0, 0.15)'
                    : 'rgba(46, 125, 50, 0.15)'
                }
                strokeColor={
                  loc.unlocked
                    ? 'rgba(255, 215, 0, 0.4)'
                    : 'rgba(46, 125, 50, 0.4)'
                }
                strokeWidth={1}
              />
            )}
          </React.Fragment>
        ))}

        {/* Trip route line */}
        {tripRoute.length > 1 && (
          <Polyline
            coordinates={tripRoute}
            strokeColor="#1565C0"
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Refresh button */}
      <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
        <Text style={styles.refreshEmoji}>🔄</Text>
      </TouchableOpacity>

      {/* Location count badge */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>📍 {nearbyLocations.length} nearby</Text>
      </View>

      {/* Trip controls */}
      {activeTrip ? (
        <View style={styles.tripPanel}>
          <View style={styles.tripInfo}>
            <Text style={styles.tripName}>{activeTrip.name}</Text>
            <View style={styles.tripStats}>
              <Text style={styles.tripStat}>⏱️ {tripElapsed}</Text>
              <Text style={styles.tripStat}>📏 {formatKm(tripDistance)}</Text>
              <Text style={styles.tripStat}>📌 {tripRoute.length} pts</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.endTripButton} onPress={handleEndTrip}>
            <Text style={styles.endTripText}>End Trip</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.startTripButton} onPress={handleStartTrip}>
          <Text style={styles.startTripEmoji}>🚗</Text>
          <Text style={styles.startTripText}>Start Trip</Text>
        </TouchableOpacity>
      )}

      {/* Location detail modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedLocation && (
              <>
                <Text style={styles.modalEmoji}>
                  {LOCATION_TYPE_EMOJI[selectedLocation.location_type] || '📍'}
                </Text>
                <Text style={styles.modalTitle}>{selectedLocation.name}</Text>
                <Text style={styles.modalType}>
                  {selectedLocation.location_type.replace(/_/g, ' ').toUpperCase()}
                </Text>
                <Text style={styles.modalDescription}>
                  {selectedLocation.description}
                </Text>

                <View style={styles.modalStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {selectedLocation.xp_reward} XP
                    </Text>
                    <Text style={styles.statLabel}>Reward</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {formatDistance(selectedLocation.distance_m)}
                    </Text>
                    <Text style={styles.statLabel}>Distance</Text>
                  </View>
                  
                </View>

                {selectedLocation.unlocked ? (
                  <View style={styles.unlockedBadge}>
                    <Text style={styles.unlockedText}>✅ Unlocked!</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.unlockButton, unlocking && styles.buttonDisabled]}
                    onPress={handleUnlock}
                    disabled={unlocking}
                  >
                    {unlocking ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.unlockButtonText}>
                        🔓 Unlock This Location
                      </Text>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.directionsButton}
                  onPress={() => {
                    const lat = selectedLocation.latitude;
                    const lng = selectedLocation.longitude;
                    const name = encodeURIComponent(selectedLocation.name);
                    const url = `maps://app?daddr=${lat},${lng}&q=${name}`;
                    Linking.openURL(url);
                  }}
                >
                  <Text style={styles.directionsText}>🧭 Get Directions</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.photosButton}
                  onPress={() => {
                    setShowModal(false);
                    setSelectedLocation(null);
                    navigation.navigate('LocationDetail', { location: selectedLocation });
                  }}
                >
                  <Text style={styles.photosText}>📸 View Photos</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowModal(false);
                    setSelectedLocation(null);
                  }}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Unlock celebration */}
      <UnlockCelebration
        visible={showCelebration}
        data={celebrationData}
        onClose={() => {
          setShowCelebration(false);
          setCelebrationData(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  refreshButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#fff',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  refreshEmoji: {
    fontSize: 22,
  },
  badge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  // Trip controls
  startTripButton: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#1565C0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  startTripEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  startTripText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  tripPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  tripInfo: {
    marginBottom: 12,
  },
  tripName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  tripStats: {
    flexDirection: 'row',
    gap: 16,
  },
  tripStat: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  endTripButton: {
    backgroundColor: '#EF5350',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  endTripText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    letterSpacing: 1,
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 32,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  unlockedBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  unlockedText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2E7D32',
  },
  unlockButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  unlockButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  directionsButton: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  photosButton: {
    backgroundColor: '#7B1FA2',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  photosText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  directionsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    paddingVertical: 12,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#999',
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#fff',
  },
});