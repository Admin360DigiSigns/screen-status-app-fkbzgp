
import { Platform } from 'react-native';

// Conditionally import WebRTC modules only on native platforms
let RTCPeerConnection: any = null;
let RTCIceCandidate: any = null;
let RTCSessionDescription: any = null;
let mediaDevices: any = null;

if (Platform.OS !== 'web') {
  try {
    const webrtc = require('react-native-webrtc');
    RTCPeerConnection = webrtc.RTCPeerConnection;
    RTCIceCandidate = webrtc.RTCIceCandidate;
    RTCSessionDescription = webrtc.RTCSessionDescription;
    mediaDevices = webrtc.mediaDevices;
    console.log('WebRTC modules loaded successfully');
  } catch (error) {
    console.error('Failed to load react-native-webrtc:', error);
  }
}

export interface WebRTCConfig {
  iceServers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
}

export interface ScreenShareSession {
  id: string;
  display_id: string;
  offer: string;
  ice_candidates?: string;
  status: 'waiting' | 'connected' | 'ended';
  created_at: string;
}

export class WebRTCService {
  private peerConnection: any = null;
  private remoteStream: any = null;
  private config: WebRTCConfig;

  constructor() {
    // Check if WebRTC is available
    if (!RTCPeerConnection) {
      throw new Error('WebRTC is not available on this platform');
    }

    // Default STUN servers for WebRTC
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    };
  }

  async createPeerConnection(
    onRemoteStream: (stream: any) => void,
    onConnectionStateChange: (state: string) => void
  ): Promise<any> {
    console.log('Creating peer connection with config:', this.config);

    this.peerConnection = new RTCPeerConnection(this.config);

    // Handle remote stream
    this.peerConnection.ontrack = (event: any) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        console.log('Remote stream received');
        this.remoteStream = event.streams[0];
        onRemoteStream(event.streams[0]);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'unknown';
      console.log('Connection state changed:', state);
      onConnectionStateChange(state);
    };

    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState || 'unknown';
      console.log('ICE connection state:', state);
    };

    // Handle ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      const state = this.peerConnection?.iceGatheringState || 'unknown';
      console.log('ICE gathering state:', state);
    };

    return this.peerConnection;
  }

  async handleOffer(
    offer: string,
    onIceCandidate: (candidate: any) => void
  ): Promise<string> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('Setting remote description (offer)');
    const offerDescription = new RTCSessionDescription(JSON.parse(offer));
    await this.peerConnection.setRemoteDescription(offerDescription);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event: any) => {
      if (event.candidate) {
        console.log('New ICE candidate:', event.candidate);
        onIceCandidate(event.candidate);
      } else {
        console.log('ICE gathering complete');
      }
    };

    console.log('Creating answer');
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    console.log('Answer created and set as local description');
    return JSON.stringify(answer);
  }

  async addIceCandidate(candidate: string): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      const iceCandidate = new RTCIceCandidate(JSON.parse(candidate));
      await this.peerConnection.addIceCandidate(iceCandidate);
      console.log('ICE candidate added successfully');
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  getRemoteStream(): any {
    return this.remoteStream;
  }

  close(): void {
    console.log('Closing WebRTC connection');
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
  }

  getConnectionState(): string {
    return this.peerConnection?.connectionState || 'closed';
  }
}
