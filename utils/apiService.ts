
import { Platform } from 'react-native';

export interface DeviceStatusPayload {
  deviceId: string;
  screenName: string;
  status: 'online' | 'offline';
  timestamp: string;
}

export interface LoginPayload {
  screen_username: string;
  screen_password: string;
  screen_name: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface DisplayStatusPayload {
  device_id: string;
  screen_name: string;
  screen_username: string;
  location: string;
  status: string;
  is_active: boolean;
  last_connected_at: string;
  assigned_solution_id: string;
  organization_id: string;
}

export const login = async (
  username: string,
  password: string,
  screenName: string
): Promise<LoginResponse> => {
  try {
    console.log('Attempting login with API:', { username, screenName });
    
    const API_ENDPOINT = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/display-connect';
    
    const payload: LoginPayload = {
      screen_username: username,
      screen_password: password,
      screen_name: screenName,
    };

    console.log('Sending login request to:', API_ENDPOINT);
    console.log('Login payload:', payload);
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Login response status:', response.status);
    console.log('Login response headers:', response.headers);

    const responseText = await response.text();
    console.log('Login response text:', responseText);

    if (response.ok) {
      try {
        const data = responseText ? JSON.parse(responseText) : {};
        console.log('Login successful:', data);
        return {
          success: true,
          message: data.message || 'Login successful',
        };
      } catch (parseError) {
        console.log('Response is not JSON, treating as success');
        return {
          success: true,
          message: 'Login successful',
        };
      }
    } else {
      let errorData: any = {};
      try {
        errorData = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Could not parse error response');
      }
      console.error('Login failed:', response.status, errorData);
      return {
        success: false,
        error: errorData.error || errorData.message || `Login failed with status ${response.status}`,
      };
    }
  } catch (error) {
    console.error('Error during login request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
};

export const sendDisplayStatus = async (
  deviceId: string,
  screenName: string,
  username: string,
  password: string,
  status: 'online' | 'offline' = 'online'
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('Sending display status:', { deviceId, screenName, username, status });
    
    // Build the URL with query parameters
    const params = new URLSearchParams({
      screen_username: username,
      screen_password: password,
      screen_name: screenName,
    });
    
    const API_ENDPOINT = `https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/display-status?${params.toString()}`;
    
    const payload: DisplayStatusPayload = {
      device_id: deviceId,
      screen_name: screenName,
      screen_username: username,
      location: 'Building A - Lobby',
      status: status,
      is_active: status === 'online',
      last_connected_at: new Date().toISOString(),
      assigned_solution_id: 'uuid',
      organization_id: 'uuid',
    };

    console.log('Sending display status request to:', API_ENDPOINT);
    console.log('Payload:', payload);
    
    // Changed from GET to POST since we're sending a body
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Display status response status:', response.status);

    const responseText = await response.text();
    console.log('Display status response text:', responseText);

    if (response.ok) {
      try {
        const data = responseText ? JSON.parse(responseText) : {};
        console.log('Display status sent successfully:', data);
        return {
          success: true,
        };
      } catch (parseError) {
        console.log('Response is not JSON, treating as success');
        return {
          success: true,
        };
      }
    } else {
      let errorData: any = {};
      try {
        errorData = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Could not parse error response');
      }
      console.error('Failed to send display status:', response.status, errorData);
      return {
        success: false,
        error: errorData.error || errorData.message || `Failed to send display status with status ${response.status}`,
      };
    }
  } catch (error) {
    console.error('Error sending display status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
};

export const sendDeviceStatus = async (payload: DeviceStatusPayload): Promise<boolean> => {
  try {
    console.log('Sending device status to API:', payload);
    
    // Replace this URL with your actual API endpoint
    const API_ENDPOINT = 'https://your-api-endpoint.com/device-status';
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('Device status sent successfully');
      return true;
    } else {
      console.error('Failed to send device status:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Error sending device status:', error);
    return false;
  }
};
