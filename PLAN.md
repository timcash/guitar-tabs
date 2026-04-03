# Codex Web Terminal Plan

Goal: add a `/codex` route that opens a browser-hosted terminal using `xterm.js` and lets the user talk to the local Codex CLI with existing credentials already set up on the machine.

This plan is intentionally biased toward the simplest path that preserves native Codex behavior, including subagents and slash commands.

## 1. Product Goal

Typing `/codex` in the browser should open a full-page Codex terminal.

The user should be able to:

- start a Codex CLI session from the browser
- type prompts directly into the terminal
- use native Codex slash commands
- use subagent workflows from the real Codex CLI
- switch subagent threads with native CLI behavior such as `/agent`
- reuse already-cached Codex credentials without re-authenticating in the browser

## 2. Key Decision

Use a real PTY-backed Codex CLI session for the first implementation.

Why this is the right MVP:

- `codex` interactive CLI is documented as a stable terminal UI
- subagent activity is already surfaced in the Codex app and CLI
- `/agent` is already a native CLI slash command for switching active agent threads
- existing CLI auth caching already works for the CLI
- `codex app-server` exists, but it is documented as experimental

So the first version should embed the actual Codex CLI in the webpage instead of rebuilding Codex behavior from JSON events.

## 3. Official Fact Base

These points were checked against official OpenAI docs:

- Codex CLI is a local terminal coding agent:
  - https://developers.openai.com/codex/cli
- `codex` interactive mode is stable, while `codex app-server` is experimental:
  - https://developers.openai.com/codex/cli/reference
- Subagents are enabled by default, visible in the CLI, and only spawn when explicitly requested:
  - https://developers.openai.com/codex/subagents
- `/agent` is the CLI command for switching active agent threads:
  - https://developers.openai.com/codex/cli/slash-commands
- CLI login is cached locally and reused across launches:
  - https://developers.openai.com/codex/auth

Important authentication note:

- Codex CLI supports both ChatGPT login and API key login
- the CLI caches login details locally in `~/.codex/auth.json` or the OS credential store
- the browser route should not request or store credentials itself
- the server-side bridge should simply launch the local CLI as the current user and let Codex reuse its own cached auth

## 4. Domain Names

Use these names consistently in code and docs.

### UI domains

- `codex-route-ui`
  - the `/codex` page
- `codex-terminal-ui`
  - the `xterm.js` terminal surface
- `codex-toolbar-ui`
  - reconnect, reset, stop, and status controls
- `codex-session-status-ui`
  - session connected/disconnected/starting indicators

### runtime domains

- `codex-pty-bridge`
  - local Node server that bridges browser and PTY
- `codex-session-registry`
  - tracks active browser-to-PTY sessions
- `codex-process-launcher`
  - resolves and starts the `codex` executable
- `codex-terminal-stream`
  - raw terminal bytes flowing between browser and PTY
- `codex-route-router`
  - front-end route selection for `/codex`

### Codex domains

- `codex-cli-session`
  - one real interactive Codex CLI process
- `codex-subagent-workflow`
  - native Codex subagent behavior inside that CLI session
- `codex-credential-source`
  - existing Codex CLI login cache already present on the machine

## 5. Recommended Architecture

### Browser side

The browser owns rendering and keyboard input only.

- render a `/codex` page
- mount `xterm.js`
- connect to a local WebSocket bridge
- write incoming terminal bytes into `xterm.js`
- send keyboard input and resize events back to the bridge

### Local server side

The browser cannot safely or directly spawn local processes, so we need a local Node bridge.

- run a local Node server on `127.0.0.1` only
- expose a WebSocket endpoint such as `/api/codex/terminal`
- create one PTY-backed Codex process per browser session
- forward PTY output to the browser
- forward browser keystrokes and resize events to the PTY

### Codex side

The bridge launches the real CLI:

```text
browser /codex
  -> websocket
  -> local node bridge
  -> node-pty
  -> codex
```

This preserves:

- native prompts
- native slash commands
- native subagent thread UI
- native approvals
- native resume behavior

## 6. Preferred File Hierarchy

```text
src/
  codex/
    CodexTerminalPage.ts
    CodexTerminalView.ts
    CodexTerminalClient.ts
    CodexTerminalTypes.ts
    codexTerminal.css

server/
  codex/
    CodexBridgeServer.ts
    CodexPtySession.ts
    CodexSessionRegistry.ts
    CodexExecutableResolver.ts
    CodexBridgeTypes.ts
  index.ts
```

Existing files to update:

- `src/main.ts`
  - add `/codex` route handling
- `src/style.css`
  - add page-level layout styling or import a route-specific stylesheet
- `package.json`
  - add terminal and server dependencies
  - add scripts for dev and production

## 7. Dependency Plan

Frontend:

- `@xterm/xterm`
- `@xterm/addon-fit`
- optional:
  - `@xterm/addon-web-links`
  - `@xterm/addon-search`

Backend:

- `node-pty`
- `ws`
- optional:
  - `express` or a minimal Node HTTP server
  - `concurrently` for combined dev scripts

## 8. Route Plan

### `/codex`

This route should:

- replace the guitar player layout with a full terminal page
- show a terminal header with:
  - current cwd
  - connection state
  - restart session action
  - stop session action
- automatically connect to the local bridge
- start a Codex CLI session in the repo root by default

### dev routing

In development:

- keep Vite serving the frontend
- run the bridge server separately
- proxy WebSocket traffic from Vite to the bridge server

### local production routing

For a local packaged version:

