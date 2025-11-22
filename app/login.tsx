
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
} from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { router } from 'expo-router';

export default function LoginScreen() {
  const { login } = useAuth();
  const networkState = useNetworkState();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [screenName, setScreenName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string>('');

  const handleLogin = async () => {
    console.log('=== LOGIN BUTTON PRESSED ===');
    console.log('Network state:', networkState);
    
    if (!networkState.isConnected) {
      console.log('No internet connection');
      Alert.alert(
        'No Internet Connection',
        'Please connect to the internet to login.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!username.trim() || !password.trim() || !screenName.trim()) {
      console.log('Missing fields');
      Alert.alert(
        'Missing Information',
        'Please fill in all fields to continue.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    setErrorDetails('');
    console.log('Starting login process...');
    console.log('Username:', username);
    console.log('Screen Name:', screenName);

    try {
      const result = await login(username, password, screenName);
      
      console.log('Login result:', result);
      
      if (result.success) {
        console.log('✅ Login successful, navigating to home');
        router.replace('/(tabs)/(home)');
      } else {
        console.log('❌ Login failed:', result.error);
        setErrorDetails(result.error || 'Unknown error');
        Alert.alert(
          'Login Failed',
          result.error || 'Please check your credentials and try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Login exception:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during login';
      setErrorDetails(errorMessage);
      Alert.alert(
        'Error',
        errorMessage + '\n\nPlease check the console logs for more details.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
      console.log('Login process completed');
    }
  };

  const isOnline = networkState.isConnected === true;

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
          <Text style={styles.title}>TV App Login</Text>
          
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

          {errorDetails && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Error Details:</Text>
              <Text style={styles.errorText}>{errorDetails}</Text>
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

          <View style={styles.debugCard}>
            <Text style={styles.debugTitle}>Debug Info:</Text>
            <Text style={styles.debugText}>Network: {networkState.type || 'Unknown'}</Text>
            <Text style={styles.debugText}>Connected: {String(networkState.isConnected)}</Text>
            <Text style={styles.debugText}>Internet Reachable: {String(networkState.isInternetReachable)}</Text>
          </View>

          <Text style={styles.infoText}>
            This app monitors your TV&apos;s online status and sends updates to the server.
          </Text>
          
          <Text style={styles.infoText}>
            Check the console logs for detailed debugging information.
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
    paddingTop: 48,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
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
  errorCard: {
    backgroundColor: '#ff4444',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    maxWidth: 500,
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
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
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.background,
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
  debugCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    width: '100%',
    maxWidth: 500,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  infoText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});
