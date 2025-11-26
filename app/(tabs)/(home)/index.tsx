
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
import { BlurView } from 'expo-blur';

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
  const logoGlowAnim = useRef(new Animated.Value(0)).current;
  const logoScaleAnim = useRef(new Animated.Value(1)).current;
  const buttonScaleAnims = useRef({
    preview: new Animated.Value(1),
    screenshare: new Animated.Value(1),
    sync: new Animated.Value(1),
    logout: new Animated.Value(1),
  }).current;

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

  // Logo glow animation
  useEffect(() => {
    const logoGlow = Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlowAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(logoGlowAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    );
    logoGlow.start();
    return () => logoGlow.stop();
  }, []);

  // Logo scale animation
  useEffect(() => {
    const logoScale = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScaleAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(logoScaleAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    logoScale.start();
    return () => logoScale.stop();
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

  const logoGlowColor = logoGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(59, 130, 246, 0.3)', 'rgba(168, 85, 247, 0.6)'],
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
            {/* Logo with glow effect */}
            <Animated.View style={[styles.tvLogoContainer, { shadowColor: logoGlowColor }]}>
              <View style={styles.tvLogoGlowWrapper}>
                <Animated.View style={[styles.tvLogoGlow, { backgroundColor: logoGlowColor }]} />
                <Animated.View style={[styles.tvLogoGlow2, { backgroundColor: logoGlowColor, opacity: 0.5 }]} />
              </View>
              <Animated.Image
                source={require('@/assets/images/0bd1582e-6ccf-4e31-967e-71dccf6a0b14.png')}
                style={[styles.tvHeaderLogo, { transform: [{ scale: logoScaleAnim }] }]}
                resizeMode="contain"
              />
            </Animated.View>
            
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

  // Mobile Layout - Professional design with gradients and animations
  return (
    <Animated.View style={[styles.mobileContainer, { opacity: fadeInAnim }]}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155']}
        style={styles.mobileGradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.mobileScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mobileContent}>
            {/* Logo with glow effect */}
            <Animated.View style={[styles.mobileLogoContainer, { shadowColor: logoGlowColor }]}>
              <View style={styles.mobileLogoGlowWrapper}>
                <Animated.View style={[styles.mobileLogoGlow, { backgroundColor: logoGlowColor }]} />
                <Animated.View style={[styles.mobileLogoGlow2, { backgroundColor: logoGlowColor, opacity: 0.5 }]} />
              </View>
              <Animated.Image
                source={require('@/assets/images/0bd1582e-6ccf-4e31-967e-71dccf6a0b14.png')}
                style={[styles.mobileLogo, { transform: [{ scale: logoScaleAnim }] }]}
                resizeMode="contain"
              />
            </Animated.View>
            
            {/* Status Banner */}
            <Animated.View style={[styles.mobileStatusBanner, { shadowColor: glowColor }]}>
              <LinearGradient
                colors={isOnline ? ['#10B981', '#059669', '#047857'] : ['#EF4444', '#DC2626', '#B91C1C']}
                style={styles.mobileStatusGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.mobileStatusContent}>
                  <Animated.View style={[styles.mobileStatusDot, { transform: [{ scale: pulseAnim }] }]} />
                  <View style={styles.mobileStatusTextContainer}>
                    <Text style={styles.mobileStatusLabel}>SCREEN STATUS</Text>
                    <Text style={styles.mobileStatusName}>{screenName}</Text>
                  </View>
                </View>
                <View style={styles.mobileStatusBadge}>
                  <Text style={styles.mobileStatusBadgeText}>
                    {isOnline ? '● ONLINE' : '● OFFLINE'}
                  </Text>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Info Card */}
            <View style={styles.mobileInfoCard}>
              <LinearGradient
                colors={['#1E293B', '#334155']}
                style={styles.mobileCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                <Text style={styles.mobileCardTitle}>Display Information</Text>
                
                <View style={styles.mobileInfoItem}>
                  <Text style={styles.mobileInfoItemLabel}>Username</Text>
                  <Text style={styles.mobileInfoItemValue}>{username}</Text>
                </View>

                <View style={styles.mobileInfoItem}>
                  <Text style={styles.mobileInfoItemLabel}>Screen Name</Text>
                  <Text style={styles.mobileInfoItemValue}>{screenName}</Text>
                </View>
                
                <View style={styles.mobileInfoItem}>
                  <Text style={styles.mobileInfoItemLabel}>Device ID</Text>
                  <Text style={styles.mobileInfoItemValue} numberOfLines={1} ellipsizeMode="middle">
                    {deviceId}
                  </Text>
                </View>

                {lastSyncTime && (
                  <View style={styles.mobileInfoItem}>
                    <Text style={styles.mobileInfoItemLabel}>Last Sync</Text>
                    <Text style={styles.mobileInfoItemValue}>
                      {lastSyncTime.toLocaleTimeString()}
                    </Text>
                  </View>
                )}

                {syncStatus && (
                  <View style={styles.mobileInfoItem}>
                    <Text style={styles.mobileInfoItemLabel}>Sync Status</Text>
                    <Text style={[
                      styles.mobileInfoItemValue,
                      { color: syncStatus === 'success' ? '#10B981' : '#EF4444' }
                    ]}>
                      {syncStatus === 'success' ? '✓ Success' : '✗ Failed'}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </View>

            {/* Action Buttons */}
            <Animated.View style={{ transform: [{ scale: buttonScaleAnims.preview }] }}>
              <TouchableOpacity 
                style={styles.mobileButton}
                onPress={() => {
                  animateButtonPress('preview');
                  handlePreview();
                }}
                activeOpacity={0.9}
                disabled={isLoadingPreview}
              >
                <LinearGradient
                  colors={['#2563EB', '#1E40AF', '#1E3A8A']}
                  style={styles.mobileButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isLoadingPreview ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <React.Fragment>
                      <Text style={styles.mobileButtonIcon}>🎬</Text>
                      <Text style={styles.mobileButtonText}>Preview Content</Text>
                    </React.Fragment>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {!isWebPlatform && (
              <Animated.View style={{ transform: [{ scale: buttonScaleAnims.screenshare }] }}>
                <TouchableOpacity 
                  style={styles.mobileButton}
                  onPress={() => {
                    animateButtonPress('screenshare');
                    handleScreenShare();
                  }}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={['#9333EA', '#7E22CE', '#6B21A8']}
                    style={styles.mobileButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.mobileButtonIcon}>📺</Text>
                    <Text style={styles.mobileButtonText}>Screen Share</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}

            <Animated.View style={{ transform: [{ scale: buttonScaleAnims.sync }] }}>
              <TouchableOpacity 
                style={styles.mobileButton}
                onPress={() => {
                  animateButtonPress('sync');
                  handleManualSync();
                }}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#059669', '#047857', '#065F46']}
                  style={styles.mobileButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.mobileButtonIcon}>🔄</Text>
                  <Text style={styles.mobileButtonText}>Sync Status</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: buttonScaleAnims.logout }] }}>
              <TouchableOpacity 
                style={styles.mobileButton}
                onPress={() => {
                  animateButtonPress('logout');
                  handleLogout();
                }}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#DC2626', '#B91C1C', '#991B1B']}
                  style={styles.mobileButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.mobileButtonIcon}>🚪</Text>
                  <Text style={styles.mobileButtonText}>Logout</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Footer Info */}
            <View style={styles.mobileFooter}>
              <Text style={styles.mobileFooterText}>
                ℹ️ Status updates sent every 1 minute
              </Text>
              <Text style={styles.mobileFooterText}>
                Updates only when on this screen
              </Text>
              {isWebPlatform && (
                <Text style={[styles.mobileFooterText, { color: '#EF4444', marginTop: 8 }]}>
                  ⚠️ Screen Share only available on mobile devices
                </Text>
              )}
            </View>
          </View>
        </ScrollView>
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
    fontSize: 16,
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
    fontSize: 18,
    fontWeight: '600',
  },

  // Mobile styles - Professional design
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
    paddingTop: 60,
  },
  mobileLogoContainer: {
    position: 'relative',
    marginBottom: 24,
    elevation: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  mobileLogoGlowWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileLogoGlow: {
    position: 'absolute',
    width: 240,
    height: 100,
    borderRadius: 50,
    opacity: 0.4,
  },
  mobileLogoGlow2: {
    position: 'absolute',
    width: 280,
    height: 120,
    borderRadius: 60,
    opacity: 0.2,
  },
  mobileLogo: {
    width: 220,
    height: 80,
  },
  mobileStatusBanner: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  mobileStatusGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  mobileStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mobileStatusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginRight: 12,
  },
  mobileStatusTextContainer: {
    flex: 1,
  },
  mobileStatusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  mobileStatusName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  mobileStatusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  mobileStatusBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  mobileInfoCard: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  mobileCardGradient: {
    padding: 20,
  },
  mobileCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  mobileInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  mobileInfoItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    flex: 1,
  },
  mobileInfoItemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 2,
    textAlign: 'right',
  },
  mobileButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  mobileButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  mobileButtonIcon: {
    fontSize: 20,
  },
  mobileButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  mobileFooter: {
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    width: '100%',
  },
  mobileFooterText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    paddingVertical: 2,
    fontWeight: '500',
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
  tvLogoContainer: {
    position: 'relative',
    marginBottom: 24,
    elevation: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 30,
  },
  tvLogoGlowWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tvLogoGlow: {
    position: 'absolute',
    width: 350,
    height: 120,
    borderRadius: 60,
    opacity: 0.5,
  },
  tvLogoGlow2: {
    position: 'absolute',
    width: 420,
    height: 150,
    borderRadius: 75,
    opacity: 0.3,
  },
  tvHeaderLogo: {
    width: 300,
    height: 100,
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
