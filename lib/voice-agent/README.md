# Voice Agent

Real-time voice chat (Gemini Live API over WebSocket).

## Parts

- **Client** — `lib/voice-agent/agent.js` + `lib/voice-agent/style.css`. Mic capture, audio playback, overlay UI.
- **Worker** — `functions/voice-agent/` (Cloudflare), three modules:
  - `voice-agent.js` — entry: routes a WebSocket upgrade to the relay, POST actions to the legacy handlers
  - `content.js` — persona, both contexts, both site guides, `NAV_TARGETS`
  - `relay.js` — the live session (browser ⇄ Worker ⇄ Gemini)
  - `page-context.js` — what is on the visitor's current page (see "Current page context")
- **Config** — two single places, one per side:
  - `functions/config.js` — Worker settings: live model, text model, use case counts. Never reaches a browser.
  - `lib/config.js` → `VOICE_AGENT_CONFIG` — client settings (incl. `textModel`; the live model is not set here).

## Transport — relay only

`Client ⇄ Worker (/live) ⇄ Gemini Live`. There is no direct-to-Google mode any more, and no
endpoint that hands a browser the key or the prompt — the old `get_session_config` was
deleted. **Don't reintroduce it.**

The browser holds ~2 KB of state: no API key, no system prompt, no site guide, no nav table,
no model name, no provider endpoint. It streams mic audio up and renders what comes back.

The Worker owns the session: setup message, system instruction, greeting, voice, transcription,
session resumption, the `navigate` tool and its targets. Mic frames go out as bare base64 and
the Worker wraps them for whichever model is configured — so `use_legacy_input` no longer
exists client-side and client and Worker cannot drift apart.

The client ⇄ Worker protocol is documented at the top of
[`relay.js`](../../../functions/voice-agent/relay.js); rollback is git, not a config flag.

Plan, findings and remaining work:
[`../../../functions/voice-agent/relay-plan.md`](../../../functions/voice-agent/relay-plan.md).

### Deploying the Worker

Wrangler only — **never the dashboard editor**, or the deployment silently diverges from git.

```
cd functions/voice-agent
npx wrangler deploy                        # deploy from git
npx wrangler secret put GOOGLE_AI_API_KEY  # once, and after any key rotation
npx wrangler tail                          # server-side errors (the relay's only window)
node relay-test.mjs wss://homepage-api.<sub>.workers.dev/live de   # smoke test
```

`wrangler dev` (local) **cannot** test the relay — outbound WebSocket upgrade is unsupported
locally and hangs. Use `wrangler dev --remote`, or deploy. Local dev is fine for the POST actions.

## Sidebar & views (separate from the voice agent)

The slide-in sidebar is its own module, independent of the voice agent, but ships
from this folder and shares the same Worker (`lib/config.js` `proxyUrl`).

- **`sidebar.js`** — generic `Sidebar` host: open/close panel, tab strip, a small
  **view registry**. One shared instance via `Sidebar.instance()`. Shows one view at
  a time; with several registered views it grows tabs in the header.
- **`use-case-finder.js`** — the first view (`UseCaseFinder`). Business-description →
  ranked AI use cases (Worker action `find_use_cases`, text model). Self-registers on
  load and wires the hero `#use-case-finder-trigger` button.
- **CSS** — `sidebar.css` (panel + tabs) and `use-case-finder.css` (the view). Both
  imported centrally from `styles.css`.

**View contract** (implement to add another sidebar component, e.g. a page
summary): `id`, `getTitle()`, `render(root)` — render into the given container
(called once, lazily, on first show). Register with
`Sidebar.instance().registerView(view)`; it becomes a tab automatically.

**Voice-agent interaction** (not yet wired): the agent can reach the same panel via
`Sidebar.instance()` — `open(id)` / `showView(id)` / `getView(id)` — to open a view or
read/trigger it. To make this work on every page, `agent.js` would need `sidebar.js`
loaded site-wide (today it loads only where the finder trigger exists: both index
pages + the automation/integration service pages).

