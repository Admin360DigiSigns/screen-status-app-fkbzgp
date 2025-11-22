
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
    console.log('Login payload:', { ...payload, screen_password: '***' });
    
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
    // Log the complete payload structure (with hidden password)
    console.log('=== DEVICE STATUS PAYLOAD ===');
    console.log('Full payload structure:', {
      deviceId: payload.deviceId,
      screenName: payload.screenName,
      screen_username: payload.screen_username,
      screen_password: '***',
      screen_name: payload.screen_name,
      status: payload.status,
      timestamp: payload.timestamp,
    });
    console.log('Payload keys:', Object.keys(payload));
    console.log('============================');
    
    // Using the same Supabase endpoint for status updates
    const API_ENDPOINT = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/display-status';
    
    console.log('Sending POST request to:', API_ENDPOINT);
    console.log('Request body (stringified):', JSON.stringify({
      ...payload,
      screen_password: '***'
    }));
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (response.ok) {
      const responseData = await response.json().catch(() => null);
      console.log('Device status sent successfully. Response:', responseData);
      return true;
    } else {
      console.error('Failed to send device status. Status code:', response.status);
      const errorData = await response.json().catch(() => ({}));
      console.error('Status error details:', errorData);
      console.error('Error message:', errorData.error || errorData.message);
      return false;
    }
  } catch (error) {
    console.error('Error sending device status:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return false;
  }
};
