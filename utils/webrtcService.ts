
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

export interface ScreenShareOffer {
  session: {
    id: string;
    display_id: string;
    offer: string;
    ice_candidates: Array<any>;
    status: string;
    created_at: string;
  } | null;
  display_id: string;
}

export class WebRTCService {
  private peerConnection: any = null;
  private remoteStream: any = null;
  private config: WebRTCConfig;
  private localIceCandidates: Array<any> = [];

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
    offerSdp: string,
    iceCandidates: Array<any>
  ): Promise<{ answer: string; answerIceCandidates: Array<any> }> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    // Reset local ICE candidates
    this.localIceCandidates = [];

    // Set up ICE candidate collection
    return new Promise((resolve, reject) => {
      let answerSdp: string | null = null;
      let iceCandidateTimeout: NodeJS.Timeout | null = null;

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event: any) => {
        if (event.candidate) {
          console.log('New local ICE candidate:', event.candidate);
          this.localIceCandidates.push(event.candidate);
        } else {
          console.log('ICE gathering complete');
          // All ICE candidates have been gathered
          if (answerSdp && iceCandidateTimeout) {
            clearTimeout(iceCandidateTimeout);
            resolve({
              answer: answerSdp,
              answerIceCandidates: this.localIceCandidates,
            });
          }
        }
      };

      // Process the offer
      (async () => {
        try {
          console.log('Setting remote description (offer)');
          const offerDescription = new RTCSessionDescription({
            type: 'offer',
            sdp: offerSdp,
          });
          await this.peerConnection.setRemoteDescription(offerDescription);

          // Add remote ICE candidates
          console.log('Adding remote ICE candidates:', iceCandidates.length);
          for (const candidate of iceCandidates) {
            await this.addIceCandidate(candidate);
          }

          console.log('Creating answer');
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          answerSdp = answer.sdp;

          console.log('Answer created and set as local description');

          // Set a timeout to resolve even if ICE gathering doesn't complete
          iceCandidateTimeout = setTimeout(() => {
            console.log('ICE gathering timeout - resolving with collected candidates');
            if (answerSdp) {
              resolve({
                answer: answerSdp,
                answerIceCandidates: this.localIceCandidates,
              });
            }
          }, 5000); // 5 second timeout
        } catch (error) {
          console.error('Error handling offer:', error);
          reject(error);
        }
      })();
    });
  }

  async addIceCandidate(candidate: any): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      const iceCandidate = new RTCIceCandidate(candidate);
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
    this.localIceCandidates = [];
  }

  getConnectionState(): string {
    return this.peerConnection?.connectionState || 'closed';
  }
}
