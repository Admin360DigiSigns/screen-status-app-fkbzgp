
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { colors } from '../styles/commonStyles';
import { useAuth } from '../contexts/AuthContext';

interface ScreenShareTesterProps {
  onClose?: () => void;
}

export default function ScreenShareTester({ onClose }: ScreenShareTesterProps) {
  const { username, password, screenName } = useAuth();
  const [sessionId, setSessionId] = useState('');
  const [offerSdp, setOfferSdp] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Sample complete SDP offer with the SSRC details provided by the user
  const sampleOffer = `v=0
o=- 4611731400430051336 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
a=extmap-allow-mixed
a=msid-semantic: WMS 568d28d7-b77c-46b8-800a-4244f74865f6
m=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 127 125 104 124 106
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:test
a=ice-pwd:testpassword1234567890123456
a=ice-options:trickle
a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00
a=setup:actpass
a=mid:0
a=extmap:1 urn:ietf:params:rtp-hdrext:toffset
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:3 urn:3gpp:video-orientation
a=extmap:4 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space
a=extmap:9 urn:ietf:params:rtp-hdrext:sdes:mid
a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id
a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id
a=sendonly
a=msid:568d28d7-b77c-46b8-800a-4244f74865f6 6c99e77a-1d5c-4df0-b720-03f6e75e3a7f
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:96 VP8/90000
a=rtcp-fb:96 goog-remb
a=rtcp-fb:96 transport-cc
a=rtcp-fb:96 ccm fir
a=rtcp-fb:96 nack
a=rtcp-fb:96 nack pli
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=96
a=rtpmap:98 VP9/90000
a=rtcp-fb:98 goog-remb
a=rtcp-fb:98 transport-cc
a=rtcp-fb:98 ccm fir
a=rtcp-fb:98 nack
a=rtcp-fb:98 nack pli
a=fmtp:98 profile-id=0
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=98
a=rtpmap:100 H264/90000
a=rtcp-fb:100 goog-remb
a=rtcp-fb:100 transport-cc
a=rtcp-fb:100 ccm fir
a=rtcp-fb:100 nack
a=rtcp-fb:100 nack pli
a=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=rtpmap:101 rtx/90000
a=fmtp:101 apt=100
a=rtpmap:127 red/90000
a=rtpmap:125 rtx/90000
a=fmtp:125 apt=127
a=rtpmap:104 ulpfec/90000
a=rtpmap:124 flexfec-03/90000
a=rtcp-fb:124 transport-cc
a=rtcp-fb:124 goog-remb
a=fmtp:124 repair-window=10000000
a=rtpmap:106 rtx/90000
a=fmtp:106 apt=124
a=ssrc-group:FID 895544422 3309764352
a=ssrc:895544422 cname:pHHpS2Lw/7Syi48L
a=ssrc:895544422 msid:568d28d7-b77c-46b8-800a-4244f74865f6 6c99e77a-1d5c-4df0-b720-03f6e75e3a7f
a=ssrc:3309764352 cname:pHHpS2Lw/7Syi48L
a=ssrc:3309764352 msid:568d28d7-b77c-46b8-800a-4244f74865f6 6c99e77a-1d5c-4df0-b720-03f6e75e3a7f
`;

  const createTestSession = async () => {
    if (!offerSdp.trim()) {
      Alert.alert('Error', 'Please enter an SDP offer');
      return;
    }

    if (!username || !password || !screenName) {
      Alert.alert('Error', 'Not authenticated. Please login first.');
      return;
    }

    setLoading(true);
    setStatus('Creating test session...');

    try {
      // Get the display_id for the current user
      const displayResponse = await fetch(
        'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/screen-share-get-offer',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screen_username: username,
            screen_password: password,
            screen_name: screenName,
          }),
        }
      );

      if (!displayResponse.ok) {
        throw new Error('Failed to authenticate display');
      }

      const displayData = await displayResponse.json();
      const displayId = displayData.display_id;

      console.log('Display ID:', displayId);
      setStatus('Display authenticated, creating session...');

      // Create a test session directly in the database
      const createSessionResponse = await fetch(
        'https://gzyywcqlrjimjegbtoyc.supabase.co/rest/v1/screen_share_sessions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6eXl3Y3FscmppbWplZ2J0b3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5NTc3NzksImV4cCI6MjA1MjUzMzc3OX0.Yz8vZqGPKqJLxPqJLxPqJLxPqJLxPqJLxPqJLxPqJLw',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6eXl3Y3FscmppbWplZ2J0b3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5NTc3NzksImV4cCI6MjA1MjUzMzc3OX0.Yz8vZqGPKqJLxPqJLxPqJLxPqJLxPqJLxPqJLxPqJLw',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({
            display_id: displayId,
            offer: offerSdp.trim(),
            ice_candidates: [],
            status: 'waiting',
          }),
        }
      );

      if (!createSessionResponse.ok) {
        const errorText = await createSessionResponse.text();
        throw new Error(`Failed to create session: ${errorText}`);
      }

      const sessionData = await createSessionResponse.json();
      const newSessionId = Array.isArray(sessionData) ? sessionData[0].id : sessionData.id;

      setSessionId(newSessionId);
      setStatus(`✅ Test session created: ${newSessionId}`);
      
      Alert.alert(
        'Success',
        `Test session created!\n\nSession ID: ${newSessionId}\n\nThe ScreenShareReceiver should now pick up this offer and attempt to connect.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (onClose) {
                onClose();
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating test session:', error);
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create test session');
    } finally {
      setLoading(false);
    }
  };

  const loadSampleOffer = () => {
    setOfferSdp(sampleOffer);
    setStatus('Sample offer loaded with provided SSRC details');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Screen Share Connection Tester</Text>
        
        <Text style={styles.subtitle}>
          This tool creates a test screen share session with a custom SDP offer.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Authenticated as:{'\n'}
            Username: {username || 'Not set'}{'\n'}
            Screen Name: {screenName || 'Not set'}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.sampleButton} 
          onPress={loadSampleOffer}
        >
          <Text style={styles.sampleButtonText}>
            Load Sample Offer (with provided SSRC)
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>SDP Offer:</Text>
        <TextInput
          style={styles.textArea}
          value={offerSdp}
          onChangeText={setOfferSdp}
          placeholder="Paste complete SDP offer here (must start with v=0)"
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={10}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={createTestSession}
          disabled={loading}
        >
          <Text style={styles.createButtonText}>
            {loading ? 'Creating...' : 'Create Test Session'}
          </Text>
        </TouchableOpacity>

        {status ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : null}

        {sessionId ? (
          <View style={styles.sessionBox}>
            <Text style={styles.sessionLabel}>Session ID:</Text>
            <Text style={styles.sessionId}>{sessionId}</Text>
          </View>
        ) : null}

        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsTitle}>Instructions:</Text>
          <Text style={styles.instructionsText}>
            1. Make sure you're logged in{'\n'}
            2. Click "Load Sample Offer" to use the provided SSRC details{'\n'}
            3. Or paste your own complete SDP offer{'\n'}
            4. Click "Create Test Session"{'\n'}
            5. The ScreenShareReceiver will automatically pick up the offer{'\n'}
            6. Check the logs for connection status
          </Text>
        </View>

        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: colors.cardBackground,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: 'monospace',
  },
  sampleButton: {
    backgroundColor: colors.secondary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  sampleButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: colors.cardBackground,
    color: colors.text,
    padding: 12,
    borderRadius: 8,
    fontSize: 12,
    fontFamily: 'monospace',
    minHeight: 200,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border || '#333',
  },
  createButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusBox: {
    backgroundColor: colors.cardBackground,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: 'monospace',
  },
  sessionBox: {
    backgroundColor: colors.cardBackground,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  sessionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  sessionId: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: 'monospace',
  },
  instructionsBox: {
    backgroundColor: colors.cardBackground,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  closeButton: {
    backgroundColor: colors.secondary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
