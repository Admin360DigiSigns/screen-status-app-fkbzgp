
/**
 * Centralized Configuration
 * 
 * This file contains all configuration for the app.
 * 
 * Base URL: https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1
 * 
 * Authentication Flow:
 * 1. Mobile app generates code using /generate-display-code
 * 2. Web portal authenticates using /authenticate-with-code
 * 3. Mobile app polls for credentials using /get-display-credentials
 * 4. On logout, mobile app clears backend auth using /clear-device-authentication
 */

export const SUPABASE_CONFIG = {
  url: 'https://gzyywcqlrjimjegbtoyc.supabase.co',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY_HERE',
  projectId: 'gzyywcqlrjimjegbtoyc',
};

// Content Project Configuration (for authentication and content)
export const CONTENT_PROJECT_CONFIG = {
  url: 'https://gzyywcqlrjimjegbtoyc.supabase.co',
  functionsUrl: 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1',
};

// Base URL for Edge Functions (Content Project)
export const EDGE_FUNCTIONS_URL = `${SUPABASE_CONFIG.url}/functions/v1`;

// API Endpoints - All using Content Project
export const API_ENDPOINTS = {
  // Authentication Endpoints
  generateDisplayCode: `${CONTENT_PROJECT_CONFIG.functionsUrl}/generate-display-code`,
  authenticateWithCode: `${CONTENT_PROJECT_CONFIG.functionsUrl}/authenticate-with-code`,
  getDisplayCredentials: `${CONTENT_PROJECT_CONFIG.functionsUrl}/get-display-credentials`,
  clearDeviceAuthentication: `${CONTENT_PROJECT_CONFIG.functionsUrl}/clear-device-authentication`,
  
  // Content and Status Endpoints
  displayStatus: `${CONTENT_PROJECT_CONFIG.functionsUrl}/display-status`,
  displayContentConnect: `${CONTENT_PROJECT_CONFIG.functionsUrl}/display-connect`,
  
  // Screen Share Endpoints
  screenShareGetOffer: `${CONTENT_PROJECT_CONFIG.functionsUrl}/screen-share-get-offer`,
  screenShareSendAnswer: `${CONTENT_PROJECT_CONFIG.functionsUrl}/screen-share-send-answer`,
  screenShareCreateOffer: `${CONTENT_PROJECT_CONFIG.functionsUrl}/screen-share-create-offer`,
  screenShareGetAnswer: `${CONTENT_PROJECT_CONFIG.functionsUrl}/screen-share-get-answer`,
};
