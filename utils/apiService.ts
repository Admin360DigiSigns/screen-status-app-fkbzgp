
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
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Login response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('Login successful:', data);
      return {
        success: true,
        message: data.message || 'Login successful',
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('Login failed:', response.status, errorData);
      return {
        success: false,
        error: errorData.error || errorData.message || 'Login failed',
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
  password: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('Sending display status:', { deviceId, screenName, username });
    
    const API_ENDPOINT = `https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/display-status?screen_username=${encodeURIComponent(username)}&screen_password=${encodeURIComponent(password)}&screen_name=${encodeURIComponent(screenName)}`;
    
    const payload: DisplayStatusPayload = {
      device_id: deviceId,
      screen_name: screenName,
      screen_username: username,
      location: 'Building A - Lobby',
      status: 'online',
      is_active: true,
      last_connected_at: new Date().toISOString(),
      assigned_solution_id: 'uuid',
      organization_id: 'uuid',
    };

    console.log('Sending display status request to:', API_ENDPOINT);
    console.log('Payload:', payload);
    
    const response = await fetch(API_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Display status response status:', response.status);

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      console.log('Display status sent successfully:', data);
      return {
        success: true,
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to send display status:', response.status, errorData);
      return {
        success: false,
        error: errorData.error || errorData.message || 'Failed to send display status',
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
