
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');
const isTV = width > 1000 || height > 1000;
const isMobile = width < 768;

export default function ProfileScreen() {
  const { username, screenName, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isTV && styles.scrollContentTV
        ]}
        showsVerticalScrollIndicator={true}
      >
        <View style={[styles.content, isTV && styles.contentTV]}>
          <Text style={[styles.title, isTV && styles.titleTV]}>Profile</Text>
          
          <View style={[styles.card, isTV && styles.cardTV]}>
            <View style={styles.infoRow}>
              <Text style={[styles.label, isTV && styles.labelTV]}>Username:</Text>
              <Text style={[styles.value, isTV && styles.valueTV]}>{username || 'Not set'}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={[styles.label, isTV && styles.labelTV]}>Screen Name:</Text>
              <Text style={[styles.value, isTV && styles.valueTV]}>{screenName || 'Not set'}</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.logoutButton, isTV && styles.logoutButtonTV]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={[styles.logoutButtonText, isTV && styles.logoutButtonTextTV]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: isMobile ? 48 : 60,
    paddingHorizontal: isMobile ? 20 : 40,
    paddingBottom: 140,
    minHeight: height,
  },
  scrollContentTV: {
    paddingTop: 80,
    paddingHorizontal: 80,
    paddingBottom: 200,
  },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  contentTV: {
    maxWidth: 1200,
  },
  title: {
    fontSize: isMobile ? 28 : 36,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 32,
  },
  titleTV: {
    fontSize: 56,
    marginBottom: 60,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: isMobile ? 12 : 16,
    padding: isMobile ? 20 : 28,
    marginBottom: 24,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  cardTV: {
    borderRadius: 24,
    padding: 48,
    marginBottom: 48,
  },
  infoRow: {
    paddingVertical: isMobile ? 12 : 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  label: {
    fontSize: isMobile ? 14 : 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  labelTV: {
    fontSize: 28,
    marginBottom: 12,
  },
  value: {
    fontSize: isMobile ? 16 : 20,
    fontWeight: '500',
    color: colors.text,
  },
  valueTV: {
    fontSize: 36,
  },
  logoutButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButtonTV: {
    paddingVertical: 32,
    borderRadius: 20,
  },
  logoutButtonText: {
    color: colors.card,
    fontSize: isMobile ? 16 : 18,
    fontWeight: '600',
  },
  logoutButtonTextTV: {
    fontSize: 32,
  },
});