- serve the built frontend from the same Node process
- expose the WebSocket bridge on the same origin

## 9. Session Lifecycle

### startup

1. user opens `/codex`
2. browser opens WebSocket to local bridge
3. bridge creates PTY
4. bridge launches `codex` in the repo cwd
5. terminal output streams into the browser

### active session

The user interacts with the real Codex CLI.

That means the browser route inherits native Codex behavior for:

- prompts
- slash commands
- approvals
- subagent spawning
- `/agent` thread switching
- resume flows

### restart

The toolbar should support:

- hard restart of the PTY session
- reconnect if browser refreshes
- stop current session

## 10. Credentials Plan

The browser must not manage Codex credentials.

Instead:

- the bridge launches the local `codex` process as the current OS user
- Codex reuses its own cached login
- no API key or ChatGPT token is passed through frontend state
- no credential entry UI is added in the browser

Assumption from docs:

- Codex caches login details locally and reuses them across launches
- because we are launching the local CLI itself, the `/codex` route should inherit that cached auth automatically

Implementation rule:

- treat this as a local-only feature
- do not expose this terminal route to untrusted remote users

## 11. Security Plan

This feature should be local-first and private by default.

Required protections:

- bind the bridge server to `127.0.0.1` only
- do not expose the bridge to LAN or the public internet
- reject cross-origin access unless it is the local app origin
- keep one browser session attached to one PTY session
- never transmit cached Codex auth contents to the browser
- do not add any feature that reveals `~/.codex/auth.json`

Important OpenAI guidance to respect:

- programmatic Codex workflows should not be exposed in untrusted or public environments

## 12. Windows Preflight

This repo is on Windows, and there is one known risk:

- `Get-Command codex` resolves to `codex.exe`
- direct `codex --help` from the current shell sandbox returned an access-denied error during planning

So the first implementation step must be a real Node-based spawn test.

Preflight checklist:

1. resolve the actual `codex` executable path from Node
2. confirm `node-pty` can launch it
3. confirm the terminal renders correctly in `xterm.js`
4. confirm a session reaches the existing cached auth without prompting

If this fails:

- add a Windows-specific launcher wrapper
- or fall back to a typed `codex app-server` integration for the first version

## 13. Implementation Phases

### Phase 1: terminal bridge proof of life

- add Node bridge server
- add `node-pty`
- launch `codex` in repo cwd
- stream PTY output into a test browser page
- verify keyboard input and resize

Acceptance:

- browser terminal shows the real Codex CLI prompt

### Phase 2: `/codex` route

- add `CodexTerminalPage`
- add xterm mounting and fit behavior
- connect the route to the WebSocket bridge
- add minimal toolbar and connection state

Acceptance:

- visiting `/codex` opens a full terminal page

### Phase 3: auth reuse validation

- verify existing ChatGPT or API key login is reused
- verify no browser auth prompt is needed
- verify browser refresh does not corrupt auth state

Acceptance:

- user can start Codex from `/codex` with existing credentials only

### Phase 4: native subagent workflows

- verify prompting Codex to spawn subagents works from the browser terminal
- verify `/agent` works inside the browser terminal
- verify approvals and thread switches remain usable

Acceptance:

- user can create and inspect subagent work from `/codex`

### Phase 5: session controls

- restart session
- stop session
- reconnect after page reload
- optionally persist one session id in browser memory for reconnect

Acceptance:

- the page behaves like a robust local terminal surface

## 14. Acceptance Criteria

The feature is complete when:

- `/codex` opens a real browser terminal
- the terminal is powered by `xterm.js`
- input is TypeScript-driven on the frontend
- the local bridge launches the real `codex` CLI
- existing cached Codex auth is reused automatically
- the user can type prompts and receive output
- the user can use native slash commands
- the user can use subagents through normal Codex behavior
- `/agent` works in the browser-hosted terminal
- the bridge is local-only and not exposed publicly

## 15. Stretch Goal: Typed Control Plane

After the PTY version works, we can optionally add a second integration path based on `codex app-server`.

Why it is a stretch goal, not MVP:

- docs mark `codex app-server` as experimental
- the PTY route gives native CLI behavior faster

Why it is still valuable later:

- structured JSON-RPC messages
- typed TypeScript schemas via:
  - `codex app-server generate-ts --out ./schemas`
- thread history APIs
- better custom UI for subagent thread lists, approvals, and history

Recommended future hybrid:

- keep `xterm.js` for the terminal feel
- add an optional right sidebar backed by `codex app-server`
- use it for:
  - thread list
  - subagent status
  - turn interrupts
  - thread resume/fork/history

## 16. Suggested Scripts

Add scripts like:

```json
{
  "dev:web": "vite",
  "dev:codex-bridge": "tsx server/index.ts",
  "dev:full": "concurrently \"npm run dev:web\" \"npm run dev:codex-bridge\""
}
```

If the bridge and frontend are unified later, replace these with one local app host.

## 17. Nice-to-Have UX

Not required for first ship:

- sticky session reconnect
- dark terminal theme tuned to match the rest of the app
- copy/paste helpers
- terminal clear button
- quick-start buttons that inject useful prompts
- a small helper banner explaining:
  - subagents only run when explicitly requested
  - use `/agent` to switch threads

## 18. Recommended First Task

Implement only the smallest vertical slice first:

1. add the bridge
2. spawn `codex` in a PTY
3. connect `xterm.js`
4. mount it at `/codex`

Do not start with custom subagent UI.
The real CLI already gives that behavior.