The scripts must load in order **`config.js` → `sidebar.js` → `use-case-finder.js`**
(the view needs the `Sidebar` class defined first).

## System prompt

The prompt is split by **stable shared knowledge vs. runtime facts only the client knows**:

- **Worker** owns the base prompt: `SYSTEM_INSTRUCTION_TEMPLATE` (persona + rules) with the `CONTEXT_*` / `SITEMAP_*` sections and a server-injected date. Edit it there and redeploy; it's the single source and isn't shipped in the static site.
- **Client** (`runtimeInstructionNote()` in `agent.js`) appends only what the Worker can't know: the visitor's current page language (`pageLanguageComment()`) and, when `enableNavTool` is on **and** the Worker supplied targets, the navigation note (`navInstructionNote()`). The note is assembled client-side because it depends on `config.navMode` (a client setting); the target ids it lists come from the Worker (`nav_targets`, see "Navigation sandbox").

One assembly point: `system_instruction` (from the Worker) `+ runtimeInstructionNote()`.

## Current page context

The prompt only has a one-line sitemap entry per page, so on its own the model neither knows
which page the visitor is on nor what it says — "summarize this page" after navigating to a
sub page used to describe the start page.

- The client sends the page as `page=` on the relay URL (`currentPagePath()`, site-root-relative,
  e.g. `pages/services/automation/index.html`).
- The Worker (`page-context.js`) looks it up in the site's own `search-index-<lang>.json`, read
  from `SITE_URL` (`functions/config.js`) — the same generated full text the search dialog uses,
  so there is no second copy of the content to keep in sync. Cached 10 min, so a publish reaches
  the agent within that.
- Right after setup the relay adds it to the conversation as a context turn with
  `turnComplete: false` — the model takes it in without answering. This runs on **every**
  connect: a page change reconnects, and a natively resumed session keeps its old system prompt,
  so the context has to go into the conversation rather than the prompt.
- `page` is only compared against index entries, never used to build a URL. An unknown page
  simply gets no context.

## Live model (Worker)

All model ids live in `functions/config.js` — nowhere else in the Worker. `MODEL_NAME` is
`gemini-3.8-live` (stable). Mic audio goes out as `realtimeInput.audio`, which every remaining
Live model takes — the `mediaChunks` format and the `USE_NEW_MODEL` switch left with
`gemini-2.5-flash-native-audio`.

| Model | Use |
|---|---|
| `gemini-3.8-live` | Default: low latency, no reasoning delay |
| `gemini-3.8-live-extended-thinking` | More background reasoning, slower replies |
| `gemini-3.1-flash-live-preview` | Rollback only — shut down **2026-11-17** (as is 2.5 native audio) |

What 3.8 changed against the 3.1 preview, and how the relay handles it:

- **Tool calls are async by default** (`NON_BLOCKING`): the model keeps talking and hears the
  result later. `navigate` is declared `behavior: 'BLOCKING'`, because its result is what tells
  the model it only showed a link — it must arrive before the model talks about it.
- **No `thinkingLevel`** — sending one is an error. The relay never sent one.
- **Proactive audio is always on; affective dialogue is gone.** Neither was configured.
- `clientContent` without `turnComplete` (the page context) is still taken in silently; with
  `turnComplete: true` (greeting, handoff seed) it interrupts any running generation — both
  are sent right after setup, before the model has said anything.

Rollback: set `MODEL_NAME` in `functions/config.js` + redeploy.

Text model (`TEXT_MODEL_NAME`, use case finder) is separate — the client may override it via
`VOICE_AGENT_CONFIG.textModel`.

## Debug flags (`VOICE_AGENT_CONFIG`)

| Flag | Effect |
|---|---|
| `debug` | Verbose logs; keep errors on screen (mobile). |
| `simulateMic` | Silent fake mic; test handshake + hear greeting with no mic. |

Production: all `false`

## Persistent overlay + resume (`VOICE_AGENT_CONFIG`)

