
# Screen Share Implementation Guide

## Overview

This app implements a complete WebRTC-based screen sharing system where:
- **Web App (Sender)**: Shares screen content
- **Mobile App (Receiver)**: Displays the shared screen

## Architecture

### Database Tables

#### 1. `displays` Table
Stores display device credentials and status.

```sql
- id: UUID (primary key)
- screen_username: TEXT
- screen_password: TEXT
- screen_name: TEXT (unique)
- device_id: TEXT
- status: TEXT ('online' | 'offline')
- last_seen: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

#### 2. `screen_share_sessions` Table
Stores WebRTC signaling data (offers and answers).

```sql
- id: UUID (primary key)
- display_id: TEXT (references screen_name)
- offer: TEXT (WebRTC SDP offer from web app)
- ice_candidates: JSONB (ICE candidates from web app)
- answer: TEXT (WebRTC SDP answer from mobile app)
- answer_ice_candidates: JSONB (ICE candidates from mobile app)
- status: TEXT ('waiting' | 'connected' | 'ended')
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
- expires_at: TIMESTAMPTZ (5 minutes from creation)
```

### Edge Functions

#### 1. `display-register`
**Purpose**: Register or update display credentials
**Called by**: Mobile app on login
**Method**: POST
**Body**:
```json
{
  "screen_username": "string",
  "screen_password": "string",
  "screen_name": "string",
  "device_id": "string"
}
```

#### 2. `screen-share-create-offer`
**Purpose**: Create a new screen share session with WebRTC offer
**Called by**: Web app when starting screen share
**Method**: POST
**Body**:
```json
{
  "display_id": "string",
  "offer": "string (SDP)",
  "ice_candidates": [...]
}
```

#### 3. `screen-share-get-offer`
**Purpose**: Poll for available screen share offers
**Called by**: Mobile app (every 2.5 seconds)
**Method**: POST
**Body**:
```json
{
  "screen_username": "string",
  "screen_password": "string",
  "screen_name": "string"
}
```
**Response**:
```json
{
  "display_id": "string",
  "session": {
    "id": "uuid",
    "display_id": "string",
    "offer": "string (SDP)",
    "ice_candidates": [...],
    "status": "waiting",
    "created_at": "timestamp"
  } | null
}
```

#### 4. `screen-share-send-answer` ⭐ **CRITICAL**
**Purpose**: Send WebRTC answer back to server
**Called by**: Mobile app after creating answer
**Method**: POST
**Body**:
```json
{
  "screen_username": "string",
  "screen_password": "string",
  "screen_name": "string",
  "session_id": "uuid",
  "answer": "string (SDP)",
  "answer_ice_candidates": [...]
}
```
**Response**:
```json
{
  "success": true,
  "message": "Answer received and stored successfully",
  "session_id": "uuid"
}
```

#### 5. `screen-share-get-answer`
**Purpose**: Poll for WebRTC answer from mobile app
**Called by**: Web app (after creating offer)
**Method**: POST
**Body**:
```json
{
  "session_id": "uuid"
}
```
**Response**:
```json
{
  "session_id": "uuid",
  "display_id": "string",
  "status": "connected",
  "answer": "string (SDP)",
  "answer_ice_candidates": [...],
  "has_answer": true
}
```

## WebRTC Flow

### Step 1: Web App Creates Offer
1. Web app captures screen using `navigator.mediaDevices.getDisplayMedia()`
2. Creates RTCPeerConnection
3. Adds screen tracks to peer connection
4. Creates WebRTC offer
5. Collects ICE candidates
6. Calls `screen-share-create-offer` endpoint with offer + ICE candidates
7. Receives `session_id` in response

### Step 2: Mobile App Polls for Offer
1. Mobile app polls `screen-share-get-offer` every 2.5 seconds
2. When session is available, receives offer + ICE candidates
3. Creates RTCPeerConnection
4. Sets remote description (offer)
5. Adds remote ICE candidates
6. Creates WebRTC answer
7. Collects local ICE candidates

### Step 3: Mobile App Sends Answer ⭐ **CRITICAL STEP**
1. Mobile app calls `screen-share-send-answer` endpoint
2. Sends answer SDP + ICE candidates
3. Server stores answer in `screen_share_sessions` table
4. Updates session status to 'connected'

### Step 4: Web App Gets Answer
1. Web app polls `screen-share-get-answer` endpoint
2. When answer is available, receives answer + ICE candidates
3. Sets remote description (answer)
4. Adds remote ICE candidates
5. WebRTC connection established!

### Step 5: Stream Display
1. Mobile app receives remote stream via `ontrack` event
2. Displays stream using `RTCView` component
3. Connection state changes to 'connected'

## Mobile App Implementation

### Key Files

#### `utils/webrtcService.ts`
- Manages WebRTC peer connection
- Handles offer/answer creation
- Collects ICE candidates
- Manages connection state

#### `utils/screenShareApi.ts`
- `getScreenShareOffer()`: Polls for offers
- `sendScreenShareAnswer()`: **Sends answer to server** ⭐

#### `components/ScreenShareReceiver.tsx`
- Main UI component
- Polls for offers every 2.5 seconds
- Creates answer when offer received
- **Calls `sendScreenShareAnswer()` to send answer** ⭐
- Displays remote stream

### Critical Code Path

```typescript
// 1. Poll for offer
const response = await getScreenShareOffer(credentials);

