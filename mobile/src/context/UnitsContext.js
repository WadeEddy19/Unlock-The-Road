import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const UnitsContext = createContext(null);

export function UnitsProvider({ children }) {
  const [units, setUnits] = useState('imperial'); // 'imperial' or 'metric'

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      const saved = await SecureStore.getItemAsync('units');
      if (saved) setUnits(saved);
    } catch (error) {
      console.error('Failed to load units:', error);
    }
  };

  const toggleUnits = async () => {
    const next = units === 'imperial' ? 'metric' : 'imperial';
    setUnits(next);
    await SecureStore.setItemAsync('units', next);
  };

  const formatDistance = (meters) => {
    if (units === 'imperial') {
      if (meters >= 1609) {
        return `${(meters / 1609.34).toFixed(1)} mi`;
      }
      return `${(meters * 3.28084).toFixed(0)} ft`;
    }
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)}m`;
  };

  const formatRadius = (meters) => {
    if (units === 'imperial') {
      return `${(meters * 3.28084).toFixed(0)} ft`;
    }
    return `${meters}m`;
  };

  const formatKm = (km) => {
    if (units === 'imperial') {
      return `${(km * 0.621371).toFixed(2)} mi`;
    }
    return `${km.toFixed(2)} km`;
  };

  return (
    <UnitsContext.Provider
      value={{
        units,
        toggleUnits,
        formatDistance,
        formatRadius,
        formatKm,
      }}
    >
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits() {
  const context = useContext(UnitsContext);
  if (!context) {
    throw new Error('useUnits must be used within a UnitsProvider');
  }
  return context;
}