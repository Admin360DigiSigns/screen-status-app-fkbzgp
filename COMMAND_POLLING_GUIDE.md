
# Command Polling Implementation Guide

## Overview

The mobile app now uses a **polling mechanism** to retrieve pending commands from the webapp. This replaces the previous direct database query approach with a more robust API-based solution.

## Architecture

### Edge Functions

Two new Supabase Edge Functions have been deployed:

#### 1. `get-pending-commands`
**Purpose:** Retrieve pending commands for a specific device or screen.

**Endpoint:** `https://pgcdokfiaarnhzryfzwf.supabase.co/functions/v1/get-pending-commands`

**Method:** POST

**Request Body:**
```json
{
  "device_id": "optional-device-id",
  "screen_name": "optional-screen-name"
}
```

**Response:**
```json
{
  "success": true,
  "commands": [
    {
      "id": "command-uuid",
      "device_id": "device-id",
      "screen_name": "STORE2",
      "command": "preview_content",
      "status": "pending",
      "payload": {},
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "executed_at": null,
      "error_message": null
    }
  ],
  "count": 1
}
```

#### 2. `acknowledge-command`
**Purpose:** Update the status of a command after execution.

**Endpoint:** `https://pgcdokfiaarnhzryfzwf.supabase.co/functions/v1/acknowledge-command`

**Method:** POST

**Request Body:**
```json
{
  "command_id": "command-uuid",
  "status": "completed",
  "error_message": "optional-error-message"
}
```

**Valid Status Values:**
- `processing` - Command is being executed
- `completed` - Command executed successfully
- `failed` - Command execution failed

**Response:**
```json
{
  "success": true,
  "command": {
    "id": "command-uuid",
    "device_id": "device-id",
    "screen_name": "STORE2",
    "command": "preview_content",
    "status": "completed",
    "payload": {},
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "executed_at": "2024-01-01T00:00:05Z",
    "error_message": null
  }
}
```

## Mobile App Implementation

### Command Listener Service

The `commandListener` service in `utils/commandListener.ts` has been updated to:

1. **Poll for commands** every 3 seconds using the `get-pending-commands` endpoint
2. **Acknowledge commands** using the `acknowledge-command` endpoint after execution

### Polling Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile App                              │
│                                                             │
│  1. Poll every 3 seconds                                    │
│     ↓                                                       │
│  2. Call get-pending-commands                               │
│     ↓                                                       │
│  3. Receive pending commands                                │
│     ↓                                                       │
│  4. Execute command handler                                 │
│     ↓                                                       │
│  5. Call acknowledge-command with status                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Command Execution Flow

1. **Pending** → Command is created by webapp
2. **Processing** → Mobile app starts executing the command
3. **Completed/Failed** → Mobile app finishes execution and updates status

## Webapp Integration

### Sending Commands

The webapp should continue using the existing `send-app-command` endpoint:

**Endpoint:** `https://pgcdokfiaarnhzryfzwf.supabase.co/functions/v1/send-app-command`

**Method:** POST

**Request Body:**
```json
{
  "screen_name": "STORE2",
  "command": "preview_content"
}
```

**Available Commands:**
- `preview_content` - Show content preview
- `screenshare` - Start screen sharing
- `sync_status` - Sync device status
- `logout` - Logout the device

### Checking Command Status

The webapp can query the `app_commands` table directly to check command status:

```sql
SELECT * FROM app_commands 
WHERE screen_name = 'STORE2' 
ORDER BY created_at DESC 
LIMIT 10;
```

Or use the Supabase Realtime feature to listen for status changes:

```javascript
const channel = supabase
  .channel('app_commands_changes')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'app_commands',
      filter: `screen_name=eq.STORE2`
    },
    (payload) => {
      console.log('Command status updated:', payload.new);
    }
  )
  .subscribe();
```

## Benefits of This Approach

1. **Separation of Concerns** - Mobile app doesn't need direct database access
2. **Better Error Handling** - Edge Functions provide consistent error responses
3. **Scalability** - Edge Functions can be optimized and cached
4. **Security** - Service role key is only used in Edge Functions
5. **Monitoring** - Edge Function logs provide better visibility
6. **Rate Limiting** - Can be implemented at the Edge Function level

## Testing

### Test Command Creation

Use the webapp to send a test command:

```bash
curl -X POST https://pgcdokfiaarnhzryfzwf.supabase.co/functions/v1/send-app-command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "screen_name": "STORE2",
    "command": "sync_status"
  }'
```

### Test Polling

The mobile app will automatically poll for commands every 3 seconds when:
- User is authenticated
- Device ID is set
- Home screen is focused

Check the console logs for:
- `📬 [CommandListener] ✅ Found X pending command(s) via polling`
- `🎯 [CommandListener] Processing command from poll`
- `✅ [CommandListener] Command status updated to: completed`

## Troubleshooting

### Commands Not Being Received

1. Check that the device is authenticated and has a device ID
2. Verify the home screen is focused (polling only happens when screen is active)
3. Check Edge Function logs for errors
4. Verify the command was created with the correct `device_id` or `screen_name`

### Commands Not Being Acknowledged

1. Check network connectivity
2. Verify the `acknowledge-command` endpoint is accessible
3. Check Edge Function logs for errors
4. Ensure the command handler is completing successfully

### Duplicate Command Execution

The command listener tracks the last processed command ID to prevent duplicates. If you see duplicate executions:

1. Check that the command status is being updated correctly
2. Verify the polling interval isn't too aggressive
3. Check for multiple instances of the app running

## Configuration

### Polling Interval

The polling interval is set to 3 seconds in `utils/commandListener.ts`:

```typescript
this.pollInterval = setInterval(() => {
  this.pollForCommands();
}, 3000); // 3 seconds
```

To change the interval, modify this value (in milliseconds).

### Command Timeout

Commands don't have a built-in timeout. To implement timeouts, you can:

1. Add a `timeout_at` field to the `app_commands` table
2. Update the Edge Functions to check for expired commands
3. Automatically mark expired commands as `failed`

## Next Steps

1. ✅ Edge Functions deployed
2. ✅ Mobile app updated to use polling
3. ✅ Command acknowledgment implemented
4. 🔄 Test with webapp integration
5. 📊 Monitor Edge Function performance
6. 🔒 Consider adding rate limiting
7. ⏱️ Consider adding command timeouts
