import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../services/api';

import { setCachedToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On app launch, check if we have a stored token and load the user
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) {
        setCachedToken(token);
        const response = await authAPI.getMe();
        setUser(response.data.user);
      }
    } catch (error) {
      // Token invalid or expired — clear it
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await authAPI.login(email, password);
    const { user, access_token, refresh_token } = response.data;

    await SecureStore.setItemAsync('accessToken', access_token);
    await SecureStore.setItemAsync('refreshToken', refresh_token);
    setCachedToken(access_token);
    setUser(user);

    return user;
  };

  const register = async (username, email, password) => {
    const response = await authAPI.register(username, email, password);
    const { user, access_token, refresh_token } = response.data;

    await SecureStore.setItemAsync('accessToken', access_token);
    await SecureStore.setItemAsync('refreshToken', refresh_token);
    setCachedToken(access_token);
    setUser(user);

    return user;
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    setCachedToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data.user);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}