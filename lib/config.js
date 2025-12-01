/**
 * Configuration for Google AI Studio Voice Agent
 * 
 * SETUP INSTRUCTIONS:
 * 1. Get your free API key from https://aistudio.google.com
 * 2. Replace 'YOUR_API_KEY_HERE' below with your actual API key
 * 3. Optional: Set domain restrictions in Google AI Studio for added security
 */

const VOICE_AGENT_CONFIG = {

  // Google AI Studio API Key
  apiKey: '',

  // Model configuration
  // Using Gemini Live 2.5 Flash Preview - official Live API model with native audio
  // This is the correct model for real-time voice interactions
  model: 'gemini-live-2.5-flash-preview',  // Gemini 2.5 Flash Live API

  // Voice settings
  voice: {
    language: 'en-US',
    // The AI automatically detects and responds in German or English
    // based on the user's input language (configured in system instruction)
  },

  // Context file path (relative to index.html)
  contextPath: 'misc/context.md',

  // System instruction template
  // {context} will be replaced with the content from context.md
  systemInstructionTemplate: `You are Walter's AI assistant on his personal developer portfolio website.

Your role is to help visitors learn about Walter's skills, experience, and projects by answering their questions in a friendly, professional manner.

IMPORTANT GUIDELINES:
- You are a voice-only assistant. You MUST OUTPUT NO text, markdown, or thought traces.
- Your output must be PURE AUDIO.
- Don't generate any text starting with "**" or "Thought:".
- Speak the answer directly and immediately.
- Keep responses concise and conversational.
- Respond in the same language the user speaks (German or English).
- Be enthusiastic about Walter's skills and projects.
- If asked about something that isn't in the context, politely say you don't have that information.

CONTEXT ABOUT WALTER:
{context}`,

  // UI settings
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