Off by default. Always-on bottom-right overlay on every page + cross-page resume. Spec: [`../voice-agent-persistent-overlay-plan.md`](../voice-agent-persistent-overlay-plan.md).

| Flag | Values | Meaning |
|---|---|---|
| `persistentAgent` | `false` \| `true` | `false` = legacy `#about` widget. `true` = overlay; `#about` → static art; floating link hidden; nav label → About; personal about text. |
| `resumeStrategy` | `native` \| `handoff` \| `auto` | Resume after reload. `native` = Gemini handle; `handoff` = transcript summary seed; `auto` = native, fallback handoff. |
| `resumeMaxAgeMin` | minutes | Ignore older stored sessions. |
| `enableNavTool` | `false` \| `true` | LLM-callable `navigate` tool. |
| `navMode` | `auto` \| `link` | `auto` = ask + navigate. `link` = clickable breadcrumb, no move. |
| `showNavToggle` | `false` \| `true` | Footer switch to flip `navMode` at runtime (needs `enableNavTool`). |
| `showTranscriptToggle` | `false` \| `true` | Footer switch to show/hide the transcript at runtime. |
| `launcherStyle` | `round` \| `text` | Collapsed launcher look. `round` = icon-only circle; `text` = wider "Ask AI 🎤" pill (label + mic). |

- Worker unchanged for most of these (setup built client-side; transcription already on). Exception: `enableNavTool` needs the Worker to send `nav_targets` (see "Navigation sandbox") — redeploy it, or the tool is silently skipped.
- `agent.js` loads on every page; no-op when `persistentAgent: false` and no `#about` widget.

## Overlay layout

Built once in `buildOverlay()` and appended to `<body>`. Some elements are
always present but normally hidden (the breadcrumb, and the single status line
that also carries error / loading / maintenance messages).

```
.va-overlay                fixed, bottom-right on every page
│
├─ .va-panel               the card; role="dialog", shown only when .open
│  │
│  ├─ .va-panel-header
│  │  ├─ .va-panel-title       "Ask my AI assistant"  |  "Continue?" (resume)
│  │  └─ .va-panel-close       the  ✕  button
│  │
│  └─ .va-panel-body
│     ├─ .va-trying            "Testbetrieb" badge — only when config `trying: true`
│     ├─ .voice-agent-mic      round microphone button
│     ├─ .voice-agent-status   ONE status line — also shows errors (state-coloured)
│     ├─ .voice-agent-transcript  live transcript — only when config `showTranscript`
│     ├─ .va-link-insert       HIDDEN; nav link(s), revealed with .show
│     │  ├─ .va-link-intro         "You can find that here:" | "These might help…" (multi)
│     │  ├─ a.va-nav-link          single target: one page label + → arrow
│     │  └─ .va-link-list          multiple targets: scrollable list of a.va-nav-link rows
│     ├─ .va-example           greyed example prompt (text from config `examples`)
│     └─ .va-footer            runtime toggle switches — only when a *Toggle flag is on
│        ├─ .va-switch[transcript]   show/hide the live transcript instantly
│        └─ .va-switch[nav]          flip navMode auto⇄link (needs enableNavTool)
│
└─ .va-launcher            collapsed floating button (shown when panel closed)
                           round mic, or "Ask AI 🎤" pill when launcherStyle: 'text'
```

`.va-example` text comes from `VOICE_AGENT_CONFIG.examples` (`{ de, en } → { text, nav }`); the `nav` line is appended only when `enableNavTool` is true. `.va-footer` is rendered only when `showTranscriptToggle` and/or `showNavToggle` is on (see "Footer toggles" below).

Rendered (panel open, breadcrumb shown):

