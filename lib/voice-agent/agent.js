/**
 * Voice agent client — microphone capture, audio playback and the overlay UI.
 *
 * The live conversation runs entirely through our own Cloudflare Worker
 * (config.proxyUrl + '/live'), which owns the API key, the system prompt, the
 * site guides, the navigate-tool targets and the provider protocol. This file
 * deliberately contains none of that: it streams mic audio up and renders what
 * comes back. See functions/voice-agent/relay-plan.md.
 *
 * (C) Walter A. Jablonowski 2025-2026, All rights reserved
 */
class VoiceAgent
{
  constructor(config = {})
  {
    // All configuration is passed in at init (from VOICE_AGENT_CONFIG in
    // lib/config.js) so settings live in one place. See lib/README-voice-agent.md.
    this.config = config;

    // Debug mode (config.debug). When true:
    //  - verbose console logging (WebSocket messages, close code/reason, audio)
    //  - keeps error messages on screen instead of auto-hiding them
    // IMPORTANT: false in production (verbose logging adds jank on mobile).
    this.debug = config.debug ?? false;

    // Simulate a silent microphone instead of using getUserMedia (config.simulateMic),
    // so the WebSocket/model handshake and AI greeting can be tested on a machine with
    // NO microphone (e.g. a PC). Leave false on machines that have a mic.
    this.simulateMic = config.simulateMic ?? false;

    // --- Persistent overlay / cross-page resume (see overlay plan) ----------
    this.persistent      = config.persistentAgent ?? false;
    this.resumeStrategy  = config.resumeStrategy ?? 'auto';
    this.resumeMaxAgeMin = config.resumeMaxAgeMin ?? 10;
    this.enableNavTool   = config.enableNavTool ?? false;
    this.navMode         = config.navMode ?? 'link';
    this.showNavToggle   = config.showNavToggle ?? false;  // footer auto-nav switch
    this.launcherStyle   = config.launcherStyle ?? 'round'; // 'round' | 'text'

    // --- Live transcript below the mic (see appendTranscript / renderTranscript)
    this.showTranscript  = config.showTranscript ?? false;
    this.transcriptMode  = config.transcriptMode ?? 'single';   // 'single' | 'rolling'
    this.transcriptLast  = config.transcriptLast ?? 2;          // rolling: turns kept
    this.transcriptShowUser = config.transcriptShowUser ?? true; // include user speech
    this.showTranscriptToggle = config.showTranscriptToggle ?? false; // footer transcript switch
    this.transcriptEl    = null;   // the render target (overlay or in-page)
    this.transcriptRole  = null;   // speaker of the in-progress utterance
    this.transcriptText  = '';     // text of the in-progress utterance
    this.transcriptTurns = [];     // finalized turns (rolling mode)
    this.transcriptTurnDone = false; // last turn ended; next chunk starts anew

    // Overlay DOM refs (built in buildOverlay when persistent)
    this.overlay   = null;
    this.launcher  = null;
    this.panel     = null;
    this.titleEl   = null;
    this.linkSlot  = null;

    this.resuming    = false;    // true while reconnecting an earlier session
    this.resumeMode  = null;     // 'native' | 'handoff' for the current resume
    this.justResumed = false;    // native resume in flight (cleared on setupComplete)
    this.navigating  = false;    // true while we deliberately leave the page
    this.transcript  = [];       // accumulated turns for the handoff fallback

    this.ws = null;
    this.audioContext = null;     // Capture context (mic input @ 16 kHz)
    this.playbackContext = null;  // Output context (AI audio, resampled once)
    this.mediaStream  = null;
    this.state        = 'idle';  // idle, listening, speaking, error

    // Gapless playback scheduling (see scheduleAudioChunk / playScheduled)
    this.nextStartTime = 0;          // Playhead on the playback context clock
    this.activeSources = new Set();  // Currently scheduled / playing buffer sources
    this.turnComplete  = true;       // Whether the server finished the current turn
    this.scheduleLead  = 0.08;       // Lead time (s) before the first chunk of a turn

    // UI elements (will be set in init)
    this.micButton      = null;
    this.statusElement  = null;

    // Localized, user-facing status/error strings (chosen by page language).
    const isDe = (document.documentElement.lang || 'en').toLowerCase().startsWith('de');
    this.isDe = isDe;            // page language (used for greeting + language hint)
    this.lang = isDe ? 'de' : 'en';
    this.t = isDe ? {
      micStart:    'Klicken Sie auf das Mikrofon, um zu starten',
      initFail:    'Sprach-Assistent konnte nicht initialisiert werden',
      playFail:    'Sprache konnte nicht wiedergegeben werden',
      serverError: 'Serverfehler',
      requesting:  'Mikrofonzugriff wird angefragt …',
      listening:   'Ich höre zu … Sprechen Sie jetzt',
      speaking:    'Spricht …',
      micDenied:   'Mikrofonzugriff verweigert. Bitte erlauben Sie den Zugriff und versuchen Sie es erneut.',
      micNotFound: 'Kein Zugriff auf Ihr Mikrofon – auf diesem Gerät wurde kein Mikrofon gefunden.',
      micInUse:    'Kein Zugriff auf Ihr Mikrofon – es wird möglicherweise von einer anderen App verwendet.',
      micGeneric:  'Kein Zugriff auf Ihr Mikrofon. Bitte prüfen Sie Ihr Gerät und versuchen Sie es erneut.',
      unsupported: 'Sprach-Assistent nicht unterstützt. Bitte verwenden Sie einen modernen Browser.',
      maintenance: 'Derzeit wegen Wartung nicht verfügbar',
      panelTitle:  'Fragen Sie meine KI-Assistentin',
      hint:        'Klicken Sie auf das Mikrofon, um zu starten',
      expired:     'Vorherige Sitzung abgelaufen – klicken Sie auf das Mikrofon, um neu zu starten.',
      openAria:    'KI-Assistentin öffnen',
      launcherText: 'KI fragen',
      closeAria:   'Schließen',
      trying:      'Testbetrieb',
      resumeTitle: 'Gespräch fortsetzen?',
      resumeLabel: 'Gespräch fortsetzen',
      resumeHint:  'Klicken Sie auf das Mikrofon, um das Gespräch fortzusetzen',
      linkIntro:   'Das finden Sie hier:',
      linkIntroMulti: 'Das könnte passen – tippen Sie auf eine Seite:',
      toggleTranscript:     'Transkript',
      toggleTranscriptHint: 'Live-Transkript ein- oder ausblenden',
      toggleNav:            'Auto-Nav',
      toggleNavHint:        'Erlauben, dass die Assistentin passende Seiten automatisch öffnet'
    } : {
      micStart:    'Click the microphone to start',
      initFail:    'Failed to initialize voice agent',
      playFail:    'Failed to play speach',
      serverError: 'Server error',
      requesting:  'Requesting microphone access...',
      listening:   'Listening... Speak now',
      speaking:    'Speaking...',
      micDenied:   'Microphone access denied. Please allow microphone access and try again.',
      micNotFound: "Can't access your microphone — no microphone was found on this device.",
      micInUse:    "Can't access your microphone — it may be in use by another app.",
      micGeneric:  "Can't access your microphone. Please check your device and try again.",
      unsupported: 'Voice agent unsupported. Try a modern browser.',
      maintenance: 'Currently down for service',
      panelTitle:  'Ask my AI assistant',
      hint:        'Click the microphone to start',
      expired:     'Previous session expired — click the microphone to start again.',
      openAria:    'Open AI assistant',
      launcherText: 'Ask AI',
      closeAria:   'Close',
      trying:      'Test mode',
      resumeTitle: 'Continue?',
      resumeLabel: 'Resume conversation',
      resumeHint:  'Click the microphone to resume the conversation',
      linkIntro:   'You can find that here:',
      linkIntroMulti: 'These might help — tap a page:',
      toggleTranscript:     'Transcript',
      toggleTranscriptHint: 'Show or hide the live transcript',
      toggleNav:            'Auto nav',
      toggleNavHint:        'Let the assistant open the matching page for you automatically'
    };

    // Sample prompts shown in the overlay (.va-example) live in config so they
    // can be tuned without touching the agent. The nav line is only rendered
    // when enableNavTool is true (see buildOverlay).
    const examples = (config.examples && config.examples[this.lang]) || {};
    this.t.example    = examples.text || '';
    this.t.exampleNav = examples.nav  || '';
  }

