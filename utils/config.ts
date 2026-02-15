
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
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6eXl3Y3FscmppbWplZ2J0b3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NjMxMjEsImV4cCI6MjA1MjQzOTEyMX0.gEyAIsTiaY_HhtofyhdaYAXu3-8fE_Dp61Z9P3ax50',
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
