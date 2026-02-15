
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, Alert, ScrollView, Animated, Image } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import { sendDeviceStatus, fetchDisplayContent, DisplayConnectResponse } from '@/utils/apiService';
import { colors } from '@/styles/commonStyles';
import { Redirect, useFocusEffect } from 'expo-router';
import ContentPlayer from '@/components/ContentPlayer';
import ScreenShareReceiver from '@/components/ScreenShareReceiver';
import { isTV } from '@/utils/deviceUtils';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { IconSymbol } from '@/components/IconSymbol';

export default function HomeScreen() {
  const { 
    isAuthenticated, 
    screenName, 
    username, 
    password, 
    deviceId, 
    logout, 
    setScreenActive,
    showPreviewModal,
    setShowPreviewModal,
    showScreenShareModal,
    setShowScreenShareModal,
    displayContent,
    setDisplayContent,
  } = useAuth();
  const networkState = useNetworkState();
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'success' | 'failed' | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [focusedButton, setFocusedButton] = useState<string | null>(null);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const statusGlowAnim = useRef(new Animated.Value(0)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnims = useRef({
    preview: new Animated.Value(1),
    screenshare: new Animated.Value(1),
    sync: new Animated.Value(1),
    logout: new Animated.Value(1),
  }).current;

  const isTVDevice = isTV();

  // TV-specific scaling factor to make content smaller
  const tvScale = isTVDevice ? 0.75 : 1;

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
    console.log('User tapped Logout button');
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
    console.log('User tapped Sync Status button');
    syncDeviceStatus();
  };

  const handlePreview = async () => {
    console.log('User tapped Preview Content button');
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
        setShowPreviewModal(true);
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
    setShowPreviewModal(false);
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
    setShowScreenShareModal(true);
  };

  const handleCloseScreenShare = () => {
    console.log('Closing screen share receiver');
    setShowScreenShareModal(false);
  };

  const animateButtonPress = (buttonKey: keyof typeof buttonScaleAnims) => {
    Animated.sequence([
      Animated.timing(buttonScaleAnims[buttonKey], {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnims[buttonKey], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { fontSize: 16 * tvScale }]}>Initializing device...</Text>
      </View>
    );
  }

  const isOnline = networkState.isConnected === true;

  const glowColor = statusGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.6)'],
  });

  // Mobile Layout - Centered design matching the image
  const lastSyncFormatted = lastSyncTime ? lastSyncTime.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true 
  }) : '';
  const syncStatusText = syncStatus === 'success' ? 'Synced' : 'Failed';
  const commandStatusText = 'Connected';

  return (
    <Animated.View style={[styles.mobileContainer, { opacity: fadeInAnim }]}>
      <LinearGradient
        colors={['#FFFFFF', '#F0F4FF', '#E0E7FF', '#C7D2FE']}
        style={styles.mobileGradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.mobileScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mobileContent}>
            {/* Logo */}
            <View style={styles.mobileLogoContainer}>
              <Image
                source={require('@/assets/images/54af2979-8ebd-4f8d-bb57-064336e72cf5.png')}
                style={styles.mobileLogo}
                resizeMode="contain"
              />
            </View>

            {/* Status Banner */}
            <View style={styles.mobileStatusRow}>
              <View style={styles.mobileStatusItem}>
                <Text style={styles.mobileStatusItemLabel}>Remote Commands</Text>
                <View style={styles.mobileStatusBadge}>
                  <View style={[styles.mobileStatusDot, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.mobileStatusBadgeText, { color: '#10B981' }]}>
                    {commandStatusText}
                  </Text>
                </View>
              </View>

              <View style={styles.mobileStatusItem}>
                <Text style={styles.mobileStatusItemLabel}>{screenName}</Text>
                <View style={[styles.mobileStatusBadge, { backgroundColor: isOnline ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Text style={[styles.mobileStatusBadgeText, { color: isOnline ? '#10B981' : '#EF4444' }]}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Display Information Card */}
            <View style={styles.mobileCard}>
              <View style={styles.mobileCardHeader}>
                <LinearGradient
                  colors={['#3B82F6', '#1E40AF', '#1E3A8A']}
                  style={styles.mobileCardHeaderLine}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
                <Text style={styles.mobileCardTitle}>DISPLAY INFORMATION</Text>
              </View>

              <View style={styles.mobileInfoRow}>
                <Text style={styles.mobileInfoLabel}>Username</Text>
                <Text style={styles.mobileInfoValue}>{username}</Text>
              </View>

              <View style={styles.mobileInfoRow}>
                <Text style={styles.mobileInfoLabel}>Screen Name</Text>
                <Text style={styles.mobileInfoValue}>{screenName}</Text>
              </View>

              <View style={styles.mobileInfoRow}>
                <Text style={styles.mobileInfoLabel}>Device ID</Text>
                <Text style={styles.mobileInfoValue} numberOfLines={1} ellipsizeMode="middle">
                  {deviceId}
                </Text>
              </View>

              <View style={styles.mobileInfoRow}>
                <Text style={styles.mobileInfoLabel}>Last Sync</Text>
                <Text style={styles.mobileInfoValue}>{lastSyncFormatted}</Text>
              </View>

              <View style={styles.mobileInfoRow}>
                <Text style={styles.mobileInfoLabel}>Sync Status</Text>
                <View style={styles.mobileSyncStatusBadge}>
                  <Text style={styles.mobileSyncStatusIcon}>✓</Text>
                  <Text style={styles.mobileSyncStatusText}>{syncStatusText}</Text>
                </View>
              </View>
            </View>

            {/* Quick Actions Card */}
            <View style={styles.mobileCard}>
              <View style={styles.mobileCardHeader}>
                <LinearGradient
                  colors={['#3B82F6', '#1E40AF', '#1E3A8A']}
                  style={styles.mobileCardHeaderLine}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
                <Text style={styles.mobileCardTitle}>QUICK ACTIONS</Text>
              </View>

              <Animated.View style={{ transform: [{ scale: buttonScaleAnims.preview }] }}>
                <TouchableOpacity 
                  style={styles.mobileActionButton}
                  onPress={() => {
                    animateButtonPress('preview');
                    handlePreview();
                  }}
                  activeOpacity={0.8}
                  disabled={isLoadingPreview}
                >
                  {isLoadingPreview ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    <React.Fragment>
                      <View style={styles.mobileActionIconContainer}>
                        <IconSymbol 
                          ios_icon_name="eye.fill" 
                          android_material_icon_name="visibility" 
                          size={24} 
                          color="#3B82F6" 
                        />
                      </View>
                      <MaskedView
                        maskElement={
                          <Text style={styles.mobileActionText}>Preview Content</Text>
                        }
                      >
                        <LinearGradient
                          colors={['#3B82F6', '#1E40AF']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={[styles.mobileActionText, { opacity: 0 }]}>Preview Content</Text>
                        </LinearGradient>
                      </MaskedView>
                    </React.Fragment>
                  )}
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ transform: [{ scale: buttonScaleAnims.screenshare }] }}>
                <TouchableOpacity 
                  style={styles.mobileActionButton}
                  onPress={() => {
                    animateButtonPress('screenshare');
                    handleScreenShare();
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.mobileActionIconContainer}>
                    <IconSymbol 
                      ios_icon_name="tv" 
                      android_material_icon_name="cast" 
                      size={24} 
                      color="#3B82F6" 
                    />
                  </View>
                  <MaskedView
                    maskElement={
                      <Text style={styles.mobileActionText}>Screen Share</Text>
                    }
                  >
                    <LinearGradient
                      colors={['#3B82F6', '#1E40AF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={[styles.mobileActionText, { opacity: 0 }]}>Screen Share</Text>
                    </LinearGradient>
                  </MaskedView>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ transform: [{ scale: buttonScaleAnims.sync }] }}>
                <TouchableOpacity 
                  style={styles.mobileActionButton}
                  onPress={() => {
                    animateButtonPress('sync');
                    handleManualSync();
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.mobileActionIconContainer}>
                    <IconSymbol 
                      ios_icon_name="arrow.clockwise" 
                      android_material_icon_name="sync" 
                      size={24} 
                      color="#3B82F6" 
                    />
                  </View>
                  <MaskedView
                    maskElement={
                      <Text style={styles.mobileActionText}>Sync Status</Text>
                    }
                  >
                    <LinearGradient
                      colors={['#3B82F6', '#1E40AF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={[styles.mobileActionText, { opacity: 0 }]}>Sync Status</Text>
                    </LinearGradient>
                  </MaskedView>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ transform: [{ scale: buttonScaleAnims.logout }] }}>
                <TouchableOpacity 
                  style={styles.mobileActionButton}
                  onPress={() => {
                    animateButtonPress('logout');
                    handleLogout();
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.mobileActionIconContainer}>
                    <IconSymbol 
                      ios_icon_name="rectangle.portrait.and.arrow.right" 
                      android_material_icon_name="logout" 
                      size={24} 
                      color="#3B82F6" 
                    />
                  </View>
                  <MaskedView
                    maskElement={
                      <Text style={styles.mobileActionText}>Logout</Text>
                    }
                  >
                    <LinearGradient
                      colors={['#3B82F6', '#1E40AF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={[styles.mobileActionText, { opacity: 0 }]}>Logout</Text>
                    </LinearGradient>
                  </MaskedView>
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Footer */}
            <View style={styles.mobileFooter}>
              <Text style={styles.mobileFooterText}>Status updates every 20s</Text>
              <Text style={styles.mobileFooterText}>Remote commands enabled</Text>
              <Text style={styles.mobileFooterText}>Updates only on this screen</Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>

      {/* Preview Modal - Managed by AuthContext */}
      <Modal
        visible={showPreviewModal}
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

      {/* Screen Share Modal */}
      <Modal
        visible={showScreenShareModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseScreenShare}
      >
        <ScreenShareReceiver onClose={handleCloseScreenShare} />
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Common styles
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
    paddingTop: 20,
  },
  loadingText: {
    marginTop: 16,
    color: colors.text,
  },
  errorText: {
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
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
    fontWeight: '600',
  },

  // Mobile styles - Clean centered design
  mobileContainer: {
    flex: 1,
  },
  mobileGradientBackground: {
    flex: 1,
  },
  mobileScrollContent: {
    flexGrow: 1,
    paddingBottom: 140,
  },
  mobileContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  mobileLogoContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  mobileLogo: {
    width: 200,
    height: 70,
  },
  mobileStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  mobileStatusItem: {
    flex: 1,
    alignItems: 'center',
  },
  mobileStatusItemLabel: {
    fontSize: 12,
    color: '#1F2937',
    marginBottom: 8,
    fontWeight: '600',
  },
  mobileStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  mobileStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mobileStatusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mobileCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  mobileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  mobileCardHeaderLine: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  mobileCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 0.5,
  },
  mobileInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  mobileInfoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  mobileInfoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  mobileSyncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  mobileSyncStatusIcon: {
    fontSize: 12,
    color: '#10B981',
  },
  mobileSyncStatusText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  mobileActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 2,
  },
  mobileActionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  mobileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 12,
  },
  mobileFooterText: {
    fontSize: 11,
    color: '#1F2937',
    textAlign: 'center',
    fontWeight: '600',
  },
});
