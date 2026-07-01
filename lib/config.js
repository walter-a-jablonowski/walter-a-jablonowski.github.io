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
 * securely in the Cloudflare Worker, no in client-side code.
 *
 * (C) Walter A. Jablonowski 2025-2026, All rights reserved
 *
*/

// Loading screen configuration
const LOADING_CONFIG = {

  // False disables the loading-screen animation
  showLoadingScreen: true,

  // Reveal new/unfinished content (.new-content), e.g. the "Systeme" menu
  showNewContent: true,

  // Cookie/consent banner sample (no consent needed normally, § 25 TDDDG)
  showBanner: false,

  // Index hero

  // Site-wide bar: 'off' | 'offer' (links to offer page) | 'texts' (true == 'offer')
  showAnnouncementBar: 'texts',

  // 'offer' bar text per language (de/en), may contain markup
  announcementOffer: {
    de: 'Kleine KI-Automatisierung? Schicken Sie es mir &ndash; ich baue es ab <strong>1.000&nbsp;&euro;</strong>',
    en: 'Have a small AI automation Send it to me &mdash; I&rsquo;ll build it starting at <strong>&euro;1000</strong>.'
  },

  // Which announcementTexts entry to show in 'texts' mode
  announcementTextIndex: 1,

  // 'texts' bar entries (de/en); {base} = current language
  announcementTexts: [
    {
      de: 'Brauchen Sie Hilfe mit KI? <a href="{base}index.html#contact">Kontaktieren Sie mich</a>',
      en: 'Need help? <a href="{base}index.html#contact">Contact me</a>'
    },
    {
      de: 'Neugierig? <a href="{base}index.html#about">Sprechen Sie mit einer KI</a> unten rechts.',
      en: 'Curious? <a href="{base}index.html#about">Talk to an AI</a> right here on the site.'
    }
  ],

  // Reveal the hero offer/teaser callout (hidden by default)
  showHeroOffer: false,

  // Which heroOffers entry to show
  heroOfferIndex: 0,

  // Hero callout text variants (de/en), fill .hero-offer-text
  heroOffers: [
    {
      de: 'Sie wollen KI einf&uuml;hren, aber wissen nicht wof&uuml;r genau und wie? Schreiben Sie mir <span class="hero-offer-link">hier</span>. Ich helfe in Bamberg oder online.',
      en: 'You want to introduce AI but don&rsquo;t know what for exactly? Write to me <span class="hero-offer-link">here</span>. I help you in and around Bamberg or online.'
    },
    {
      de: 'Sie wollen KI einf&uuml;hren, aber wissen nicht wof&uuml;r genau und wie? Erstberatung <strong>kostenfrei</strong> in Bamberg und Umgebung oder online.',
      en: 'You want to introduce AI but don&rsquo;t know what for exactly? Initial consultation <strong>free of charge</strong> in and around Bamberg or online.'
    }
  ],

  // Services pages

  // Hide commercial content via body.hide-biz: prices/.biz-only, service FAQ + .service-cta
  hideBiz: true
};

const VOICE_AGENT_CONFIG = {

  downForService: false,

  // Display "Testbetrieb"
  trying: true,

  // Debug flags (VoiceAgent init); all false in production. See lib/README-voice-agent.md

  // Verbose console logging + keep errors on screen
  debug: false,
  // Silent fake mic so the agent can be tested without a real mic
  simulateMic: false,

  // round | text, laucher overly style
  launcherStyle: 'round',

  // Cloudflare Worker URL (sensitive config)
  proxyUrl: 'https://homepage-api.walter-a-jablonowski.workers.dev',

  // Live transcript under the mic (Gemini Live; cleared each call)
  showTranscript: false,
  // Single | rolling; single: show only what the active speaker said
  transcriptMode: 'single',
  // If rolling: how many turns are shown (e.g. 2-3)
  transcriptLast: 2,
  // Also show the user's speech (false = agent transcript only)
  transcriptShowUser: true,

  // Overlay runtime switch to show/hide the transcript (per-session)
  showTranscriptToggle: false,

  // Persistent overlay + cross-page resume. See lib/voice-agent-persistent-overlay-plan.md

  // true = always-on overlay on every page; false = legacy in-#about widget
  persistentAgent: true,
  // Resume after reload: 'native' | 'handoff' | 'auto' (recommended)
  resumeStrategy: 'auto',
  // ignore stored sessions older than this (minutes)
  resumeMaxAgeMin: 10,

  // Master on/off for the navigate tool
  enableNavTool: true,
  // 'auto' (ask, then navigate) | 'link' (show a clickable breadcrumb)
  navMode: 'auto',

  // Overlay runtime switch to toggle auto-nav (needs enableNavTool; per-session)
  showNavToggle: true,

  // Sample prompts under the mic (.va-example) per language; 'nav' shown only when enableNavTool
  examples: {
    de: {
      text: 'z. B. „Kann Walter KI-Features für mich bauen?“',
      nav:  '„Gehe mal zur Automatisierungsseite“'
    },
    en: {
      text: 'e.g. "Can Walter build AI features for me?"',
      nav:  '"Take me to the automation page"'
    }
  },

  ui: {
    idleColor: '     #FF6B35',  // Orange from website theme
    listeningColor: '#FF3E00',  // Orange-red
    speakingColor: ' #FFC107',  // Gold
    errorColor: '    #FF0000',  // Red
  }
};

// Export for use in misc modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VOICE_AGENT_CONFIG;
}
