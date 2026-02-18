
# Web App Integration Guide - Remote Command API

This guide explains how to integrate your web app with the React Native mobile app to remotely trigger actions like Preview Content, Screen Share, Sync Status, and Logout.

## Overview

The system uses a Supabase-based API that allows your web app to send commands to specific mobile devices. Commands are delivered in real-time via Supabase Realtime channels and also polled every 5 seconds as a fallback mechanism.

## API Endpoint

**Base URL:** `https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1`

**Endpoint:** `/send-app-command`

**Method:** `POST`

**Content-Type:** `application/json`

## Authentication

No authentication is required for sending commands. However, you must provide either a `device_id` or `screen_name` to identify the target device.

## Request Format

### Request Body

```json
{
  "device_id": "string (optional)",
  "screen_name": "string (optional)",
  "command": "string (required)",
  "payload": {
    // Optional command-specific data
  }
}
```

### Parameters

- **device_id** (optional): The unique device identifier. Either `device_id` or `screen_name` must be provided.
- **screen_name** (optional): The screen name assigned during login. Either `device_id` or `screen_name` must be provided.
- **command** (required): The action to perform. Must be one of:
  - `preview_content` - Opens the content preview modal
  - `screenshare` - Opens the screen share receiver
  - `sync_status` - Forces a status sync with the server
  - `logout` - Logs out the user from the app
- **payload** (optional): Additional data for the command (currently unused but available for future extensions)

## Available Commands

### 1. Preview Content

Opens the content preview modal in the app, displaying the assigned playlists and media.

**Command:** `preview_content`

**Example Request:**
```json
{
  "screen_name": "Lobby Display",
  "command": "preview_content"
}
```

### 2. Screen Share

Opens the screen share receiver, allowing the device to receive a WebRTC screen share stream.

**Command:** `screenshare`

**Example Request:**
```json
{
  "device_id": "abc123xyz",
  "command": "screenshare"
}
```

**Note:** Screen share is only available on native mobile platforms (iOS/Android). Web platform is not supported.

### 3. Sync Status

Forces an immediate status synchronization with the server, updating the device's online/offline status.

**Command:** `sync_status`

**Example Request:**
```json
{
  "screen_name": "Conference Room A",
  "command": "sync_status"
}
```

### 4. Logout

Logs out the user from the app, sending an offline status update and clearing stored credentials.

**Command:** `logout`

**Example Request:**
```json
{
  "device_id": "xyz789abc",
  "command": "logout"
}
```

## Response Format

### Success Response

**Status Code:** `200 OK`

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

### Error Responses

**Status Code:** `400 Bad Request`

```json
{
  "error": "Missing required field: command"
}
```

**Status Code:** `404 Not Found`

```json
{
  "error": "Display not found with the provided screen_name"
}
```

**Status Code:** `500 Internal Server Error`

```json
{
  "error": "Internal server error",
  "details": "Error message"
}
```

## Example Usage

### JavaScript/TypeScript (Fetch API)

```javascript
async function sendCommand(screenName, command) {
  const response = await fetch(
    'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/send-app-command',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        screen_name: screenName,
        command: command,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send command');
  }

  return await response.json();
}

// Usage examples
await sendCommand('Lobby Display', 'preview_content');
await sendCommand('Conference Room A', 'screenshare');
await sendCommand('Reception Screen', 'sync_status');
await sendCommand('Meeting Room B', 'logout');
```

### cURL

```bash
# Preview Content
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/send-app-command \
  -H "Content-Type: application/json" \
  -d '{
    "screen_name": "Lobby Display",
    "command": "preview_content"
  }'

# Screen Share
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/send-app-command \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "abc123xyz",
    "command": "screenshare"
  }'

# Sync Status
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/send-app-command \
  -H "Content-Type: application/json" \
  -d '{
    "screen_name": "Conference Room A",
    "command": "sync_status"
  }'

# Logout
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/send-app-command \
  -H "Content-Type: application/json" \
  -d '{
    "screen_name": "Reception Screen",
    "command": "logout"
  }'
```

### Python (Requests)

```python
import requests

def send_command(screen_name, command):
    url = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/send-app-command'
    payload = {
        'screen_name': screen_name,
        'command': command
    }
    
    response = requests.post(url, json=payload)
    response.raise_for_status()
    return response.json()

# Usage examples
send_command('Lobby Display', 'preview_content')
send_command('Conference Room A', 'screenshare')
send_command('Reception Screen', 'sync_status')
send_command('Meeting Room B', 'logout')
```

## Web App UI Example

