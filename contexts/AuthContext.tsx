
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, BackHandler } from 'react-native';
import * as apiService from '@/utils/apiService';
import { getDeviceId } from '@/utils/deviceUtils';
import * as Network from 'expo-network';
import { commandListener } from '@/utils/commandListener';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  password: string | null;
  screenName: string | null;
  deviceId: string | null;
  authCode: string | null;
  authCodeExpiry: string | null;
  isInitializing: boolean;
  login: (username: string, password: string, screenName: string) => Promise<{ success: boolean; error?: string }>;
  loginWithCode: () => Promise<{ success: boolean; code?: string; error?: string }>;
  checkAuthenticationStatus: () => Promise<{ success: boolean; authenticated: boolean; credentials?: { username: string; password: string; screenName: string }; error?: string }>;
  logout: () => Promise<void>;
  setScreenActive: (active: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [screenName, setScreenName] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [authCodeExpiry, setAuthCodeExpiry] = useState<string | null>(null);
  const [isScreenActive, setIsScreenActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const authCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const initializeAuth = useCallback(async () => {
    try {
      console.log('=== INITIALIZING AUTH ===');
      setIsInitializing(true);
      
      // Get device ID first
      const id = await getDeviceId();
      setDeviceId(id);
      console.log('Device ID initialized:', id);

      // Initialize command listener with device ID
      commandListener.initialize(id);

      // Load auth state from storage
      await loadAuthState();
      setIsInitializing(false);
      console.log('=== AUTH INITIALIZATION COMPLETE ===');
    } catch (error) {
      console.error('Error initializing auth:', error);
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Set up the 20-second interval when user is authenticated AND screen is active
  useEffect(() => {
    console.log('Auth/Screen state changed:', { 
      isAuthenticated, 
      isScreenActive,
      deviceId: !!deviceId, 
      screenName: !!screenName, 
      username: !!username 
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
    if (isAuthenticated && isScreenActive && deviceId && screenName && username && password) {
      console.log('✓ Setting up 20-second status update interval (user logged in and on screen)');
      
      // Define the status update function inside useEffect to avoid stale closures
      const sendStatusUpdate = async () => {
        try {
          console.log('===========================================');
          console.log('Executing scheduled status update at:', new Date().toISOString());
          console.log('Current auth state:', {
            deviceId,
            screenName,
            username,
            hasPassword: !!password,
          });
          
          // Get current network state
          const networkState = await Network.getNetworkStateAsync();
          const status = networkState.isConnected ? 'online' : 'offline';
          
          console.log('Network status:', status);
          
          // Construct payload with all required fields
          const payload: apiService.DeviceStatusPayload = {
            deviceId: deviceId,
            screenName: screenName,
            screen_username: username,
            screen_password: password,
            screen_name: screenName,
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
      
      // Set up interval to send status every 20 seconds (20000 milliseconds)
      statusIntervalRef.current = setInterval(() => {
        console.log('Interval triggered - sending status update');
        sendStatusUpdate();
      }, 20000);
      
      console.log('Interval set up successfully - updates every 20 seconds');
      
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
        hasUsername: !!username,
        hasPassword: !!password,
      });
    }
  }, [isAuthenticated, isScreenActive, deviceId, screenName, username, password]);

  const loadAuthState = async () => {
    try {
      console.log('Loading auth state from AsyncStorage...');
      
      const storedUsername = await AsyncStorage.getItem('username');
      const storedPassword = await AsyncStorage.getItem('password');
      const storedScreenName = await AsyncStorage.getItem('screenName');
      
      console.log('Stored credentials check:', {
        hasUsername: !!storedUsername,
        hasPassword: !!storedPassword,
        hasScreenName: !!storedScreenName,
      });
      
      if (storedUsername && storedPassword && storedScreenName) {
        setUsername(storedUsername);
        setPassword(storedPassword);
        setScreenName(storedScreenName);
        setIsAuthenticated(true);
        console.log('✓ Loaded auth state:', { storedUsername, storedScreenName });
      } else {
        console.log('✗ No stored credentials found - user needs to login');
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
        await AsyncStorage.setItem('password', inputPassword);
        await AsyncStorage.setItem('screenName', inputScreenName);
        
        setUsername(inputUsername);
        setPassword(inputPassword);
        setScreenName(inputScreenName);
        setIsAuthenticated(true);
        
        // Clear auth code since we're now authenticated
        setAuthCode(null);
        setAuthCodeExpiry(null);
        
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

  const loginWithCode = async (): Promise<{ success: boolean; code?: string; error?: string }> => {
    try {
      console.log('=== INITIATING CODE-BASED LOGIN ===');
      console.log('Device ID:', deviceId);
      
      if (!deviceId) {
        console.error('Device ID not available');
        return { success: false, error: 'Device ID not available. Please try again.' };
      }

      console.log('Calling generateDisplayCode with deviceId:', deviceId);

      // Generate display code using new endpoint
      const response = await apiService.generateDisplayCode(deviceId);
      
      console.log('generateDisplayCode response:', response);
      
      if (response.success && response.data) {
        setAuthCode(response.data.code);
        setAuthCodeExpiry(response.data.expires_at);
        console.log('✓ Display code generated successfully:', response.data.code);
        console.log('Expires at:', response.data.expires_at);
        return { success: true, code: response.data.code };
      } else {
        console.log('✗ Failed to generate display code:', response.error);
        return { success: false, error: response.error || 'Failed to generate code' };
      }
    } catch (error) {
      console.error('✗ Exception during code-based login:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      };
    }
  };

  const checkAuthenticationStatus = async (): Promise<{ 
    success: boolean; 
    authenticated: boolean; 
    credentials?: { username: string; password: string; screenName: string }; 
    error?: string 
  }> => {
    try {
      if (!deviceId) {
        return { success: false, authenticated: false, error: 'No device ID available' };
      }

      console.log('Polling for credentials...');
      const response = await apiService.getDisplayCredentials(deviceId);
      
      if (response.success && response.data) {
        if (response.data.status === 'authenticated' && response.data.credentials) {
          const creds = response.data.credentials;
          
          // Store credentials
          await AsyncStorage.setItem('username', creds.screen_username);
          await AsyncStorage.setItem('password', creds.screen_password);
          await AsyncStorage.setItem('screenName', creds.screen_name);
          
          setUsername(creds.screen_username);
          setPassword(creds.screen_password);
          setScreenName(creds.screen_name);
          setIsAuthenticated(true);
          
          // Clear auth code
          setAuthCode(null);
          setAuthCodeExpiry(null);
          
          console.log('✓ Authentication successful via display code');
          return { 
            success: true, 
            authenticated: true,
            credentials: {
              username: creds.screen_username,
              password: creds.screen_password,
              screenName: creds.screen_name,
            }
          };
        } else if (response.data.status === 'expired') {
          setAuthCode(null);
          setAuthCodeExpiry(null);
          console.log('Code expired');
          return { success: true, authenticated: false, error: 'Code expired' };
        } else {
          // Still pending
          return { success: true, authenticated: false };
        }
      } else {
        return { success: false, authenticated: false, error: response.error };
      }
    } catch (error) {
      console.error('Error checking authentication status:', error);
      return { 
        success: false, 
        authenticated: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      };
    }
  };

  const logout = async () => {
    try {
      console.log('=== LOGOUT INITIATED ===');
      console.log('Step 1: Clearing intervals and listeners');
      
      // Step 1: Clear the intervals before logging out
      if (statusIntervalRef.current) {
        console.log('Clearing status interval during logout');
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }

      if (authCheckIntervalRef.current) {
        console.log('Clearing auth check interval during logout');
        clearInterval(authCheckIntervalRef.current);
        authCheckIntervalRef.current = null;
      }

      // Stop listening for commands
      await commandListener.stopListening();

      // Step 2: Send offline status before logging out
      if (deviceId && screenName && username && password) {
        console.log('Step 2: Sending offline status before logout');
        try {
          await apiService.sendDeviceStatus({
            deviceId,
            screenName,
            screen_username: username,
            screen_password: password,
            screen_name: screenName,
            status: 'offline',
            timestamp: new Date().toISOString(),
          });
          console.log('✓ Offline status sent successfully');
        } catch (error) {
          console.error('✗ Failed to send offline status:', error);
          // Continue with logout even if this fails
        }
      }

      // Step 3: CRITICAL - Clear backend authentication state
      if (deviceId) {
        console.log('Step 3: Clearing backend authentication state');
        try {
          const clearResult = await apiService.clearDeviceAuthentication(deviceId);
          if (clearResult.success) {
            console.log('✓ Backend authentication cleared successfully');
          } else {
            console.error('✗ Failed to clear backend authentication:', clearResult.error);
            // Continue with logout even if this fails
          }
        } catch (error) {
          console.error('✗ Exception while clearing backend authentication:', error);
          // Continue with logout even if this fails
        }
      }

      // Step 4: Clear ALL stored credentials from AsyncStorage
      console.log('Step 4: Clearing ALL stored credentials from AsyncStorage');
      try {
        await AsyncStorage.multiRemove(['username', 'password', 'screenName']);
        console.log('✓ AsyncStorage credentials cleared');
      } catch (error) {
        console.error('✗ Failed to clear AsyncStorage:', error);
        // Try individual removal as fallback
        try {
          await AsyncStorage.removeItem('username');
          await AsyncStorage.removeItem('password');
          await AsyncStorage.removeItem('screenName');
          console.log('✓ AsyncStorage credentials cleared (fallback method)');
        } catch (fallbackError) {
          console.error('✗ Fallback AsyncStorage clear also failed:', fallbackError);
        }
      }
      
      // Step 5: Clear state immediately
      console.log('Step 5: Clearing authentication state');
      setUsername(null);
      setPassword(null);
      setScreenName(null);
      setAuthCode(null);
      setAuthCodeExpiry(null);
      setIsAuthenticated(false);
      setIsScreenActive(false);
      
      console.log('✓ Logout successful - all credentials cleared');
      
      // Step 6: Wait for all async operations to complete
      console.log('Step 6: Waiting for async operations to complete');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('=== CLOSING APP COMPLETELY ===');
      
      // Step 7: Platform-specific app closing
      if (Platform.OS === 'android') {
        console.log('Android: Closing app with BackHandler.exitApp()');
        BackHandler.exitApp();
      } else if (Platform.OS === 'ios') {
        console.log('iOS: Apps cannot be programmatically closed per Apple guidelines');
        console.log('User must manually close and reopen the app');
        // On iOS, we can't close the app programmatically
        // The user will need to manually close and reopen
        // The credentials are already cleared, so on next open they'll see login screen
      } else {
        console.log('Web/Other platform: Reloading page');
        // For web or other platforms, just reload
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
      
      console.log('=== LOGOUT COMPLETE ===');
    } catch (error) {
      console.error('✗ CRITICAL ERROR during logout:', error);
      
      // Emergency cleanup - try to clear everything even if there was an error
      console.log('Attempting emergency cleanup...');
      try {
        await AsyncStorage.multiRemove(['username', 'password', 'screenName']);
      } catch (cleanupError) {
        console.error('Emergency cleanup failed:', cleanupError);
      }
      
      setUsername(null);
      setPassword(null);
      setScreenName(null);
      setAuthCode(null);
      setAuthCodeExpiry(null);
      setIsAuthenticated(false);
      setIsScreenActive(false);
      
      // Try to exit/reload even if there was an error
      try {
        console.log('Attempting app exit/reload after error...');
        await new Promise(resolve => setTimeout(resolve, 500));
        if (Platform.OS === 'android') {
          BackHandler.exitApp();
        } else if (typeof window !== 'undefined') {
          window.location.reload();
        }
      } catch (exitError) {
        console.error('Failed to exit/reload app:', exitError);
      }
    }
  };

  const setScreenActive = (active: boolean) => {
    console.log('Screen active state changed:', active);
    setIsScreenActive(active);
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      username, 
      password, 
      screenName, 
      deviceId,
      authCode,
      authCodeExpiry,
      isInitializing,
      login, 
      loginWithCode,
      checkAuthenticationStatus,
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
