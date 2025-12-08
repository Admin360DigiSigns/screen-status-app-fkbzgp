
# Web Portal Authentication Guide

This guide explains how to authenticate display devices using the web portal.

## Base URL
```
https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1
```

## Authentication Flow

### 1. Mobile App Generates Display Code

The mobile app calls this endpoint first to generate a 6-digit code that will be displayed on the screen.

**Endpoint:** `POST /generate-display-code`

**Request Body:**
```json
{
  "device_id": "unique-device-identifier",
  "device_info": {
    "model": "Pixel 7",
    "os": "Android 14"
  }
}
```

**Response:**
```json
{
  "success": true,
  "code": "197695",
  "expires_at": "2024-12-08T19:36:26.000Z"
}
```

**Notes:**
- The `device_info` field is optional
- The code expires after 10 minutes
- The code is a 6-digit number displayed as both text and QR code on the mobile app

---

### 2. Web Portal Authenticates with Code

The web portal calls this endpoint when the user enters the code and their credentials.

**Endpoint:** `POST /authenticate-with-code`

**Request Body:**
```json
{
  "code": "197695",
  "screen_name": "Lobby Display",
  "screen_username": "lobby_user",
  "screen_password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Code verified successfully.",
  "device_id": "unique-device-identifier"
}
```

**Error Responses:**
- `400` - Invalid or expired code
- `404` - Code not found
- `500` - Server error

**Notes:**
- This endpoint verifies the code and stores the credentials
- The mobile app will receive these credentials when it polls the next endpoint
- The code can only be used once

---

### 3. Mobile App Polls for Credentials

The mobile app polls this endpoint every 3 seconds to check if authentication is complete.

**Endpoint:** `POST /get-display-credentials`

**Request Body:**
```json
{
  "device_id": "unique-device-identifier"
}
```

**Response (when authenticated):**
```json
{
  "success": true,
  "status": "authenticated",
  "credentials": {
    "screen_name": "Lobby Display",
    "screen_username": "lobby_user",
    "screen_password": "secure_password"
  }
}
```

**Response (when pending):**
```json
{
  "success": true,
  "status": "pending"
}
```

**Response (when expired):**
```json
{
  "success": true,
  "status": "expired"
}
```

**Notes:**
- The mobile app polls this endpoint every 3 seconds
- Once credentials are received, the app stops polling and logs in
- If the code expires, the app automatically generates a new code

---

## Web Portal Implementation Example

### HTML Form
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Display Authentication</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 500px;
      margin: 50px auto;
      padding: 20px;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    input {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    button {
      background-color: #4CAF50;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      width: 100%;
    }
    button:hover {
      background-color: #45a049;
    }
    .message {
      padding: 10px;
      margin-top: 15px;
      border-radius: 4px;
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
  </style>
</head>
<body>
  <h1>Authenticate Display Device</h1>
  <form id="authForm">
    <div class="form-group">
      <label for="code">Display Code (6 digits):</label>
      <input type="text" id="code" name="code" required maxlength="6" pattern="[0-9]{6}" placeholder="123456">
    </div>
    <div class="form-group">
      <label for="screen_name">Screen Name:</label>
      <input type="text" id="screen_name" name="screen_name" required placeholder="Lobby Display">
    </div>
    <div class="form-group">
      <label for="screen_username">Username:</label>
      <input type="text" id="screen_username" name="screen_username" required placeholder="lobby_user">
    </div>
    <div class="form-group">
      <label for="screen_password">Password:</label>
      <input type="password" id="screen_password" name="screen_password" required placeholder="••••••••">
    </div>
    <button type="submit">Authenticate Device</button>
  </form>
  <div id="message"></div>

  <script>
    const BASE_URL = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1';

    document.getElementById('authForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const code = document.getElementById('code').value;
      const screen_name = document.getElementById('screen_name').value;
      const screen_username = document.getElementById('screen_username').value;
      const screen_password = document.getElementById('screen_password').value;
      
      const messageDiv = document.getElementById('message');
      messageDiv.innerHTML = '<div class="message">Authenticating...</div>';
      
      try {
        const response = await fetch(`${BASE_URL}/authenticate-with-code`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            screen_name,
            screen_username,
            screen_password,
          }),
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          messageDiv.innerHTML = `
            <div class="message success">
              <strong>Success!</strong><br>
              ${data.message}<br>
              Device ID: ${data.device_id}
            </div>
          `;
          document.getElementById('authForm').reset();
        } else {
          messageDiv.innerHTML = `
            <div class="message error">
              <strong>Error:</strong><br>
              ${data.error || data.message || 'Authentication failed'}
            </div>
          `;
        }
      } catch (error) {
        messageDiv.innerHTML = `
          <div class="message error">
            <strong>Error:</strong><br>
            ${error.message}
          </div>
        `;
      }
    });
  </script>
</body>
</html>
```

### JavaScript/TypeScript Implementation
```typescript
interface AuthenticateRequest {
  code: string;
  screen_name: string;
  screen_username: string;
  screen_password: string;
}

interface AuthenticateResponse {
  success: boolean;
  message?: string;
  device_id?: string;
  error?: string;
}

async function authenticateDisplay(
  code: string,
  screenName: string,
  username: string,
  password: string
): Promise<AuthenticateResponse> {
  const BASE_URL = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1';
  
  try {
    const response = await fetch(`${BASE_URL}/authenticate-with-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        screen_name: screenName,
        screen_username: username,
        screen_password: password,
      }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return data;
    } else {
      throw new Error(data.error || data.message || 'Authentication failed');
    }
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

// Usage example
authenticateDisplay('197695', 'Lobby Display', 'lobby_user', 'secure_password')
  .then(result => {
    console.log('Authentication successful:', result);
    alert(`Device authenticated successfully! Device ID: ${result.device_id}`);
  })
  .catch(error => {
    console.error('Authentication failed:', error);
    alert(`Authentication failed: ${error.message}`);
  });
```

---

## Security Considerations

1. **Code Expiration**: Codes expire after 10 minutes to prevent unauthorized access
2. **One-Time Use**: Each code can only be used once
3. **HTTPS Only**: All API calls must use HTTPS
4. **Password Security**: Passwords are transmitted securely and should be stored securely on the server
5. **Rate Limiting**: Consider implementing rate limiting on the web portal to prevent brute force attacks

---

## Troubleshooting

### Code Not Working
- Check if the code has expired (10 minutes)
- Verify the code is entered correctly (6 digits)
- Ensure the mobile app is still running and connected to the internet

### Authentication Fails
- Verify the credentials are correct
- Check if the display is already registered with different credentials
- Ensure the web portal has internet connectivity

### Mobile App Not Receiving Credentials
- Check if the mobile app is polling the `/get-display-credentials` endpoint
- Verify the device_id matches between the mobile app and web portal
- Check the mobile app logs for any errors

---

## Testing

You can test the authentication flow using curl:

```bash
# 1. Generate a display code (simulate mobile app)
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/generate-display-code \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "test-device-123",
    "device_info": {
      "model": "Test Device",
      "os": "Test OS"
    }
  }'

# 2. Authenticate with the code (simulate web portal)
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/authenticate-with-code \
  -H "Content-Type: application/json" \
  -d '{
    "code": "197695",
    "screen_name": "Test Display",
    "screen_username": "test_user",
    "screen_password": "test_password"
  }'

# 3. Get credentials (simulate mobile app polling)
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/get-display-credentials \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "test-device-123"
  }'
```

---

## Support

For issues or questions, please check:
- Mobile app logs for detailed error messages
- Network connectivity on both mobile app and web portal
- API endpoint availability and response times
