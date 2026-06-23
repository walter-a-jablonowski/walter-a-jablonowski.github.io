/**
 * Google AI Studio Voice Agent
 * Implements real-time voice interaction using Gemini 2.5 Flash Live API
 * (C) Walter A. Jablonowski 2025, All rights reserved
 */
// Set to true to enable verbose audio-path logging. Off by default: logging in
// the per-chunk hot path adds noticeable jank on mobile.
const VA_DEBUG = false;

class VoiceAgent
{
  constructor()
  {
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
      maintenance: 'Derzeit wegen Wartung nicht verfügbar'
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
      maintenance: 'Currently down for service'
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
      if( VOICE_AGENT_CONFIG.downForService )
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
    try {
      this.updateStatus(this.t.configLoad, 'loading');
      
      const response = await fetch(VOICE_AGENT_CONFIG.proxyUrl, {
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
    
    if (this.state === 'idle') {
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
      if (!VOICE_AGENT_CONFIG.proxyUrl || VOICE_AGENT_CONFIG.proxyUrl.includes('YOUR-PHP-SERVER')) {
        this.showError('Please configure your PHP proxy URL in lib/config.js');
        return;
      }

      // Request microphone permission
      this.updateStatus(this.t.requesting);
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

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

      // Connect to Google AI Studio Live API
      await this.connectWebSocket();

      // Send initial greeting prompt to trigger AI greeting
      this.sendGreetingPrompt();

      // Start capturing audio
      this.startAudioCapture();

      this.setState('listening');
      this.updateStatus(this.t.listening);
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
              parts: [{ text: this.sessionConfig.system_instruction }]
            },
            // Enable transcription for language detection
            // #lang-detect-added (moved to setup level, not generationConfig)
            inputAudioTranscription: {},
            outputAudioTranscription: {}
          }
        };

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
        console.log('WebSocket closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });

        // Log common close codes
        if (event.code === 1000)
          console.log('Normal closure');
        else if (event.code === 1006)
          console.error('Abnormal closure - connection lost');
        else if (event.code === 1008)
          console.error('Policy violation - check API key and model name');
        else if (event.code === 1011)
          console.error('Server error - invalid request format');

        if (this.state !== 'idle')
          this.stopVoiceAgent();
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
        return;
      }

      // Handle errors
      if( message.error ) {
        console.error('Server error:', message.error);
        this.showError(`${this.t.serverError}: ${message.error.message || 'Unknown error'}`);
        this.stopVoiceAgent();
        return;
      }

      // Transcriptions (language detection / debugging)
      // #lang-detect-added
      if( message.serverContent?.inputTranscription )
        this.log('🎤 User transcription:', message.serverContent.inputTranscription.text);
      if( message.serverContent?.outputTranscription )
        this.log('🔊 AI transcription:', message.serverContent.outputTranscription.text);

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

        // Send audio data to API
        const message = {
          realtimeInput: {
            mediaChunks: [{
              mimeType: 'audio/pcm',
              data: base64Audio
            }]
          }
        };

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
   * Verbose logging gated behind VA_DEBUG (no-op in production)
   */
  log(...args)
  {
    if( VA_DEBUG )
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
   * Send initial greeting prompt to trigger AI greeting
   */
  sendGreetingPrompt()
  {
    if( ! this.ws || this.ws.readyState !== WebSocket.OPEN )
    {
      console.error('No WebSocket ready for greeting prompt');
      return;
    }

    if( ! this.sessionConfig || ! this.sessionConfig.greeting_message )
    {
      console.error('No greeting message in session config');
      return;
    }

    const greetingMessage = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text: this.sessionConfig.greeting_message }]
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
}

// Initialize voice agent when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const voiceAgent = new VoiceAgent();
  await voiceAgent.init();
});
