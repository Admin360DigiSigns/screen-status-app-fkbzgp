
import { createClient } from '@supabase/supabase-js';

// Main Supabase project configuration (for authentication, storage, etc.)
export const SUPABASE_CONFIG = {
  url: 'https://pgcdokfiaarnhzryfzwf.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnY2Rva2ZpYWFybmh6cnlmendmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0MjI4NTUsImV4cCI6MjA0ODk5ODg1NX0.Yx0Yx5Yx5Yx5Yx5Yx5Yx5Yx5Yx5Yx5Yx5Yx5Yx5Yx5',
};

// Content Project configuration (for display content and authentication)
export const CONTENT_PROJECT_CONFIG = {
  url: 'https://gzyywcqlrjimjegbtoyc.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6eXl3Y3FscmppbWplZ2J0b3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0MjI4NTUsImV4cCI6MjA0ODk5ODg1NX0.Yx0Yx5Yx5Yx5Yx5Yx5Yx5Yx5Yx5Yx5Yx5Yx5Yx5Yx5',
};

// API Endpoints - Using Content Project for all display-related operations
export const API_ENDPOINTS = {
  // Display authentication and content endpoints (Content Project)
  displayContentConnect: `${CONTENT_PROJECT_CONFIG.url}/functions/v1/display-content-connect`,
  displayStatus: `${CONTENT_PROJECT_CONFIG.url}/functions/v1/display-status`,
  
  // New authentication code-based endpoints (Content Project)
  generateDisplayCode: `${CONTENT_PROJECT_CONFIG.url}/functions/v1/generate-display-code`,
  getDisplayCredentials: `${CONTENT_PROJECT_CONFIG.url}/functions/v1/get-display-credentials`,
  clearDeviceAuthentication: `${CONTENT_PROJECT_CONFIG.url}/functions/v1/clear-device-authentication`,
  
  // Remote command endpoints (Content Project)
  getRemoteCommands: `${CONTENT_PROJECT_CONFIG.url}/functions/v1/get-remote-commands`,
  acknowledgeCommand: `${CONTENT_PROJECT_CONFIG.url}/functions/v1/acknowledge-command`,
  
  // Screen share endpoints (Content Project)
  screenShareOffer: `${CONTENT_PROJECT_CONFIG.url}/functions/v1/screen-share-offer`,
  screenShareAnswer: `${CONTENT_PROJECT_CONFIG.url}/functions/v1/screen-share-answer`,
  screenShareIceCandidate: `${CONTENT_PROJECT_CONFIG.url}/functions/v1/screen-share-ice-candidate`,
  screenShareStatus: `${CONTENT_PROJECT_CONFIG.url}/functions/v1/screen-share-status`,
};

// Create Supabase client for main project
export const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);

// Create Supabase client for content project
export const contentSupabase = createClient(
  CONTENT_PROJECT_CONFIG.url,
  CONTENT_PROJECT_CONFIG.anonKey
);
