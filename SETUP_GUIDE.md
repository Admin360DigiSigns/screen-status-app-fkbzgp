
# TV App Setup Guide

## Build Error Fix

If you're experiencing build errors, follow these steps:

### 1. Configure Supabase Anon Key (Required for Screen Share)

The screen share feature requires a Supabase anon key to be configured. Here's how to set it up:

#### Option A: Using Environment Variable (Recommended)
1. Create a `.env` file in your project root (if it doesn't exist)
2. Add your Supabase anon key:
   ```
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here
   ```
3. Get your anon key from: [Supabase Dashboard](https://app.supabase.com) → Your Project → Settings → API → "anon public" key

#### Option B: Direct Configuration
1. Open `utils/supabaseClient.ts`
2. Replace the placeholder in the `SUPABASE_ANON_KEY` constant with your actual key:
   ```typescript
   const SUPABASE_ANON_KEY = 'your_actual_anon_key_here';
   ```

### 2. Verify Dependencies

Make sure all dependencies are installed:
```bash
npm install
```

Or if using yarn:
```bash
yarn install
```

### 3. Clear Cache

Clear the Expo cache to resolve any cached build issues:
```bash
npx expo start -c
```

### 4. Platform-Specific Notes

#### Android
- WebRTC is fully supported
- Screen share receiver will work once Supabase is configured

#### iOS
- WebRTC is fully supported
- Screen share receiver will work once Supabase is configured

#### Web
- Screen share receiver is not supported on web (it's designed for Android/iOS receivers)
- The web platform is for the sender side (desktop browser)

## Features Overview

### 1. Login & Authentication
- Username and password authentication
- Screen name assignment
- Device ID tracking
- Persistent login state

### 2. Status Monitoring
- Real-time online/offline status
- Automatic status updates every 1 minute (when logged in and on home screen)
- Device information display

### 3. Content Preview
- Fetch and display content from API
- Support for images and videos
- Responsive scaling for different screen sizes
- Automatic playlist rotation

### 4. Screen Share Receiver
- Receive screen share from web app
- WebRTC peer-to-peer connection
- Real-time streaming with low latency
- Automatic reconnection handling

## Supabase Database Setup (For Screen Share)

If you want to use the screen share feature, you need to set up a table in Supabase:

### Create the `screen_share_sessions` table:

```sql
CREATE TABLE screen_share_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_id TEXT NOT NULL,
  offer TEXT,
  answer TEXT,
  ice_candidates TEXT,
  answer_ice_candidates TEXT,
  status TEXT DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE screen_share_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your security requirements)
CREATE POLICY "Allow all operations on screen_share_sessions"
  ON screen_share_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE screen_share_sessions;
```

## API Endpoints

The app uses the following API endpoints:

1. **Login & Display Connect**
   - POST `https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/display-connect`
   - Payload: `{ screen_username, screen_password, screen_name, device_id }`

2. **Status Updates**
   - POST `https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/display-status`
   - Payload: `{ deviceId, screenName, screen_username, screen_password, screen_name, status, timestamp }`

## Troubleshooting

### Build fails with "WebRTC not found"
- This is normal on web platform
- WebRTC is only used on native platforms (Android/iOS)
- The app will gracefully handle this and show an appropriate message

### Screen share not working
1. Verify Supabase anon key is configured
2. Check that the `screen_share_sessions` table exists in Supabase
3. Verify Realtime is enabled on the table
4. Check console logs for connection errors

### Status updates not sending
1. Make sure you're logged in
2. Verify you're on the home screen (status updates only send when on home screen)
3. Check network connectivity
4. Review console logs for API errors

### Content preview not loading
1. Verify your credentials are correct
2. Check that the API endpoint is accessible
3. Ensure the response includes valid playlist data
4. Review console logs for detailed error messages

## Development Commands

- Start development server: `npm run dev`
- Start on Android: `npm run android`
- Start on iOS: `npm run ios`
- Start on Web: `npm run web`
- Clear cache: `npx expo start -c`

## Support

For issues or questions:
1. Check the console logs for detailed error messages
2. Verify all configuration steps are completed
3. Ensure all dependencies are installed
4. Try clearing cache and rebuilding
