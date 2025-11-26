
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
  const webViewRef = useRef<WebView>(null);

  // Check if we have the required credentials
  useEffect(() => {
    if (!username || !password || !screenName) {
      console.error('Missing credentials:', { 
        hasUsername: !!username, 
        hasPassword: !!password, 
        hasScreenName: !!screenName 
      });
      setStatus('error');
      setErrorMessage('Not authenticated - missing credentials');
      return;
    }

    console.log('Starting screen share receiver with credentials:', {
      username,
      screenName,
      hasPassword: !!password,
    });
    setStatus('polling');
  }, [username, password, screenName]);

  // Handle messages from WebView
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('WebView message:', message.type, message);

      switch (message.type) {
        case 'status':
          setStatus(message.status);
          if (message.sessionId) {
            setSessionId(message.sessionId);
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

    console.log('Generating HTML with credentials:', {
      screen_username: credentials.screen_username,
      screen_name: credentials.screen_name,
      hasPassword: !!credentials.screen_password,
    });

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
    const ICE_GATHERING_TIMEOUT = 5000; // 5 seconds (increased from 3)
    
    const credentials = ${JSON.stringify(credentials)};
    
    console.log('WebView initialized with credentials:', {
      screen_username: credentials.screen_username,
      screen_name: credentials.screen_name,
      hasPassword: !!credentials.screen_password,
    });
    
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
    
    function updateStatus(status, message, sessionId) {
      statusEl.textContent = message;
      sendMessage('status', { status, sessionId });
    }
    
    function showError(message) {
      statusEl.textContent = '❌ ' + message;
      sendMessage('error', { message });
    }
    
    // Enhanced SDP validation and cleaning
    function validateAndCleanSDP(sdpInput, type) {
      log('🔍 Validating ' + type + ' SDP...');
      log('Input type: ' + typeof sdpInput);
      log('Input length: ' + (sdpInput ? String(sdpInput).length : 0));
      
      if (!sdpInput) {
        throw new Error('SDP is null or undefined');
      }
      
      // Convert to string if it's an object
      let sdpString;
      if (typeof sdpInput === 'object') {
        log('⚠️ SDP is an object, attempting to extract string...');
        
        // Check if it's an SDP object with type and sdp properties
        if (sdpInput.sdp && typeof sdpInput.sdp === 'string') {
          sdpString = sdpInput.sdp;
          log('✅ Extracted SDP from object.sdp property');
        } else {
          // Try to stringify and parse
          try {
            const jsonStr = JSON.stringify(sdpInput);
            log('Object as JSON: ' + jsonStr.substring(0, 200));
            
            // Try to parse if it looks like a JSON string
            if (jsonStr.includes('"sdp"')) {
              const parsed = JSON.parse(jsonStr);
              if (parsed.sdp) {
                sdpString = parsed.sdp;
                log('✅ Extracted SDP from parsed JSON');
              }
            }
          } catch (e) {
            log('❌ Failed to extract SDP from object: ' + e.message);
          }
          
          if (!sdpString) {
            throw new Error('SDP object does not contain valid sdp property');
          }
        }
      } else if (typeof sdpInput === 'string') {
        sdpString = sdpInput;
      } else {
        throw new Error('SDP is not a string or object: ' + typeof sdpInput);
      }
      
      log('SDP string length: ' + sdpString.length);
      log('First 100 chars: ' + sdpString.substring(0, 100));
      
      // Remove any leading/trailing whitespace
      let cleanedSDP = sdpString.trim();
      
      // Remove wrapping quotes (single or double)
      while ((cleanedSDP.startsWith('"') && cleanedSDP.endsWith('"')) ||
             (cleanedSDP.startsWith("'") && cleanedSDP.endsWith("'"))) {
        cleanedSDP = cleanedSDP.slice(1, -1);
        log('Removed wrapping quotes');
      }
      
      // Handle various escape sequences
      // First, handle double-escaped sequences
      cleanedSDP = cleanedSDP.replace(/\\\\\\\\r\\\\\\\\n/g, '\\r\\n');
      cleanedSDP = cleanedSDP.replace(/\\\\\\\\n/g, '\\n');
      cleanedSDP = cleanedSDP.replace(/\\\\\\\\r/g, '\\r');
      
      // Then handle single-escaped sequences
      cleanedSDP = cleanedSDP.replace(/\\\\r\\\\n/g, '\\r\\n');
      cleanedSDP = cleanedSDP.replace(/\\\\n/g, '\\n');
      cleanedSDP = cleanedSDP.replace(/\\\\r/g, '\\r');
      
      // Handle JSON-escaped sequences
      cleanedSDP = cleanedSDP.replace(/\\r\\n/g, '\\n');
      cleanedSDP = cleanedSDP.replace(/\\r/g, '\\n');
      
      log('After escape sequence handling, length: ' + cleanedSDP.length);
      
      // Normalize all line endings to \\r\\n (SDP standard)
      const lines = cleanedSDP.split(/\\r?\\n/);
      cleanedSDP = lines.join('\\r\\n');
      
      log('After line ending normalization: ' + lines.length + ' lines');
      log('First line: "' + lines[0] + '"');
      log('Second line: "' + (lines[1] || 'N/A') + '"');
      
      // Remove any empty lines at the start
      while (cleanedSDP.startsWith('\\r\\n') || cleanedSDP.startsWith('\\n')) {
        cleanedSDP = cleanedSDP.replace(/^\\r?\\n/, '');
        log('Removed leading empty line');
      }
      
      // Check if SDP starts with v=0 (required first line)
      if (!cleanedSDP.startsWith('v=')) {
        log('❌ SDP does not start with v= line');
        log('First 200 chars: ' + cleanedSDP.substring(0, 200));
        log('Char codes of first 10 chars: ' + Array.from(cleanedSDP.substring(0, 10)).map(c => c.charCodeAt(0)).join(', '));
        throw new Error('Invalid SDP format: must start with v= line. First chars: "' + cleanedSDP.substring(0, 50) + '"');
      }
      
      // Validate that SDP has required lines
      const requiredLines = ['v=', 'o=', 's=', 't='];
      const sdpLines = cleanedSDP.split('\\r\\n');
      
      log('SDP has ' + sdpLines.length + ' lines');
      
      for (const required of requiredLines) {
        const hasLine = sdpLines.some(line => line.startsWith(required));
        if (!hasLine) {
          log('❌ Missing required SDP line: ' + required);
          log('Available line prefixes: ' + sdpLines.slice(0, 10).map(l => l.substring(0, 5)).join(', '));
          throw new Error('Invalid SDP format: missing ' + required + ' line');
        }
      }
      
      log('✅ SDP validation passed');
      log('Final SDP preview (first 300 chars): ' + cleanedSDP.substring(0, 300));
      
      return cleanedSDP;
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
            updateStatus('connected', '✅ Connected - Receiving video', currentSessionId);
          }
        };
        
        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            log('🧊 ICE candidate generated: ' + event.candidate.candidate.substring(0, 50) + '...');
            iceCandidates.push({
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
            });
            log('Total ICE candidates collected: ' + iceCandidates.length);
          } else {
            log('🧊 ICE gathering complete! Total candidates: ' + iceCandidates.length);
          }
        };
        
        // Handle ICE gathering state
        pc.onicegatheringstatechange = () => {
          log('🧊 ICE gathering state changed to: ' + pc.iceGatheringState);
        };
        
        // Handle connection state changes
        pc.onconnectionstatechange = () => {
          log('🔌 Connection state changed to: ' + pc.connectionState);
          
          if (pc.connectionState === 'connected') {
            updateStatus('connected', '✅ Connected - Stream active', currentSessionId);
          } else if (pc.connectionState === 'connecting') {
            updateStatus('connecting', '🔄 Connecting...', currentSessionId);
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
          log('🧊 ICE connection state changed to: ' + pc.iceConnectionState);
          
          if (pc.iceConnectionState === 'connected') {
            log('✅ ICE connection established');
          } else if (pc.iceConnectionState === 'failed') {
            log('❌ ICE connection failed');
          }
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
      updateStatus('connecting', '🔄 Processing offer...', currentSessionId);
      
      try {
        log('📥 Processing offer for session: ' + offerData.id);
        log('Session status: ' + offerData.status);
        log('Raw offer type: ' + typeof offerData.offer);
        log('Raw offer preview: ' + JSON.stringify(offerData.offer).substring(0, 200));
        
        // Validate and clean the offer SDP
        let cleanedOfferSDP;
        try {
          cleanedOfferSDP = validateAndCleanSDP(offerData.offer, 'offer');
        } catch (error) {
          log('❌ SDP validation failed: ' + error.message);
          throw new Error('Invalid offer SDP format: ' + error.message);
        }
        
        // Parse ice_candidates if it's a string
        let remoteCandidates = [];
        if (typeof offerData.ice_candidates === 'string') {
          try {
            remoteCandidates = JSON.parse(offerData.ice_candidates);
            log('✅ Parsed ice_candidates from string, count: ' + remoteCandidates.length);
          } catch (e) {
            log('⚠️ Failed to parse ice_candidates string: ' + e.message);
            remoteCandidates = [];
          }
        } else if (Array.isArray(offerData.ice_candidates)) {
          remoteCandidates = offerData.ice_candidates;
          log('✅ Using ice_candidates array, count: ' + remoteCandidates.length);
        } else {
          log('⚠️ No ICE candidates provided or invalid format');
        }
        
        // Create peer connection
        log('🔧 Creating peer connection...');
        peerConnection = createPeerConnection();
        iceCandidates = [];
        
        // Set remote description (offer)
        log('📝 Setting remote description with cleaned SDP...');
        
        try {
          await peerConnection.setRemoteDescription({
            type: 'offer',
            sdp: cleanedOfferSDP,
          });
          log('✅ Remote description set successfully');
        } catch (error) {
          log('❌ setRemoteDescription failed: ' + error.message);
          log('Failed SDP (first 500 chars): ' + cleanedOfferSDP.substring(0, 500));
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
              log('⚠️ Failed to add remote ICE candidate: ' + e.message);
            }
          }
          log('✅ Added ' + addedCount + '/' + remoteCandidates.length + ' remote ICE candidates');
        }
        
        // Create answer
        log('📝 Creating answer...');
        const answer = await peerConnection.createAnswer();
        
        log('✅ Answer created, SDP length: ' + answer.sdp.length);
        log('📝 Setting local description...');
        
        await peerConnection.setLocalDescription(answer);
        
        log('✅ Local description set, waiting for ICE candidates...');
        updateStatus('connecting', '🧊 Gathering ICE candidates...', currentSessionId);
        
        // Wait for ICE gathering to complete or timeout
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            log('⏱️ ICE gathering timeout reached, proceeding with ' + iceCandidates.length + ' candidates');
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
        
        // Convert ICE candidates array to JSON string as expected by the API
        const iceCandidatesString = JSON.stringify(iceCandidates);
        
        // Prepare answer payload according to API specification
        const answerPayload = {
          screen_username: credentials.screen_username,
          screen_password: credentials.screen_password,
          screen_name: credentials.screen_name,
          session_id: offerData.id,
          answer: peerConnection.localDescription.sdp,
          answer_ice_candidates: iceCandidatesString,
        };
        
        log('📤 Sending answer to server...');
        log('Answer SDP length: ' + answerPayload.answer.length);
        log('Answer ICE candidates count: ' + iceCandidates.length);
        updateStatus('connecting', '📤 Sending answer...', currentSessionId);
        
        // Send answer to server with credentials
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
        
        updateStatus('connecting', '🔄 Waiting for connection...', currentSessionId);
        
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
        
        const response = await fetch(API_URL + '/screen-share-get-offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });
        
        log('📥 Poll response status: ' + response.status);
        
        if (response.status === 200) {
          const data = await response.json();
          if (data.session) {
            log('✅ Screen share offer available!');
            log('Session ID: ' + data.session.id);
            log('Session status: ' + data.session.status);
            log('Display ID: ' + data.session.display_id);
            log('Offer type: ' + typeof data.session.offer);
            log('Offer length: ' + (data.session.offer ? String(data.session.offer).length : 0));
            log('ICE candidates type: ' + typeof data.session.ice_candidates);
            await handleOffer(data.session);
          } else {
            log('⏳ No session available yet');
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
          log('❌ Bad request - check credentials format');
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
    log('Credentials: ' + JSON.stringify({
      screen_username: credentials.screen_username,
      screen_name: credentials.screen_name,
      hasPassword: !!credentials.screen_password
    }));
    
    updateStatus('polling', '⏳ Waiting for screen share...', null);
    
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
            Authenticated as: {username} ({screenName})
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
