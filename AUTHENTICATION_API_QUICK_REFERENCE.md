
# Authentication API Quick Reference

## Base URL
```
https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1
```

## Endpoints

### 1. Generate Display Code
**Mobile App → API**

```http
POST /generate-display-code
Content-Type: application/json

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

---

### 2. Authenticate with Code
**Web Portal → API**

```http
POST /authenticate-with-code
Content-Type: application/json

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

---

### 3. Get Display Credentials
**Mobile App → API (Polling every 3 seconds)**

```http
POST /get-display-credentials
Content-Type: application/json

{
  "device_id": "unique-device-identifier"
}
```

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

---

## Flow Diagram

```
┌─────────────┐                                    ┌─────────────┐
│             │                                    │             │
│  Mobile App │                                    │ Web Portal  │
│             │                                    │             │
└──────┬──────┘                                    └──────┬──────┘
       │                                                  │
       │ 1. POST /generate-display-code                  │
       ├──────────────────────────────────►              │
       │                                                  │
       │ ◄──────────────────────────────────             │
       │    { code: "197695" }                           │
       │                                                  │
       │    Display code on screen                       │
       │    (QR code + 6-digit number)                   │
       │                                                  │
       │                                                  │
       │                                    User enters   │
       │                                    code + creds  │
       │                                                  │
       │                                                  │
       │                                    2. POST       │
       │                                    /authenticate-│
       │                                    with-code     │
       │                                                  │
       │                                    ◄─────────────┤
       │                                                  │
       │                                    { success:    │
       │                                      true }      │
       │                                                  │
       │ 3. Poll /get-display-credentials                │
       │    (every 3 seconds)                            │
       ├──────────────────────────────────►              │
       │                                                  │
       │ ◄──────────────────────────────────             │
       │    { status: "pending" }                        │
       │                                                  │
       │ (continue polling...)                           │
       ├──────────────────────────────────►              │
       │                                                  │
       │ ◄──────────────────────────────────             │
       │    { status: "authenticated",                   │
       │      credentials: {...} }                       │
       │                                                  │
       │ ✓ Login successful                              │
       │                                                  │
```

---

## Code Examples

### JavaScript/TypeScript (Web Portal)
```typescript
async function authenticateDevice(code: string, screenName: string, username: string, password: string) {
  const response = await fetch('https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/authenticate-with-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      screen_name: screenName,
      screen_username: username,
      screen_password: password,
    }),
  });
  return await response.json();
}
```

### React Native (Mobile App)
```typescript
// Generate code
const generateCode = async (deviceId: string) => {
  const response = await fetch('https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/generate-display-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId }),
  });
  return await response.json();
};

// Poll for credentials
const pollCredentials = async (deviceId: string) => {
  const response = await fetch('https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/get-display-credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId }),
  });
  return await response.json();
};
```

### cURL (Testing)
```bash
# Generate code
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/generate-display-code \
  -H "Content-Type: application/json" \
  -d '{"device_id":"test-123"}'

# Authenticate
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/authenticate-with-code \
  -H "Content-Type: application/json" \
  -d '{"code":"197695","screen_name":"Test","screen_username":"user","screen_password":"pass"}'

# Get credentials
curl -X POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/get-display-credentials \
  -H "Content-Type: application/json" \
  -d '{"device_id":"test-123"}'
```

---

## Important Notes

- **Code Expiration**: 10 minutes
- **Polling Interval**: 3 seconds
- **Code Format**: 6-digit number
- **One-Time Use**: Each code can only be used once
- **Auto-Regeneration**: Mobile app automatically generates new code when expired
