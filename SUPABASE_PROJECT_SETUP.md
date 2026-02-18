
# Supabase Project Setup Guide

## ⚠️ IMPORTANT: Get Your Anon Key

Your app is now configured to connect to the correct Supabase project (`gzyywcqlrjimjegbtoyc`), but you need to add the anon key.

### Steps to Get Your Anon Key:

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/gzyywcqlrjimjegbtoyc/settings/api

2. Copy the **"anon" / "public"** key (it starts with `eyJ...`)

3. Update the following files with your anon key:

   **Option A: Using Environment Variable (Recommended)**
   - Add to your `.env` file or environment:
   ```
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

   **Option B: Direct Update**
   - Replace `YOUR_ANON_KEY_HERE` in:
     - `utils/supabaseClient.ts`
     - `utils/config.ts`

## What Changed:

✅ **Supabase URL**: Updated from `pgcdokfiaarnhzryfzwf` to `gzyywcqlrjimjegbtoyc`
✅ **Command Listener**: Now listening to the correct project for `app_commands` table
✅ **All API Endpoints**: Updated to use the content project
✅ **Realtime Subscriptions**: Connected to the correct database

## Testing the Connection:

After adding your anon key:

1. **Restart your app** to load the new configuration
2. **Login** to your TV app
3. **Check the console logs** - you should see:
   - `📡 Supabase URL: https://gzyywcqlrjimjegbtoyc.supabase.co`
   - `✅ Successfully subscribed to Realtime channel`
   - `📊 Project ID: gzyywcqlrjimjegbtoyc`

4. **Send a command from your webapp** - it should now work!

## Troubleshooting:

If commands still don't work:

1. **Check the anon key is correct** - it should start with `eyJ`
2. **Verify the app_commands table exists** in project `gzyywcqlrjimjegbtoyc`
3. **Check console logs** for connection status
4. **Use the Diagnostics screen** in your app to test the command listener

## Project Structure:

- **Content Project** (`gzyywcqlrjimjegbtoyc`): 
  - Authentication endpoints
  - Content delivery
  - **app_commands table** (where webapp sends commands)
  - All Edge Functions

Your TV app now connects to this single project for everything!
