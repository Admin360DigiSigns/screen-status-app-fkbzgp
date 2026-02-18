
# Screen Share - Quick Reference

## 🚀 Quick Start

### Mobile App (Receiver)
1. Login with credentials
2. Navigate to screen share view
3. App automatically polls for offers
4. When offer received, creates and sends answer
5. Displays screen share stream

### Web App (Sender)
1. Create offer: POST to `/screen-share-create-offer`
2. Poll for answer: POST to `/screen-share-get-answer`
3. Set remote description with answer
4. Connection established!

## 📡 API Endpoints

Base URL: `https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1`

| Endpoint | Method | Called By | Purpose |
|----------|--------|-----------|---------|
| `/display-register` | POST | Mobile | Register display |
| `/screen-share-create-offer` | POST | Web | Create session with offer |
| `/screen-share-get-offer` | POST | Mobile | Poll for offers (2.5s) |
| `/screen-share-send-answer` | POST | Mobile | **Send answer** ⭐ |
| `/screen-share-get-answer` | POST | Web | Poll for answer (1s) |

## 🔍 Debugging Commands

### Check Display Registration
```sql
SELECT * FROM displays WHERE screen_name = 'YOUR_SCREEN_NAME';
```

### Check Active Sessions
```sql
SELECT 
  id, 
  display_id, 
  status,
  answer IS NOT NULL as has_answer,
  created_at
FROM screen_share_sessions
WHERE status != 'ended'
ORDER BY created_at DESC;
```

### Check if Answer Was Received
```sql
SELECT 
  id,
  display_id,
  status,
  LENGTH(answer) as answer_length,
  jsonb_array_length(answer_ice_candidates) as ice_count,
  updated_at
FROM screen_share_sessions
WHERE display_id = 'YOUR_SCREEN_NAME'
ORDER BY created_at DESC
LIMIT 1;
```

## 📝 Key Logs to Watch

### Mobile App - Answer Sent Successfully ✅
```
📤 Sending screen share answer for session: uuid
✅ Send answer response status: 200
✅✅✅ Answer sent successfully
```

### Mobile App - Connection Established ✅
```
ICE connection state: connected
✅ ICE connection established successfully
Connection state changed: connected
✅ WebRTC connection established successfully!
```

### Edge Function - Answer Stored ✅
```
✅ Session updated successfully: uuid
Updated session details: { status: 'connected', has_answer: true }
```

## ⚠️ Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| No offer received | Display not registered | Check `displays` table |
| Answer not sent | Network error | Check mobile app logs |
| Answer not stored | Auth failure | Verify credentials match |
| Connection fails | Firewall/NAT | Add TURN servers |

## 🎯 Success Checklist

- [ ] Display registered (`displays` table)
- [ ] Session created (`screen_share_sessions` table)
- [ ] Mobile app receives offer (logs show "Session available")
- [ ] Mobile app creates answer (logs show "Answer created")
- [ ] **Mobile app sends answer** (logs show "Answer sent successfully") ⭐
- [ ] **Answer stored in database** (`answer IS NOT NULL`) ⭐
- [ ] Web app receives answer (polling returns `has_answer: true`)
- [ ] ICE connection state: connected
- [ ] Stream displays on mobile

## 🔧 Test Commands

### Create Test Offer (cURL)
```bash
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/screen-share-create-offer \
  -H "Content-Type: application/json" \
  -d '{
    "display_id": "test-display",
    "offer": "v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n",
    "ice_candidates": []
  }'
```

### Check Answer (cURL)
```bash
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/screen-share-get-answer \
  -H "Content-Type: application/json" \
  -d '{"session_id": "SESSION_ID_FROM_CREATE"}'
```

## 📚 Documentation

- `SCREEN_SHARE_GUIDE.md` - Complete technical guide
- `TESTING_GUIDE.md` - Step-by-step testing
- `IMPLEMENTATION_SUMMARY.md` - What was fixed

## 🎉 Status

✅ **All systems operational**
✅ **Mobile app sends answers**
✅ **Ready for production use**

---

**The critical fix**: Mobile app now successfully sends WebRTC answers to the server via the `screen-share-send-answer` endpoint, allowing the web app to complete the connection.
