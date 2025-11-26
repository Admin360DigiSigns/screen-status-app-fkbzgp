
# Screen Share Testing Guide

## Prerequisites

1. Mobile app running on a physical device or emulator (WebRTC requires development build)
2. Web app or testing tool to create screen share offers
3. Valid display credentials (username, password, screen name)

## Step-by-Step Testing

### 1. Register Display (Mobile App)

**Action**: Login to the mobile app

**Expected Logs**:
```
Login attempt: { inputUsername: 'test', inputScreenName: 'display1', deviceId: 'xxx' }
Registering display...
✅ Display registered successfully
Login successful, credentials stored
```

**Verify in Database**:
```sql
SELECT * FROM displays WHERE screen_name = 'display1';
```

Should show:
- `status`: 'online'
- `device_id`: Your device ID
- `last_seen`: Recent timestamp

---

### 2. Create Screen Share Offer (Web App)

**Using cURL**:
```bash
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/screen-share-create-offer \
  -H "Content-Type: application/json" \
  -d '{
    "display_id": "display1",
    "offer": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\na=msid-semantic: WMS stream\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:test\r\na=ice-pwd:testpassword\r\na=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r\na=setup:actpass\r\na=mid:0\r\na=sendonly\r\na=rtcp-mux\r\na=rtpmap:96 VP8/90000\r\n",
    "ice_candidates": [
      {
        "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host",
        "sdpMLineIndex": 0,
        "sdpMid": "0"
      }
    ]
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Screen share session created successfully",
  "session_id": "uuid-here",
  "display_id": "display1"
}
```

**Verify in Database**:
```sql
SELECT 
  id, 
  display_id, 
  status, 
  LENGTH(offer) as offer_length,
  jsonb_array_length(ice_candidates) as ice_count,
  answer IS NULL as waiting_for_answer
FROM screen_share_sessions 
WHERE display_id = 'display1' 
ORDER BY created_at DESC 
LIMIT 1;
```

Should show:
- `status`: 'waiting'
- `offer_length`: > 0
- `ice_count`: > 0
- `waiting_for_answer`: true

---

### 3. Mobile App Polls and Receives Offer

**Expected Logs** (every 2.5 seconds):
```
📡 Polling for screen share offer...
Get offer response status: 200
Offer response: Session available
Session details: { id: 'uuid', status: 'waiting', offerLength: 500, iceCandidatesCount: 1 }
✅ New screen share session available: uuid
```

---

### 4. Mobile App Creates Answer

**Expected Logs**:
```
=== Handling new screen share session ===
Session ID: uuid
Offer length: 500
ICE candidates: 1
Processing offer and creating answer...
Setting remote description (offer)
✅ Remote description set successfully
Adding 1 remote ICE candidates
✅ Added remote ICE candidate 1/1
Creating answer
Answer created, setting as local description
✅ Answer SDP length: 450
Waiting for ICE candidates...
New local ICE candidate: { type: 'host', protocol: 'udp', ... }
✅ ICE gathering complete (null candidate received)
✅ Resolving with 3 ICE candidates
✅ Answer created successfully
Answer length: 450
Answer ICE candidates: 3
```

---

### 5. Mobile App Sends Answer ⭐ **CRITICAL**

**Expected Logs**:
```
📤 Sending screen share answer for session: uuid
API URL: https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/screen-share-send-answer
Answer SDP length: 450
Answer ICE candidates count: 3
Answer SDP preview: v=0\r\no=- 987654321 2 IN IP4 127.0.0.1...
Formatted request ICE candidates: 3
Sample ICE candidate: {"candidate":"candidate:1 1 UDP...","sdpMLineIndex":0,"sdpMid":"0"}
Making POST request to send-answer endpoint...
✅ Send answer response status: 200
✅✅✅ Answer sent successfully: Answer received and stored successfully
Response data: {"success":true,"message":"Answer received and stored successfully","session_id":"uuid"}
```

**Verify in Database**:
```sql
SELECT 
  id, 
  display_id, 
  status, 
  answer IS NOT NULL as has_answer,
  LENGTH(answer) as answer_length,
  jsonb_array_length(answer_ice_candidates) as answer_ice_count,
  updated_at
FROM screen_share_sessions 
WHERE id = 'uuid';
```

