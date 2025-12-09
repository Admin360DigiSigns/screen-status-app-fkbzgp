
# Clear Device Authentication Edge Function

## Overview
This Edge Function is required to fix the authentication issue after logout. It clears the device's authentication state from the backend, allowing fresh authentication codes to work properly.

## Problem Being Solved
After logout, when a new authentication code is generated, the mobile app doesn't accept authentication even though the web app successfully authenticates (200 OK). This is because there's a stale authentication record on the backend that needs to be cleared.

## Edge Function Details

**Project:** Content Project (gzyywcqlrjimjegbtoyc)  
**Function Name:** `clear-device-authentication`  
**Endpoint:** `https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/clear-device-authentication`

## Deployment Instructions

1. Navigate to the Content Project in Supabase Dashboard
2. Go to Edge Functions
3. Create a new function named `clear-device-authentication`
4. Copy the code below into the function

## Edge Function Code

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { device_id } = await req.json();

    if (!device_id) {
      return new Response(
        JSON.stringify({ error: 'device_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Clearing device authentication for device:', device_id);

    // Delete all display codes for this device
    const { error: deleteCodesError } = await supabase
      .from('display_codes')
      .delete()
      .eq('device_id', device_id);

    if (deleteCodesError) {
      console.error('Error deleting display codes:', deleteCodesError);
      return new Response(
        JSON.stringify({ error: 'Failed to clear device authentication', details: deleteCodesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Device authentication cleared successfully for device:', device_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Device authentication cleared successfully' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in clear-device-authentication function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

## API Usage

### Request
```http
POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/clear-device-authentication
Content-Type: application/json

{
  "device_id": "unique-device-identifier"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Device authentication cleared successfully"
}
```

### Response (Error)
```json
{
  "error": "device_id is required"
}
```

## Integration

The mobile app now calls this endpoint during logout (Step 4 in the logout flow) to ensure that:

1. All old display codes are removed from the database
2. The device starts with a clean authentication state
3. New authentication codes generated after logout will work properly
4. The web app can successfully authenticate the device with the new code

## Testing

After deploying this function, test the logout flow:

1. Log in to the mobile app
2. Log out
3. A new authentication code should be generated
4. Authenticate from the web app using the new code
5. The mobile app should accept the authentication and log in successfully

## Troubleshooting

If authentication still doesn't work after logout:

1. Check the Edge Function logs in Supabase Dashboard
2. Verify the `display_codes` table is being cleared
3. Check that the device_id is consistent across logout and code generation
4. Ensure the web app is using the correct (new) authentication code
