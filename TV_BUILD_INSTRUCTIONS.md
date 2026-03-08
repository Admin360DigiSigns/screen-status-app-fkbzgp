
# Android TV Build Configuration

This app is configured to build as an **Android TV application** by default.

## Configuration Details

### 1. App Configuration (app.json)
- **Orientation**: Set to `landscape` for TV viewing
- **Intent Filters**: Includes `LEANBACK_LAUNCHER` category for TV launcher
- **Custom Plugin**: `./plugins/withAndroidTV` applies TV-specific manifest settings

### 2. Android Manifest Settings (via plugin)
The custom plugin (`plugins/withAndroidTV.js`) automatically configures:
- `android.software.leanback` feature (required: true) - Declares this as a TV app
- `android.hardware.touchscreen` feature (required: false) - TV apps don't require touchscreen
- `LEANBACK_LAUNCHER` intent category - Makes app appear in TV launcher
- Screen orientation locked to landscape
- Banner image for TV launcher

### 3. Gradle Properties
- `android.leanback.enabled=true` - Enables Android TV support in Gradle

## Building the APK

The app will automatically build as a TV app when you create an Android build. The APK will:
- Appear in the Android TV launcher (not the regular app launcher)
- Work on Android TV devices and Android sticks
- Support D-pad/remote navigation
- Display in landscape orientation by default

## Testing

### On Android TV Device/Stick:
1. Install the APK on your Android TV device or Android stick
2. The app will appear in the TV launcher (not the regular app drawer)
3. Navigate using your TV remote or D-pad

### On Android Phone (for development):
The app will still work on regular Android phones for development/testing purposes, but it's optimized for TV viewing.

## Key Features for TV
- Landscape orientation by default
- Optimized UI for 10-foot viewing distance
- Remote/D-pad navigation support
- No touchscreen requirement

## Backend & Functionality
All backend functionality remains unchanged:
- Authentication flow (username/password + screen name)
- Device status reporting
- Content display
- Screen sharing
- Command listening via Supabase Realtime

The TV configuration only affects the build target and UI optimization, not the core functionality.
