
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, BackHandler, Alert, Modal as RNModal } from 'react-native';
import * as apiService from '@/utils/apiService';
import { getDeviceId } from '@/utils/deviceUtils';
import * as Network from 'expo-network';
import { commandListener, AppCommand } from '@/utils/commandListener';
import { fetchDisplayContent } from '@/utils/apiService';

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
  logoutProgress: string;
  login: (username: string, password: string, screenName: string) => Promise<{ success: boolean; error?: string }>;
  loginWithCode: () => Promise<{ success: boolean; code?: string; error?: string }>;
  checkAuthenticationStatus: () => Promise<{ success: boolean; authenticated: boolean; credentials?: { username: string; password: string; screenName: string }; error?: string }>;
  logout: () => Promise<void>;
  setScreenActive: (active: boolean) => void;
  showPreviewModal: boolean;
  setShowPreviewModal: (show: boolean) => void;
  showScreenShareModal: boolean;
  setShowScreenShareModal: (show: boolean) => void;
  displayContent: any;
  setDisplayContent: (content: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys
const STORAGE_KEYS = {
  USERNAME: 'username',
  PASSWORD: 'password',
  SCREEN_NAME: 'screenName',
  LOGOUT_FLAG: 'logout_flag',
  LOGOUT_TIMESTAMP: 'logout_timestamp',
  DEVICE_ID: 'device_id',
};

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
  const [logoutProgress, setLogoutProgress] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showScreenShareModal, setShowScreenShareModal] = useState(false);
  const [displayContent, setDisplayContent] = useState<any>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const authCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggingOutRef = useRef(false);

  // Global command handlers - defined at the context level so they work everywhere
  const handlePreviewCommand = useCallback(async (command: AppCommand) => {
    console.log('🎬 [AuthContext] ===== PREVIEW COMMAND HANDLER CALLED =====');
    console.log('🎬 [AuthContext] Command:', command);
    console.log('🎬 [AuthContext] Current credentials:', { username, password: !!password, screenName });
    
    if (!username || !password || !screenName) {
      console.error('❌ [AuthContext] Missing credentials for preview');
      Alert.alert('Preview Error', 'Missing credentials. Please log in again.');
      return;
    }

    try {
      console.log('📡 [AuthContext] Fetching display content...');
      const result = await fetchDisplayContent(username, password, screenName);
      
      if (result.success && result.data) {
        console.log('✅ [AuthContext] Preview content loaded successfully');
        setDisplayContent(result.data);
        setShowPreviewModal(true);
        console.log('✅ [AuthContext] Preview modal opened');
      } else {
        console.error('❌ [AuthContext] Failed to load preview content:', result.error);
        Alert.alert('Preview Error', result.error || 'Failed to load preview content');
      }
    } catch (error) {
      console.error('❌ [AuthContext] Error loading preview:', error);
      Alert.alert('Preview Error', 'An unexpected error occurred');
    }
    
    console.log('🎬 [AuthContext] ===== PREVIEW COMMAND HANDLER COMPLETE =====');
  }, [username, password, screenName]);

  const handleScreenShareCommand = useCallback(async (command: AppCommand) => {
    console.log('📺 [AuthContext] ===== SCREENSHARE COMMAND HANDLER CALLED =====');
    console.log('📺 [AuthContext] Command:', command);
    console.log('📺 [AuthContext] Platform:', Platform.OS);
    
    if (Platform.OS === 'web') {
      console.error('❌ [AuthContext] Screen share not available on web');
      Alert.alert('Not Available', 'Screen share is not available on web platform');
      return;
    }

    if (!username || !password || !screenName) {
      console.error('❌ [AuthContext] Missing credentials for screen share');
      Alert.alert('Screen Share Error', 'Missing credentials. Please log in again.');
      return;
    }

    console.log('✅ [AuthContext] Opening screen share modal');
    setShowScreenShareModal(true);
    console.log('✅ [AuthContext] Screen share modal opened');
    console.log('📺 [AuthContext] ===== SCREENSHARE COMMAND HANDLER COMPLETE =====');
  }, [username, password, screenName]);

  const handleSyncCommand = useCallback(async (command: AppCommand) => {
    console.log('🔄 [AuthContext] ===== SYNC COMMAND HANDLER CALLED =====');
    console.log('🔄 [AuthContext] Command:', command);
    console.log('🔄 [AuthContext] Current state:', { deviceId, screenName, username, password: !!password });
    
    if (!deviceId || !screenName || !username || !password) {
      console.error('❌ [AuthContext] Missing required data for sync');
      return;
    }

    try {
      const networkState = await Network.getNetworkStateAsync();
      const status = networkState.isConnected ? 'online' : 'offline';
      
      const payload = {
        deviceId,
        screenName,
        screen_username: username,
        screen_password: password,
        screen_name: screenName,
        status,
        timestamp: new Date().toISOString(),
      };

      console.log('📡 [AuthContext] Syncing device status...');
      const success = await apiService.sendDeviceStatus(payload);
      
      if (success) {
        console.log('✅ [AuthContext] Status sync successful');
      } else {
        console.error('❌ [AuthContext] Status sync failed');
      }
    } catch (error) {
      console.error('❌ [AuthContext] Error during sync:', error);
    }
    
    console.log('🔄 [AuthContext] ===== SYNC COMMAND HANDLER COMPLETE =====');
  }, [deviceId, screenName, username, password]);

  const handleLogoutCommand = useCallback(async (command: AppCommand) => {
    console.log('🚪 [AuthContext] ===== LOGOUT COMMAND HANDLER CALLED =====');
    console.log('🚪 [AuthContext] Command:', command);
    console.log('🚪 [AuthContext] Executing logout...');
    await logout();
    console.log('🚪 [AuthContext] ===== LOGOUT COMMAND HANDLER COMPLETE =====');
  }, []);

  const initializeAuth = useCallback(async () => {
    try {
      console.log('');
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║                    INITIALIZING AUTH                           ║');
      console.log('╚════════════════════════════════════════════════════════════════╝');
      console.log('');
      
      setIsInitializing(true);
      
      // Get device ID first
      const id = await getDeviceId();
      setDeviceId(id);
      console.log('✓ Device ID initialized:', id);

      // Initialize command listener with device ID
      commandListener.initialize(id);
      console.log('✓ Command listener initialized');

      // CRITICAL: Check if user just logged out
      const logoutFlag = await AsyncStorage.getItem(STORAGE_KEYS.LOGOUT_FLAG);
      const logoutTimestamp = await AsyncStorage.getItem(STORAGE_KEYS.LOGOUT_TIMESTAMP);
      
      if (logoutFlag === 'true') {
        console.log('');
        console.log('⚠️ ═══════════════════════════════════════════════════════════');
        console.log('⚠️  LOGOUT FLAG DETECTED - User just logged out');
        console.log('⚠️ ═══════════════════════════════════════════════════════════');
        
        if (logoutTimestamp) {
          const logoutTime = parseInt(logoutTimestamp, 10);
          const now = Date.now();
          const timeSinceLogout = (now - logoutTime) / 1000;
          console.log('⚠️  Logout occurred:', timeSinceLogout.toFixed(1), 'seconds ago');
          
          // Keep the logout flag for 30 seconds to prevent any auto-login attempts
          if (timeSinceLogout < 30) {
            console.log('⚠️  Logout is recent - BLOCKING auto-login');
            console.log('⚠️  Clearing any stored credentials');
            
            // Force clear all credentials
            await AsyncStorage.multiRemove([
              STORAGE_KEYS.USERNAME,
              STORAGE_KEYS.PASSWORD,
              STORAGE_KEYS.SCREEN_NAME,
            ]);
            
            // Clear backend authentication again to be sure
            console.log('⚠️  Re-clearing backend authentication');
            try {
              await apiService.clearDeviceAuthentication(id);
              console.log('✓  Backend authentication re-cleared');
            } catch (error) {
              console.error('✗  Failed to re-clear backend:', error);
            }
            
            setIsInitializing(false);
            console.log('⚠️  Staying on login screen - NO AUTO-LOGIN');
            console.log('⚠️ ═══════════════════════════════════════════════════════════');
            console.log('');
            return;
          } else {
            console.log('⚠️  Logout was more than 30 seconds ago - clearing flag');
            await AsyncStorage.multiRemove([STORAGE_KEYS.LOGOUT_FLAG, STORAGE_KEYS.LOGOUT_TIMESTAMP]);
          }
        } else {
          console.log('⚠️  No logout timestamp - clearing flag and blocking auto-login');
          await AsyncStorage.removeItem(STORAGE_KEYS.LOGOUT_FLAG);
          setIsInitializing(false);
          console.log('⚠️ ═══════════════════════════════════════════════════════════');
          console.log('');
          return;
        }
      }

      // Check if we're currently in a logout process
      if (isLoggingOutRef.current) {
        console.log('⚠️  Logout in progress - skipping auto-login');
        setIsInitializing(false);
        return;
      }

      // Load auth state from storage
      console.log('Checking for stored credentials...');
      await loadAuthState();
      
      setIsInitializing(false);
      console.log('');
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║              AUTH INITIALIZATION COMPLETE                      ║');
      console.log('╚════════════════════════════════════════════════════════════════╝');
      console.log('');
    } catch (error) {
      console.error('Error initializing auth:', error);
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Set up GLOBAL command handlers when authenticated
  useEffect(() => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           COMMAND LISTENER SETUP EFFECT TRIGGERED             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('Current state:', {
      isAuthenticated,
      deviceId: !!deviceId,
      username: !!username,
      password: !!password,
      screenName: !!screenName,
    });
    console.log('');

    if (!isAuthenticated || !deviceId) {
      console.log('⏸️ [AuthContext] Skipping global command listener setup');
      console.log('   Reason: Not authenticated or no device ID');
      console.log('   isAuthenticated:', isAuthenticated);
      console.log('   deviceId:', deviceId);
      return;
    }

    console.log('🌍 [AuthContext] ===== SETTING UP GLOBAL COMMAND HANDLERS =====');
    console.log('🌍 [AuthContext] Device ID:', deviceId);
    console.log('🌍 [AuthContext] Screen Name:', screenName);
    console.log('🌍 [AuthContext] Username:', username);

    // Register command handlers globally
    console.log('📝 [AuthContext] Registering command handlers...');
    commandListener.registerHandler('preview_content', handlePreviewCommand);
    console.log('   ✓ Registered: preview_content');
    
    commandListener.registerHandler('screenshare', handleScreenShareCommand);
    console.log('   ✓ Registered: screenshare');
    
    commandListener.registerHandler('sync_status', handleSyncCommand);
    console.log('   ✓ Registered: sync_status');
    
    commandListener.registerHandler('logout', handleLogoutCommand);
    console.log('   ✓ Registered: logout');

    // Start listening for commands globally
    console.log('🎧 [AuthContext] Starting command listener...');
    commandListener.startListening();
    console.log('✅ [AuthContext] Command listener started');
    console.log('🌍 [AuthContext] ===== GLOBAL COMMAND HANDLERS SETUP COMPLETE =====');
    console.log('');

    // Cleanup
    return () => {
      console.log('');
      console.log('🧹 [AuthContext] ===== CLEANING UP GLOBAL COMMAND HANDLERS =====');
      commandListener.stopListening();
      console.log('✅ [AuthContext] Command listener stopped');
      console.log('🧹 [AuthContext] ===== CLEANUP COMPLETE =====');
      console.log('');
    };
  }, [isAuthenticated, deviceId, username, password, screenName, handlePreviewCommand, handleScreenShareCommand, handleSyncCommand, handleLogoutCommand]);

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
    // 4. NOT currently logging out
    if (isAuthenticated && isScreenActive && deviceId && screenName && username && password && !isLoggingOutRef.current) {
      console.log('✓ Setting up 20-second status update interval (user logged in and on screen)');
      
      // Define the status update function inside useEffect to avoid stale closures
      const sendStatusUpdate = async () => {
        // Double-check we're not logging out
        if (isLoggingOutRef.current) {
          console.log('Skipping status update - logout in progress');
          return;
        }
        
        try {
          console.log('===========================================');
          console.log('Interval triggered - sending status update');
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
      console.log('Loading auth state from AsyncStorage...');
      
      const storedUsername = await AsyncStorage.getItem(STORAGE_KEYS.USERNAME);
      const storedPassword = await AsyncStorage.getItem(STORAGE_KEYS.PASSWORD);
      const storedScreenName = await AsyncStorage.getItem(STORAGE_KEYS.SCREEN_NAME);
      
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
        await AsyncStorage.setItem(STORAGE_KEYS.USERNAME, inputUsername);
        await AsyncStorage.setItem(STORAGE_KEYS.PASSWORD, inputPassword);
        await AsyncStorage.setItem(STORAGE_KEYS.SCREEN_NAME, inputScreenName);
        
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
          await AsyncStorage.setItem(STORAGE_KEYS.USERNAME, creds.screen_username);
          await AsyncStorage.setItem(STORAGE_KEYS.PASSWORD, creds.screen_password);
          await AsyncStorage.setItem(STORAGE_KEYS.SCREEN_NAME, creds.screen_name);
          
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
    // Set the logout ref immediately to prevent any status updates
    isLoggingOutRef.current = true;
    
    try {
      console.log('');
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║                    LOGOUT INITIATED                            ║');
      console.log('╚════════════════════════════════════════════════════════════════╝');
      console.log('');
      
      setIsLoggingOut(true);
      setLogoutProgress('Give us a moment while we log you out...');
      
      // Close any open modals
      setShowPreviewModal(false);
      setShowScreenShareModal(false);
      setDisplayContent(null);
      
      // STEP 1: Set logout flag FIRST with timestamp to prevent auto-login
      console.log('┌─ STEP 1: Setting logout flag with timestamp');
      setLogoutProgress('Setting logout flag...');
      try {
        const now = Date.now().toString();
        await AsyncStorage.setItem(STORAGE_KEYS.LOGOUT_FLAG, 'true');
        await AsyncStorage.setItem(STORAGE_KEYS.LOGOUT_TIMESTAMP, now);
        console.log('└─ ✓ Logout flag set with timestamp:', now);
      } catch (error) {
        console.error('└─ ✗ Failed to set logout flag:', error);
      }
      console.log('');
      
      // STEP 2: Clear intervals and listeners
      console.log('┌─ STEP 2: Clearing intervals and listeners');
      setLogoutProgress('Stopping background services...');
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
        console.log('│  ✓ Status interval cleared');
      }
      if (authCheckIntervalRef.current) {
        clearInterval(authCheckIntervalRef.current);
        authCheckIntervalRef.current = null;
        console.log('│  ✓ Auth check interval cleared');
      }
      await commandListener.stopListening();
      console.log('└─ ✓ Command listener stopped');
      console.log('');

      // STEP 3: Send offline status
      if (deviceId && screenName && username && password) {
        console.log('┌─ STEP 3: Sending offline status to backend');
        setLogoutProgress('Sending offline status...');
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
          console.log('└─ ✓ Offline status sent successfully');
        } catch (error) {
          console.error('└─ ✗ Failed to send offline status:', error);
        }
      } else {
        console.log('└─ ⊘ Skipping offline status (missing credentials)');
      }
      console.log('');

      // STEP 4: CRITICAL - Clear backend authentication state with extended retry
      if (deviceId) {
        console.log('┌─ STEP 4: Clearing backend authentication state');
        setLogoutProgress('Clearing backend authentication...');
        console.log('│  This is CRITICAL to prevent auto-login after app restart');
        
        let backendCleared = false;
        const maxAttempts = 5;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            console.log(`│  Attempt ${attempt}/${maxAttempts}...`);
            const clearResult = await apiService.clearDeviceAuthentication(deviceId, 1);
            if (clearResult.success) {
              console.log('└─ ✓ Backend authentication cleared successfully');
              console.log('   Device will NOT auto-login on next app start');
              backendCleared = true;
              break;
            } else {
              console.error(`│  ✗ Attempt ${attempt} failed:`, clearResult.error);
              if (attempt < maxAttempts) {
                const waitTime = attempt * 500;
                console.log(`│  Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
            }
          } catch (error) {
            console.error(`│  ✗ Attempt ${attempt} exception:`, error);
            if (attempt < maxAttempts) {
              const waitTime = attempt * 500;
              console.log(`│  Waiting ${waitTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        }
        
        if (!backendCleared) {
          console.error('└─ ✗ FAILED to clear backend after all attempts');
          console.error('   ⚠️ WARNING: Device may auto-login on next app start!');
        }
      } else {
        console.log('└─ ⊘ Skipping backend clear (no device ID)');
      }
      console.log('');

      // STEP 5: Clear ALL local storage
      console.log('┌─ STEP 5: Clearing ALL local storage');
      setLogoutProgress('Clearing local data...');
      const keysToRemove = [
        STORAGE_KEYS.USERNAME,
        STORAGE_KEYS.PASSWORD,
        STORAGE_KEYS.SCREEN_NAME,
      ];
      
      try {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log('│  ✓ AsyncStorage cleared (multiRemove)');
      } catch (error) {
        console.error('│  ✗ multiRemove failed, trying individual removal:', error);
        // Fallback to individual removal
        for (const key of keysToRemove) {
          try {
            await AsyncStorage.removeItem(key);
            console.log(`│  ✓ Removed ${key}`);
          } catch (removeError) {
            console.error(`│  ✗ Failed to remove ${key}:`, removeError);
          }
        }
      }
      
      // Verify storage is cleared
      try {
        const remainingUsername = await AsyncStorage.getItem(STORAGE_KEYS.USERNAME);
        const remainingPassword = await AsyncStorage.getItem(STORAGE_KEYS.PASSWORD);
        const remainingScreenName = await AsyncStorage.getItem(STORAGE_KEYS.SCREEN_NAME);
        
        if (!remainingUsername && !remainingPassword && !remainingScreenName) {
          console.log('└─ ✓ Verified: All credentials removed from storage');
        } else {
          console.error('└─ ✗ WARNING: Some credentials still in storage!');
          console.error('   Username:', !!remainingUsername);
          console.error('   Password:', !!remainingPassword);
          console.error('   ScreenName:', !!remainingScreenName);
        }
      } catch (error) {
        console.error('└─ ✗ Failed to verify storage clear:', error);
      }
      console.log('');
      
      // STEP 6: Clear state
      console.log('┌─ STEP 6: Clearing authentication state');
      setLogoutProgress('Clearing session...');
      setUsername(null);
      setPassword(null);
      setScreenName(null);
      setAuthCode(null);
      setAuthCodeExpiry(null);
      setIsAuthenticated(false);
      setIsScreenActive(false);
      console.log('└─ ✓ All state variables cleared');
      console.log('');
      
      // STEP 7: Wait for async operations
      console.log('┌─ STEP 7: Waiting for async operations to complete');
      setLogoutProgress('Finalizing logout...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Increased to 2 seconds
      console.log('└─ ✓ Wait complete');
      console.log('');
      
      // STEP 8: Generate new authentication code
      console.log('┌─ STEP 8: Generating new authentication code');
      setLogoutProgress('Generating new authentication code...');
      try {
        const codeResult = await loginWithCode();
        if (codeResult.success && codeResult.code) {
          console.log('└─ ✓ New authentication code generated:', codeResult.code);
        } else {
          console.error('└─ ✗ Failed to generate new code:', codeResult.error);
        }
      } catch (error) {
        console.error('└─ ✗ Exception while generating new code:', error);
      }
      console.log('');
      
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║                   LOGOUT COMPLETED SUCCESSFULLY                ║');
      console.log('║                                                                ║');
      console.log('║  ✓ Backend authentication cleared                             ║');
      console.log('║  ✓ Local storage cleared                                      ║');
      console.log('║  ✓ State cleared                                              ║');
      console.log('║  ✓ New authentication code generated                          ║');
      console.log('║  ✓ Logout flag set with 30-second protection                  ║');
      console.log('║                                                                ║');
      console.log('║  User is now on login screen with fresh code                  ║');
      console.log('╚════════════════════════════════════════════════════════════════╝');
      console.log('');
      
      setIsLoggingOut(false);
      setLogoutProgress('');
      
    } catch (error) {
      console.error('');
      console.error('╔════════════════════════════════════════════════════════════════╗');
      console.error('║                  ✗ CRITICAL ERROR DURING LOGOUT               ║');
      console.error('╚════════════════════════════════════════════════════════════════╝');
      console.error('Error:', error);
      console.error('');
      
      // EMERGENCY CLEANUP
      console.log('┌─ EMERGENCY CLEANUP: Attempting to clear everything');
      setLogoutProgress('Emergency cleanup...');
      try {
        // Set logout flag with timestamp
        const now = Date.now().toString();
        await AsyncStorage.setItem(STORAGE_KEYS.LOGOUT_FLAG, 'true');
        await AsyncStorage.setItem(STORAGE_KEYS.LOGOUT_TIMESTAMP, now);
        console.log('│  ✓ Logout flag set');
        
        // Clear storage
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.USERNAME,
          STORAGE_KEYS.PASSWORD,
          STORAGE_KEYS.SCREEN_NAME,
        ]);
        console.log('│  ✓ Storage cleared');
        
        // Clear backend if possible - multiple attempts
        if (deviceId) {
          for (let i = 0; i < 3; i++) {
            try {
              await apiService.clearDeviceAuthentication(deviceId, 1);
              console.log('│  ✓ Backend cleared');
              break;
            } catch (clearError) {
              console.error(`│  ✗ Backend clear attempt ${i + 1} failed`);
              if (i < 2) await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
      } catch (cleanupError) {
        console.error('│  ✗ Emergency cleanup failed:', cleanupError);
      }
      
      // Clear state regardless
      setUsername(null);
      setPassword(null);
      setScreenName(null);
      setAuthCode(null);
      setAuthCodeExpiry(null);
      setIsAuthenticated(false);
      setIsScreenActive(false);
      setShowPreviewModal(false);
      setShowScreenShareModal(false);
      setDisplayContent(null);
      console.log('└─ ✓ State cleared');
      console.log('');
      
      // Try to generate new code
      try {
        console.log('Attempting to generate new code after error...');
        setLogoutProgress('Generating new code...');
        await loginWithCode();
      } catch (codeError) {
        console.error('Failed to generate new code:', codeError);
      }
      
      setIsLoggingOut(false);
      setLogoutProgress('');
    } finally {
      // Reset the logout ref
      isLoggingOutRef.current = false;
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
      login, 
      loginWithCode,
      checkAuthenticationStatus,
      logout,
      setScreenActive,
      showPreviewModal,
      setShowPreviewModal,
      showScreenShareModal,
      setShowScreenShareModal,
      displayContent,
      setDisplayContent,
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
