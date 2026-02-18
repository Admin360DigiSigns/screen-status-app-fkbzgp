
# Command API Troubleshooting Guide

## Overview
This guide helps you troubleshoot issues with the Remote Command API that allows your web app to trigger actions in the React Native TV app.

## Quick Diagnostics

### 1. Access the Diagnostics Screen
- Open the TV app
- Navigate to the home screen
- Click the **"🔍 Diagnostics"** button
- Review the system status

### 2. Check Command Listener Status
On the home screen, you should see:
- **Remote Commands: ● Connected** (green) - Everything is working
- **Remote Commands: ● Connecting...** (yellow) - Still connecting
- **Remote Commands: ● Disconnected** (red) - Connection failed

## Common Issues & Solutions

### Issue 1: Commands Not Being Received

**Symptoms:**
- POST request returns 200 OK
- Command appears in database
- App doesn't execute the action

**Solutions:**

1. **Check if the app is on the home screen**
   - Commands are only processed when the home screen is active
   - Navigate to the home screen and try again

2. **Verify device ID matches**
   ```bash
   # In the app, check the Device ID in the diagnostics screen
   # In your web app, ensure you're sending the same device_id
   ```

3. **Check command listener logs**
   - Open the app console/logs
   - Look for messages starting with `[CommandListener]`
   - Verify handlers are registered

4. **Test the command listener**
   - Go to Diagnostics screen
   - Click "🧪 Test Command Listener"
   - Check if test command appears in history

### Issue 2: Display Not Registered

**Symptoms:**
- Diagnostics shows "Display: Not registered"
- POST request returns 404

**Solutions:**

1. **Login to the app**
   - Make sure you've logged in with username/password
   - The display is registered during login

2. **Check displays table**
   ```sql
   SELECT * FROM displays WHERE device_id = 'your_device_id';
   ```

3. **Manually register if needed**
   - Logout and login again
   - This will re-register the display

### Issue 3: Edge Function Errors

**Symptoms:**
- POST request returns 500 error
- No command created in database

**Solutions:**

1. **Check Edge Function logs**
   - Go to Supabase Dashboard
   - Navigate to Edge Functions → send-app-command
   - Check the logs for errors

2. **Verify request payload**
   ```json
   {
     "device_id": "your_device_id",
     "command": "preview_content"
   }
   ```
   OR
   ```json
   {
     "screen_name": "your_screen_name",
     "command": "screenshare"
   }
   ```

3. **Check RLS policies**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'app_commands';
   ```

### Issue 4: Realtime Not Working

**Symptoms:**
- Commands work but with 3-5 second delay
- Command listener status shows "Disconnected"

**Solutions:**

1. **Realtime is optional**
   - The app uses polling as a fallback
   - Commands will still work, just slower

2. **Check Supabase Realtime status**
   - Go to Supabase Dashboard
   - Check if Realtime is enabled for your project

3. **Verify channel subscription**
   - Check app logs for: `📡 [CommandListener] Realtime channel status: SUBSCRIBED`

## API Reference

### Endpoint
```
POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/send-app-command
```

### Headers
```
Content-Type: application/json
apikey: your_supabase_anon_key
```

### Request Body
```json
{
  "device_id": "uuid-of-device",
  "command": "preview_content | screenshare | sync_status | logout",
  "payload": {}
}
```

### Available Commands

1. **preview_content** - Opens the content preview modal
2. **screenshare** - Opens the screen share receiver (mobile/TV only)
3. **sync_status** - Triggers a manual status sync
4. **logout** - Logs out the device

### Example cURL Request
```bash
curl -X POST \
  https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/send-app-command \
  -H 'Content-Type: application/json' \
  -H 'apikey: YOUR_SUPABASE_ANON_KEY' \
  -d '{
    "device_id": "your-device-id",
    "command": "preview_content"
  }'
```

### Example JavaScript (Web App)
```javascript
async function sendCommand(deviceId, command) {
  const response = await fetch(
    'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/send-app-command',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'YOUR_SUPABASE_ANON_KEY',
      },
      body: JSON.stringify({
        device_id: deviceId,
        command: command,
      }),
    }
  );

  const result = await response.json();
  console.log('Command result:', result);
  return result;
}

// Usage
await sendCommand('device-uuid', 'preview_content');
```

## Debugging Checklist

- [ ] App is logged in
- [ ] App is on the home screen
- [ ] Device ID matches between app and web app
- [ ] Display is registered in database
- [ ] Command listener status is "Connected" or "Connecting"
- [ ] POST request returns 200 OK
- [ ] Command appears in app_commands table
- [ ] Command status changes from "pending" to "processing" to "completed"
- [ ] Edge Function logs show no errors
- [ ] RLS policies allow command insertion

## Database Queries for Debugging

### Check if display is registered
```sql
SELECT * FROM displays 
WHERE device_id = 'your_device_id' 
OR screen_name = 'your_screen_name';
```

### Check pending commands
```sql
SELECT * FROM app_commands 
WHERE device_id = 'your_device_id' 
AND status = 'pending'
ORDER BY created_at DESC;
```

### Check command history
```sql
SELECT * FROM app_commands 
WHERE device_id = 'your_device_id'
ORDER BY created_at DESC
LIMIT 20;
```

### Check failed commands
```sql
SELECT * FROM app_commands 
WHERE device_id = 'your_device_id' 
AND status = 'failed'
ORDER BY created_at DESC;
```

## Still Having Issues?

1. **Check the app console logs**
   - Look for errors or warnings
   - Search for `[CommandListener]` messages

2. **Use the Diagnostics screen**
   - It provides real-time status of all components
   - Test the command listener directly

3. **Verify your setup**
   - Ensure all tables exist
   - Check RLS policies
   - Verify Edge Function is deployed

4. **Test with a simple command**
   - Try `sync_status` first (simplest command)
   - Then try `preview_content`
   - Finally try `screenshare`

## Contact & Support

If you're still experiencing issues after following this guide:
1. Check the app console logs
2. Check the Edge Function logs in Supabase
3. Review the command history in the database
4. Use the Diagnostics screen to identify the specific issue
