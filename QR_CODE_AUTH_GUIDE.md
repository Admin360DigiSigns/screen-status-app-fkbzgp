
# QR Code / 6-Digit Code Authentication Guide

## Overview

The app now uses a **QR Code / 6-Digit Code authentication system** instead of the traditional username/password login directly in the app. This provides a more secure and convenient way to authenticate screens.

## How It Works

### 1. **App Opens or User Logs Out**
- When the app is opened or the user logs out, a unique 6-digit code is automatically generated
- This code is displayed both as:
  - A **QR Code** (for quick scanning)
  - A **6-digit number** (for manual entry)
- The code is valid for **10 minutes**

### 2. **Web App Authentication**
- The user opens the web app (see `WEB_APP_AUTH_EXAMPLE.html`)
- They can either:
  - **Scan the QR code** displayed on the screen
  - **Manually enter the 6-digit code**
- They also enter their credentials:
  - Username
  - Password
  - Screen Name

### 3. **Authentication Process**
- The web app sends the code and credentials to the API
- The API validates:
  - The code is valid and not expired
  - The credentials match a registered display
- If successful, the code is marked as "authenticated"

### 4. **App Receives Credentials**
- The app polls the API every 3 seconds to check if the code has been authenticated
- Once authenticated, the app receives:
  - Username
  - Password
  - Screen Name
- These credentials are stored locally and used for all subsequent operations

### 5. **Normal Operation**
- After authentication, the app operates exactly as before
- All existing functionality (status updates, commands, etc.) works the same way
- The app uses the received credentials for all API calls

## API Endpoints

### 1. Generate Auth Code
**Endpoint:** `POST /functions/v1/generate-auth-code`

**Request:**
```json
{
  "device_id": "unique-device-id"
}
```

**Response:**
```json
{
  "code": "123456",
  "expires_at": "2024-01-15T10:30:00Z"
}
```

### 2. Authenticate with Code (Web App)
**Endpoint:** `POST /functions/v1/authenticate-with-code`

**Request:**
```json
{
  "code": "123456",
  "screen_username": "admin",
  "screen_password": "password123",
  "screen_name": "Main Lobby Display"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication successful"
}
```

### 3. Check Auth Status (App)
**Endpoint:** `POST /functions/v1/check-auth-status`

**Request:**
```json
{
  "code": "123456",
  "device_id": "unique-device-id"
}
```

**Response (Pending):**
```json
{
  "authenticated": false,
  "pending": true
}
```

**Response (Authenticated):**
```json
{
  "authenticated": true,
  "screen_username": "admin",
  "screen_password": "password123",
  "screen_name": "Main Lobby Display"
}
```

**Response (Expired):**
```json
{
  "authenticated": false,
  "expired": true,
  "error": "Code expired"
}
```

## Database Schema

### `auth_codes` Table

```sql
create table auth_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  device_id text not null,
  screen_username text,
  screen_password text,
  screen_name text,
  status text not null default 'pending' check (status in ('pending', 'authenticated', 'expired')),
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone default (now() + interval '10 minutes'),
  authenticated_at timestamp with time zone
);
```

## Features

### ✅ Security
- Codes expire after 10 minutes
- Each code is unique
- Old codes are automatically expired when a new one is generated
- Credentials are never displayed on the screen

### ✅ User Experience
- **QR Code** for quick scanning
- **6-digit code** for manual entry
- **Visual countdown timer** showing time remaining
- **Auto-refresh** when code expires
- **Real-time status** showing when authentication is pending

### ✅ Reliability
- Automatic polling every 3 seconds
- Handles network errors gracefully
- Auto-generates new code on expiry
- Maintains all existing functionality after authentication

## Web App Integration

Use the provided `WEB_APP_AUTH_EXAMPLE.html` file as a starting point for your web app. The key features include:

1. **Code Input** - 6-digit number input with validation
2. **Credential Fields** - Username, password, and screen name
3. **API Integration** - Calls the `authenticate-with-code` endpoint
4. **User Feedback** - Shows success/error messages
5. **Responsive Design** - Works on desktop and mobile

## Testing

### Test the Flow:

1. **Start the app** - A code should be generated automatically
2. **Open the web app** - Use `WEB_APP_AUTH_EXAMPLE.html`
3. **Enter the code** - Type the 6-digit code from the screen
4. **Enter credentials** - Provide valid username, password, and screen name
5. **Submit** - The app should authenticate within 3 seconds
6. **Verify** - The app should navigate to the home screen

### Test Code Expiry:

1. **Generate a code** - Wait for 10 minutes
2. **Verify expiry** - The code should show as expired
3. **Auto-refresh** - A new code should be generated automatically

### Test Logout:

1. **Logout from the app** - Use the logout button
2. **Verify new code** - A new code should be generated immediately
3. **Old code invalid** - The old code should no longer work

## Migration Notes

### What Changed:
- ✅ Login screen now shows QR code and 6-digit code
- ✅ No more username/password input in the app
- ✅ Web app is used for authentication
- ✅ New API endpoints for code generation and validation
- ✅ New database table for storing auth codes

### What Stayed the Same:
- ✅ All existing functionality (status updates, commands, etc.)
- ✅ Device registration and management
- ✅ Screen sharing and remote commands
- ✅ Display content management
- ✅ All other API endpoints

## Troubleshooting

### Code Not Generating
- Check internet connection
- Verify device ID is available
- Check API endpoint is accessible

### Authentication Not Working
- Verify code hasn't expired (10 minutes)
- Check credentials are correct
- Ensure display is registered in the database
- Check API logs for errors

### App Not Receiving Credentials
- Verify polling is active (every 3 seconds)
- Check network connection
- Verify code was authenticated successfully
- Check API response format

## Future Enhancements

Potential improvements for the authentication system:

1. **QR Code Scanning** - Add camera support to scan QR codes directly
2. **Push Notifications** - Notify when authentication is successful
3. **Multiple Devices** - Support authenticating multiple devices with one code
4. **Custom Expiry** - Allow configurable code expiry times
5. **Biometric Auth** - Add fingerprint/face recognition for web app
6. **Session Management** - Track active sessions and allow remote logout

## Support

For issues or questions:
1. Check the console logs in both the app and web app
2. Verify all API endpoints are accessible
3. Check the database for auth code records
4. Review the Edge Function logs in Supabase dashboard
