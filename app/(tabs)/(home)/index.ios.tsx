
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, Alert, ScrollView, Animated, Image } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { Redirect, useFocusEffect } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { sendDeviceStatus, fetchDisplayContent, DisplayConnectResponse } from '@/utils/apiService';
import { isTV } from '@/utils/deviceUtils';
import ContentPlayer from '@/components/ContentPlayer';
import ScreenShareReceiver from '@/components/ScreenShareReceiver';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/IconSymbol';

export default function HomeScreen() {
  const { 
    isAuthenticated, 
    username, 
    password, 
    screenName, 
    deviceId,
    logout,
    showPreviewModal,
    setShowPreviewModal,
    showScreenShareModal,
    setShowScreenShareModal,
    displayContent,
    setDisplayContent,
  } = useAuth();
  
  const networkState = useNetworkState();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTVDevice = isTV();

  // Button animation states - ALL HOOKS AT TOP LEVEL
  const buttonScaleAnims = {
    logout: useRef(new Animated.Value(1)).current,
    sync: useRef(new Animated.Value(1)).current,
    preview: useRef(new Animated.Value(1)).current,
    screenShare: useRef(new Animated.Value(1)).current,
  };

  // Sync device status function
  const syncDeviceStatus = useCallback(async () => {
    if (!deviceId || !screenName || !username || !password) {
      console.log('Cannot sync - missing credentials');
      return;
    }

    if (!networkState.isConnected) {
      console.log('Cannot sync - offline');
      setSyncError('Offline - will sync when connection is restored');
      return;
    }

    try {
      setIsSyncing(true);
      setSyncError(null);
      console.log('Syncing device status...');

      const response = await sendDeviceStatus(
        deviceId,
        screenName,
        username,
        password,
        'online'
      );

      if (response.success) {
        console.log('✓ Device status synced successfully');
        setLastSyncTime(new Date());
        
        // Fetch display content if available
        if (response.data?.solution_id) {
          console.log('Fetching display content for solution:', response.data.solution_id);
          const contentResponse = await fetchDisplayContent(
            username,
            password,
            screenName
          );
          
          if (contentResponse.success && contentResponse.data) {
            console.log('✓ Display content fetched successfully');
            setDisplayContent(contentResponse.data);
          }
        }
      } else {
        console.error('✗ Failed to sync device status:', response.error);
        setSyncError(response.error || 'Sync failed');
      }
    } catch (error) {
      console.error('✗ Exception during sync:', error);
      setSyncError('Sync error - will retry');
    } finally {
      setIsSyncing(false);
    }
  }, [deviceId, screenName, username, password, networkState.isConnected, setDisplayContent]);

  const handleLogout = useCallback(async () => {
    console.log('User initiated logout');
    
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
            console.log('Logout confirmed');
            await logout();
          },
        },
      ]
    );
  }, [logout]);

  const handleManualSync = useCallback(async () => {
    console.log('User initiated manual sync');
    animateButtonPress('sync');
    await syncDeviceStatus();
  }, [syncDeviceStatus]);

  const handlePreview = useCallback(() => {
    console.log('User opened preview modal');
    animateButtonPress('preview');
    setShowPreviewModal(true);
  }, [setShowPreviewModal]);

  const handleClosePreview = useCallback(() => {
    console.log('User closed preview modal');
    setShowPreviewModal(false);
  }, [setShowPreviewModal]);

  const handleScreenShare = useCallback(() => {
    console.log('User opened screen share modal');
    animateButtonPress('screenShare');
    setShowScreenShareModal(true);
  }, [setShowScreenShareModal]);

  const handleCloseScreenShare = useCallback(() => {
    console.log('User closed screen share modal');
    setShowScreenShareModal(false);
  }, [setShowScreenShareModal]);

  const animateButtonPress = (buttonKey: keyof typeof buttonScaleAnims) => {
    Animated.sequence([
      Animated.timing(buttonScaleAnims[buttonKey], {
        toValue: 0.9,
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

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    console.log('User not authenticated, redirecting to login');
    return <Redirect href="/login" />;
  }

  // Log device ID on mount
  useEffect(() => {
    console.log('=== HOME SCREEN MOUNTED (iOS) ===');
    console.log('Device ID:', deviceId);
    console.log('Username:', username);
    console.log('Screen Name:', screenName);
    console.log('Is TV:', isTVDevice);
  }, [deviceId, username, screenName, isTVDevice]);

  // Update online status
  useEffect(() => {
    setIsOnline(networkState.isConnected === true);
  }, [networkState.isConnected]);

  // Auto-sync device status
  useEffect(() => {
    if (!deviceId || !screenName || !username || !password || !networkState.isConnected) {
      console.log('Skipping auto-sync - missing credentials or offline');
      return;
    }

    console.log('Setting up auto-sync interval');
    syncDeviceStatus();

    syncIntervalRef.current = setInterval(() => {
      console.log('Auto-sync triggered');
      syncDeviceStatus();
    }, 30000); // Sync every 30 seconds

    return () => {
      if (syncIntervalRef.current) {
        console.log('Clearing auto-sync interval');
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [deviceId, screenName, username, password, networkState.isConnected, syncDeviceStatus]);

  // Apple TV Layout - Full screen, no tabs
  if (isTVDevice) {
    return (
      <View style={styles.tvContainer}>
        <LinearGradient
          colors={['#FFFFFF', '#F0F4FF', '#E0E7FF', '#C7D2FE']}
          style={styles.tvGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <View style={styles.tvHeader}>
            <Image 
              source={require('@/assets/images/ded86abe-6a7d-491d-80a5-adc8948ee47e.jpeg')}
              style={styles.tvLogo}
              resizeMode="contain"
            />
            <View style={styles.tvHeaderInfo}>
              <Text style={styles.tvTitle}>360Digisigns TV</Text>
              <Text style={styles.tvSubtitle}>{screenName}</Text>
            </View>
          </View>

          <View style={styles.tvStatusBar}>
            <View style={[styles.tvStatusBadge, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]}>
              <Text style={styles.tvStatusText}>
                {isOnline ? '● Online' : '● Offline'}
              </Text>
            </View>
            {lastSyncTime && (
              <Text style={styles.tvLastSync}>
                Last sync: {lastSyncTime.toLocaleTimeString()}
              </Text>
            )}
          </View>

          <View style={styles.tvContent}>
            <View style={styles.tvInfoCard}>
              <Text style={styles.tvInfoTitle}>Device Information</Text>
              <View style={styles.tvInfoRow}>
                <Text style={styles.tvInfoLabel}>Device ID:</Text>
                <Text style={styles.tvInfoValue}>{deviceId}</Text>
              </View>
              <View style={styles.tvInfoRow}>
                <Text style={styles.tvInfoLabel}>Screen Name:</Text>
                <Text style={styles.tvInfoValue}>{screenName}</Text>
              </View>
              <View style={styles.tvInfoRow}>
                <Text style={styles.tvInfoLabel}>Username:</Text>
                <Text style={styles.tvInfoValue}>{username}</Text>
              </View>
              {syncError && (
                <View style={styles.tvErrorBox}>
                  <Text style={styles.tvErrorText}>⚠️ {syncError}</Text>
                </View>
              )}
            </View>

            <View style={styles.tvActionsCard}>
              <Text style={styles.tvActionsTitle}>Actions</Text>
              
              <Animated.View style={{ transform: [{ scale: buttonScaleAnims.sync }] }}>
                <TouchableOpacity
                  style={[styles.tvButton, styles.tvButtonPrimary]}
                  onPress={handleManualSync}
                  disabled={isSyncing || !isOnline}
                >
                  {isSyncing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <IconSymbol 
                        ios_icon_name="arrow.clockwise" 
                        android_material_icon_name="refresh" 
                        size={24} 
                        color="#FFFFFF" 
                      />
                      <Text style={styles.tvButtonText}>Sync Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ transform: [{ scale: buttonScaleAnims.preview }] }}>
                <TouchableOpacity
                  style={[styles.tvButton, styles.tvButtonSecondary]}
                  onPress={handlePreview}
                  disabled={!displayContent}
                >
                  <IconSymbol 
                    ios_icon_name="play.circle" 
                    android_material_icon_name="play-arrow" 
                    size={24} 
                    color="#007BFF" 
                  />
                  <Text style={[styles.tvButtonText, { color: '#007BFF' }]}>Preview Content</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ transform: [{ scale: buttonScaleAnims.screenShare }] }}>
                <TouchableOpacity
                  style={[styles.tvButton, styles.tvButtonSecondary]}
                  onPress={handleScreenShare}
                >
                  <IconSymbol 
                    ios_icon_name="tv" 
                    android_material_icon_name="cast" 
                    size={24} 
                    color="#007BFF" 
                  />
                  <Text style={[styles.tvButtonText, { color: '#007BFF' }]}>Screen Share</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ transform: [{ scale: buttonScaleAnims.logout }] }}>
                <TouchableOpacity
                  style={[styles.tvButton, styles.tvButtonDanger]}
                  onPress={handleLogout}
                >
                  <IconSymbol 
                    ios_icon_name="rectangle.portrait.and.arrow.right" 
                    android_material_icon_name="logout" 
                    size={24} 
                    color="#FFFFFF" 
                  />
                  <Text style={styles.tvButtonText}>Logout</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </LinearGradient>

        {/* Preview Modal */}
        <Modal
          visible={showPreviewModal}
          animationType="fade"
          onRequestClose={handleClosePreview}
        >
          {displayContent && (
            <ContentPlayer 
              playlists={displayContent.playlists || []} 
              onClose={handleClosePreview}
            />
          )}
        </Modal>

        {/* Screen Share Modal */}
        <Modal
          visible={showScreenShareModal}
          animationType="fade"
          onRequestClose={handleCloseScreenShare}
        >
          <ScreenShareReceiver onClose={handleCloseScreenShare} />
        </Modal>
      </View>
    );
  }

  // Mobile iOS Layout (existing code continues...)
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFFFFF', '#F0F4FF', '#E0E7FF', '#C7D2FE']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Image 
              source={require('@/assets/images/ded86abe-6a7d-491d-80a5-adc8948ee47e.jpeg')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>360Digisigns</Text>
            <Text style={styles.subtitle}>{screenName}</Text>
          </View>

          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]}>
              <Text style={styles.statusText}>
                {isOnline ? '● Online' : '● Offline'}
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Device Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Device ID:</Text>
              <Text style={styles.infoValue}>{deviceId}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Screen Name:</Text>
              <Text style={styles.infoValue}>{screenName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Username:</Text>
              <Text style={styles.infoValue}>{username}</Text>
            </View>
            {lastSyncTime && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Last Sync:</Text>
                <Text style={styles.infoValue}>{lastSyncTime.toLocaleTimeString()}</Text>
              </View>
            )}
            {syncError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {syncError}</Text>
              </View>
            )}
          </View>

          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Actions</Text>
            
            <Animated.View style={{ transform: [{ scale: buttonScaleAnims.sync }] }}>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleManualSync}
                disabled={isSyncing || !isOnline}
              >
                {isSyncing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <IconSymbol 
                      ios_icon_name="arrow.clockwise" 
                      android_material_icon_name="refresh" 
                      size={20} 
                      color="#FFFFFF" 
                    />
                    <Text style={styles.buttonText}>Sync Now</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: buttonScaleAnims.preview }] }}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={handlePreview}
                disabled={!displayContent}
              >
                <IconSymbol 
                  ios_icon_name="play.circle" 
                  android_material_icon_name="play-arrow" 
                  size={20} 
                  color="#007BFF" 
                />
                <Text style={[styles.buttonText, { color: '#007BFF' }]}>Preview Content</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: buttonScaleAnims.screenShare }] }}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={handleScreenShare}
              >
                <IconSymbol 
                  ios_icon_name="tv" 
                  android_material_icon_name="cast" 
                  size={20} 
                  color="#007BFF" 
                />
                <Text style={[styles.buttonText, { color: '#007BFF' }]}>Screen Share</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: buttonScaleAnims.logout }] }}>
              <TouchableOpacity
                style={[styles.button, styles.buttonDanger]}
                onPress={handleLogout}
              >
                <IconSymbol 
                  ios_icon_name="rectangle.portrait.and.arrow.right" 
                  android_material_icon_name="logout" 
                  size={20} 
                  color="#FFFFFF" 
                />
                <Text style={styles.buttonText}>Logout</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </LinearGradient>

      {/* Preview Modal */}
      <Modal
        visible={showPreviewModal}
        animationType="slide"
        onRequestClose={handleClosePreview}
      >
        {displayContent && (
          <ContentPlayer 
            playlists={displayContent.playlists || []} 
            onClose={handleClosePreview}
          />
        )}
      </Modal>

      {/* Screen Share Modal */}
      <Modal
        visible={showScreenShareModal}
        animationType="slide"
        onRequestClose={handleCloseScreenShare}
      >
        <ScreenShareReceiver onClose={handleCloseScreenShare} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // TV Styles
  tvContainer: {
    flex: 1,
  },
  tvGradient: {
    flex: 1,
    padding: 40,
  },
  tvHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  tvLogo: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginRight: 20,
  },
  tvHeaderInfo: {
    flex: 1,
  },
  tvTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  tvSubtitle: {
    fontSize: 20,
    color: '#666666',
  },
  tvStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    gap: 16,
  },
  tvStatusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  tvStatusText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tvLastSync: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 'auto',
  },
  tvContent: {
    flex: 1,
    flexDirection: 'row',
    gap: 30,
  },
  tvInfoCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tvInfoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 20,
  },
  tvInfoRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tvInfoLabel: {
    fontSize: 16,
    color: '#666666',
    width: 140,
    fontWeight: '600',
  },
  tvInfoValue: {
    fontSize: 16,
    color: '#333333',
    flex: 1,
  },
  tvErrorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  tvErrorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  tvActionsCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tvActionsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 20,
  },
  tvButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  tvButtonPrimary: {
    backgroundColor: '#007BFF',
  },
  tvButtonSecondary: {
    backgroundColor: '#E0E7FF',
  },
  tvButtonDanger: {
    backgroundColor: '#EF4444',
  },
  tvButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  // Mobile Styles
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666666',
    width: 100,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  actionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: '#007BFF',
  },
  buttonSecondary: {
    backgroundColor: '#E0E7FF',
  },
  buttonDanger: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
