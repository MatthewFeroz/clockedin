# Clockedin

A small Electron focus app with:

- `Clock In` start screen
- local session timer
- distraction tracker
- 15-second refocus popup
- local SQLite persistence
- desktop-only Windows activity polling for browser tabs and apps

## Tooling

This repo is `Bun-first`.

## Install

```bash
bun install
```

`bun install` triggers an Electron-native rebuild for `better-sqlite3` automatically.
No browser extension or external helper is required for the current Windows flow.

## Run

```bash
bun run dev
```

## What works

- clock in and start a focus session
- track distracting browser tabs on Windows from the active window title
- track distracting native apps from the active process name
- see a live distraction count
- get a small popup refocus window after a tracked distraction
- store sessions and distraction history locally
- use built-in distraction buttons to test the flow

## Manual smoke test

1. Start the app with `bun run dev`.
2. Click `Clock In`.
3. Bring a blocked site like YouTube to the foreground in Brave, Chrome, Edge, or Firefox.
4. Verify:
   - a distraction is recorded
   - the popup appears
   - the countdown runs for 15 seconds
   - the distraction count updates
5. Optionally use one of the built-in buttons to simulate a distraction manually.

## Validation

```bash
bun run typecheck
bun run build
```

If Electron native modules drift after a runtime change, rebuild them with:

```bash
bun run desktop:rebuild-native
```

## Current gaps

- browser detection on Windows is inferred from the active window title, not the exact tab URL
- background tabs are not tracked until they become the active tab
- there is no UI yet for editing the blocked target list
