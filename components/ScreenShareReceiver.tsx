
import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { supabase } from '@/utils/supabaseClient';
import { WebRTCService, ScreenShareSession } from '@/utils/webrtcService';
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
 * 
 * IMPORTANT: This feature requires a DEVELOPMENT BUILD and will NOT work in Expo Go.
 * To use this feature:
 * 1. Run: npx expo prebuild
 * 2. Run: npx expo run:android (or run:ios)
 * 
 * SETUP REQUIREMENTS:
 * 1. Update utils/supabaseClient.ts with your Supabase anon key
 * 2. Create a 'screen_share_sessions' table in Supabase with the following schema:
 *    - id (uuid, primary key)
 *    - display_id (text) - matches the device ID
 *    - offer (text) - WebRTC offer from web app
 *    - answer (text) - WebRTC answer from Android app
 *    - ice_candidates (text) - ICE candidates from web app
 *    - answer_ice_candidates (text) - ICE candidates from Android app
 *    - status (text) - 'waiting', 'connected', or 'ended'
 *    - created_at (timestamp)
 * 3. Enable Realtime on the 'screen_share_sessions' table in Supabase
 * 4. Set up appropriate RLS policies for the table
 * 
 * HOW IT WORKS:
 * 1. Web app creates a screen share offer and stores it in Supabase
 * 2. This component listens for new offers via Supabase Realtime
 * 3. When an offer is received, it creates a WebRTC answer
 * 4. The answer is sent back to the web app via Supabase
 * 5. A peer-to-peer WebRTC connection is established
 * 6. The screen share stream is displayed in this component
 */

interface ScreenShareReceiverProps {
  onClose: () => void;
}

export default function ScreenShareReceiver({ onClose }: ScreenShareReceiverProps) {
  const { deviceId, screenName } = useAuth();
  const [connectionState, setConnectionState] = useState<string>('initializing');
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const channelRef = useRef<any>(null);
  const iceCandidatesRef = useRef<string[]>([]);

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
          }
        }
      );

      // Subscribe to Supabase Realtime for screen share sessions
      await subscribeToScreenShareSessions();

    } catch (error) {
      console.error('Error initializing screen share:', error);
      setErrorMessage('Failed to initialize screen share receiver');
      setConnectionState('failed');
    }
  };

  const subscribeToScreenShareSessions = async () => {
    try {
      console.log('Subscribing to screen share sessions...');
      console.log('Device ID:', deviceId);

      // Create a channel for screen share sessions
      const channel = supabase.channel('screen-share-sessions');

      // Listen for INSERT events on screen_share_sessions table
      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'screen_share_sessions',
            filter: `display_id=eq.${deviceId}`,
          },
          async (payload) => {
            console.log('New screen share session received:', payload);
            await handleNewSession(payload.new as ScreenShareSession);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'screen_share_sessions',
            filter: `display_id=eq.${deviceId}`,
          },
          async (payload) => {
            console.log('Screen share session updated:', payload);
            const session = payload.new as ScreenShareSession;
            
            // Handle ICE candidates from web app
            if (session.ice_candidates && session.id === sessionId) {
              await handleRemoteIceCandidates(session.ice_candidates);
            }
          }
        )
        .subscribe((status) => {
          console.log('Subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to screen share sessions');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Channel subscription error');
            setErrorMessage('Failed to connect to screen share service. Check Supabase configuration.');
          }
        });

      channelRef.current = channel;

    } catch (error) {
      console.error('Error subscribing to screen share sessions:', error);
      setErrorMessage('Failed to subscribe to screen share updates');
    }
  };

  const handleNewSession = async (session: ScreenShareSession) => {
    try {
      console.log('Handling new screen share session:', session.id);
      setSessionId(session.id);
      setConnectionState('connecting');

      if (!webrtcServiceRef.current) {
        throw new Error('WebRTC service not initialized');
      }

      // Handle the offer and create answer
      const answer = await webrtcServiceRef.current.handleOffer(
        session.offer,
        async (candidate) => {
          // Store ICE candidates
          iceCandidatesRef.current.push(JSON.stringify(candidate));
          
          // Send ICE candidates to web app via Supabase
          await updateSessionWithAnswer(session.id, null, iceCandidatesRef.current);
        }
      );

      // Send answer back to web app
      await updateSessionWithAnswer(session.id, answer, iceCandidatesRef.current);

      console.log('Answer sent to web app');

    } catch (error) {
      console.error('Error handling new session:', error);
      setErrorMessage('Failed to establish connection');
      setConnectionState('failed');
    }
  };

  const updateSessionWithAnswer = async (
    sessionId: string,
    answer: string | null,
    iceCandidates: string[]
  ) => {
    try {
      const updateData: any = {
        status: 'connected',
      };

      if (answer) {
        updateData.answer = answer;
      }

      if (iceCandidates.length > 0) {
        updateData.answer_ice_candidates = JSON.stringify(iceCandidates);
      }

      const { error } = await supabase
        .from('screen_share_sessions')
        .update(updateData)
        .eq('id', sessionId);

      if (error) {
        console.error('Error updating session:', error);
      } else {
        console.log('Session updated successfully');
      }
    } catch (error) {
      console.error('Error updating session with answer:', error);
    }
  };

  const handleRemoteIceCandidates = async (iceCandidatesJson: string) => {
    try {
      const candidates = JSON.parse(iceCandidatesJson);
      
      if (Array.isArray(candidates) && webrtcServiceRef.current) {
        for (const candidate of candidates) {
          await webrtcServiceRef.current.addIceCandidate(candidate);
        }
      }
    } catch (error) {
      console.error('Error handling remote ICE candidates:', error);
    }
  };

  const cleanup = () => {
    console.log('Cleaning up screen share receiver');

    // Close WebRTC connection
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.close();
      webrtcServiceRef.current = null;
    }

    // Unsubscribe from Realtime channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Clear state
    setRemoteStream(null);
    setSessionId(null);
    iceCandidatesRef.current = [];
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
        return 'Waiting for screen share...';
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
              </>
            ) : errorMessage ? (
              <>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.errorTitle}>WebRTC Not Available</Text>
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
        <Text style={styles.infoText}>Device: {screenName || deviceId}</Text>
        {sessionId && (
          <Text style={styles.infoText}>Session: {sessionId.substring(0, 8)}...</Text>
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
