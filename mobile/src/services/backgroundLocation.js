import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { tripAPI } from './api';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

let activeTripId = null;

export function setActiveTripId(tripId) {
  activeTripId = tripId;
}

export function getActiveTripId() {
  return activeTripId;
}

// Define the background task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }

  if (!activeTripId) return;

  const { locations } = data;
  if (!locations || locations.length === 0) return;

  try {
    const waypoints = locations.map((loc) => ({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      timestamp: new Date(loc.timestamp).toISOString(),
    }));

    if (waypoints.length === 1) {
      await tripAPI.addWaypoint(
        activeTripId,
        waypoints[0].latitude,
        waypoints[0].longitude
      );
    } else {
      await tripAPI.addBatchWaypoints(activeTripId, waypoints);
    }
  } catch (err) {
    console.error('Failed to send background waypoints:', err);
  }
});

export async function startBackgroundTracking(tripId) {
  activeTripId = tripId;

  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') {
    throw new Error('Foreground location permission not granted');
  }

  const { status: background } = await Location.requestBackgroundPermissionsAsync();
  if (background !== 'granted') {
    throw new Error('Background location permission not granted');
  }

  const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (isStarted) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 50, // Update every 50 meters
    timeInterval: 30000, // Or every 30 seconds
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Unlock the Road',
      notificationBody: 'Trip recording in progress...',
      notificationColor: '#2E7D32',
    },
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
  });
}

export async function stopBackgroundTracking() {
  activeTripId = null;

  const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (isStarted) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}