```
┌─────────────────────────────────────┐
│  Ask my AI assistant            ✕   │   .va-panel-header
├─────────────────────────────────────┤
│                                     │
│                ( o )                │   .voice-agent-mic
│                                     │
│    Click the microphone to start    │   .voice-agent-status   ← errors render here too
│                                     │
│   ┌───────────────────────────────┐ │   .va-link-insert   (hidden unless .show)
│   │ You can find that here:       │ │      .va-link-intro
│   │ Services                   →  │ │      a.va-nav-link
│   └───────────────────────────────┘ │
│                                     │
│   e.g. "Can Walter build AI         │   .va-example
│   features for me?"                 │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │   .va-footer  (only if a *Toggle is on)
│            Transcript ◯   Auto-nav ◯ │      .va-switch × n, right-aligned
└─────────────────────────────────────┘

   collapsed:   ( o )   .va-launcher
```

`.voice-agent-status` is reused for every message; `setState()` puts a state
class on it (and on the mic + launcher), and sets the header title:

| State (class) | Header title | Status line text |
|---|---|---|
| idle | panelTitle | "Click the microphone to start" (`micStart`) |
| resume | `resumeTitle` "Continue?" | "Click the microphone to resume the conversation" (`resumeHint`) |
| loading | panelTitle | "Loading configuration…" (`configLoad`) |
| listening | panelTitle | "Listening… Speak now" |
| speaking | panelTitle | "Speaking…" |
| error | panelTitle | mic / server / config error — auto-hides after 5 s → back to `micStart` |
| fallback | panelTitle | unsupported-browser message |
| maintenance | panelTitle | "Currently down for service" (`downForService: true`) |

## Live transcript

Shows what the user said + what the agent speaks, under the mic. Data is the
input/output transcription Gemini Live already streams (`serverContent.inputTranscription`
/ `outputTranscription`), rendered as role lines (`.va-tr-user` / `.va-tr-ai`,
icon + coloured text). Streamed deltas are coalesced into one utterance and
finalized when the speaker switches. Cleared on each call start (no persistence).

Present in **both** UIs: `.voice-agent-transcript` is built in `buildOverlay()`
for the overlay and is static markup under the mic in `index.html` / `en/index.html`
for the legacy in-page widget.

| Flag (`VOICE_AGENT_CONFIG`) | Values | Meaning |
|---|---|---|
| `showTranscript` | `false` \| `true` | Master on/off. |
| `transcriptMode` | `single` \| `rolling` | `single` = only the active speaker's current utterance; `rolling` = last `transcriptLast` turns + the live one. |
| `transcriptLast` | number | Turns kept in `rolling` mode (e.g. 2–3). |
| `transcriptShowUser` | `false` \| `true` | Include the user's own speech (`false` = agent transcript only). User vs. agent lines come from `inputTranscription` / `outputTranscription`. |

In `single` mode the user's line shows only while they speak, then the agent's
answer replaces it — so the end state looks agent-only. Use `rolling` to keep
both visible. `transcriptShowUser: false` hides user lines entirely.

## Footer toggles

When `showNavToggle` and/or `showTranscriptToggle` is on, the overlay extends a
right-aligned `.va-footer` with `role="switch"` toggles (built in `buildOverlay`,
flipped in `onSwitchToggle`). Each starts from its setting's value and is a
**per-session override** — nothing is persisted, so a reload returns to config.

| Switch | Initial state | Effect of flipping |
|---|---|---|
| Transcript (`showTranscriptToggle`) | `showTranscript` | Show/hide `.voice-agent-transcript` instantly (adds/removes `.va-hidden`). |
| Auto-nav (`showNavToggle`) | `navMode === 'auto'` | Sets `navMode` `auto`⇄`link`; the navigate tool result reads it on its next call (and `runtimeInstructionNote` on the next connect). |

Overlay only — the legacy in-page `#about` widget has no footer. The nav switch
is suppressed when `enableNavTool` is false (no tool to govern). When
`showTranscript` is false but `showTranscriptToggle` is true, the transcript
element is still built (hidden) so the switch has something to reveal.

## Navigation sandbox

The `navigate` tool can only reach pages on this site — off-site navigation is not possible.

