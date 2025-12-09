
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

export default function LogoutLoadingScreen() {
  const { isLoggingOut, logoutProgress } = useAuth();
  
  // Animation values
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeValue, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Spinning animation
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Redirect when logout is complete
  useEffect(() => {
    if (!isLoggingOut && logoutProgress === 0) {
      // Logout is complete, navigate to login
      router.replace('/login');
    }
  }, [isLoggingOut, logoutProgress]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getLoadingMessage = () => {
    if (logoutProgress < 20) {
      return 'Stopping all services...';
    } else if (logoutProgress < 40) {
      return 'Clearing authentication data...';
    } else if (logoutProgress < 60) {
      return 'Removing stored credentials...';
    } else if (logoutProgress < 80) {
      return 'Resetting application state...';
    } else if (logoutProgress < 95) {
      return 'Finalizing logout process...';
    } else {
      return 'Almost done...';
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155', '#0F172A']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Animated.View style={[styles.content, { opacity: fadeValue }]}>
          {/* Animated circles */}
          <View style={styles.circlesContainer}>
            <Animated.View
              style={[
                styles.circle,
                styles.circleOuter,
                {
                  transform: [{ rotate: spin }, { scale: pulseValue }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.circle,
                styles.circleMiddle,
                {
                  transform: [
                    {
                      rotate: spinValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['360deg', '0deg'],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View style={[styles.circle, styles.circleInner]} />
          </View>

          {/* Logout icon */}
          <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseValue }] }]}>
            <Text style={styles.icon}>🚪</Text>
          </Animated.View>

          {/* Title */}
          <Text style={styles.title}>Logging Out</Text>

          {/* Progress bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${logoutProgress}%`,
                  },
                ]}
              >
                <LinearGradient
                  colors={['#3B82F6', '#60A5FA', '#93C5FD']}
                  style={styles.progressGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </Animated.View>
            </View>
            <Text style={styles.progressText}>{Math.round(logoutProgress)}%</Text>
          </View>

          {/* Loading message */}
          <Text style={styles.message}>{getLoadingMessage()}</Text>

          {/* Info text */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Please wait while we securely clear all your data
            </Text>
            <Text style={styles.infoText}>
              This ensures a fresh start for your next login
            </Text>
          </View>

          {/* Dots animation */}
          <View style={styles.dotsContainer}>
            {[0, 1, 2].map((index) => (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    opacity: spinValue.interpolate({
                      inputRange: [0, 0.33, 0.66, 1],
                      outputRange: index === 0 ? [1, 0.3, 0.3, 1] : index === 1 ? [0.3, 1, 0.3, 0.3] : [0.3, 0.3, 1, 0.3],
                    }),
                  },
                ]}
              />
            ))}
          </View>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  circlesContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  circle: {
    position: 'absolute',
    borderRadius: 1000,
    borderWidth: 2,
  },
  circleOuter: {
    width: 200,
    height: 200,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  circleMiddle: {
    width: 140,
    height: 140,
    borderColor: 'rgba(96, 165, 250, 0.5)',
  },
  circleInner: {
    width: 80,
    height: 80,
    borderColor: 'rgba(147, 197, 253, 0.7)',
  },
  iconContainer: {
    marginBottom: 30,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 40,
    letterSpacing: 1,
  },
  progressBarContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    marginBottom: 30,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressGradient: {
    flex: 1,
  },
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#93C5FD',
  },
  message: {
    fontSize: 18,
    color: '#93C5FD',
    marginBottom: 40,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    marginHorizontal: 6,
  },
});
