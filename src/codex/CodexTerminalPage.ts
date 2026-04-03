import type { CodexBridgeServerMessage, TerminalSize } from '../../shared/codex/CodexBridgeTypes';
import { CodexTerminalClient, type CodexTerminalClientLifecycle } from './CodexTerminalClient';
import { parseCodexRouteState } from './CodexRouteState';
import { CodexTerminalView } from './CodexTerminalView';

const SESSION_STORAGE_KEY = 'guitar-tabs.codex.session-id';
const IS_CODEX_STATIC_OFFLINE =
  import.meta.env.VITE_CODEX_OFFLINE === '1' || import.meta.env.VITE_CODEX_OFFLINE === 'true';

export class CodexTerminalPage {
  private readonly routeState = parseCodexRouteState(window.location.search);
  private readonly sessionId = this.resolveSessionId();
  private readonly client: CodexTerminalClient;
  private readonly view: CodexTerminalView;
  private initialPromptSent = false;
  private shouldPrintHelpMenuOnReady = true;

  constructor(root: HTMLDivElement) {
    this.client = new CodexTerminalClient({
      sessionId: this.sessionId,
      onMessage: this.handleBridgeMessage,
      onLifecycleChange: this.handleLifecycleChange
    });
    this.view = new CodexTerminalView(root, {
      onConnect: this.handleConnect,
      onRestart: this.handleRestart,
      onInterrupt: this.handleInterrupt,
      onClearTerminal: this.handleClearTerminal,
      onTerminalInput: this.handleTerminalInput,
      onTerminalResize: this.handleTerminalResize
    });
  }

  public async render() {
    this.view.render();
    this.view.setSessionMeta(this.sessionId, window.location.origin, 'Waiting for Codex bridge...');
    this.view.setConnectionState(
      IS_CODEX_STATIC_OFFLINE ? 'disconnected' : 'starting',
      IS_CODEX_STATIC_OFFLINE
        ? 'Codex is offline in this static GitHub Pages build.'
        : 'Preparing a browser terminal for the local Codex CLI.'
    );
    this.applyInitialPromptState();
    this.view.setBridgeActionAvailability({
      canConnect: !IS_CODEX_STATIC_OFFLINE,
      canRestart: !IS_CODEX_STATIC_OFFLINE,
      canInterrupt: !IS_CODEX_STATIC_OFFLINE,
      canClear: true
    });
    this.view.setTerminalInputEnabled(!IS_CODEX_STATIC_OFFLINE);

    if (IS_CODEX_STATIC_OFFLINE) {
      this.view.setSessionMeta(this.sessionId, 'static-site', 'OFFLINE');
      this.view.writeln('');
      buildOfflineMenuLines().forEach((line) => {
        this.view.writeln(line);
      });
      this.view.writeln('');
      return;
    }

    window.addEventListener('beforeunload', this.handleBeforeUnload);

    await this.refreshBridgeHealth();
    this.client.connect();
  }

  private readonly handleBridgeMessage = (message: CodexBridgeServerMessage) => {
    switch (message.type) {
      case 'ready':
        localStorage.setItem(SESSION_STORAGE_KEY, message.sessionId);
        this.view.setSessionMeta(message.sessionId, message.cwd, message.commandLabel);
        if (message.backlog.length > 0) {
          this.view.write(message.backlog);
        }
        this.view.setConnectionState(
          message.isRunning ? 'connected' : 'exited',
          message.isRunning
            ? `Codex session ready in ${message.cwd}.`
            : 'Codex session is available but not currently running.'
        );
        if (this.shouldPrintHelpMenu(message)) {
          this.printHelpMenu();
          this.shouldPrintHelpMenuOnReady = false;
        }
        this.sendInitialPromptIfNeeded();
        break;

      case 'output':
        this.view.write(message.data);
        break;

      case 'status':
        this.view.setConnectionState(mapBridgeStatusToViewPhase(message.phase), message.detail);
        break;

      case 'exit':
        this.view.setConnectionState(
          'exited',
          `Codex exited with code ${message.exitCode ?? 'null'}${message.signal ? ` and signal ${message.signal}` : ''}.`
        );
        this.view.writeln('');
        this.view.writeln(`[bridge] Codex exited with code ${message.exitCode ?? 'null'}.`);
        break;

      case 'error':
        this.view.setConnectionState('error', message.message);
        this.view.writeln('');
        this.view.writeln(`[bridge] ${message.message}`);
        break;
    }
  };

  private readonly handleLifecycleChange = async (phase: CodexTerminalClientLifecycle, detail: string) => {
    const mappedPhase = lifecycleToViewPhase[phase];
    this.view.setConnectionState(mappedPhase, detail);

    if (phase === 'connected') {
      this.view.focusTerminal();
      this.view.resizeTerminal();
    }

    if (phase === 'error' || phase === 'disconnected') {
      await this.refreshBridgeHealth();
    }
  };

