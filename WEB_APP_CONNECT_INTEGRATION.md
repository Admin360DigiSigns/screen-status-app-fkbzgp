
# Web App Connect Integration Guide

## Overview

This guide explains how to integrate the "Connect" button functionality in your web app to authenticate TV/mobile displays using the 6-digit code or QR code shown on the screen.

---

## Authentication Flow

1. **Display App**: Shows a 6-digit code and QR code on screen
2. **Web App User**: Enters the code and provides credentials (screen name, username, password)
3. **Web App**: Sends authentication request with code + credentials
4. **Display App**: Automatically receives credentials and logs in

---

## API Endpoint

### Authenticate with Code

**Endpoint:** `POST /authenticate-with-code`

**Base URL:** `https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1`

**Full URL:** `https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/authenticate-with-code`

---

## Request Format

### Request Body (JSON)

```json
{
  "code": "197695",
  "screen_name": "Lobby Display",
  "screen_username": "lobby_user",
  "screen_password": "secure_password"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | The 6-digit code displayed on the TV/mobile app |
| `screen_name` | string | Yes | Display name for the screen (e.g., "Lobby Display") |
| `screen_username` | string | Yes | Username for authentication |
| `screen_password` | string | Yes | Password for authentication |

---

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Code verified successfully.",
  "device_id": "unique-device-identifier"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Invalid or expired code"
}
```

---

## Implementation Examples

### JavaScript (Fetch API)

```javascript
async function connectDisplay(code, screenName, username, password) {
  const API_URL = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/authenticate-with-code';
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: code,
        screen_name: screenName,
        screen_username: username,
        screen_password: password,
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✓ Display connected successfully!');
      console.log('Device ID:', data.device_id);
      return { success: true, deviceId: data.device_id };
    } else {
      console.error('✗ Connection failed:', data.error);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('✗ Network error:', error);
    return { success: false, error: 'Network error occurred' };
  }
}

// Usage Example
const result = await connectDisplay(
  '197695',
  'Lobby Display',
  'lobby_user',
  'secure_password'
);

if (result.success) {
  alert('Display connected successfully!');
} else {
  alert('Failed to connect: ' + result.error);
}
```

### React Component Example

```jsx
import React, { useState } from 'react';

function ConnectDisplayForm() {
  const [code, setCode] = useState('');
  const [screenName, setScreenName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(
        'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/authenticate-with-code',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: code,
            screen_name: screenName,
            screen_username: username,
            screen_password: password,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage('✓ Display connected successfully!');
        // Clear form
        setCode('');
        setScreenName('');
        setUsername('');
        setPassword('');
      } else {
        setMessage('✗ Error: ' + data.error);
      }
    } catch (error) {
      setMessage('✗ Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleConnect}>
      <div>
        <label>Display Code (6 digits):</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          pattern="[0-9]{6}"
          required
          placeholder="123456"
        />
      </div>

      <div>
        <label>Screen Name:</label>
        <input
          type="text"
          value={screenName}
          onChange={(e) => setScreenName(e.target.value)}
          required
          placeholder="Lobby Display"
        />
      </div>

      <div>
        <label>Username:</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          placeholder="lobby_user"
        />
      </div>

      <div>
        <label>Password:</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter password"
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Connecting...' : 'Connect Display'}
      </button>

      {message && <p>{message}</p>}
    </form>
  );
}

export default ConnectDisplayForm;
```

### jQuery Example

```javascript
$('#connectForm').on('submit', function(e) {
  e.preventDefault();
  
  const code = $('#code').val();
  const screenName = $('#screenName').val();
  const username = $('#username').val();
  const password = $('#password').val();
  
  $('#connectBtn').prop('disabled', true).text('Connecting...');
  
  $.ajax({
    url: 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/authenticate-with-code',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({
      code: code,
      screen_name: screenName,
      screen_username: username,
      screen_password: password
    }),
    success: function(data) {
      if (data.success) {
        alert('✓ Display connected successfully!');
        $('#connectForm')[0].reset();
      } else {
        alert('✗ Error: ' + data.error);
      }
    },
    error: function(xhr, status, error) {
      alert('✗ Network error: ' + error);
    },
    complete: function() {
      $('#connectBtn').prop('disabled', false).text('Connect Display');
    }
  });
});
```

### cURL Example

```bash
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/authenticate-with-code \
  -H "Content-Type: application/json" \
  -d '{
    "code": "197695",
    "screen_name": "Lobby Display",
    "screen_username": "lobby_user",
    "screen_password": "secure_password"
  }'
```

---

