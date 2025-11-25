
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
  private iceGatheringComplete: boolean = false;
  private remoteIceCandidatesQueue: Array<any> = [];
  private isRemoteDescriptionSet: boolean = false;

  constructor() {
    // Check if WebRTC is available
    if (!RTCPeerConnection) {
      throw new Error('WebRTC is not available on this platform');
    }

    // Enhanced STUN/TURN servers for better connectivity
    // Using multiple STUN servers increases chances of successful connection
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' },
        // Add more public STUN servers for redundancy
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.voip.blackberry.com:3478' },
      ],
    };
  }

  async createPeerConnection(
    onRemoteStream: (stream: any) => void,
    onConnectionStateChange: (state: string) => void
  ): Promise<any> {
    console.log('Creating peer connection with config:', JSON.stringify(this.config));

    // Create peer connection with additional configuration
    this.peerConnection = new RTCPeerConnection({
      ...this.config,
      iceCandidatePoolSize: 10, // Pre-gather ICE candidates
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    // Handle remote stream
    this.peerConnection.ontrack = (event: any) => {
      console.log('Received remote track:', event.track.kind);
      console.log('Track enabled:', event.track.enabled);
      console.log('Track readyState:', event.track.readyState);
      console.log('Track muted:', event.track.muted);
      
      if (event.streams && event.streams[0]) {
        console.log('Remote stream received with', event.streams[0].getTracks().length, 'tracks');
        const tracks = event.streams[0].getTracks();
        tracks.forEach((track: any, index: number) => {
          console.log(`Track ${index}:`, {
            kind: track.kind,
            id: track.id,
            enabled: track.enabled,
            readyState: track.readyState,
            muted: track.muted,
          });
        });
        
        this.remoteStream = event.streams[0];
        onRemoteStream(event.streams[0]);
      } else {
        console.warn('No streams in track event');
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'unknown';
      console.log('Connection state changed:', state);
      onConnectionStateChange(state);
      
      if (state === 'failed') {
        console.error('Connection failed - checking ICE connection state');
        console.error('ICE connection state:', this.peerConnection?.iceConnectionState);
        console.error('ICE gathering state:', this.peerConnection?.iceGatheringState);
        console.error('Signaling state:', this.peerConnection?.signalingState);
        console.error('Local candidates collected:', this.localIceCandidates.length);
      } else if (state === 'connected') {
        console.log('✅ WebRTC connection established successfully!');
        console.log('Connection stats:', {
          iceConnectionState: this.peerConnection?.iceConnectionState,
          iceGatheringState: this.peerConnection?.iceGatheringState,
          signalingState: this.peerConnection?.signalingState,
          localCandidates: this.localIceCandidates.length,
        });
      }
    };

    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState || 'unknown';
      console.log('ICE connection state:', state);
      
      if (state === 'failed') {
        console.error('ICE connection failed - possible network/firewall issue');
        console.error('Local candidates collected:', this.localIceCandidates.length);
        console.error('Remote candidates in queue:', this.remoteIceCandidatesQueue.length);
        
        // Attempt ICE restart
        console.log('Attempting ICE restart...');
        this.restartIce();
      } else if (state === 'connected' || state === 'completed') {
        console.log('✅ ICE connection established successfully');
      } else if (state === 'checking') {
        console.log('ICE checking connectivity...');
      } else if (state === 'disconnected') {
        console.warn('ICE connection disconnected - may reconnect automatically');
      }
    };

    // Handle ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      const state = this.peerConnection?.iceGatheringState || 'unknown';
      console.log('ICE gathering state:', state);
      
      if (state === 'complete') {
        this.iceGatheringComplete = true;
        console.log('✅ ICE gathering completed with', this.localIceCandidates.length, 'candidates');
        
        // Log candidate types
        const candidateTypes = this.localIceCandidates.reduce((acc: any, candidate: any) => {
          const type = this.extractCandidateType(candidate.candidate);
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
        console.log('Candidate types:', candidateTypes);
      }
    };

    // Handle signaling state
    this.peerConnection.onsignalingstatechange = () => {
      const state = this.peerConnection?.signalingState || 'unknown';
      console.log('Signaling state:', state);
    };

    // Handle negotiation needed
    this.peerConnection.onnegotiationneeded = () => {
      console.log('Negotiation needed');
    };

    return this.peerConnection;
  }

  private extractCandidateType(candidateString: string): string {
    if (candidateString.includes('typ host')) return 'host';
    if (candidateString.includes('typ srflx')) return 'srflx';
    if (candidateString.includes('typ relay')) return 'relay';
    if (candidateString.includes('typ prflx')) return 'prflx';
    return 'unknown';
  }

  private async restartIce(): Promise<void> {
    if (!this.peerConnection) {
      console.error('Cannot restart ICE: peer connection not initialized');
      return;
    }

    try {
      console.log('Restarting ICE...');
      // Create a new offer with iceRestart flag
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      console.log('ICE restart initiated');
    } catch (error) {
      console.error('Failed to restart ICE:', error);
    }
  }

  async handleOffer(
    offerSdp: string,
    iceCandidates: Array<any>
  ): Promise<{ answer: string; answerIceCandidates: Array<any> }> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('=== Starting offer handling ===');
    console.log('Offer SDP length:', offerSdp.length);
    console.log('Remote ICE candidates count:', iceCandidates.length);

    // Reset state
    this.localIceCandidates = [];
    this.iceGatheringComplete = false;
    this.remoteIceCandidatesQueue = [];
    this.isRemoteDescriptionSet = false;

    // Set up ICE candidate collection
    return new Promise((resolve, reject) => {
      let answerSdp: string | null = null;
      let iceCandidateTimeout: NodeJS.Timeout | null = null;
      let resolved = false;

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event: any) => {
        if (event.candidate) {
          const candidateType = this.extractCandidateType(event.candidate.candidate);
          console.log('New local ICE candidate:', {
            type: candidateType,
            protocol: event.candidate.protocol,
            address: event.candidate.address,
            port: event.candidate.port,
            priority: event.candidate.priority,
          });
          
          // Store the candidate in a serializable format
          const candidateObj = {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          };
          
          this.localIceCandidates.push(candidateObj);
        } else {
          console.log('✅ ICE gathering complete (null candidate received)');
          this.iceGatheringComplete = true;
          
          // All ICE candidates have been gathered
          if (answerSdp && !resolved) {
            resolved = true;
            if (iceCandidateTimeout) {
              clearTimeout(iceCandidateTimeout);
            }
            console.log('✅ Resolving with', this.localIceCandidates.length, 'ICE candidates');
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
          this.isRemoteDescriptionSet = true;
          console.log('✅ Remote description set successfully');

          // Add remote ICE candidates AFTER setting remote description
          console.log('Adding', iceCandidates.length, 'remote ICE candidates');
          for (let i = 0; i < iceCandidates.length; i++) {
            const candidate = iceCandidates[i];
            try {
              await this.addIceCandidate(candidate);
              console.log(`✅ Added remote ICE candidate ${i + 1}/${iceCandidates.length}`);
            } catch (error) {
              console.error(`Failed to add remote ICE candidate ${i + 1}:`, error);
              // Continue with other candidates
            }
          }
          console.log('✅ All remote ICE candidates processed');

          // Process any queued candidates
          if (this.remoteIceCandidatesQueue.length > 0) {
            console.log('Processing', this.remoteIceCandidatesQueue.length, 'queued candidates');
            for (const candidate of this.remoteIceCandidatesQueue) {
              try {
                await this.addIceCandidate(candidate);
              } catch (error) {
                console.error('Failed to add queued candidate:', error);
              }
            }
            this.remoteIceCandidatesQueue = [];
          }

          console.log('Creating answer');
          const answer = await this.peerConnection.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          
          console.log('Answer created, setting as local description');
          await this.peerConnection.setLocalDescription(answer);
          answerSdp = answer.sdp;

          console.log('✅ Answer SDP length:', answerSdp.length);
          console.log('Waiting for ICE candidates...');

          // Set a timeout to resolve even if ICE gathering doesn't complete
          // Increased timeout to 15 seconds for better candidate collection
          iceCandidateTimeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              console.log('⏱️ ICE gathering timeout - resolving with', this.localIceCandidates.length, 'collected candidates');
              if (answerSdp) {
                resolve({
                  answer: answerSdp,
                  answerIceCandidates: this.localIceCandidates,
                });
              } else {
                reject(new Error('Answer SDP not created'));
              }
            }
          }, 15000); // Increased to 15 seconds
        } catch (error) {
          console.error('❌ Error handling offer:', error);
          if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
          }
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
      // Handle both object and string formats
      let candidateObj = candidate;
      if (typeof candidate === 'string') {
        try {
          candidateObj = JSON.parse(candidate);
        } catch (e) {
          console.error('Failed to parse ICE candidate string:', e);
          return;
        }
      }

      // Validate candidate object
      if (!candidateObj || !candidateObj.candidate) {
        console.warn('Invalid ICE candidate object:', candidateObj);
        return;
      }

      // If remote description is not set yet, queue the candidate
      if (!this.isRemoteDescriptionSet) {
        console.log('Queueing ICE candidate (remote description not set yet)');
        this.remoteIceCandidatesQueue.push(candidateObj);
        return;
      }

      const iceCandidate = new RTCIceCandidate(candidateObj);
      await this.peerConnection.addIceCandidate(iceCandidate);
      
      const candidateType = this.extractCandidateType(candidateObj.candidate);
      console.log('✅ ICE candidate added successfully:', {
        type: candidateType,
        preview: candidateObj.candidate.substring(0, 50) + '...',
      });
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      // Don't throw - continue with other candidates
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
    this.iceGatheringComplete = false;
    this.remoteIceCandidatesQueue = [];
    this.isRemoteDescriptionSet = false;
  }

  getConnectionState(): string {
    return this.peerConnection?.connectionState || 'closed';
  }

  getIceConnectionState(): string {
    return this.peerConnection?.iceConnectionState || 'closed';
  }

  getIceGatheringState(): string {
    return this.peerConnection?.iceGatheringState || 'new';
  }

  getSignalingState(): string {
    return this.peerConnection?.signalingState || 'closed';
  }

  getLocalCandidatesCount(): number {
    return this.localIceCandidates.length;
  }

  getStats(): Promise<any> {
    if (!this.peerConnection) {
      return Promise.reject(new Error('Peer connection not initialized'));
    }
    return this.peerConnection.getStats();
  }
}
