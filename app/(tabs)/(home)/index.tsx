
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
  const { isAuthenticated, screenName, username, password, deviceId, logout, setScreenActive } = useAuth();
  const networkState = useNetworkState();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'success' | 'failed' | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isScreenShareMode, setIsScreenShareMode] = useState(false);
  const [displayContent, setDisplayContent] = useState<DisplayConnectResponse | null>(null);
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

  // Sync device status - with proper dependencies
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

  // Handle preview - with proper dependencies
  const handlePreview = useCallback(async () => {
    console.log('🎬 Preview button pressed');
    
    if (!username || !password || !screenName) {
      console.error('❌ Missing credentials for preview:', { username: !!username, password: !!password, screenName: !!screenName });
      Alert.alert('Error', 'Missing credentials for preview');
      return;
    }

    setIsLoadingPreview(true);
    console.log('📡 Fetching preview content...');

    try {
      const result = await fetchDisplayContent(username, password, screenName);
      
      if (result.success && result.data) {
        console.log('✅ Preview content loaded successfully');
        setDisplayContent(result.data);
        setIsPreviewMode(true);
      } else {
        console.error('❌ Preview failed:', result.error);
        Alert.alert('Preview Error', result.error || 'Failed to load preview content');
      }
    } catch (error) {
      console.error('❌ Error loading preview:', error);
      Alert.alert('Preview Error', 'An unexpected error occurred');
    } finally {
      setIsLoadingPreview(false);
    }
  }, [username, password, screenName]);

  // Handle screen share - with proper dependencies
  const handleScreenShare = useCallback(() => {
    console.log('🎬 Screen Share button pressed - Opening screen share receiver');
    
    // Verify credentials before opening
    if (!username || !password || !screenName) {
      console.error('❌ Missing credentials for screen share:', { username: !!username, password: !!password, screenName: !!screenName });
      Alert.alert('Error', 'Missing credentials for screen share');
      return;
    }
    
    console.log('✅ Credentials verified, opening screen share modal');
    setIsScreenShareMode(true);
  }, [username, password, screenName]);

  // Handle logout - with proper dependencies
  const handleLogout = useCallback(async () => {
    console.log('🚪 Logout button pressed');
    try {
      // Send offline status before logging out
      if (deviceId && screenName && username && password) {
        console.log('📡 Sending offline status before logout...');
        await sendDeviceStatus({
          deviceId,
          screenName,
          screen_username: username,
          screen_password: password,
          screen_name: screenName,
          status: 'offline',
          timestamp: new Date().toISOString(),
        });
        console.log('✓ Offline status sent');
      }
      
      console.log('🔄 Calling logout function...');
      await logout();
      console.log('✓ Logout function completed');
    } catch (error) {
      console.error('❌ Error during logout:', error);
      // Still logout even if status update fails
      console.log('⚠️ Attempting logout despite error...');
      await logout();
    }
  }, [deviceId, screenName, username, password, logout]);

  // Handle manual sync
  const handleManualSync = useCallback(() => {
    console.log('🔄 Manual sync button pressed');
    syncDeviceStatus();
  }, [syncDeviceStatus]);

  // Handle close preview
  const handleClosePreview = useCallback(() => {
    console.log('Closing preview');
    setIsPreviewMode(false);
    setDisplayContent(null);
  }, []);

  // Handle close screen share
  const handleCloseScreenShare = useCallback(() => {
    console.log('Closing screen share receiver');
    setIsScreenShareMode(false);
  }, []);

  // Command handlers - defined with useCallback to maintain stable references
  const handlePreviewCommand = useCallback(async (command: AppCommand) => {
    console.log('🎬 [HomeScreen] Executing preview_content command');
    await handlePreview();
  }, [handlePreview]);

  const handleScreenShareCommand = useCallback(async (command: AppCommand) => {
    console.log('📺 [HomeScreen] Executing screenshare command');
    if (Platform.OS !== 'web') {
      handleScreenShare();
    } else {
      throw new Error('Screen share not available on web platform');
    }
  }, [handleScreenShare]);

  const handleSyncCommand = useCallback(async (command: AppCommand) => {
    console.log('🔄 [HomeScreen] Executing sync_status command');
    await syncDeviceStatus();
  }, [syncDeviceStatus]);

  const handleLogoutCommand = useCallback(async (command: AppCommand) => {
    console.log('🚪 [HomeScreen] Executing logout command');
    await handleLogout();
  }, [handleLogout]);

  // Set up command handlers when authenticated
  useEffect(() => {
    if (!isAuthenticated || !deviceId) {
      console.log('⏸️ [HomeScreen] Skipping command listener setup - not authenticated or no device ID');
      return;
    }

    console.log('🎯 [HomeScreen] Setting up command handlers for device:', deviceId);

    // Initialize command listener with device ID (in case it wasn't initialized yet)
    commandListener.initialize(deviceId);

    // Register command handlers
    commandListener.registerHandler('preview_content', handlePreviewCommand);
    commandListener.registerHandler('screenshare', handleScreenShareCommand);
    commandListener.registerHandler('sync_status', handleSyncCommand);
    commandListener.registerHandler('logout', handleLogoutCommand);

    // Start listening for commands
    commandListener.startListening();

    // Cleanup
    return () => {
      console.log('🧹 [HomeScreen] Cleaning up command handlers');
      commandListener.stopListening();
    };
  }, [isAuthenticated, deviceId, handlePreviewCommand, handleScreenShareCommand, handleSyncCommand, handleLogoutCommand]);

  useEffect(() => {
    if (deviceId && screenName && username && password && networkState.isConnected !== undefined) {
      syncDeviceStatus();
    }
  }, [deviceId, screenName, username, password, networkState.isConnected, syncDeviceStatus]);

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

  // TV Layout - Compact professional design
  if (isTVDevice) {
    return (
      <Animated.View style={[styles.tvContainer, { opacity: fadeInAnim }]}>
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#334155']}
          style={styles.tvGradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Compact Header */}
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

            {/* Command Listener Status */}
            <View style={[styles.tvCommandStatus, { backgroundColor: getCommandListenerStatusColor() + '20' }]}>
              <Text style={[styles.tvCommandStatusText, { color: getCommandListenerStatusColor() }]}>
                Remote Commands: {getCommandListenerStatusText()}
              </Text>
            </View>
          </View>

          {/* Compact Main Content */}
          <View style={styles.tvMainContent}>
            {/* Info Card - Compact */}
            <View style={styles.tvInfoCard}>
              <LinearGradient
                colors={['#1E293B', '#334155']}
                style={styles.tvCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                <Text style={styles.tvCardTitle}>Display Information</Text>
                
                <View style={styles.tvInfoRow}>
                  <View style={styles.tvInfoItem}>
                    <Text style={styles.tvInfoItemLabel}>Username</Text>
                    <Text style={styles.tvInfoItemValue}>{username}</Text>
                  </View>

                  <View style={styles.tvInfoItem}>
                    <Text style={styles.tvInfoItemLabel}>Screen Name</Text>
                    <Text style={styles.tvInfoItemValue}>{screenName}</Text>
                  </View>
                </View>
                
                <View style={styles.tvInfoRow}>
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
                </View>

                {syncStatus && (
                  <View style={styles.tvInfoRow}>
                    <View style={styles.tvInfoItem}>
                      <Text style={styles.tvInfoItemLabel}>Sync Status</Text>
                      <Text style={[
                        styles.tvInfoItemValue,
                        { color: syncStatus === 'success' ? '#10B981' : '#EF4444' }
                      ]}>
                        {syncStatus === 'success' ? '✓ Success' : '✗ Failed'}
                      </Text>
                    </View>
                  </View>
                )}
              </LinearGradient>
            </View>

            {/* Action Buttons Grid - 2x2 Layout */}
            <View style={styles.tvButtonsGrid}>
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
                      <Text style={styles.tvButtonText}>Preview</Text>
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

          {/* Compact Footer */}
          <View style={styles.tvFooter}>
            <Text style={styles.tvFooterText}>
              ℹ️ Status updates sent every 20 seconds • Remote commands enabled • Updates only when on this screen
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
            {/* Logo */}
            <Image
              source={require('@/assets/images/e7d83a94-28be-4159-800f-98c51daa0f57.png')}
              style={styles.mobileLogo}
              resizeMode="contain"
            />
            
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

            {/* Command Listener Status */}
            <View style={[styles.mobileCommandStatus, { backgroundColor: getCommandListenerStatusColor() + '20' }]}>
              <Text style={[styles.mobileCommandStatusText, { color: getCommandListenerStatusColor() }]}>
                Remote Commands: {getCommandListenerStatusText()}
              </Text>
            </View>

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
                ℹ️ Status updates sent every 20 seconds
              </Text>
              <Text style={styles.mobileFooterText}>
                🎯 Remote commands enabled
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
  mobileLogo: {
    width: 220,
    height: 80,
    marginBottom: 24,
  },
  mobileStatusBanner: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
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
  mobileCommandStatus: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  mobileCommandStatusText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
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

  // TV styles - Compact professional design
  tvContainer: {
    flex: 1,
  },
  tvGradientBackground: {
    flex: 1,
    paddingHorizontal: 50,
    paddingVertical: 30,
  },
  tvHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  tvHeaderLogo: {
    width: 200,
    height: 60,
    marginBottom: 16,
  },
  tvStatusBanner: {
    width: '100%',
    maxWidth: 900,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    marginBottom: 12,
  },
  tvStatusGradient: {
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  tvStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tvStatusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 14,
  },
  tvStatusTextContainer: {
    flex: 1,
  },
  tvStatusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  tvStatusName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  tvStatusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tvStatusBadgeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  tvCommandStatus: {
    width: '100%',
    maxWidth: 900,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tvCommandStatusText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  tvMainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  tvInfoCard: {
    width: '100%',
    maxWidth: 900,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tvCardGradient: {
    padding: 20,
  },
  tvCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: 0.8,
  },
  tvInfoRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 8,
  },
  tvInfoItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  tvInfoItemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  tvInfoItemValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tvButtonsGrid: {
    width: '100%',
    maxWidth: 900,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  tvButton: {
    width: '48%',
    minWidth: 200,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  tvButtonFocused: {
    elevation: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    transform: [{ scale: 1.05 }],
  },
  tvButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 12,
  },
  tvButtonIcon: {
    fontSize: 22,
  },
  tvButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.6,
  },
  tvFooter: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    alignItems: 'center',
  },
  tvFooterText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontWeight: '500',
  },
});
