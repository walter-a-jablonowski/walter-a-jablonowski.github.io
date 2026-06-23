# Voice Agent — model switch & debug flags

The voice agent has two parts:

- **Client:** `src/lib/voice-agent.js` (runs in the browser; captures mic, plays AI audio)
- **Worker:** `functions/voice-agent/voice-agent.js` (Cloudflare Worker; holds the API
  key, context and model selection). Must be redeployed in Cloudflare after changes.

The client talks to Google's Gemini **Live API** directly over a WebSocket; the worker
only serves the session config (model name, system instruction, greeting).

## Switching the model (and rolling back)

There is **one switch**, in the worker: `USE_NEW_MODEL`.

```js
// functions/voice-agent/voice-agent.js
const USE_NEW_MODEL = true;
```

| `USE_NEW_MODEL` | Model | Mic-input format |
|---|---|---|
| `true`  | `gemini-3.1-flash-live-preview` | new `realtimeInput.audio` |
| `false` | `gemini-2.5-flash-native-audio-preview-12-2025` | legacy `realtimeInput.mediaChunks` |

**Why one switch controls both:** the two models use different microphone-input
formats. Gemini 2.5 used `realtimeInput.mediaChunks`; Gemini 3.1 removed it and
requires `realtimeInput.audio` (sending the old format to 3.1 makes the socket close
with **code 1007**: `realtime_input.media_chunks is deprecated`).

To keep them from drifting, the worker sends a `use_legacy_input` flag to the client in
the session config, and the client picks the matching format in `startAudioCapture()`.
So you only ever change `USE_NEW_MODEL` — never edit the client format by hand.

**To roll back to the previous, known-working setup:** set `USE_NEW_MODEL = false` in
the worker and redeploy. That restores Gemini 2.5 + the legacy input format together.

## Debug flags (client only)

In the `VoiceAgent` constructor (`src/lib/voice-agent.js`):

```js
this.debug = true;        // verbose console logs + keep errors on screen
this.simulateMic = true;  // use a silent fake mic instead of getUserMedia
```

- **`debug`** — turns on verbose logging (every WebSocket message, the close
  code/reason, audio scheduling) and stops error messages from auto-hiding, so a
  failure like a 1007 close stays visible on the status line (useful on mobile, where
  there are no devtools).
- **`simulateMic`** — replaces the real microphone with a silent synthetic audio
  track. This lets you test the WebSocket/model handshake and **hear the AI greeting**
  on a machine with **no microphone** (e.g. a PC). The greeting is triggered by a text
  prompt, so you still get a spoken response even though the "mic" is silent.

They are independent, so you can e.g. debug with a real mic (`debug: true`,
`simulateMic: false`).

> **Production:** set both `debug` and `simulateMic` to `false` (verbose logging adds
> jank on mobile, and you obviously want the real microphone).

## Deploying changes

- **Worker** (`functions/voice-agent/voice-agent.js`): redeploy in the Cloudflare
  dashboard (paste the file, keep the real `GOOGLE_AI_API_KEY`). The repo copy has the
  `YOUR_API_KEY_HERE` placeholder.
- **Client** (`src/lib/voice-agent.js`): bump the `?v=...` cache-busting version on the
  `<script>`/`<link>` tags so browsers fetch the new file.
- The client now expects `use_legacy_input` (and `greeting_message_de/_en`) from the
  worker, so **deploy the worker and client together** to stay compatible.

## Quick troubleshooting

- **Socket closes with 1007 right after the greeting** → model/input-format mismatch
  (3.1 model with legacy `mediaChunks`, or vice-versa). Check `USE_NEW_MODEL` and
  redeploy the worker; the client follows automatically.
- **1008** → policy violation: check the API key and that the model name is enabled
  for your key.
- **1011** → server error / invalid setup. The 2.5 preview model had intermittent 1011
  reports; if it returns, try `USE_NEW_MODEL = true` (3.1).
- **No greeting on a mic-less PC** → set `simulateMic = true`.
