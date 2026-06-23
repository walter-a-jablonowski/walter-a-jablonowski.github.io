/**
 * Google AI Studio Voice Agent
 * Implements real-time voice interaction using Gemini 2.5 Flash Live API
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

    // Overlay DOM refs (built in buildOverlay when persistent)
    this.overlay   = null;
    this.launcher  = null;
    this.panel     = null;
    this.titleEl   = null;
    this.linkSlot  = null;

    this.configLoaded = false;   // session config fetched lazily on first open
    this.configLoading = null;   // in-flight loadSessionConfig promise (dedupe)
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
    this.sessionConfig = null;   // Session config from Cloudflare Worker

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
      configFail:  'Konfiguration konnte nicht geladen werden',
      configLoad:  'Konfiguration wird geladen …',
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
      example:     'z. B. „Kann Walter KI-Features für mich bauen?“',
      openAria:    'KI-Assistentin öffnen',
      closeAria:   'Schließen',
      resumeTitle: 'Gespräch fortsetzen?',
      resumeLabel: 'Gespräch fortsetzen',
      resumeHint:  'Wir machen dort weiter, wo Sie aufgehört haben.',
      linkIntro:   'Das finden Sie hier:'
    } : {
      micStart:    'Click the microphone to start',
      initFail:    'Failed to initialize voice agent',
      configFail:  'Failed to load configuration',
      configLoad:  'Loading configuration...',
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
      example:     'e.g. "Can Walter build AI features for me?"',
      openAria:    'Open AI assistant',
      closeAria:   'Close',
      resumeTitle: 'Continue?',
      resumeLabel: 'Resume conversation',
      resumeHint:  "We'll pick up where you left off.",
      linkIntro:   'You can find that here:'
    };
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

      // Check if service is down for maintenance
      if( this.config.downForService )
      {
        this.showMaintenance();
        return false;
      }

      // Load session config from Cloudflare Worker
      await this.loadSessionConfig();

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
   * Load session configuration from Cloudflare Worker
   * This includes system instruction with context, model name, and greeting message
   */
  async loadSessionConfig()
  {
    // Already have it, or a fetch is already in flight (overlay loads lazily on
    // first open, so guard against firing the request twice).
    if( this.configLoaded )
      return;
    if( this.configLoading )
      return this.configLoading;

    this.configLoading = this._fetchSessionConfig();
    try {
      await this.configLoading;
    } finally {
      this.configLoading = null;
    }
  }

  async _fetchSessionConfig()
  {
    try {
      this.updateStatus(this.t.configLoad, 'loading');

      const response = await fetch(this.config.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'get_session_config'
        })
      });

      if( ! response.ok )
        throw new Error(`Failed to load session config: ${response.statusText}`);

      const data = await response.json();
      
      if( ! data.success )
        throw new Error(data.error || 'Invalid session config response');

      this.sessionConfig = data;
      this.configLoaded = true;

      console.log('Session config loaded successfully');
      this.updateStatus(this.t.micStart);
    } catch (error) {
      console.error('Error loading session config:', error);
      this.showError(this.t.configFail);
      throw error;
    }
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
      // Check proxy URL
      if (!this.config.proxyUrl || this.config.proxyUrl.includes('YOUR-PHP-SERVER')) {
        this.showError('Please configure your PHP proxy URL in lib/config.js');
        return;
      }

      // The overlay loads the session config lazily (on first open), so make sure
      // it is available before we try to connect.
      if( ! this.configLoaded )
        await this.loadSessionConfig();

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
      await this.connectWebSocket();

      // Greeting handling depends on whether we are resuming a prior session:
      //  - fresh start  -> normal greeting prompt
      //  - native resume-> skip greeting; the model still has the context
      //  - handoff      -> seed a summary instead of greeting
      if( ! this.resuming )
        this.sendGreetingPrompt();
      else if( this.resumeMode === 'handoff' )
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

  /**
   * Connect to Google AI Studio Multimodal Live API via WebSocket
   */
  async connectWebSocket()
  {
    return new Promise(async (resolve, reject) => {
      
      // Check if session config is loaded
      if( ! this.sessionConfig || ! this.sessionConfig.websocket_url )
      {
        reject(new Error('Session config not loaded'));
        return;
      }
      
      const wsUrl = this.sessionConfig.websocket_url;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');

        // Send initial setup message with system instructions from Worker
        const instructionText = this.sessionConfig.system_instruction
          + this.pageLanguageNote()
          + (this.enableNavTool ? this.navInstructionNote() : '');

        const setupMessage = {
          setup: {
            model: `models/${this.sessionConfig.model}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Aoede'
                  }
                }
              }
            },
            systemInstruction: {
              parts: [{ text: instructionText }]
            },
            // Enable transcription for language detection
            // #lang-detect-added (moved to setup level, not generationConfig)
            inputAudioTranscription: {},
            outputAudioTranscription: {}
          }
        };

        // Cross-page session resumption (persistent overlay). Always enable so
        // the server issues handles; pass a stored handle when reconnecting.
        if( this.persistent && this.resumeStrategy !== 'handoff' )
        {
          const handle = this.resuming ? this.getStored('va:handle') : null;
          setupMessage.setup.sessionResumption = handle ? { handle } : {};
        }

        // Optional navigate tool (LLM function-calling) — same declaration in
        // both nav modes; only the client's reaction to the call differs.
        if( this.enableNavTool )
          setupMessage.setup.tools = [{ functionDeclarations: [this.navToolDeclaration()] }];

        console.log('Sending setup message:', {
          model: setupMessage.setup.model,
          responseModalities: setupMessage.setup.generationConfig.responseModalities,
          voice: setupMessage.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,
          transcription: 'enabled (input + output)',
          systemInstructionLength: this.sessionConfig.system_instruction.length
        });
        this.ws.send(JSON.stringify(setupMessage));
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onmessage = async (event) => {

        // Handle binary Blob messages
        let messageText;
        if( event.data instanceof Blob )
          messageText = await event.data.text();
        else
          messageText = event.data;

        this.handleWebSocketMessage(messageText);
      };

      this.ws.onclose = (event) => {
        this.log('WebSocket closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });

        // Native session resumption failed before it could connect (the handle
        // expired or fell outside the window). In 'auto' mode, silently start a
        // fresh session seeded with the transcript instead of erroring out.
        if( this.justResumed && this.persistent && this.resumeStrategy === 'auto'
            && this.resumeMode === 'native' && event.code !== 1000 )
        {
          this.justResumed = false;
          this.log('Native resume failed — falling back to handoff');
          this.teardownConnection();
          this.resuming = true;
          this.resumeMode = 'handoff';
          this.startVoiceAgent();
          return;
        }

        // Map common close codes to a hint
        let hint = '';
        if (event.code === 1006) hint = 'connection lost';
        else if (event.code === 1008) hint = 'policy violation - check API key and model name';
        else if (event.code === 1011) hint = 'server error - invalid setup / model';

        // stopVoiceAgent resets the status, so call it BEFORE showing the error
        if (this.state !== 'idle')
          this.stopVoiceAgent();

        // Surface non-normal closures on screen, so the failure is visible on
        // mobile without devtools (e.g. wrong/unsupported model gives 1007/1008/1011).
        if (event.code !== 1000) {
          const detail = [event.code, event.reason, hint].filter(Boolean).join(' - ');
          this.showError(`${this.t.serverError}: WebSocket closed (${detail})`);
        }
      };
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleWebSocketMessage(data)
  {
    try {
      const message = JSON.parse(data);
      this.log('Received WebSocket message:', message);

      // Handle setup complete
      if( message.setupComplete ) {
        this.log('Setup complete, ready to receive audio');
        this.justResumed = false;   // a native resume (if any) connected cleanly
        return;
      }

      // Native session-resumption handle (persistent overlay). Store the latest
      // resumable handle so a cross-page reload can reconnect to this session.
      if( message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle ) {
        this.setStored('va:handle', message.sessionResumptionUpdate.newHandle);
        this.setStored('va:ts', String(Date.now()));
        this.log('Stored session resumption handle');
      }

      // Navigate tool call (only when enableNavTool). The model asks to point the
      // user somewhere; we either navigate (auto) or render a link (link mode).
      if( message.toolCall ) {
        this.handleToolCall(message.toolCall);
        return;
      }

      // Handle errors
      if( message.error ) {
        console.error('Server error:', message.error);
        this.showError(`${this.t.serverError}: ${message.error.message || 'Unknown error'}`);
        this.stopVoiceAgent();
        return;
      }

      // Transcriptions (language detection / debugging). Also accumulated into a
      // compact running transcript used to seed a fresh session in the handoff
      // resume fallback (persistent overlay).
      // #lang-detect-added
      if( message.serverContent?.inputTranscription ) {
        this.log('🎤 User transcription:', message.serverContent.inputTranscription.text);
        this.noteTranscript('user', message.serverContent.inputTranscription.text);
      }
      if( message.serverContent?.outputTranscription ) {
        this.log('🔊 AI transcription:', message.serverContent.outputTranscription.text);
        this.noteTranscript('ai', message.serverContent.outputTranscription.text);
      }

      // Handle server content (audio response)
      if( message.serverContent )
      {
        const parts = message.serverContent.modelTurn?.parts || [];

        parts.forEach((part) => {

          // Handle audio data - support audio/pcm and audio/wav
          if( part.inlineData )
          {
            const mimeType = part.inlineData.mimeType;
            // mime type may include parameters like ;rate=24000
            if (mimeType.startsWith('audio/pcm') || mimeType.startsWith('audio/wav')) {
              const sampleRateMatch = mimeType.match(/rate=(\d+)/);
              const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1]) : 24000;

              // Schedule immediately for gapless playback (don't wait on onended)
              this.scheduleAudioChunk(part.inlineData.data, mimeType, sampleRate);
            }
            else
              this.log('Unsupported audio mime type:', mimeType);
          }

          // Handle text data (for debugging)
          if( part.text )
            this.log('Assistant:', part.text);
        });

        // Turn finished generating. Return to listening only once the already
        // scheduled audio has fully drained (see maybeFinishPlayback).
        if( message.serverContent.turnComplete ) {
          this.log('Turn complete');
          this.turnComplete = true;
          if( this.activeSources.size === 0 ) {
            this.setState('listening');
            this.updateStatus(this.t.listening);
          }
        }
      }

    }
    catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
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

        // Send audio data to API. The format depends on the model the worker
        // selected (use_legacy_input): the Gemini 2.5 native-audio model uses the
        // legacy realtimeInput.mediaChunks; Gemini 3.1 Live requires the newer
        // realtimeInput.audio (mediaChunks was removed -> close code 1007).
        let message;
        if (this.sessionConfig.use_legacy_input) {
          message = {
            realtimeInput: {
              mediaChunks: [{ mimeType: 'audio/pcm', data: base64Audio }]
            }
          };
        } else {
          message = {
            realtimeInput: {
              audio: { mimeType: 'audio/pcm;rate=16000', data: base64Audio }
            }
          };
        }

        this.ws.send(JSON.stringify(message));
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
   * Tell the model which language version of the site the visitor is on, so it
   * opens in that language (the template references "the current page").
   */
  pageLanguageNote()
  {
    return this.isDe
      ? '\n\n# Current page\nThe visitor is on the GERMAN version of the website. Greet and respond in German until they clearly switch to English.'
      : '\n\n# Current page\nThe visitor is on the ENGLISH version of the website. Greet and respond in English until they clearly switch to German.';
  }

  /**
   * Send initial greeting prompt to trigger AI greeting
   */
  sendGreetingPrompt()
  {
    if( ! this.ws || this.ws.readyState !== WebSocket.OPEN )
    {
      console.error('No WebSocket ready for greeting prompt');
      return;
    }

    // Pick the greeting prompt for the current page language so the assistant
    // opens in the visitor's language instead of always starting in German.
    const greetingText = this.isDe
      ? this.sessionConfig.greeting_message_de
      : this.sessionConfig.greeting_message_en;

    if( ! greetingText )
    {
      console.error('No greeting message in session config');
      return;
    }

    const greetingMessage = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text: greetingText }]
        }],
        turnComplete: true
      }
    };

    console.log('Sending greeting prompt to AI');
    this.ws.send(JSON.stringify(greetingMessage));
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
        this.launcher.className = 'va-launcher';
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

    overlay.innerHTML =
      '<div class="va-panel" role="dialog" aria-hidden="true" aria-label="' + this.escapeAttr(this.t.panelTitle) + '">' +
        '<div class="va-panel-header">' +
          '<span class="va-panel-title"></span>' +
          '<button type="button" class="va-panel-close" aria-label="' + this.escapeAttr(this.t.closeAria) + '">&times;</button>' +
        '</div>' +
        '<div class="va-panel-body">' +
          '<div class="va-link-slot"></div>' +
          '<button type="button" class="voice-agent-mic" aria-label="' + this.escapeAttr(this.t.panelTitle) + '">' +
            '<i class="fas fa-microphone" aria-hidden="true"></i>' +
          '</button>' +
          '<div class="voice-agent-status"></div>' +
          '<p class="va-example">' + this.escapeHtml(this.t.example) + '</p>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="va-launcher" aria-label="' + this.escapeAttr(this.t.openAria) + '">' +
        '<i class="fas fa-microphone" aria-hidden="true"></i>' +
      '</button>';

    document.body.appendChild(overlay);

    // Cache references used by setState / updateStatus / nav rendering
    this.overlay       = overlay;
    this.panel         = overlay.querySelector('.va-panel');
    this.launcher      = overlay.querySelector('.va-launcher');
    this.titleEl       = overlay.querySelector('.va-panel-title');
    this.linkSlot      = overlay.querySelector('.va-link-slot');
    this.micButton     = overlay.querySelector('.voice-agent-mic');
    this.statusElement = overlay.querySelector('.voice-agent-status');

    this.titleEl.textContent = this.t.panelTitle;

    // Launcher toggles the panel; the X collapses it (without ending a live call)
    this.launcher.addEventListener('click', () => this.togglePanel());
    this.panel.querySelector('.va-panel-close').addEventListener('click', () => this.closePanel());
  }

  togglePanel()
  {
    if( this.overlay && this.overlay.classList.contains('open') )
      this.closePanel();
    else
      this.openPanel();
  }

  openPanel( loadCfg = true )
  {
    if( ! this.overlay )
      return;
    this.overlay.classList.add('open');
    this.panel.setAttribute('aria-hidden', 'false');

    // Fetch the session config lazily, the first time the panel is opened, so we
    // don't POST to the Worker on every page load across the whole site.
    if( loadCfg && ! this.configLoaded && ! this.config.downForService )
      this.loadSessionConfig().catch(() => {});
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
      this.updateStatus(this.t.resumeHint, 'resume');
      this.openPanel();   // surface the resume button (also loads config)
    } else {
      this.clearSession();
      this.setState('idle');
      this.updateStatus(this.t.hint);
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
   * Destinations the navigate tool can surface. URLs are site-root-relative per
   * language; resolveTargetUrl() prefixes them for the current page depth. path
   * is the human breadcrumb shown in 'link' mode.
   */
  navTargets()
  {
    return [
      { id: 'services',       url: { de: 'index.html#services', en: 'en/index.html#services' },
        path: { de: 'Leistungen', en: 'Services' } },
      { id: 'automation',     url: { de: 'pages/services/automation.html', en: 'en/pages/services/automation.html' },
        path: { de: 'Leistungen > Automatisierung', en: 'Services > Automation' } },
      { id: 'self-improving', url: { de: 'pages/services/self-improving.html', en: 'en/pages/services/self-improving.html' },
        path: { de: 'Leistungen > Selbstverbessernde KI', en: 'Services > Self-improving AI' } },
      { id: 'data-solutions', url: { de: 'pages/services/data-solutions.html', en: 'en/pages/services/data-solutions.html' },
        path: { de: 'Leistungen > KI-Datenlösungen', en: 'Services > AI Data Solutions' } },
      { id: 'consulting',     url: { de: 'pages/services/consulting.html', en: 'en/pages/services/consulting.html' },
        path: { de: 'Leistungen > KI-Beratung', en: 'Services > AI Consulting' } },
      { id: 'security',       url: { de: 'pages/services/security.html', en: 'en/pages/services/security.html' },
        path: { de: 'Leistungen > KI-Sicherheit', en: 'Services > AI Security' } },
      { id: 'offer',          url: { de: 'pages/offers/offer.html', en: 'en/pages/offers/offer.html' },
        path: { de: 'Angebot', en: 'Offer' } },
      { id: 'projects',       url: { de: 'index.html#proj', en: 'en/index.html#proj' },
        path: { de: 'Projekte', en: 'Projects' } },
      { id: 'contact',        url: { de: 'index.html#contact', en: 'en/index.html#contact' },
        path: { de: 'Kontakt', en: 'Contact' } }
    ];
  }

  /** Function declaration sent in setup.tools when enableNavTool is true. */
  navToolDeclaration()
  {
    return {
      name: 'navigate',
      description: 'Point the visitor to the most relevant page or section of this website.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', enum: this.navTargets().map(t => t.id),
                    description: 'Which destination to surface.' }
        },
        required: ['target']
      }
    };
  }

  /** System-instruction wording appended client-side, depending on navMode. */
  navInstructionNote()
  {
    const ids = this.navTargets().map(t => t.id).join(', ');
    if( this.navMode === 'auto' )
      return '\n\n# Navigation\nYou can navigate the site with the `navigate` tool (targets: ' + ids +
             '). When a section would help, briefly offer to take the visitor there and ask first; ' +
             'only call `navigate` after they confirm.';
    return '\n\n# Navigation\nYou can point visitors to the right place with the `navigate` tool ' +
           '(targets: ' + ids + '). When a section answers their question, call `navigate` to show ' +
           'them the link and tell them they can click it. Do NOT claim you will move the page yourself.';
  }

  /** Handle a navigate tool call from the model (both nav modes). */
  handleToolCall( toolCall )
  {
    const calls = toolCall.functionCalls || [];
    calls.forEach((fc) => {
      if( fc.name === 'navigate' ) {
        const id = fc.args && fc.args.target;
        if( this.navMode === 'auto' )
          this.autoNavigate(id);
        else
          this.renderNavLink(id);
      }
      this.sendToolResponse(fc);
    });
  }

  sendToolResponse( fc )
  {
    if( ! this.ws || this.ws.readyState !== WebSocket.OPEN )
      return;
    this.ws.send(JSON.stringify({
      toolResponse: { functionResponses: [{ id: fc.id, name: fc.name, response: { result: 'ok' } }] }
    }));
  }

  /** 'auto' mode: persist resume state, then move the page. */
  autoNavigate( id )
  {
    const target = this.navTargets().find(t => t.id === id);
    if( ! target )
      return;
    const url = this.resolveTargetUrl(target);
    this.navigating = true;
    this.persistResume();
    location.href = url;
  }

  /** 'link' mode: render a clickable breadcrumb in the panel; never auto-move. */
  renderNavLink( id )
  {
    const target = this.navTargets().find(t => t.id === id);
    if( ! target || ! this.linkSlot )
      return;

    this.openPanel(false);

    const url   = this.resolveTargetUrl(target);
    const label = target.path[this.lang] || target.path.en;

    this.linkSlot.innerHTML = '';
    const intro = document.createElement('div');
    intro.className = 'va-link-intro';
    intro.textContent = this.t.linkIntro;

    const a = document.createElement('a');
    a.className = 'va-nav-link';
    a.href = url;
    const span = document.createElement('span');
    span.textContent = label;
    a.appendChild(span);
    a.insertAdjacentHTML('beforeend', '<i class="fas fa-arrow-right" aria-hidden="true"></i>');

    this.linkSlot.appendChild(intro);
    this.linkSlot.appendChild(a);
    this.linkSlot.classList.add('show');
  }

  /**
   * Resolve a site-root-relative target URL for the current page depth. The logo
   * link points to the current language's root, from which the site root prefix
   * is derived (EN pages need one extra "../" because /en/ is a level deeper).
   */
  resolveTargetUrl( target )
  {
    const logo = document.querySelector('.logo a');
    const langRootPrefix = (logo ? logo.getAttribute('href') : '')
      .replace(/index\.html$/, '').replace(/^#$/, '');
    const siteRootPrefix = this.isDe ? langRootPrefix : langRootPrefix + '../';
    return siteRootPrefix + (target.url[this.lang] || target.url.en);
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
  if( voiceAgent.persistent )
    voiceAgent.initOverlay();
  else if( document.getElementById('voice-agent-mic') )
    await voiceAgent.init();
});
