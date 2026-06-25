import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { photoAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = (SCREEN_WIDTH - 48 - 8) / 3; // 3 columns with gaps

const AVATAR_DISPLAY = {
  explorer: '🧭',
  hiker: '🥾',
  camper: '⛺',
};

export default function LocationDetailScreen({ route }) {
  const { location: loc } = route.params;
  const { user } = useAuth();

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showMineOnly, setShowMineOnly] = useState(false);

  useEffect(() => {
    loadPhotos();
  }, []);

  const displayedPhotos = showMineOnly
    ? photos.filter((p) => p.user_id === user?.id)
    : photos;

  const loadPhotos = async (pageNum = 1) => {
    try {
      const response = await photoAPI.getLocationPhotos(loc.id, pageNum);
      if (pageNum === 1) {
        setPhotos(response.data.photos);
      } else {
        setPhotos((prev) => [...prev, ...response.data.photos]);
      }
      setTotal(response.data.total);
      setPage(pageNum);
    } catch (error) {
      if (error.response?.status === 403) {
        Alert.alert('Locked', 'You must unlock this location to view photos.');
      } else {
        console.error('Failed to load photos:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to upload photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0]);
    }
  };

  const uploadPhoto = async (asset) => {
    setUploading(true);
    try {
      const filename = asset.fileName || `photo_${Date.now()}.jpg`;

      await photoAPI.upload(
        loc.id,
        asset.base64,
        filename
      );

      Alert.alert('Success', 'Photo uploaded!');
      loadPhotos(1); // Refresh photos
    } catch (error) {
      const message = error.response?.data?.errors?.[0] || 'Failed to upload photo.';
      Alert.alert('Upload Failed', message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddPhoto = () => {
    Alert.alert('Add Photo', 'Choose a source:', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Photo Library', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleDeletePhoto = (photoId) => {
    Alert.alert('Delete Photo', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await photoAPI.delete(photoId);
            setPhotos((prev) => prev.filter((p) => p.id !== photoId));
            setTotal((prev) => prev - 1);
            setSelectedPhoto(null);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete photo.');
          }
        },
      },
    ]);
  };

  const renderPhoto = ({ item }) => (
    <TouchableOpacity
      style={styles.photoTile}
      onPress={() => setSelectedPhoto(item)}
    >
      <Image source={{ uri: item.url }} style={styles.photoImage} />
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.locationName}>{loc.name}</Text>
      <Text style={styles.locationType}>
        {loc.location_type?.replace(/_/g, ' ').toUpperCase()}
      </Text>
      {loc.description ? (
        <Text style={styles.description}>{loc.description}</Text>
      ) : null}

      <View style={styles.photoHeader}>
        <Text style={styles.photoCount}>📸 {total} Photo{total !== 1 ? 's' : ''}</Text>
        {loc.unlocked && (
          <TouchableOpacity
            style={[styles.addButton, uploading && styles.addButtonDisabled]}
            onPress={handleAddPhoto}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.addButtonText}>+ Add Photo</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterToggle}>
        <TouchableOpacity
          style={[styles.filterOption, !showMineOnly && styles.filterOptionActive]}
          onPress={() => setShowMineOnly(false)}
        >
          <Text style={[styles.filterText, !showMineOnly && styles.filterTextActive]}>
            All Photos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterOption, showMineOnly && styles.filterOptionActive]}
          onPress={() => setShowMineOnly(true)}
        >
          <Text style={[styles.filterText, showMineOnly && styles.filterTextActive]}>
            My Photos
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={displayedPhotos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        onEndReached={() => {
          if (photos.length < total) {
            loadPhotos(page + 1);
          }
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📷</Text>
            <Text style={styles.emptyText}>
              {showMineOnly ? 'No photos from you yet' : 'No photos yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {showMineOnly
                ? 'Upload a photo to see it here!'
                : 'Be the first to add a photo of this location!'}
            </Text>
          </View>
        }
      />

      {/* Full photo viewer */}
      {selectedPhoto && (
        <View style={styles.viewer}>
          <Image
            source={{ uri: selectedPhoto.url }}
            style={styles.viewerImage}
            resizeMode="contain"
          />
          <View style={styles.viewerInfo}>
            <Text style={styles.viewerUsername}>
              {AVATAR_DISPLAY[selectedPhoto.avatar] || '🧭'} {selectedPhoto.username}
            </Text>
            <Text style={styles.viewerDate}>
              {new Date(selectedPhoto.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.viewerButtons}>
            {selectedPhoto.user_id === user?.id && (
              <TouchableOpacity
                style={styles.viewerDelete}
                onPress={() => handleDeletePhoto(selectedPhoto.id)}
              >
                <Text style={styles.viewerDeleteText}>🗑️ Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.viewerClose}
              onPress={() => setSelectedPhoto(null)}
            >
              <Text style={styles.viewerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  },
  list: {
    paddingBottom: 24,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  locationName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  locationType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    letterSpacing: 1,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  photoCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonDisabled: {
    opacity: 0.7,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  filterToggle: {
    flexDirection: 'row',
    marginTop: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 4,
  },
  filterOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterOptionActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  filterTextActive: {
    color: '#2E7D32',
  },
  row: {
    paddingHorizontal: 16,
    gap: 4,
  },
  photoTile: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  viewer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
  },
  viewerInfo: {
    alignItems: 'center',
    marginTop: 16,
  },
  viewerUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  viewerDate: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 4,
  },
  viewerButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  viewerDelete: {
    backgroundColor: '#EF5350',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  viewerDeleteText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  viewerClose: {
    backgroundColor: '#333',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  viewerCloseText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});