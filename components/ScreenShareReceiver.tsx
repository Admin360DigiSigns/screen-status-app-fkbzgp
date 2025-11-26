
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../styles/commonStyles';

export default function ScreenShareReceiver() {
  return (
    <View style={styles.container}>
      <View style={styles.messageContainer}>
        <Text style={styles.title}>Screen Sharing Not Available</Text>
        <Text style={styles.message}>
          Screen sharing with WebRTC requires a custom development build with native modules.
        </Text>
        <Text style={styles.info}>
          This feature is not available in the standard Expo managed workflow due to native configuration requirements.
        </Text>
        {Platform.OS === 'web' && (
          <Text style={styles.webNote}>
            Note: WebRTC screen sharing is also not supported on web in this configuration.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  messageContainer: {
    backgroundColor: colors.cardBackground,
    padding: 24,
    borderRadius: 12,
    maxWidth: 500,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  info: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    lineHeight: 20,
  },
  webNote: {
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
