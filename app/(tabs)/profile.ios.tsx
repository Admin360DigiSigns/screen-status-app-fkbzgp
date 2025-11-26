
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Image } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';

export default function ProfileScreen() {
  const { username, screenName, logout } = useAuth();

  // Animation values
  const logoGlowAnim = useRef(new Animated.Value(0)).current;
  const logoScaleAnim = useRef(new Animated.Value(1)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;

  // Logo glow animation
  useEffect(() => {
    const logoGlow = Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlowAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(logoGlowAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    );
    logoGlow.start();
    return () => logoGlow.stop();
  }, []);

  // Logo scale animation
  useEffect(() => {
    const logoScale = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScaleAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(logoScaleAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    logoScale.start();
    return () => logoScale.stop();
  }, []);

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeInAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const logoGlowColor = logoGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(59, 130, 246, 0.3)', 'rgba(168, 85, 247, 0.6)'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeInAnim }]}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Logo with glow effect */}
          <Animated.View style={[styles.logoContainer, { shadowColor: logoGlowColor }]}>
            <View style={styles.logoGlowWrapper}>
              <Animated.View style={[styles.logoGlow, { backgroundColor: logoGlowColor }]} />
              <Animated.View style={[styles.logoGlow2, { backgroundColor: logoGlowColor, opacity: 0.5 }]} />
            </View>
            <Animated.Image
              source={require('@/assets/images/0bd1582e-6ccf-4e31-967e-71dccf6a0b14.png')}
              style={[styles.logo, { transform: [{ scale: logoScaleAnim }] }]}
              resizeMode="contain"
            />
          </Animated.View>

          <Text style={styles.title}>Profile</Text>
          
          <View style={styles.card}>
            <LinearGradient
              colors={['#1E293B', '#334155']}
              style={styles.cardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <View style={styles.infoRow}>
                <Text style={styles.label}>Username:</Text>
                <Text style={styles.value}>{username || 'Not set'}</Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.label}>Screen Name:</Text>
                <Text style={styles.value}>{screenName || 'Not set'}</Text>
              </View>
            </LinearGradient>
          </View>

          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#DC2626', '#B91C1C', '#991B1B']}
              style={styles.logoutButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.logoutButtonText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 140,
    alignItems: 'center',
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 24,
    elevation: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  logoGlowWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 240,
    height: 100,
    borderRadius: 50,
    opacity: 0.4,
  },
  logoGlow2: {
    position: 'absolute',
    width: 280,
    height: 120,
    borderRadius: 60,
    opacity: 0.2,
  },
  logo: {
    width: 220,
    height: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 32,
    letterSpacing: 1,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardGradient: {
    padding: 24,
  },
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  logoutButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
