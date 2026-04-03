import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import type { CodexBridgeHealth, TerminalSize } from '../../shared/codex/CodexBridgeTypes';

export type CodexTerminalViewPhase = 'starting' | 'connecting' | 'connected' | 'disconnected' | 'error' | 'exited';
export type CodexPromptTone = 'idle' | 'queued' | 'sent' | 'error';

interface CodexTerminalViewCallbacks {
  onConnect: () => void;
  onRestart: () => void;
  onInterrupt: () => void;
  onClearTerminal: () => void;
  onTerminalInput: (data: string) => void;
  onTerminalResize: (size: TerminalSize) => void;
}

export class CodexTerminalView {
  private readonly root: HTMLDivElement;
  private readonly callbacks: CodexTerminalViewCallbacks;
  private terminal: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private terminalHost: HTMLDivElement | null = null;
  private statusPill: HTMLSpanElement | null = null;
  private statusText: HTMLParagraphElement | null = null;
  private sessionValue: HTMLParagraphElement | null = null;
  private cwdValue: HTMLParagraphElement | null = null;
  private commandValue: HTMLParagraphElement | null = null;
  private promptValue: HTMLParagraphElement | null = null;
  private promptBadge: HTMLSpanElement | null = null;
  private bridgeValue: HTMLParagraphElement | null = null;
  private connectButton: HTMLButtonElement | null = null;
  private restartButton: HTMLButtonElement | null = null;
  private interruptButton: HTMLButtonElement | null = null;
  private clearButton: HTMLButtonElement | null = null;

  constructor(root: HTMLDivElement, callbacks: CodexTerminalViewCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
  }

  public render() {
    document.title = 'Codex - guitar-tabs';
    document.body.classList.add('codex-route');

    this.root.classList.add('codex-route-root');
    this.root.innerHTML = `
      <div class="codex-shell">
        <div class="codex-terminal-surface" data-codex-terminal></div>

        <div class="codex-actions">
          <button type="button" class="codex-action-btn" data-codex-connect>Reconnect</button>
          <button type="button" class="codex-action-btn" data-codex-restart>Restart</button>
          <button type="button" class="codex-action-btn" data-codex-interrupt>Ctrl+C</button>
          <button type="button" class="codex-action-btn" data-codex-clear>Clear</button>
        </div>
      </div>
    `;

    this.statusPill = this.root.querySelector<HTMLSpanElement>('.codex-status-pill');
    this.statusText = this.root.querySelector<HTMLParagraphElement>('.codex-status-copy');
    this.sessionValue = this.root.querySelector<HTMLParagraphElement>('[data-codex-session]');
    this.cwdValue = this.root.querySelector<HTMLParagraphElement>('[data-codex-cwd]');
    this.commandValue = this.root.querySelector<HTMLParagraphElement>('[data-codex-command]');
    this.promptValue = this.root.querySelector<HTMLParagraphElement>('[data-codex-prompt]');
    this.promptBadge = this.root.querySelector<HTMLSpanElement>('.codex-prompt-badge');
    this.bridgeValue = this.root.querySelector<HTMLParagraphElement>('[data-codex-bridge]');
    this.connectButton = this.root.querySelector<HTMLButtonElement>('[data-codex-connect]');
    this.restartButton = this.root.querySelector<HTMLButtonElement>('[data-codex-restart]');
    this.interruptButton = this.root.querySelector<HTMLButtonElement>('[data-codex-interrupt]');
    this.clearButton = this.root.querySelector<HTMLButtonElement>('[data-codex-clear]');
    this.terminalHost = this.root.querySelector<HTMLDivElement>('[data-codex-terminal]');

    this.root.querySelector<HTMLButtonElement>('[data-codex-connect]')?.addEventListener('click', this.callbacks.onConnect);
    this.root.querySelector<HTMLButtonElement>('[data-codex-restart]')?.addEventListener('click', this.callbacks.onRestart);
    this.root.querySelector<HTMLButtonElement>('[data-codex-interrupt]')?.addEventListener('click', this.callbacks.onInterrupt);
    this.root.querySelector<HTMLButtonElement>('[data-codex-clear]')?.addEventListener('click', this.callbacks.onClearTerminal);

    this.mountTerminal();
  }

