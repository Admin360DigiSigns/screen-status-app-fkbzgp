
/**
 * Screen Share API Service
 * Handles polling for screen share offers and sending answers
 */

const SUPABASE_URL = 'https://pgcdokfiaarnhzryfzwf.supabase.co';
const BASE_URL = `${SUPABASE_URL}/functions/v1`;

export interface ScreenShareOffer {
  session_id: string;
  offer: string;
  ice_candidates: string;
}

/**
 * Poll for screen share offers
 * Returns null if no offer is available
 */
export const getScreenShareOffer = async (
  username: string,
  password: string,
  screenName: string
): Promise<{ success: boolean; data?: ScreenShareOffer; error?: string }> => {
  try {
    const response = await fetch(`${BASE_URL}/screen-share-get-offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        screen_username: username,
        screen_password: password,
        screen_name: screenName,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      
      // If no offer available, data will be null
      if (!data || !data.session_id) {
        return { success: true, data: undefined };
      }
      
      return { success: true, data };
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Failed to get screen share offer:', errorData);
      return { success: false, error: errorData.error || 'Failed to get offer' };
    }
  } catch (error) {
    console.error('Error getting screen share offer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
};

/**
 * Send screen share answer back to the web app
 */
export const sendScreenShareAnswer = async (
  username: string,
  password: string,
  screenName: string,
  sessionId: string,
  answer: string,
  answerIceCandidates: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('Sending screen share answer for session:', sessionId);
    
    const response = await fetch(`${BASE_URL}/screen-share-send-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        screen_username: username,
        screen_password: password,
        screen_name: screenName,
        session_id: sessionId,
        answer,
        answer_ice_candidates: answerIceCandidates,
      }),
    });

    if (response.ok) {
      console.log('Screen share answer sent successfully');
      return { success: true };
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Failed to send screen share answer:', errorData);
      return { success: false, error: errorData.error || 'Failed to send answer' };
    }
  } catch (error) {
    console.error('Error sending screen share answer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
};
