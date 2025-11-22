
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import { sendDeviceStatus } from '@/utils/apiService';
import { colors } from '@/styles/commonStyles';
import { Redirect } from 'expo-router';

export default function HomeScreen() {
  const { isAuthenticated, screenName, username, deviceId, logout } = useAuth();
  const networkState = useNetworkState();
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'success' | 'failed' | null>(null);

  useEffect(() => {
    if (deviceId) {
      setIsLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (deviceId && screenName && username && networkState.isConnected !== undefined) {
      syncDeviceStatus();
    }
  }, [deviceId, screenName, username, networkState.isConnected]);

  const syncDeviceStatus = async () => {
    if (!deviceId || !screenName || !username) {
      console.log('Missing required data for sync:', { deviceId, screenName, username });
      return;
    }

    const status = networkState.isConnected ? 'online' : 'offline';
    const payload = {
      deviceId,
      screenName,
      screen_username: username,
      status,
      timestamp: new Date().toISOString(),
    };

    console.log('Syncing device status with payload:', payload);
    const success = await sendDeviceStatus(payload);
    
    if (success) {
      setLastSyncTime(new Date());
      setSyncStatus('success');
      console.log('Status sync successful');
    } else {
      setSyncStatus('failed');
      console.log('Status sync failed');
    }
  };

  const handleLogout = async () => {
    // Send offline status before logging out
    if (deviceId && screenName && username) {
      await sendDeviceStatus({
        deviceId,
        screenName,
        screen_username: username,
        status: 'offline',
        timestamp: new Date().toISOString(),
      });
    }
    await logout();
  };

  const handleManualSync = () => {
    syncDeviceStatus();
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

  const isOnline = networkState.isConnected === true;
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
            <Text style={styles.infoLabel}>Username:</Text>
            <Text style={styles.infoValue}>{username}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Screen Name:</Text>
            <Text style={styles.infoValue}>{screenName}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Device ID:</Text>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
              {deviceId}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Connection:</Text>
            <Text style={styles.infoValue}>
              {networkState.type || 'Unknown'}
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

          {syncStatus && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Sync Status:</Text>
              <Text style={[
                styles.infoValue,
                { color: syncStatus === 'success' ? colors.accent : colors.secondary }
              ]}>
                {syncStatus === 'success' ? '✓ Success' : '✗ Failed'}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={styles.syncButton}
          onPress={handleManualSync}
          activeOpacity={0.7}
        >
          <Text style={styles.syncButtonText}>Sync Status Now</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.footerText}>
            ℹ️ Each device sends its own status independently
          </Text>
          <Text style={styles.footerText}>
            Multiple devices can be logged in with different credentials simultaneously
          </Text>
        </View>
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
  syncButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  syncButtonText: {
    color: colors.card,
    fontSize: 18,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: colors.card,
    fontSize: 18,
    fontWeight: '600',
  },
  infoBox: {
    marginTop: 24,
    backgroundColor: colors.highlight,
    borderRadius: 12,
    padding: 16,
    maxWidth: 500,
  },
  footerText: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    paddingVertical: 4,
    lineHeight: 20,
  },
});
