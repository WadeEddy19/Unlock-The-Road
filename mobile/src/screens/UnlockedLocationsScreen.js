import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { userAPI } from '../services/api';
import { useUnits } from '../context/UnitsContext';

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

export default function UnlockedLocationsScreen({ navigation }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { formatRadius } = useUnits();

  useEffect(() => {
    loadUnlocks();
  }, []);

  const loadUnlocks = async () => {
    try {
      const response = await userAPI.getUnlocks();
      setLocations(response.data.locations);
    } catch (error) {
      console.error('Failed to load unlocked locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderLocation = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('LocationDetail', { location: { ...item, unlocked: true } })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardEmoji}>
          {TYPE_EMOJI[item.location_type] || '📍'}
        </Text>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardType}>
            {item.location_type?.replace(/_/g, ' ').toUpperCase()}
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
        <Text style={styles.unlockedText}>✅ Unlocked</Text>
        <Text style={styles.photosHint}>Tap to view photos</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading your locations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={locations}
        renderItem={renderLocation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔒</Text>
            <Text style={styles.emptyTitle}>No locations unlocked yet</Text>
            <Text style={styles.emptyText}>
              Visit locations on the map to unlock them!
            </Text>
          </View>
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
    alignItems: 'center',
  },
  unlockedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
  },
  photosHint: {
    fontSize: 12,
    color: '#7B1FA2',
    fontWeight: '500',
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
});