
/**
 * API Service for device status and content management
 */

const SUPABASE_URL = 'https://pgcdokfiaarnhzryfzwf.supabase.co';
const BASE_URL = `${SUPABASE_URL}/functions/v1`;

export interface DeviceStatusPayload {
  screen_username: string;
  screen_password: string;
  screen_name: string;
  device_id: string;
  status: 'online' | 'offline';
}

export interface DisplayContent {
  playlist_id: string;
  playlist_name: string;
  items: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    duration: number;
  }>;
}

/**
 * Register or update display credentials
 * This should be called when a user logs in
 */
export const registerDisplay = async (
  screen_username: string,
  screen_password: string,
  screen_name: string,
  device_id: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('Registering display:', { screen_username, screen_name, device_id });
    
    const response = await fetch(`${BASE_URL}/display-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        screen_username,
        screen_password,
        screen_name,
        device_id,
      }),
    });

    const responseText = await response.text();
    console.log('Register response status:', response.status);
    console.log('Register response body:', responseText);

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('Display registered successfully:', data);
      return { success: true };
    } else {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: responseText || 'Unknown error' };
      }
      console.error('Failed to register display:', errorData);
      return { success: false, error: errorData.error || 'Failed to register display' };
    }
  } catch (error) {
    console.error('Error registering display:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
};

/**
 * Send device status update
 */
export const sendDeviceStatus = async (
  payload: DeviceStatusPayload
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('Sending device status:', payload.status);
    
    const response = await fetch(`${BASE_URL}/display-connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('Status update response status:', response.status);
    console.log('Status update response body:', responseText);

    if (response.ok) {
      return { success: true };
    } else {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: responseText || 'Unknown error' };
      }
      console.error('Failed to send device status:', errorData);
      return { success: false, error: errorData.error || 'Failed to send device status' };
    }
  } catch (error) {
    console.error('Error sending device status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
};

/**
 * Fetch display content for preview
 */
export const fetchDisplayContent = async (
  screen_username: string,
  screen_password: string,
  screen_name: string
): Promise<{ success: boolean; data?: DisplayContent; error?: string }> => {
  try {
    console.log('Fetching display content...');
    
    const response = await fetch(`${BASE_URL}/display-get-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        screen_username,
        screen_password,
        screen_name,
      }),
    });

    const responseText = await response.text();
    console.log('Content fetch response status:', response.status);
    console.log('Content fetch response body:', responseText);

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('Content fetched successfully');
      return { success: true, data };
    } else {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: responseText || 'Unknown error' };
      }
      console.error('Failed to fetch content:', errorData);
      return { success: false, error: errorData.error || 'Failed to fetch content' };
    }
  } catch (error) {
    console.error('Error fetching content:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
};