Here's a complete HTML example for your web app:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Display Control Panel</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      background: #0F172A;
      color: #fff;
    }
    
    .control-panel {
      background: #1E293B;
      border-radius: 16px;
      padding: 30px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    
    h1 {
      margin-top: 0;
      color: #10B981;
    }
    
    .input-group {
      margin-bottom: 20px;
    }
    
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.8);
    }
    
    input, select {
      width: 100%;
      padding: 12px;
      border: 2px solid #334155;
      border-radius: 8px;
      background: #0F172A;
      color: #fff;
      font-size: 16px;
    }
    
    input:focus, select:focus {
      outline: none;
      border-color: #10B981;
    }
    
    .button-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 24px;
    }
    
    button {
      padding: 16px 24px;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      color: white;
    }
    
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    button:active {
      transform: translateY(0);
    }
    
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .btn-preview {
      background: linear-gradient(135deg, #2563EB, #1E40AF);
    }
    
    .btn-screenshare {
      background: linear-gradient(135deg, #9333EA, #7E22CE);
    }
    
    .btn-sync {
      background: linear-gradient(135deg, #059669, #047857);
    }
    
    .btn-logout {
      background: linear-gradient(135deg, #DC2626, #B91C1C);
    }
    
    .status {
      margin-top: 20px;
      padding: 16px;
      border-radius: 8px;
      display: none;
    }
    
    .status.success {
      background: rgba(16, 185, 129, 0.2);
      border: 2px solid #10B981;
      color: #10B981;
    }
    
    .status.error {
      background: rgba(239, 68, 68, 0.2);
      border: 2px solid #EF4444;
      color: #EF4444;
    }
  </style>
</head>
<body>
  <div class="control-panel">
    <h1>🎮 Display Control Panel</h1>
    
    <div class="input-group">
      <label for="identifier-type">Identify Device By:</label>
      <select id="identifier-type">
        <option value="screen_name">Screen Name</option>
        <option value="device_id">Device ID</option>
      </select>
    </div>
    
    <div class="input-group">
      <label for="identifier-value">Value:</label>
      <input 
        type="text" 
        id="identifier-value" 
        placeholder="Enter screen name or device ID"
      >
    </div>
    
    <div class="button-grid">
      <button class="btn-preview" onclick="sendCommand('preview_content')">
        🎬 Preview Content
      </button>
      
      <button class="btn-screenshare" onclick="sendCommand('screenshare')">
        📺 Screen Share
      </button>
      
      <button class="btn-sync" onclick="sendCommand('sync_status')">
        🔄 Sync Status
      </button>
      
      <button class="btn-logout" onclick="sendCommand('logout')">
        🚪 Logout
      </button>
    </div>
    
    <div id="status" class="status"></div>
  </div>

  <script>
    const API_URL = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/send-app-command';
    
    async function sendCommand(command) {
      const identifierType = document.getElementById('identifier-type').value;
      const identifierValue = document.getElementById('identifier-value').value.trim();
      const statusEl = document.getElementById('status');
      
      if (!identifierValue) {
        showStatus('Please enter a screen name or device ID', 'error');
        return;
      }
      
      // Disable all buttons
      const buttons = document.querySelectorAll('button');
      buttons.forEach(btn => btn.disabled = true);
      
      try {
        const payload = {
          [identifierType]: identifierValue,
          command: command
        };
        
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        
        const data = await response.json();
        
        if (response.ok) {
          showStatus(
            `✅ Command "${command}" sent successfully to ${data.screen_name}`,
            'success'
          );
        } else {
          showStatus(`❌ Error: ${data.error}`, 'error');
        }
      } catch (error) {
        showStatus(`❌ Network error: ${error.message}`, 'error');
      } finally {
        // Re-enable buttons
        buttons.forEach(btn => btn.disabled = false);
      }
    }
    
    function showStatus(message, type) {
      const statusEl = document.getElementById('status');
      statusEl.textContent = message;
      statusEl.className = `status ${type}`;
      statusEl.style.display = 'block';
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        statusEl.style.display = 'none';
      }, 5000);
    }
  </script>
</body>
</html>
```

## How It Works

1. **Command Submission**: Your web app sends a POST request to the API endpoint with the command details.

2. **Database Storage**: The command is stored in the `app_commands` table with a `pending` status.

3. **Real-time Delivery**: The command is immediately broadcast via Supabase Realtime to the device-specific channel.

4. **Polling Fallback**: The mobile app also polls for pending commands every 5 seconds as a fallback mechanism.

5. **Command Execution**: When the mobile app receives the command, it:
   - Updates the command status to `processing`
   - Executes the corresponding action
   - Updates the command status to `completed` or `failed`

6. **Status Tracking**: You can query the `app_commands` table to check command execution status.

## Command Status Tracking

To check if a command was executed, you can query the Supabase database:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gzyywcqlrjimjegbtoyc.supabase.co',
  'YOUR_ANON_KEY'
);

async function getCommandStatus(commandId) {
  const { data, error } = await supabase
    .from('app_commands')
    .select('*')
    .eq('id', commandId)
    .single();
  
  if (error) {
    console.error('Error fetching command status:', error);
    return null;
  }
  
  return data;
}
```

## Best Practices

1. **Error Handling**: Always handle API errors gracefully in your web app.

2. **User Feedback**: Provide clear feedback to users when commands are sent.

3. **Validation**: Validate screen names or device IDs before sending commands.

4. **Rate Limiting**: Avoid sending too many commands in quick succession.

5. **Command History**: Consider implementing a command history view in your web app.

6. **Device Status**: Check if the device is online before sending commands (query the `displays` table).

## Troubleshooting

### Command Not Executing

- Verify the device is online and the app is running
- Check that the screen name or device ID is correct
- Ensure the device is logged in and on the home screen
- Check the `app_commands` table for error messages

### Screen Share Not Working

- Screen share is only available on native mobile platforms (iOS/Android)
- Web platform does not support screen share

### Slow Command Delivery

- Commands are delivered in real-time via Supabase Realtime
- Fallback polling occurs every 5 seconds
- Network conditions may affect delivery speed

## Support

For issues or questions, check the app logs or contact support.

## API Version

Current Version: 1.0.0

Last Updated: 2024
