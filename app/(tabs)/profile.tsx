
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';

export default function ProfileScreen() {
  const { username, screenName, logout } = useAuth();

  const handleLogout = async () => {
    const platformMessage = Platform.OS === 'ios' 
      ? 'Logging out will:\n\n• Clear all credentials\n• Clear backend authentication\n• Require manual app restart\n\nYou will need to manually close and reopen the app after logout.'
      : 'Logging out will:\n\n• Clear all credentials\n• Clear backend authentication\n• Close the app completely\n\nReopen the app to login again.';
    
    Alert.alert(
      'Confirm Logout',
      platformMessage,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            console.log('User confirmed logout - initiating complete logout process');
            await logout();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Username:</Text>
          <Text style={styles.value}>{username || 'Not set'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Screen Name:</Text>
          <Text style={styles.value}>{screenName || 'Not set'}</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
      
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>ℹ️ Logout Process</Text>
        <Text style={styles.infoText}>
          When you logout, the app will:
        </Text>
        <Text style={styles.bulletPoint}>• Clear all local credentials</Text>
        <Text style={styles.bulletPoint}>• Clear backend authentication state</Text>
        <Text style={styles.bulletPoint}>• Send offline status to server</Text>
        {Platform.OS === 'ios' ? (
          <Text style={styles.bulletPoint}>• Require manual app restart (iOS limitation)</Text>
        ) : (
          <Text style={styles.bulletPoint}>• Close the app completely</Text>
        )}
        <Text style={[styles.infoText, { marginTop: 12 }]}>
          This ensures a complete logout with no cached data.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 32,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.text,
  },
  logoutButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: colors.card,
    fontSize: 18,
    fontWeight: '600',
  },
  infoBox: {
    marginTop: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  bulletPoint: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginLeft: 8,
  },
});
