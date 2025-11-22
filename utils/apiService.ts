
import { Platform } from 'react-native';

export interface DeviceStatusPayload {
  deviceId: string;
  screenName: string;
  screen_username: string;
  screen_password: string;
  screen_name: string;
  status: 'online' | 'offline';
  timestamp: string;
}

export interface LoginPayload {
  screen_username: string;
  screen_password: string;
  screen_name: string;
  device_id: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const login = async (
  username: string,
  password: string,
  screenName: string,
  deviceId: string
): Promise<LoginResponse> => {
  try {
    console.log('Attempting login with API:', { username, screenName, deviceId });
    
    const API_ENDPOINT = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/display-connect';
    
    const payload: LoginPayload = {
      screen_username: username,
      screen_password: password,
      screen_name: screenName,
      device_id: deviceId,
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

export const sendDeviceStatus = async (payload: DeviceStatusPayload): Promise<boolean> => {
  try {
    // Log payload with hidden password for security
    console.log('Sending device status to API:', {
      ...payload,
      screen_password: '***'
    });
    
    // Using the same Supabase endpoint for status updates
    const API_ENDPOINT = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/display-status';
    
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
      const errorData = await response.json().catch(() => ({}));
      console.error('Status error details:', errorData);
      return false;
    }
  } catch (error) {
    console.error('Error sending device status:', error);
    return false;
  }
};
