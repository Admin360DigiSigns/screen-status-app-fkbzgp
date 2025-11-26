
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, Alert, Platform, ScrollView, Dimensions } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import { sendDeviceStatus, fetchDisplayContent, DisplayConnectResponse } from '@/utils/apiService';
import { colors } from '@/styles/commonStyles';
import { Redirect, useFocusEffect } from 'expo-router';
import ContentPlayer from '@/components/ContentPlayer';
import ScreenShareReceiver from '@/components/ScreenShareReceiver';
import ScreenShareTester from '@/components/ScreenShareTester';

const { width, height } = Dimensions.get('window');
const isTV = width > 1000 || height > 1000;
const isMobile = width < 768;

export default function HomeScreen() {
  const { isAuthenticated, screenName, username, password, deviceId, logout, setScreenActive } = useAuth();
  const networkState = useNetworkState();
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'success' | 'failed' | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isScreenShareMode, setIsScreenShareMode] = useState(false);
  const [isTesterMode, setIsTesterMode] = useState(false);
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
    try {
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
    } catch (error) {
      console.error('Error during logout:', error);
      // Still logout even if status update fails
      await logout();
    }
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

  const handleScreenShare = () => {
    console.log('🎬 Screen Share button pressed - Opening screen share receiver');
    
    // Verify credentials before opening
    if (!username || !password || !screenName) {
      Alert.alert('Error', 'Missing credentials for screen share');
      return;
    }
    
    console.log('✅ Credentials verified, opening screen share modal');
    setIsScreenShareMode(true);
  };

  const handleCloseScreenShare = () => {
    console.log('Closing screen share receiver');
    setIsScreenShareMode(false);
  };

  const handleOpenTester = () => {
    console.log('🧪 Opening Screen Share Tester');
    
    if (!username || !password || !screenName) {
      Alert.alert('Error', 'Missing credentials for tester');
      return;
    }
    
    setIsTesterMode(true);
  };

  const handleCloseTester = () => {
    console.log('Closing Screen Share Tester');
    setIsTesterMode(false);
  };

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.logoBlue} />
        <Text style={[styles.loadingText, isTV && styles.loadingTextTV]}>Initializing device...</Text>
      </View>
    );
  }

  const isOnline = networkState.isConnected === true;
  const statusColor = isOnline ? colors.logoGreen : colors.secondary;
  const isWebPlatform = Platform.OS === 'web';

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isTV && styles.scrollContentTV
        ]}
        showsVerticalScrollIndicator={true}
      >
        <View style={[styles.content, isTV && styles.contentTV]}>
          <Text style={[styles.title, isTV && styles.titleTV]}>Display Status Monitor</Text>
          
          {/* Smaller Online Status Widget */}
          <View style={[styles.statusCard, { borderColor: statusColor }, isTV && styles.statusCardTV]}>
            <View style={[styles.statusIndicator, { backgroundColor: statusColor }, isTV && styles.statusIndicatorTV]} />
            <Text style={[styles.statusText, { color: statusColor }, isTV && styles.statusTextTV]}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>

          <View style={[styles.infoCard, isTV && styles.infoCardTV]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTV && styles.infoLabelTV]}>Username:</Text>
              <Text style={[styles.infoValue, isTV && styles.infoValueTV]}>{username}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTV && styles.infoLabelTV]}>Screen Name:</Text>
              <Text style={[styles.infoValue, isTV && styles.infoValueTV]}>{screenName}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTV && styles.infoLabelTV]}>Device ID:</Text>
              <Text style={[styles.infoValue, isTV && styles.infoValueTV]} numberOfLines={1} ellipsizeMode="middle">
                {deviceId}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTV && styles.infoLabelTV]}>Connection:</Text>
              <Text style={[styles.infoValue, isTV && styles.infoValueTV]}>
                {networkState.type || 'Unknown'}
              </Text>
            </View>

            {lastSyncTime && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, isTV && styles.infoLabelTV]}>Last Sync:</Text>
                <Text style={[styles.infoValue, isTV && styles.infoValueTV]}>
                  {lastSyncTime.toLocaleTimeString()}
                </Text>
              </View>
            )}

            {syncStatus && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, isTV && styles.infoLabelTV]}>Sync Status:</Text>
                <Text style={[
                  styles.infoValue,
                  isTV && styles.infoValueTV,
                  { color: syncStatus === 'success' ? colors.logoGreen : colors.secondary }
                ]}>
                  {syncStatus === 'success' ? '✓ Success' : '✗ Failed'}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.buttonContainer, isTV && styles.buttonContainerTV]}>
            {/* Preview Button - Green from logo */}
            <TouchableOpacity 
              style={[styles.previewButton, isTV && styles.buttonTV]}
              onPress={handlePreview}
              activeOpacity={0.7}
              disabled={isLoadingPreview}
            >
              {isLoadingPreview ? (
                <ActivityIndicator size={isTV ? "large" : "small"} color={colors.card} />
              ) : (
                <Text style={[styles.previewButtonText, isTV && styles.buttonTextTV]}>Preview Content</Text>
              )}
            </TouchableOpacity>

            {/* Only show Screen Share button on native platforms */}
            {!isWebPlatform && (
              <React.Fragment>
                {/* Screen Share Button - Red from logo */}
                <TouchableOpacity 
                  style={[styles.screenShareButton, isTV && styles.buttonTV]}
                  onPress={handleScreenShare}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.screenShareButtonText, isTV && styles.buttonTextTV]}>📺 Screen Share</Text>
                </TouchableOpacity>

                {/* Test Connection Button - Blue from logo */}
                <TouchableOpacity 
                  style={[styles.testerButton, isTV && styles.buttonTV]}
                  onPress={handleOpenTester}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.testerButtonText, isTV && styles.buttonTextTV]}>🧪 Test Connection</Text>
                </TouchableOpacity>
              </React.Fragment>
            )}

            {/* Sync Button - Blue from logo */}
            <TouchableOpacity 
              style={[styles.syncButton, isTV && styles.buttonTV]}
              onPress={handleManualSync}
              activeOpacity={0.7}
            >
              <Text style={[styles.syncButtonText, isTV && styles.buttonTextTV]}>Sync Status Now</Text>
            </TouchableOpacity>

            {/* Logout Button - Secondary gray */}
            <TouchableOpacity 
              style={[styles.logoutButton, isTV && styles.buttonTV]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Text style={[styles.logoutButtonText, isTV && styles.buttonTextTV]}>Logout</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.infoBox, isTV && styles.infoBoxTV]}>
            <Text style={[styles.footerText, isTV && styles.footerTextTV]}>
              ℹ️ Status updates sent every 1 minute
            </Text>
            <Text style={[styles.footerText, isTV && styles.footerTextTV]}>
              Updates only sent when logged in and on this screen
            </Text>
            <Text style={[styles.footerText, isTV && styles.footerTextTV]}>
              Multiple devices can be logged in with different credentials simultaneously
            </Text>
            {isWebPlatform && (
              <Text style={[styles.footerText, isTV && styles.footerTextTV, { color: colors.secondary, marginTop: 8 }]}>
                ⚠️ Screen Share feature is only available on Android/iOS devices
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

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

      {/* Screen Share Modal - Only render on native platforms */}
      {!isWebPlatform && (
        <React.Fragment>
          <Modal
            visible={isScreenShareMode}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={handleCloseScreenShare}
          >
            <ScreenShareReceiver onClose={handleCloseScreenShare} />
          </Modal>

          {/* Screen Share Tester Modal */}
          <Modal
            visible={isTesterMode}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={handleCloseTester}
          >
            <ScreenShareTester onClose={handleCloseTester} />
          </Modal>
        </React.Fragment>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: isMobile ? 48 : 60,
    paddingHorizontal: isMobile ? 20 : 40,
    paddingBottom: 140,
    minHeight: height,
  },
  scrollContentTV: {
    paddingTop: 80,
    paddingHorizontal: 80,
    paddingBottom: 200,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  contentTV: {
    maxWidth: 1200,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text,
  },
  loadingTextTV: {
    fontSize: 28,
    marginTop: 32,
  },
  title: {
    fontSize: isMobile ? 28 : 36,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  titleTV: {
    fontSize: 56,
    marginBottom: 48,
  },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: isMobile ? 12 : 16,
    padding: isMobile ? 16 : 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    width: '100%',
    borderWidth: 2,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
    elevation: 4,
  },
  statusCardTV: {
    borderRadius: 24,
    padding: 40,
    marginBottom: 48,
    borderWidth: 4,
  },
  statusIndicator: {
    width: isMobile ? 12 : 16,
    height: isMobile ? 12 : 16,
    borderRadius: isMobile ? 6 : 8,
    marginBottom: 8,
  },
  statusIndicatorTV: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 16,
  },
  statusText: {
    fontSize: isMobile ? 20 : 26,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  statusTextTV: {
    fontSize: 48,
    letterSpacing: 2,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: isMobile ? 12 : 16,
    padding: isMobile ? 20 : 28,
    width: '100%',
    marginBottom: 24,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  infoCardTV: {
    borderRadius: 24,
    padding: 48,
    marginBottom: 48,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: isMobile ? 10 : 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  infoLabel: {
    fontSize: isMobile ? 14 : 18,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  infoLabelTV: {
    fontSize: 28,
  },
  infoValue: {
    fontSize: isMobile ? 14 : 18,
    fontWeight: '500',
    color: colors.text,
    flex: 2,
    textAlign: 'right',
  },
  infoValueTV: {
    fontSize: 28,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  buttonContainerTV: {
    gap: 24,
  },
  previewButton: {
    backgroundColor: colors.logoGreen,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonTV: {
    paddingHorizontal: 60,
    paddingVertical: 24,
    borderRadius: 20,
    minHeight: 80,
  },
  previewButtonText: {
    color: colors.card,
    fontSize: isMobile ? 16 : 18,
    fontWeight: '600',
  },
  buttonTextTV: {
    fontSize: 32,
  },
  screenShareButton: {
    backgroundColor: colors.logoRed,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  screenShareButtonText: {
    color: colors.card,
    fontSize: isMobile ? 16 : 18,
    fontWeight: '600',
  },
  testerButton: {
    backgroundColor: colors.logoBlue,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  testerButtonText: {
    color: colors.card,
    fontSize: isMobile ? 16 : 18,
    fontWeight: '600',
  },
  syncButton: {
    backgroundColor: colors.logoBlue,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  syncButtonText: {
    color: colors.card,
    fontSize: isMobile ? 16 : 18,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: colors.card,
    fontSize: isMobile ? 16 : 18,
    fontWeight: '600',
  },
  infoBox: {
    marginTop: 24,
    backgroundColor: colors.highlight,
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  infoBoxTV: {
    marginTop: 48,
    borderRadius: 20,
    padding: 32,
  },
  footerText: {
    fontSize: isMobile ? 13 : 14,
    color: colors.text,
    textAlign: 'center',
    paddingVertical: 4,
    lineHeight: isMobile ? 18 : 20,
  },
  footerTextTV: {
    fontSize: 24,
    lineHeight: 36,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
});
