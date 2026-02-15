
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, Alert, ScrollView, Animated, Image } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkState } from 'expo-network';
import { sendDeviceStatus, fetchDisplayContent, DisplayConnectResponse } from '@/utils/apiService';
import ContentPlayer from '@/components/ContentPlayer';
import ScreenShareReceiver from '@/components/ScreenShareReceiver';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/styles/commonStyles';
import { isTV } from '@/utils/deviceUtils';
import { commandListener } from '@/utils/commandListener';

export default function HomeScreen() {
  const { 
    isAuthenticated, 
    deviceId, 
    screenName, 
    username, 
    password, 
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [commandListenerStatus, setCommandListenerStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  // Button animation refs
  const buttonScaleAnims = useRef({
    sync: new Animated.Value(1),
    preview: new Animated.Value(1),
    screenShare: new Animated.Value(1),
    logout: new Animated.Value(1),
  }).current;

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  // Update command listener status
  useEffect(() => {
    const interval = setInterval(() => {
      const status = commandListener.getConnectionStatus();
      setCommandListenerStatus(status);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Set screen as active when this screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log('Home screen focused - setting screen as active');
      setScreenActive(true);
      
      return () => {
        console.log('Home screen unfocused - setting screen as inactive');
        setScreenActive(false);
      };
    }, [setScreenActive])
  );

  // Sync device status on mount and when network state changes
  useEffect(() => {
    if (deviceId && screenName && username && password && networkState.isConnected) {
      console.log('Network state changed or component mounted - syncing status');
      syncDeviceStatus();
    }
  }, [deviceId, screenName, username, password, networkState.isConnected]);

  const syncDeviceStatus = async () => {
    if (!deviceId || !screenName || !username || !password) {
      console.log('Missing required data for sync');
      return;
    }

    setIsSyncing(true);
    try {
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

      console.log('Syncing device status...');
      const success = await sendDeviceStatus(payload);
      
      if (success) {
        setLastSyncTime(new Date());
        console.log('Status sync successful');
      } else {
        console.error('Status sync failed');
      }
    } catch (error) {
      console.error('Error syncing device status:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSync = () => {
    console.log('User tapped Manual Sync button');
    animateButtonPress('sync');
    syncDeviceStatus();
  };

  const handlePreview = async () => {
    console.log('User tapped Preview Content button');
    animateButtonPress('preview');
    
    if (!username || !password || !screenName) {
      Alert.alert('Error', 'Missing credentials');
      return;
    }

    try {
      console.log('Fetching display content...');
      const result = await fetchDisplayContent(username, password, screenName);
      
      if (result.success && result.data) {
        console.log('Preview content loaded successfully');
        setDisplayContent(result.data);
        setShowPreviewModal(true);
      } else {
        console.error('Failed to load preview content:', result.error);
        Alert.alert('Preview Error', result.error || 'Failed to load preview content');
      }
    } catch (error) {
      console.error('Error loading preview:', error);
      Alert.alert('Preview Error', 'An unexpected error occurred');
    }
  };

  const handleClosePreview = () => {
    console.log('User closed preview modal');
    setShowPreviewModal(false);
    setDisplayContent(null);
  };

  const handleScreenShare = () => {
    console.log('User tapped Screen Share button');
    animateButtonPress('screenShare');
    setShowScreenShareModal(true);
  };

  const handleCloseScreenShare = () => {
    console.log('User closed screen share modal');
    setShowScreenShareModal(false);
  };

  const handleLogout = () => {
    console.log('User tapped Logout button');
    animateButtonPress('logout');
    
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            console.log('User confirmed logout');
            await logout();
          },
        },
      ]
    );
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

  const getCommandListenerStatusColor = () => {
    switch (commandListenerStatus) {
      case 'connected':
        return colors.success;
      case 'connecting':
        return colors.warning;
      case 'disconnected':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getCommandListenerStatusText = () => {
    switch (commandListenerStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  const statusColor = networkState.isConnected ? colors.success : colors.error;
  const statusText = networkState.isConnected ? 'Online' : 'Offline';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Screen Status</Text>
            <Text style={styles.subtitle}>{screenName}</Text>
          </View>

          {/* Status Card */}
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <Text style={styles.label}>Connection Status:</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={styles.statusText}>{statusText}</Text>
              </View>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.label}>Command Listener:</Text>
              <View style={[styles.statusBadge, { backgroundColor: getCommandListenerStatusColor() }]}>
                <Text style={styles.statusText}>{getCommandListenerStatusText()}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.label}>Device ID:</Text>
              <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">
                {deviceId}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Username:</Text>
              <Text style={styles.value}>{username}</Text>
            </View>

            {lastSyncTime && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Last Sync:</Text>
                <Text style={styles.value}>
                  {lastSyncTime.toLocaleTimeString()}
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <Animated.View style={{ transform: [{ scale: buttonScaleAnims.sync }] }}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleManualSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.buttonText}>Sync Status</Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: buttonScaleAnims.preview }] }}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handlePreview}
              >
                <Text style={styles.buttonTextSecondary}>Preview Content</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: buttonScaleAnims.screenShare }] }}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleScreenShare}
              >
                <Text style={styles.buttonTextSecondary}>Screen Share</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: buttonScaleAnims.logout }] }}>
              <TouchableOpacity
                style={[styles.button, styles.dangerButton]}
                onPress={handleLogout}
              >
                <Text style={styles.buttonText}>Logout</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Info Text */}
          <Text style={styles.infoText}>
            This screen will automatically sync status every 20 seconds while active.
            Commands from the web portal will be executed instantly.
          </Text>
        </ScrollView>
      </LinearGradient>

      {/* Preview Modal */}
      <Modal
        visible={showPreviewModal}
        animationType="slide"
        onRequestClose={handleClosePreview}
      >
        <View style={styles.modalContainer}>
          {displayContent && displayContent.solution && displayContent.solution.playlists ? (
            <ContentPlayer
              playlists={displayContent.solution.playlists}
              onClose={handleClosePreview}
            />
          ) : (
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>No Content Available</Text>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleClosePreview}
              >
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Screen Share Modal */}
      <Modal
        visible={showScreenShareModal}
        animationType="slide"
        onRequestClose={handleCloseScreenShare}
      >
        <View style={styles.modalContainer}>
          <ScreenShareReceiver onClose={handleCloseScreenShare} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.background,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: colors.background,
    opacity: 0.9,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: colors.background,
    fontWeight: '600',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 20,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dangerButton: {
    backgroundColor: colors.error,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: colors.background,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
  },
});
