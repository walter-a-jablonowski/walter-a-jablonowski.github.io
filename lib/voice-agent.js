/**
 * Google AI Studio Voice Agent
 * Implements real-time voice interaction using Gemini 2.5 Flash Live API
 */
class VoiceAgent
{
  constructor()
  {
    this.ws = null;
    this.audioContext = null;
    this.mediaStream  = null;
    this.audioQueue   = [];
    this.isPlaying    = false;
    this.state        = 'idle';  // idle, listening, speaking, error
    this.context      = '';
    this.audioElement = null;    // HTML audio element for playback

    // UI elements (will be set in init)
    this.micButton      = null;
    this.statusElement  = null;
    this.errorElement   = null;
    this.loadingElement = null;
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
      this.errorElement = document.getElementById('voice-agent-error');
      this.loadingElement = document.getElementById('voice-agent-loading');

      // Load context from context.md
      await this.loadContext();

      // Set up event listeners
      this.setupEventListeners();

      this.updateStatus('Click the microphone to start');
      return true;
    } catch (error) {
      console.error('Failed to initialize voice agent:', error);
      this.showError('Failed to initialize voice agent');
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
   * Load context from context.md file
   */
  async loadContext()
  {
    try {
      this.showLoading(true);
      const response = await fetch(VOICE_AGENT_CONFIG.contextPath);

      if (!response.ok) {
        throw new Error(`Failed to load context: ${response.statusText}`);
      }

      this.context = await response.text();
      console.log('Context loaded successfully');
      this.showLoading(false);
    } catch (error) {
      console.error('Error loading context:', error);
      this.showError('Failed to load context information');
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
      // Check API key
      if (!VOICE_AGENT_CONFIG.apiKey || VOICE_AGENT_CONFIG.apiKey === 'YOUR_API_KEY_HERE') {
        this.showError('Please configure your Google AI Studio API key in lib/config.js');
        return;
      }

      // Request microphone permission
      this.updateStatus('Requesting microphone access...');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Initialize audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      // Resume AudioContext if suspended (required by browser autoplay policies)
      if (this.audioContext.state === 'suspended') {
        console.log('AudioContext is suspended, resuming...');
        await this.audioContext.resume();
        console.log('AudioContext resumed, state:', this.audioContext.state);
      }

      // Connect to Google AI Studio Live API
      await this.connectWebSocket();

      // Start capturing audio
      this.startAudioCapture();

      this.setState('listening');
      this.updateStatus('Listening... Speak now');
    } catch (error) {
      console.error('Error starting voice agent:', error);
      if (error.name === 'NotAllowedError') {
        this.showError('Microphone access denied. Please allow microphone access and try again.');
      } else {
        this.showError('Failed to start voice agent: ' + error.message);
      }
      this.setState('error');
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

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Clear audio queue
    this.audioQueue = [];
    this.isPlaying = false;

    this.setState('idle');
    this.updateStatus('Click the microphone to start');
  }

  /**
   * Connect to Google AI Studio Multimodal Live API via WebSocket
   */
  async connectWebSocket()
  {
    return new Promise((resolve, reject) => {
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${VOICE_AGENT_CONFIG.apiKey}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');

        // Send initial setup message with system instructions
        const systemInstruction = VOICE_AGENT_CONFIG.systemInstructionTemplate.replace(
          '{context}',
          this.context
        );

        const setupMessage = {
          setup: {
            model: `models/${VOICE_AGENT_CONFIG.model}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Aoede'  // Female voice
                  }
                }
              }
            },
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            }
          }
        };

        console.log('Sending setup message:', {
          model: setupMessage.setup.model,
          responseModalities: setupMessage.setup.generationConfig.responseModalities,
          voice: setupMessage.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName
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
        if (event.data instanceof Blob) {
          messageText = await event.data.text();
        } else {
          messageText = event.data;
        }

        this.handleWebSocketMessage(messageText);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });

        // Log common close codes
        if (event.code === 1000) {
          console.log('Normal closure');
        } else if (event.code === 1006) {
          console.error('Abnormal closure - connection lost');
        } else if (event.code === 1008) {
          console.error('Policy violation - check API key and model name');
        } else if (event.code === 1011) {
          console.error('Server error - invalid request format');
        }

        if (this.state !== 'idle') {
          this.stopVoiceAgent();
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
      console.log('Received WebSocket message:', message);

      // Handle setup complete
      if (message.setupComplete) {
        console.log('Setup complete, ready to receive audio');
        return;
      }

      // Handle errors
      if (message.error) {
        console.error('Server error:', message.error);
        this.showError(`Server error: ${message.error.message || 'Unknown error'}`);
        this.stopVoiceAgent();
        return;
      }

      // Handle server content (audio response)
      if (message.serverContent) {
        const parts = message.serverContent.modelTurn?.parts || [];

        console.log('Received server content with', parts.length, 'parts');

        parts.forEach((part, index) => {
          console.log(`Part ${index}:`, {
            hasInlineData: !!part.inlineData,
            mimeType: part.inlineData?.mimeType,
            dataLength: part.inlineData?.data?.length,
            hasText: !!part.text
          });

          // Handle audio data - support both audio/pcm and audio/wav
          if (part.inlineData) {
            const mimeType = part.inlineData.mimeType;
            // Check if mime type starts with audio/pcm or audio/wav (may include parameters like ;rate=24000)
            if (mimeType.startsWith('audio/pcm') || mimeType.startsWith('audio/wav')) {
              console.log('Received audio chunk, mime type:', mimeType);
              // Extract sample rate from mime type if present (e.g., audio/pcm;rate=24000)
              const sampleRateMatch = mimeType.match(/rate=(\d+)/);
              const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1]) : 24000;

              // Add to queue instead of playing immediately
              this.audioQueue.push({
                data: part.inlineData.data,
                mimeType: mimeType,
                sampleRate: sampleRate
              });

              // Start processing queue if not already playing
              if (!this.isPlaying) {
                this.processAudioQueue();
              }
            } else {
              console.warn('Unsupported audio mime type:', mimeType);
            }
          }

          // Handle text data (for debugging)
          if (part.text) {
            console.log('Assistant:', part.text);
          }
        });

        // Check if turn is complete
        if (message.serverContent.turnComplete) {
          console.log('Turn complete');
          this.setState('listening');
          this.updateStatus('Listening... Speak now');
        }
      }

    } catch (error) {
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
   * Process audio queue - play chunks sequentially
   */
  async processAudioQueue()
  {
    if (this.isPlaying || this.audioQueue.length === 0) {
      return;
    }

    this.isPlaying = true;
    this.setState('speaking');
    this.updateStatus('Speaking...');
    console.log('Processing audio queue, chunks:', this.audioQueue.length);

    while (this.audioQueue.length > 0) {
      const audioChunk = this.audioQueue.shift();
      try {
        await this.playAudioResponse(audioChunk.data, audioChunk.mimeType, audioChunk.sampleRate);
      } catch (error) {
        console.error('Error playing audio chunk:', error);
      }
    }

    this.isPlaying = false;
    this.setState('listening');
    this.updateStatus('Listening... Speak now');
    console.log('Audio queue finished');
  }

  /**
   * Play audio response from API
   */
  async playAudioResponse(base64Audio, mimeType = 'audio/pcm', sampleRate = 24000)
  {
    try {
      console.log('playAudioResponse called with', base64Audio.length, 'chars of base64 data, sample rate:', sampleRate);

      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      console.log('Decoded', bytes.length, 'bytes of audio data');

      let audioBuffer;

      if (mimeType.startsWith('audio/pcm')) {
        // Convert raw PCM to WAV format for proper playback
        console.log('Converting PCM to WAV with sample rate:', sampleRate);
        const wavBuffer = this.pcmToWav(bytes, sampleRate, 1); // mono audio
        audioBuffer = await this.audioContext.decodeAudioData(wavBuffer);
      } else if (mimeType.startsWith('audio/wav')) {
        // Already in WAV format
        console.log('Decoding WAV data...');
        audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
      } else {
        throw new Error(`Unsupported mime type: ${mimeType}`);
      }

      console.log('Audio buffer created:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        length: audioBuffer.length
      });

      // Play audio using AudioBufferSourceNode
      // Return a promise that resolves when playback finishes
      return new Promise((resolve, reject) => {
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;

        // Create gain node for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 1.0; // Full volume

        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        source.onended = () => {
          console.log('Audio chunk playback ended');
          resolve();
        };

        // Ensure AudioContext is running before playback
        if (this.audioContext.state === 'suspended') {
          console.log('AudioContext suspended before playback, resuming...');
          this.audioContext.resume().then(() => {
            console.log('AudioContext state:', this.audioContext.state);
            console.log('Starting audio playback...');
            source.start(0);
            console.log('Audio playback started successfully');
          }).catch(reject);
        } else {
          console.log('AudioContext state:', this.audioContext.state);
          console.log('Starting audio playback...');
          source.start(0);
          console.log('Audio playback started successfully');
        }
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      this.showError('Failed to play audio: ' + error.message);
      // Re-throw error so queue can handle it
      throw error;
    }
  }

  /**
   * Convert raw PCM data to WAV format
   * @param {Uint8Array} pcmData - Raw PCM data (16-bit signed integers)
   * @param {number} sampleRate - Sample rate in Hz (e.g., 24000)
   * @param {number} numChannels - Number of channels (1 for mono, 2 for stereo)
   * @returns {ArrayBuffer} WAV file data
   */
  pcmToWav(pcmData, sampleRate, numChannels)
  {
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length;
    const fileSize = 44 + dataSize; // WAV header is 44 bytes

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // Write WAV header
    // "RIFF" chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize - 8, true); // File size - 8
    this.writeString(view, 8, 'WAVE');

    // "fmt " sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample

    // "data" sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true); // Subchunk2Size

    // Write PCM data
    const dataView = new Uint8Array(buffer, 44);
    dataView.set(pcmData);

    return buffer;
  }

  /**
   * Helper function to write string to DataView
   */
  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
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
  }

  /**
   * Update status message
   */
  updateStatus(message) {
    if (this.statusElement) {
      this.statusElement.textContent = message;
    }
  }

  /**
   * Show/hide loading indicator
   */
  showLoading(show) {
    if (this.loadingElement) {
      if (show) {
        this.loadingElement.classList.add('active');
      } else {
        this.loadingElement.classList.remove('active');
      }
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    if (this.errorElement) {
      this.errorElement.textContent = message;
      this.errorElement.classList.add('active');

      // Hide after 5 seconds
      setTimeout(() => {
        this.errorElement.classList.remove('active');
      }, 5000);
    }
  }

  /**
   * Show fallback message for unsupported browsers
   */
  showFallback() {
    const fallbackElement = document.getElementById('voice-agent-fallback');
    if (fallbackElement) {
      fallbackElement.classList.add('active');
    }

    // Hide the main UI
    if (this.micButton) {
      this.micButton.style.display = 'none';
    }
  }
}

// Initialize voice agent when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const voiceAgent = new VoiceAgent();
  await voiceAgent.init();
});
