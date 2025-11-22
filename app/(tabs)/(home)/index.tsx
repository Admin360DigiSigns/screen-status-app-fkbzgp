
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, AppState, AppStateStatus } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import { getDeviceId } from '@/utils/deviceUtils';
import { sendDisplayStatus } from '@/utils/apiService';
import { colors } from '@/styles/commonStyles';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen() {
  const { isAuthenticated, screenName, username, location, displayId, logout } = useAuth();
  const networkState = useNetworkState();
  const [deviceId, setDeviceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Initialize device ID
  useEffect(() => {
    initializeDevice();
  }, []);

  // Handle AppState changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  // Start/stop periodic status updates based on auth and app state
  useEffect(() => {
    if (isAuthenticated && deviceId && screenName && appState === 'active') {
      console.log('Starting periodic status updates (every 10 seconds)');
      startPeriodicStatusUpdates();
    } else {
      console.log('Stopping periodic status updates');
      stopPeriodicStatusUpdates();
      
      // Send offline status when stopping
      if (isAuthenticated && deviceId && screenName && appState !== 'active') {
        sendOfflineStatus();
      }
    }

    return () => {
      stopPeriodicStatusUpdates();
    };
  }, [isAuthenticated, deviceId, screenName, appState]);

  const initializeDevice = async () => {
    try {
      const id = await getDeviceId();
      setDeviceId(id);
      console.log('Device initialized with ID:', id);
    } catch (error) {
      console.error('Error initializing device:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log('App state changed from', appStateRef.current, 'to', nextAppState);
    
    if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
      console.log('App went to background');
    } else if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('App came to foreground');
    }
    
    appStateRef.current = nextAppState;
    setAppState(nextAppState);
  };

  const startPeriodicStatusUpdates = () => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Send initial status immediately
    sendCurrentStatus();

    // Set up interval to send status every 10 seconds
    intervalRef.current = setInterval(() => {
      console.log('Periodic status update triggered');
      sendCurrentStatus();
    }, 10000); // 10 seconds
  };

  const stopPeriodicStatusUpdates = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('Periodic status updates stopped');
    }
  };

  const sendCurrentStatus = async () => {
    if (!deviceId || !screenName || !username) {
      console.log('Missing required data for status update');
      return;
    }

    try {
      const password = await AsyncStorage.getItem('password');
      const storedLocation = await AsyncStorage.getItem('location');
      const storedAssignedSolutionId = await AsyncStorage.getItem('assignedSolutionId');
      const storedOrganizationId = await AsyncStorage.getItem('organizationId');
      
      if (!password) {
        console.error('Password not found in storage');
        return;
      }

      const isOnline = networkState.isConnected === true && appState === 'active';
      const status = isOnline ? 'online' : 'offline';

      console.log('Sending status update:', { status, deviceId, screenName });

      const response = await sendDisplayStatus(
        deviceId,
        screenName,
        username,
        password,
        status,
        storedLocation || location || undefined,
        storedAssignedSolutionId || undefined,
        storedOrganizationId || undefined
      );

      if (response.success) {
        setLastSyncTime(new Date());
        console.log('Status update sent successfully');
      } else {
        console.error('Failed to send status update:', response.error);
      }
    } catch (error) {
      console.error('Error sending status update:', error);
    }
  };

  const sendOfflineStatus = async () => {
    if (!deviceId || !screenName || !username) {
      console.log('Missing required data for offline status');
      return;
    }

    try {
      const password = await AsyncStorage.getItem('password');
      const storedLocation = await AsyncStorage.getItem('location');
      const storedAssignedSolutionId = await AsyncStorage.getItem('assignedSolutionId');
      const storedOrganizationId = await AsyncStorage.getItem('organizationId');
      
      if (!password) {
        console.error('Password not found in storage');
        return;
      }

      console.log('Sending offline status');

      await sendDisplayStatus(
        deviceId,
        screenName,
        username,
        password,
        'offline',
        storedLocation || location || undefined,
        storedAssignedSolutionId || undefined,
        storedOrganizationId || undefined
      );
    } catch (error) {
      console.error('Error sending offline status:', error);
    }
  };

  const handleLogout = async () => {
    console.log('Logout initiated');
    
    // Stop periodic updates
    stopPeriodicStatusUpdates();
    
    // Send offline status before logging out
    await sendOfflineStatus();
    
    // Perform logout
    await logout();
  };

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Initializing device...</Text>
      </View>
    );
  }

  const isOnline = networkState.isConnected === true && appState === 'active';
  const statusColor = isOnline ? colors.accent : colors.secondary;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>TV Status Monitor</Text>
        
        <View style={[styles.statusCard, { borderColor: statusColor }]}>
          <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Screen Name:</Text>
            <Text style={styles.infoValue}>{screenName}</Text>
          </View>
          
          {displayId && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Display ID:</Text>
              <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
                {displayId}
              </Text>
            </View>
          )}
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Device ID:</Text>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
              {deviceId}
            </Text>
          </View>
          
          {location && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Location:</Text>
              <Text style={styles.infoValue}>
                {location}
              </Text>
            </View>
          )}
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Connection:</Text>
            <Text style={styles.infoValue}>
              {networkState.type || 'Unknown'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App State:</Text>
            <Text style={styles.infoValue}>
              {appState}
            </Text>
          </View>

          {lastSyncTime && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Sync:</Text>
              <Text style={styles.infoValue}>
                {lastSyncTime.toLocaleTimeString()}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Status updates are sent every 10 seconds while app is active
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 48,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 40,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    minWidth: 280,
    borderWidth: 3,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
    elevation: 4,
  },
  statusIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    marginBottom: 24,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    flex: 2,
    textAlign: 'right',
  },
  logoutButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: colors.card,
    fontSize: 18,
    fontWeight: '600',
  },
  footerText: {
    marginTop: 24,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
