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

  // Set to false to disable the loading screen animation
  showLoadingScreen: true,

  // Cookie/consent banner. The site sets no tracking or non-essential cookies, so
  // no consent banner is legally required (§ 25 TDDDG) — keep this false in normal
  // operation. The banner (cookie-fix.js) and the terms_declined pages are retained
  // only as a design sample; set this to true to manually switch the sample on.
  showBanner: false,

  // Index hero

  // Site-wide announcement bar (injected by the controller just below the
  // header on every page). Three modes:
  //   'off'    - no bar; pages look exactly as without it.
  //   'offer'  - the offer/teaser bar that links to the offer page.
  //   'texts'  - show one entry from announcementTexts (see below).
  // The legacy boolean true is still accepted and treated as 'offer'.
  showAnnouncementBar: 'off',

  // Text shown in 'offer' mode (the teaser bar linking to the offer page). German
  // (de) and English (en) HTML strings; the controller picks the one matching the
  // page language. May contain markup such as <strong>.
  announcementOffer: {
    de: 'Kleine KI-Automatisierung? Schicken Sie es mir &ndash; ich baue es ab <strong>1.000&nbsp;&euro;</strong>',
    en: 'Have a small AI automation Send it to me &mdash; I&rsquo;ll build it starting at <strong>&euro;1000</strong>.'
  },

  // When showAnnouncementBar is 'texts', which entry of announcementTexts to
  // display (zero-based index).
  announcementTextIndex: 0,

  // Entries shown in 'texts' mode. Each entry has a German (de) and English (en)
  // HTML string; the controller picks the one matching the page language. The
  // strings may contain markup and links. Use the {base} placeholder for paths
  // relative to the current language base so links resolve correctly on every
  // page and in all languages, e.g. '{base}index.html#contact' points to the
  // contact form on the home page.
  announcementTexts: [
    {
      de: 'Brauchen Sie Hilfe mit KI? <a href="{base}index.html#contact">Kontaktieren Sie mich</a>',
      en: 'Need help? <a href="{base}index.html#contact">Contact me</a>'
    },
    {
      // Talk-to-an-AI voice agent
      de: 'Neugierig? <a href="{base}index.html#about">Sprechen Sie mit einer KI</a> direkt hier auf der Seite.',
      en: 'Curious? <a href="{base}index.html#about">Talk to an AI</a> right here on the site.'
    }
  ],

  // Set to false to hide the hero offer/teaser callout (the hero then looks
  // exactly as without it). Hidden by default in CSS, revealed when true.
  showHeroOffer: false,

  // Which entry of heroOffers to show in the hero callout (zero-based index).
  heroOfferIndex: 0,

  // Text variants of the hero offer callout. Each entry has a German (de) and
  // English (en) HTML string; the controller fills .hero-offer-text with the one
  // matching the page language when the callout is revealed. May contain markup
  // such as <strong>.
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

  // Set to false to hide the FAQ mini-tab ("Häufige Fragen" / "FAQ") on the
  // service pages (pages/services + en/pages/services). The controller adds the
  // body class .no-faq when false, and service-components.css hides the FAQ tab
  // button, its separator and the FAQ panel; the overview tab stays. Shown by default.
  showFAQ: false,

  // Set to false to hide "new feature" CTAs (currently the .service-cta banner on
  // the service pages). Visible by default; the controller adds the body class
  // .no-new-features when this is false, and styles.css hides the gated elements.
  showCTA: false
};

const VOICE_AGENT_CONFIG = {

  downForService: false,

  trying:         true,          // display "Testbetrieb"

  // Debug flags (passed to the VoiceAgent at init). See lib/README-voice-agent.md.
  // IMPORTANT: all false in production.
  debug:          false,         // verbose console logging + keep errors on screen
  simulateMic:    false,         // silent fake mic so the agent can be tested without a real mic
  
  launcherStyle:  'round',       // round | text, laucher overly style

  // Cloudflare Worker URL (handles all sensitive configuration)
  proxyUrl: 'https://homepage-api.walter-a-jablonowski.workers.dev',

  // Live transcript below the mic (what the user said + what the agent speaks).
  // Streamed from Gemini Live; cleared on each call start (no persistence).
  showTranscript:     false,
  transcriptMode:     'single',  // single | rolling; single: show only what the active speaker said
  transcriptLast:     2,         // if rolling: how many turns are shown (e.g. 2-3)
  transcriptShowUser: true,      // also show the user's speech (false = agent transcript only)

  // Show a runtime on/off switch for the transcript in the overlay foo, so the
  // visitor can toggle it during a call. showTranscript above is the initial state;
  // the switch is a per-session override (non-persisted). Overlay only.
  showTranscriptToggle: false,

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
  persistentAgent: true,

  // How to resume across a page load when persistentAgent is true:
  //   'native'  - Gemini Live session resumption only
  //   'handoff' - context handoff only (fresh session seeded with a summary)
  //   'auto'    - try native, fall back to handoff   (recommended)
  resumeStrategy: 'auto',

  // Ignore a stored session older than this (resumption window safety). Minutes.
  resumeMaxAgeMin: 10,

  // Optional LLM-callable navigate tool that points users at the right page.
  enableNavTool: true,    // master on/off for the navigate tool
  navMode:       'auto',  // 'auto' (ask, then navigate) | 'link' (show a clickable breadcrumb)

  // Show a runtime switch in the overlay foo to toggle auto-navigation (navMode
  // above is the initial state). Only meaningful together with enableNavTool. The
  // flip affects the next navigation/connect; it isn't persisted. Overlay only.
  showNavToggle: true,

  // Sample prompts shown under the mic in the overlay (.va-example), per page
  // language. 'text' is always shown; 'nav' is only added as a second line when
  // enableNavTool is true.
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
