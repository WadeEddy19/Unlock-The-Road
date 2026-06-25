/*
TripDetailScreen loads the full trip with all waypoints and renders the route on a map.
 Green marker for start, red for end, blue polyline for the route. It auto-fits the map to show the entire trip.
Below the map you
 get stats cards (distance, duration, waypoints) and a timeline of any locations unlocked during the trip.
*/

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { tripAPI } from '../services/api';

import { useUnits } from '../context/UnitsContext';

export default function TripDetailScreen({ route }) {
  const { tripId } = route.params;
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const { formatKm } = useUnits();

  useEffect(() => {
    loadTrip();
  }, []);

  const loadTrip = async () => {
    try {
      const response = await tripAPI.getTrip(tripId);
      setTrip(response.data.trip);
    } catch (error) {
      console.error('Failed to load trip:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (startedAt, endedAt) => {
    if (!endedAt) return 'In progress';
    const diff = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Trip not found.</Text>
      </View>
    );
  }

  const waypoints = trip.waypoints || [];
  const routeCoords = waypoints.map((wp) => ({
    latitude: wp.latitude,
    longitude: wp.longitude,
  }));

  // Calculate map region to fit the route
  let mapRegion = {
    latitude: 37.0902,
    longitude: -95.7129,
    latitudeDelta: 30,
    longitudeDelta: 30,
  };

  if (waypoints.length > 0) {
    const lats = waypoints.map((wp) => wp.latitude);
    const lngs = waypoints.map((wp) => wp.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const padding = 0.01;

    mapRegion = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(maxLat - minLat + padding, 0.01),
      longitudeDelta: Math.max(maxLng - minLng + padding, 0.01),
    };
  }

  const startPoint = waypoints[0];
  const endPoint = waypoints[waypoints.length - 1];
  const unlocks = trip.unlocks_during_trip || [];

  return (
    <ScrollView style={styles.container}>
      {/* Route map */}
      <View style={styles.mapContainer}>
        <MapView style={styles.map} initialRegion={mapRegion}>
          {routeCoords.length > 1 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor="#1565C0"
              strokeWidth={4}
            />
          )}
          {startPoint && (
            <Marker
              coordinate={{
                latitude: startPoint.latitude,
                longitude: startPoint.longitude,
              }}
              title="Start"
              pinColor="#4CAF50"
            />
          )}
          {endPoint && waypoints.length > 1 && (
            <Marker
              coordinate={{
                latitude: endPoint.latitude,
                longitude: endPoint.longitude,
              }}
              title="End"
              pinColor="#EF5350"
            />
          )}
        </MapView>
      </View>

      {/* Trip info */}
      <View style={styles.infoSection}>
        <Text style={styles.tripName}>{trip.name}</Text>
        <Text style={styles.tripDate}>{formatDate(trip.started_at)}</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>📏</Text>
            <Text style={styles.statValue}>
              {formatKm(trip.total_distance_km || 0)}
            </Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⏱️</Text>
            <Text style={styles.statValue}>
              {formatDuration(trip.started_at, trip.ended_at)}
            </Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
        </View>

        {/* Time details */}
        <View style={styles.timeCard}>
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>🟢 Started</Text>
            <Text style={styles.timeValue}>{formatTime(trip.started_at)}</Text>
          </View>
          {trip.ended_at && (
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>🔴 Ended</Text>
              <Text style={styles.timeValue}>{formatTime(trip.ended_at)}</Text>
            </View>

            
          )}
        </View>

        {/* Unlocks during trip */}
        {unlocks.length > 0 && (
          <View style={styles.unlocksCard}>
            <Text style={styles.unlocksTitle}>
              🔓 Locations Unlocked ({unlocks.length})
            </Text>
            {unlocks.map((unlock, index) => (
              <View key={index} style={styles.unlockRow}>
                <Text style={styles.unlockEmoji}>📍</Text>
                <View style={styles.unlockInfo}>
                  <Text style={styles.unlockName}>{unlock.location_name}</Text>
                  <Text style={styles.unlockTime}>
                    {formatTime(unlock.unlocked_at)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  mapContainer: {
    height: 300,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  infoSection: {
    padding: 20,
  },
  tripName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  tripDate: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  timeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  timeLabel: {
    fontSize: 15,
    color: '#333',
  },
  timeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  unlocksCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  unlocksTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  unlockEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  unlockInfo: {
    flex: 1,
  },
  unlockName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  unlockTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});