- **Single source of truth = the Worker.** `NAV_TARGETS` (next to `SITEMAP_*`, kept in sync with it) is sent in `get_session_config` as `nav_targets`; the client's `navTargets()` just returns that list. No site URLs are hardcoded in `agent.js` — if the Worker sends none, the tool isn't offered (no empty enum).
- Tool param `targets` is an **array** whose items are a fixed **enum** of `nav_targets` ids; the model never passes a URL, only ids. It may pass one id or several.
- Unknown ids are filtered out (`handleToolCall`); if none remain, nothing is shown.
- One valid id → in `link` mode a single breadcrumb (`renderNavLink`), in `auto` mode the page moves (`autoNavigate`). **Several ids → always a scrollable pick-list** (`renderNavLinkList`, `.va-link-list`), even in `auto` mode, so the visitor chooses.
- URL is built in code (`resolveTargetUrl`) from the server-provided table only.
- Output is audio-only; nav links use `textContent` + controlled `url` (no HTML/link injection).
- Residual: model could *say* an external URL aloud, but can't link or move there.
- Not yet added (optional hardening): same-origin assert in `autoNavigate`/`renderNavLink`; prompt line "navigate within this site only".

## Deploy

- **Worker**: `cd functions/voice-agent && npx wrangler deploy`. Never the dashboard editor — the bundle spans several modules (incl. `../config.js`). The key is a Worker secret (`wrangler secret put GOOGLE_AI_API_KEY`), never in the repo.
- **Client**: `php tools/publish.php` — it rewrites the `?v=` cache-busting tokens itself, no hand-editing.
- **Order does not matter.** The two halves deploy independently: the relay protocol is stable across this pair, and the only shared setting is `textModel`, which the client sends per request and the Worker only falls back on. Prefer the Worker first — it is the step that can fail, and a failed deploy leaves the live site untouched.

## Reconnect on a dropped socket

A transport close is the network, not the model, so `onRelayClose()` picks the conversation
back up instead of showing a code. Deliberately narrow, so a broken upstream can never
turn into a retry loop billing Live-API seconds:

- **one** attempt per live session, re-armed only when a new session reports `ready`
- only while a call is running (`listening` / `speaking`)
- only with a stored resume handle — without one it would be a cold restart mid-conversation
- never for 1000 (normal) or 1011 (`fail()` — the Worker gave up on purpose)

If the handle itself is dead, the existing native→handoff fallback takes over. If the retry
fails too, the visitor sees exactly the old error.

Covered by `tools/agent_test/agent_test.mjs` (`node tools/agent_test/agent_test.mjs`), which
runs the real `agent.js` against a DOM stub — no browser, mic or network needed.

## Tests

| Test | Covers |
|---|---|
| `node tools/agent_test/agent_test.mjs` | Reconnect decision in `agent.js` — DOM stub, no browser, seconds |
| `node tools/agent_test/browser_test.mjs` | The whole agent end to end: real site in headless Chrome, deployed Worker, Gemini. Silent mic; the visitor's words go in as text (`seed`). `--ui` skips the conversations (no Gemini, ~1 min); words as args pick tests by id |
| `node functions/voice-agent/relay-test.mjs <wss-url> de [greet|nav|resume|barge]` | The Worker alone, from Node |

What needs a human voice, ears or a phone is a manual checklist: TEST-CASES.md in the task folder.

## Close codes

| Code | Cause |
|---|---|
| 1006 | Abnormal close, no close frame — the browser⇄Worker socket died (mobile handover, stalled radio, backgrounded tab). Not Gemini: an upstream failure arrives as `upstream-closed-<n>`. The client **retries once** with the resume handle (`shouldReconnect()`); only a second drop in the same session shows the error. |
| 1001 | Same — endpoint going away. Retried once, exactly like 1006. |
| 1007 | Invalid frame — usually a setup field the model rejects (e.g. `thinkingLevel` on 3.8) → check `buildSetup()` against `MODEL_NAME`. |
| 1008 | Policy — check API key / model enabled (or shut down). |
| 1011 | Server/setup error — check `MODEL_NAME`. |

No greeting on mic-less PC → `simulateMic: true`.
