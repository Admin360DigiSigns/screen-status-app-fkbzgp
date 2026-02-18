
# Quick Start Guide - New Authentication System

## 🚀 Getting Started

The app now uses a **QR Code / 6-Digit Code** authentication system for a better user experience.

## 📱 For App Users (TV/Screen)

### Step 1: Open the App
When you open the app or log out, you'll see:
- A **QR Code** (large square barcode)
- A **6-digit code** (e.g., 123456)
- A **countdown timer** (10 minutes)

### Step 2: Keep the App Open
Leave the app open on your TV/screen while you authenticate from another device.

### Step 3: Wait for Authentication
The app will automatically log in once you complete authentication on the web app (usually takes 2-3 seconds).

### Step 4: You're In!
Once authenticated, you'll see the home screen with:
- Your screen status (Online/Offline)
- Display information
- Action buttons (Preview, Screen Share, Sync, Logout)

## 💻 For Web App Users (Phone/Computer)

### Step 1: Open the Web App
Open `WEB_APP_AUTH_EXAMPLE.html` in your browser (or your custom web app).

### Step 2: Enter the Code
You have two options:
- **Scan the QR code** with your phone camera (if supported)
- **Type the 6-digit code** manually

### Step 3: Enter Credentials
Fill in the form:
- **Authentication Code**: The 6-digit code from the screen
- **Username**: Your display username
- **Password**: Your display password
- **Screen Name**: Your screen name (e.g., "Main Lobby Display")

### Step 4: Submit
Click "Authenticate Screen" and wait for confirmation.

### Step 5: Success!
You'll see a success message, and the screen will automatically log in.

## ⏱️ Code Expiry

- Codes expire after **10 minutes**
- A countdown timer shows time remaining
- When expired, a new code is automatically generated
- You can manually generate a new code anytime

## 🔄 Logging Out

When you log out:
1. The app sends an "offline" status to the server
2. A new authentication code is generated immediately
3. You're back at the login screen with a fresh code

## 🎯 Key Features

### ✅ Security
- Time-limited codes (10 minutes)
- Unique codes for each session
- Credentials never displayed on screen
- Automatic expiry of old codes

### ✅ Convenience
- No typing on TV remote
- Quick QR code scanning
- Visual countdown timer
- Auto-refresh on expiry

### ✅ Reliability
- Real-time authentication status
- Automatic polling every 3 seconds
- Handles network errors gracefully
- All existing features work the same

## 🛠️ Troubleshooting

### Code Not Working?
- Check if the code has expired (look at the timer)
- Verify you entered the correct 6-digit code
- Make sure you're using the right credentials
- Try generating a new code

### App Not Logging In?
- Check your internet connection
- Verify the web app submitted successfully
- Wait a few seconds (polling happens every 3 seconds)
- Check the console logs for errors

### Code Expired Too Quickly?
- Codes expire after 10 minutes
- Generate a new code if needed
- The app will auto-generate on expiry

## 📊 What Happens Behind the Scenes

1. **App generates code** → Stored in database with device ID
2. **Web app submits** → Validates credentials and marks code as authenticated
3. **App polls status** → Checks every 3 seconds if code is authenticated
4. **Credentials received** → App stores them and logs in automatically
5. **Normal operation** → All features work as before

## 🔐 Security Notes

- Codes are single-use (marked as authenticated after first use)
- Old codes are automatically expired when new ones are generated
- Credentials are encrypted in transit
- Device ID is unique per installation

## 📞 Need Help?

Check these files for more information:
- `QR_CODE_AUTH_GUIDE.md` - Comprehensive technical guide
- `AUTHENTICATION_CHANGES_SUMMARY.md` - What changed and why
- `WEB_APP_AUTH_EXAMPLE.html` - Example web app implementation

## 🎉 That's It!

You're ready to use the new authentication system. Enjoy the improved experience!
