
# WebRTC Screen Share Implementation Guide

## Overview

This app implements WebRTC screen sharing using a **WebView-based approach** instead of `react-native-webrtc`. This approach has several advantages:

- ✅ Works with Expo without custom native builds
- ✅ No native dependencies required
- ✅ Uses the browser's native WebRTC API
- ✅ Easier to maintain and debug
- ✅ Cross-platform compatible (iOS & Android)

## Architecture

### Components

1. **ScreenShareReceiver.tsx**
   - Main component that handles screen share receiving
   - Uses `react-native-webview` to run WebRTC code
   - Manages connection state and UI

2. **screenShareApi.ts**
   - API service for communicating with Supabase Edge Functions
   - Handles polling for offers and sending answers
   - Endpoints:
     - `POST /screen-share-get-offer` - Poll for screen share offers
     - `POST /screen-share-send-answer` - Send WebRTC answer

3. **webrtcService.ts**
   - Placeholder service for backward compatibility
   - Documents the WebView-based approach

## How It Works

### 1. User Presses Screen Share Button

When the user presses the "📺 Screen Share" button on the home screen:

```typescript
const handleScreenShare = () => {
  console.log('🎬 Screen Share button pressed - Opening screen share receiver');
  
  // Verify credentials
  if (!username || !password || !screenName) {
    Alert.alert('Error', 'Missing credentials for screen share');
    return;
  }
  
  // Open screen share modal
  setIsScreenShareMode(true);
};
```

### 2. WebView Initialization

The `ScreenShareReceiver` component creates a WebView with embedded HTML/JavaScript:

```typescript
<WebView
  source={{ html: generateHTML() }}
  onMessage={handleWebViewMessage}
  javaScriptEnabled={true}
  mediaPlaybackRequiresUserAction={false}
  allowsInlineMediaPlayback={true}
/>
```

### 3. Polling for Offers

The WebView JavaScript polls the API every 2.5 seconds:

```javascript
async function pollForOffers() {
  const response = await fetch(API_URL + '/screen-share-get-offer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  
  if (response.status === 200) {
    const data = await response.json();
    if (data.session) {
      await handleOffer(data.session);
    }
  }
}
```

### 4. WebRTC Connection Setup

When an offer is received:

1. Create RTCPeerConnection with STUN servers
2. Set remote description (offer)
3. Create answer
4. Collect ICE candidates
5. Send answer back to server
6. Add remote ICE candidates

```javascript
// Create peer connection
const pc = new RTCPeerConnection({ iceServers });

// Handle incoming stream
pc.ontrack = (event) => {
  videoEl.srcObject = event.streams[0];
};

// Set remote description and create answer
await pc.setRemoteDescription({ type: 'offer', sdp: offerData.offer });
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);

// Send answer to server
await fetch(API_URL + '/screen-share-send-answer', {
  method: 'POST',
  body: JSON.stringify({
    session_id: offerData.id,
    answer: answer.sdp,
    answer_ice_candidates: iceCandidates,
  }),
});
```

### 5. Video Display

Once connected, the remote stream is displayed in the WebView's video element:

```html
<video id="video" autoplay playsinline></video>
```

## API Endpoints

### GET Offer

**Endpoint:** `POST /screen-share-get-offer`

**Request:**
```json
{
  "screen_username": "user123",
  "screen_password": "pass123",
  "screen_name": "STORE1"
}
```

**Response (200):**
```json
{
  "display_id": "uuid",
  "session": {
    "id": "session-uuid",
    "display_id": "uuid",
    "offer": "v=0\r\no=- ...",
    "ice_candidates": [
      {
        "candidate": "candidate:...",
        "sdpMLineIndex": 0,
        "sdpMid": "0"
      }
    ],
    "status": "pending",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Response (200 - No session):**
```json
{
  "display_id": "uuid",
  "session": null
}
```

### Send Answer

**Endpoint:** `POST /screen-share-send-answer`

**Request:**
```json
{
  "screen_username": "user123",
  "screen_password": "pass123",
  "screen_name": "STORE1",
  "session_id": "session-uuid",
  "answer": "v=0\r\na=...",
  "answer_ice_candidates": [
    {
      "candidate": "candidate:...",
      "sdpMLineIndex": 0,
      "sdpMid": "0"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Answer received successfully"
}
```

## Configuration

### STUN Servers

The implementation uses Google's public STUN servers:

```javascript
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];
```

### Polling Interval

```javascript
const POLL_INTERVAL = 2500; // 2.5 seconds
```

### ICE Gathering Timeout

```javascript
const ICE_GATHERING_TIMEOUT = 5000; // 5 seconds
```

## Platform Support

- ✅ **iOS**: Fully supported
- ✅ **Android**: Fully supported
- ❌ **Web**: Not supported (WebView not available)

## Permissions Required

### iOS (app.json)

```json
{
  "ios": {
    "infoPlist": {
      "NSCameraUsageDescription": "This app needs camera access for WebRTC screen sharing",
      "NSMicrophoneUsageDescription": "This app needs microphone access for WebRTC screen sharing"
    }
  }
}
```

### Android (app.json)

```json
{
  "android": {
    "permissions": [
      "INTERNET",
      "ACCESS_NETWORK_STATE",
      "CAMERA",
      "RECORD_AUDIO",
      "MODIFY_AUDIO_SETTINGS"
    ]
  }
}
```

## Troubleshooting

### Issue: Video not displaying

**Solution:** Check that:
- WebView has `mediaPlaybackRequiresUserAction={false}`
- WebView has `allowsInlineMediaPlayback={true}`
- Video element has `autoplay` and `playsinline` attributes

### Issue: Connection fails

**Solution:** Check that:
- STUN servers are accessible
- ICE candidates are being collected
- Answer is sent successfully to the server

### Issue: Authentication fails

**Solution:** Verify that:
- Credentials are correct
- User is logged in
- API endpoints are accessible

## Testing

### 1. Start the app

```bash
npm run dev
```

### 2. Login with credentials

- Username: Your screen username
- Password: Your screen password
- Screen Name: Your screen name

### 3. Press "📺 Screen Share" button

The app will:
1. Open the screen share receiver
2. Start polling for offers
3. Display "Waiting for screen share..."

### 4. Start screen share from web app

From your web application:
1. Create a screen share offer
2. Send it to the API
3. The mobile app will receive it and establish connection

### 5. Verify connection

You should see:
- Status changes to "✅ Connected"
- Video stream displays in the WebView
- Close button appears in top-right corner

## Future Improvements

1. **TURN Server Support**
   - Add TURN servers for better NAT traversal
   - Handle symmetric NAT scenarios

2. **Connection Quality Indicators**
   - Show connection quality metrics
   - Display bandwidth usage
   - Show latency information

3. **Recording Support**
   - Add ability to record screen share
   - Save recordings locally

4. **Multiple Streams**
   - Support multiple simultaneous screen shares
   - Switch between different streams

5. **Error Recovery**
   - Automatic reconnection on connection loss
   - Better error messages and recovery options

## References

- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [React Native WebView](https://github.com/react-native-webview/react-native-webview)
- [Expo WebView](https://docs.expo.dev/versions/latest/sdk/webview/)
- [STUN/TURN Servers](https://www.twilio.com/docs/stun-turn)
