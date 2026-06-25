/*
TripHistoryScreen shows all your past trips as cards with distance, duration, waypoint count, and unlocks. 
Active trips show a green "ACTIVE" badge. Each card is tappable to view the full details. 
The list refreshes automatically when you navigate to the tab 
(via useFocusEffect), so ending a trip on the map and switching to the Trips tab shows it immediately.
*/

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Alert,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { tripAPI } from '../services/api';

import { useUnits } from '../context/UnitsContext';

export default function TripHistoryScreen({ navigation }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { formatKm } = useUnits();

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadTrips(1, true);
    }, [])
  );

  const loadTrips = async (pageNum = 1, reset = false) => {
    try {
      if (reset) setLoading(true);

      const response = await tripAPI.getHistory(pageNum);
      const newTrips = response.data.trips;

      if (reset) {
        setTrips(newTrips);
      } else {
        setTrips((prev) => [...prev, ...newTrips]);
      }

      setPage(pageNum);
      setHasMore(newTrips.length >= 10);
    } catch (error) {
      console.error('Failed to load trips:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteTrip = (tripId, tripName) => {
    Alert.alert(
      'Delete Trip',
      `Are you sure you want to delete "${tripName}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await tripAPI.delete(tripId);
              setTrips((prev) => prev.filter((t) => t.id !== tripId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete trip.');
            }
          },
        },
      ]
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTrips(1, true);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadTrips(page + 1, false);
    }
  };

  const formatDuration = (startedAt, endedAt) => {
    if (!endedAt) return 'In progress...';

    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    const diff = end - start;

    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderTrip = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('TripDetail', { tripId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardEmoji}>
            {item.status === 'active' ? '🟢' : '🗺️'}
          </Text>
          <View style={styles.cardTitleInfo}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.cardDate}>{formatDate(item.started_at)}</Text>
          </View>
        </View>
        {item.status === 'active' && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>ACTIVE</Text>
          </View>
        )}
      </View>

      <View style={styles.cardStats}>
        <View style={styles.cardStat}>
          <Text style={styles.cardStatValue}>
            {formatKm(item.total_distance_km || 0)}
          </Text>
          <Text style={styles.cardStatLabel}>Distance</Text>
        </View>
        <View style={styles.cardStat}>
          <Text style={styles.cardStatValue}>
            {formatDuration(item.started_at, item.ended_at)}
          </Text>
          <Text style={styles.cardStatLabel}>Duration</Text>
        </View>
        
        <View style={styles.cardStat}>
          <Text style={styles.cardStatValue}>
            {item.unlocks_during_trip?.length || 0}
          </Text>
          <Text style={styles.cardStatLabel}>Unlocks</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteTrip(item.id, item.name)}
      >
        <Text style={styles.deleteText}>🗑️ Delete Trip</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading && trips.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading trips...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={trips}
        renderItem={renderTrip}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🚗</Text>
            <Text style={styles.emptyTitle}>No trips yet</Text>
            <Text style={styles.emptyText}>
              Start a trip from the Map tab to begin tracking your adventures!
            </Text>
          </View>
        }
        ListFooterComponent={
          hasMore && trips.length > 0 ? (
            <ActivityIndicator
              style={styles.footerLoader}
              size="small"
              color="#2E7D32"
            />
          ) : null
        }
      />
    </View>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  list: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  cardTitleInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
  },
  cardDate: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
  },
  cardStat: {
    alignItems: 'center',
    flex: 1,
  },
  cardStatValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  cardStatLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },

  deleteButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  deleteText: {
    fontSize: 14,
    color: '#EF5350',
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 20,
  },
});