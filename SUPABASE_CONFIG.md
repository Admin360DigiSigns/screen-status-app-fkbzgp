
# Supabase Configuration

## Single Project Setup

This app uses **ONE Supabase project** for all functionality:

- **Project ID**: `pgcdokfiaarnhzryfzwf`
- **URL**: `https://pgcdokfiaarnhzryfzwf.supabase.co`
- **Anon Key**: Configured in `utils/config.ts`

## Why One Project?

Previously, there was confusion because different files were pointing to different Supabase projects:
- ❌ `https://gzyywcqlrjimjegbtoyc.supabase.co` (old, incorrect)
- ✅ `https://pgcdokfiaarnhzryfzwf.supabase.co` (correct, current)

This caused "failed to fetch" errors because Edge Functions were deployed on the correct project but some API calls were going to the wrong project.

## Centralized Configuration

All Supabase configuration is now centralized in `utils/config.ts`:

```typescript
export const SUPABASE_CONFIG = {
  url: 'https://pgcdokfiaarnhzryfzwf.supabase.co',
  anonKey: '...',
  projectId: 'pgcdokfiaarnhzryfzwf',
};
```

## Edge Functions

All Edge Functions are deployed on the `pgcdokfiaarnhzryfzwf` project:

### Display Management
- `display-register` - Register a new display
- `display-connect` - Update display status (online/offline)
- `display-get-content` - Fetch content for a display

### Screen Sharing (WebRTC)
- `screen-share-get-offer` - Poll for screen share offers (app side)
- `screen-share-send-answer` - Send WebRTC answer (app side)
- `screen-share-create-offer` - Create screen share offer (web side)
- `screen-share-get-answer` - Get WebRTC answer (web side)

## Files Using Supabase

1. **`utils/config.ts`** - Centralized configuration (source of truth)
2. **`utils/supabaseClient.ts`** - Supabase client initialization
3. **`utils/apiService.ts`** - Display management API calls
4. **`utils/screenShareApi.ts`** - Screen sharing API calls

## Web App Integration

If you have a separate web app that needs to interact with this system:

1. Use the same Supabase project: `pgcdokfiaarnhzryfzwf`
2. Use the same anon key (available in `utils/config.ts`)
3. Call the appropriate Edge Functions:
   - `screen-share-create-offer` to initiate screen sharing
   - `screen-share-get-answer` to receive the WebRTC answer from the app

## Environment Variables

You can optionally set the anon key via environment variable:

```bash
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

If not set, the app will use the hardcoded key from `utils/config.ts`.

## Troubleshooting

If you see "failed to fetch" errors:

1. ✅ Check that all files are using `utils/config.ts` for configuration
2. ✅ Verify the Edge Functions exist on the `pgcdokfiaarnhzryfzwf` project
3. ✅ Check network connectivity
4. ✅ Review Edge Function logs in Supabase dashboard
5. ✅ Ensure the anon key is correct

## Migration Notes

**Previous Setup** (incorrect):
- Multiple Supabase URLs scattered across files
- Confusion about which project to use
- "Failed to fetch" errors

**Current Setup** (correct):
- Single source of truth in `utils/config.ts`
- All API calls use the same project
- Clear documentation of Edge Functions
- Consistent error handling
