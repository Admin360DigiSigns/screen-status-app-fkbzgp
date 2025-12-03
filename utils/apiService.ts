
import { Platform } from 'react-native';

export interface DeviceStatusPayload {
  deviceId: string;
  screenName: string;
  status: 'online' | 'offline';
  timestamp: string;
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

export const sendDeviceStatus = async (payload: DeviceStatusPayload): Promise<boolean> => {
  try {
    // Log the complete payload structure
    console.log('=== DEVICE STATUS PAYLOAD ===');
    console.log('Full payload structure:', {
      deviceId: payload.deviceId,
      screenName: payload.screenName,
      status: payload.status,
      timestamp: payload.timestamp,
    });
    console.log('Payload keys:', Object.keys(payload));
    console.log('============================');
    
    // Using the Supabase endpoint for status updates
    const API_ENDPOINT = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/display-status';
    
    console.log('Sending POST request to:', API_ENDPOINT);
    console.log('Request body (stringified):', JSON.stringify(payload));
    
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
  screenName: string
): Promise<{ success: boolean; data?: DisplayConnectResponse; error?: string }> => {
  try {
    console.log('Fetching display content for:', { screenName });
    
    const API_ENDPOINT = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/display-connect';
    
    const payload = {
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
