
import { Platform } from 'react-native';

// WebRTC is not available in this build
// This service provides placeholder functionality
const RTCPeerConnection: any = null;
const RTCIceCandidate: any = null;
const RTCSessionDescription: any = null;
const mediaDevices: any = null;

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
  console.error('❌ WebRTC is not available - react-native-webrtc is not installed');
  console.log('To enable WebRTC, you need to:');
  console.log('1. Install react-native-webrtc');
  console.log('2. Create a custom development build');
  console.log('3. Configure native dependencies');
  return null;
};

/**
 * Set remote offer and create answer
 */
export const handleOffer = async (
  peerConnection: any,
  offerSdp: string
): Promise<string | null> => {
  console.error('❌ WebRTC is not available - cannot handle offer');
  return null;
};

/**
 * Add ICE candidate to peer connection
 */
export const addIceCandidate = async (
  peerConnection: any,
  candidate: ICECandidate
): Promise<boolean> => {
  console.error('❌ WebRTC is not available - cannot add ICE candidate');
  return false;
};

/**
 * Check if WebRTC is available
 */
export const isWebRTCAvailable = (): boolean => {
  const available = false; // WebRTC is not available in this build
  console.log('🔍 WebRTC availability check:', available ? '✅ Available' : '❌ Not available');
  return available;
};

export const webrtcService = {
  isAvailable: isWebRTCAvailable(),
  createReceiverPeerConnection,
  handleOffer,
  addIceCandidate,
};

console.log('🚀 WebRTC service initialized (placeholder mode)');
console.log('📱 Platform:', Platform.OS);
console.log('✅ WebRTC available:', webrtcService.isAvailable);
console.log('ℹ️  To enable WebRTC, install react-native-webrtc and create a custom build');
