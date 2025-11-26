
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
  Image,
} from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { router } from 'expo-router';
import { isTV } from '@/utils/deviceUtils';

export default function LoginScreen() {
  const { login } = useAuth();
  const networkState = useNetworkState();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [screenName, setScreenName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isTVDevice = isTV();

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

  // TV Layout - Single screen, no scrolling
  if (isTVDevice) {
    return (
      <View style={styles.tvContainer}>
        <View style={styles.tvContent}>
          <Image
            source={require('@/assets/images/e7d83a94-28be-4159-800f-98c51daa0f57.png')}
            style={styles.tvLogo}
            resizeMode="contain"
          />
          
          <View style={[styles.tvConnectionBadge, { backgroundColor: isOnline ? colors.accent : colors.secondary }]}>
            <Text style={styles.tvConnectionText}>
              {isOnline ? '● Connected' : '● Offline'}
            </Text>
          </View>

          <View style={styles.tvFormCard}>
            <View style={styles.tvInputRow}>
              <Text style={styles.tvLabel}>Username</Text>
              <TextInput
                style={styles.tvInput}
                placeholder="Enter username"
                placeholderTextColor={colors.textSecondary}
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
                placeholderTextColor={colors.textSecondary}
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
                placeholderTextColor={colors.textSecondary}
                value={screenName}
                onChangeText={setScreenName}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.tvLoginButton,
                (!isOnline || isLoading) && styles.tvLoginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={!isOnline || isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.tvLoginButtonText}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Mobile Layout - Original scrollable design
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Image
            source={require('@/assets/images/e7d83a94-28be-4159-800f-98c51daa0f57.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          
          <View style={[styles.connectionBadge, { backgroundColor: isOnline ? colors.accent : colors.secondary }]}>
            <Text style={styles.connectionText}>
              {isOnline ? '● Connected' : '● Offline'}
            </Text>
          </View>

          {!isOnline && (
            <View style={styles.warningCard}>
              <Text style={styles.warningText}>
                ⚠️ Internet connection required to login
              </Text>
            </View>
          )}

          <View style={styles.formCard}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
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
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
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
              <Text style={styles.label}>Screen Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Main Lobby Display"
                placeholderTextColor={colors.textSecondary}
                value={screenName}
                onChangeText={setScreenName}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.loginButton,
                (!isOnline || isLoading) && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={!isOnline || isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.infoText}>
            This app monitors your TV&apos;s online status and sends updates to the server.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Mobile styles
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 48,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logo: {
    width: 280,
    height: 120,
    marginBottom: 32,
  },
  connectionBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  connectionText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
  },
  warningCard: {
    backgroundColor: colors.highlight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    maxWidth: 500,
  },
  warningText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 500,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
    elevation: 4,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.6,
  },
  loginButtonText: {
    color: colors.card,
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoText: {
    marginTop: 32,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },

  // TV styles - optimized for single screen display
  tvContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tvContent: {
    width: '85%',
    maxWidth: 1200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tvLogo: {
    width: 350,
    height: 140,
    marginBottom: 30,
  },
  tvConnectionBadge: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 30,
  },
  tvConnectionText: {
    color: colors.card,
    fontSize: 22,
    fontWeight: '700',
  },
  tvFormCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 40,
    width: '100%',
    boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.2)',
    elevation: 6,
  },
  tvInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  tvLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    width: 180,
    marginRight: 20,
  },
  tvInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 20,
    color: colors.text,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  tvLoginButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  tvLoginButtonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.6,
  },
  tvLoginButtonText: {
    color: colors.card,
    fontSize: 24,
    fontWeight: 'bold',
  },
});
