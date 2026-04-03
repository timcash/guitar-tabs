# Codex xterm.js Terminal Outline

## What this is

`/codex` is a browser wrapper around the real local `codex` CLI.

- `xterm.js` is only the terminal renderer in the browser.
- `node-pty` runs the actual CLI process on the local bridge server.
- The browser and bridge talk over a small JSON WebSocket protocol.
- This preserves native Codex behavior such as slash commands, subagents, and cached local auth.

## Main files

- `src/main.ts`: routes `/codex` to `CodexTerminalPage`.
- `src/codex/CodexTerminalPage.ts`: top-level coordinator. Owns session id, initial prompt handling, bridge health checks, and view/client wiring.
- `src/codex/CodexTerminalView.ts`: builds the page UI, creates the `Terminal` and `FitAddon`, forwards keystrokes, and reports terminal resizes.
- `src/codex/CodexTerminalClient.ts`: talks to `/api/codex/health` and `/codex-bridge`, and sends `input`, `resize`, `restart`, and `interrupt`.
- `src/codex/CodexRouteState.ts`: decodes `?prompt=<base64>` so the page can auto-send a prompt after connect.
- `shared/codex/CodexBridgeTypes.ts`: shared wire protocol between browser and server.
- `server/index.ts`: starts the local bridge server on `127.0.0.1:4176`.
- `server/codex/CodexBridgeServer.ts`: HTTP + WebSocket bridge, static asset serving, session lookup, and origin checks.
- `server/codex/CodexSessionRegistry.ts`: caches PTY sessions by `sessionId` so reloads/reconnects can attach to the same CLI.
- `server/codex/CodexPtySession.ts`: spawns the real `codex` process in a PTY, streams output, handles resize/restart/Ctrl+C, and keeps reconnect backlog.
- `server/codex/CodexExecutableResolver.ts`: resolves which `codex` executable to launch.

## Runtime flow

1. User opens `/codex`.
2. `CodexTerminalPage` renders the shell UI and xterm surface, then restores or creates a session id in `localStorage`.
3. The client fetches `/api/codex/health`, then opens `ws://.../codex-bridge?sessionId=...`.
4. `CodexBridgeServer` gets or creates a `CodexPtySession` for that id and calls `ensureStarted(...)`.
5. `CodexPtySession` launches the real `codex` CLI through `node-pty` in the repo root.
6. The server sends a `ready` snapshot, including session metadata, whether the process is running, and any backlog text.
7. Browser input is forwarded as raw terminal data via `input`; xterm resize events become `resize`.
8. PTY output is streamed back as `output`; lifecycle updates arrive as `status`, `exit`, or `error`.
9. The toolbar triggers reconnect, restart, interrupt (`Ctrl+C`), and local terminal clear.
10. If `?prompt=<base64>` is present, the page decodes it and sends it once after the first `ready`.

## Important behaviors

- This is PTY-backed, not an emulated Codex UI and not `codex app-server`.
- Session continuity depends on the browser reusing the same `sessionId` and the bridge process staying alive.
- Restart kills the PTY and spawns a fresh `codex` process inside the same session object.
- Reconnect snapshots use a capped backlog buffer of 200k chars.
- In dev, Vite on `5174` proxies `/api/codex` and `/codex-bridge` to the bridge on `4176`.
- In preview mode, the bridge server also serves the built frontend from `dist`.
- WebSocket upgrades are restricted to localhost-style origins.
