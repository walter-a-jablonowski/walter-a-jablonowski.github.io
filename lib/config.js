/**
 * Configuration for Google AI Studio Voice Agent
 * 
 * SETUP INSTRUCTIONS:
 * 1. Deploy the Cloudflare Worker from functions/voice-agent/voice-agent.js
 * 2. Add your Google AI API key to the Worker
 * 3. Update the context content in the Worker
 * 4. Update the proxyUrl below with your Worker URL
 * 
 * SECURITY NOTE:
 * All sensitive data (API key, context, system instructions) is now stored
 * securely in the Cloudflare Worker, not in client-side code.
 * 
 * (C) Walter A. Jablonowski 2025, All rights reserved
 * 
 */

// Loading screen configuration
const LOADING_CONFIG = {
  // Set to false to disable the loading screen animation
  showLoadingScreen: true
};

const VOICE_AGENT_CONFIG = {

  downForService: false,

  // Cloudflare Worker URL (handles all sensitive configuration)
  proxyUrl: 'https://homepage-api.walter-a-jablonowski.workers.dev',

  ui: {
    idleColor: '#FF6B35',      // Orange from website theme
    listeningColor: '#FF3E00', // Orange-red
    speakingColor: '#FFC107',  // Gold
    errorColor: '#FF0000',     // Red
  }
};

// Export for use in misc modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VOICE_AGENT_CONFIG;
}
