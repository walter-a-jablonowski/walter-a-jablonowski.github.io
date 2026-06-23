# Voice Agent — persistent overlay + cross-page session resume (plan)

Status: **implemented (2026-06-23).** Gated behind `VOICE_AGENT_CONFIG.persistentAgent`
(default `false`); when off, the site behaves exactly as today. Notes on what shipped
vs. this plan:

- CSS is delivered site-wide by adding `lib/voice-agent/style.css` to the `styles.css` @import
  bundle (the separate `<link>` on the two index pages was removed). `voice-agent.js` is
  loaded on every page via a `<script>` tag added next to each page's `controller.js`.
- The overlay builds its **own** DOM and binds to its own element references (not the
  `#about` IDs), so it never collides with the legacy widget regardless of script order.
- Session config is loaded **lazily** on first panel open (not on every page load).
- The native→handoff fallback is driven by the `onclose` handler: a native resume sets
  `justResumed`, which `setupComplete` clears; if the socket closes first (code ≠ 1000)
  in `'auto'` mode, it tears down and restarts seeded with the transcript.

## Goal

- Move the voice agent into a **persistent bottom-right overlay** (chat-window style)
  that is present on every page, instead of living only in the home page `#about`
  section.
- Keep the conversation going **across page navigations**. A full page load kills the
  WebSocket + AudioContext, so on the new page the large orange mic turns into a
  **"Resume conversation"** button. One tap resumes (the tap also satisfies the browser
  autoplay gesture so audio can play again).
- Resume strategy: **Gemini Live native session resumption** first, **context handoff**
  as fallback.

## The config switch

Add to `VOICE_AGENT_CONFIG` in `lib/config.js`:

```js
const VOICE_AGENT_CONFIG = {
  // ... existing ...

  // Persistent bottom-right overlay agent + cross-page conversation resume.
  // false = legacy behavior (in-#about widget + .floating-ai-button link).
  persistentAgent: false,

  // How to resume across a page load when persistentAgent is true:
  //   'native'  - Gemini Live session resumption only
  //   'handoff' - context handoff only (fresh session seeded with a summary)
  //   'auto'    - try native, fall back to handoff   (recommended)
  resumeStrategy: 'auto',

  // Ignore a stored session older than this (resumption window safety). Minutes.
  resumeMaxAgeMin: 10,
};
```

> **Config is passed to the agent at init.** The whole `VOICE_AGENT_CONFIG` object is
> passed into `new VoiceAgent(VOICE_AGENT_CONFIG)` and read via `this.config` (already
> done for `debug` / `simulateMic`). So every flag here — `persistentAgent`,
> `resumeStrategy`, `resumeMaxAgeMin`, `enableNavTool`, `navMode` — is just set in
> `config.js` and consumed from `this.config.*`; don't read the global directly inside
> the class. The controller reads the same object for the site-wide DOM changes.

### When `persistentAgent` is **true**

1. **Inject the overlay** on every page (bottom-right, fixed). The controller already
   injects the announcement bar site-wide — inject the overlay the same way so it
   doesn't have to be added to 38 HTML files.
