
# Quick API Reference Card

## 🚀 API Endpoint
```
POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/send-app-command
```

## 📋 Request Format
```json
{
  "screen_name": "Lobby Display",  // OR use "device_id"
  "command": "preview_content"     // See commands below
}
```

## 🎯 Available Commands

| Command | Description | Platform Support |
|---------|-------------|------------------|
| `preview_content` | Opens content preview modal | All platforms |
| `screenshare` | Opens screen share receiver | Native only (iOS/Android) |
| `sync_status` | Forces status synchronization | All platforms |
| `logout` | Logs out the user | All platforms |

## ⚡ Quick Test (cURL)
```bash
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/send-app-command \
  -H "Content-Type: application/json" \
  -d '{"screen_name": "YOUR_SCREEN_NAME", "command": "preview_content"}'
```

## 💻 JavaScript Example
```javascript
async function sendCommand(screenName, command) {
  const response = await fetch(
    'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/send-app-command',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screen_name: screenName, command })
    }
  );
  return await response.json();
}

// Usage
await sendCommand('Lobby Display', 'preview_content');
```

## ✅ Success Response
```json
{
  "success": true,
  "message": "Command sent successfully",
  "command_id": "uuid",
  "device_id": "string",
  "screen_name": "string",
  "command": "string"
}
```

## ❌ Error Response
```json
{
  "error": "Error message here"
}
```

## 🔍 Response Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success - Command sent |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Device/screen not found |
| 500 | Server Error - Internal error |

## 📝 Notes

- Either `screen_name` OR `device_id` is required (not both)
- Commands are delivered in real-time (< 1 second)
- Fallback polling every 5 seconds ensures delivery
- Device must be logged in and on home screen
- Commands expire after 24 hours

## 🧪 Test Page

Open `TEST_COMMAND_API.html` in your browser for a visual testing interface.

## 📚 Full Documentation

See `WEB_APP_INTEGRATION_GUIDE.md` for complete integration guide.
