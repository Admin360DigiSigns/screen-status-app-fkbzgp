
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
    console.log('=== LOGIN ATTEMPT START ===');
    console.log('Username:', username);
    console.log('Screen Name:', screenName);
    console.log('Password length:', password.length);
    
    const API_ENDPOINT = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/display-connect';
    
    const payload: LoginPayload = {
      screen_username: username,
      screen_password: password,
      screen_name: screenName,
    };

    console.log('API Endpoint:', API_ENDPOINT);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    };

    console.log('Request headers:', requestOptions.headers);
    console.log('Request body:', requestOptions.body);
    
    console.log('Sending fetch request...');
    const startTime = Date.now();
    
    const response = await fetch(API_ENDPOINT, requestOptions);
    
    const endTime = Date.now();
    console.log(`Request completed in ${endTime - startTime}ms`);
    console.log('Response status:', response.status);
    console.log('Response statusText:', response.statusText);
    console.log('Response ok:', response.ok);
    
    // Log all response headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('Response headers:', JSON.stringify(headers, null, 2));

    // Get response text
    const responseText = await response.text();
    console.log('Response body length:', responseText.length);
    console.log('Response body:', responseText);

    // Check if response is successful (2xx status codes)
    if (response.ok) {
      console.log('✅ Login request successful (status 2xx)');
      
      // Try to parse JSON response
      if (responseText && responseText.trim().length > 0) {
        try {
          const data = JSON.parse(responseText);
          console.log('Parsed JSON response:', data);
          return {
            success: true,
            message: data.message || 'Login successful',
          };
        } catch (parseError) {
          console.log('Response is not JSON, but request was successful');
          console.log('Parse error:', parseError);
          return {
            success: true,
            message: 'Login successful',
          };
        }
      } else {
        console.log('Empty response body, but request was successful');
        return {
          success: true,
          message: 'Login successful',
        };
      }
    } else {
      // Handle error responses
      console.error('❌ Login request failed');
      console.error('Status code:', response.status);
      
      let errorMessage = `Login failed with status ${response.status}`;
      let errorData: any = {};
      
      if (responseText && responseText.trim().length > 0) {
        try {
          errorData = JSON.parse(responseText);
          console.error('Error response data:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          console.error('Could not parse error response as JSON');
          console.error('Raw error response:', responseText);
          errorMessage = responseText || errorMessage;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error) {
    console.error('=== LOGIN ERROR ===');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    
    if (error instanceof TypeError) {
      console.error('Network error - possible causes:');
      console.error('- No internet connection');
      console.error('- Server is down');
      console.error('- CORS issue (web only)');
      console.error('- Invalid URL');
    }
    
    console.error('Full error:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  } finally {
    console.log('=== LOGIN ATTEMPT END ===');
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
    console.log('=== SENDING DISPLAY STATUS ===');
    console.log('Device ID:', deviceId);
    console.log('Screen Name:', screenName);
    console.log('Username:', username);
    console.log('Status:', status);
    
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

    console.log('API Endpoint:', API_ENDPOINT);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Display status response status:', response.status);

    const responseText = await response.text();
    console.log('Display status response:', responseText);

    if (response.ok) {
      console.log('✅ Display status sent successfully');
      
      if (responseText && responseText.trim().length > 0) {
        try {
          const data = JSON.parse(responseText);
          console.log('Parsed response:', data);
        } catch (parseError) {
          console.log('Response is not JSON');
        }
      }
      
      return {
        success: true,
      };
    } else {
      console.error('❌ Failed to send display status');
      
      let errorMessage = `Failed with status ${response.status}`;
      
      if (responseText && responseText.trim().length > 0) {
        try {
          const errorData = JSON.parse(responseText);
          console.error('Error data:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          console.error('Raw error:', responseText);
          errorMessage = responseText || errorMessage;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error) {
    console.error('=== DISPLAY STATUS ERROR ===');
    console.error('Error:', error);
    
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
