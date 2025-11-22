
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as apiService from '@/utils/apiService';
import { getDeviceId } from '@/utils/deviceUtils';
import * as Network from 'expo-network';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  screenName: string | null;
  deviceId: string | null;
  login: (username: string, password: string, screenName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [screenName, setScreenName] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  // Set up the 10-second interval when user is authenticated
  useEffect(() => {
    if (isAuthenticated && deviceId && screenName && username) {
      console.log('Starting 10-second status update interval');
      
      // Send initial status immediately
      sendStatusUpdate();
      
      // Set up interval to send status every 10 seconds
      statusIntervalRef.current = setInterval(() => {
        sendStatusUpdate();
      }, 10000); // 10 seconds
      
      // Cleanup function to clear interval
      return () => {
        if (statusIntervalRef.current) {
          console.log('Clearing status update interval');
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
      };
    }
  }, [isAuthenticated, deviceId, screenName, username]);

  const sendStatusUpdate = async () => {
    if (!deviceId || !screenName || !username) {
      console.log('Missing required data for status update');
      return;
    }

    try {
      // Get current network state
      const networkState = await Network.getNetworkStateAsync();
      const status = networkState.isConnected ? 'online' : 'offline';
      
      const payload = {
        deviceId,
        screenName,
        screen_username: username,
        status,
        timestamp: new Date().toISOString(),
      };

      console.log('Sending scheduled status update:', payload);
      await apiService.sendDeviceStatus(payload);
    } catch (error) {
      console.error('Error sending scheduled status update:', error);
    }
  };

  const initializeAuth = async () => {
    try {
      // Get device ID first
      const id = await getDeviceId();
      setDeviceId(id);
      console.log('Device ID initialized:', id);

      // Then load auth state
      await loadAuthState();
    } catch (error) {
      console.error('Error initializing auth:', error);
    }
  };

  const loadAuthState = async () => {
    try {
      const storedUsername = await AsyncStorage.getItem('username');
      const storedScreenName = await AsyncStorage.getItem('screenName');
      
      if (storedUsername && storedScreenName) {
        setUsername(storedUsername);
        setScreenName(storedScreenName);
        setIsAuthenticated(true);
        console.log('Loaded auth state:', { storedUsername, storedScreenName });
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
    }
  };

  const login = async (
    inputUsername: string,
    inputPassword: string,
    inputScreenName: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('Login attempt:', { inputUsername, inputScreenName, deviceId });
      
      if (!deviceId) {
        console.error('Device ID not available');
        return { success: false, error: 'Device ID not available. Please try again.' };
      }

      // Call the API service to authenticate with device ID
      const response = await apiService.login(inputUsername, inputPassword, inputScreenName, deviceId);
      
      if (response.success) {
        // Store credentials on successful login
        await AsyncStorage.setItem('username', inputUsername);
        await AsyncStorage.setItem('screenName', inputScreenName);
        
        setUsername(inputUsername);
        setScreenName(inputScreenName);
        setIsAuthenticated(true);
        
        console.log('Login successful, credentials stored');
        return { success: true };
      } else {
        console.log('Login failed:', response.error);
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.error('Error during login:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      };
    }
  };

  const logout = async () => {
    try {
      // Clear the interval before logging out
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }

      // Send offline status before logging out
      if (deviceId && screenName && username) {
        await apiService.sendDeviceStatus({
          deviceId,
          screenName,
          screen_username: username,
          status: 'offline',
          timestamp: new Date().toISOString(),
        });
      }

      await AsyncStorage.removeItem('username');
      await AsyncStorage.removeItem('screenName');
      
      setUsername(null);
      setScreenName(null);
      setIsAuthenticated(false);
      
      console.log('Logout successful');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, screenName, deviceId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
