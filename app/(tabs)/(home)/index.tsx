
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, Alert, Platform, ScrollView, Animated, Image } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import { sendDeviceStatus, fetchDisplayContent, DisplayConnectResponse } from '@/utils/apiService';
import { colors } from '@/styles/commonStyles';
import { Redirect, useFocusEffect } from 'expo-router';
import ContentPlayer from '@/components/ContentPlayer';
import ScreenShareReceiver from '@/components/ScreenShareReceiver';
import { isTV } from '@/utils/deviceUtils';
import { LinearGradient } from 'expo-linear-gradient';

export default function HomeScreen() {
  const { isAuthenticated, screenName, username, password, deviceId, logout, setScreenActive } = useAuth();
  const networkState = useNetworkState();
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'success' | 'failed' | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isScreenShareMode, setIsScreenShareMode] = useState(false);
  const [displayContent, setDisplayContent] = useState<DisplayConnectResponse | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [focusedButton, setFocusedButton] = useState<string | null>(null);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const statusGlowAnim = useRef(new Animated.Value(0)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;

  const isTVDevice = isTV();

  // Pulse animation for status indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Glow animation for status
  useEffect(() => {
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(statusGlowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(statusGlowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    );
    glow.start();
    return () => glow.stop();
  }, []);

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeInAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

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
  const statusColor = isOnline ? '#10B981' : '#EF4444';
  const isWebPlatform = Platform.OS === 'web';

  const glowColor = statusGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.6)'],
  });

  // TV Layout - Professional design with focus states
  if (isTVDevice) {
    return (
      <Animated.View style={[styles.tvContainer, { opacity: fadeInAnim }]}>
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#334155']}
          style={styles.tvGradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Logo and Status Header */}
          <View style={styles.tvHeader}>
            <Image
              source={require('@/assets/images/e7d83a94-28be-4159-800f-98c51daa0f57.png')}
              style={styles.tvHeaderLogo}
              resizeMode="contain"
            />
            
            <Animated.View style={[styles.tvStatusBanner, { shadowColor: glowColor }]}>
              <LinearGradient
                colors={isOnline ? ['#10B981', '#059669', '#047857'] : ['#EF4444', '#DC2626', '#B91C1C']}
                style={styles.tvStatusGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.tvStatusContent}>
                  <Animated.View style={[styles.tvStatusDot, { transform: [{ scale: pulseAnim }], backgroundColor: '#FFFFFF' }]} />
                  <View style={styles.tvStatusTextContainer}>
                    <Text style={styles.tvStatusLabel}>SCREEN STATUS</Text>
                    <Text style={styles.tvStatusName}>{screenName}</Text>
                  </View>
                  <View style={styles.tvStatusBadge}>
                    <Text style={styles.tvStatusBadgeText}>
                      {isOnline ? '● ONLINE' : '● OFFLINE'}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          </View>

          <View style={styles.tvMainContent}>
            {/* Left Column - Info Cards */}
            <View style={styles.tvLeftColumn}>
              <View style={styles.tvInfoCard}>
                <LinearGradient
                  colors={['#1E293B', '#334155']}
                  style={styles.tvCardGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                >
                  <Text style={styles.tvCardTitle}>Display Information</Text>
                  
                  <View style={styles.tvInfoItem}>
                    <Text style={styles.tvInfoItemLabel}>Username</Text>
                    <Text style={styles.tvInfoItemValue}>{username}</Text>
                  </View>

                  <View style={styles.tvInfoItem}>
                    <Text style={styles.tvInfoItemLabel}>Screen Name</Text>
                    <Text style={styles.tvInfoItemValue}>{screenName}</Text>
                  </View>
                  
                  <View style={styles.tvInfoItem}>
                    <Text style={styles.tvInfoItemLabel}>Device ID</Text>
                    <Text style={styles.tvInfoItemValue} numberOfLines={1} ellipsizeMode="middle">
                      {deviceId}
                    </Text>
                  </View>

                  {lastSyncTime && (
                    <View style={styles.tvInfoItem}>
                      <Text style={styles.tvInfoItemLabel}>Last Sync</Text>
                      <Text style={styles.tvInfoItemValue}>
                        {lastSyncTime.toLocaleTimeString()}
                      </Text>
                    </View>
                  )}

                  {syncStatus && (
                    <View style={styles.tvInfoItem}>
                      <Text style={styles.tvInfoItemLabel}>Sync Status</Text>
                      <Text style={[
                        styles.tvInfoItemValue,
                        { color: syncStatus === 'success' ? '#10B981' : '#EF4444' }
                      ]}>
                        {syncStatus === 'success' ? '✓ Success' : '✗ Failed'}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </View>
            </View>

            {/* Right Column - Action Buttons */}
            <View style={styles.tvRightColumn}>
              <TouchableOpacity 
                style={[
                  styles.tvButton,
                  focusedButton === 'preview' && styles.tvButtonFocused
                ]}
                onPress={handlePreview}
                onFocus={() => setFocusedButton('preview')}
                onBlur={() => setFocusedButton(null)}
                activeOpacity={0.9}
                disabled={isLoadingPreview}
              >
                <LinearGradient
                  colors={focusedButton === 'preview' ? ['#3B82F6', '#2563EB', '#1D4ED8'] : ['#2563EB', '#1E40AF', '#1E3A8A']}
                  style={styles.tvButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isLoadingPreview ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <React.Fragment>
                      <Text style={styles.tvButtonIcon}>🎬</Text>
                      <Text style={styles.tvButtonText}>Preview Content</Text>
                    </React.Fragment>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {!isWebPlatform && (
                <TouchableOpacity 
                  style={[
                    styles.tvButton,
                    focusedButton === 'screenshare' && styles.tvButtonFocused
                  ]}
                  onPress={handleScreenShare}
                  onFocus={() => setFocusedButton('screenshare')}
                  onBlur={() => setFocusedButton(null)}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={focusedButton === 'screenshare' ? ['#A855F7', '#9333EA', '#7E22CE'] : ['#9333EA', '#7E22CE', '#6B21A8']}
                    style={styles.tvButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.tvButtonIcon}>📺</Text>
                    <Text style={styles.tvButtonText}>Screen Share</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[
                  styles.tvButton,
                  focusedButton === 'sync' && styles.tvButtonFocused
                ]}
                onPress={handleManualSync}
                onFocus={() => setFocusedButton('sync')}
                onBlur={() => setFocusedButton(null)}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={focusedButton === 'sync' ? ['#10B981', '#059669', '#047857'] : ['#059669', '#047857', '#065F46']}
                  style={styles.tvButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.tvButtonIcon}>🔄</Text>
                  <Text style={styles.tvButtonText}>Sync Status</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.tvButton,
                  focusedButton === 'logout' && styles.tvButtonFocused
                ]}
                onPress={handleLogout}
                onFocus={() => setFocusedButton('logout')}
                onBlur={() => setFocusedButton(null)}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={focusedButton === 'logout' ? ['#EF4444', '#DC2626', '#B91C1C'] : ['#DC2626', '#B91C1C', '#991B1B']}
                  style={styles.tvButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.tvButtonIcon}>🚪</Text>
                  <Text style={styles.tvButtonText}>Logout</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.tvFooter}>
            <Text style={styles.tvFooterText}>
              ℹ️ Status updates sent every 1 minute • Updates only when on this screen
            </Text>
          </View>
        </LinearGradient>

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
          <Modal
            visible={isScreenShareMode}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={handleCloseScreenShare}
          >
            <ScreenShareReceiver onClose={handleCloseScreenShare} />
          </Modal>
        )}
      </Animated.View>
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
          <Image
            source={require('@/assets/images/e7d83a94-28be-4159-800f-98c51daa0f57.png')}
            style={styles.mobileLogo}
            resizeMode="contain"
          />
          
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
            <TouchableOpacity 
              style={styles.screenShareButton}
              onPress={handleScreenShare}
              activeOpacity={0.7}
            >
              <Text style={styles.screenShareButtonText}>📺 Screen Share</Text>
            </TouchableOpacity>
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
        <Modal
          visible={isScreenShareMode}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={handleCloseScreenShare}
        >
          <ScreenShareReceiver onClose={handleCloseScreenShare} />
        </Modal>
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
  mobileLogo: {
    width: 200,
    height: 80,
    marginBottom: 32,
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

  // TV styles - Professional design
  tvContainer: {
    flex: 1,
  },
  tvGradientBackground: {
    flex: 1,
    paddingHorizontal: 60,
    paddingVertical: 40,
  },
  tvHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  tvHeaderLogo: {
    width: 300,
    height: 100,
    marginBottom: 24,
  },
  tvStatusBanner: {
    width: '100%',
    maxWidth: 1200,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  tvStatusGradient: {
    paddingVertical: 24,
    paddingHorizontal: 40,
  },
  tvStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tvStatusDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 20,
  },
  tvStatusTextContainer: {
    flex: 1,
  },
  tvStatusLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 2,
    marginBottom: 4,
  },
  tvStatusName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  tvStatusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  tvStatusBadgeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  tvMainContent: {
    flex: 1,
    flexDirection: 'row',
    gap: 40,
    marginTop: 20,
  },
  tvLeftColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  tvRightColumn: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  tvInfoCard: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  tvCardGradient: {
    padding: 32,
  },
  tvCardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
    letterSpacing: 1,
  },
  tvInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tvInfoItemLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    flex: 1,
  },
  tvInfoItemValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 2,
    textAlign: 'right',
  },
  tvButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tvButtonFocused: {
    elevation: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    transform: [{ scale: 1.05 }],
  },
  tvButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 32,
    gap: 16,
  },
  tvButtonIcon: {
    fontSize: 28,
  },
  tvButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  tvFooter: {
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    alignItems: 'center',
  },
  tvFooterText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontWeight: '500',
  },
});