2. **Neutralize the in-`#about` widget** so there aren't two agents: replace the
   `.voice-agent-container` content with a **dummy/placeholder SVG** (a static "talk to
   AI" illustration). The section stays, the live widget moves to the overlay.
3. **Hide the old floating link** so it doesn't duplicate the overlay:
   `<a href="#about" class="floating-ai-button hide-on-mobile show">…Speak to an AI…</a>`
   → hidden (controller removes the `.show` / sets `display:none`).
4. **Revert the `#about` nav label** from "Ask AI" / "KI fragen" back to
   "About" / "Über mich". The label was renamed to "Ask AI" precisely because `#about`
   was the only entry point to the voice agent; once the agent lives in the always-on
   overlay, that section is just the About section again. The controller rewrites the
   `a.nav-link[href$="#about"]` text on every page based on page language (DE → "Über
   mich", EN → "About"). The static HTML keeps "Ask AI" / "KI fragen" so the legacy
   (flag-off) behavior is unchanged.
5. **Use the personal about text** (see below) instead of the current one, and **flip
   the mobile visibility** of the `#about` columns (see below).

### When `persistentAgent` is **false**

Nothing changes. The overlay is not injected, the `#about` widget is the real one,
`.floating-ai-button` works as today, and the nav label stays "Ask AI" / "KI fragen".
This is the default.

## About section: text + mobile visibility

Both differ by version. The legacy text/markup stays in the HTML as the default; the
controller swaps to the new variant only when `persistentAgent` is true (e.g. by adding
a `body.persistent-agent` class for CSS, and replacing the `.about-text` copy).

### About text

- **Legacy (flag off):** exactly the current About text (the "With over 25 years…"
  paragraphs + feature list + CTA).
- **New (flag on):** a shorter, **more personal**, first-person intro. Placeholder copy
  for v1 (refine later):

  **EN**
  > Hi, I'm Walter. For over 25 years I've built software — and these days I'm all-in on
  > AI. I love turning a vague idea into something that actually works, ideally with as
  > little ceremony as possible: fewer frameworks, more results. I'm based in Bamberg and
  > work with companies here, in Nuremberg and online. Curious whether AI can help you?
  > Ask my assistant in the corner — or just reach out.

  **DE**
  > Hallo, ich bin Walter. Seit über 25 Jahren entwickle ich Software — und inzwischen
  > dreht sich bei mir alles um KI. Ich mag es, aus einer vagen Idee etwas zu machen, das
  > wirklich funktioniert, am liebsten mit möglichst wenig Drumherum: weniger Frameworks,
  > mehr Ergebnis. Ich sitze in Bamberg und arbeite mit Unternehmen hier, in Nürnberg und
  > online. Neugierig, ob KI Ihnen helfen kann? Fragen Sie meine Assistentin in der Ecke
  > — oder melden Sie sich einfach.

  Keep the feature list / CTA buttons as-is (or trim) — TBD when implementing.

### Mobile visibility of the `#about` columns

Today (mobile, `max-width: 768px`, in `skills-modal.css`): `.about-text { display:none }`
and `.tech-stack { display:block !important }` — i.e. the **about text is hidden and the
voice widget is shown**.

- **Legacy (flag off):** unchanged — about text hidden, widget shown.
- **New (flag on):** **flip it** — show the about text, hide the dummy SVG. (The live
  agent is in the overlay now, so the section's decorative SVG isn't needed on mobile;
  show the personal text instead.) Implement as overrides scoped to `body.persistent-agent`
  inside the same media query, e.g.:

  ```css
  @media (max-width: 768px) {
    body.persistent-agent .about-text { display: block; }
    body.persistent-agent .tech-stack { display: none !important; }
  }
  ```

## Navigation: auto-navigate vs. show-link mode

The optional `navigate` tool (the LLM-callable JS tool that points users at the right
section/page) has **two modes**, chosen by a config switch:

```js
// lib/config.js (VOICE_AGENT_CONFIG)
enableNavTool: false,        // master on/off for the navigate tool
navMode: 'link',             // 'auto' | 'link'  (only used when enableNavTool is true)
```

Both modes use the **same tool declaration and the same nav table**; only what the
client does with the tool call (and the system-instruction wording) differs.

- **`'auto'` — auto-navigate.** The model offers to take the user there, asks first, and
  on "yes" calls `navigate(target)`; the client changes `location` (and the resume flow
  above kicks in for cross-page jumps). Described earlier.
- **`'link'` — show a link (no auto navigation).** The model calls `navigate(target)` to
  *surface* the destination, but the client does **not** move the page. Instead it
  renders, in the overlay (chat-style), a **breadcrumb path + clickable link**, and the
  model says something like *"You can find it here — just click the link."* The user
  decides whether/when to click. This is gentler and never yanks the page out from under
  the user; clicking the link is a normal user-initiated navigation (the resume flow
  still applies if they click).

### Nav-table additions for link mode

Each target needs a human-readable **breadcrumb path** (DE + EN), rendered like
`Services > Automation`:

```js
{ id: 'automation',
  url:   { de: 'pages/services/automation.html', en: 'en/pages/services/automation.html' },
  path:  { de: 'Leistungen > Automatisierung',   en: 'Services > Automation' } }
```

The overlay renders, e.g.: `Services > Automation` as a clickable link to `url`
(language picked via `this.isDe`). Breadcrumb separator: " > ".

### System-instruction wording per mode

Appended client-side (like `pageLanguageNote()`), depending on `navMode`:

- **auto:** *"You can navigate the site with the `navigate` tool. When a section would
  help, briefly offer to take the user there and ask first; only call `navigate` after
  they confirm."*
- **link:** *"You can point users to the right place with the `navigate` tool. When a
  section answers their question, call `navigate` to show them the link, and tell them
  they can click it to go there. Do NOT claim you will move the page yourself."*

## UX / state machine

Overlay mic button states:

- **idle** – orange mic, "Click to start" (as today).
- **listening / speaking / error** – as today.
- **resume** – *new*. Shown only on a fresh page load when a resumable session was
  active before navigation. Looks distinct (e.g. mic + circular-arrow, label "Resume
  conversation" / "Gespräch fortsetzen"). Does **not** auto-connect — waits for the tap
  (needed for the audio autoplay gesture).

Flow:

```
[active session on page A]
   user (or the navigate tool) follows a cross-page link
   -> persist state to sessionStorage, then navigate
[page B loads]
   agent init sees a fresh, in-window resumable session
   -> render mic in "resume" state (no audio yet)
   user taps "Resume conversation"
   -> reconnect (native handle) OR seed fresh session (handoff)
   -> go straight to listening; do NOT replay the greeting
```

Same-page section scrolls (`#about`, `#services`, …) never reload, so the live session
just continues — no resume needed there.

## Persistence (sessionStorage, per tab)

| Key | Meaning |
|---|---|
| `va:active` | `'1'` while a session is live |
| `va:resume` | `'1'` set just before a cross-page navigation |
| `va:handle` | latest native resumption handle |
| `va:lang`   | `de` / `en` (sanity check on resume) |
| `va:summary`| short transcript summary for handoff fallback |
| `va:ts`     | timestamp of last update (enforce `resumeMaxAgeMin`) |

On load, the agent is in "resume" state only if `va:resume==='1'` **and**
`now - va:ts <= resumeMaxAgeMin`. Otherwise clear everything and show idle.

## Resume strategy details

### 1. Native Gemini Live session resumption (primary)

This is a **client-side** setup change (the client builds the setup message; the worker
is untouched).

- Enable on every connect by adding to the `setup` message:
  ```js
  setup: { /* model, generationConfig, systemInstruction, ... */
    sessionResumption: {}            // enable; server will issue handles
  }
  ```
- Capture handles in `handleWebSocketMessage`:
  ```js
  if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle) {
    sessionStorage.setItem('va:handle', message.sessionResumptionUpdate.newHandle);
    sessionStorage.setItem('va:ts', String(Date.now()));
  }
  ```
- To resume on page B, connect with:
  ```js
  setup: { /* ... */ sessionResumption: { handle: storedHandle } }
  ```
  and **skip `sendGreetingPrompt()`** — the model already has the context.
- If the handle is missing/expired or the socket closes abnormally right after resume,
  fall back to handoff (when `resumeStrategy` is `'auto'`).

Caveats: resumption has a **limited time window** (designed for short drops, not
returning an hour later) — hence `resumeMaxAgeMin` and the timestamp guard.

### 2. Context handoff (fallback)

Transcription is already enabled (`inputAudioTranscription` / `outputAudioTranscription`),
so the client can accumulate the dialogue. On navigation, store a compact summary
(e.g. last N turns, or the running transcript trimmed) in `va:summary`. On page B:

- Start a **fresh** session (new connection), and instead of the normal greeting send an
  initial `clientContent` seed like: *"(Context of the ongoing conversation: …summary…)
  Continue naturally; do not greet again."*
- Not a true live continuation (new session), but the AI "remembers" the topic. No time
  window limit.

## The autoplay catch (applies to both)

After a page load with no user gesture, the `AudioContext` is suspended and playback is
blocked. That's exactly why the **"Resume conversation" tap** exists — the tap is the
gesture that lets us `resume()` the contexts and play audio. The mic permission itself
persists for the origin (no re-prompt).

## Hooking navigation

A cross-page jump can come from (a) the optional `navigate` tool, or (b) the user
clicking any internal link while a session is active. Add a single helper that, before
any internal navigation while `va:active`, writes `va:resume='1'` + handle/summary +
`va:ts`, then proceeds. For (b), a delegated click listener on internal `<a>` links
(same-origin) is enough.

## Files to touch

- `lib/config.js` — add `persistentAgent`, `resumeStrategy`, `resumeMaxAgeMin`,
  `enableNavTool`, `navMode`.
- `controller.js` — when `persistentAgent`: add a `body.persistent-agent` class, inject
  the overlay site-wide, swap the `.voice-agent-container` for the dummy SVG, hide
  `.floating-ai-button`, rewrite the `#about` nav label back to "About" / "Über mich"
  (per page language), swap the `.about-text` copy to the personal variant; install the
  internal-link navigation hook.
- `lib/voice-agent/agent.js` — overlay markup/binding, the `resume` UI state, `sessionResumption`
  in setup, sessionStorage persistence, resume + fallback flow, suppress greeting on
  resume, accumulate transcript for handoff; plus (if `enableNavTool`) the `navigate`
  tool declaration, `toolCall` handling, the nav table, and the `navMode` branch
  (auto-navigate vs. render a breadcrumb link in the overlay).
- `styles/` (e.g. `widgets.css`) — overlay panel styling (fixed bottom-right, safe-area
  insets — reuse the pattern already added for `.floating-ai-button`); plus the
  `body.persistent-agent` mobile overrides for the `#about` columns (in the
  `max-width: 768px` block, mirroring `skills-modal.css`).
- Worker `functions/voice-agent/voice-agent.js` — **no change required** for native
  resumption (setup is built client-side; transcription already on). Optional: a system
  instruction line "if resuming, don't greet again."

## Edge cases

- **Resume handle expired** → fall back to handoff (or, if `'native'` only, show idle and
  start fresh).
- **User navigated without an active session** → no resume state, normal idle.
- **Multiple tabs** → `sessionStorage` is per-tab, so tabs don't fight. Good.
- **Language switch mid-session (DE↔EN page)** → `va:lang` mismatch; safest to **not**
  auto-resume across a language change (start fresh) to avoid a wrong-language reopen.
- **Maintenance / `downForService`** → overlay shows the maintenance state, no resume.
- **Don't double-init** the agent (overlay vs leftover `#about` widget) — only one live
  instance.

## Testing checklist

- [ ] `persistentAgent:false` → site identical to today (no overlay, `#about` widget +
      floating link work, nav label still "Ask AI" / "KI fragen").
- [ ] `persistentAgent:true` → overlay visible every page; `#about` shows dummy SVG;
      floating link hidden; nav label reverts to "About" / "Über mich" (DE/EN, all pages);
      `#about` shows the personal about text.
- [ ] Mobile, flag off → about text hidden, voice widget shown (as today).
- [ ] Mobile, flag on → about text shown, dummy SVG hidden.
- [ ] `enableNavTool:true`, `navMode:'auto'` → AI asks, then navigates on confirm.
- [ ] `enableNavTool:true`, `navMode:'link'` → AI shows a breadcrumb link in the overlay
      ("Services > Automation") and tells the user to click it; page does NOT move on its
      own; link uses the correct DE/EN URL.
- [ ] `enableNavTool:false` → no tool declared; AI just describes where to look.
- [ ] Same-page section scroll keeps the live session (no resume button).
- [ ] Cross-page nav → "Resume conversation" appears; one tap continues with context
      (native), audio plays after the tap.
- [ ] Expired/again-after-long-delay → no stale resume; clean idle.
- [ ] Handoff fallback works when native resumption is forced to fail.
- [ ] DE↔EN navigation does not resume in the wrong language.
- [ ] Mobile: overlay clears the system nav bar (safe-area), no echo, no double audio.

## Related

- `README-voice-agent.md` — model switch + debug flags.
- `voice-agent-improvements.md` — what shipped so far.
- `../../voice-agent-audioworklet-plan.md` — deferred capture upgrade.
- Navigate-tool idea (the `navigate` function-calling tool) is folded into this plan
  (see "Navigation: auto-navigate vs. show-link mode"): in `'auto'` mode it triggers the
  cross-page nav that the resume flow then continues across; in `'link'` mode it just
  shows a clickable breadcrumb.
