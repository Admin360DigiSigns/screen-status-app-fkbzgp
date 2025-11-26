
/**
 * Screen Share API Service
 * 
 * This service handles communication with the screen share API endpoints.
 * It implements polling for screen share offers and sending answers back to the server.
 */

const BASE_URL = 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1';

export interface ScreenShareCredentials {
  screen_username: string;
  screen_password: string;
  screen_name: string;
}

export interface ScreenShareOfferResponse {
  display_id: string;
  session: {
    id: string;
    display_id: string;
    offer: string;
    ice_candidates: Array<any>;
    status: string;
    created_at: string;
  } | null;
}

export interface ScreenShareAnswerRequest {
  screen_username: string;
  screen_password: string;
  screen_name: string;
  session_id: string;
  answer: string;
  answer_ice_candidates: Array<any>;
}

export interface ScreenShareAnswerResponse {
  success: boolean;
  message: string;
}

/**
 * Poll for screen share offers
 * This should be called every 2-3 seconds to check for new screen share sessions
 */
export const getScreenShareOffer = async (
  credentials: ScreenShareCredentials
): Promise<{ success: boolean; data?: ScreenShareOfferResponse; error?: string; status?: number }> => {
  try {
    console.log('Polling for screen share offer...');
    
    const response = await fetch(`${BASE_URL}/screen-share-get-offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    console.log('Get offer response status:', response.status);

    if (response.status === 200) {
      const data: ScreenShareOfferResponse = await response.json();
      console.log('Offer response:', data.session ? 'Session available' : 'No session available');
      
      if (data.session) {
        console.log('Session details:', {
          id: data.session.id,
          status: data.session.status,
          offerLength: data.session.offer?.length || 0,
          iceCandidatesCount: Array.isArray(data.session.ice_candidates) 
            ? data.session.ice_candidates.length 
            : 0,
        });
      }
      
      return {
        success: true,
        data,
        status: response.status,
      };
    } else if (response.status === 401) {
      const errorData = await response.json().catch(() => ({ error: 'Invalid display credentials' }));
      console.error('Authentication failed:', errorData);
      return {
        success: false,
        error: errorData.error || 'Invalid display credentials',
        status: response.status,
      };
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Failed to get offer:', response.status, errorData);
      return {
        success: false,
        error: errorData.error || 'Failed to get screen share offer',
        status: response.status,
      };
    }
  } catch (error) {
    console.error('Error getting screen share offer:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
};

/**
 * Send screen share answer back to the server
 */
export const sendScreenShareAnswer = async (
  request: ScreenShareAnswerRequest
): Promise<{ success: boolean; data?: ScreenShareAnswerResponse; error?: string; status?: number }> => {
  try {
    console.log('Sending screen share answer for session:', request.session_id);
    console.log('Answer length:', request.answer.length);
    console.log('Answer ICE candidates:', request.answer_ice_candidates.length);
    
    // Ensure ICE candidates are properly formatted
    const formattedRequest = {
      ...request,
      answer_ice_candidates: request.answer_ice_candidates.map((candidate) => {
        // Ensure each candidate is a proper object
        if (typeof candidate === 'string') {
          try {
            return JSON.parse(candidate);
          } catch (e) {
            console.error('Failed to parse ICE candidate:', e);
            return candidate;
          }
        }
        return candidate;
      }),
    };
    
    console.log('Formatted request ICE candidates:', formattedRequest.answer_ice_candidates.length);
    
    const response = await fetch(`${BASE_URL}/screen-share-send-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formattedRequest),
    });

    console.log('Send answer response status:', response.status);

    if (response.status === 200) {
      const data: ScreenShareAnswerResponse = await response.json();
      console.log('Answer sent successfully:', data.message);
      return {
        success: true,
        data,
        status: response.status,
      };
    } else if (response.status === 403) {
      const errorData = await response.json().catch(() => ({ error: 'Session not found or unauthorized' }));
      console.error('Forbidden:', errorData);
      return {
        success: false,
        error: errorData.error || 'Session not found or unauthorized',
        status: response.status,
      };
    } else if (response.status === 401) {
      const errorData = await response.json().catch(() => ({ error: 'Invalid display credentials' }));
      console.error('Authentication failed:', errorData);
      return {
        success: false,
        error: errorData.error || 'Invalid display credentials',
        status: response.status,
      };
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Failed to send answer:', response.status, errorData);
      return {
        success: false,
        error: errorData.error || 'Failed to send screen share answer',
        status: response.status,
      };
    }
  } catch (error) {
    console.error('Error sending screen share answer:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
};