// 2. When offer received, handle it
if (response.data?.session) {
  // 3. Create answer
  const { answer, answerIceCandidates } = await webrtcService.handleOffer(
    session.offer,
    session.ice_candidates
  );

  // 4. ⭐ SEND ANSWER TO SERVER ⭐
  const answerResponse = await sendScreenShareAnswer({
    screen_username: username,
    screen_password: password,
    screen_name: screenName,
    session_id: session.id,
    answer: answer,
    answer_ice_candidates: answerIceCandidates,
  });

  // 5. Wait for connection to establish
  // Connection state will change to 'connected' when successful
}
```

## Debugging

### Check if Answer is Being Sent

1. **Mobile App Logs**:
   - Look for: `"📤 Sending screen share answer for session:"`
   - Look for: `"✅✅✅ Answer sent successfully:"`
   - Look for: `"Send answer response status: 200"`

2. **Database Check**:
   ```sql
   SELECT 
     id, 
     display_id, 
     status, 
     answer IS NOT NULL as has_answer,
     LENGTH(answer) as answer_length,
     jsonb_array_length(answer_ice_candidates) as ice_count,
     created_at,
     updated_at
   FROM screen_share_sessions
   ORDER BY created_at DESC
   LIMIT 5;
   ```

3. **Edge Function Logs**:
   - Check Supabase Dashboard → Edge Functions → screen-share-send-answer
   - Look for: `"✅ Session updated successfully:"`
   - Look for: `"answer_ice_candidates_count:"`

### Common Issues

#### Issue: "NO answer being stored"
**Cause**: Mobile app not calling `sendScreenShareAnswer()`
**Solution**: Verify the code path in `ScreenShareReceiver.tsx` is executing

#### Issue: "Failed to establish connection"
**Cause**: Answer sent but WebRTC connection fails
**Possible reasons**:
- Firewall blocking WebRTC traffic
- NAT traversal issues
- Missing/invalid ICE candidates
- STUN/TURN server issues

**Solution**:
- Check ICE connection state
- Verify ICE candidates are being collected
- Add TURN servers for better connectivity

#### Issue: "Session not found or unauthorized"
**Cause**: Authentication failure or session expired
**Solution**:
- Verify credentials match
- Check session hasn't expired (5 minute timeout)
- Ensure display is registered

## Testing Checklist

- [ ] Mobile app can login and register display
- [ ] Web app can create screen share offer
- [ ] Mobile app polls and receives offer
- [ ] Mobile app creates answer
- [ ] **Mobile app sends answer to server** ⭐
- [ ] Answer is stored in database
- [ ] Web app receives answer
- [ ] WebRTC connection establishes
- [ ] Stream displays on mobile app

## Web App Integration

To integrate with a web app, implement the following:

### 1. Create Offer
```javascript
// Create peer connection
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // Add more STUN/TURN servers
  ]
});

// Get screen stream
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: false
});

// Add tracks
stream.getTracks().forEach(track => pc.addTrack(track, stream));

// Collect ICE candidates
const iceCandidates = [];
pc.onicecandidate = (event) => {
  if (event.candidate) {
    iceCandidates.push({
      candidate: event.candidate.candidate,
      sdpMLineIndex: event.candidate.sdpMLineIndex,
      sdpMid: event.candidate.sdpMid
    });
  }
};

// Create offer
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

// Wait for ICE gathering
await new Promise(resolve => {
  if (pc.iceGatheringState === 'complete') {
    resolve();
  } else {
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      }
    };
  }
});

// Send to server
const response = await fetch('https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/screen-share-create-offer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    display_id: 'your-display-name',
    offer: offer.sdp,
    ice_candidates: iceCandidates
  })
});

const { session_id } = await response.json();
```

### 2. Poll for Answer
```javascript
// Poll every 1 second
const pollInterval = setInterval(async () => {
  const response = await fetch('https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/screen-share-get-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id })
  });

  const data = await response.json();

  if (data.has_answer) {
    clearInterval(pollInterval);

    // Set remote description
    await pc.setRemoteDescription({
      type: 'answer',
      sdp: data.answer
    });

    // Add ICE candidates
    for (const candidate of data.answer_ice_candidates) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }

    console.log('Connection established!');
  }
}, 1000);
```

## Summary

The screen sharing system is now fully implemented with:

✅ Database tables created
✅ Edge Functions deployed
✅ Mobile app polling for offers
✅ Mobile app creating answers
✅ **Mobile app sending answers to server** ⭐
✅ Comprehensive logging and debugging
✅ Error handling and retry logic

The critical fix was ensuring the mobile app calls the `screen-share-send-answer` endpoint after creating the WebRTC answer. This endpoint is now deployed and the mobile app is correctly calling it.
