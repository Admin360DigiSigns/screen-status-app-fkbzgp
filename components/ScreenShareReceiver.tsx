
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
  const { username, password, screenName } = useAuth();
  const [status, setStatus] = useState<'idle' | 'polling' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [displayId, setDisplayId] = useState<string>('');
  const webViewRef = useRef<WebView>(null);

  // Check if we have the required credentials
  useEffect(() => {
    if (!username || !password || !screenName) {
      console.error('❌ Missing credentials:', { 
        hasUsername: !!username, 
        hasPassword: !!password, 
        hasScreenName: !!screenName 
      });
      setStatus('error');
      setErrorMessage('Not authenticated - missing credentials');
      return;
    }

    console.log('✅ Starting screen share receiver with credentials:');
    console.log('   Username:', username);
    console.log('   Screen Name:', screenName);
    console.log('   Display ID will be:', screenName);
    setDisplayId(screenName);
    setStatus('polling');
  }, [username, password, screenName]);

  // Handle messages from WebView
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('📨 WebView message:', message.type, message);

      switch (message.type) {
        case 'status':
          setStatus(message.status);
          if (message.sessionId) {
            setSessionId(message.sessionId);
          }
          if (message.displayId) {
            setDisplayId(message.displayId);
          }
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
    setSessionId('');
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  }, []);

  // Generate the HTML content for WebView
  const generateHTML = () => {
    const credentials = {
      screen_username: username || '',
      screen_password: password || '',
      screen_name: screenName || '',
    };

    console.log('🔧 Generating HTML with credentials:');
    console.log('   screen_username:', credentials.screen_username);
    console.log('   screen_name:', credentials.screen_name);
    console.log('   display_id will be:', credentials.screen_name);

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
      max-width: 90%;
      text-align: center;
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
    const ICE_GATHERING_TIMEOUT = 5000; // 5 seconds
    
    const credentials = ${JSON.stringify(credentials)};
    
    // IMPORTANT: display_id is the screen_name
    const display_id = credentials.screen_name;
    
    console.log('🚀 WebView initialized');
    console.log('📋 Credentials:');
    console.log('   screen_username:', credentials.screen_username);
    console.log('   screen_name:', credentials.screen_name);
    console.log('   display_id:', display_id);
    console.log('   hasPassword:', !!credentials.screen_password);
    
    let peerConnection = null;
    let pollingInterval = null;
    let isProcessingOffer = false;
    let iceCandidates = [];
    let currentSessionId = null;
    
    const statusEl = document.getElementById('status');
    const videoEl = document.getElementById('video');
    
    // Send message to React Native
    function sendMessage(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }
    
    function log(message) {
      console.log(message);
      sendMessage('log', { message });
    }
    
    function updateStatus(status, message, sessionId, displayIdParam) {
      statusEl.textContent = message;
      sendMessage('status', { status, sessionId, displayId: displayIdParam || display_id });
    }
    
    function showError(message) {
      statusEl.textContent = '❌ ' + message;
      sendMessage('error', { message });
    }
    
    // Enhanced SDP validation and cleaning - handles dynamic session data
    function validateAndCleanSDP(sdpInput, type) {
      log('🔍 Validating ' + type + ' SDP...');
      
      if (!sdpInput) {
        throw new Error('SDP is null or undefined');
      }
      
      // Extract SDP string from various input formats
      let sdpString;
      if (typeof sdpInput === 'object') {
        if (sdpInput.sdp && typeof sdpInput.sdp === 'string') {
          sdpString = sdpInput.sdp;
        } else {
          throw new Error('SDP object does not contain valid sdp property');
        }
      } else if (typeof sdpInput === 'string') {
        sdpString = sdpInput;
      } else {
        throw new Error('SDP is not a string or object: ' + typeof sdpInput);
      }
      
      log('Original SDP length: ' + sdpString.length);
      
      // Remove wrapping quotes and trim
      let cleanedSDP = sdpString.trim();
      while ((cleanedSDP.startsWith('"') && cleanedSDP.endsWith('"')) ||
             (cleanedSDP.startsWith("'") && cleanedSDP.endsWith("'"))) {
        cleanedSDP = cleanedSDP.slice(1, -1);
      }
      
      // Normalize line endings - handle all escape sequence variations
      cleanedSDP = cleanedSDP
        .replace(/\\\\r\\\\n/g, '\\n')
        .replace(/\\\\n/g, '\\n')
        .replace(/\\\\r/g, '\\n')
        .replace(/\\r\\n/g, '\\n')
        .replace(/\\r/g, '\\n')
        .replace(/\\n/g, '\\n');
      
      // Split into lines
      const lines = cleanedSDP.split('\\n').map(line => line.trim()).filter(line => line.length > 0);
      
      log('Parsed ' + lines.length + ' SDP lines');
      
      // Validate required SDP structure
      if (lines.length === 0) {
        throw new Error('SDP is empty after parsing');
      }
      
      if (!lines[0].startsWith('v=')) {
        log('❌ First line is not v=, got: ' + lines[0]);
        throw new Error('Invalid SDP: must start with v= line');
      }
      
      // Check for required session-level fields
      const requiredFields = ['v=', 'o=', 's=', 't='];
      for (const field of requiredFields) {
        if (!lines.some(line => line.startsWith(field))) {
          throw new Error('Invalid SDP: missing required field ' + field);
        }
      }
      
      // Reconstruct SDP with proper line endings
      const reconstructedSDP = lines.join('\\r\\n') + '\\r\\n';
      
      log('✅ SDP validation passed');
      log('Final SDP has ' + lines.length + ' lines');
      log('First 3 lines: ' + lines.slice(0, 3).join(' | '));
      
      return reconstructedSDP;
    }
    
    // ICE servers configuration
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ];
    
    log('ICE servers configured: ' + iceServers.length + ' STUN servers');
    
    // Create peer connection
    function createPeerConnection() {
      log('Creating peer connection with ICE servers');
      
      try {
        const pc = new RTCPeerConnection({ iceServers });
        log('✅ RTCPeerConnection created successfully');
        
        // Handle incoming stream
        pc.ontrack = (event) => {
          log('🎥 Received remote stream with ' + event.streams.length + ' stream(s)');
          if (event.streams && event.streams[0]) {
            videoEl.srcObject = event.streams[0];
            log('✅ Video element srcObject set');
            updateStatus('connected', '✅ Connected - Receiving video', currentSessionId, display_id);
          }
        };
        
        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            log('🧊 ICE candidate generated');
            iceCandidates.push({
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
            });
          } else {
            log('🧊 ICE gathering complete! Total candidates: ' + iceCandidates.length);
          }
        };
        
        // Handle ICE gathering state
        pc.onicegatheringstatechange = () => {
          log('🧊 ICE gathering state: ' + pc.iceGatheringState);
        };
        
        // Handle connection state changes
        pc.onconnectionstatechange = () => {
          log('🔌 Connection state: ' + pc.connectionState);
          
          if (pc.connectionState === 'connected') {
            updateStatus('connected', '✅ Connected - Stream active', currentSessionId, display_id);
          } else if (pc.connectionState === 'connecting') {
            updateStatus('connecting', '🔄 Connecting...', currentSessionId, display_id);
          } else if (pc.connectionState === 'failed') {
            showError('Connection failed');
            cleanup();
          } else if (pc.connectionState === 'disconnected') {
            showError('Connection disconnected');
            cleanup();
          }
        };
        
        // Handle ICE connection state
        pc.oniceconnectionstatechange = () => {
          log('🧊 ICE connection state: ' + pc.iceConnectionState);
        };
        
        return pc;
      } catch (error) {
        log('❌ Failed to create RTCPeerConnection: ' + error.message);
        showError('Failed to create peer connection: ' + error.message);
        throw error;
      }
    }
    
    // Handle screen share offer
    async function handleOffer(offerData) {
      if (isProcessingOffer) {
        log('⏭️ Already processing an offer, skipping...');
        return;
      }
      
      isProcessingOffer = true;
      currentSessionId = offerData.id;
      updateStatus('connecting', '🔄 Processing offer...', currentSessionId, display_id);
      
      try {
        log('📥 Processing offer for session: ' + offerData.id);
        log('   Display ID: ' + offerData.display_id);
        log('   Expected display_id: ' + display_id);
        log('   Offer data type: ' + typeof offerData.offer);
        
        // Verify this offer is for our display
        if (offerData.display_id !== display_id) {
          log('⚠️ Offer is for different display: ' + offerData.display_id + ' (expected: ' + display_id + ')');
          isProcessingOffer = false;
          return;
        }
        
        log('✅ Offer is for this display');
        
        // Validate and clean the offer SDP
        let cleanedOfferSDP;
        try {
          cleanedOfferSDP = validateAndCleanSDP(offerData.offer, 'offer');
        } catch (error) {
          log('❌ SDP validation failed: ' + error.message);
          throw new Error('Invalid offer SDP: ' + error.message);
        }
        
        // Parse ice_candidates if it's a string
        let remoteCandidates = [];
        if (typeof offerData.ice_candidates === 'string') {
          try {
            remoteCandidates = JSON.parse(offerData.ice_candidates);
            log('✅ Parsed ' + remoteCandidates.length + ' ICE candidates from string');
          } catch (e) {
            log('⚠️ Failed to parse ice_candidates: ' + e.message);
          }
        } else if (Array.isArray(offerData.ice_candidates)) {
          remoteCandidates = offerData.ice_candidates;
          log('✅ Using ' + remoteCandidates.length + ' ICE candidates from array');
        }
        
        // Create peer connection
        log('🔧 Creating peer connection...');
        peerConnection = createPeerConnection();
        iceCandidates = [];
        
        // Set remote description (offer)
        log('📝 Setting remote description...');
        
        try {
          await peerConnection.setRemoteDescription({
            type: 'offer',
            sdp: cleanedOfferSDP,
          });
          log('✅ Remote description set successfully');
        } catch (error) {
          log('❌ setRemoteDescription failed: ' + error.message);
          throw new Error('Failed to set remote description: ' + error.message);
        }
        
        // Add remote ICE candidates
        if (remoteCandidates.length > 0) {
          log('🧊 Adding ' + remoteCandidates.length + ' remote ICE candidates...');
          let addedCount = 0;
          for (const candidate of remoteCandidates) {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
              addedCount++;
            } catch (e) {
              log('⚠️ Failed to add ICE candidate: ' + e.message);
            }
          }
          log('✅ Added ' + addedCount + '/' + remoteCandidates.length + ' remote ICE candidates');
        }
        
        // Create answer
        log('📝 Creating answer...');
        const answer = await peerConnection.createAnswer();
        
        log('✅ Answer created, setting local description...');
        await peerConnection.setLocalDescription(answer);
        
        log('✅ Local description set, waiting for ICE candidates...');
        updateStatus('connecting', '🧊 Gathering ICE candidates...', currentSessionId, display_id);
        
        // Wait for ICE gathering to complete or timeout
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            log('⏱️ ICE gathering timeout, proceeding with ' + iceCandidates.length + ' candidates');
            resolve();
          }, ICE_GATHERING_TIMEOUT);
          
          if (peerConnection.iceGatheringState === 'complete') {
            clearTimeout(timeout);
            log('✅ ICE gathering already complete');
            resolve();
          } else {
            const checkState = () => {
              if (peerConnection.iceGatheringState === 'complete') {
                clearTimeout(timeout);
                peerConnection.removeEventListener('icegatheringstatechange', checkState);
                log('✅ ICE gathering completed');
                resolve();
              }
            };
            peerConnection.addEventListener('icegatheringstatechange', checkState);
          }
        });
        
        log('🧊 Collected ' + iceCandidates.length + ' ICE candidates');
        
        // Prepare answer payload
        const answerPayload = {
          screen_username: credentials.screen_username,
          screen_password: credentials.screen_password,
          screen_name: credentials.screen_name,
          session_id: offerData.id,
          answer: peerConnection.localDescription.sdp,
          answer_ice_candidates: JSON.stringify(iceCandidates),
        };
        
        log('📤 Sending answer to server...');
        log('   Session ID: ' + offerData.id);
        log('   Display ID: ' + display_id);
        log('   Screen Name: ' + credentials.screen_name);
        updateStatus('connecting', '📤 Sending answer...', currentSessionId, display_id);
        
        // Send answer to server
        const response = await fetch(API_URL + '/screen-share-send-answer', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(answerPayload),
        });
        
        log('📥 Answer response status: ' + response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { error: errorText };
          }
          throw new Error('Failed to send answer: ' + response.status + ' - ' + (errorData.error || 'Unknown error'));
        }
        
        const responseData = await response.json();
        log('✅ Answer sent successfully: ' + responseData.message);
        
        // Stop polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
          log('⏹️ Stopped polling for offers');
        }
        
        updateStatus('connecting', '🔄 Waiting for connection...', currentSessionId, display_id);
        
      } catch (error) {
        log('❌ Error handling offer: ' + error.message);
        console.error('Full error:', error);
        showError(error.message);
        isProcessingOffer = false;
        cleanup();
      }
    }
    
    // Poll for offers
    async function pollForOffers() {
      if (isProcessingOffer) {
        log('⏭️ Skipping poll - already processing offer');
        return;
      }
      
      try {
        log('🔍 Polling for offers...');
        log('   Using credentials:');
        log('   - screen_username: ' + credentials.screen_username);
        log('   - screen_name: ' + credentials.screen_name);
        log('   - display_id: ' + display_id);
        
        const response = await fetch(API_URL + '/screen-share-get-offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });
        
        log('📥 Poll response status: ' + response.status);
        
        if (response.status === 200) {
          const data = await response.json();
          log('📦 Response data:');
          log('   - display_id: ' + data.display_id);
          log('   - has session: ' + !!data.session);
          
          if (data.session) {
            log('✅ Screen share offer available!');
            log('   Session ID: ' + data.session.id);
            log('   Session display_id: ' + data.session.display_id);
            log('   Our display_id: ' + display_id);
            log('   Match: ' + (data.session.display_id === display_id));
            await handleOffer(data.session);
          } else {
            log('⏳ No session available yet for display: ' + display_id);
          }
        } else if (response.status === 401) {
          const errorData = await response.json().catch(() => ({ error: 'Invalid credentials' }));
          showError('Authentication failed: ' + errorData.error);
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }
        } else if (response.status === 400) {
          const errorData = await response.json().catch(() => ({ error: 'Bad request' }));
          showError('Bad request: ' + errorData.error);
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          log('⚠️ Poll error: ' + response.status + ' - ' + errorData.error);
        }
      } catch (error) {
        log('⚠️ Polling error: ' + error.message);
        console.error('Full polling error:', error);
      }
    }
    
    // Cleanup
    function cleanup() {
      log('🧹 Cleaning up resources...');
      
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
      currentSessionId = null;
      
      log('✅ Cleanup complete');
    }
    
    // Start polling
    log('🚀 Starting screen share receiver');
    log('📋 Configuration:');
    log('   - API URL: ' + API_URL);
    log('   - Poll interval: ' + POLL_INTERVAL + 'ms');
    log('   - Display ID: ' + display_id);
    log('   - Screen Name: ' + credentials.screen_name);
    log('   - Username: ' + credentials.screen_username);
    
    updateStatus('polling', '⏳ Waiting for screen share...', null, display_id);
    
    // Initial poll
    pollForOffers();
    
    // Set up polling interval
    pollingInterval = setInterval(pollForOffers, POLL_INTERVAL);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
    
    log('✅ Polling started with ' + POLL_INTERVAL + 'ms interval');
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
          <Text style={styles.debugText}>
            Debug Info:{'\n'}
            Username: {username || 'missing'}{'\n'}
            Screen Name: {screenName || 'missing'}{'\n'}
            Display ID: {displayId || screenName || 'missing'}{'\n'}
            Password: {password ? 'present' : 'missing'}
          </Text>
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
          <Text style={styles.debugText}>
            Authenticated as: {username} ({screenName}){'\n'}
            Display ID: {displayId || screenName}
          </Text>
        </View>
      )}
      
      {/* Connecting overlay */}
      {status === 'connecting' && (
        <View style={styles.connectingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.connectingText}>Establishing connection...</Text>
          {sessionId && (
            <Text style={styles.sessionIdText}>
              Session: {sessionId.substring(0, 8)}...
            </Text>
          )}
          {displayId && (
            <Text style={styles.sessionIdText}>
              Display: {displayId}
            </Text>
          )}
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
  debugText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'monospace',
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
  connectingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  connectingText: {
    fontSize: 18,
    color: colors.text,
    marginTop: 20,
    textAlign: 'center',
  },
  sessionIdText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