Should show:
- `status`: 'connected'
- `has_answer`: true
- `answer_length`: > 0
- `answer_ice_count`: > 0
- `updated_at`: Recent timestamp

---

### 6. Web App Gets Answer

**Using cURL**:
```bash
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/screen-share-get-answer \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "uuid-from-step-2"
  }'
```

**Expected Response**:
```json
{
  "session_id": "uuid",
  "display_id": "display1",
  "status": "connected",
  "answer": "v=0\r\no=- 987654321...",
  "answer_ice_candidates": [
    {
      "candidate": "candidate:1 1 UDP...",
      "sdpMLineIndex": 0,
      "sdpMid": "0"
    }
  ],
  "has_answer": true
}
```

---

### 7. WebRTC Connection Establishes

**Expected Logs** (Mobile App):
```
ICE connection state: checking
ICE checking connectivity...
ICE connection state: connected
✅ ICE connection established successfully
Connection state changed: connected
✅ WebRTC connection established successfully!
Connection stats: { iceConnectionState: 'connected', iceGatheringState: 'complete', signalingState: 'stable', localCandidates: 3 }
✅ Remote stream received in component
Stream active: true
Stream tracks: 1
```

---

## Troubleshooting

### Issue: Mobile app not receiving offer

**Check**:
1. Is display registered? `SELECT * FROM displays WHERE screen_name = 'display1';`
2. Is session created? `SELECT * FROM screen_share_sessions WHERE display_id = 'display1';`
3. Are credentials correct in mobile app?
4. Check mobile app logs for authentication errors

### Issue: Answer not being sent

**Check**:
1. Mobile app logs for `"📤 Sending screen share answer"`
2. If missing, check if `handleNewSession` is being called
3. Check for errors in `webrtcService.handleOffer()`
4. Verify network connectivity

### Issue: Answer sent but not stored

**Check**:
1. Edge Function logs: Supabase Dashboard → Edge Functions → screen-share-send-answer
2. Look for errors in function execution
3. Verify session_id matches
4. Check authentication (credentials must match)

### Issue: Connection fails after answer

**Check**:
1. ICE connection state: Look for `"ICE connection state: failed"`
2. Verify ICE candidates are valid
3. Check firewall/NAT settings
4. Try adding TURN servers for better connectivity

---

## Quick Verification Script

Run this in your database to check the complete flow:

```sql
-- Check display registration
SELECT 
  'Display Registration' as check_type,
  screen_name,
  status,
  device_id IS NOT NULL as has_device_id,
  last_seen
FROM displays
WHERE screen_name = 'display1';

-- Check session creation
SELECT 
  'Session Creation' as check_type,
  id,
  display_id,
  status,
  LENGTH(offer) as offer_length,
  jsonb_array_length(ice_candidates) as offer_ice_count,
  created_at
FROM screen_share_sessions
WHERE display_id = 'display1'
ORDER BY created_at DESC
LIMIT 1;

-- Check answer received
SELECT 
  'Answer Received' as check_type,
  id,
  status,
  answer IS NOT NULL as has_answer,
  LENGTH(answer) as answer_length,
  jsonb_array_length(answer_ice_candidates) as answer_ice_count,
  updated_at
FROM screen_share_sessions
WHERE display_id = 'display1'
ORDER BY created_at DESC
LIMIT 1;
```

Expected output:
```
check_type            | screen_name | status | has_device_id | last_seen
Display Registration  | display1    | online | true          | 2024-01-26 10:30:00

check_type            | id   | display_id | status    | offer_length | offer_ice_count | created_at
Session Creation      | uuid | display1   | connected | 500          | 1               | 2024-01-26 10:31:00

check_type            | id   | status    | has_answer | answer_length | answer_ice_count | updated_at
Answer Received       | uuid | connected | true       | 450           | 3                | 2024-01-26 10:31:05
```

---

## Success Criteria

✅ Display registered in database
✅ Session created with offer
✅ Mobile app receives offer
✅ Mobile app creates answer
✅ **Answer sent to server (status 200)** ⭐
✅ **Answer stored in database** ⭐
✅ Web app receives answer
✅ ICE connection state: connected
✅ Stream displays on mobile app

If all criteria are met, the screen sharing system is working correctly!
