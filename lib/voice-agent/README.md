# Voice Agent

Real-time voice chat (Gemini Live API over WebSocket).

## Parts

- **Client** — `lib/voice-agent/agent.js` + `lib/voice-agent/style.css`. Mic capture, audio playback, overlay UI.
- **Worker** — `functions/voice-agent/voice-agent.js` (Cloudflare). Holds API key, context, model. Serves session config only. Redeploy after changes.
- **Config** — `lib/config.js` → `VOICE_AGENT_CONFIG`.

Client → Worker (`get_session_config`) → Gemini Live WebSocket (direct).

## Model switch (Worker)

One switch picks model **and** mic-input format (kept in sync via `use_legacy_input` → client).

| `USE_NEW_MODEL` | Model | Mic format |
|---|---|---|
| `true`  | `gemini-3.1-flash-live-preview` | `realtimeInput.audio` |
| `false` | `gemini-2.5-flash-native-audio-preview-12-2025` | `realtimeInput.mediaChunks` |

- Mismatch → socket close **1007**.
- Rollback: `USE_NEW_MODEL = false` + redeploy.

## Debug flags (`VOICE_AGENT_CONFIG`)

| Flag | Effect |
|---|---|
| `debug` | Verbose logs; keep errors on screen (mobile). |
| `simulateMic` | Silent fake mic; test handshake + hear greeting with no mic. |

Production: both `false`.

## Persistent overlay + resume (`VOICE_AGENT_CONFIG`)

Off by default. Always-on bottom-right overlay on every page + cross-page resume. Spec: [`../voice-agent-persistent-overlay-plan.md`](../voice-agent-persistent-overlay-plan.md).

| Flag | Values | Meaning |
|---|---|---|
| `persistentAgent` | `false` \| `true` | `false` = legacy `#about` widget. `true` = overlay; `#about` → static art; floating link hidden; nav label → About; personal about text. |
| `resumeStrategy` | `native` \| `handoff` \| `auto` | Resume after reload. `native` = Gemini handle; `handoff` = transcript summary seed; `auto` = native, fallback handoff. |
| `resumeMaxAgeMin` | minutes | Ignore older stored sessions. |
| `enableNavTool` | `false` \| `true` | LLM-callable `navigate` tool. |
| `navMode` | `auto` \| `link` | `auto` = ask + navigate. `link` = clickable breadcrumb, no move. |

- Worker unchanged for these (setup built client-side; transcription already on).
- `agent.js` loads on every page; no-op when `persistentAgent: false` and no `#about` widget.

## Deploy

- **Worker**: paste into Cloudflare dashboard, keep real `GOOGLE_AI_API_KEY` (repo has `YOUR_API_KEY_HERE`).
- **Client**: bump `?v=...` on `<script>`/`<link>` tags.
- Deploy Worker + client together (client expects `use_legacy_input`, `greeting_message_de/_en`).

## Close codes

| Code | Cause |
|---|---|
| 1007 | Model/format mismatch → check `USE_NEW_MODEL`, redeploy. |
| 1008 | Policy — check API key / model enabled. |
| 1011 | Server/setup error — try `USE_NEW_MODEL = true`. |

No greeting on mic-less PC → `simulateMic: true`.
