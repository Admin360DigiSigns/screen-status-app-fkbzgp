
import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Platform, ScrollView } from 'react-native';
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
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  
  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingOfferRef = useRef(false);
  const connectionAttempts = useRef(0);
  const maxConnectionAttempts = 3;

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    setDebugLogs(prev => [...prev.slice(-50), logEntry]); // Keep last 50 logs
  };

  useEffect(() => {
    addDebugLog('ScreenShareReceiver mounted');
    addDebugLog(`Platform: ${Platform.OS}`);
    addDebugLog(`WebRTC available: ${isWebRTCAvailable}`);
    
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
      addDebugLog('ScreenShareReceiver unmounting - cleaning up');
      cleanup();
    };
  }, []);

  const initializeScreenShare = async () => {
    try {
      addDebugLog('Initializing screen share receiver...');
      setConnectionState('waiting');
      connectionAttempts.current = 0;

      // Initialize WebRTC service
      webrtcServiceRef.current = new WebRTCService();
      addDebugLog('WebRTC service created');

      // Create peer connection
      await webrtcServiceRef.current.createPeerConnection(
        (stream) => {
          addDebugLog('✅ Remote stream received in component');
          addDebugLog(`Stream active: ${stream.active}`);
          addDebugLog(`Stream tracks: ${stream.getTracks().length}`);
          setRemoteStream(stream);
          setConnectionState('connected');
          setErrorMessage(null);
        },
        (state) => {
          addDebugLog(`Connection state updated: ${state}`);
          setConnectionState(state);
          
          if (state === 'failed') {
            connectionAttempts.current++;
            addDebugLog(`❌ Connection failed (attempt ${connectionAttempts.current}/${maxConnectionAttempts})`);
            setErrorMessage(`Connection failed (attempt ${connectionAttempts.current}/${maxConnectionAttempts}). This may be due to network/firewall restrictions.`);
            
            // Log detailed state for debugging
            if (webrtcServiceRef.current) {
              addDebugLog(`ICE connection state: ${webrtcServiceRef.current.getIceConnectionState()}`);
              addDebugLog(`ICE gathering state: ${webrtcServiceRef.current.getIceGatheringState()}`);
              addDebugLog(`Signaling state: ${webrtcServiceRef.current.getSignalingState()}`);
              addDebugLog(`Local candidates: ${webrtcServiceRef.current.getLocalCandidatesCount()}`);
            }
            
            // Retry after a delay if not too many attempts
            if (connectionAttempts.current < maxConnectionAttempts) {
              addDebugLog(`Retrying in 3 seconds...`);
              setTimeout(() => {
                addDebugLog('Retrying connection...');
                cleanup();
                initializeScreenShare();
              }, 3000);
            } else {
              addDebugLog('Max connection attempts reached. Resuming polling.');
              // Resume polling after max retries
              if (!isPolling) {
                setTimeout(() => {
                  startPolling();
                }, 2000);
              }
            }
          } else if (state === 'disconnected') {
            addDebugLog('⚠️ Connection lost. Waiting for reconnection...');
            setErrorMessage('Connection lost. Waiting for reconnection...');
            // Resume polling if connection is lost
            if (!isPolling) {
              setTimeout(() => {
                startPolling();
              }, 2000);
            }
          } else if (state === 'connected') {
            addDebugLog('✅ Connection established successfully!');
            setErrorMessage(null);
            // Stop polling when connected
            stopPolling();
          }
        }
      );

      addDebugLog('Peer connection created');

      // Start polling for screen share offers
      startPolling();

    } catch (error) {
      addDebugLog(`❌ Error initializing screen share: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setErrorMessage('Failed to initialize screen share receiver: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setConnectionState('failed');
    }
  };

  const startPolling = () => {
    if (isPolling || !username || !password || !screenName) {
      addDebugLog('Polling already active or credentials missing');
      return;
    }

    addDebugLog('Starting polling for screen share offers (every 2.5 seconds)');
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
    addDebugLog('Stopping polling');
    setIsPolling(false);
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const pollForOffer = async (credentials: ScreenShareCredentials) => {
    // Skip if already processing an offer
    if (isProcessingOfferRef.current) {
      return;
    }

    try {
      const response = await getScreenShareOffer(credentials);

      if (!response.success) {
        // Handle authentication errors
        if (response.status === 401) {
          addDebugLog('❌ Authentication failed');
          setErrorMessage('Invalid credentials. Please log in again.');
          setConnectionState('failed');
          stopPolling();
        }
        return;
      }

      // Check if there's a session available
      if (response.data?.session) {
        addDebugLog(`✅ New screen share session available: ${response.data.session.id}`);
        isProcessingOfferRef.current = true;
        stopPolling(); // Stop polling while processing
        await handleNewSession(response.data.session);
        isProcessingOfferRef.current = false;
      }
    } catch (error) {
      addDebugLog(`❌ Error polling for offer: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  };

  const handleNewSession = async (session: any) => {
    try {
      addDebugLog('=== Handling new screen share session ===');
      addDebugLog(`Session ID: ${session.id}`);
      addDebugLog(`Offer length: ${session.offer?.length || 0}`);
      addDebugLog(`ICE candidates: ${session.ice_candidates?.length || 0}`);
      
      setSessionId(session.id);
      setConnectionState('connecting');

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
          addDebugLog('❌ Failed to parse ICE candidates');
          iceCandidates = [];
        }
      }

      addDebugLog(`Parsed ICE candidates: ${iceCandidates.length}`);

      // Handle the offer and create answer
      addDebugLog('Processing offer and creating answer...');
      
      const { answer, answerIceCandidates } = await webrtcServiceRef.current.handleOffer(
        session.offer,
        iceCandidates
      );

      addDebugLog('✅ Answer created successfully');
      addDebugLog(`Answer length: ${answer.length}`);
      addDebugLog(`Answer ICE candidates: ${answerIceCandidates.length}`);

      // Send answer back to server
      addDebugLog('Sending answer to server...');
      
      const answerResponse = await sendScreenShareAnswer({
        screen_username: username,
        screen_password: password,
        screen_name: screenName,
        session_id: session.id,
        answer: answer,
        answer_ice_candidates: answerIceCandidates,
      });

      if (answerResponse.success) {
        addDebugLog(`✅ Answer sent successfully: ${answerResponse.data?.message}`);
        // Connection will be established via WebRTC
        // Wait for connection state to change
      } else {
        addDebugLog(`❌ Failed to send answer: ${answerResponse.error}`);
        setErrorMessage('Failed to send answer: ' + answerResponse.error);
        setConnectionState('failed');
        // Resume polling
        setTimeout(() => {
          startPolling();
        }, 2000);
      }

    } catch (error) {
      addDebugLog(`❌ Error handling new session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setErrorMessage('Failed to establish connection: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setConnectionState('failed');
      isProcessingOfferRef.current = false;
      // Resume polling
      setTimeout(() => {
        startPolling();
      }, 2000);
    }
  };

  const cleanup = () => {
    addDebugLog('Cleaning up screen share receiver');

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
    addDebugLog('Manual retry requested');
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
            mirror={false}
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
              </>
            ) : (
              <Text style={styles.placeholderText}>Initializing...</Text>
            )}
          </View>
        )}
      </View>

      {/* Info footer */}
      <View style={styles.infoFooter}>
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>Screen: {screenName}</Text>
          {sessionId && (
            <Text style={styles.infoText}>Session: {sessionId.substring(0, 8)}...</Text>
          )}
        </View>
        <View style={styles.infoRow}>
          {connectionAttempts.current > 0 && (
            <Text style={styles.infoText}>Attempts: {connectionAttempts.current}/{maxConnectionAttempts}</Text>
          )}
          {isPolling && (
            <Text style={styles.infoText}>Status: Polling</Text>
          )}
        </View>
        <TouchableOpacity 
          style={styles.debugToggle}
          onPress={() => setShowDebugLogs(!showDebugLogs)}
        >
          <Text style={styles.debugToggleText}>
            {showDebugLogs ? '▼ Hide Debug Logs' : '▶ Show Debug Logs'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Debug logs panel */}
      {showDebugLogs && (
        <View style={styles.debugPanel}>
          <ScrollView style={styles.debugScrollView}>
            {debugLogs.map((log, index) => (
              <Text key={index} style={styles.debugLogText}>{log}</Text>
            ))}
          </ScrollView>
        </View>
      )}
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  debugToggle: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  debugToggleText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  debugPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 250,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 2,
    borderTopColor: colors.primary,
  },
  debugScrollView: {
    flex: 1,
    padding: 12,
  },
  debugLogText: {
    fontSize: 10,
    color: '#00ff00',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 2,
  },
});
