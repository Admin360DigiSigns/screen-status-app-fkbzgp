
import { Platform } from 'react-native';
import { API_ENDPOINTS } from './config';

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

export interface PlaylistItem {
  id: string;
  media_type: 'image' | 'video';
  media_url: string;
  duration: number;
  display_order: number;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  transition_type: string;
  transition_duration: number;
}

export interface Playlist {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  schedule_days: string[];
  schedule_start_time: string;
  schedule_end_time: string;
  items: PlaylistItem[];
}

export interface Solution {
  id: string;
  name: string;
  duration: number;
  canvas_settings: Record<string, any>;
  playlists: Playlist[];
}

export interface DisplayConnectResponse {
  display_id: string;
  screen_name: string;
  location: string;
  solution: Solution;
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

export const fetchDisplayContent = async (
  username: string,
  password: string,
  screenName: string
): Promise<{ success: boolean; data?: DisplayConnectResponse; error?: string }> => {
  try {
    console.log('Fetching display content for:', { username, screenName });
    
    const API_ENDPOINT = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/display-connect';
    
    const payload = {
      screen_username: username,
      screen_password: password,
      screen_name: screenName,
    };

    console.log('Sending display-connect request to:', API_ENDPOINT);
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Display-connect response status:', response.status);

    if (response.ok) {
      const data: DisplayConnectResponse = await response.json();
      console.log('Display content fetched successfully:', data);
      return {
        success: true,
        data,
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to fetch display content:', response.status, errorData);
      return {
        success: false,
        error: errorData.error || errorData.message || 'Failed to fetch content',
      };
    }
  } catch (error) {
    console.error('Error fetching display content:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
};

// New authentication code-based methods
export interface GenerateAuthCodeResponse {
  code: string;
  expires_at: string;
}

export const generateAuthCode = async (
  deviceId: string
): Promise<{ success: boolean; data?: GenerateAuthCodeResponse; error?: string }> => {
  try {
    console.log('=== GENERATE AUTH CODE ===');
    console.log('Device ID:', deviceId);
    console.log('API Endpoint:', API_ENDPOINTS.generateAuthCode);
    
    const response = await fetch(API_ENDPOINTS.generateAuthCode, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_id: deviceId }),
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    const responseText = await response.text();
    console.log('Response text:', responseText);

    if (response.ok) {
      try {
        const data: GenerateAuthCodeResponse = JSON.parse(responseText);
        console.log('Auth code generated successfully:', data.code);
        console.log('Expires at:', data.expires_at);
        return {
          success: true,
          data,
        };
      } catch (parseError) {
        console.error('Failed to parse response JSON:', parseError);
        return {
          success: false,
          error: 'Invalid response format from server',
        };
      }
    } else {
      let errorMessage = 'Failed to generate auth code';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error || errorData.message || errorMessage;
        console.error('Error details:', errorData);
      } catch (parseError) {
        console.error('Failed to parse error response:', responseText);
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error) {
    console.error('Error generating auth code:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
};

export interface CheckAuthStatusResponse {
  authenticated: boolean;
  screen_username?: string;
  screen_password?: string;
  screen_name?: string;
  pending?: boolean;
  expired?: boolean;
  error?: string;
}

export const checkAuthStatus = async (
  code: string,
  deviceId: string
): Promise<{ success: boolean; data?: CheckAuthStatusResponse; error?: string }> => {
  try {
    console.log('Checking auth status for code:', code);
    
    const response = await fetch(API_ENDPOINTS.checkAuthStatus, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, device_id: deviceId }),
    });

    console.log('Check auth status response status:', response.status);

    if (response.ok) {
      const data: CheckAuthStatusResponse = await response.json();
      console.log('Auth status checked successfully:', data.authenticated ? 'authenticated' : 'pending');
      return {
        success: true,
        data,
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to check auth status:', response.status, errorData);
      return {
        success: false,
        error: errorData.error || 'Failed to check auth status',
      };
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
};
