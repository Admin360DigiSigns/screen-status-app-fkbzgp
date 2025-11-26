
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
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingOfferRef = useRef(false);
  const connectionAttempts = useRef(0);

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
      connectionAttempts.current = 0;

      // Initialize WebRTC service
      webrtcServiceRef.current = new WebRTCService();

      // Create peer connection
      await webrtcServiceRef.current.createPeerConnection(
        (stream) => {
          console.log('Remote stream received in component');
          console.log('Stream active:', stream.active);
          console.log('Stream tracks:', stream.getTracks().length);
          setRemoteStream(stream);
          setConnectionState('connected');
          updateDebugInfo('Connected - Stream received');
        },
        (state) => {
          console.log('Connection state updated:', state);
          setConnectionState(state);
          updateDebugInfo(`Connection state: ${state}`);
          
          if (state === 'failed') {
            connectionAttempts.current++;
            setErrorMessage(`Connection failed (attempt ${connectionAttempts.current}). This may be due to network/firewall restrictions.`);
            
            // Log detailed state for debugging
            if (webrtcServiceRef.current) {
              console.error('Connection failed - Debug info:');
              console.error('ICE connection state:', webrtcServiceRef.current.getIceConnectionState());
              console.error('ICE gathering state:', webrtcServiceRef.current.getIceGatheringState());
              console.error('Signaling state:', webrtcServiceRef.current.getSignalingState());
              console.error('Local candidates:', webrtcServiceRef.current.getLocalCandidatesCount());
            }
            
            // Retry after a delay if not too many attempts
            if (connectionAttempts.current < 3) {
              setTimeout(() => {
                console.log('Retrying connection...');
                cleanup();
                initializeScreenShare();
              }, 3000);
            } else {
              // Resume polling after max retries
              if (!isPolling) {
                startPolling();
              }
            }
          } else if (state === 'disconnected') {
            setErrorMessage('Connection lost. Waiting for reconnection...');
            // Resume polling if connection is lost
            if (!isPolling) {
              setTimeout(() => {
                startPolling();
              }, 2000);
            }
          }
        }
      );

      // Start polling for screen share offers
      startPolling();

    } catch (error) {
      console.error('Error initializing screen share:', error);
      setErrorMessage('Failed to initialize screen share receiver: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setConnectionState('failed');
    }
  };

  const updateDebugInfo = (info: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(`[${timestamp}] ${info}`);
  };

  const startPolling = () => {
    if (isPolling || !username || !password || !screenName) {
      console.log('Polling already active or credentials missing');
      return;
    }

    console.log('Starting polling for screen share offers (every 2.5 seconds)');
    setIsPolling(true);
    updateDebugInfo('Polling started');

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
    updateDebugInfo('Polling stopped');
    
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
        updateDebugInfo(`Session found: ${response.data.session.id.substring(0, 8)}`);
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
      updateDebugInfo('Polling error: ' + (error instanceof Error ? error.message : 'Unknown'));
    }
  };

  const handleNewSession = async (session: any) => {
    try {
      console.log('=== Handling new screen share session ===');
      console.log('Session ID:', session.id);
      console.log('Offer length:', session.offer?.length || 0);
      console.log('ICE candidates:', session.ice_candidates?.length || 0);
      
      setSessionId(session.id);
      setConnectionState('connecting');
      updateDebugInfo('Processing session offer');

      if (!webrtcServiceRef.current) {
        throw new Error('WebRTC service not initialized');
      }

      if (!username || !password || !screenName) {
        throw new Error('Authentication credentials not available');
      }

      // Parse ICE candidates if they're in string format
      let iceCandidates = session.ice_candidates || [];
      if (typeof iceCandidates === 'string') {
        try {
          iceCandidates = JSON.parse(iceCandidates);
        } catch (e) {
          console.error('Failed to parse ICE candidates:', e);
          iceCandidates = [];
        }
      }

      console.log('Parsed ICE candidates:', iceCandidates.length);

      // Handle the offer and create answer
      console.log('Processing offer and creating answer...');
      updateDebugInfo('Creating WebRTC answer');
      
      const { answer, answerIceCandidates } = await webrtcServiceRef.current.handleOffer(
        session.offer,
        iceCandidates
      );

      console.log('Answer created successfully');
      console.log('Answer length:', answer.length);
      console.log('Answer ICE candidates:', answerIceCandidates.length);
      updateDebugInfo(`Answer created with ${answerIceCandidates.length} ICE candidates`);

      // Send answer back to server
      console.log('Sending answer to server...');
      updateDebugInfo('Sending answer to server');
      
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
        updateDebugInfo('Answer sent - waiting for connection');
        // Connection will be established via WebRTC
        // Wait for connection state to change
      } else {
        console.error('Failed to send answer:', answerResponse.error);
        setErrorMessage('Failed to send answer: ' + answerResponse.error);
        setConnectionState('failed');
        updateDebugInfo('Failed to send answer');
        // Resume polling
        setTimeout(() => {
          startPolling();
        }, 2000);
      }

    } catch (error) {
      console.error('Error handling new session:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      setErrorMessage('Failed to establish connection: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setConnectionState('failed');
      updateDebugInfo('Session handling failed');
      isProcessingOfferRef.current = false;
      // Resume polling
      setTimeout(() => {
        startPolling();
      }, 2000);
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

  const handleRetry = () => {
    console.log('Manual retry requested');
    setErrorMessage(null);
    connectionAttempts.current = 0;
    cleanup();
    initializeScreenShare();
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
                {debugInfo && (
                  <Text style={styles.debugText}>{debugInfo}</Text>
                )}
              </>
            ) : errorMessage ? (
              <>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.errorTitle}>Connection Error</Text>
                <Text style={styles.errorText}>{errorMessage}</Text>
                {errorMessage.includes('development build') ? (
                  <View style={styles.instructionsBox}>
                    <Text style={styles.instructionsTitle}>To enable WebRTC:</Text>
                    <Text style={styles.instructionsStep}>1. Stop Expo Go</Text>
                    <Text style={styles.instructionsStep}>2. Run: npx expo prebuild</Text>
                    <Text style={styles.instructionsStep}>3. Run: npx expo run:android</Text>
                    <Text style={styles.instructionsNote}>
                      (or npx expo run:ios for iOS)
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                    <Text style={styles.retryButtonText}>Retry Connection</Text>
                  </TouchableOpacity>
                )}
                {debugInfo && (
                  <Text style={styles.debugText}>{debugInfo}</Text>
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
        {connectionAttempts.current > 0 && (
          <Text style={styles.infoText}>Attempts: {connectionAttempts.current}</Text>
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
  debugText: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    opacity: 0.7,
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
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
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
