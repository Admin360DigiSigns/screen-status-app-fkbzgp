
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  Alert,
  Image,
  Animated,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { router } from 'expo-router';
import { isTV } from '@/utils/deviceUtils';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen() {
  const { 
    loginWithCode, 
    checkAuthenticationStatus, 
    deviceId, 
    isAuthenticated, 
    authCode: contextAuthCode, 
    authCodeExpiry: contextAuthCodeExpiry,
    isInitializing,
    isLoggingOut,
    logoutProgress
  } = useAuth();
  const networkState = useNetworkState();
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [expiryTime, setExpiryTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const authCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasGeneratedCodeRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const mountedRef = useRef(false);

  // Animation values
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const logoutModalAnim = useRef(new Animated.Value(0)).current;

  const isTVDevice = isTV();
  const screenDimensions = Dimensions.get('window');
  const isLargeScreen = screenDimensions.width >= 1024;

  // Animate logout modal
  useEffect(() => {
    if (isLoggingOut) {
      Animated.timing(logoutModalAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(logoutModalAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoggingOut]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log('User is authenticated, redirecting to home');
      router.replace('/(tabs)/(home)');
    }
  }, [isAuthenticated]);

  // Sync with context auth code
  useEffect(() => {
    if (contextAuthCode && contextAuthCode !== authCode) {
      console.log('Syncing auth code from context:', contextAuthCode);
      setAuthCode(contextAuthCode);
      
      if (contextAuthCodeExpiry) {
        const expiry = new Date(contextAuthCodeExpiry);
        setExpiryTime(expiry);
        console.log('Code expires at:', expiry.toISOString());
        
        // Start checking for authentication
        startAuthenticationCheck(contextAuthCode);
      }
    }
  }, [contextAuthCode, contextAuthCodeExpiry]);

  useEffect(() => {
    console.log('=== LOGIN SCREEN MOUNTED ===');
    console.log('Device ID:', deviceId);
    console.log('Is Authenticated:', isAuthenticated);
    console.log('Is Initializing:', isInitializing);
    console.log('Network Connected:', networkState.isConnected);
    console.log('Context Auth Code:', contextAuthCode);
    
    mountedRef.current = true;
    
    Animated.parallel([
      Animated.timing(fadeInAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      console.log('=== LOGIN SCREEN UNMOUNTING ===');
      mountedRef.current = false;
      if (authCheckIntervalRef.current) {
        clearInterval(authCheckIntervalRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Generate code after initialization completes - SIMPLIFIED LOGIC
  useEffect(() => {
    const shouldGenerate = 
      !isInitializing && 
      !isAuthenticated && 
      deviceId && 
      networkState.isConnected && 
      !contextAuthCode && 
      !authCode &&
      !hasGeneratedCodeRef.current && 
      !isGeneratingRef.current &&
      mountedRef.current;

    if (shouldGenerate) {
      console.log('✓ All conditions met - generating code');
      console.log('Conditions:', {
        isInitializing,
        isAuthenticated,
        hasDeviceId: !!deviceId,
        isConnected: networkState.isConnected,
        hasContextCode: !!contextAuthCode,
        hasLocalCode: !!authCode,
        hasGenerated: hasGeneratedCodeRef.current,
        isGenerating: isGeneratingRef.current,
        isMounted: mountedRef.current,
      });
      handleGenerateCode();
    } else {
      console.log('✗ Not generating code - conditions not met:', {
        isInitializing,
        isAuthenticated,
        hasDeviceId: !!deviceId,
        isConnected: networkState.isConnected,
        hasContextCode: !!contextAuthCode,
        hasLocalCode: !!authCode,
        hasGenerated: hasGeneratedCodeRef.current,
        isGenerating: isGeneratingRef.current,
        isMounted: mountedRef.current,
      });
    }
  }, [isInitializing, isAuthenticated, deviceId, networkState.isConnected, contextAuthCode, authCode]);

  // Pulse animation for the code
  useEffect(() => {
    if (authCode) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [authCode]);

  // Timer countdown
  useEffect(() => {
    if (expiryTime) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }

      timerIntervalRef.current = setInterval(() => {
        const now = new Date();
        const diff = expiryTime.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeRemaining('Expired');
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
          }
          // Auto-regenerate code
          console.log('Code expired, auto-regenerating');
          hasGeneratedCodeRef.current = false;
          isGeneratingRef.current = false;
          setAuthCode(null);
          handleGenerateCode();
        } else {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [expiryTime]);

  const handleGenerateCode = async () => {
    if (isGeneratingRef.current) {
      console.log('Code generation already in progress, skipping');
      return;
    }

    if (isAuthenticated) {
      console.log('User is authenticated, skipping code generation');
      return;
    }

    console.log('=== HANDLE GENERATE CODE ===');
    console.log('Network connected:', networkState.isConnected);
    console.log('Device ID:', deviceId);
    
    if (!networkState.isConnected) {
      const errorMsg = 'No Internet Connection - Please connect to the internet to generate a login code.';
      console.error(errorMsg);
      setErrorMessage(errorMsg);
      Alert.alert(
        'No Internet Connection',
        'Please connect to the internet to generate a login code.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!deviceId) {
      const errorMsg = 'Device ID not available yet. Please wait...';
      console.error(errorMsg);
      setErrorMessage(errorMsg);
      return;
    }

    isGeneratingRef.current = true;
    hasGeneratedCodeRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);
    console.log('Generating authentication code...');

    try {
      const result = await loginWithCode();
      console.log('loginWithCode result:', result);
      
      if (result.success && result.code) {
        console.log('✓ Code generated successfully:', result.code);
        setAuthCode(result.code);
        
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 10);
        setExpiryTime(expiry);
        console.log('Code expires at:', expiry.toISOString());

        startAuthenticationCheck(result.code);
      } else {
        const errorMsg = result.error || 'Failed to generate authentication code. Please try again.';
        console.error('✗ Failed to generate code:', errorMsg);
        setErrorMessage(errorMsg);
        Alert.alert(
          'Error',
          errorMsg,
          [{ text: 'OK' }]
        );
        hasGeneratedCodeRef.current = false;
        isGeneratingRef.current = false;
      }
    } catch (error) {
      console.error('✗ Exception while generating code:', error);
      const errorMsg = 'An error occurred while generating the code. Please try again.';
      setErrorMessage(errorMsg);
      Alert.alert(
        'Error',
        errorMsg,
        [{ text: 'OK' }]
      );
      hasGeneratedCodeRef.current = false;
      isGeneratingRef.current = false;
    } finally {
      setIsLoading(false);
      isGeneratingRef.current = false;
    }
  };

  const startAuthenticationCheck = (code: string) => {
    console.log('Starting authentication check for code:', code);
    setIsCheckingAuth(true);

    if (authCheckIntervalRef.current) {
      clearInterval(authCheckIntervalRef.current);
    }

    authCheckIntervalRef.current = setInterval(async () => {
      console.log('Checking authentication status...');
      
      try {
        const result = await checkAuthenticationStatus();
        
        if (result.authenticated && result.credentials) {
          console.log('✓ Authentication successful!');
          
          if (authCheckIntervalRef.current) {
            clearInterval(authCheckIntervalRef.current);
            authCheckIntervalRef.current = null;
          }
          
          setIsCheckingAuth(false);
          router.replace('/(tabs)/(home)');
        } else if (result.error === 'Code expired') {
          console.log('Code expired, generating new one...');
          
          if (authCheckIntervalRef.current) {
            clearInterval(authCheckIntervalRef.current);
            authCheckIntervalRef.current = null;
          }
          
          setIsCheckingAuth(false);
          hasGeneratedCodeRef.current = false;
          isGeneratingRef.current = false;
          setAuthCode(null);
          handleGenerateCode();
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
      }
    }, 3000);
  };

  const isOnline = networkState.isConnected === true;

  // Logout Progress Modal
  const LogoutModal = () => (
    <Modal
      visible={isLoggingOut}
      transparent={true}
      animationType="none"
    >
      <Animated.View 
        style={[
          styles.logoutModalOverlay,
          {
            opacity: logoutModalAnim,
          }
        ]}
      >
        <Animated.View 
          style={[
            styles.logoutModalContent,
            {
              transform: [
                {
                  scale: logoutModalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            }
          ]}
        >
          <View style={styles.logoutModalCard}>
            <ActivityIndicator size="large" color="#007BFF" />
            <Text style={styles.logoutModalTitle}>Logging Out</Text>
            <Text style={styles.logoutModalMessage}>{logoutProgress}</Text>
            <View style={styles.logoutModalDots}>
              <Animated.View style={[styles.logoutDot, { opacity: pulseAnim }]} />
              <Animated.View style={[styles.logoutDot, { opacity: pulseAnim }]} />
              <Animated.View style={[styles.logoutDot, { opacity: pulseAnim }]} />
            </View>
            <Text style={styles.logoutModalInfo}>
              Clearing all authentication data...
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );

  // Show initializing state
  if (isInitializing) {
    return (
      <View style={[styles.mobileContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.mobileLoadingContainer}>
          <ActivityIndicator size="large" color="#007BFF" />
          <Text style={styles.mobileLoadingText}>Initializing...</Text>
          <Text style={styles.mobileInfoText}>
            Preparing fresh authentication session
          </Text>
          <Text style={styles.mobileInfoText}>
            Checking for recent logout...
          </Text>
        </View>
      </View>
    );
  }

  // Calculate responsive sizes for TV
  const getResponsiveSizes = () => {
    const width = screenDimensions.width;
    const height = screenDimensions.height;
    
    if (isTVDevice || isLargeScreen) {
      // TV or large screen sizes - Compact to fit without scrolling
      return {
        qrSize: Math.min(width * 0.18, height * 0.35, 280),
        codeSize: Math.min(width * 0.05, 60),
        logoWidth: Math.min(width * 0.2, 320),
        logoHeight: Math.min(height * 0.1, 100),
        containerMaxWidth: Math.min(width * 0.9, 1200),
        spacing: 30,
      };
    } else {
      // Mobile sizes
      return {
        qrSize: Math.min(width * 0.5, 200),
        codeSize: 36,
        logoWidth: Math.min(width * 0.6, 240),
        logoHeight: 100,
        containerMaxWidth: width * 0.9,
        spacing: 24,
      };
    }
  };

  const sizes = getResponsiveSizes();

  // TV Layout - QR on left, Code on right - NO SCROLLING
  if (isTVDevice || isLargeScreen) {
    return (
      <>
        <LogoutModal />
        <Animated.View style={[styles.tvContainer, { opacity: fadeInAnim }]}>
          <LinearGradient
            colors={['#FFFFFF', '#F0F4FF', '#E0E7FF', '#C7D2FE']}
            style={styles.tvGradientBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <Animated.View style={[styles.tvContent, { transform: [{ translateY: slideUpAnim }], maxWidth: sizes.containerMaxWidth }]}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={[styles.tvLogo, { width: sizes.logoWidth, height: sizes.logoHeight }]}
                resizeMode="contain"
              />
              
              <View style={styles.tvConnectionBadgeContainer}>
                <View style={[styles.tvConnectionBadge, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]}>
                  <Text style={styles.tvConnectionText}>
                    {isOnline ? '● Connected' : '● Offline'}
                  </Text>
                </View>
              </View>

              {errorMessage && (
                <View style={styles.tvErrorCard}>
                  <Text style={styles.tvErrorText}>⚠️ {errorMessage}</Text>
                </View>
              )}

              {isLoading ? (
                <View style={styles.tvLoadingContainer}>
                  <ActivityIndicator size="large" color="#007BFF" />
                  <Text style={styles.tvLoadingText}>Generating code...</Text>
                </View>
              ) : authCode ? (
                <View style={styles.tvCodeContainer}>
                  <View style={styles.tvCodeCard}>
                    <Text style={styles.tvInstructionText}>
                      Scan QR Code or Enter Code on Web App
                    </Text>
                    
                    {/* QR Code on Left, Code on Right - Horizontal Layout */}
                    <View style={styles.tvHorizontalLayout}>
                      {/* QR Code Section - Left */}
                      <View style={styles.tvQRSection}>
                        <View style={styles.tvQRWrapper}>
                          <QRCode
                            value={authCode}
                            size={sizes.qrSize}
                            backgroundColor="white"
                            color="black"
                          />
                        </View>
                        <Text style={styles.tvQRLabel}>Scan with your device</Text>
                      </View>

                      {/* Divider */}
                      <View style={styles.tvDivider} />

                      {/* Code Section - Right */}
                      <View style={styles.tvCodeSection}>
                        <Animated.View style={[styles.tvCodeDisplay, { transform: [{ scale: pulseAnim }] }]}>
                          <Text style={styles.tvCodeLabel}>Authentication Code</Text>
                          <Text style={[styles.tvCodeText, { fontSize: sizes.codeSize }]}>{authCode}</Text>
                        </Animated.View>

                        <View style={styles.tvTimerContainer}>
                          <Text style={styles.tvTimerText}>
                            {timeRemaining === 'Expired' ? '⚠️ Code Expired - Generating new code...' : `⏱️ Expires in: ${timeRemaining}`}
                          </Text>
                        </View>

                        {isCheckingAuth && (
                          <View style={styles.tvCheckingContainer}>
                            <ActivityIndicator size="small" color="#007BFF" />
                            <Text style={styles.tvCheckingText}>Waiting for authentication...</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.tvLoadingContainer}>
                  <ActivityIndicator size="large" color="#007BFF" />
                  <Text style={styles.tvLoadingText}>Preparing login...</Text>
                </View>
              )}

              <View style={styles.tvInfoBox}>
                <Text style={styles.tvInfoText}>
                  Device ID: {deviceId || 'Loading...'}
                </Text>
                <Text style={styles.tvInfoText}>
                  🔒 Fresh authentication session - No auto-login
                </Text>
                <Text style={styles.tvInfoText}>
                  🛡️ 30-second logout protection active
                </Text>
                <Text style={styles.tvInfoText}>
                  🔄 Code will automatically regenerate when expired
                </Text>
              </View>
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </>
    );
  }

  // Mobile Layout - Vertical stacking
  return (
    <>
      <LogoutModal />
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
            <Animated.View style={[styles.mobileContent, { transform: [{ translateY: slideUpAnim }] }]}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={[styles.mobileLogo, { width: sizes.logoWidth, height: sizes.logoHeight }]}
                resizeMode="contain"
              />
              
              <View style={styles.mobileConnectionBadgeContainer}>
                <View style={[styles.mobileConnectionBadge, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]}>
                  <Text style={styles.mobileConnectionText}>
                    {isOnline ? '● Connected' : '● Offline'}
                  </Text>
                </View>
              </View>

              {!isOnline && (
                <View style={styles.mobileWarningCard}>
                  <Text style={styles.mobileWarningText}>
                    ⚠️ Internet connection required to login
                  </Text>
                </View>
              )}

              {errorMessage && (
                <View style={styles.mobileErrorCard}>
                  <Text style={styles.mobileErrorText}>⚠️ {errorMessage}</Text>
                </View>
              )}

              {isLoading ? (
                <View style={styles.mobileLoadingContainer}>
                  <ActivityIndicator size="large" color="#007BFF" />
                  <Text style={styles.mobileLoadingText}>Generating code...</Text>
                </View>
              ) : authCode ? (
                <View style={styles.mobileCodeContainer}>
                  <View style={styles.mobileCodeCard}>
                    <Text style={styles.mobileInstructionText}>
                      Scan QR Code or Enter Code on Web App
                    </Text>
                    
                    <View style={styles.mobileQRContainer}>
                      <View style={styles.mobileQRWrapper}>
                        <QRCode
                          value={authCode}
                          size={sizes.qrSize}
                          backgroundColor="white"
                          color="black"
                        />
                      </View>
                    </View>

                    <Animated.View style={[styles.mobileCodeDisplay, { transform: [{ scale: pulseAnim }] }]}>
                      <Text style={styles.mobileCodeLabel}>Authentication Code</Text>
                      <Text style={[styles.mobileCodeText, { fontSize: sizes.codeSize }]}>{authCode}</Text>
                    </Animated.View>

                    <View style={styles.mobileTimerContainer}>
                      <Text style={styles.mobileTimerText}>
                        {timeRemaining === 'Expired' ? '⚠️ Code Expired - Generating new code...' : `⏱️ Expires in: ${timeRemaining}`}
                      </Text>
                    </View>

                    {isCheckingAuth && (
                      <View style={styles.mobileCheckingContainer}>
                        <ActivityIndicator size="small" color="#007BFF" />
                        <Text style={styles.mobileCheckingText}>Waiting for authentication...</Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.mobileLoadingContainer}>
                  <ActivityIndicator size="large" color="#007BFF" />
                  <Text style={styles.mobileLoadingText}>Preparing login...</Text>
                </View>
              )}

              <View style={styles.mobileInfoBox}>
                <Text style={styles.mobileInfoText}>
                  Device ID: {deviceId || 'Loading...'}
                </Text>
                <Text style={styles.mobileInfoText}>
                  🔒 Fresh authentication session - No auto-login
                </Text>
                <Text style={styles.mobileInfoText}>
                  🛡️ 30-second logout protection active
                </Text>
                <Text style={styles.mobileInfoText}>
                  Enter the code on your web app to authenticate this device
                </Text>
                {Platform.OS === 'ios' && (
                  <Text style={[styles.mobileInfoText, { color: '#EF4444', fontWeight: 'bold' }]}>
                    iOS Note: After logout, manually close and reopen the app
                  </Text>
                )}
              </View>
            </Animated.View>
          </ScrollView>
        </LinearGradient>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  // Logout Modal Styles
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalContent: {
    width: '80%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  logoutModalCard: {
    backgroundColor: '#FFFFFF',
    padding: 40,
    alignItems: 'center',
    borderRadius: 20,
  },
  logoutModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 20,
    marginBottom: 12,
  },
  logoutModalMessage: {
    fontSize: 16,
    color: '#007BFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  logoutModalDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  logoutDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007BFF',
  },
  logoutModalInfo: {
    fontSize: 12,
    color: '#777777',
    textAlign: 'center',
  },

  // Mobile styles
  mobileContainer: {
    flex: 1,
  },
  mobileGradientBackground: {
    flex: 1,
  },
  mobileScrollContent: {
    flexGrow: 1,
    paddingTop: 60,
    paddingBottom: 40,
  },
  mobileContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  mobileLogo: {
    marginBottom: 32,
  },
  mobileConnectionBadgeContainer: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  mobileConnectionBadge: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  mobileConnectionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  mobileWarningCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  mobileWarningText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  mobileErrorCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  mobileErrorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  mobileLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  mobileLoadingText: {
    color: '#333333',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
  mobileCodeContainer: {
    width: '100%',
  },
  mobileCodeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  mobileInstructionText: {
    color: '#333333',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  mobileQRContainer: {
    marginBottom: 24,
  },
  mobileQRWrapper: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mobileCodeDisplay: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#EBF5FF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    borderWidth: 2,
    borderColor: '#007BFF',
  },
  mobileCodeLabel: {
    color: '#007BFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  mobileCodeText: {
    color: '#333333',
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  mobileTimerContainer: {
    marginBottom: 20,
  },
  mobileTimerText: {
    color: '#007BFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  mobileCheckingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  mobileCheckingText: {
    color: '#007BFF',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '600',
  },
  mobileInfoBox: {
    marginTop: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  mobileInfoText: {
    fontSize: 12,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 4,
  },

  // TV styles - Professional horizontal layout - NO SCROLLING
  tvContainer: {
    flex: 1,
  },
  tvGradientBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 30,
  },
  tvContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tvLogo: {
    marginBottom: 24,
  },
  tvConnectionBadgeContainer: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  tvConnectionBadge: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  tvConnectionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  tvErrorCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    maxWidth: 800,
    borderWidth: 2,
    borderColor: '#FCA5A5',
  },
  tvErrorText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  tvLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  tvLoadingText: {
    color: '#333333',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '600',
  },
  tvCodeContainer: {
    width: '100%',
  },
  tvCodeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  tvInstructionText: {
    color: '#333333',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 0.5,
  },
  // NEW: Horizontal layout for QR and Code
  tvHorizontalLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 40,
  },
  tvQRSection: {
    alignItems: 'center',
    flex: 1,
  },
  tvQRWrapper: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  tvQRLabel: {
    color: '#007BFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  tvDivider: {
    width: 2,
    height: '80%',
    backgroundColor: '#E5E7EB',
  },
  tvCodeSection: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  tvCodeDisplay: {
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#EBF5FF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    borderWidth: 2,
    borderColor: '#007BFF',
  },
  tvCodeLabel: {
    color: '#007BFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  tvCodeText: {
    color: '#333333',
    fontWeight: 'bold',
    letterSpacing: 12,
  },
  tvTimerContainer: {
    marginBottom: 12,
  },
  tvTimerText: {
    color: '#007BFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  tvCheckingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tvCheckingText: {
    color: '#007BFF',
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '600',
  },
  tvInfoBox: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  tvInfoText: {
    fontSize: 12,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 3,
  },
});
