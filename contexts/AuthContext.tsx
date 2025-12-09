
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as apiService from '@/utils/apiService';
import { getDeviceId } from '@/utils/deviceUtils';
import * as Network from 'expo-network';
import { commandListener } from '@/utils/commandListener';
import { router } from 'expo-router';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  password: string | null;
  screenName: string | null;
  deviceId: string | null;
  authCode: string | null;
  authCodeExpiry: string | null;
  isInitializing: boolean;
  isLoggingOut: boolean;
  logoutProgress: number;
  logoutCounter: number;
  login: (username: string, password: string, screenName: string) => Promise<{ success: boolean; error?: string }>;
  loginWithCode: () => Promise<{ success: boolean; code?: string; error?: string }>;
  checkAuthenticationStatus: () => Promise<{ success: boolean; authenticated: boolean; credentials?: { username: string; password: string; screenName: string }; error?: string }>;
  logout: () => Promise<void>;
  setScreenActive: (active: boolean) => void;
  forceGenerateNewCode: () => Promise<void>;
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutProgress, setLogoutProgress] = useState(0);
  const [logoutCounter, setLogoutCounter] = useState(0);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const authCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggingOutRef = useRef(false);

  const initializeAuth = useCallback(async () => {
    try {
      console.log('=== INITIALIZING AUTH ===');
      setIsInitializing(true);
      
      // CRITICAL STEP 1: Check logout flag IMMEDIATELY before anything else
      const logoutFlag = await AsyncStorage.getItem('just_logged_out');
      console.log('🔍 Checking logout flag:', logoutFlag);
      
      if (logoutFlag === 'true') {
        console.log('🚨 LOGOUT FLAG DETECTED - User just logged out');
        console.log('⛔ BLOCKING all credential loading');
        
        // Remove the logout flag
        await AsyncStorage.removeItem('just_logged_out');
        console.log('✓ Logout flag removed');
        
        // FORCE clear ALL auth-related items (double-check)
        const keysToRemove = [
          'username',
          'password',
          'screenName',
          'authCode',
          'authCodeExpiry',
        ];
        
        console.log('🧹 Force clearing all auth keys:', keysToRemove);
        await AsyncStorage.multiRemove(keysToRemove);
        
        // Verify cleanup
        const verifyKeys = await AsyncStorage.multiGet(keysToRemove);
        console.log('🔍 Verification after cleanup:', verifyKeys);
        
        // Get device ID (this is the only thing we need)
        const id = await getDeviceId();
        setDeviceId(id);
        console.log('✓ Device ID set:', id);
        
        // Initialize command listener with device ID
        commandListener.initialize(id);
        
        // FORCE logged out state
        setIsAuthenticated(false);
        setUsername(null);
        setPassword(null);
        setScreenName(null);
        setAuthCode(null);
        setAuthCodeExpiry(null);
        setIsScreenActive(false);
        
        console.log('✅ LOGOUT STATE CONFIRMED - All credentials cleared');
        console.log('📱 User will see login screen with fresh code generation');
        setIsInitializing(false);
        console.log('=== AUTH INITIALIZATION COMPLETE (LOGGED OUT) ===');
        return;
      }

      // STEP 2: Get device ID
      const id = await getDeviceId();
      setDeviceId(id);
      console.log('✓ Device ID initialized:', id);

      // Initialize command listener with device ID
      commandListener.initialize(id);

      // STEP 3: Only load auth state if user didn't just log out
      console.log('📂 No logout flag - checking for stored credentials');
      await loadAuthState();
      setIsInitializing(false);
      console.log('=== AUTH INITIALIZATION COMPLETE ===');
    } catch (error) {
      console.error('❌ Error initializing auth:', error);
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
    // 4. NOT logging out
    if (isAuthenticated && isScreenActive && deviceId && screenName && username && password && !isLoggingOutRef.current) {
      console.log('✓ Setting up 20-second status update interval (user logged in and on screen)');
      
      // Define the status update function inside useEffect to avoid stale closures
      const sendStatusUpdate = async () => {
        // Skip if logging out
        if (isLoggingOutRef.current) {
          console.log('⏸️ Skipping status update - logout in progress');
          return;
        }

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
        isLoggingOut: isLoggingOutRef.current,
      });
    }
  }, [isAuthenticated, isScreenActive, deviceId, screenName, username, password]);

  const loadAuthState = async () => {
    try {
      console.log('📂 Loading auth state from AsyncStorage...');
      
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
      console.error('❌ Error loading auth state:', error);
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
        // Clear logout flag
        await AsyncStorage.removeItem('just_logged_out');
        
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

      // CRITICAL: Don't check auth if we're in the middle of logging out
      if (isLoggingOutRef.current) {
        console.log('⏸️ Logout in progress, skipping auth check');
        return { success: true, authenticated: false };
      }

      console.log('Polling for credentials...');
      const response = await apiService.getDisplayCredentials(deviceId);
      
      if (response.success && response.data) {
        if (response.data.status === 'authenticated' && response.data.credentials) {
          const creds = response.data.credentials;
          
          // CRITICAL: Double-check we're not logging out
          if (isLoggingOutRef.current) {
            console.log('⏸️ Logout detected during auth check, ignoring credentials');
            return { success: true, authenticated: false };
          }
          
          // Clear logout flag
          await AsyncStorage.removeItem('just_logged_out');
          
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

  const forceGenerateNewCode = async () => {
    console.log('');
    console.log('🔄 FORCE GENERATING NEW CODE');
    console.log('This is called after logout to get a fresh authentication code');
    
    if (!deviceId) {
      console.error('❌ Cannot generate code - no device ID');
      return;
    }

    try {
      const result = await loginWithCode();
      if (result.success) {
        console.log('✅ New code generated successfully:', result.code);
      } else {
        console.error('❌ Failed to generate new code:', result.error);
      }
    } catch (error) {
      console.error('❌ Exception generating new code:', error);
    }
    console.log('');
  };

  const logout = async () => {
    // Prevent multiple simultaneous logout calls
    if (isLoggingOutRef.current) {
      console.log('⏸️ Logout already in progress, skipping duplicate call');
      return;
    }

    isLoggingOutRef.current = true;
    setIsLoggingOut(true);
    setLogoutProgress(0);

    try {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('🚪 LOGOUT INITIATED - 60 SECOND CLEANUP STARTING');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');

      // ============================================================
      // STEP 1: SET LOGOUT FLAG IMMEDIATELY (BEFORE ANYTHING ELSE)
      // ============================================================
      console.log('🚩 STEP 1: Setting logout flag IMMEDIATELY...');
      await AsyncStorage.setItem('just_logged_out', 'true');
      console.log('  ✓ Logout flag set to "true" (this prevents auto-login)');
      setLogoutProgress(5);

      // ============================================================
      // STEP 2: STOP ALL INTERVALS IMMEDIATELY
      // ============================================================
      console.log('⏹️  STEP 2: Stopping all intervals...');
      
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
        console.log('  ✓ Status interval cleared');
      }

      if (authCheckIntervalRef.current) {
        clearInterval(authCheckIntervalRef.current);
        authCheckIntervalRef.current = null;
        console.log('  ✓ Auth check interval cleared');
      }
      setLogoutProgress(10);

      // ============================================================
      // STEP 3: STOP COMMAND LISTENER
      // ============================================================
      console.log('⏹️  STEP 3: Stopping command listener...');
      try {
        await commandListener.stopListening();
        console.log('  ✓ Command listener stopped');
      } catch (error) {
        console.error('  ⚠️  Error stopping command listener:', error);
      }
      setLogoutProgress(15);

      // ============================================================
      // STEP 4: SEND OFFLINE STATUS (if possible)
      // ============================================================
      console.log('📡 STEP 4: Sending offline status...');
      if (deviceId && screenName && username && password) {
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
          console.log('  ✓ Offline status sent successfully');
        } catch (error) {
          console.error('  ⚠️  Error sending offline status (continuing anyway):', error);
        }
      } else {
        console.log('  ⚠️  Skipping offline status (missing credentials)');
      }
      setLogoutProgress(20);

      // ============================================================
      // STEP 5: CLEAR ALL STATE VARIABLES (INCLUDING AUTH CODE)
      // ============================================================
      console.log('🧹 STEP 5: Clearing all state variables...');
      setIsAuthenticated(false);
      setUsername(null);
      setPassword(null);
      setScreenName(null);
      setAuthCode(null);
      setAuthCodeExpiry(null);
      setIsScreenActive(false);
      console.log('  ✓ All state variables cleared (including auth code)');
      setLogoutProgress(30);

      // ============================================================
      // STEP 6: CLEAR ALL ASYNCSTORAGE ITEMS
      // ============================================================
      console.log('💾 STEP 6: Clearing AsyncStorage...');
      const keysToRemove = [
        'username',
        'password',
        'screenName',
        'authCode',
        'authCodeExpiry',
      ];
      
      console.log('  Keys to remove:', keysToRemove);
      await AsyncStorage.multiRemove(keysToRemove);
      console.log('  ✓ All auth keys removed from AsyncStorage');
      setLogoutProgress(40);

      // ============================================================
      // STEP 7: VERIFY CLEANUP
      // ============================================================
      console.log('🔍 STEP 7: Verifying cleanup...');
      const verifyUsername = await AsyncStorage.getItem('username');
      const verifyPassword = await AsyncStorage.getItem('password');
      const verifyScreenName = await AsyncStorage.getItem('screenName');
      const verifyAuthCode = await AsyncStorage.getItem('authCode');
      const verifyLogoutFlag = await AsyncStorage.getItem('just_logged_out');
      
      console.log('  Verification results:');
      console.log('    - username:', verifyUsername === null ? '✓ CLEARED' : '✗ STILL EXISTS');
      console.log('    - password:', verifyPassword === null ? '✓ CLEARED' : '✗ STILL EXISTS');
      console.log('    - screenName:', verifyScreenName === null ? '✓ CLEARED' : '✗ STILL EXISTS');
      console.log('    - authCode:', verifyAuthCode === null ? '✓ CLEARED' : '✗ STILL EXISTS');
      console.log('    - logout flag:', verifyLogoutFlag === 'true' ? '✓ SET' : '✗ NOT SET');
      setLogoutProgress(50);

      // ============================================================
      // STEP 8: 60-SECOND LOADING STAGE - CLEAR EVERYTHING
      // ============================================================
      console.log('⏳ STEP 8: Starting 60-second loading stage...');
      console.log('  During this time, we will:');
      console.log('  - Keep the logout flag active');
      console.log('  - Prevent any authentication attempts');
      console.log('  - Show a nice loading animation');
      console.log('  - Ensure complete state reset');
      
      // Simulate progress over 60 seconds (from 50% to 95%)
      const progressInterval = setInterval(() => {
        setLogoutProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 0.75; // Increment by 0.75% every 1 second (60 seconds total)
        });
      }, 1000);

      // Wait for 60 seconds
      await new Promise(resolve => setTimeout(resolve, 60000));
      
      clearInterval(progressInterval);
      setLogoutProgress(95);
      console.log('  ✓ 60-second loading stage complete');

      // ============================================================
      // STEP 9: FINAL CLEANUP AND VERIFICATION
      // ============================================================
      console.log('🧹 STEP 9: Final cleanup and verification...');
      
      // Clear everything one more time to be absolutely sure
      await AsyncStorage.multiRemove(keysToRemove);
      
      // Verify one more time
      const finalVerify = await AsyncStorage.multiGet(keysToRemove);
      console.log('  Final verification:', finalVerify);
      
      // Ensure logout flag is still set
      await AsyncStorage.setItem('just_logged_out', 'true');
      console.log('  ✓ Logout flag confirmed');
      
      setLogoutProgress(98);

      // ============================================================
      // STEP 10: INCREMENT LOGOUT COUNTER
      // ============================================================
      console.log('🔢 STEP 10: Incrementing logout counter...');
      setLogoutCounter(prev => {
        const newCounter = prev + 1;
        console.log(`  ✓ Logout counter: ${prev} → ${newCounter}`);
        return newCounter;
      });
      setLogoutProgress(100);

      // ============================================================
      // STEP 11: NAVIGATE TO LOGIN SCREEN
      // ============================================================
      console.log('🔄 STEP 11: Navigating to login screen...');
      
      // Wait a moment for state to settle
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Use replace to prevent going back
      try {
        router.replace('/login');
        console.log('  ✓ Navigation to login screen initiated');
      } catch (error) {
        console.error('  ⚠️  Error navigating to login:', error);
      }

      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('✅ LOGOUT COMPLETE - ALL CLEANUP SUCCESSFUL');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📱 User will see login screen');
      console.log('🔒 All credentials and sessions cleared');
      console.log('🚫 Auto-login prevented by logout flag');
      console.log('🔐 Login screen will generate fresh authentication code');
      console.log('🔢 Logout counter incremented to trigger fresh state');
      console.log('⏱️  60-second loading stage completed');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');

    } catch (error) {
      console.error('');
      console.error('═══════════════════════════════════════════════════════');
      console.error('❌ ERROR DURING LOGOUT');
      console.error('═══════════════════════════════════════════════════════');
      console.error('Error details:', error);
      console.error('');
      
      // ============================================================
      // EMERGENCY CLEANUP - FORCE EVERYTHING
      // ============================================================
      console.log('🚨 EMERGENCY CLEANUP - Forcing all operations...');
      
      try {
        // Force set logout flag FIRST
        await AsyncStorage.setItem('just_logged_out', 'true');
        console.log('  ✓ Logout flag force-set');

        // Force clear state
        setIsAuthenticated(false);
        setUsername(null);
        setPassword(null);
        setScreenName(null);
        setAuthCode(null);
        setAuthCodeExpiry(null);
        setIsScreenActive(false);
        setLogoutCounter(prev => prev + 1);
        console.log('  ✓ State force-cleared');

        // Force clear AsyncStorage
        await AsyncStorage.multiRemove([
          'username',
          'password',
          'screenName',
          'authCode',
          'authCodeExpiry',
        ]);
        console.log('  ✓ AsyncStorage force-cleared');

        // Force navigation
        router.replace('/login');
        console.log('  ✓ Navigation force-initiated');

        console.log('');
        console.log('✅ EMERGENCY CLEANUP COMPLETE');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
      } catch (cleanupError) {
        console.error('');
        console.error('💥 CRITICAL ERROR DURING EMERGENCY CLEANUP');
        console.error('This should never happen. Please restart the app.');
        console.error('Error:', cleanupError);
        console.error('═══════════════════════════════════════════════════════');
        console.error('');
      }
    } finally {
      // Reset the logout flags after everything is complete
      setTimeout(() => {
        isLoggingOutRef.current = false;
        setIsLoggingOut(false);
        setLogoutProgress(0);
        console.log('🔓 Logout lock released');
      }, 1000);
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
      isLoggingOut,
      logoutProgress,
      logoutCounter,
      login, 
      loginWithCode,
      checkAuthenticationStatus,
      logout,
      setScreenActive,
      forceGenerateNewCode
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
