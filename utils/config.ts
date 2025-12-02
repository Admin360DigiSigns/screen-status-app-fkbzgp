
/**
 * Centralized Configuration
 * 
 * This file contains all configuration for the app.
 * 
 * IMPORTANT: This app uses ONE Supabase project for everything:
 * - Project ID: pgcdokfiaarnhzryfzwf
 * - URL: https://pgcdokfiaarnhzryfzwf.supabase.co
 * 
 * All Edge Functions are deployed on this project:
 * - display-register
 * - display-connect
 * - display-get-content
 * - screen-share-get-offer
 * - screen-share-send-answer
 * - screen-share-create-offer
 * - screen-share-get-answer
 */

export const SUPABASE_CONFIG = {
  url: 'https://pgcdokfiaarnhzryfzwf.supabase.co',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnY2Rva2ZpYWFybmh6cnlmendmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwOTk1OTEsImV4cCI6MjA3OTY3NTU5MX0.wn4-y6x8Q-EbPGci_B27scrRXNOEvg7I4xsqeCEYqag',
  projectId: 'pgcdokfiaarnhzryfzwf',
};

// Base URL for Edge Functions
export const EDGE_FUNCTIONS_URL = `${SUPABASE_CONFIG.url}/functions/v1`;

// API Endpoints
export const API_ENDPOINTS = {
  displayRegister: `${EDGE_FUNCTIONS_URL}/display-register`,
  displayConnect: `${EDGE_FUNCTIONS_URL}/display-connect`,
  displayGetContent: `${EDGE_FUNCTIONS_URL}/display-get-content`,
  screenShareGetOffer: `${EDGE_FUNCTIONS_URL}/screen-share-get-offer`,
  screenShareSendAnswer: `${EDGE_FUNCTIONS_URL}/screen-share-send-answer`,
  screenShareCreateOffer: `${EDGE_FUNCTIONS_URL}/screen-share-create-offer`,
  screenShareGetAnswer: `${EDGE_FUNCTIONS_URL}/screen-share-get-answer`,
  getPendingCommands: `${EDGE_FUNCTIONS_URL}/get-pending-commands`,
  acknowledgeCommand: `${EDGE_FUNCTIONS_URL}/acknowledge-command`,
};
