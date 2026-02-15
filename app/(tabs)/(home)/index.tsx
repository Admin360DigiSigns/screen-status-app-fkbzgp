
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, Alert, Platform, ScrollView, Animated, Image } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import { sendDeviceStatus, fetchDisplayContent, DisplayConnectResponse } from '@/utils/apiService';
import { colors } from '@/styles/commonStyles';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import ContentPlayer from '@/components/ContentPlayer';
import ScreenShareReceiver from '@/components/ScreenShareReceiver';
import { isTV } from '@/utils/deviceUtils';
import { LinearGradient } from 'expo-linear-gradient';
import { commandListener, AppCommand } from '@/utils/commandListener';

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
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'success' | 'failed' | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [focusedButton, setFocusedButton] = useState<string | null>(null);
  const [commandListenerStatus, setCommandListenerStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

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

  // Update command listener status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const status = commandListener.getConnectionStatus();
      setCommandListenerStatus(status);
    }, 1000);

    return () => clearInterval(interval);
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
  const statusColor = isOnline ? '#10B981' : '#EF4444';
  const isWebPlatform = Platform.OS === 'web';

  const glowColor = statusGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.6)'],
  });

  const getCommandListenerStatusColor = () => {
    switch (commandListenerStatus) {
      case 'connected':
        return '#10B981';
      case 'connecting':
        return '#F59E0B';
      case 'disconnected':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getCommandListenerStatusText = () => {
    switch (commandListenerStatus) {
      case 'connected':
        return '● Connected';
      case 'connecting':
        return '● Connecting...';
      case 'disconnected':
        return '● Disconnected';
      default:
        return '● Unknown';
    }
  };

  // TV Layout - Centered design matching the image
  if (isTVDevice) {
    const lastSyncFormatted = lastSyncTime ? lastSyncTime.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    }) : '';
    const syncStatusText = syncStatus === 'success' ? 'Synced' : 'Failed';

    return (
      <Animated.View style={[styles.tvContainer, { opacity: fadeInAnim }]}>
        <LinearGradient
          colors={['#E0E7FF', '#C7D2FE', '#A5B4FC', '#818CF8']}
          style={styles.tvGradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <ScrollView 
            contentContainerStyle={styles.tvScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <View style={styles.tvLogoContainer}>
              <Image
                source={require('@/assets/images/e7d83a94-28be-4159-800f-98c51daa0f57.png')}
                style={styles.tvLogo}
                resizeMode="contain"
              />
            </View>

            {/* Status Banner */}
            <View style={styles.tvStatusRow}>
              <View style={styles.tvStatusItem}>
                <Text style={styles.tvStatusItemLabel}>Remote Commands</Text>
                <View style={styles.tvStatusBadge}>
                  <View style={[styles.tvStatusDot, { backgroundColor: getCommandListenerStatusColor() }]} />
                  <Text style={[styles.tvStatusBadgeText, { color: getCommandListenerStatusColor() }]}>
                    {commandListenerStatus === 'connected' ? 'Connected' : commandListenerStatus === 'connecting' ? 'Connecting' : 'Disconnected'}
                  </Text>
                </View>
              </View>

              <View style={styles.tvStatusItem}>
                <Text style={styles.tvStatusItemLabel}>{screenName}</Text>
                <View style={[styles.tvStatusBadge, { backgroundColor: isOnline ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Text style={[styles.tvStatusBadgeText, { color: isOnline ? '#10B981' : '#EF4444' }]}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Main Content - Two Column Layout */}
            <View style={styles.tvMainLayout}>
              {/* Left Column - Display Information */}
              <View style={styles.tvLeftColumn}>
                <View style={styles.tvCard}>
                  <View style={styles.tvCardHeader}>
                    <LinearGradient
                      colors={['#3B82F6', '#1E40AF', '#1E3A8A']}
                      style={styles.tvCardHeaderLine}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                    />
                    <Text style={styles.tvCardTitle}>DISPLAY INFORMATION</Text>
                  </View>

                  <View style={styles.tvInfoRow}>
                    <Text style={styles.tvInfoLabel}>Username</Text>
                    <Text style={styles.tvInfoValue}>{username}</Text>
                  </View>

                  <View style={styles.tvInfoRow}>
                    <Text style={styles.tvInfoLabel}>Screen Name</Text>
                    <Text style={styles.tvInfoValue}>{screenName}</Text>
                  </View>

                  <View style={styles.tvInfoRow}>
                    <Text style={styles.tvInfoLabel}>Device ID</Text>
                    <Text style={styles.tvInfoValue} numberOfLines={1} ellipsizeMode="middle">
                      {deviceId}
                    </Text>
                  </View>

                  <View style={styles.tvInfoRow}>
                    <Text style={styles.tvInfoLabel}>Last Sync</Text>
                    <Text style={styles.tvInfoValue}>{lastSyncFormatted}</Text>
                  </View>

                  <View style={styles.tvInfoRow}>
                    <Text style={styles.tvInfoLabel}>Sync Status</Text>
                    <View style={styles.tvSyncStatusBadge}>
                      <Text style={styles.tvSyncStatusIcon}>✓</Text>
                      <Text style={styles.tvSyncStatusText}>{syncStatusText}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Right Column - Quick Actions */}
              <View style={styles.tvRightColumn}>
                <View style={styles.tvCard}>
                  <View style={styles.tvCardHeader}>
                    <LinearGradient
                      colors={['#3B82F6', '#1E40AF', '#1E3A8A']}
                      style={styles.tvCardHeaderLine}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                    />
                    <Text style={styles.tvCardTitle}>QUICK ACTIONS</Text>
                  </View>

                  <TouchableOpacity 
                    style={[
                      styles.tvActionButton,
                      focusedButton === 'preview' && styles.tvActionButtonFocused
                    ]}
                    onPress={handlePreview}
                    onFocus={() => setFocusedButton('preview')}
                    onBlur={() => setFocusedButton(null)}
                    activeOpacity={0.8}
                    disabled={isLoadingPreview}
                  >
                    {isLoadingPreview ? (
                      <ActivityIndicator size="small" color="#3B82F6" />
                    ) : (
                      <React.Fragment>
                        <Text style={styles.tvActionIcon}>👁️</Text>
                        <LinearGradient
                          colors={['#3B82F6', '#1E40AF']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.tvActionTextGradient}
                        >
                          <Text style={styles.tvActionText}>Preview Content</Text>
                        </LinearGradient>
                      </React.Fragment>
                    )}
                  </TouchableOpacity>

                  {!isWebPlatform && (
                    <TouchableOpacity 
                      style={[
                        styles.tvActionButton,
                        focusedButton === 'screenshare' && styles.tvActionButtonFocused
                      ]}
                      onPress={handleScreenShare}
                      onFocus={() => setFocusedButton('screenshare')}
                      onBlur={() => setFocusedButton(null)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.tvActionIcon}>🔗</Text>
                      <LinearGradient
                        colors={['#3B82F6', '#1E40AF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.tvActionTextGradient}
                      >
                        <Text style={styles.tvActionText}>Screen Share</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity 
                    style={[
                      styles.tvActionButton,
                      focusedButton === 'sync' && styles.tvActionButtonFocused
                    ]}
                    onPress={handleManualSync}
                    onFocus={() => setFocusedButton('sync')}
                    onBlur={() => setFocusedButton(null)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.tvActionIcon}>🔄</Text>
                    <LinearGradient
                      colors={['#3B82F6', '#1E40AF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.tvActionTextGradient}
                    >
                      <Text style={styles.tvActionText}>Sync Status</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[
                      styles.tvActionButton,
                      focusedButton === 'logout' && styles.tvActionButtonFocused
                    ]}
                    onPress={handleLogout}
                    onFocus={() => setFocusedButton('logout')}
                    onBlur={() => setFocusedButton(null)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.tvActionIcon}>🚪</Text>
                    <LinearGradient
                      colors={['#3B82F6', '#1E40AF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.tvActionTextGradient}
                    >
                      <Text style={styles.tvActionText}>Logout</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.tvFooter}>
              <Text style={styles.tvFooterText}>Status updates every 20s</Text>
              <Text style={styles.tvFooterText}>Remote commands enabled</Text>
              <Text style={styles.tvFooterText}>Updates only on this screen</Text>
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
                <Text style={[styles.errorText, { fontSize: 18 * tvScale }]}>No content available</Text>
                <TouchableOpacity style={styles.logoutButton} onPress={handleClosePreview}>
                  <Text style={[styles.logoutButtonText, { fontSize: 18 * tvScale }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Modal>

        {/* Screen Share Modal - Only render on native platforms */}
        {!isWebPlatform && (
          <Modal
            visible={showScreenShareModal}
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

  return (
    <Animated.View style={[styles.mobileContainer, { opacity: fadeInAnim }]}>
      <LinearGradient
        colors={['#E0E7FF', '#C7D2FE', '#A5B4FC', '#818CF8']}
        style={styles.mobileGradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.mobileScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mobileContent}>
            {/* Logo */}
            <View style={styles.mobileLogoContainer}>
              <Image
                source={require('@/assets/images/e7d83a94-28be-4159-800f-98c51daa0f57.png')}
                style={styles.mobileLogo}
                resizeMode="contain"
              />
            </View>

            {/* Status Banner */}
            <View style={styles.mobileStatusRow}>
              <View style={styles.mobileStatusItem}>
                <Text style={styles.mobileStatusItemLabel}>Remote Commands</Text>
                <View style={styles.mobileStatusBadge}>
                  <View style={[styles.mobileStatusDot, { backgroundColor: getCommandListenerStatusColor() }]} />
                  <Text style={[styles.mobileStatusBadgeText, { color: getCommandListenerStatusColor() }]}>
                    {commandListenerStatus === 'connected' ? 'Connected' : commandListenerStatus === 'connecting' ? 'Connecting' : 'Disconnected'}
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

              <TouchableOpacity 
                style={styles.mobileActionButton}
                onPress={handlePreview}
                activeOpacity={0.8}
                disabled={isLoadingPreview}
              >
                {isLoadingPreview ? (
                  <ActivityIndicator size="small" color="#3B82F6" />
                ) : (
                  <React.Fragment>
                    <Text style={styles.mobileActionIcon}>👁️</Text>
                    <LinearGradient
                      colors={['#3B82F6', '#1E40AF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.mobileActionTextGradient}
                    >
                      <Text style={styles.mobileActionText}>Preview Content</Text>
                    </LinearGradient>
                  </React.Fragment>
                )}
              </TouchableOpacity>

              {!isWebPlatform && (
                <TouchableOpacity 
                  style={styles.mobileActionButton}
                  onPress={handleScreenShare}
                  activeOpacity={0.8}
                >
                  <Text style={styles.mobileActionIcon}>🔗</Text>
                  <LinearGradient
                    colors={['#3B82F6', '#1E40AF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.mobileActionTextGradient}
                  >
                    <Text style={styles.mobileActionText}>Screen Share</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={styles.mobileActionButton}
                onPress={handleManualSync}
                activeOpacity={0.8}
              >
                <Text style={styles.mobileActionIcon}>🔄</Text>
                <LinearGradient
                  colors={['#3B82F6', '#1E40AF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.mobileActionTextGradient}
                >
                  <Text style={styles.mobileActionText}>Sync Status</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.mobileActionButton}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.mobileActionIcon}>🚪</Text>
                <LinearGradient
                  colors={['#3B82F6', '#1E40AF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.mobileActionTextGradient}
                >
                  <Text style={styles.mobileActionText}>Logout</Text>
                </LinearGradient>
              </TouchableOpacity>
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

      {/* Screen Share Modal - Only render on native platforms */}
      {!isWebPlatform && (
        <Modal
          visible={showScreenShareModal}
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  mobileActionIcon: {
    fontSize: 20,
  },
  mobileActionTextGradient: {
    borderRadius: 4,
  },
  mobileActionText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
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

  // TV styles - Clean centered design
  tvContainer: {
    flex: 1,
  },
  tvGradientBackground: {
    flex: 1,
  },
  tvScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 60,
    paddingVertical: 40,
    alignItems: 'center',
  },
  tvLogoContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  tvLogo: {
    width: 300,
    height: 100,
  },
  tvStatusRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 1200,
    marginBottom: 40,
    gap: 40,
  },
  tvStatusItem: {
    alignItems: 'center',
  },
  tvStatusItemLabel: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 12,
    fontWeight: '600',
  },
  tvStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
  },
  tvStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tvStatusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tvMainLayout: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 1200,
    gap: 40,
    marginBottom: 40,
  },
  tvLeftColumn: {
    flex: 1,
  },
  tvRightColumn: {
    flex: 1,
  },
  tvCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  tvCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    gap: 16,
  },
  tvCardHeaderLine: {
    width: 5,
    height: 24,
    borderRadius: 3,
  },
  tvCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 0.8,
  },
  tvInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tvInfoLabel: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  tvInfoValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  tvSyncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  tvSyncStatusIcon: {
    fontSize: 14,
    color: '#10B981',
  },
  tvSyncStatusText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  tvActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 16,
  },
  tvActionButtonFocused: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  tvActionIcon: {
    fontSize: 24,
  },
  tvActionTextGradient: {
    borderRadius: 6,
  },
  tvActionText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tvFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 1200,
    paddingVertical: 20,
    paddingHorizontal: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 16,
  },
  tvFooterText: {
    fontSize: 13,
    color: '#1F2937',
    textAlign: 'center',
    fontWeight: '600',
  },
});
