
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  Animated,
} from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { router } from 'expo-router';
import { isTV } from '@/utils/deviceUtils';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen() {
  const { login } = useAuth();
  const networkState = useNetworkState();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [screenName, setScreenName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedButton, setFocusedButton] = useState<string | null>(null);

  // Animation values
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;

  const isTVDevice = isTV();

  useEffect(() => {
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
  }, []);

  const handleLogin = async () => {
    if (!networkState.isConnected) {
      Alert.alert(
        'No Internet Connection',
        'Please connect to the internet to login.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!username.trim() || !password.trim() || !screenName.trim()) {
      Alert.alert(
        'Missing Information',
        'Please fill in all fields to continue.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    console.log('Attempting login...');

    try {
      const result = await login(username, password, screenName);
      
      if (result.success) {
        console.log('Login successful, navigating to home');
        router.replace('/(tabs)/(home)');
      } else {
        Alert.alert(
          'Login Failed',
          result.error || 'Please check your credentials and try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert(
        'Error',
        'An error occurred during login. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const animateButtonPress = () => {
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const isOnline = networkState.isConnected === true;

  // TV Layout - Professional design
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

            <View style={styles.tvFormCard}>
              <LinearGradient
                colors={['#1E293B', '#334155']}
                style={styles.tvFormGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                <View style={styles.tvInputRow}>
                  <Text style={styles.tvLabel}>Username</Text>
                  <TextInput
                    style={styles.tvInput}
                    placeholder="Enter username"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>

                <View style={styles.tvInputRow}>
                  <Text style={styles.tvLabel}>Password</Text>
                  <TextInput
                    style={styles.tvInput}
                    placeholder="Enter password"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>

                <View style={styles.tvInputRow}>
                  <Text style={styles.tvLabel}>Screen Name</Text>
                  <TextInput
                    style={styles.tvInput}
                    placeholder="e.g., Main Lobby Display"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={screenName}
                    onChangeText={setScreenName}
                    autoCapitalize="words"
                    editable={!isLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.tvLoginButton,
                    focusedButton === 'login' && styles.tvLoginButtonFocused,
                    (!isOnline || isLoading) && styles.tvLoginButtonDisabled,
                  ]}
                  onPress={handleLogin}
                  onFocus={() => setFocusedButton('login')}
                  onBlur={() => setFocusedButton(null)}
                  disabled={!isOnline || isLoading}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={focusedButton === 'login' ? ['#3B82F6', '#2563EB', '#1D4ED8'] : ['#2563EB', '#1E40AF', '#1E3A8A']}
                    style={styles.tvLoginButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.tvLoginButtonText}>
                      {isLoading ? 'Logging in...' : 'Login'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </Animated.View>
        </LinearGradient>
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
        <KeyboardAvoidingView
          style={styles.mobileKeyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.mobileScrollContent}
            keyboardShouldPersistTaps="handled"
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

              <View style={styles.mobileFormCard}>
                <LinearGradient
                  colors={['#1E293B', '#334155']}
                  style={styles.mobileFormGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                >
                  <View style={styles.mobileInputContainer}>
                    <Text style={styles.mobileLabel}>Username</Text>
                    <TextInput
                      style={styles.mobileInput}
                      placeholder="Enter username"
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                    />
                  </View>

                  <View style={styles.mobileInputContainer}>
                    <Text style={styles.mobileLabel}>Password</Text>
                    <TextInput
                      style={styles.mobileInput}
                      placeholder="Enter password"
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                    />
                  </View>

                  <View style={styles.mobileInputContainer}>
                    <Text style={styles.mobileLabel}>Screen Name</Text>
                    <TextInput
                      style={styles.mobileInput}
                      placeholder="e.g., Main Lobby Display"
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                      value={screenName}
                      onChangeText={setScreenName}
                      autoCapitalize="words"
                      editable={!isLoading}
                    />
                  </View>

                  <Animated.View style={{ transform: [{ scale: buttonScaleAnim }] }}>
                    <TouchableOpacity
                      style={[
                        styles.mobileLoginButton,
                        (!isOnline || isLoading) && styles.mobileLoginButtonDisabled,
                      ]}
                      onPress={() => {
                        animateButtonPress();
                        handleLogin();
                      }}
                      disabled={!isOnline || isLoading}
                      activeOpacity={0.9}
                    >
                      <LinearGradient
                        colors={['#2563EB', '#1E40AF', '#1E3A8A']}
                        style={styles.mobileLoginButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Text style={styles.mobileLoginButtonText}>
                          {isLoading ? 'Logging in...' : 'Login'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                </LinearGradient>
              </View>

              <View style={styles.mobileInfoBox}>
                <Text style={styles.mobileInfoText}>
                  This app monitors your display&apos;s online status and sends updates to the server.
                </Text>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Mobile styles - Professional design
  mobileContainer: {
    flex: 1,
  },
  mobileGradientBackground: {
    flex: 1,
  },
  mobileKeyboardView: {
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
  mobileFormCard: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  mobileFormGradient: {
    padding: 28,
  },
  mobileInputContainer: {
    marginBottom: 20,
  },
  mobileLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  mobileInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  mobileLoginButton: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  mobileLoginButtonDisabled: {
    opacity: 0.5,
  },
  mobileLoginButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  mobileLoginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  mobileInfoBox: {
    marginTop: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  mobileInfoText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },

  // TV styles - Professional design
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
    maxWidth: 1200,
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
  tvFormCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  tvFormGradient: {
    padding: 48,
  },
  tvInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  tvLabel: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    width: 200,
    marginRight: 24,
  },
  tvInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 18,
    fontSize: 20,
    color: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  tvLoginButton: {
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tvLoginButtonFocused: {
    elevation: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    transform: [{ scale: 1.05 }],
  },
  tvLoginButtonDisabled: {
    opacity: 0.5,
  },
  tvLoginButtonGradient: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  tvLoginButtonText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
