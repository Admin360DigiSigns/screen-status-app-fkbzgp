
import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { WebRTCService } from '@/utils/webrtcService';
import { getScreenShareOffer, sendScreenShareAnswer, ScreenShareCredentials } from '@/utils/screenShareApi';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';

// Conditionally import RTCView only on native platforms
let RTCView: any = null;
let isWebRTCAvailable = false;

if (Platform.OS !== 'web') {
  try {
    const webrtc = require('react-native-webrtc');
    RTCView = webrtc.RTCView;
    isWebRTCAvailable = true;
    console.log('WebRTC loaded successfully');
  } catch (error) {
    console.error('Failed to load react-native-webrtc:', error);
    console.log('WebRTC requires a development build. It does not work in Expo Go.');
  }
}

/**
 * ScreenShareReceiver Component
 * 
 * This component receives screen share streams from a web app using WebRTC.
 * It polls the API every 2-3 seconds to check for new screen share sessions.
 * 
 * IMPORTANT: This feature requires a DEVELOPMENT BUILD and will NOT work in Expo Go.
 * To use this feature:
 * 1. Run: npx expo prebuild
 * 2. Run: npx expo run:android (or run:ios)
 * 
 * API ENDPOINTS:
 * - POST /screen-share-get-offer: Poll for new screen share sessions
 * - POST /screen-share-send-answer: Send WebRTC answer back to server
 * 
 * AUTHENTICATION:
 * Uses the same credentials as display-connect:
 * - screen_username
 * - screen_password
 * - screen_name
 */

interface ScreenShareReceiverProps {
  onClose: () => void;
}

