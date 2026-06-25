import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Linking,
} from 'react-native';
import { locationAPI } from '../services/api';
import * as Location from 'expo-location';

import { useUnits } from '../context/UnitsContext';

const TYPE_FILTERS = [
  { key: null, label: '🌍 All' },
  { key: 'national_park', label: '🏞️ Parks' },
  { key: 'national_monument', label: '🗿 Monuments' },
  { key: 'national_forest', label: '🌲 Forests' },
  { key: 'historic_site', label: '🏛️ Historic' },
  { key: 'scenic_viewpoint', label: '👀 Scenic' },
  { key: 'point_of_interest', label: '📍 POI' },
];

const TYPE_EMOJI = {
  national_park: '🏞️',
  national_monument: '🗿',
  national_forest: '🌲',
  state_park: '🌳',
  historic_site: '🏛️',
  scenic_viewpoint: '👀',
  point_of_interest: '📍',
  city_park: '🌿',
};

export default function LocationsScreen({ navigation }) {
  const { formatDistance, formatRadius } = useUnits();
  const [locations, setLocations] = useState([]);
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    getUserLocation();
  }, []);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation(loc.coords);
      }
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };

  useEffect(() => {
    loadLocations(1, true);
  }, [activeFilter, userLocation]);

  useEffect(() => {
    filterBySearch(searchQuery);
  }, [searchQuery, locations]);

  const loadLocations = async (pageNum = 1, reset = false) => {
    try {
      if (reset) setLoading(true);

      let newLocations;

      if (userLocation) {
        const response = await locationAPI.getNearby(
          userLocation.latitude,
          userLocation.longitude,
          100000
        );
        newLocations = response.data.locations;

        // Filter by type client-side
        if (activeFilter) {
          newLocations = newLocations.filter(
            (loc) => loc.location_type === activeFilter
          );
        }

        setHasMore(false);
      } else {
        const response = await locationAPI.getAll(pageNum, activeFilter);
        newLocations = response.data.locations;
        setHasMore(newLocations.length >= 20);
      }

      if (reset) {
        setLocations(newLocations);
      } else {
        setLocations((prev) => [...prev, ...newLocations]);
      }

      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load locations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterBySearch = (query) => {
    if (!query.trim()) {
      setFilteredLocations(locations);
      return;
    }

    const lower = query.toLowerCase();
    setFilteredLocations(
      locations.filter(
        (loc) =>
          loc.name.toLowerCase().includes(lower) ||
          loc.description?.toLowerCase().includes(lower)
      )
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadLocations(1, true);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadLocations(page + 1, false);
    }
  };

  const handleFilterPress = (filterKey) => {
    setActiveFilter(filterKey);
    setSearchQuery('');
    setPage(1);
  };

  const renderFilterChip = ({ key, label }) => (
    <TouchableOpacity
      key={key || 'all'}
      style={[styles.chip, activeFilter === key && styles.chipActive]}
      onPress={() => handleFilterPress(key)}
    >
      <Text style={[styles.chipText, activeFilter === key && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderLocation = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardEmoji}>
          {TYPE_EMOJI[item.location_type] || '📍'}
        </Text>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardType}>
            {item.location_type.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
        <View style={styles.xpBadge}>
          <Text style={styles.xpText}>{item.xp_reward} XP</Text>
        </View>
      </View>
      {item.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      <View style={styles.cardFooter}>
        {item.distance_m !== undefined ? (
          <Text style={styles.distanceText}>
            📍 {formatDistance(item.distance_m)} away
          </Text>
        ) : (
          <Text style={styles.cardFooterText}>
            📍 Calculating distance...
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.photosButton}
        onPress={() => navigation.navigate('LocationDetail', { location: item })}
      >
        <Text style={styles.photosText}>📸 View Photos</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.directionsButton}
        onPress={() => {
          const name = encodeURIComponent(item.name);
          const url = `maps://app?daddr=${item.latitude},${item.longitude}&q=${name}`;
          Linking.openURL(url);
        }}
      >
        <Text style={styles.directionsText}>🧭 Get Directions</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && locations.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading locations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search locations..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TYPE_FILTERS}
          renderItem={({ item }) => renderFilterChip(item)}
          keyExtractor={(item) => item.key || 'all'}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {/* Results count */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsText}>
          {filteredLocations.length} location{filteredLocations.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Location list */}
      <FlatList
        data={filteredLocations}
        renderItem={renderLocation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>No locations found</Text>
          </View>
        }
        ListFooterComponent={
          hasMore && !loading ? (
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
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  searchInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  filterRow: {
    backgroundColor: '#fff',
    paddingBottom: 12,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#2E7D32',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  chipTextActive: {
    color: '#fff',
  },
  resultsBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultsText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: 16,
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
    alignItems: 'center',
    marginBottom: 8,
  },
  cardEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  cardType: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E7D32',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  xpBadge: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  xpText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#F9A825',
  },
  cardDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardFooterText: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 48,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  directionsButton: {
    backgroundColor: '#1565C0',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  photosButton: {
    backgroundColor: '#7B1FA2',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  photosText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  directionsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  distanceText: {
    fontSize: 13,
    color: '#1565C0',
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 20,
  },
});