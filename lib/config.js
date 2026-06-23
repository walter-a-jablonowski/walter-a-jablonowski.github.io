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
 * (C) Walter A. Jablonowski 2025-2026, All rights reserved
 * 
 */

// Loading screen configuration
const LOADING_CONFIG = {
  
  // Set to false to disable the loading screen animation
  showLoadingScreen: true,
  
  // Cookie/consent banner. The site sets no tracking or non-essential cookies, so
  // no consent banner is legally required (§ 25 TDDDG) — keep this false in normal
  // operation. The banner (cookie-fix.js) and the terms_declined pages are retained
  // only as a design sample; set this to true to manually switch the sample on.
  showBanner: false,

  // Set to false to hide "new feature" CTAs (currently the .service-cta banner on
  // the service pages). Visible by default; the controller adds the body class
  // .no-new-features when this is false, and styles.css hides the gated elements.
  showCTA: false,
  
  // Set to false to hide the FAQ mini-tab ("Häufige Fragen" / "FAQ") on the
  // service pages (pages/services + en/pages/services). The controller adds the
  // body class .no-faq when false, and service-components.css hides the FAQ tab
  // button, its separator and the FAQ panel; the overview tab stays. Shown by default.
  showFAQ: false,
  
  // Set to false to hide the hero offer/teaser callout (the hero then looks
  // exactly as without it). Hidden by default in CSS, revealed when true.
  showHeroOffer: false,

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

  // Debug flags (passed to the VoiceAgent at init). See lib/README-voice-agent.md.
  // IMPORTANT: both false in production.
  debug: false,        // verbose console logging + keep errors on screen
  simulateMic: false,  // silent fake mic so the agent can be tested without a real mic

  ui: {
    idleColor: '#FF6B35',      // Orange from website theme
    listeningColor: '#FF3E00', // Orange-red
    speakingColor: '#FFC107',  // Gold
    errorColor: '#FF0000',     // Red
  },

  // --- Persistent overlay agent + cross-page conversation resume ------------
  // See lib/voice-agent-persistent-overlay-plan.md. The whole object is passed
  // into new VoiceAgent(VOICE_AGENT_CONFIG) and read via this.config.*, and the
  // controller reads the same object for the site-wide DOM changes.

  // Move the voice agent into a persistent bottom-right overlay present on every
  // page, instead of living only in the home page #about section.
  //   false = legacy behavior (in-#about widget + .floating-ai-button link).
  //   true  = always-on overlay; #about shows a static illustration, the nav
  //           label reverts to About/Über mich, and the about text becomes the
  //           shorter personal variant.
  persistentAgent: false,

  // How to resume across a page load when persistentAgent is true:
  //   'native'  - Gemini Live session resumption only
  //   'handoff' - context handoff only (fresh session seeded with a summary)
  //   'auto'    - try native, fall back to handoff   (recommended)
  resumeStrategy: 'auto',

  // Ignore a stored session older than this (resumption window safety). Minutes.
  resumeMaxAgeMin: 10,

  // Optional LLM-callable navigate tool that points users at the right page.
  enableNavTool: false,       // master on/off for the navigate tool
  navMode: 'link',            // 'auto' (ask, then navigate) | 'link' (show a clickable breadcrumb)
};

// Export for use in misc modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VOICE_AGENT_CONFIG;
}
