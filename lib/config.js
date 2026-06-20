/**
 * Configuration for Google AI Studio Voice Agent
 * 
 * SETUP INSTRUCTIONS:
 * 1. Deploy the Cloudflare Worker from functions/voice-agent/voice-agent.js
 * 2. Add your Google AI API key to the Worker
 * 3. Update the context content in the Worker
 * 4. Update the proxyUrl below with your Worker URL
 * 
 * SECURITY:
 * All sensitive data (API key, context, system instructions) is now stored
 * securely in the Cloudflare Worker, not in client-side code.
 * 
 * (C) Walter A. Jablonowski 2025, All rights reserved
 * 
 */

// Loading screen configuration
const LOADING_CONFIG = {
  // Set to false to disable the loading screen animation
  showLoadingScreen: true,

  // Set to false to hide the hero offer/teaser callout (the hero then looks
  // exactly as without it). Hidden by default in CSS, revealed when true.
  showHeroOffer: true,

  // Site-wide announcement bar (injected by the controller just below the
  // header on every page). Three modes:
  //   'off'    - no bar; pages look exactly as without it.
  //   'offer'  - the offer/teaser bar that links to the offer page.
  //   'texts'  - show one entry from announcementTexts (see below).
  // The legacy boolean true is still accepted and treated as 'offer'.
  showAnnouncementBar: 'off',

  // When showAnnouncementBar is 'texts', which entry of announcementTexts to
  // display (zero-based index).
  announcementTextIndex: 0,

  // Entries shown in 'texts' mode. Each entry has a German (de) and English (en)
  // HTML string; the controller picks the one matching the page language. The
  // strings may contain markup and links. Use the {root} placeholder for paths
  // relative to the current language root so links resolve correctly on every
  // page and in both languages, e.g. '{root}index.html#contact' points to the
  // contact form on the home page.
  announcementTexts: [
    {
      de: 'Brauchen Sie Hilfe mit KI? <a href="{root}index.html#contact">Kontaktieren Sie mich</a>',
      en: 'Need help? <a href="{root}index.html#contact">Contact me</a>'
    },
    {
      // Talk-to-an-AI voice agent
      de: 'Neugierig? <a href="{root}index.html#about">Sprechen Sie mit einer KI</a> direkt hier auf der Seite.',
      en: 'Curious? <a href="{root}index.html#about">Talk to an AI</a> right here on the site.'
    }
  ]
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
