
# Web App Authentication API Documentation

## Base URL
```
https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1
```

## Authentication Flow Overview

The authentication flow uses a 6-digit code or QR code displayed on the mobile/TV app that the web portal uses to authenticate and provide credentials.

### Flow Steps:
1. **Mobile App**: Generates a display code
2. **Web Portal**: User enters the code and provides credentials
3. **Mobile App**: Polls for authentication status and retrieves credentials

---

## API Endpoints

### 1. Generate Display Code (Mobile App)

**Endpoint:** `POST /generate-display-code`

**Description:** Mobile app calls this first to generate a 6-digit authentication code.

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

**Request Parameters:**
- `device_id` (string, required): Unique identifier for the device
- `device_info` (object, optional): Device information
  - `model` (string): Device model name
  - `os` (string): Operating system and version

**Response (Success):**
```json
{
  "success": true,
  "code": "197695",
  "expires_at": "2024-12-08T19:36:26.000Z"
}
```

**Response Fields:**
- `success` (boolean): Whether the operation was successful
- `code` (string): 6-digit authentication code
- `expires_at` (string): ISO 8601 timestamp when the code expires

**Example cURL:**
```bash
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/generate-display-code \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "abc123xyz",
    "device_info": {
      "model": "Samsung TV",
      "os": "Android TV 12"
    }
  }'
```

---

### 2. Authenticate with Code (Web Portal)

**Endpoint:** `POST /authenticate-with-code`

**Description:** Web portal calls this to authenticate a display code and provide credentials.

**Request Body:**
```json
{
  "code": "197695",
  "screen_name": "Lobby Display",
  "screen_username": "lobby_user",
  "screen_password": "secure_password"
}
```

**Request Parameters:**
- `code` (string, required): The 6-digit code displayed on the mobile/TV app
- `screen_name` (string, required): Display name for the screen
- `screen_username` (string, required): Username for authentication
- `screen_password` (string, required): Password for authentication

**Response (Success):**
```json
{
  "success": true,
  "message": "Code verified successfully.",
  "device_id": "unique-device-identifier"
}
```

**Response Fields:**
- `success` (boolean): Whether the authentication was successful
- `message` (string): Success message
- `device_id` (string): The device ID associated with the code

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid or expired code"
}
```

**Example cURL:**
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

**Example JavaScript (Web Portal):**
```javascript
async function authenticateDisplay(code, screenName, username, password) {
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
      console.log('Authentication successful!');
      console.log('Device ID:', data.device_id);
      return { success: true, deviceId: data.device_id };
    } else {
      console.error('Authentication failed:', data.error);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Network error:', error);
    return { success: false, error: 'Network error occurred' };
  }
}

// Usage
authenticateDisplay('197695', 'Lobby Display', 'lobby_user', 'secure_password');
```

---

### 3. Get Display Credentials (Mobile App)

**Endpoint:** `POST /get-display-credentials`

**Description:** Mobile app polls this endpoint to check if authentication is complete and retrieve credentials.

**Request Body:**
```json
{
  "device_id": "unique-device-identifier"
}
```

**Request Parameters:**
- `device_id` (string, required): Unique identifier for the device

**Response (Authenticated):**
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

**Response (Pending):**
```json
{
  "success": true,
  "status": "pending"
}
```

**Response (Expired):**
```json
{
  "success": true,
  "status": "expired"
}
```

**Response Fields:**
- `success` (boolean): Whether the request was successful
- `status` (string): Authentication status - "authenticated", "pending", or "expired"
- `credentials` (object, optional): Credentials provided by web portal (only when authenticated)
  - `screen_name` (string): Display name
  - `screen_username` (string): Username
  - `screen_password` (string): Password

**Example cURL:**
```bash
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/get-display-credentials \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "abc123xyz"
  }'
```

---

## Web Portal Integration Example

### HTML Form Example

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
      font-size: 16px;
    }
    button:hover {
      background-color: #45a049;
    }
    button:disabled {
      background-color: #cccccc;
      cursor: not-allowed;
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
  <h1>Authenticate Display</h1>
  <form id="authForm">
    <div class="form-group">
      <label for="code">Display Code (6 digits):</label>
      <input type="text" id="code" name="code" required maxlength="6" pattern="[0-9]{6}" placeholder="123456">
    </div>
    
    <div class="form-group">
      <label for="screenName">Screen Name:</label>
      <input type="text" id="screenName" name="screenName" required placeholder="Lobby Display">
    </div>
    
    <div class="form-group">
      <label for="username">Username:</label>
      <input type="text" id="username" name="username" required placeholder="lobby_user">
    </div>
    
    <div class="form-group">
      <label for="password">Password:</label>
      <input type="password" id="password" name="password" required placeholder="Enter password">
    </div>
    
    <button type="submit" id="submitBtn">Authenticate Display</button>
  </form>
  
  <div id="message"></div>

  <script>
    const API_BASE_URL = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1';

    document.getElementById('authForm').addEventListener('submit', async (e) => {
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
      submitBtn.textContent = 'Authenticating...';
      messageDiv.innerHTML = '';
      
      try {
        const response = await fetch(`${API_BASE_URL}/authenticate-with-code`, {
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
              <strong>Success!</strong><br>
              Display authenticated successfully.<br>
              Device ID: ${data.device_id}
            </div>
          `;
          // Clear form
          document.getElementById('authForm').reset();
        } else {
          messageDiv.innerHTML = `
            <div class="message error">
              <strong>Error:</strong><br>
              ${data.error || 'Authentication failed'}
            </div>
          `;
        }
      } catch (error) {
        messageDiv.innerHTML = `
          <div class="message error">
            <strong>Network Error:</strong><br>
            ${error.message}
          </div>
        `;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Authenticate Display';
      }
    });
  </script>
</body>
</html>
```

---

## Error Handling

### Common Error Responses

**Invalid Code:**
```json
{
  "success": false,
  "error": "Invalid or expired code"
}
```

**Missing Parameters:**
```json
{
  "success": false,
  "error": "Missing required parameter: code"
}
```

**Network Error:**
```json
{
  "success": false,
  "error": "Network error occurred"
}
```

---

## Security Considerations

1. **Code Expiration**: Codes expire after 10 minutes for security
2. **HTTPS Only**: All API calls must use HTTPS
3. **One-Time Use**: Each code can only be authenticated once
4. **Secure Storage**: Store credentials securely on the mobile app
5. **Password Handling**: Never log or display passwords in plain text

---

## Testing

### Test the Authentication Flow

1. **Generate a code** on the mobile app
2. **Copy the 6-digit code** displayed
3. **Open the web portal** and enter:
   - The 6-digit code
   - Screen name (e.g., "Test Display")
   - Username (e.g., "test_user")
   - Password (e.g., "test_password")
4. **Submit the form**
5. **Verify** the mobile app receives the credentials and logs in

### Using Browser Console

```javascript
// Test authentication
fetch('https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/authenticate-with-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: '123456',
    screen_name: 'Test Display',
    screen_username: 'test_user',
    screen_password: 'test_password'
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## Support

For issues or questions:
- Check the mobile app logs for detailed error messages
- Verify the code hasn't expired (10-minute limit)
- Ensure all required fields are provided
- Check network connectivity

---

## Changelog

### Version 1.0
- Initial API documentation
- Three endpoints: generate-display-code, authenticate-with-code, get-display-credentials
- 10-minute code expiration
- QR code support