## Complete HTML Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect Display</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 500px;
      margin: 50px auto;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    h1 {
      color: #333;
      text-align: center;
      margin-bottom: 30px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #555;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      box-sizing: border-box;
      font-size: 14px;
      transition: border-color 0.3s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      width: 100%;
      font-size: 16px;
      font-weight: 600;
      transition: transform 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
    }
    button:disabled {
      background: #cccccc;
      cursor: not-allowed;
      transform: none;
    }
    .message {
      padding: 15px;
      margin-top: 20px;
      border-radius: 6px;
      font-weight: 500;
    }
    .success {
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .error {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .info {
      background-color: #d1ecf1;
      color: #0c5460;
      border: 1px solid #bee5eb;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🖥️ Connect Display</h1>
    
    <div class="info">
      <strong>Instructions:</strong><br>
      1. Look at the TV/mobile display screen<br>
      2. Enter the 6-digit code shown<br>
      3. Fill in the display credentials<br>
      4. Click "Connect Display"
    </div>
    
    <form id="connectForm">
      <div class="form-group">
        <label for="code">Display Code (6 digits) *</label>
        <input 
          type="text" 
          id="code" 
          name="code" 
          required 
          maxlength="6" 
          pattern="[0-9]{6}" 
          placeholder="123456"
          autocomplete="off"
        >
      </div>
      
      <div class="form-group">
        <label for="screenName">Screen Name *</label>
        <input 
          type="text" 
          id="screenName" 
          name="screenName" 
          required 
          placeholder="e.g., Lobby Display"
        >
      </div>
      
      <div class="form-group">
        <label for="username">Username *</label>
        <input 
          type="text" 
          id="username" 
          name="username" 
          required 
          placeholder="e.g., lobby_user"
        >
      </div>
      
      <div class="form-group">
        <label for="password">Password *</label>
        <input 
          type="password" 
          id="password" 
          name="password" 
          required 
          placeholder="Enter password"
        >
      </div>
      
      <button type="submit" id="submitBtn">Connect Display</button>
    </form>
    
    <div id="message"></div>
  </div>

  <script>
    const API_URL = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/authenticate-with-code';

    document.getElementById('connectForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById('submitBtn');
      const messageDiv = document.getElementById('message');
      
      // Get form values
      const code = document.getElementById('code').value;
      const screenName = document.getElementById('screenName').value;
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      
      // Disable button and show loading
      submitBtn.disabled = true;
      submitBtn.textContent = 'Connecting...';
      messageDiv.innerHTML = '';
      
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: code,
            screen_name: screenName,
            screen_username: username,
            screen_password: password,
          }),
        });
        
        const data = await response.json();
        
        if (data.success) {
          messageDiv.innerHTML = `
            <div class="message success">
              <strong>✓ Success!</strong><br>
              Display connected successfully.<br>
              Device ID: ${data.device_id}
            </div>
          `;
          // Clear form
          document.getElementById('connectForm').reset();
        } else {
          messageDiv.innerHTML = `
            <div class="message error">
              <strong>✗ Error:</strong><br>
              ${data.error || 'Authentication failed'}
            </div>
          `;
        }
      } catch (error) {
        messageDiv.innerHTML = `
          <div class="message error">
            <strong>✗ Network Error:</strong><br>
            ${error.message}
          </div>
        `;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Connect Display';
      }
    });

    // Auto-format code input (only numbers)
    document.getElementById('code').addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
  </script>
</body>
</html>
```

---

## Error Handling

### Common Errors

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Invalid or expired code" | Code is wrong or has expired (>10 min) | Ask user to check the code or wait for new code |
| "Missing required parameter: code" | Code field is empty | Ensure all fields are filled |
| "Network error occurred" | Connection issue | Check internet connection |
| "Code already used" | Code was already authenticated | Generate new code on display |

### Error Handling Example

```javascript
async function connectDisplayWithErrorHandling(code, screenName, username, password) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code,
        screen_name: screenName,
        screen_username: username,
        screen_password: password,
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      return { success: true, deviceId: data.device_id };
    } else {
      // Handle specific errors
      if (data.error.includes('expired')) {
        return { success: false, error: 'Code has expired. Please use the new code shown on the display.' };
      } else if (data.error.includes('Invalid')) {
        return { success: false, error: 'Invalid code. Please check the code on the display and try again.' };
      } else {
        return { success: false, error: data.error };
      }
    }
  } catch (error) {
    return { success: false, error: 'Network error. Please check your internet connection.' };
  }
}
```

---

## Security Best Practices

1. **HTTPS Only**: Always use HTTPS for API calls
2. **Input Validation**: Validate code format (6 digits) before sending
3. **Password Security**: Never log or display passwords
4. **Rate Limiting**: Implement rate limiting on your web app to prevent brute force
5. **Code Expiry**: Codes expire after 10 minutes automatically
6. **One-Time Use**: Each code can only be used once

---

## Testing

### Test Flow

1. Open the display app (TV/mobile)
2. Note the 6-digit code shown
3. Open your web app
4. Enter the code and credentials
5. Click "Connect"
6. Verify the display app logs in automatically

### Test Data

```javascript
// Example test credentials
const testData = {
  code: '123456', // Use actual code from display
  screen_name: 'Test Display',
  screen_username: 'test_user',
  screen_password: 'test_password'
};
```

---

## What Happens After Connection

1. **Web App**: Receives success response with device ID
2. **Display App**: 
   - Automatically receives the credentials
   - Logs in with the provided credentials
   - Starts sending status updates every minute
   - Displays "Online" status

---

## Support

For issues or questions:
- Check browser console for detailed error messages
- Verify the code hasn't expired (10-minute limit)
- Ensure all required fields are provided
- Check network connectivity
- Verify the display app is showing a valid code

---

## Quick Reference

**API Endpoint:**
```
POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/authenticate-with-code
```

**Required Fields:**
- `code` (6 digits)
- `screen_name`
- `screen_username`
- `screen_password`

**Success Response:**
```json
{ "success": true, "message": "Code verified successfully.", "device_id": "..." }
```

**Error Response:**
```json
{ "success": false, "error": "Invalid or expired code" }
```

---

## Changelog

### Version 1.0
- Initial documentation
- Complete web app integration guide
- Code examples in multiple languages
- Error handling guide
- Security best practices
