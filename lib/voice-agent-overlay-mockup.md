# Voice Agent — persistent overlay ASCII mockup

Rough visual of the bottom-right overlay (companion to
`voice-agent-persistent-overlay-plan.md`). Not pixel-accurate — just layout/intent.

Legend:  ( ◉ ) = mic button (orange)   ▮ = audio level bars   ✕ = close   ⤺ = resume


## 1. Collapsed — just the floating button (default resting state)

```
                                                  page content …
.--------------------------------------------------------------.
|                                                              |
|                                                              |
|                                                              |
|                                                       .----. |
|                                                      ( ◉  ) |   <- orange mic,
|                                                       '----'  |      fixed corner
'--------------------------------------------------------------'
                                              ↑ ~24px from edge / safe-area
```

Hover/tooltip: "Ask AI" / "KI fragen".


## 2. Expanded — chat-style panel, IDLE

```
.--------------------------------------------------------------.
|  page content …                                              |
|                                  .-------------------------.  |
|                                  |  Ask my AI assistant  ✕ |  |
|                                  |-------------------------|  |
|                                  |                         |  |
|                                  |        .------.         |  |
|                                  |       (  ◉   )          |  |
|                                  |        '------'         |  |
|                                  |                         |  |
|                                  |  Click the mic to start |  |
|                                  |                         |  |
|                                  |  e.g. "Can Walter build |  |
|                                  |  AI features for me?"   |  |
|                                  '-------------------------'  |
'--------------------------------------------------------------'
```

Panel ≈ 300–340px wide, anchored bottom-right, rounded corners, dark card to match
the site. Collapses back to (1) on ✕.


## 3. LISTENING (user speaking)

```
        .-----------------------------.
        |  Listening…               ✕ |
        |-----------------------------|
        |                             |
        |         .------.            |
        |        (  ◉   )   ▮▮▮▮▂▂     |   <- pulsing ring + live level
        |         '------'            |
        |                             |
        |   "Listening… speak now"    |
        '-----------------------------'
```


## 4. SPEAKING (AI talking)

```
        .-----------------------------.
        |  Speaking…                ✕ |
        |-----------------------------|
        |                             |
        |         .------.            |
        |        (  ◉   )  ◜◝◜◝        |   <- gold ring, animated
        |         '------'            |
        |                             |
        |   Speaking…                 |
        '-----------------------------'
```


## 5. RESUME state (after navigating to a new page mid-conversation)

```
        .-----------------------------.
        |  Continue?                ✕ |
        |-----------------------------|
        |                             |
        |         .------.            |
        |        (  ⤺   )             |   <- mic + circular arrow
        |         '------'            |
        |                             |
        |  ▶ Resume conversation      |   <- one tap = reconnect + unlock audio
        |    (we'll pick up where     |
        |     you left off)           |
        '-----------------------------'
```


## 6. LINK mode (navMode: 'link') — AI shows a path instead of navigating

```
        .-----------------------------.
        |  Ask my AI assistant      ✕ |
        |-----------------------------|
        |  You can find that here:    |
        |                             |
        |   ┌───────────────────────┐ |
        |   │ Services > Automation →│ |   <- clickable breadcrumb link
        |   └───────────────────────┘ |
        |                             |
        |  "…just click the link."    |
        |         .------.            |
        |        (  ◉   )             |
        |         '------'            |
        '-----------------------------'
```


## 7. Mobile (≤768px)

Panel goes (near) full-width above the button; button stays bottom-right, lifted by the
safe-area inset so it clears the Android nav bar.

```
.----------------------------.
| page content …             |
|                            |
| .------------------------. |
| | Ask my AI assistant  ✕ | |
| |------------------------| |
| |        .------.        | |
| |       (  ◉   )         | |
| |        '------'        | |
| |  Click the mic to start| |
| '------------------------' |
|                     .----. |
|                    ( ◉  ) | |
|                     '----'  |
'----------------------------'
        ↑ safe-area-inset-bottom keeps it above the nav bar
```


## Notes

- Colors reuse the existing theme (`VOICE_AGENT_CONFIG.ui`): idle orange `#FF6B35`,
  listening orange-red `#FF3E00`, speaking gold `#FFC107`, error red.
- The ✕ collapses to (1); it does NOT end an active call unless the user explicitly stops.
- The status line under the mic is the same `#voice-agent-status` text used today, so the
  error/close-code messages (debug mode) show here too.
- Exact sizing/animation is up to CSS; this is only about placement and states.
```
