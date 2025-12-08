
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
} from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { router } from 'expo-router';
import { isTV } from '@/utils/deviceUtils';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';

export default function LoginScreen() {
  const { loginWithCode, checkAuthenticationStatus, deviceId, isAuthenticated, authCode: contextAuthCode, authCodeExpiry: contextAuthCodeExpiry } = useAuth();
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

  // Animation values
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isTVDevice = isTV();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log('User is authenticated, redirecting to home');
      router.replace('/(tabs)/(home)');
    }
  }, [isAuthenticated]);

  // Sync with context auth code
  useEffect(() => {
    if (contextAuthCode) {
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
    console.log('Network Connected:', networkState.isConnected);
    console.log('Context Auth Code:', contextAuthCode);
    
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

    // Generate code on mount if not already present and not already generated
    if (deviceId && networkState.isConnected && !contextAuthCode && !hasGeneratedCodeRef.current) {
      console.log('Calling handleGenerateCode on mount');
      hasGeneratedCodeRef.current = true;
      handleGenerateCode();
    } else if (contextAuthCode) {
      console.log('Using existing auth code from context');
    } else {
      console.log('Skipping code generation - deviceId:', deviceId, 'connected:', networkState.isConnected, 'contextAuthCode:', contextAuthCode);
    }

    return () => {
      console.log('=== LOGIN SCREEN UNMOUNTING ===');
      if (authCheckIntervalRef.current) {
        clearInterval(authCheckIntervalRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Regenerate code when device ID becomes available (only if not already generated)
  useEffect(() => {
    if (deviceId && !authCode && !contextAuthCode && networkState.isConnected && !isLoading && !hasGeneratedCodeRef.current) {
      console.log('Device ID became available, generating code');
      hasGeneratedCodeRef.current = true;
      handleGenerateCode();
    }
  }, [deviceId]);

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
          hasGeneratedCodeRef.current = false; // Reset flag to allow regeneration
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

    setIsLoading(true);
    setErrorMessage(null);
    console.log('Generating authentication code...');

    try {
      const result = await loginWithCode();
      console.log('loginWithCode result:', result);
      
      if (result.success && result.code) {
        console.log('✓ Code generated successfully:', result.code);
        setAuthCode(result.code);
        
        // Set expiry time (10 minutes from now)
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 10);
        setExpiryTime(expiry);
        console.log('Code expires at:', expiry.toISOString());

        // Start checking for authentication
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
        hasGeneratedCodeRef.current = false; // Reset flag on error
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
      hasGeneratedCodeRef.current = false; // Reset flag on error
    } finally {
      setIsLoading(false);
    }
  };

  const startAuthenticationCheck = (code: string) => {
    console.log('Starting authentication check for code:', code);
    setIsCheckingAuth(true);

    // Clear any existing interval
    if (authCheckIntervalRef.current) {
      clearInterval(authCheckIntervalRef.current);
    }

    // Check every 3 seconds
    authCheckIntervalRef.current = setInterval(async () => {
      console.log('Checking authentication status...');
      
      try {
        const result = await checkAuthenticationStatus();
        
        if (result.authenticated && result.credentials) {
          console.log('✓ Authentication successful!');
          
          // Clear interval
          if (authCheckIntervalRef.current) {
            clearInterval(authCheckIntervalRef.current);
            authCheckIntervalRef.current = null;
          }
          
          setIsCheckingAuth(false);
          
          // Navigate to home
          router.replace('/(tabs)/(home)');
        } else if (result.error === 'Code expired') {
          console.log('Code expired, generating new one...');
          
          // Clear interval
          if (authCheckIntervalRef.current) {
            clearInterval(authCheckIntervalRef.current);
            authCheckIntervalRef.current = null;
          }
          
          setIsCheckingAuth(false);
          
          // Generate new code
          hasGeneratedCodeRef.current = false; // Reset flag to allow regeneration
          handleGenerateCode();
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
      }
    }, 3000);
  };

  const isOnline = networkState.isConnected === true;

  // TV Layout
  if (isTVDevice) {
    return (
      <Animated.View style={[styles.tvContainer, { opacity: fadeInAnim }]}>
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#334155']}
          style={styles.tvGradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Animated.View style={[styles.tvContent, { transform: [{ translateY: slideUpAnim }] }]}>
            <Image
              source={require('@/assets/images/e7d83a94-28be-4159-800f-98c51daa0f57.png')}
              style={styles.tvLogo}
              resizeMode="contain"
            />
            
            <View style={styles.tvConnectionBadgeContainer}>
              <LinearGradient
                colors={isOnline ? ['#10B981', '#059669'] : ['#EF4444', '#DC2626']}
                style={styles.tvConnectionBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.tvConnectionText}>
                  {isOnline ? '● Connected' : '● Offline'}
                </Text>
              </LinearGradient>
            </View>

            {errorMessage && (
              <View style={styles.tvErrorCard}>
                <Text style={styles.tvErrorText}>⚠️ {errorMessage}</Text>
              </View>
            )}

            {isLoading ? (
              <View style={styles.tvLoadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.tvLoadingText}>Generating code...</Text>
              </View>
            ) : authCode ? (
              <View style={styles.tvCodeContainer}>
                <LinearGradient
                  colors={['#1E293B', '#334155']}
                  style={styles.tvCodeCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                >
                  <Text style={styles.tvInstructionText}>
                    Scan QR Code or Enter Code on Web App
                  </Text>
                  
                  <View style={styles.tvQRContainer}>
                    <View style={styles.tvQRWrapper}>
                      <QRCode
                        value={authCode}
                        size={300}
                        backgroundColor="white"
                        color="black"
                      />
                    </View>
                  </View>

                  <Animated.View style={[styles.tvCodeDisplay, { transform: [{ scale: pulseAnim }] }]}>
                    <Text style={styles.tvCodeLabel}>Authentication Code</Text>
                    <Text style={styles.tvCodeText}>{authCode}</Text>
                  </Animated.View>

                  <View style={styles.tvTimerContainer}>
                    <Text style={styles.tvTimerText}>
                      {timeRemaining === 'Expired' ? '⚠️ Code Expired - Generating new code...' : `⏱️ Expires in: ${timeRemaining}`}
                    </Text>
                  </View>

                  {isCheckingAuth && (
                    <View style={styles.tvCheckingContainer}>
                      <ActivityIndicator size="small" color="#3B82F6" />
                      <Text style={styles.tvCheckingText}>Waiting for authentication...</Text>
                    </View>
                  )}
                </LinearGradient>
              </View>
            ) : (
              <View style={styles.tvLoadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.tvLoadingText}>Initializing...</Text>
              </View>
            )}

            <View style={styles.tvInfoBox}>
              <Text style={styles.tvInfoText}>
                Device ID: {deviceId || 'Loading...'}
              </Text>
              <Text style={styles.tvInfoText}>
                Code will automatically regenerate when expired or after logout
              </Text>
            </View>
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    );
  }

  // Mobile Layout
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
          <Animated.View style={[styles.mobileContent, { transform: [{ translateY: slideUpAnim }] }]}>
            <Image
              source={require('@/assets/images/e7d83a94-28be-4159-800f-98c51daa0f57.png')}
              style={styles.mobileLogo}
              resizeMode="contain"
            />
            
            <View style={styles.mobileConnectionBadgeContainer}>
              <LinearGradient
                colors={isOnline ? ['#10B981', '#059669'] : ['#EF4444', '#DC2626']}
                style={styles.mobileConnectionBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.mobileConnectionText}>
                  {isOnline ? '● Connected' : '● Offline'}
                </Text>
              </LinearGradient>
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
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.mobileLoadingText}>Generating code...</Text>
              </View>
            ) : authCode ? (
              <View style={styles.mobileCodeContainer}>
                <LinearGradient
                  colors={['#1E293B', '#334155']}
                  style={styles.mobileCodeCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                >
                  <Text style={styles.mobileInstructionText}>
                    Scan QR Code or Enter Code on Web App
                  </Text>
                  
                  <View style={styles.mobileQRContainer}>
                    <View style={styles.mobileQRWrapper}>
                      <QRCode
                        value={authCode}
                        size={200}
                        backgroundColor="white"
                        color="black"
                      />
                    </View>
                  </View>

                  <Animated.View style={[styles.mobileCodeDisplay, { transform: [{ scale: pulseAnim }] }]}>
                    <Text style={styles.mobileCodeLabel}>Authentication Code</Text>
                    <Text style={styles.mobileCodeText}>{authCode}</Text>
                  </Animated.View>

                  <View style={styles.mobileTimerContainer}>
                    <Text style={styles.mobileTimerText}>
                      {timeRemaining === 'Expired' ? '⚠️ Code Expired - Generating new code...' : `⏱️ Expires in: ${timeRemaining}`}
                    </Text>
                  </View>

                  {isCheckingAuth && (
                    <View style={styles.mobileCheckingContainer}>
                      <ActivityIndicator size="small" color="#3B82F6" />
                      <Text style={styles.mobileCheckingText}>Waiting for authentication...</Text>
                    </View>
                  )}
                </LinearGradient>
              </View>
            ) : (
              <View style={styles.mobileLoadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.mobileLoadingText}>Initializing...</Text>
              </View>
            )}

            <View style={styles.mobileInfoBox}>
              <Text style={styles.mobileInfoText}>
                Device ID: {deviceId || 'Loading...'}
              </Text>
              <Text style={styles.mobileInfoText}>
                Enter the code on your web app to authenticate this device
              </Text>
              <Text style={styles.mobileInfoText}>
                Code will automatically regenerate when expired or after logout
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    width: 240,
    height: 100,
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
  },
  mobileConnectionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  mobileWarningCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  mobileWarningText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  mobileErrorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  mobileErrorText: {
    color: '#FCA5A5',
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
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
  mobileCodeContainer: {
    width: '100%',
  },
  mobileCodeCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  mobileInstructionText: {
    color: '#FFFFFF',
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
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  mobileCodeDisplay: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  mobileCodeLabel: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  mobileCodeText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  mobileTimerContainer: {
    marginBottom: 20,
  },
  mobileTimerText: {
    color: '#93C5FD',
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
    color: '#93C5FD',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '600',
  },
  mobileInfoBox: {
    marginTop: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  mobileInfoText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 4,
  },

  // TV styles
  tvContainer: {
    flex: 1,
  },
  tvGradientBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 60,
    paddingVertical: 40,
  },
  tvContent: {
    width: '100%',
    maxWidth: 1400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tvLogo: {
    width: 400,
    height: 140,
    marginBottom: 40,
  },
  tvConnectionBadgeContainer: {
    marginBottom: 40,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tvConnectionBadge: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  tvConnectionText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  tvErrorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    width: '100%',
    maxWidth: 800,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  tvErrorText: {
    color: '#FCA5A5',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  tvLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  tvLoadingText: {
    color: '#FFFFFF',
    fontSize: 22,
    marginTop: 20,
    fontWeight: '600',
  },
  tvCodeContainer: {
    width: '100%',
  },
  tvCodeCard: {
    borderRadius: 24,
    padding: 48,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  tvInstructionText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
  },
  tvQRContainer: {
    marginBottom: 40,
  },
  tvQRWrapper: {
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tvCodeDisplay: {
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    borderWidth: 3,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  tvCodeLabel: {
    color: '#93C5FD',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  tvCodeText: {
    color: '#FFFFFF',
    fontSize: 56,
    fontWeight: 'bold',
    letterSpacing: 16,
  },
  tvTimerContainer: {
    marginBottom: 30,
  },
  tvTimerText: {
    color: '#93C5FD',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  tvCheckingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  tvCheckingText: {
    color: '#93C5FD',
    fontSize: 18,
    marginLeft: 12,
    fontWeight: '600',
  },
  tvInfoBox: {
    marginTop: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  tvInfoText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 4,
  },
});
