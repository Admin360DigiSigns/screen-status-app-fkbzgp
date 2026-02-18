
# Device Connection and Command Handling Improvements

## Overview
This document describes the improvements made to the device connection and pending command handling system.

## Changes Made

### 1. Login Screen (`app/login.tsx`)
**Removed:**
- Auto-registration feature that attempted to register the device if login failed
- The "Login / Register" button text

**Improved:**
- Simplified login flow - only attempts login with provided credentials
- Clearer error messages when login fails
- Better user feedback with updated info text

**Why:**
- Registration is handled separately by administrators
- Devices should only login with pre-configured credentials
- Simpler flow reduces confusion and potential errors

### 2. Authentication Context (`contexts/AuthContext.tsx`)
**Removed:**
- `register` function from the context (no longer needed)

**Kept:**
- All existing login functionality
- Status update intervals (every 1 minute when on home screen)
- Command listener initialization
- Proper cleanup on logout

### 3. Command Listener (`utils/commandListener.ts`)
**Improved:**
- **Faster polling**: Reduced from 3 seconds to 2 seconds for better responsiveness
- **Better error handling**: Added consecutive error tracking to prevent infinite retry loops
- **Connection status tracking**: More accurate status reporting (connected/connecting/disconnected)
- **Automatic recovery**: Resets error counter on successful polls
- **Better logging**: More detailed logs for debugging

**Key Features:**
- Dual mechanism: Realtime channel + polling for reliability
- Prevents duplicate command execution
- Marks commands as processing → completed/failed
- Automatic acknowledgment of commands

### 4. API Service (`utils/apiService.ts`)
**Fixed:**
- Updated all API endpoints to use the correct Supabase project (`pgcdokfiaarnhzryfzwf`)
- Consistent endpoint usage across login, status updates, and content fetching

**Endpoints:**
- Login: `https://pgcdokfiaarnhzryfzwf.supabase.co/functions/v1/display-connect`
- Status: `https://pgcdokfiaarnhzryfzwf.supabase.co/functions/v1/display-status`
- Content: `https://pgcdokfiaarnhzryfzwf.supabase.co/functions/v1/display-get-content`
- Commands: `https://pgcdokfiaarnhzryfzwf.supabase.co/functions/v1/get-pending-commands`

## How It Works

### Login Flow
1. User enters username, password, and screen name
2. App calls `display-connect` Edge Function
3. Edge Function validates credentials against `displays` table
4. On success, device_id is updated and user is logged in
5. Command listener starts automatically

### Command Handling Flow
1. **Web app** sends command via `send-app-command` Edge Function
2. Command is inserted into `app_commands` table with status='pending'
3. **Device app** polls every 2 seconds via `get-pending-commands` Edge Function
4. When command is found:
   - Status updated to 'processing'
   - Command handler executes the action
   - Status updated to 'completed' or 'failed'
5. Web app can check command status in real-time

### Status Updates
- Sent every 1 minute when user is on the home screen
- Includes device_id, screen_name, credentials, and online/offline status
- Updates `displays` table with latest status and last_seen timestamp

## Testing the System

### 1. Test Login
```bash
# Should succeed with valid credentials
curl -X POST https://pgcdokfiaarnhzryfzwf.supabase.co/functions/v1/display-connect \
  -H "Content-Type: application/json" \
  -d '{
    "screen_username": "your_username",
    "screen_password": "your_password",
    "screen_name": "Test Display",
    "device_id": "test-device-123"
  }'
```

### 2. Test Command Sending
```bash
# Send a test command
curl -X POST https://pgcdokfiaarnhzryfzwf.supabase.co/functions/v1/send-app-command \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "your-device-id",
    "command": "sync_status"
  }'
```

### 3. Check Command Status
```sql
-- In Supabase SQL Editor
SELECT * FROM app_commands 
WHERE device_id = 'your-device-id' 
ORDER BY created_at DESC 
LIMIT 10;
```

### 4. Use Diagnostics Screen
- Navigate to the Diagnostics screen in the app
- View connection status, command history, and system health
- Use "Test Command Listener" button to create a test command

## Troubleshooting

### Commands Not Being Received
1. Check device is logged in and on home screen
2. Verify command listener status shows "Connected"
3. Check Edge Function logs in Supabase dashboard
4. Verify device_id matches between app and web app
5. Check `app_commands` table for pending commands

### Login Failures
1. Verify credentials are correct
2. Check display is registered in `displays` table
3. Check Edge Function logs for errors
4. Verify internet connection

### Status Updates Not Working
1. Ensure user is on home screen (not diagnostics or other screens)
2. Check console logs for status update messages
3. Verify `display-status` Edge Function is working
4. Check `displays` table for last_seen updates

## Database Schema

### displays table
```sql
- id (uuid, primary key)
- screen_username (text)
- screen_password (text)
- screen_name (text, unique)
- device_id (text, nullable)
- status (text: 'online' | 'offline')
- last_seen (timestamptz)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### app_commands table
```sql
- id (uuid, primary key)
- device_id (text)
- screen_name (text)
- command (text: 'preview_content' | 'screenshare' | 'sync_status' | 'logout')
- status (text: 'pending' | 'processing' | 'completed' | 'failed')
- payload (jsonb)
- created_at (timestamptz)
- updated_at (timestamptz)
- executed_at (timestamptz, nullable)
- error_message (text, nullable)
```

## Next Steps

1. **Monitor command execution** in production
2. **Adjust polling interval** if needed (currently 2 seconds)
3. **Add command retry logic** for failed commands
4. **Implement command expiration** (auto-fail old pending commands)
5. **Add more command types** as needed

## Notes

- Registration must be done separately (not through the app)
- Devices must be pre-configured in the `displays` table
- Command listener only runs when user is logged in
- Status updates only sent when on home screen
- All Edge Functions use CORS headers for web app compatibility
