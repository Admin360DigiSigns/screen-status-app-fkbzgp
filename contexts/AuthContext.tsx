
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as apiService from '@/utils/apiService';
import { getDeviceId } from '@/utils/deviceUtils';

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

  useEffect(() => {
    initializeAuth();
  }, []);

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
