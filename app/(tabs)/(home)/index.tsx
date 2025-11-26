
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, Alert, Platform, ScrollView } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import { sendDeviceStatus, fetchDisplayContent, DisplayConnectResponse } from '@/utils/apiService';
import { colors } from '@/styles/commonStyles';
import { Redirect, useFocusEffect } from 'expo-router';
import ContentPlayer from '@/components/ContentPlayer';
import ScreenShareReceiver from '@/components/ScreenShareReceiver';
import ScreenShareTester from '@/components/ScreenShareTester';
import { isTV } from '@/utils/deviceUtils';

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

  const isTVDevice = isTV();

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
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Initializing device...</Text>
      </View>
    );
  }

  const isOnline = networkState.isConnected === true;
  const statusColor = isOnline ? colors.accent : colors.secondary;
  const isWebPlatform = Platform.OS === 'web';

  // TV Layout - Single screen, no scrolling, optimized button placement
  if (isTVDevice) {
    return (
      <View style={styles.tvContainer}>
        <View style={styles.tvContent}>
          <Text style={styles.tvTitle}>TV Status Monitor</Text>
          
          <View style={styles.tvMainRow}>
            {/* Left Column - Status and Info */}
            <View style={styles.tvLeftColumn}>
              <View style={[styles.tvStatusCard, { borderColor: statusColor }]}>
                <View style={[styles.tvStatusIndicator, { backgroundColor: statusColor }]} />
                <Text style={[styles.tvStatusText, { color: statusColor }]}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>

              <View style={styles.tvInfoCard}>
                <View style={styles.tvInfoRow}>
                  <Text style={styles.tvInfoLabel}>Username:</Text>
                  <Text style={styles.tvInfoValue}>{username}</Text>
                </View>

                <View style={styles.tvInfoRow}>
                  <Text style={styles.tvInfoLabel}>Screen:</Text>
                  <Text style={styles.tvInfoValue}>{screenName}</Text>
                </View>
                
                <View style={styles.tvInfoRow}>
                  <Text style={styles.tvInfoLabel}>Device ID:</Text>
                  <Text style={styles.tvInfoValue} numberOfLines={1} ellipsizeMode="middle">
                    {deviceId}
                  </Text>
                </View>

                {lastSyncTime && (
                  <View style={styles.tvInfoRow}>
                    <Text style={styles.tvInfoLabel}>Last Sync:</Text>
                    <Text style={styles.tvInfoValue}>
                      {lastSyncTime.toLocaleTimeString()}
                    </Text>
                  </View>
                )}

                {syncStatus && (
                  <View style={styles.tvInfoRow}>
                    <Text style={styles.tvInfoLabel}>Status:</Text>
                    <Text style={[
                      styles.tvInfoValue,
                      { color: syncStatus === 'success' ? colors.accent : colors.secondary }
                    ]}>
                      {syncStatus === 'success' ? '✓ Success' : '✗ Failed'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Right Column - Action Buttons */}
            <View style={styles.tvRightColumn}>
              <TouchableOpacity 
                style={styles.tvPreviewButton}
                onPress={handlePreview}
                activeOpacity={0.7}
                disabled={isLoadingPreview}
              >
                {isLoadingPreview ? (
                  <ActivityIndicator size="small" color={colors.card} />
                ) : (
                  <Text style={styles.tvButtonText}>Preview Content</Text>
                )}
              </TouchableOpacity>

              {!isWebPlatform && (
                <React.Fragment>
                  <TouchableOpacity 
                    style={styles.tvScreenShareButton}
                    onPress={handleScreenShare}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.tvButtonText}>📺 Screen Share</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.tvTesterButton}
                    onPress={handleOpenTester}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.tvButtonText}>🧪 Test Connection</Text>
                  </TouchableOpacity>
                </React.Fragment>
              )}

              <TouchableOpacity 
                style={styles.tvSyncButton}
                onPress={handleManualSync}
                activeOpacity={0.7}
              >
                <Text style={styles.tvButtonText}>Sync Status Now</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.tvLogoutButton}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Text style={styles.tvButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tvFooter}>
            <Text style={styles.tvFooterText}>
              ℹ️ Status updates sent every 1 minute • Updates only when on this screen
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

  // Mobile Layout - Original scrollable design
  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.content}>
          <Text style={styles.title}>TV Status Monitor</Text>
          
          <View style={[styles.statusCard, { borderColor: statusColor }]}>
            <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {isOnline ? 'Online' : 'Offline'}
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

          {/* Only show Screen Share button on native platforms */}
          {!isWebPlatform && (
            <React.Fragment>
              <TouchableOpacity 
                style={styles.screenShareButton}
                onPress={handleScreenShare}
                activeOpacity={0.7}
              >
                <Text style={styles.screenShareButtonText}>📺 Screen Share</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.testerButton}
                onPress={handleOpenTester}
                activeOpacity={0.7}
              >
                <Text style={styles.testerButtonText}>🧪 Test Connection</Text>
              </TouchableOpacity>
            </React.Fragment>
          )}

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
            {isWebPlatform && (
              <Text style={[styles.footerText, { color: colors.secondary, marginTop: 8 }]}>
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
  // Mobile styles
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 48,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 140,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
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
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
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
    borderBottomColor: '#f0f0f0',
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
  screenShareButton: {
    backgroundColor: '#9333EA',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  screenShareButtonText: {
    color: colors.card,
    fontSize: 18,
    fontWeight: '600',
  },
  testerButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  testerButtonText: {
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

  // TV styles - optimized for single screen display
  tvContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 30,
  },
  tvContent: {
    width: '100%',
    maxWidth: 1400,
    height: '100%',
    justifyContent: 'space-between',
  },
  tvTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  tvMainRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 30,
  },
  tvLeftColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  tvRightColumn: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  tvStatusCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 4,
    boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.2)',
    elevation: 6,
  },
  tvStatusIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  tvStatusText: {
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  tvInfoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
    elevation: 4,
  },
  tvInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tvInfoLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  tvInfoValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 2,
    textAlign: 'right',
  },
  tvPreviewButton: {
    backgroundColor: colors.accent,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  tvScreenShareButton: {
    backgroundColor: '#9333EA',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  tvTesterButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  tvSyncButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  tvLogoutButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  tvButtonText: {
    color: colors.card,
    fontSize: 22,
    fontWeight: '700',
  },
  tvFooter: {
    backgroundColor: colors.highlight,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  tvFooterText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '500',
  },
});
