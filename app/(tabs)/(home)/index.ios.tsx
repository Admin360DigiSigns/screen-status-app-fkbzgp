
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, Alert } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import { sendDeviceStatus, fetchDisplayContent, DisplayConnectResponse } from '@/utils/apiService';
import { colors } from '@/styles/commonStyles';
import { Redirect, useFocusEffect } from 'expo-router';
import ContentPlayer from '@/components/ContentPlayer';

export default function HomeScreen() {
  const { isAuthenticated, screenName, username, password, deviceId, logout, setScreenActive } = useAuth();
  const networkState = useNetworkState();
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'success' | 'failed' | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [displayContent, setDisplayContent] = useState<DisplayConnectResponse | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Track when the screen is focused/unfocused
  useFocusEffect(
    React.useCallback(() => {
      console.log('Home screen focused - activating status updates');
      setScreenActive(true);

      return () => {
        console.log('Home screen unfocused - deactivating status updates');
        setScreenActive(false);
      };
    }, [setScreenActive])
  );

  useEffect(() => {
    if (deviceId) {
      setIsLoading(false);
    }
  }, [deviceId]);

  const syncDeviceStatus = useCallback(async () => {
    if (!deviceId || !screenName || !username || !password) {
      console.log('Missing required data for sync:', { deviceId, screenName, username, hasPassword: !!password });
      return;
    }

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

    console.log('Syncing device status with payload (password hidden)');
    const success = await sendDeviceStatus(payload);
    
    if (success) {
      setLastSyncTime(new Date());
      setSyncStatus('success');
      console.log('Status sync successful');
    } else {
      setSyncStatus('failed');
      console.log('Status sync failed');
    }
  }, [deviceId, screenName, username, password, networkState.isConnected]);

  useEffect(() => {
    if (deviceId && screenName && username && password && networkState.isConnected !== undefined) {
      syncDeviceStatus();
    }
  }, [deviceId, screenName, username, password, networkState.isConnected, syncDeviceStatus]);

  const handleLogout = async () => {
    // Send offline status before logging out
    if (deviceId && screenName && username && password) {
      await sendDeviceStatus({
        deviceId,
        screenName,
        screen_username: username,
        screen_password: password,
        screen_name: screenName,
        status: 'offline',
        timestamp: new Date().toISOString(),
      });
    }
    await logout();
  };

  const handleManualSync = () => {
    syncDeviceStatus();
  };

  const handlePreview = async () => {
    if (!username || !password || !screenName) {
      Alert.alert('Error', 'Missing credentials for preview');
      return;
    }

    setIsLoadingPreview(true);
    console.log('Fetching preview content...');

    try {
      const result = await fetchDisplayContent(username, password, screenName);
      
      if (result.success && result.data) {
        console.log('Preview content loaded successfully');
        setDisplayContent(result.data);
        setIsPreviewMode(true);
      } else {
        Alert.alert('Preview Error', result.error || 'Failed to load preview content');
      }
    } catch (error) {
      console.error('Error loading preview:', error);
      Alert.alert('Preview Error', 'An unexpected error occurred');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleClosePreview = () => {
    setIsPreviewMode(false);
    setDisplayContent(null);
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
          style={styles.previewButton}
          onPress={handlePreview}
          activeOpacity={0.7}
          disabled={isLoadingPreview}
        >
          {isLoadingPreview ? (
            <ActivityIndicator size="small" color={colors.card} />
          ) : (
            <Text style={styles.previewButtonText}>Preview Content</Text>
          )}
        </TouchableOpacity>

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
            ℹ️ Status updates sent every 1 minute
          </Text>
          <Text style={styles.footerText}>
            Updates only sent when logged in and on this screen
          </Text>
          <Text style={styles.footerText}>
            Multiple devices can be logged in with different credentials simultaneously
          </Text>
        </View>
      </View>

      {/* Preview Modal */}
      <Modal
        visible={isPreviewMode}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleClosePreview}
      >
        {displayContent && displayContent.solution && displayContent.solution.playlists ? (
          <ContentPlayer
            playlists={displayContent.solution.playlists}
            onClose={handleClosePreview}
          />
        ) : (
          <View style={styles.container}>
            <View style={styles.content}>
              <Text style={styles.errorText}>No content available</Text>
              <TouchableOpacity style={styles.logoutButton} onPress={handleClosePreview}>
                <Text style={styles.logoutButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  previewButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  previewButtonText: {
    color: colors.card,
    fontSize: 18,
    fontWeight: '600',
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
  errorText: {
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
});
