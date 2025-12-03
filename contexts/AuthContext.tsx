
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as apiService from '@/utils/apiService';
import { getDeviceId } from '@/utils/deviceUtils';
import * as Network from 'expo-network';
import { commandListener } from '@/utils/commandListener';

interface AuthContextType {
  isAuthenticated: boolean;
  screenName: string | null;
  deviceId: string | null;
  login: (screenName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setScreenActive: (active: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [screenName, setScreenName] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isScreenActive, setIsScreenActive] = useState(false);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const initializeAuth = useCallback(async () => {
    try {
      // Get device ID first
      const id = await getDeviceId();
      setDeviceId(id);
      console.log('Device ID initialized:', id);

      // Initialize command listener with device ID
      commandListener.initialize(id);

      // Then load auth state
      await loadAuthState();
    } catch (error) {
      console.error('Error initializing auth:', error);
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Set up the 1-minute interval when user is authenticated AND screen is active
  useEffect(() => {
    console.log('Auth/Screen state changed:', { 
      isAuthenticated, 
      isScreenActive,
      deviceId: !!deviceId, 
      screenName: !!screenName
    });
    
    // Clear any existing interval first
    if (statusIntervalRef.current) {
      console.log('Clearing existing interval');
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }

    // Only set up interval if:
    // 1. User is authenticated
    // 2. Screen is active (user is on the home screen)
    // 3. All required data is available
    if (isAuthenticated && isScreenActive && deviceId && screenName) {
      console.log('✓ Setting up 1-minute status update interval (user logged in and on screen)');
      
      // Define the status update function inside useEffect to avoid stale closures
      const sendStatusUpdate = async () => {
        try {
          console.log('===========================================');
          console.log('Executing scheduled status update at:', new Date().toISOString());
          console.log('Current auth state:', {
            deviceId,
            screenName,
          });
          
          // Get current network state
          const networkState = await Network.getNetworkStateAsync();
          const status = networkState.isConnected ? 'online' : 'offline';
          
          console.log('Network status:', status);
          
          // Construct payload with all required fields
          const payload: apiService.DeviceStatusPayload = {
            deviceId: deviceId,
            screenName: screenName,
            status: status,
            timestamp: new Date().toISOString(),
          };

          console.log('Sending status update...');
          
          const success = await apiService.sendDeviceStatus(payload);
          
          if (success) {
            console.log('✓ Status update sent successfully');
          } else {
            console.log('✗ Status update failed');
          }
          console.log('===========================================');
        } catch (error) {
          console.error('Error sending scheduled status update:', error);
        }
      };

      // Send initial status immediately
      console.log('Sending initial status update');
      sendStatusUpdate();
      
      // Set up interval to send status every 1 minute (60000 milliseconds)
      statusIntervalRef.current = setInterval(() => {
        console.log('Interval triggered - sending status update');
        sendStatusUpdate();
      }, 60000);
      
      console.log('Interval set up successfully');
      
      // Cleanup function to clear interval when dependencies change or component unmounts
      return () => {
        if (statusIntervalRef.current) {
          console.log('Cleaning up interval on unmount/dependency change');
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
      };
    } else {
      console.log('✗ Not setting up interval - conditions not met');
      console.log('Conditions:', {
        isAuthenticated,
        isScreenActive,
        hasDeviceId: !!deviceId,
        hasScreenName: !!screenName,
      });
    }
  }, [isAuthenticated, isScreenActive, deviceId, screenName]);

  const loadAuthState = async () => {
    try {
      const storedScreenName = await AsyncStorage.getItem('screenName');
      
      if (storedScreenName) {
        setScreenName(storedScreenName);
        setIsAuthenticated(true);
        console.log('Loaded auth state:', { storedScreenName });
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
    }
  };

  const login = async (
    inputScreenName: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('Login attempt:', { inputScreenName, deviceId });
      
      if (!deviceId) {
        console.error('Device ID not available');
        return { success: false, error: 'Device ID not available. Please try again.' };
      }

      // Store screen name
      await AsyncStorage.setItem('screenName', inputScreenName);
      
      setScreenName(inputScreenName);
      setIsAuthenticated(true);
      
      console.log('Login successful, credentials stored');
      return { success: true };
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
      console.log('Logout initiated');
      
      // Clear the interval before logging out
      if (statusIntervalRef.current) {
        console.log('Clearing interval during logout');
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }

      // Stop listening for commands
      await commandListener.stopListening();

      // Send offline status before logging out
      if (deviceId && screenName) {
        console.log('Sending offline status before logout');
        await apiService.sendDeviceStatus({
          deviceId,
          screenName,
          status: 'offline',
          timestamp: new Date().toISOString(),
        });
      }

      await AsyncStorage.removeItem('screenName');
      
      setScreenName(null);
      setIsAuthenticated(false);
      setIsScreenActive(false);
      
      console.log('Logout successful');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const setScreenActive = (active: boolean) => {
    console.log('Screen active state changed:', active);
    setIsScreenActive(active);
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      screenName, 
      deviceId, 
      login, 
      logout,
      setScreenActive 
    }}>
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