  public dispose() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.fitAddon = null;
    this.terminal?.dispose();
    this.terminal = null;
    document.body.classList.remove('codex-route');
  }

  public clearTerminal() {
    this.terminal?.clear();
  }

  public focusTerminal() {
    this.terminal?.focus();
  }

  public resizeTerminal() {
    this.fitTerminal();
  }

  public write(data: string) {
    this.terminal?.write(data);
  }

  public writeln(data: string) {
    this.terminal?.writeln(data);
  }

  public getTerminalSize(): TerminalSize {
    return {
      cols: this.terminal?.cols ?? 120,
      rows: this.terminal?.rows ?? 34
    };
  }

  public setConnectionState(phase: CodexTerminalViewPhase, detail: string) {
    if (this.statusPill) {
      this.statusPill.textContent = phaseLabelMap[phase];
      this.statusPill.className = `codex-status-pill codex-status-pill--${phase}`;
    }

    if (this.statusText) {
      this.statusText.textContent = detail;
    }

    if (this.connectButton) {
      this.connectButton.textContent = phase === 'connected' ? 'Reconnect' : 'Connect';
    }
  }

  public setSessionMeta(sessionId: string, cwd: string, commandLabel: string) {
    if (this.sessionValue) {
      this.sessionValue.textContent = `session ${sessionId}`;
    }

    if (this.cwdValue) {
      this.cwdValue.textContent = `cwd ${cwd}`;
    }

    if (this.commandValue) {
      this.commandValue.textContent = `cmd ${commandLabel}`;
    }
  }

  public setPromptState(tone: CodexPromptTone, detail: string) {
    if (this.promptBadge) {
      this.promptBadge.textContent = promptToneLabelMap[tone];
      this.promptBadge.className = `codex-prompt-badge codex-prompt-badge--${tone}`;
    }

    if (this.promptValue) {
      this.promptValue.textContent = detail;
    }
  }

  public setBridgeHealth(health: CodexBridgeHealth | null, fallbackMessage: string) {
    if (!this.bridgeValue) {
      return;
    }

    if (!health) {
      this.bridgeValue.textContent = fallbackMessage;
      return;
    }

    if (!health.ok) {
      this.bridgeValue.textContent = health.error ?? fallbackMessage;
      return;
    }

    this.bridgeValue.textContent = `${health.executablePath ?? 'codex'} on ${health.platform}`;
  }

  public setTerminalInputEnabled(isEnabled: boolean) {
    if (this.terminal) {
      this.terminal.options.disableStdin = !isEnabled;
    }
  }

  public setBridgeActionAvailability(options: {
    canConnect: boolean;
    canRestart: boolean;
    canInterrupt: boolean;
    canClear?: boolean;
  }) {
    if (this.connectButton) {
      this.connectButton.disabled = !options.canConnect;
    }

    if (this.restartButton) {
      this.restartButton.disabled = !options.canRestart;
    }

    if (this.interruptButton) {
      this.interruptButton.disabled = !options.canInterrupt;
    }

    if (this.clearButton && options.canClear !== undefined) {
      this.clearButton.disabled = !options.canClear;
    }
  }

  private mountTerminal() {
    if (!this.terminalHost) {
      return;
    }

    this.fitAddon = new FitAddon();
    this.terminal = new Terminal({
      fontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
      fontSize: 15,
      lineHeight: 1.15,
      cursorBlink: true,
      allowTransparency: true,
      convertEol: true,
      theme: {
        background: '#000000',
        foreground: '#cfcfcf',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(255, 255, 255, 0.18)',
        black: '#000000',
        brightBlack: '#6d6d6d',
        green: '#bdbdbd',
        brightGreen: '#ffffff',
        yellow: '#c7c7c7',
        brightYellow: '#ffffff',
        red: '#b0b0b0',
        brightRed: '#ffffff',
        cyan: '#c9c9c9',
        brightCyan: '#ffffff',
        white: '#d9d9d9',
        brightWhite: '#ffffff'
      }
    });

    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(this.terminalHost);
    this.terminal.onData(this.callbacks.onTerminalInput);

    this.resizeObserver = new ResizeObserver(() => {
      this.fitTerminal();
    });
    this.resizeObserver.observe(this.terminalHost);

    requestAnimationFrame(() => {
      this.fitTerminal();
      this.terminal?.focus();
    });
  }

  private fitTerminal() {
    if (!this.terminal || !this.fitAddon) {
      return;
    }

    this.fitAddon.fit();
    this.callbacks.onTerminalResize(this.getTerminalSize());
  }
}

const phaseLabelMap: Record<CodexTerminalViewPhase, string> = {
  starting: 'Starting',
  connecting: 'Connecting',
  connected: 'Connected',
  disconnected: 'Offline',
  error: 'Error',
  exited: 'Exited'
};

const promptToneLabelMap: Record<CodexPromptTone, string> = {
  idle: 'Idle',
  queued: 'Queued',
  sent: 'Sent',
  error: 'Error'
};