  private readonly handleConnect = () => {
    this.client.connect();
    this.view.focusTerminal();
  };

  private readonly handleRestart = () => {
    this.view.setConnectionState('starting', 'Restarting the Codex CLI session...');
    this.shouldPrintHelpMenuOnReady = true;
    this.client.restart(this.view.getTerminalSize());
    this.view.focusTerminal();
  };

  private readonly handleInterrupt = () => {
    this.client.interrupt();
    this.view.writeln('');
    this.view.writeln('[bridge] Sent Ctrl+C.');
    this.view.focusTerminal();
  };

  private readonly handleClearTerminal = () => {
    this.view.clearTerminal();
    this.view.focusTerminal();
  };

  private readonly handleTerminalInput = (data: string) => {
    this.client.sendInput(data);
  };

  private readonly handleTerminalResize = (size: TerminalSize) => {
    this.client.resize(size);
  };

  private readonly handleBeforeUnload = () => {
    this.client.disconnect();
    this.view.dispose();
  };

  private applyInitialPromptState() {
    if (this.routeState.promptDecodeError) {
      this.view.setPromptState('error', this.routeState.promptDecodeError);
      return;
    }

    if (this.routeState.initialPrompt) {
      this.view.setPromptState('queued', buildPromptPreview(this.routeState.initialPrompt));
      return;
    }

    this.view.setPromptState('idle', 'No base64 prompt was provided.');
  }

  private sendInitialPromptIfNeeded() {
    if (this.initialPromptSent || !this.routeState.initialPrompt) {
      return;
    }

    this.initialPromptSent = this.sendRoutePrompt(this.routeState.initialPrompt);
  }

  private async refreshBridgeHealth() {
    try {
      const health = await this.client.fetchHealth();
      this.view.setBridgeHealth(health, 'Codex bridge is offline.');
    } catch {
      this.view.setBridgeHealth(null, 'Codex bridge is offline on http://127.0.0.1:4176.');
    }
  }

  private resolveSessionId() {
    const existingSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    return existingSessionId && existingSessionId.length > 0 ? existingSessionId : crypto.randomUUID();
  }

  private sendRoutePrompt(prompt: string) {
    if (prompt.trim().length === 0) {
      this.view.setPromptState('error', 'Prompt is empty.');
      return false;
    }

    this.client.sendInput(prompt);
    this.client.sendInput('\r');
    this.view.setPromptState('sent', buildPromptPreview(prompt));
    this.view.writeln('');
    this.view.writeln('[route] Sent decoded ?prompt= payload to Codex.');
    return true;
  }

  private shouldPrintHelpMenu(message: Extract<CodexBridgeServerMessage, { type: 'ready' }>) {
    return this.shouldPrintHelpMenuOnReady || (message.isNewSession && message.backlog.length === 0);
  }

  private printHelpMenu() {
    const helpLines = buildHelpMenuLines();
    this.view.writeln('');
    helpLines.forEach((line) => {
      this.view.writeln(line);
    });
    this.view.writeln('');
  }
}

const lifecycleToViewPhase = {
  connecting: 'connecting',
  connected: 'connecting',
  disconnected: 'disconnected',
  error: 'error'
} as const;

function mapBridgeStatusToViewPhase(phase: 'starting' | 'connected' | 'reconnected' | 'exited') {
  switch (phase) {
    case 'starting':
      return 'starting';
    case 'connected':
    case 'reconnected':
      return 'connected';
    case 'exited':
      return 'exited';
  }
}

function buildPromptPreview(prompt: string) {
  const compact = prompt.replace(/\s+/g, ' ').trim();
  if (compact.length <= 96) {
    return compact;
  }

  return `${compact.slice(0, 93)}...`;
}

function buildHelpMenuLines() {
  return [
    '[codex] web terminal ready',
    '[help] bridge mode: dangerous full access, no approval prompts',
    '[help] type directly in the terminal',
    '[help] /help /status /agent /new /resume are available inside Codex CLI',
    '[help] Ctrl+C interrupts the active Codex run',
    '[help] /codex?prompt=<base64> auto-sends a decoded prompt on page load'
  ];
}

function buildOfflineMenuLines() {
  return [
    '[codex] OFFLINE',
    '[help] this GitHub Pages build does not include the local Codex bridge',
    '[help] the guitar player and /readme work as a static site',
    '[help] /codex becomes interactive again when you run the app with the local backend bridge',
    '[help] optional ?prompt=<base64> values are ignored while offline'
  ];
}
