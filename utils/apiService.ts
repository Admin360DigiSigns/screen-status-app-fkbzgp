
import { Platform } from 'react-native';
import { API_ENDPOINTS, SUPABASE_CONFIG, CONTENT_PROJECT_CONFIG } from './config';
import * as Device from 'expo-device';

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
    
    const API_ENDPOINT = API_ENDPOINTS.displayContentConnect;
    
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

export const sendDeviceStatus = async (payload: DeviceStatusPayload): Promise<{ success: boolean; data?: any; error?: string }> => {
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
    
    // Using the Content Project endpoint for status updates
    const API_ENDPOINT = API_ENDPOINTS.displayStatus;
    
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
      return { success: true, data: responseData };
    } else {
      console.error('Failed to send device status. Status code:', response.status);
      const errorData = await response.json().catch(() => ({}));
      console.error('Status error details:', errorData);
      console.error('Error message:', errorData.error || errorData.message);
      return { success: false, error: errorData.error || errorData.message || 'Failed to send status' };
    }
  } catch (error) {
    console.error('Error sending device status:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
};

export const fetchDisplayContent = async (
  username: string,
  password: string,
  screenName: string
): Promise<{ success: boolean; data?: DisplayConnectResponse; error?: string }> => {
  try {
    console.log('Fetching display content for:', { username, screenName });
    
    const API_ENDPOINT = API_ENDPOINTS.displayContentConnect;
    
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

// New authentication code-based methods using Content Project endpoints

export interface GenerateDisplayCodeResponse {
  success: boolean;
  code: string;
  expires_at: string;
}

export interface DeviceInfo {
  model: string;
  os: string;
}

/**
 * Generate a 6-digit display code for authentication
 * Mobile App calls this first
 * 
 * Endpoint: POST /generate-display-code
 * Base URL: https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1
 * 
 * Request Body:
 * {
 *   "device_id": "unique-device-identifier",
 *   "device_info": { "model": "Pixel 7", "os": "Android 14" }  // optional
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "code": "197695",
 *   "expires_at": "2024-12-08T19:36:26.000Z"
 * }
 */
export const generateDisplayCode = async (
  deviceId: string
): Promise<{ success: boolean; data?: GenerateDisplayCodeResponse; error?: string }> => {
  try {
    console.log('=== GENERATE DISPLAY CODE ===');
    console.log('Device ID:', deviceId);
    console.log('API Endpoint:', API_ENDPOINTS.generateDisplayCode);
    
    // Get device info
    const deviceInfo: DeviceInfo = {
      model: Device.modelName || Device.deviceName || 'Unknown',
      os: `${Platform.OS} ${Platform.Version || ''}`.trim(),
    };
    
    console.log('Device Info:', deviceInfo);
    
    const response = await fetch(API_ENDPOINTS.generateDisplayCode, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        device_id: deviceId,
        device_info: deviceInfo,
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    const responseText = await response.text();
    console.log('Response text:', responseText);

    if (response.ok) {
      try {
        const data: GenerateDisplayCodeResponse = JSON.parse(responseText);
        console.log('Display code generated successfully:', data.code);
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
      let errorMessage = 'Failed to generate display code';
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
    console.error('Error generating display code:', error);
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

export interface GetDisplayCredentialsResponse {
  success: boolean;
  status: 'pending' | 'authenticated' | 'expired';
  credentials?: {
    screen_name: string;
    screen_username: string;
    screen_password: string;
  };
}

/**
 * Get display credentials after authentication
 * Mobile App polls this endpoint
 * 
 * Endpoint: POST /get-display-credentials
 * Base URL: https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1
 * 
 * Request Body:
 * {
 *   "device_id": "unique-device-identifier"
 * }
 * 
 * Response (when authenticated):
 * {
 *   "success": true,
 *   "status": "authenticated",
 *   "credentials": {
 *     "screen_name": "Lobby Display",
 *     "screen_username": "lobby_user",
 *     "screen_password": "secure_password"
 *   }
 * }
 */
export const getDisplayCredentials = async (
  deviceId: string
): Promise<{ success: boolean; data?: GetDisplayCredentialsResponse; error?: string }> => {
  try {
    console.log('Getting display credentials for device:', deviceId);
    
    const response = await fetch(API_ENDPOINTS.getDisplayCredentials, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_id: deviceId }),
    });

    console.log('Get credentials response status:', response.status);

    if (response.ok) {
      const data: GetDisplayCredentialsResponse = await response.json();
      console.log('Credentials status:', data.status);
      if (data.status === 'authenticated') {
        console.log('✓ Credentials retrieved successfully');
      }
      return {
        success: true,
        data,
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to get credentials:', response.status, errorData);
      return {
        success: false,
        error: errorData.error || 'Failed to get credentials',
      };
    }
  } catch (error) {
    console.error('Error getting display credentials:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
};

/**
 * Clear device authentication from backend with retry logic
 * This should be called during logout to ensure the device starts fresh
 * 
 * Endpoint: POST /clear-device-authentication
 * Base URL: https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1
 * 
 * Request Body:
 * {
 *   "device_id": "unique-device-identifier"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Device authentication cleared successfully"
 * }
 */
export const clearDeviceAuthentication = async (
  deviceId: string,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string }> => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CLEARING DEVICE AUTHENTICATION FROM BACKEND');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Device ID:', deviceId);
  console.log('API Endpoint:', API_ENDPOINTS.clearDeviceAuthentication);
  console.log('Max Retries:', maxRetries);
  console.log('');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`┌─ Attempt ${attempt}/${maxRetries}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(API_ENDPOINTS.clearDeviceAuthentication, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ device_id: deviceId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.log('│  Response status:', response.status);
      console.log('│  Response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('└─ ✓ SUCCESS: Device authentication cleared');
        console.log('   Response:', data);
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('  ✓ BACKEND AUTHENTICATION CLEARED SUCCESSFULLY');
        console.log('  Device will NOT auto-login on next app start');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');
        return {
          success: true,
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('└─ ✗ FAILED: HTTP', response.status);
        console.error('   Error:', errorData.error || errorData.message || 'Unknown error');
        
        if (attempt < maxRetries) {
          const waitTime = attempt * 1000; // Exponential backoff: 1s, 2s, 3s
          console.log(`   Retrying in ${waitTime}ms...`);
          console.log('');
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          console.log('');
          console.log('═══════════════════════════════════════════════════════════════');
          console.error('  ✗ FAILED TO CLEAR BACKEND AUTHENTICATION');
          console.error('  ⚠️ WARNING: Device may auto-login on next app start!');
          console.log('═══════════════════════════════════════════════════════════════');
          console.log('');
          return {
            success: false,
            error: errorData.error || 'Failed to clear device authentication after multiple attempts',
          };
        }
      }
    } catch (error) {
      console.error('└─ ✗ EXCEPTION:', error instanceof Error ? error.message : 'Unknown error');
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('   Request timed out after 10 seconds');
      }
      
      if (attempt < maxRetries) {
        const waitTime = attempt * 1000;
        console.log(`   Retrying in ${waitTime}ms...`);
        console.log('');
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.error('  ✗ FAILED TO CLEAR BACKEND AUTHENTICATION');
        console.error('  ⚠️ WARNING: Device may auto-login on next app start!');
        console.error('  Error:', error instanceof Error ? error.message : 'Unknown error');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Network error occurred',
        };
      }
    }
  }
  
  // Should never reach here, but just in case
  return {
    success: false,
    error: 'Failed to clear device authentication',
  };
};

// Legacy auth code methods (kept for backward compatibility)
export interface GenerateAuthCodeResponse {
  code: string;
  expires_at: string;
}

export const generateAuthCode = async (
  deviceId: string
): Promise<{ success: boolean; data?: GenerateAuthCodeResponse; error?: string }> => {
  // Redirect to new generateDisplayCode method
  return generateDisplayCode(deviceId);
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
    console.log('Checking auth status for device:', deviceId);
    
    const response = await getDisplayCredentials(deviceId);
    
    if (response.success && response.data) {
      if (response.data.status === 'authenticated' && response.data.credentials) {
        return {
          success: true,
          data: {
            authenticated: true,
            screen_username: response.data.credentials.screen_username,
            screen_password: response.data.credentials.screen_password,
            screen_name: response.data.credentials.screen_name,
          },
        };
      } else if (response.data.status === 'expired') {
        return {
          success: true,
          data: {
            authenticated: false,
            expired: true,
          },
        };
      } else {
        return {
          success: true,
          data: {
            authenticated: false,
            pending: true,
          },
        };
      }
    } else {
      return {
        success: false,
        error: response.error,
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
