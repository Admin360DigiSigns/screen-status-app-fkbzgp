
# 360DigiSigns TV App

A React Native + Expo 54 TV application for digital signage displays.

## Features

- **QR Code Authentication**: Secure login using QR codes or 6-digit codes
- **Remote Commands**: Control displays remotely via web portal
- **Content Preview**: Preview playlists and media content
- **Screen Share**: WebRTC-based screen sharing (native platforms only)
- **Status Sync**: Automatic device status updates every 20 seconds
- **TV Optimized**: Responsive design for both mobile and TV displays

## Logo & Branding

The app uses `ded86abe-6a7d-491d-80a5-adc8948ee47e.jpeg` as the official logo and icon across all platforms (iOS, Android, Web).

## Build Configuration

### Memory Optimization

The project has been optimized to handle out-of-memory errors during builds:

- **Gradle Memory**: Increased to 10GB for production builds
- **Kotlin Daemon**: Allocated 6GB for compilation
- **Metaspace**: Increased to 4GB
- **Code Cache**: Increased to 2GB

### Build Profiles

- **development**: Development builds with debugging enabled
- **preview**: Internal testing builds (APK)
- **production**: Production APK builds
- **production-aab**: Production App Bundle builds for Play Store

## Project Structure

```
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation screens
│   ├── login.tsx          # Authentication screen
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
├── contexts/              # React contexts (Auth, etc.)
├── utils/                 # Utility functions and API services
├── assets/                # Images and fonts
└── styles/                # Common styles
```

## Key Technologies

- **Expo 54**: React Native framework
- **Expo Router**: File-based routing
- **Supabase**: Backend and real-time features
- **WebRTC**: Screen sharing functionality
- **AsyncStorage**: Local data persistence

## Authentication Flow

1. App generates a 6-digit code and QR code
2. User scans QR or enters code on web portal
3. Web portal authenticates and sends credentials
4. App polls for authentication status
5. On success, app stores credentials and navigates to home

## Remote Commands

The app listens for real-time commands via Supabase:
- `preview_content`: Show content preview
- `screenshare`: Start screen sharing session
- `sync_status`: Force status sync
- `logout`: Remote logout

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for Android
npm run android

# Build for iOS
npm run ios
```

## Build for Production

The app is configured to build APKs for easier distribution. For Play Store submission, use the `production-aab` profile.

## Cleanup

All unnecessary documentation files and unused images have been removed to reduce project size and improve build performance.

## License

Proprietary - 360DigiSigns
