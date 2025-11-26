
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../styles/commonStyles';
import { useAuth } from '../contexts/AuthContext';

const POLL_INTERVAL = 2500; // Poll every 2.5 seconds

interface ScreenShareReceiverProps {
  onClose?: () => void;
}

export default function ScreenShareReceiver({ onClose }: ScreenShareReceiverProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'polling' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const webViewRef = useRef<WebView>(null);

  // Check if we have the required credentials
  useEffect(() => {
    if (!user?.screen_username || !user?.screen_password || !user?.screen_name) {
      setStatus('error');
      setErrorMessage('Not authenticated');
      return;
    }

    console.log('Starting screen share receiver');
    setStatus('polling');
  }, [user]);

  // Handle messages from WebView
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('WebView message:', message.type);

      switch (message.type) {
        case 'status':
          setStatus(message.status);
          break;
        case 'error':
          setStatus('error');
          setErrorMessage(message.message);
          break;
        case 'log':
          console.log('[WebView]', message.message);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  }, []);

  // Close handler
  const handleClose = useCallback(() => {
    console.log('Closing screen share receiver');
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  // Retry handler
  const handleRetry = useCallback(() => {
    setStatus('polling');
    setErrorMessage('');
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  }, []);

  // Generate the HTML content for WebView
  const generateHTML = () => {
    const credentials = {
      screen_username: user?.screen_username || '',
      screen_password: user?.screen_password || '',
      screen_name: user?.screen_name || '',
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000;
      color: #fff;
      overflow: hidden;
    }
    #container {
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    #video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
    #status {
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10;
    }
    .spinner {
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top: 3px solid #fff;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="status">Waiting for screen share...</div>
    <video id="video" autoplay playsinline></video>
  </div>

  <script>
    const API_URL = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1';
    const POLL_INTERVAL = ${POLL_INTERVAL};
    const ICE_GATHERING_TIMEOUT = 5000;
    
    const credentials = ${JSON.stringify(credentials)};
    
    let peerConnection = null;
    let pollingInterval = null;
    let isProcessingOffer = false;
    let iceCandidates = [];
    
    const statusEl = document.getElementById('status');
    const videoEl = document.getElementById('video');
    
    // Send message to React Native
    function sendMessage(type, data) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
    }
    
    function log(message) {
      console.log(message);
      sendMessage('log', { message });
    }
    
    function updateStatus(status, message) {
      statusEl.textContent = message;
      sendMessage('status', { status });
    }
    
    function showError(message) {
      statusEl.textContent = '❌ ' + message;
      sendMessage('error', { message });
    }
    
    // ICE servers configuration
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ];
    
    // Create peer connection
    function createPeerConnection() {
      log('Creating peer connection');
      
      const pc = new RTCPeerConnection({ iceServers });
      
      // Handle incoming stream
      pc.ontrack = (event) => {
        log('Received remote stream');
        if (event.streams && event.streams[0]) {
          videoEl.srcObject = event.streams[0];
          updateStatus('connected', '✅ Connected');
        }
      };
      
      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          log('ICE candidate generated');
          iceCandidates.push({
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          });
        }
      };
      
      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        log('Connection state: ' + pc.connectionState);
        
        if (pc.connectionState === 'connected') {
          updateStatus('connected', '✅ Connected');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          showError('Connection lost');
          cleanup();
        }
      };
      
      return pc;
    }
    
    // Handle screen share offer
    async function handleOffer(offerData) {
      if (isProcessingOffer) {
        log('Already processing an offer');
        return;
      }
      
      isProcessingOffer = true;
      updateStatus('connecting', '🔄 Connecting...');
      
      try {
        log('Processing offer for session: ' + offerData.id);
        
        // Create peer connection
        peerConnection = createPeerConnection();
        iceCandidates = [];
        
        // Set remote description (offer)
        await peerConnection.setRemoteDescription({
          type: 'offer',
          sdp: offerData.offer,
        });
        
        log('Remote description set');
        
        // Create answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        log('Answer created, waiting for ICE candidates...');
        
        // Wait for ICE candidates
        await new Promise(resolve => setTimeout(resolve, ICE_GATHERING_TIMEOUT));
        
        log('Collected ' + iceCandidates.length + ' ICE candidates');
        
        // Send answer to server
        const response = await fetch(API_URL + '/screen-share-send-answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screen_username: credentials.screen_username,
            screen_password: credentials.screen_password,
            screen_name: credentials.screen_name,
            session_id: offerData.id,
            answer: answer.sdp,
            answer_ice_candidates: iceCandidates,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to send answer: ' + response.status);
        }
        
        log('Answer sent successfully');
        
        // Add remote ICE candidates
        if (Array.isArray(offerData.ice_candidates)) {
          log('Adding ' + offerData.ice_candidates.length + ' remote ICE candidates');
          for (const candidate of offerData.ice_candidates) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
        
        // Stop polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }
        
      } catch (error) {
        log('Error handling offer: ' + error.message);
        showError(error.message);
        isProcessingOffer = false;
        cleanup();
      }
    }
    
    // Poll for offers
    async function pollForOffers() {
      if (isProcessingOffer) {
        return;
      }
      
      try {
        const response = await fetch(API_URL + '/screen-share-get-offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });
        
        if (response.status === 200) {
          const data = await response.json();
          if (data.session) {
            log('Screen share offer available');
            await handleOffer(data.session);
          }
        } else if (response.status === 401) {
          showError('Invalid credentials');
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }
        }
      } catch (error) {
        log('Polling error: ' + error.message);
      }
    }
    
    // Cleanup
    function cleanup() {
      log('Cleaning up');
      
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
      
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      
      if (videoEl.srcObject) {
        videoEl.srcObject.getTracks().forEach(track => track.stop());
        videoEl.srcObject = null;
      }
      
      iceCandidates = [];
      isProcessingOffer = false;
    }
    
    // Start polling
    log('Starting screen share receiver');
    updateStatus('polling', '⏳ Waiting for screen share...');
    
    pollForOffers();
    pollingInterval = setInterval(pollForOffers, POLL_INTERVAL);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
  </script>
</body>
</html>
    `;
  };

  // Render based on status
  if (status === 'error') {
    return (
      <View style={styles.container}>
        <View style={styles.messageContainer}>
          <Text style={styles.title}>Connection Error</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
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

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.messageContainer}>
          <Text style={styles.title}>Screen Sharing Not Available</Text>
          <Text style={styles.message}>
            Screen sharing is not supported on web platform in this configuration.
            Please use the Android or iOS app.
          </Text>
          {onClose && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: generateHTML() }}
        style={styles.webview}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          setStatus('error');
          setErrorMessage('WebView failed to load');
        }}
      />
      
      {/* Close button overlay */}
      {onClose && (
        <View style={styles.closeButtonContainer}>
          <TouchableOpacity style={styles.closeButtonOverlay} onPress={handleClose}>
            <Text style={styles.closeButtonOverlayText}>✕ Close</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Loading overlay */}
      {status === 'polling' && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Waiting for screen share...</Text>
          <Text style={styles.loadingSubtext}>
            Start a screen share from your web app to see it here
          </Text>
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
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    padding: 24,
    margin: 20,
    borderRadius: 12,
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
  closeButtonContainer: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 100,
  },
  closeButtonOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonOverlayText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    color: colors.text,
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: colors.secondaryText,
    marginTop: 12,
    textAlign: 'center',
    maxWidth: 300,
  },
});
