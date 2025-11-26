
import React, { useState } from 'react';
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
  Dimensions,
  Image,
} from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');
const isTV = width > 1000 || height > 1000;
const isMobile = width < 768;

export default function LoginScreen() {
  const { login } = useAuth();
  const networkState = useNetworkState();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [screenName, setScreenName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const isOnline = networkState.isConnected === true;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTV && styles.scrollContentTV
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        <View style={[styles.content, isTV && styles.contentTV]}>
          {/* Logo */}
          <Image
            source={require('@/assets/images/d079802c-d5af-4189-8d0a-949785f2f7f3.png')}
            style={[styles.logo, isTV && styles.logoTV]}
            resizeMode="contain"
          />
          
          {/* Smaller Online Status Badge */}
          <View style={[
            styles.connectionBadge, 
            { backgroundColor: isOnline ? colors.logoGreen : colors.secondary },
            isTV && styles.connectionBadgeTV
          ]}>
            <Text style={[styles.connectionText, isTV && styles.connectionTextTV]}>
              {isOnline ? '● Online' : '● Offline'}
            </Text>
          </View>

          {!isOnline && (
            <View style={[styles.warningCard, isTV && styles.warningCardTV]}>
              <Text style={[styles.warningText, isTV && styles.warningTextTV]}>
                ⚠️ Internet connection required to login
              </Text>
            </View>
          )}

          <View style={[styles.formCard, isTV && styles.formCardTV]}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isTV && styles.labelTV]}>Username</Text>
              <TextInput
                style={[styles.input, isTV && styles.inputTV]}
                placeholder="Enter username"
                placeholderTextColor={colors.textSecondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isTV && styles.labelTV]}>Password</Text>
              <TextInput
                style={[styles.input, isTV && styles.inputTV]}
                placeholder="Enter password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, isTV && styles.labelTV]}>Screen Name</Text>
              <TextInput
                style={[styles.input, isTV && styles.inputTV]}
                placeholder="e.g., Main Lobby Display"
                placeholderTextColor={colors.textSecondary}
                value={screenName}
                onChangeText={setScreenName}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>

            {/* Login Button with Blue color from logo */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                isTV && styles.loginButtonTV,
                (!isOnline || isLoading) && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={!isOnline || isLoading}
              activeOpacity={0.7}
            >
              <Text style={[styles.loginButtonText, isTV && styles.loginButtonTextTV]}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.infoText, isTV && styles.infoTextTV]}>
            This app monitors your display&apos;s online status and sends updates to the server.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: isMobile ? 48 : 60,
    paddingHorizontal: isMobile ? 20 : 40,
    paddingBottom: 60,
    minHeight: height,
  },
  scrollContentTV: {
    paddingTop: 80,
    paddingHorizontal: 80,
    paddingBottom: 100,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  contentTV: {
    maxWidth: 1200,
  },
  logo: {
    width: isMobile ? 280 : 360,
    height: isMobile ? 120 : 160,
    marginBottom: 32,
  },
  logoTV: {
    width: 600,
    height: 260,
    marginBottom: 60,
  },
  connectionBadge: {
    paddingHorizontal: isMobile ? 12 : 16,
    paddingVertical: isMobile ? 6 : 8,
    borderRadius: 16,
    marginBottom: 24,
  },
  connectionBadgeTV: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    marginBottom: 48,
  },
  connectionText: {
    color: colors.card,
    fontSize: isMobile ? 12 : 14,
    fontWeight: '600',
  },
  connectionTextTV: {
    fontSize: 24,
  },
  warningCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  warningCardTV: {
    borderRadius: 20,
    padding: 32,
    marginBottom: 48,
    borderWidth: 2,
  },
  warningText: {
    color: colors.text,
    fontSize: isMobile ? 13 : 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  warningTextTV: {
    fontSize: 28,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: isMobile ? 12 : 16,
    padding: isMobile ? 24 : 32,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
    elevation: 4,
  },
  formCardTV: {
    borderRadius: 24,
    padding: 60,
    borderWidth: 2,
  },
  inputContainer: {
    marginBottom: isMobile ? 20 : 24,
  },
  label: {
    fontSize: isMobile ? 14 : 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  labelTV: {
    fontSize: 32,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: isMobile ? 14 : 18,
    color: colors.text,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  inputTV: {
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 24,
    fontSize: 28,
    borderWidth: 3,
  },
  loginButton: {
    backgroundColor: colors.logoBlue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonTV: {
    borderRadius: 20,
    paddingVertical: 32,
    marginTop: 16,
  },
  loginButtonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.6,
  },
  loginButtonText: {
    color: colors.card,
    fontSize: isMobile ? 16 : 20,
    fontWeight: 'bold',
  },
  loginButtonTextTV: {
    fontSize: 36,
  },
  infoText: {
    marginTop: 32,
    fontSize: isMobile ? 13 : 16,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: isMobile ? 16 : 32,
    lineHeight: isMobile ? 18 : 24,
  },
  infoTextTV: {
    marginTop: 60,
    fontSize: 24,
    lineHeight: 36,
    paddingHorizontal: 60,
  },
});