  /**
   * Initialize the voice agent
   */
  async init()
  {
    try {
      // Check browser support
      if (!this.checkBrowserSupport()) {
        this.showFallback();
        return false;
      }

      // Get UI elements
      this.micButton = document.getElementById('voice-agent-mic');
      this.statusElement = document.getElementById('voice-agent-status');
      this.transcriptEl = document.getElementById('voice-agent-transcript');

      // Check if service is down for maintenance
      if( this.config.downForService )
      {
        this.showMaintenance();
        return false;
      }

      // Set up event listeners
      this.setupEventListeners();

      this.updateStatus(this.t.micStart);
      return true;
    } catch (error) {
      console.error('Failed to initialize voice agent:', error);
      this.showError(this.t.initFail);
      return false;
    }
  }

  /**
   * Check if browser supports required APIs
   */
  checkBrowserSupport()
  {
    const hasWebSocket = 'WebSocket' in window;
    const hasMediaDevices = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    const hasAudioContext = 'AudioContext' in window || 'webkitAudioContext' in window;

    return hasWebSocket && hasMediaDevices && hasAudioContext;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners()
  {
    if (this.micButton) {
      this.micButton.addEventListener('click', () => this.toggleVoiceAgent());
    }
  }

  /**
   * Toggle voice agent on/off
   */
  async toggleVoiceAgent()
  {
    // Don't allow toggling if in maintenance mode
    if( this.state === 'maintenance' )
      return;

    if( this.state === 'resume' ) {
      await this.resumeSession();
    } else if (this.state === 'idle') {
      await this.startVoiceAgent();
    } else {
      this.stopVoiceAgent();
    }
  }

  /**
   * Start voice agent session
   */
  async startVoiceAgent()
  {
    try {
      // Fresh transcript for each call (no persistence).
      this.resetTranscript();

      // Check proxy URL
      if (!this.config.proxyUrl || this.config.proxyUrl.includes('YOUR-PHP-SERVER')) {
        this.showError('Please configure your PHP proxy URL in lib/config.js');
        return;
      }

      // Capture context: mic input must be 16 kHz for Gemini Live
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      // Playback context: separate context at the hardware-default rate so the
      // 24 kHz AI audio is resampled only once. (Reusing the 16 kHz capture
      // context would downsample the output and waste CPU on every chunk.)
      this.playbackContext = new AudioContext();

      // Resume both contexts if suspended (required by browser autoplay policies)
      if (this.audioContext.state === 'suspended')
        await this.audioContext.resume();
      if (this.playbackContext.state === 'suspended')
        await this.playbackContext.resume();

      // Acquire the microphone — or a simulated silent stream in debug mode, so
      // the WebSocket/model handshake and the AI greeting can be tested without
      // a real microphone (e.g. on a PC that has none).
      if (this.simulateMic) {
        this.updateStatus('Debug: simulating microphone');
        this.mediaStream = this.createSimulatedMicStream();
      } else {
        this.updateStatus(this.t.requesting);
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      // Connect to Google AI Studio Live API
      await this.connectRelay();

      // Greeting handling depends on whether we are resuming a prior session:
      //  - fresh start  -> normal greeting prompt
      //  - native resume-> skip greeting; the model still has the context
      //  - handoff      -> seed a summary instead of greeting
      // The Worker greets on its own once the session is set up; only a handoff
      // resume needs anything sent from here.
      if( this.resuming && this.resumeMode === 'handoff' )
        this.sendHandoffSeed();

      // Start capturing audio
      this.startAudioCapture();

      this.setState('listening');
      this.updateStatus(this.t.listening);

      // Mark the session live so a cross-page navigation can offer to resume it.
      if( this.persistent )
        this.persistActive();

      this.resuming = false;
    } catch (error) {
      console.error('Error starting voice agent:', error);
      this.showError(this.getMicErrorMessage(error));
      this.setState('error');
    }
  }

  /**
   * Map a getUserMedia / startup error to a friendly, user-facing message
   */
  getMicErrorMessage( error )
  {
    switch( error && error.name )
    {
      case 'NotAllowedError':
      case 'SecurityError':
        return this.t.micDenied;
      case 'NotFoundError':
      case 'OverconstrainedError':
        return this.t.micNotFound;
      case 'NotReadableError':
        return this.t.micInUse;
      default:
        return this.t.micGeneric;
    }
  }

  /**
   * Stop voice agent session
   */
  stopVoiceAgent()
  {
    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Stop any scheduled playback
    this.activeSources.forEach(source => { try { source.stop(); } catch (e) {} });
    this.activeSources.clear();
    this.nextStartTime = 0;
    this.turnComplete = true;

    // Close both audio contexts
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.playbackContext) {
      this.playbackContext.close();
      this.playbackContext = null;
    }

    this.setState('idle');
    this.updateStatus(this.t.micStart);

    // An explicit stop ends the conversation: drop any resume state so the next
    // page load starts fresh. (A cross-page navigation sets this.navigating
    // first, so the session is preserved in that case.)
    if( this.persistent && ! this.navigating ) {
      this.transcript = [];
      this.clearSession();
    }
  }

  // =========================================================================
  // Relay transport — the only transport (see relay-plan.md)
  // =========================================================================

  /**
   * Connect to our own Worker. No setup message: the Worker owns the session,
   * so all this side sends is the session's shape as query parameters.
   */
  connectRelay()
  {
    return new Promise((resolve, reject) => {

      this.ws = new WebSocket( this.buildRelayUrl());

      this.ws.onopen = () => {
        this.log('Relay connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('Relay connection error:', error);
        reject( new Error('Relay connection failed'));
      };

      this.ws.onmessage = async (event) => {
        const text = (event.data instanceof Blob) ? await event.data.text() : event.data;
        this.handleRelayMessage( text );
      };

      this.ws.onclose = (event) => this.onRelayClose( event );
    });
  }

  /**
   * `wss://…/live?lang=de&nav=link&tx=1&resume=…`
   *
   * `tx` is requested whenever transcripts are needed — either on screen, or to
   * build the handoff summary that seeds a resumed session.
   */
  buildRelayUrl()
  {
    const base = (this.config.relayUrl || this.config.proxyUrl || '').replace(/\/+$/, '');
    const params = new URLSearchParams({ lang: this.lang, nav: this.navMode });

    if( this.showTranscript || this.showTranscriptToggle || this.persistent )
      params.set('tx', '1');

    // Native session resumption: hand the stored handle back. It is opaque here
    // and useless without the API key, which never leaves the Worker.
    const handle = this.resuming ? this.getStored('va:handle') : null;
    if( handle && this.resumeMode !== 'handoff' )
      params.set('resume', handle);

    return base.replace(/^http/, 'ws') + '/live?' + params.toString();
  }

  /**
   * The relay's own protocol — small, neutral and provider-agnostic. Compare
   * handleWebSocketMessage(), which has to understand Gemini's envelopes.
   */
  handleRelayMessage( data )
  {
    let msg;
    try { msg = JSON.parse( data ); }
    catch (error) { return; }

    this.log('Relay frame:', msg.t);

    switch( msg.t )
    {
      case 'ready':
        this.justResumed = false;      // a native resume connected cleanly
        break;

      case 'audio':
        // Already normalized to raw PCM + sample rate by the Worker.
        this.scheduleAudioChunk( msg.d, 'audio/pcm', msg.r || 24000 );
        break;

      case 'tx': {
        const role = msg.r === 'u' ? 'user' : 'ai';
        this.noteTranscript( role, msg.s );
        this.appendTranscript( role, msg.s );
        break;
      }

      case 'stop':
        // Barge-in: drop everything queued, it is stale now.
        this.stopPlayback();
        break;

      case 'turn':
        this.turnComplete = true;
        this.transcriptTurnDone = true;
        if( this.activeSources.size === 0 ) {
          this.setState('listening');
          this.updateStatus(this.t.listening);
        }
        break;

      case 'nav':
        this.showNav( msg.items, msg.auto );
        break;

      case 'sid':
        // Opaque resume handle for the next page load.
        this.setStored('va:handle', msg.v);
        this.setStored('va:ts', String(Date.now()));
        break;

      case 'err':
        this.onRelayError( msg.c );
        break;
    }
  }

  /**
   * A relay error code, never a provider message. The only one that changes
   * behaviour is a dead resume handle: fall back to a fresh, seeded session
   * instead of showing the visitor an error.
   */
  onRelayError( code )
  {
    this.log('Relay error:', code);

    if( this.justResumed && this.persistent && this.resumeStrategy === 'auto'
        && this.resumeMode === 'native' && String(code).startsWith('upstream-closed') )
    {
      this.justResumed = false;
      this.relayFallback = true;      // consumed by onRelayClose
      return;
    }

    this.showError(`${this.t.serverError}: ${code}`);
  }

  onRelayClose( event )
  {
    this.log('Relay closed:', event.code, event.reason);

    // Native resume failed — retry once as a handoff, seeded with the summary.
    if( this.relayFallback ) {
      this.relayFallback = false;
      this.teardownConnection();
      this.resuming = true;
      this.resumeMode = 'handoff';
      this.startVoiceAgent();
      return;
    }

    // A live call that ends without a normal close was dropped (connection lost,
    // upstream gone). Say so instead of silently returning to idle — otherwise
    // the mic just stops and the visitor is left guessing.
    const dropped = event.code !== 1000 && this.state !== 'idle';

    // stopVoiceAgent resets the status, so call it BEFORE showing the error.
    if( this.state !== 'idle' )
      this.stopVoiceAgent();

    if( dropped )
      this.showError(`${this.t.serverError}: ${event.code}`);
  }

  /**
   * Build a silent synthetic microphone stream (debug only) so the capture
   * pipeline and the WebSocket/model handshake can run without a real mic. The
   * AI greeting is triggered by a text prompt, so you still hear a response.
   */
  createSimulatedMicStream()
  {
    const dest = this.audioContext.createMediaStreamDestination();
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    gain.gain.value = 0;        // silent - we only need a live audio track
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    this.simOscillator = osc;   // stopped when the audio context closes
    return dest.stream;
  }

  /**
   * Start capturing audio from microphone
   */
  startAudioCapture()
  {
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(this.audioContext.destination);

    processor.onaudioprocess = (e) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.state === 'listening') {
        const audioData = e.inputBuffer.getChannelData(0);

        // Convert Float32Array to Int16Array
        const int16Data = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
        }

        // Convert to base64
        const base64Audio = this.arrayBufferToBase64(int16Data.buffer);

        // Send the bare base64 frame. The Worker wraps it in whatever envelope
        // the current model wants, so this side no longer knows or cares which
        // model generation is in use.
        this.ws.send(base64Audio);
      }
    };
  }

  /**
   * Decode + schedule one audio chunk for gapless playback. Chunks are placed
   * back-to-back on the playback context's clock so there are no gaps between
   * them, even if decode timing jitters (important on slower mobile CPUs).
   */
  scheduleAudioChunk(base64Audio, mimeType, sampleRate)
  {
    if( ! this.playbackContext )
      return;

    try {
      const bytes = this.base64ToBytes(base64Audio);

      if( mimeType.startsWith('audio/pcm') ) {
        // Build the AudioBuffer directly from raw PCM (no WAV, no async decode)
        this.playScheduled(this.pcmToAudioBuffer(bytes, sampleRate));
      }
      else {
        // audio/wav fallback (rare): let the browser decode it. decodeAudioData
        // needs its own ArrayBuffer, hence slice(0).
        this.playbackContext.decodeAudioData(bytes.buffer.slice(0))
          .then(buf => this.playScheduled(buf))
          .catch(err => this.log('decodeAudioData failed:', err));
      }
    }
    catch (error) {
      console.error('Error scheduling audio chunk:', error);
      this.showError(this.t.playFail + ': ' + error.message);
    }
  }

  /**
   * Schedule a decoded AudioBuffer to play immediately after whatever is already
   * queued on the playback clock.
   */
  playScheduled(audioBuffer)
  {
    const ctx = this.playbackContext;
    if( ! ctx )
      return;

    // Entering a new speaking turn
    if( this.state !== 'speaking' ) {
      this.setState('speaking');
      this.updateStatus(this.t.speaking);
      this.turnComplete = false;
    }

    // If the playhead fell behind real time (first chunk or an underrun), restart
    // it slightly in the future to give scheduling some headroom.
    if( this.nextStartTime < ctx.currentTime )
      this.nextStartTime = ctx.currentTime + this.scheduleLead;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;

    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      this.maybeFinishPlayback();
    };
  }

  /**
   * Return to listening once all scheduled audio has played AND the server has
   * signaled turnComplete. Staying in 'speaking' through brief underruns keeps
   * the mic gated so the AI's own voice can't feed back into the input.
   */
  maybeFinishPlayback()
  {
    if( this.activeSources.size === 0 && this.turnComplete && this.state === 'speaking' )
    {
      this.setState('listening');
      this.updateStatus(this.t.listening);
    }
  }

  /**
   * Barge-in: the user started talking while the AI was speaking, so the model
   * abandons its turn and sends serverContent.interrupted. Drop all queued and
   * playing audio at once (it is now stale) and return to listening, instead of
   * draining seconds of buffered speech over the user.
   */
  stopPlayback()
  {
    this.activeSources.forEach(source => {
      try { source.onended = null; source.stop(); }
      catch (e) { /* already ended */ }
    });
    this.activeSources.clear();
    this.nextStartTime = 0;
    this.turnComplete  = true;

    if( this.state === 'speaking' )
    {
      this.setState('listening');
      this.updateStatus(this.t.listening);
    }
  }

  /**
   * Build a mono AudioBuffer directly from raw 16-bit little-endian PCM.
   */
  pcmToAudioBuffer(bytes, sampleRate)
  {
    const sampleCount = Math.floor(bytes.length / 2);
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, sampleCount);

    const buffer = this.playbackContext.createBuffer(1, sampleCount, sampleRate);
    const channel = buffer.getChannelData(0);
    for( let i = 0; i < sampleCount; i++ )
      channel[i] = int16[i] / 32768;

    return buffer;
  }

  /**
   * Decode a base64 string to a Uint8Array
   */
  base64ToBytes(base64)
  {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for( let i = 0; i < len; i++ )
      bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  }

  /**
   * Verbose logging gated behind this.debug (no-op in production)
   */
  log(...args)
  {
    if( this.debug )
      console.log(...args);
  }

  /**
   * Convert ArrayBuffer to base64
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Update agent state
   */
  setState(newState) {
    this.state = newState;

    // Update UI based on state
    if (this.micButton) {
      this.micButton.className = 'voice-agent-mic';
      if (newState !== 'idle') {
        this.micButton.classList.add(newState);
      }
    }

    if (this.statusElement) {
      this.statusElement.className = 'voice-agent-status';
      if (newState !== 'idle') {
        this.statusElement.classList.add(newState);
      }
    }

    // Overlay extras: mirror the state on the collapsed launcher (so its colour
    // pulses while a call is live even when the panel is closed) and update the
    // panel title.
    if( this.overlay )
    {
      if( this.launcher ) {
        // Reset to the base class (preserving the style modifier), then re-apply
        // the call-state class so the launcher keeps pulsing while collapsed.
        this.launcher.className = 'va-launcher' + (this.launcherStyle === 'text' ? ' va-launcher-text' : '');
        if( newState !== 'idle' )
          this.launcher.classList.add(newState);
      }
      if( this.titleEl ) {
        this.titleEl.textContent = (newState === 'resume')
          ? this.t.resumeTitle
          : this.t.panelTitle;
      }
    }
  }

  /**
   * Restore the idle "ready" status under the mic. When a session can be resumed
   * (resume state) this is the resume call-to-action; otherwise the normal start
   * prompt. Used after async work (e.g. loading the config) so it doesn't clobber
   * the resume text with the generic "click to start" message.
   */
  restoreReadyStatus()
  {
    if( this.state === 'resume' )
      this.updateStatus(this.t.resumeHint, 'resume');
    else
      this.updateStatus(this.t.micStart);
  }

  /**
   * Update status message
   */
  updateStatus(message, className = '') {
    if (this.statusElement) {
      this.statusElement.textContent = message;
      // Remove all state classes
      this.statusElement.className = 'voice-agent-status';
      // Add new class if provided
      if (className) {
        this.statusElement.classList.add(className);
      }
    }
  }


  /**
   * Show error message
   */
  showError(message) {
    this.updateStatus(message, 'error');

    // In debug mode keep the message on screen so it can be read on mobile.
    if (this.debug)
      return;

    // Hide after 5 seconds and restore default message
    setTimeout(() => {
      if (this.state === 'idle') {
        this.updateStatus(this.t.micStart);
      }
    }, 5000);
  }

  /**
   * Show fallback message for unsupported browsers
   */
  showFallback() {
    this.updateStatus(this.t.unsupported, 'fallback');

    // Hide the main UI
    if (this.micButton) {
      this.micButton.style.display = 'none';
    }
  }

  /**
   * Show maintenance message when service is down
   */
  showMaintenance()
  {
    this.setState('maintenance');
    this.updateStatus(this.t.maintenance, 'maintenance');

    // Disable the microphone button
    if( this.micButton )
    {
      this.micButton.disabled = true;
      this.micButton.style.cursor = 'not-allowed';
    }
  }

  // =========================================================================
  // Persistent overlay (config.persistentAgent === true)
  // =========================================================================

  /**
   * Entry point for the always-on overlay. Builds its own bottom-right widget
   * (so it works on every page, not just the #about section), binds it, and —
   * if a conversation was active just before a cross-page navigation — shows the
   * "resume" state instead of plain idle.
   */
  initOverlay()
  {
    if( ! this.checkBrowserSupport() )
      return false;

    this.buildOverlay();
    this.setupEventListeners();   // binds the mic button (this.micButton)

    if( this.config.downForService ) {
      this.showMaintenance();
      return false;
    }

    this.updateStatus(this.t.hint);
    this.installNavHook();
    this.checkResumeState();
    return true;
  }

  /**
   * Create the overlay DOM (collapsed launcher + chat-style panel) and append it
   * to <body>. We hold direct element references instead of using getElementById
   * so this never collides with the legacy #about widget, regardless of which
   * script's DOMContentLoaded handler runs first.
   */
  buildOverlay()
  {
    const overlay = document.createElement('div');
    overlay.className = 'va-overlay';

    // Footer with runtime toggle switches (transcript / auto-nav). Rendered only
    // when at least one is enabled in config; each switch starts from its setting's
    // current value and is a per-session override (see onSwitchToggle). The nav
    // switch only makes sense when the navigate tool actually exists.
    const showNavSwitch = this.enableNavTool && this.showNavToggle;
    const footerHtml = (this.showTranscriptToggle || showNavSwitch)
      ? '<div class="va-footer">' +
          (this.showTranscriptToggle ? this.switchHtml('transcript', this.t.toggleTranscript, this.showTranscript, this.t.toggleTranscriptHint) : '') +
          (showNavSwitch ? this.switchHtml('nav', this.t.toggleNav, this.navMode === 'auto', this.t.toggleNavHint) : '') +
        '</div>'
      : '';

    overlay.innerHTML =
      '<div class="va-panel" role="dialog" aria-hidden="true" aria-label="' + this.escapeAttr(this.t.panelTitle) + '">' +
        '<div class="va-panel-header">' +
          '<span class="va-panel-title"></span>' +
          '<button type="button" class="va-panel-close" aria-label="' + this.escapeAttr(this.t.closeAria) + '">&times;</button>' +
        '</div>' +
        '<div class="va-panel-body">' +
          (this.config.trying ? '<div class="va-trying">' + this.escapeHtml(this.t.trying) + '</div>' : '') +
          '<button type="button" class="voice-agent-mic" aria-label="' + this.escapeAttr(this.t.panelTitle) + '">' +
            '<i class="fas fa-microphone" aria-hidden="true"></i>' +
          '</button>' +
          '<div class="voice-agent-status"></div>' +
          // Build the transcript element when it's shown OR a footer switch can reveal it.
          ((this.showTranscript || this.showTranscriptToggle)
            ? '<div class="voice-agent-transcript' + (this.showTranscript ? '' : ' va-hidden') + '"></div>'
            : '') +
          '<div class="va-link-insert"></div>' +
          '<p class="va-example">' + this.escapeHtml(this.t.example) +
            (this.enableNavTool ? '<br>' + this.escapeHtml(this.t.exampleNav) : '') +
          '</p>' +
          footerHtml +
        '</div>' +
      '</div>' +
      '<button type="button" class="va-launcher' +
          (this.launcherStyle === 'text' ? ' va-launcher-text' : '') +
          '" aria-label="' + this.escapeAttr(this.t.openAria) + '">' +
        (this.launcherStyle === 'text'
          ? '<span class="va-launcher-label">' + this.escapeHtml(this.t.launcherText) + '</span>'
          : '') +
        '<i class="fas fa-microphone" aria-hidden="true"></i>' +
      '</button>';

    document.body.appendChild(overlay);

    // Cache references used by setState / updateStatus / nav rendering
    this.overlay       = overlay;
    this.panel         = overlay.querySelector('.va-panel');
    this.launcher      = overlay.querySelector('.va-launcher');
    this.titleEl       = overlay.querySelector('.va-panel-title');
    this.linkSlot      = overlay.querySelector('.va-link-insert');
    this.micButton     = overlay.querySelector('.voice-agent-mic');
    this.statusElement = overlay.querySelector('.voice-agent-status');
    this.transcriptEl  = overlay.querySelector('.voice-agent-transcript');

    this.titleEl.textContent = this.t.panelTitle;

    // Launcher toggles the panel; the X collapses it (without ending a live call)
    this.launcher.addEventListener('click', () => this.togglePanel());
    this.panel.querySelector('.va-panel-close').addEventListener('click', () => this.closePanel());

    // Footer switches (present only when enabled): each flips its runtime setting
    this.panel.querySelectorAll('.va-switch').forEach(btn =>
      btn.addEventListener('click', () => this.onSwitchToggle(btn)));
  }

  /** Markup for one footer toggle (role="switch"); `on` sets the initial state. */
  switchHtml( key, label, on, title )
  {
    return '<button type="button" class="va-switch" role="switch" data-switch="' + key + '"' +
      ' aria-checked="' + (on ? 'true' : 'false') + '" title="' + this.escapeAttr(title) + '">' +
        '<span class="va-switch-label">' + this.escapeHtml(label) + '</span>' +
        '<span class="va-switch-track"><span class="va-switch-thumb"></span></span>' +
      '</button>';
  }

  /**
   * Flip a footer switch. Transcript toggles instantly (show/hide the element);
   * auto-nav flips this.navMode, which the navigate tool result reads on its next
   * call (and runtimeInstructionNote on the next connect). Per session, not saved.
   */
  onSwitchToggle( btn )
  {
    const on = btn.getAttribute('aria-checked') !== 'true';   // flip current
    btn.setAttribute('aria-checked', on ? 'true' : 'false');

    if( btn.dataset.switch === 'transcript' )
    {
      this.showTranscript = on;
      if( this.transcriptEl )
        this.transcriptEl.classList.toggle('va-hidden', ! on);
    }
    else if( btn.dataset.switch === 'nav' )
      this.navMode = on ? 'auto' : 'link';
  }

  /**
   * Public API for the host site: open the assistant (overlay panel) on demand,
   * e.g. from a site-specific button. The reusable agent only exposes this
   * method; how/where it is triggered is the site's concern (see
   * controller.initPersistentAgent). No-op unless the persistent overlay exists.
   */
  open()
  {
    this.openPanel();
  }

  togglePanel()
  {
    if( this.overlay && this.overlay.classList.contains('open') )
      this.closePanel();
    else
      this.openPanel();
  }

  openPanel()
  {
    if( ! this.overlay )
      return;
    this.overlay.classList.add('open');
    this.panel.setAttribute('aria-hidden', 'false');
  }

  closePanel()
  {
    if( ! this.overlay )
      return;
    this.overlay.classList.remove('open');
    this.panel.setAttribute('aria-hidden', 'true');
  }

  // ---- Cross-page resume ---------------------------------------------------

  /**
   * On a fresh page load, decide whether to offer "Resume conversation". Only if
   * a session was flagged active just before navigation, it's recent enough, and
   * the page language matches (we never auto-resume across a DE/EN switch).
   */
  checkResumeState()
  {
    const flagged = this.getStored('va:resume') === '1';
    const ts      = parseInt(this.getStored('va:ts') || '0', 10);
    const lang    = this.getStored('va:lang');
    const fresh   = ts > 0 && (Date.now() - ts) <= this.resumeMaxAgeMin * 60 * 1000;

    if( flagged && fresh && lang === this.lang ) {
      this.setState('resume');
      this.restoreReadyStatus();
      this.openPanel();   // surface the resume button (also loads config)
    } else {
      // A session was flagged but is now too old to resume (> resumeMaxAgeMin):
      // tell the visitor it lapsed instead of silently showing the plain hint.
      // (A language switch isn't an expiry, so only the stale-by-time case.)
      const expired = flagged && ! fresh;
      this.clearSession();
      this.setState('idle');
      this.updateStatus(expired ? this.t.expired : this.t.hint);
    }
  }

  /**
   * Resume a conversation after a page load. Tries native Gemini Live session
   * resumption when a handle is available and the strategy allows it; otherwise
   * (or on failure, via the onclose fallback) seeds a fresh session.
   */
  async resumeSession()
  {
    const handle    = this.getStored('va:handle');
    const canNative = this.resumeStrategy !== 'handoff' && !!handle;

    this.resuming   = true;
    this.resumeMode = canNative ? 'native' : 'handoff';
    this.justResumed = canNative;        // watched by the onclose fallback

    // Consume the resume flag so a failed attempt can't loop on reload
    this.setStored('va:resume', '0');

    await this.startVoiceAgent();
  }

  /**
   * Handoff fallback: instead of the greeting, seed the fresh session with a
   * short summary of the prior conversation and tell the model to continue.
   */
  sendHandoffSeed()
  {
    if( ! this.ws || this.ws.readyState !== WebSocket.OPEN )
      return;

    const summary = this.buildSummary() || this.getStored('va:summary') || '';

    // Send only the summary — it is the visitor's own conversation, and the
    // Worker holds no state across page loads. The framing wording stays there.
    if( summary )
      this.ws.send(JSON.stringify({ t: 'seed', s: summary }));
    const seed = this.isDe
      ? '(Kontext des laufenden Gesprächs: ' + summary + ') Mach natürlich weiter; begrüße mich nicht noch einmal.'
      : '(Context of the ongoing conversation: ' + summary + ') Continue naturally; do not greet again.';

    this.ws.send(JSON.stringify({
      clientContent: { turns: [{ role: 'user', parts: [{ text: seed }] }], turnComplete: true }
    }));
  }

  /** Keep a short rolling transcript (last ~12 turns) for the handoff seed. */
  noteTranscript( role, text )
  {
    if( ! this.persistent || ! text )
      return;
    this.transcript.push({ role, text });
    if( this.transcript.length > 12 )
      this.transcript = this.transcript.slice(-12);
  }

  // ---- Live transcript under the mic ---------------------------------------

  /**
   * Add a streamed transcription delta to the on-screen transcript. The Live API
   * sends many small chunks per turn, so we accumulate them into one utterance
   * and finalize it when the speaker changes ('user' <-> 'ai').
   */
  appendTranscript( role, chunk )
  {
    if( ! this.showTranscript || ! this.transcriptEl || ! chunk )
      return;

    // Start a new utterance when the speaker changes, or when the previous turn
    // finished (so two turns from the same role don't merge into one line). The
    // finished text stays on screen until the next chunk actually arrives.
    if( role !== this.transcriptRole || this.transcriptTurnDone )
    {
      // Bank the previous utterance (rolling mode keeps the last few).
      if( this.transcriptRole && this.transcriptText )
      {
        this.transcriptTurns.push({ role: this.transcriptRole, text: this.transcriptText });
        if( this.transcriptTurns.length > this.transcriptLast )
          this.transcriptTurns = this.transcriptTurns.slice(-this.transcriptLast);
      }
      this.transcriptRole = role;
      this.transcriptText = '';
      this.transcriptTurnDone = false;
    }

    this.transcriptText += chunk;
    this.renderTranscript();
  }

  /** Render the transcript element: just the live utterance, or the last N turns. */
  renderTranscript()
  {
    if( ! this.transcriptEl )
      return;

    const live = { role: this.transcriptRole, text: this.transcriptText };
    const turns = ((this.transcriptMode === 'rolling')
      ? this.transcriptTurns.concat(this.transcriptText ? [live] : [])
      : (this.transcriptText ? [live] : []))
      // Optionally hide the user's own speech (agent-only transcript).
      .filter(t => this.transcriptShowUser || t.role !== 'user');

    this.transcriptEl.innerHTML = turns.map(t =>
      '<div class="va-tr-line va-tr-' + t.role + '">' +
        '<i class="fas ' + (t.role === 'user' ? 'fa-user' : 'fa-robot') + '" aria-hidden="true"></i>' +
        '<span>' + this.escapeHtml(t.text) + '</span>' +
      '</div>'
    ).join('');

    // Keep the newest line in view (matters in rolling mode).
    this.transcriptEl.scrollTop = this.transcriptEl.scrollHeight;
  }

  /** Clear the transcript (no persistence): called when a new call starts. */
  resetTranscript()
  {
    this.transcriptRole  = null;
    this.transcriptText  = '';
    this.transcriptTurns = [];
    this.transcriptTurnDone = false;
    if( this.transcriptEl )
      this.transcriptEl.innerHTML = '';
  }

  /** Compose a compact summary string from the rolling transcript. */
  buildSummary()
  {
    const lines = this.transcript.map(t => (t.role === 'user' ? 'User: ' : 'AI: ') + t.text);
    let s = lines.join('\n');
    if( s.length > 1500 )
      s = '…' + s.slice(-1500);
    return s;
  }

  /** Flag the session live so a navigation can offer to resume it. */
  persistActive()
  {
    this.setStored('va:active', '1');
    this.setStored('va:lang', this.lang);
    this.setStored('va:ts', String(Date.now()));
  }

  /** Persist resume intent + summary right before leaving the page. */
  persistResume()
  {
    this.setStored('va:resume', '1');
    this.setStored('va:lang', this.lang);
    this.setStored('va:ts', String(Date.now()));
    this.setStored('va:summary', this.buildSummary());
  }

  clearSession()
  {
    ['va:active', 'va:resume', 'va:handle', 'va:lang', 'va:summary', 'va:ts']
      .forEach(k => this.removeStored(k));
  }

  /**
   * Close the WebSocket + audio without touching state or resume data — used by
   * the native→handoff fallback, which must keep the stored summary/transcript.
   */
  teardownConnection()
  {
    try { if (this.ws) this.ws.close(); } catch (e) {}
    this.ws = null;
    try { if (this.mediaStream) this.mediaStream.getTracks().forEach(t => t.stop()); } catch (e) {}
    this.mediaStream = null;
    this.activeSources.forEach(s => { try { s.stop(); } catch (e) {} });
    this.activeSources.clear();
    this.nextStartTime = 0;
    this.turnComplete = true;
    try { if (this.audioContext) this.audioContext.close(); } catch (e) {}
    try { if (this.playbackContext) this.playbackContext.close(); } catch (e) {}
    this.audioContext = null;
    this.playbackContext = null;
  }

  /**
   * Before any internal cross-page navigation while a call is live, persist the
   * resume state so the next page can offer "Resume conversation". A delegated
   * capture-phase listener covers every internal <a> click. Same-page hash links
   * never reload, so the live session just continues — no resume needed.
   */
  installNavHook()
  {
    document.addEventListener('click', (e) => {
      if( ! this.persistent )
        return;
      if( this.state !== 'listening' && this.state !== 'speaking' )
        return;

      const a = e.target.closest ? e.target.closest('a[href]') : null;
      if( ! a || a.target === '_blank' )
        return;

      let url;
      try { url = new URL(a.getAttribute('href'), location.href); }
      catch (err) { return; }

      if( url.origin !== location.origin )
        return;                         // external link
      if( url.pathname === location.pathname )
        return;                         // same page (hash scroll) — session lives on

      this.navigating = true;
      this.persistResume();
    }, true);

    // Safety net for programmatic navigations while a call is live.
    window.addEventListener('pagehide', () => {
      if( this.persistent && ! this.navigating &&
          (this.state === 'listening' || this.state === 'speaking') )
        this.persistResume();
    });
  }

  // ---- sessionStorage helpers (per-tab; tolerant of privacy mode) ----------

  getStored( key )    { try { return sessionStorage.getItem(key); } catch (e) { return null; } }
  setStored( key, v ) { try { sessionStorage.setItem(key, v); } catch (e) {} }
  removeStored( key ) { try { sessionStorage.removeItem(key); } catch (e) {} }

  // ---- Navigate tool (config.enableNavTool === true) -----------------------

  /**
   * Single entry point for showing destinations sent by the Worker.
   * Items are {u,l}: a site-root-relative URL and a human breadcrumb.
   * More than one option is always a pickable list — we never auto-move then.
   */
  showNav( items, auto )
  {
    if( ! Array.isArray(items) || ! items.length )
      return;

    if( items.length > 1 )
      this.renderNavLinkList( items );
    else if( auto )
      this.autoNavigate( items[0] );
    else
      this.renderNavLink( items[0] );
  }

  /** 'auto' mode: persist resume state, then move the page. */
  autoNavigate( item )
  {
    this.navigating = true;
    this.persistResume();
    location.href = this.siteRootPrefix() + item.u;
  }

  /** 'link' mode (single target): render one clickable breadcrumb; never auto-move. */
  renderNavLink( item )
  {
    if( ! this.linkSlot )
      return;

    this.openPanel();

    this.linkSlot.innerHTML = '';
    const intro = document.createElement('div');
    intro.className = 'va-link-intro';
    intro.textContent = this.t.linkIntro;

    this.linkSlot.appendChild(intro);
    this.linkSlot.appendChild(this.buildNavAnchor(item));
    this.linkSlot.classList.add('show');
  }

  /**
   * Several targets: render a scrollable list of links and let the visitor pick
   * (used in both nav modes — we never auto-move when there is more than one
   * option). Invalid targets are dropped by whoever produced the items.
   */
  renderNavLinkList( items )
  {
    if( ! this.linkSlot )
      return;

    this.openPanel();

    this.linkSlot.innerHTML = '';
    const intro = document.createElement('div');
    intro.className = 'va-link-intro';
    intro.textContent = this.t.linkIntroMulti;

    const list = document.createElement('div');
    list.className = 'va-link-list';
    items.forEach(item => list.appendChild(this.buildNavAnchor(item)));

    this.linkSlot.appendChild(intro);
    this.linkSlot.appendChild(list);
    this.linkSlot.classList.add('show');
  }

  /** Build a single .va-nav-link anchor from a {u,l} item. */
  buildNavAnchor( item )
  {
    const a = document.createElement('a');
    a.className = 'va-nav-link';
    a.href = this.siteRootPrefix() + item.u;
    const span = document.createElement('span');
    span.textContent = item.l;
    a.appendChild(span);
    a.insertAdjacentHTML('beforeend', '<i class="fas fa-arrow-right" aria-hidden="true"></i>');
    return a;
  }

  /**
   * Prefix that turns a site-root-relative URL into one valid at this page's
   * depth. The logo link points to the current language's root, from which the
   * site root is derived (EN pages need one extra "../", since /en/ is a level
   * deeper). Stays client-side: it needs the DOM.
   */
  siteRootPrefix()
  {
    const logo = document.querySelector('.logo a');
    const langRootPrefix = (logo ? logo.getAttribute('href') : '')
      .replace(/index\.html$/, '').replace(/^#$/, '');
    return this.isDe ? langRootPrefix : langRootPrefix + '../';
  }

  // ---- small escaping helpers ----------------------------------------------

  escapeHtml( s )
  {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  escapeAttr( s )
  {
    return this.escapeHtml(s).replace(/"/g, '&quot;');
  }
}

// Initialize voice agent when DOM is ready. All settings come from
// VOICE_AGENT_CONFIG (lib/config.js), passed in here at init.
//   persistentAgent:true  -> always-on overlay, built on every page.
//   persistentAgent:false -> legacy in-#about widget (index pages only); on
//                            pages without that widget this is a no-op.
document.addEventListener('DOMContentLoaded', async () => {
  const voiceAgent = new VoiceAgent(VOICE_AGENT_CONFIG);
  // Expose the instance so site-specific code (controller.js) can drive the
  // reusable agent through its public API, e.g. voiceAgent.open() from a hero CTA.
  window.voiceAgent = voiceAgent;
  if( voiceAgent.persistent )
    voiceAgent.initOverlay();
  else if( document.getElementById('voice-agent-mic') )
    await voiceAgent.init();
});
