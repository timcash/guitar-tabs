# Guitar Tabs

Mobile-first 3D guitar practice player with a built-in Codex terminal.

## Recent Mobile Screenshots

### Player Stage

![Mobile player stage](docs/screenshots/mobile-player.png)

### Fullscreen Menu

![Mobile fullscreen menu](docs/screenshots/mobile-menu.png)

## Routes

- `/`
  - Mobile guitar player
- `/readme`
  - Full-page markdown preview of this README
- `/codex`
  - Full-page `xterm.js` terminal connected to the local Codex CLI

## Domain Language

Use these names when reading or changing the system:

- `fret-board`
  - 3D strings, frets, and fret labels
- `sliding-notes`
  - Note labels that slide down each string toward the bridge
- `pluck-zone`
  - Bridge-side target area where notes are played
- `picking-fingers`
  - Right-hand finger markers: `p`, `i`, `m`, `a`, `c`
- `chord-fingers`
  - Left-hand chord markers placed on the fret-board
- `next-chord-display`
  - Current and upcoming chord display
- `lyrics-panel-ui`
  - The words shown over the guitar
- `menu-ui`
  - Fullscreen mobile control menu
- `playback-transport`
  - Play, pause, reset, elapsed time
- `audio-pluck`
  - Web Audio pluck synthesis
- `runtime-test-bridge`
  - Browser state published for end-to-end tests

## How The Guitar Works

1. The selected song expands into a timed `chord-timeline`.
2. The `chord-timeline` becomes a `sliding-note-sequence` of string plucks.
3. Each note becomes a `sliding-note` label that moves down one string toward the `pluck-zone`.
4. When a note reaches the bridge, the `audio-pluck` engine plays it and the `picking-fingers` animate the pluck.
5. The active chord updates the `chord-fingers` on the fret-board.
6. The `next-chord-display` shows what chord is active now and what is coming next.
7. The main stage stays minimal: lyrics plus `START/PAUSE` and `MENU`.
8. The fullscreen `menu-ui` holds song selection, tempo, reset, sound, flip, and camera controls.

## How To Use The Guitar Player

1. Open `/`.
2. Tap `START`.
3. Read the lyric line at the top while the `sliding-notes` move toward the bridge.
4. Open `MENU` when you want to change song, tempo, sound, left/right flip, or camera view.
5. Tap `RESET` from the menu to restart the current song.

## Main System Parts

```text
GuitarTabsApp
  AppShellUI
  PlaybackTransport
  SongSession
    SlidingNoteSequenceBuilder
  FretboardRenderer
  AudioPluckEngine
  RuntimeTestBridge
```

## File Map

```text
src/
  app/
    GuitarTabsApp.ts
  ui/
    AppShellUI.ts
    ReadmePreviewPage.ts
  codex/
    CodexTerminalPage.ts
    CodexTerminalView.ts
    CodexRouteState.ts
  domain/
    session/
      SongSession.ts
    timeline/
      SlidingNoteSequenceBuilder.ts
  playback/
    PlaybackTransport.ts
  audio/
    AudioPluckEngine.ts
    NoteNameService.ts
  testing/
    RuntimeTestBridge.ts
  renderer.ts
  virtualHand.ts
  chordDisplay3D.ts
  viewFraming.ts
```

## End-To-End Test Coverage

The browser smoke test covers all user-facing pages:

- `/`
  - Starts playback
  - Opens and closes the fullscreen menu
  - Changes song and tempo
  - Toggles camera, sound, and left/right flip
- `/readme`
  - Verifies the markdown page renders images and scrolls
- `/codex`
  - Verifies `xterm.js` mounts
  - Verifies the action buttons work

## `/codex` Page

`/codex` is a browser terminal for the real local Codex CLI.

How to use it:

1. Open `/codex`.
2. Type directly in the terminal, not in a separate input box.
3. Use normal Codex slash commands such as `/status` and subagent commands from the real CLI.
4. Use the bottom action buttons for quick `Clear` and `Restart`.
5. Optionally preload a prompt with `?prompt=<base64_string>`.

Notes:

- It uses the local Codex credentials already available on the machine.
- It runs the local CLI in dangerous local mode right now, so it is intended for local development only.
- The route is designed to feel like the CLI TUI inside the browser, not a reimplementation of Codex behavior.
