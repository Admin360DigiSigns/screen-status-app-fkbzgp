
# Web App Command Integration Guide

## Quick Start

Send commands to devices using the `send-app-command` Edge Function.

## API Endpoint

```
POST https://pgcdokfiaarnhzryfzwf.supabase.co/functions/v1/send-app-command
```

## Available Commands

1. **preview_content** - Show content preview on device
2. **screenshare** - Start screen sharing session
3. **sync_status** - Force device to sync status immediately
4. **logout** - Log out the device

## Request Format

```javascript
{
  "device_id": "string",      // Required: Device ID from displays table
  "command": "string",        // Required: One of the commands above
  "payload": {}               // Optional: Additional data for the command
}
```

## Example: Send Command from Web App

```javascript
async function sendCommandToDevice(deviceId, command, payload = {}) {
  try {
    const response = await fetch(
      'https://pgcdokfiaarnhzryfzwf.supabase.co/functions/v1/send-app-command',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: deviceId,
          command: command,
          payload: payload,
        }),
      }
    );

    const result = await response.json();
    
    if (result.success) {
      console.log('Command sent successfully:', result.command_id);
      return result.command_id;
    } else {
      console.error('Failed to send command:', result.error);
      return null;
    }
  } catch (error) {
    console.error('Error sending command:', error);
    return null;
  }
}

// Usage examples
sendCommandToDevice('device-123', 'preview_content');
sendCommandToDevice('device-123', 'sync_status');
sendCommandToDevice('device-123', 'screenshare', { quality: 'high' });
sendCommandToDevice('device-123', 'logout');
```

## Check Command Status

```javascript
async function checkCommandStatus(commandId) {
  const { createClient } = require('@supabase/supabase-js');
  
  const supabase = createClient(
    'https://pgcdokfiaarnhzryfzwf.supabase.co',
    'YOUR_SUPABASE_ANON_KEY'
  );

  const { data, error } = await supabase
    .from('app_commands')
    .select('*')
    .eq('id', commandId)
    .single();

  if (error) {
    console.error('Error fetching command:', error);
    return null;
  }

  return data;
}
```

## Real-time Command Status Updates

```javascript
async function subscribeToCommandUpdates(deviceId, callback) {
  const { createClient } = require('@supabase/supabase-js');
  
  const supabase = createClient(
    'https://pgcdokfiaarnhzryfzwf.supabase.co',
    'YOUR_SUPABASE_ANON_KEY'
  );

  const channel = supabase
    .channel(`commands:${deviceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_commands',
        filter: `device_id=eq.${deviceId}`,
      },
      (payload) => {
        console.log('Command updated:', payload);
        callback(payload.new);
      }
    )
    .subscribe();

  return channel;
}

// Usage
const channel = await subscribeToCommandUpdates('device-123', (command) => {
  console.log('Command status:', command.status);
  if (command.status === 'completed') {
    console.log('Command completed successfully!');
  } else if (command.status === 'failed') {
    console.error('Command failed:', command.error_message);
  }
});

// Cleanup when done
await supabase.removeChannel(channel);
```

## Complete Web App Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Device Command Control</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
  <h1>Device Command Control</h1>
  
  <div>
    <label>Device ID:</label>
    <input type="text" id="deviceId" placeholder="Enter device ID">
  </div>

  <div>
    <button onclick="sendCommand('preview_content')">Preview Content</button>
    <button onclick="sendCommand('screenshare')">Screen Share</button>
    <button onclick="sendCommand('sync_status')">Sync Status</button>
    <button onclick="sendCommand('logout')">Logout</button>
  </div>

  <div id="status"></div>
  <div id="commandHistory"></div>

  <script>
    const SUPABASE_URL = 'https://pgcdokfiaarnhzryfzwf.supabase.co';
    const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
    
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    async function sendCommand(command) {
      const deviceId = document.getElementById('deviceId').value;
      
      if (!deviceId) {
        alert('Please enter a device ID');
        return;
      }

      const statusDiv = document.getElementById('status');
      statusDiv.innerHTML = `Sending ${command} command...`;

      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/send-app-command`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              device_id: deviceId,
              command: command,
            }),
          }
        );

        const result = await response.json();
        
        if (result.success) {
          statusDiv.innerHTML = `✅ Command sent! ID: ${result.command_id}`;
          loadCommandHistory(deviceId);
        } else {
          statusDiv.innerHTML = `❌ Failed: ${result.error}`;
        }
      } catch (error) {
        statusDiv.innerHTML = `❌ Error: ${error.message}`;
      }
    }

    async function loadCommandHistory(deviceId) {
      const { data, error } = await supabase
        .from('app_commands')
        .select('*')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading history:', error);
        return;
      }

      const historyDiv = document.getElementById('commandHistory');
      historyDiv.innerHTML = '<h2>Command History</h2>';
      
      data.forEach(cmd => {
        const statusColor = 
          cmd.status === 'completed' ? 'green' :
          cmd.status === 'failed' ? 'red' :
          cmd.status === 'processing' ? 'orange' : 'gray';
        
        historyDiv.innerHTML += `
          <div style="border: 1px solid #ccc; padding: 10px; margin: 5px;">
            <strong>${cmd.command}</strong> - 
            <span style="color: ${statusColor}">${cmd.status}</span><br>
            <small>${new Date(cmd.created_at).toLocaleString()}</small>
            ${cmd.error_message ? `<br><span style="color: red">${cmd.error_message}</span>` : ''}
          </div>
        `;
      });
    }

    // Subscribe to real-time updates
    function subscribeToUpdates() {
      const deviceId = document.getElementById('deviceId').value;
      if (!deviceId) return;

      supabase
        .channel(`commands:${deviceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_commands',
            filter: `device_id=eq.${deviceId}`,
          },
          (payload) => {
            console.log('Command updated:', payload);
            loadCommandHistory(deviceId);
          }
        )
        .subscribe();
    }

    // Auto-subscribe when device ID changes
    document.getElementById('deviceId').addEventListener('change', subscribeToUpdates);
  </script>
</body>
</html>
```

## Command Response Times

- **Polling interval**: 2 seconds
- **Expected response time**: 2-4 seconds
- **Maximum response time**: 10 seconds (if device is slow)

## Error Handling

### Common Errors

1. **"Device not found"**
   - Device ID doesn't exist in displays table
   - Check device_id is correct

2. **"Invalid command"**
   - Command type not recognized
   - Use one of: preview_content, screenshare, sync_status, logout

3. **"Command timeout"**
   - Device is offline or not responding
   - Check device status in displays table

4. **"Handler not registered"**
   - Device app doesn't have handler for this command
   - Update device app to latest version

## Best Practices

1. **Check device status** before sending commands
2. **Monitor command status** after sending
3. **Implement timeout logic** (fail after 30 seconds)
4. **Show user feedback** during command execution
5. **Handle errors gracefully** with retry logic
6. **Log all commands** for debugging

## Security Notes

- Commands are authenticated via Supabase RLS policies
- Only authorized users can send commands
- Device credentials are never exposed to web app
- All communication is over HTTPS

## Support

For issues or questions:
1. Check device diagnostics screen
2. Review Edge Function logs in Supabase dashboard
3. Verify RLS policies are configured correctly
4. Check network connectivity on both device and web app
