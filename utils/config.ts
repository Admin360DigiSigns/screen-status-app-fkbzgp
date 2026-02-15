
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
 * 
 * Command Flow:
 * 1. Web portal sends commands using /send-command
 * 2. Mobile app polls for commands using /get-pending-commands
 * 3. Mobile app updates command status using /update-command-status
 */

export const SUPABASE_CONFIG = {
  url: 'https://pgcdokfiaarnhzryfzwf.supabase.co',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnY2Rva2ZpYWFybmh6cnlmendmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwOTk1OTEsImV4cCI6MjA3OTY3NTU5MX0.wn4-y6x8Q-EbPGci_B27scrRXNOEvg7I4xsqeCEYqag',
  projectId: 'pgcdokfiaarnhzryfzwf',
};

// Content Project Configuration (for authentication and content)
export const CONTENT_PROJECT_CONFIG = {
  url: 'https://gzyywcqlrjimjegbtoyc.supabase.co',
  functionsUrl: 'https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1',
};

// Base URL for Edge Functions (Master Project)
export const EDGE_FUNCTIONS_URL = `${SUPABASE_CONFIG.url}/functions/v1`;

// API Endpoints - Using Content Project for all authentication and commands
export const API_ENDPOINTS = {
  // Master Project Endpoints (legacy)
  displayRegister: `${EDGE_FUNCTIONS_URL}/display-register`,
  displayConnect: `${EDGE_FUNCTIONS_URL}/display-connect`,
  displayGetContent: `${EDGE_FUNCTIONS_URL}/display-get-content`,
  screenShareGetOffer: `${EDGE_FUNCTIONS_URL}/screen-share-get-offer`,
  screenShareSendAnswer: `${EDGE_FUNCTIONS_URL}/screen-share-send-answer`,
  screenShareCreateOffer: `${EDGE_FUNCTIONS_URL}/screen-share-create-offer`,
  screenShareGetAnswer: `${EDGE_FUNCTIONS_URL}/screen-share-get-answer`,
  
  // New Authentication Endpoints (Content Project)
  // Base URL: https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1
  generateDisplayCode: `${CONTENT_PROJECT_CONFIG.functionsUrl}/generate-display-code`,
  authenticateWithCode: `${CONTENT_PROJECT_CONFIG.functionsUrl}/authenticate-with-code`,
  getDisplayCredentials: `${CONTENT_PROJECT_CONFIG.functionsUrl}/get-display-credentials`,
  clearDeviceAuthentication: `${CONTENT_PROJECT_CONFIG.functionsUrl}/clear-device-authentication`,
  
  // Command Endpoints (Content Project)
  getPendingCommands: `${CONTENT_PROJECT_CONFIG.functionsUrl}/get-pending-commands`,
  updateCommandStatus: `${CONTENT_PROJECT_CONFIG.functionsUrl}/update-command-status`,
  
  // Content and Status Endpoints (Content Project)
  displayStatus: `${CONTENT_PROJECT_CONFIG.functionsUrl}/display-status`,
  displayContentConnect: `${CONTENT_PROJECT_CONFIG.functionsUrl}/display-connect`,
};
