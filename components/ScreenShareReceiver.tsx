
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
import { colors } from '../styles/commonStyles';
import { useAuth } from '../contexts/AuthContext';
import { getScreenShareOffer, sendScreenShareAnswer } from '../utils/screenShareApi';
import { 
  createReceiverPeerConnection, 
  handleOffer, 
  addIceCandidate,
  isWebRTCAvailable,
  WebRTCPeerConnection,
  ICECandidate 
} from '../utils/webrtcService';

const POLL_INTERVAL = 2500; // Poll every 2.5 seconds
const ICE_GATHERING_TIMEOUT = 5000; // Wait 5 seconds for ICE candidates

interface ScreenShareReceiverProps {
  onClose?: () => void;
}

export default function ScreenShareReceiver({ onClose }: ScreenShareReceiverProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'polling' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const peerConnectionRef = useRef<WebRTCPeerConnection | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const iceCandidatesRef = useRef<ICECandidate[]>([]);
  const isProcessingOfferRef = useRef(false);

  // Check if WebRTC is available
  const webRTCAvailable = isWebRTCAvailable();

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('Cleaning up screen share receiver');
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.cleanup();
      peerConnectionRef.current = null;
    }
    
    iceCandidatesRef.current = [];
    isProcessingOfferRef.current = false;
  }, []);

  // Handle incoming screen share offer
  const handleScreenShareOffer = useCallback(async (offerData: any) => {
    if (isProcessingOfferRef.current) {
      console.log('Already processing an offer, skipping');
      return;
    }

    isProcessingOfferRef.current = true;
    setStatus('connecting');
    setSessionId(offerData.id);
    
    console.log('Processing screen share offer for session:', offerData.id);

    try {
      // Create peer connection
      const connection = await createReceiverPeerConnection(
        (stream) => {
          console.log('Remote stream received');
          setRemoteStream(stream);
          setStatus('connected');
        },
        (candidate) => {
          console.log('ICE candidate generated');
          iceCandidatesRef.current.push(candidate);
        },
        (state) => {
          console.log('Connection state:', state);
          if (state === 'failed' || state === 'disconnected' || state === 'closed') {
            setStatus('error');
            setErrorMessage('Connection lost');
            cleanup();
          }
        }
      );

      if (!connection) {
        throw new Error('Failed to create peer connection');
      }

      peerConnectionRef.current = connection;

      // Handle the offer and create answer
      const answerSdp = await handleOffer(connection.peerConnection, offerData.offer);
      
      if (!answerSdp) {
        throw new Error('Failed to create answer');
      }

      console.log('Answer created, waiting for ICE candidates...');

      // Wait for ICE candidates to be gathered
      await new Promise((resolve) => setTimeout(resolve, ICE_GATHERING_TIMEOUT));

      console.log('Collected', iceCandidatesRef.current.length, 'ICE candidates');

      // Send answer back to server
      if (!user?.screen_username || !user?.screen_password || !user?.screen_name) {
        throw new Error('Missing authentication credentials');
      }

      const answerResult = await sendScreenShareAnswer({
        screen_username: user.screen_username,
        screen_password: user.screen_password,
        screen_name: user.screen_name,
        session_id: offerData.id,
        answer: answerSdp,
        answer_ice_candidates: iceCandidatesRef.current,
      });

      if (!answerResult.success) {
        throw new Error(answerResult.error || 'Failed to send answer');
      }

      console.log('Answer sent successfully');

      // Add remote ICE candidates if available
      if (Array.isArray(offerData.ice_candidates)) {
        console.log('Adding', offerData.ice_candidates.length, 'remote ICE candidates');
        for (const candidate of offerData.ice_candidates) {
          await addIceCandidate(connection.peerConnection, candidate);
        }
      }

      // Stop polling once connected
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

    } catch (error) {
      console.error('Error handling screen share offer:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to establish connection');
      isProcessingOfferRef.current = false;
      cleanup();
    }
  }, [user, cleanup]);

  // Poll for screen share offers
  const pollForOffers = useCallback(async () => {
    if (!user?.screen_username || !user?.screen_password || !user?.screen_name) {
      console.log('Missing credentials, skipping poll');
      return;
    }

    if (isProcessingOfferRef.current) {
      console.log('Already processing offer, skipping poll');
      return;
    }

    try {
      const result = await getScreenShareOffer({
        screen_username: user.screen_username,
        screen_password: user.screen_password,
        screen_name: user.screen_name,
      });

      if (result.success && result.data?.session) {
        console.log('Screen share offer available');
        await handleScreenShareOffer(result.data.session);
      }
    } catch (error) {
      console.error('Error polling for offers:', error);
    }
  }, [user, handleScreenShareOffer]);

  // Start polling when component mounts
  useEffect(() => {
    if (!user?.screen_username || !user?.screen_password || !user?.screen_name) {
      setStatus('error');
      setErrorMessage('Not authenticated');
      return;
    }

    console.log('Starting screen share receiver polling');
    setStatus('polling');

    // Initial poll
    pollForOffers();

    // Set up polling interval
    pollingIntervalRef.current = setInterval(pollForOffers, POLL_INTERVAL);

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, [user, pollForOffers, cleanup]);

  // Disconnect handler
  const handleDisconnect = useCallback(() => {
    cleanup();
    setStatus('polling');
    setRemoteStream(null);
    setSessionId(null);
    setErrorMessage('');
    
    // Restart polling
    if (user?.screen_username && user?.screen_password && user?.screen_name) {
      pollingIntervalRef.current = setInterval(pollForOffers, POLL_INTERVAL);
    }
  }, [cleanup, user, pollForOffers]);

  // Close handler
  const handleClose = useCallback(() => {
    cleanup();
    if (onClose) {
      onClose();
    }
  }, [cleanup, onClose]);

  if (!webRTCAvailable) {
    return (
      <View style={styles.container}>
        <View style={styles.messageContainer}>
          <Text style={styles.title}>Screen Sharing Not Available</Text>
          <Text style={styles.message}>
            WebRTC is not available on this platform. Screen sharing requires a custom development build with react-native-webrtc.
          </Text>
          {Platform.OS === 'web' && (
            <Text style={styles.webNote}>
              Note: WebRTC screen sharing is not supported on web in this configuration.
            </Text>
          )}
          {onClose && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Render based on status
  if (status === 'error') {
    return (
      <View style={styles.container}>
        <View style={styles.messageContainer}>
          <Text style={styles.title}>Connection Error</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.retryButton} onPress={handleDisconnect}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            {onClose && (
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (status === 'connected' && remoteStream) {
    return (
      <View style={styles.container}>
        <View style={styles.videoPlaceholder}>
          <Text style={styles.videoPlaceholderText}>
            Screen share connected but video rendering requires react-native-webrtc
          </Text>
        </View>
        <View style={styles.controlsContainer}>
          <Text style={styles.sessionText}>Session: {sessionId}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
              <Text style={styles.disconnectButtonText}>Disconnect</Text>
            </TouchableOpacity>
            {onClose && (
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (status === 'connecting') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.statusText}>Connecting to screen share...</Text>
        {onClose && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Polling state
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.statusText}>Waiting for screen share...</Text>
      <Text style={styles.infoText}>
        Start a screen share from your web app to see it here
      </Text>
      {onClose && (
        <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
          <Text style={styles.cancelButtonText}>Close</Text>
        </TouchableOpacity>
      )}
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
  webNote: {
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  statusText: {
    fontSize: 18,
    color: colors.text,
    marginTop: 20,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: colors.secondaryText,
    marginTop: 12,
    textAlign: 'center',
    maxWidth: 300,
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
  },
  videoPlaceholderText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sessionText: {
    fontSize: 12,
    color: colors.text,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 12,
  },
  disconnectButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  disconnectButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
