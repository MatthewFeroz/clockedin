# Clockedin

A small Electron focus app with:

- `Clock In` start screen
- local session timer
- distraction counter
- 15-second refocus popup
- local SQLite persistence

## Tooling

This repo is `Bun-first`.

## Install

```bash
bun install
```

`bun install` triggers an Electron-native rebuild for `better-sqlite3` automatically.

## Run

```bash
bun run dev
```

## What works

- clock in and start a focus session
- see a live distraction count
- get a small popup refocus window after a recorded distraction
- store sessions and distraction history locally
- use built-in distraction buttons to test the flow

## Manual smoke test

1. Start the app with `bun run dev`.
2. Click `Clock In`.
3. Click one of the built-in buttons like `YouTube`.
4. Verify:
   - a distraction is recorded
   - the popup appears
   - the countdown runs for 15 seconds
   - the distraction count updates

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

- the app is still using manual distraction triggers for the main flow
- browser and native enforcement integrations are optional extras, not the primary path
- Windows enforcement is not implemented