export default function ScreenShareReceiver({ onClose }: ScreenShareReceiverProps) {
  const { username, password, screenName } = useAuth();
  const [connectionState, setConnectionState] = useState<string>('initializing');
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  
  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingOfferRef = useRef(false);

  useEffect(() => {
    console.log('ScreenShareReceiver mounted');
    console.log('Platform:', Platform.OS);
    console.log('WebRTC available:', isWebRTCAvailable);
    
    // Check if WebRTC is available
    if (Platform.OS === 'web') {
      setErrorMessage('Screen share receiver is not supported on web platform');
      setConnectionState('failed');
      return;
    }

    if (!isWebRTCAvailable || !RTCView) {
      setErrorMessage('WebRTC requires a development build. Please run:\n\n1. npx expo prebuild\n2. npx expo run:android (or run:ios)\n\nWebRTC does not work in Expo Go.');
      setConnectionState('failed');
      return;
    }

    // Check if credentials are available
    if (!username || !password || !screenName) {
      setErrorMessage('Authentication credentials not available. Please log in again.');
      setConnectionState('failed');
      return;
    }

    initializeScreenShare();

    return () => {
      console.log('ScreenShareReceiver unmounting - cleaning up');
      cleanup();
    };
  }, []);

  const initializeScreenShare = async () => {
    try {
      console.log('Initializing screen share receiver...');
      setConnectionState('waiting');

      // Initialize WebRTC service
      webrtcServiceRef.current = new WebRTCService();

      // Create peer connection
      await webrtcServiceRef.current.createPeerConnection(
        (stream) => {
          console.log('Remote stream received in component');
          setRemoteStream(stream);
          setConnectionState('connected');
        },
        (state) => {
          console.log('Connection state updated:', state);
          setConnectionState(state);
          
          if (state === 'failed' || state === 'disconnected') {
            setErrorMessage('Connection lost. Please try again.');
            // Resume polling if connection fails
            if (!isPolling) {
              startPolling();
            }
          }
        }
      );

      // Start polling for screen share offers
      startPolling();

    } catch (error) {
      console.error('Error initializing screen share:', error);
      setErrorMessage('Failed to initialize screen share receiver');
      setConnectionState('failed');
    }
  };

  const startPolling = () => {
    if (isPolling || !username || !password || !screenName) {
      console.log('Polling already active or credentials missing');
      return;
    }

    console.log('Starting polling for screen share offers (every 2.5 seconds)');
    setIsPolling(true);

    const credentials: ScreenShareCredentials = {
      screen_username: username,
      screen_password: password,
      screen_name: screenName,
    };

    // Poll immediately
    pollForOffer(credentials);

    // Then poll every 2.5 seconds
    pollingIntervalRef.current = setInterval(() => {
      pollForOffer(credentials);
    }, 2500);
  };

  const stopPolling = () => {
    console.log('Stopping polling');
    setIsPolling(false);
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const pollForOffer = async (credentials: ScreenShareCredentials) => {
    // Skip if already processing an offer
    if (isProcessingOfferRef.current) {
      console.log('Already processing an offer, skipping poll');
      return;
    }

    try {
      const response = await getScreenShareOffer(credentials);

      if (!response.success) {
        // Handle authentication errors
        if (response.status === 401) {
          console.error('Authentication failed:', response.error);
          setErrorMessage('Invalid credentials. Please log in again.');
          setConnectionState('failed');
          stopPolling();
        } else {
          console.error('Error getting offer:', response.error);
        }
        return;
      }

      // Check if there's a session available
      if (response.data?.session) {
        console.log('New screen share session available:', response.data.session.id);
        isProcessingOfferRef.current = true;
        stopPolling(); // Stop polling while processing
        await handleNewSession(response.data.session);
        isProcessingOfferRef.current = false;
      } else {
        // No session available, continue polling
        console.log('No screen share session available');
      }
    } catch (error) {
      console.error('Error polling for offer:', error);
    }
  };

  const handleNewSession = async (session: any) => {
    try {
      console.log('Handling new screen share session:', session.id);
      setSessionId(session.id);
      setConnectionState('connecting');

      if (!webrtcServiceRef.current) {
        throw new Error('WebRTC service not initialized');
      }

      if (!username || !password || !screenName) {
        throw new Error('Authentication credentials not available');
      }

      // Handle the offer and create answer
      console.log('Processing offer and creating answer...');
      const { answer, answerIceCandidates } = await webrtcServiceRef.current.handleOffer(
        session.offer,
        session.ice_candidates || []
      );

      console.log('Answer created with', answerIceCandidates.length, 'ICE candidates');

      // Send answer back to server
      const answerResponse = await sendScreenShareAnswer({
        screen_username: username,
        screen_password: password,
        screen_name: screenName,
        session_id: session.id,
        answer: answer,
        answer_ice_candidates: answerIceCandidates,
      });

      if (answerResponse.success) {
        console.log('Answer sent successfully:', answerResponse.data?.message);
        // Connection will be established via WebRTC
      } else {
        console.error('Failed to send answer:', answerResponse.error);
        setErrorMessage('Failed to establish connection: ' + answerResponse.error);
        setConnectionState('failed');
        // Resume polling
        startPolling();
      }

    } catch (error) {
      console.error('Error handling new session:', error);
      setErrorMessage('Failed to establish connection');
      setConnectionState('failed');
      isProcessingOfferRef.current = false;
      // Resume polling
      startPolling();
    }
  };

  const cleanup = () => {
    console.log('Cleaning up screen share receiver');

    // Stop polling
    stopPolling();

    // Close WebRTC connection
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.close();
      webrtcServiceRef.current = null;
    }

    // Clear state
    setRemoteStream(null);
    setSessionId(null);
    isProcessingOfferRef.current = false;
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'initializing':
        return 'Initializing...';
      case 'waiting':
        return isPolling ? 'Waiting for screen share...' : 'Ready';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'failed':
        return 'Connection Failed';
      default:
        return connectionState;
    }
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return colors.accent;
      case 'connecting':
      case 'waiting':
        return colors.primary;
      case 'failed':
      case 'disconnected':
        return colors.secondary;
      default:
        return colors.textSecondary;
    }
  };

  return (
    <View style={styles.container}>
      {/* Close button */}
      <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
        <Text style={styles.closeButtonText}>✕ Close</Text>
      </TouchableOpacity>

      {/* Status indicator */}
      <View style={styles.statusBar}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.statusText}>{getStatusText()}</Text>
        {isPolling && (
          <ActivityIndicator 
            size="small" 
            color={colors.primary} 
            style={styles.pollingIndicator}
          />
        )}
      </View>

      {/* Main content area */}
      <View style={styles.contentArea}>
        {remoteStream && RTCView ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.videoView}
            objectFit="contain"
          />
        ) : (
          <View style={styles.placeholderContainer}>
            {connectionState === 'waiting' || connectionState === 'connecting' ? (
              <>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.placeholderText}>
                  {connectionState === 'waiting'
                    ? 'Waiting for screen share from web app...'
                    : 'Establishing connection...'}
                </Text>
                <Text style={styles.instructionText}>
                  Open the web app on your desktop and start screen sharing
                </Text>
                {isPolling && (
                  <Text style={styles.pollingText}>
                    Polling for offers every 2.5 seconds...
                  </Text>
                )}
              </>
            ) : errorMessage ? (
              <>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.errorTitle}>Error</Text>
                <Text style={styles.errorText}>{errorMessage}</Text>
                {errorMessage.includes('development build') && (
                  <View style={styles.instructionsBox}>
                    <Text style={styles.instructionsTitle}>To enable WebRTC:</Text>
                    <Text style={styles.instructionsStep}>1. Stop Expo Go</Text>
                    <Text style={styles.instructionsStep}>2. Run: npx expo prebuild</Text>
                    <Text style={styles.instructionsStep}>3. Run: npx expo run:android</Text>
                    <Text style={styles.instructionsNote}>
                      (or npx expo run:ios for iOS)
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.placeholderText}>Initializing...</Text>
            )}
          </View>
        )}
      </View>

      {/* Info footer */}
      <View style={styles.infoFooter}>
        <Text style={styles.infoText}>Screen: {screenName}</Text>
        {sessionId && (
          <Text style={styles.infoText}>Session: {sessionId.substring(0, 8)}...</Text>
        )}
        {isPolling && (
          <Text style={styles.infoText}>Status: Polling for offers</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    backgroundColor: colors.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    zIndex: 100,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.3)',
    elevation: 5,
  },
  closeButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingTop: 64,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  pollingIndicator: {
    marginLeft: 12,
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoView: {
    flex: 1,
    backgroundColor: '#000',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  warningIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  pollingText: {
    fontSize: 12,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  instructionsBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  instructionsStep: {
    fontSize: 14,
    color: colors.text,
    marginVertical: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  instructionsNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  infoFooter: {
    backgroundColor: colors.card,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 2,
  },
});
