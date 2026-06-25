import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Change this to your computer's local IP when testing on a physical device
// Use "localhost" for iOS simulator, "10.0.2.2" for Android emulator
const API_URL = 'https://unlock-the-road-api.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
});

// Cache token in memory for background task access
let cachedToken = null;

export function setCachedToken(token) {
  cachedToken = token;
}

export function getCachedToken() {
  return cachedToken;
}

// Automatically attach the access token to every request
api.interceptors.request.use(async (config) => {
  let token = null;
  try {
    token = await SecureStore.getItemAsync('accessToken');
    if (token) cachedToken = token;
  } catch (e) {
    // SecureStore unavailable (background mode) — use cached token
    token = cachedToken;
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Automatically refresh the token if a request gets a 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const response = await axios.post(`${API_URL}/auth/refresh`, null, {
          headers: { Authorization: `Bearer ${refreshToken}` },
        });

        const newToken = response.data.access_token;
        await SecureStore.setItemAsync('accessToken', newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — clear tokens, user needs to log in again
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  register: (username, email, password) =>
    api.post('/auth/register', { username, email, password }),

  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  getMe: () =>
    api.get('/auth/me'),
};

// Location endpoints
export const locationAPI = {
  getAll: (page = 1, type = null) =>
    api.get('/locations/', { params: { page, type } }),

  getNearby: (latitude, longitude, radius = 5000) =>
    api.get('/locations/nearby', { params: { latitude, longitude, radius } }),

  unlock: (locationId, latitude, longitude) =>
    api.post('/locations/unlock', {
      location_id: locationId,
      latitude,
      longitude,
    }),

  getTypes: () =>
    api.get('/locations/types'),
};

// User endpoints
export const userAPI = {
  updateProfile: (data) =>
    api.patch('/users/profile', data),

  getPublicProfile: (username) =>
    api.get(`/users/${username}`),

  getUnlocks: () =>
    api.get('/users/unlocks'),

  getAchievements: () =>
    api.get('/users/achievements'),
};

// Trip endpoints
export const tripAPI = {
  start: (name = null) =>
    api.post('/trips/start', { name }),

  getActive: () =>
    api.get('/trips/active'),

  addWaypoint: (tripId, latitude, longitude) =>
    api.post(`/trips/${tripId}/waypoint`, { latitude, longitude }),

  addBatchWaypoints: (tripId, waypoints) =>
    api.post(`/trips/${tripId}/waypoints/batch`, { waypoints }),

  end: (tripId) =>
    api.post(`/trips/${tripId}/end`),

  getHistory: (page = 1) =>
    api.get('/trips/history', { params: { page } }),

  getTrip: (tripId) =>
    api.get(`/trips/${tripId}`),
  
  delete: (tripId) =>
    api.delete(`/trips/${tripId}`),
};

// Photo endpoints
export const photoAPI = {
 upload: (locationId, imageBase64, filename) =>
    api.post('/photos/upload', {
      location_id: locationId,
      image: imageBase64,
      filename,
    }),

  getLocationPhotos: (locationId, page = 1) =>
    api.get(`/photos/location/${locationId}`, { params: { page } }),

  delete: (photoId) =>
    api.delete(`/photos/${photoId}`),
};

export default api;