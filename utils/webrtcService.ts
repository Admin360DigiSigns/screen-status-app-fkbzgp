
import { Platform } from 'react-native';

// Conditionally import WebRTC only on native platforms
let RTCPeerConnection: any = null;
let RTCIceCandidate: any = null;
let RTCSessionDescription: any = null;
let mediaDevices: any = null;

if (Platform.OS !== 'web') {
  try {
    // Using dynamic import instead of require
    import('react-native-webrtc').then((WebRTC) => {
      RTCPeerConnection = WebRTC.RTCPeerConnection;
      RTCIceCandidate = WebRTC.RTCIceCandidate;
      RTCSessionDescription = WebRTC.RTCSessionDescription;
      mediaDevices = WebRTC.mediaDevices;
      console.log('✅ WebRTC modules loaded successfully');
    }).catch((error) => {
      console.error('❌ Failed to load WebRTC modules:', error);
    });
  } catch (error) {
    console.error('❌ Failed to load WebRTC modules:', error);
  }
}

export interface WebRTCPeerConnection {
  peerConnection: any;
  remoteStream: any;
  cleanup: () => void;
}

export interface ICECandidate {
  candidate: string;
  sdpMLineIndex: number | null;
  sdpMid: string | null;
}

// Multiple STUN servers for better reliability
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

/**
 * Create a WebRTC peer connection for receiving screen share
 */
export const createReceiverPeerConnection = async (
  onRemoteStream: (stream: any) => void,
  onIceCandidate: (candidate: ICECandidate) => void,
  onConnectionStateChange: (state: string) => void
): Promise<WebRTCPeerConnection | null> => {
  if (!RTCPeerConnection) {
    console.error('❌ WebRTC is not available on this platform');
    return null;
  }

  try {
    console.log('🔧 Creating RTCPeerConnection with ICE servers');
    
    const peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    let remoteStream: any = null;

    // Handle ICE candidates
    peerConnection.onicecandidate = (event: any) => {
      if (event.candidate) {
        console.log('🧊 New ICE candidate:', event.candidate.candidate.substring(0, 50) + '...');
        onIceCandidate({
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
        });
      } else {
        console.log('✅ ICE candidate gathering complete');
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log('🔌 Connection state changed:', state);
      onConnectionStateChange(state);
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      const iceState = peerConnection.iceConnectionState;
      console.log('🧊 ICE connection state:', iceState);
      
      // Additional logging for debugging
      if (iceState === 'failed') {
        console.error('❌ ICE connection failed - check network/firewall');
      } else if (iceState === 'disconnected') {
        console.warn('⚠️ ICE connection disconnected');
      } else if (iceState === 'connected') {
        console.log('✅ ICE connection established');
      }
    };

    // Handle ICE gathering state changes
    peerConnection.onicegatheringstatechange = () => {
      const gatheringState = peerConnection.iceGatheringState;
      console.log('🔍 ICE gathering state:', gatheringState);
    };

    // Handle remote stream
    peerConnection.ontrack = (event: any) => {
      console.log('📺 Received remote track:', event.track.kind);
      
      if (!remoteStream) {
        remoteStream = event.streams[0];
        const tracks = remoteStream.getTracks();
        console.log('✅ Remote stream received with', tracks.length, 'tracks');
        
        // Log track details
        tracks.forEach((track: any, index: number) => {
          console.log(`  Track ${index + 1}: ${track.kind} - ${track.label}`);
        });
        
        onRemoteStream(remoteStream);
      }
    };

    // Cleanup function
    const cleanup = () => {
      console.log('🧹 Cleaning up peer connection');
      
      if (remoteStream) {
        const tracks = remoteStream.getTracks();
        console.log('🛑 Stopping', tracks.length, 'remote tracks');
        tracks.forEach((track: any) => {
          track.stop();
        });
      }
      
      if (peerConnection) {
        console.log('🔌 Closing peer connection');
        peerConnection.close();
      }
    };

    return {
      peerConnection,
      remoteStream,
      cleanup,
    };
  } catch (error) {
    console.error('❌ Error creating peer connection:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    return null;
  }
};

/**
 * Set remote offer and create answer
 */
export const handleOffer = async (
  peerConnection: any,
  offerSdp: string
): Promise<string | null> => {
  if (!RTCSessionDescription) {
    console.error('❌ RTCSessionDescription is not available');
    return null;
  }

  try {
    console.log('📥 Setting remote description (offer)');
    console.log('📄 Offer SDP length:', offerSdp.length, 'characters');
    
    const offer = new RTCSessionDescription({
      type: 'offer',
      sdp: offerSdp,
    });

    await peerConnection.setRemoteDescription(offer);
    console.log('✅ Remote description set successfully');

    console.log('📝 Creating answer');
    const answer = await peerConnection.createAnswer();
    console.log('✅ Answer created, SDP length:', answer.sdp.length, 'characters');

    await peerConnection.setLocalDescription(answer);
    console.log('✅ Local description (answer) set successfully');

    return answer.sdp;
  } catch (error) {
    console.error('❌ Error handling offer:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return null;
  }
};

/**
 * Add ICE candidate to peer connection
 */
export const addIceCandidate = async (
  peerConnection: any,
  candidate: ICECandidate
): Promise<boolean> => {
  if (!RTCIceCandidate) {
    console.error('❌ RTCIceCandidate is not available');
    return false;
  }

  try {
    console.log('🧊 Adding ICE candidate:', candidate.candidate.substring(0, 50) + '...');
    
    const iceCandidate = new RTCIceCandidate({
      candidate: candidate.candidate,
      sdpMLineIndex: candidate.sdpMLineIndex,
      sdpMid: candidate.sdpMid,
    });

    await peerConnection.addIceCandidate(iceCandidate);
    console.log('✅ ICE candidate added successfully');
    return true;
  } catch (error) {
    console.error('❌ Error adding ICE candidate:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    return false;
  }
};

/**
 * Check if WebRTC is available
 */
export const isWebRTCAvailable = (): boolean => {
  const available = Platform.OS !== 'web' && RTCPeerConnection !== null;
  console.log('🔍 WebRTC availability check:', available ? '✅ Available' : '❌ Not available');
  return available;
};

export const webrtcService = {
  isAvailable: isWebRTCAvailable(),
  createReceiverPeerConnection,
  handleOffer,
  addIceCandidate,
};

console.log('🚀 WebRTC service initialized');
console.log('📱 Platform:', Platform.OS);
console.log('✅ WebRTC available:', webrtcService.isAvailable);
