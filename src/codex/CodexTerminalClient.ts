import type {
  CodexBridgeClientMessage,
  CodexBridgeHealth,
  CodexBridgeServerMessage,
  TerminalSize
} from '../../shared/codex/CodexBridgeTypes';

export type CodexTerminalClientLifecycle = 'connecting' | 'connected' | 'disconnected' | 'error';

interface CodexTerminalClientOptions {
  sessionId: string;
  onMessage: (message: CodexBridgeServerMessage) => void;
  onLifecycleChange: (phase: CodexTerminalClientLifecycle, detail: string) => void;
}

const HEALTH_PATH = '/api/codex/health';
const TERMINAL_SOCKET_PATH = '/codex-bridge';

export class CodexTerminalClient {
  private socket: WebSocket | null = null;
  private readonly sessionId: string;
  private readonly onMessage: (message: CodexBridgeServerMessage) => void;
  private readonly onLifecycleChange: (phase: CodexTerminalClientLifecycle, detail: string) => void;

  constructor(options: CodexTerminalClientOptions) {
    this.sessionId = options.sessionId;
    this.onMessage = options.onMessage;
    this.onLifecycleChange = options.onLifecycleChange;
  }

  public async fetchHealth() {
    const response = await fetch(this.buildHttpUrl(HEALTH_PATH), {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Codex bridge health check failed with status ${response.status}.`);
    }

    return (await response.json()) as CodexBridgeHealth;
  }

  public connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.onLifecycleChange('connecting', 'Connecting to the local Codex bridge...');

    const socket = new WebSocket(this.buildWebSocketUrl());
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.onLifecycleChange('connected', 'Bridge connected. Starting Codex...');
    });

    socket.addEventListener('message', (event) => {
      const parsedMessage = this.parseMessage(event.data);
      if (!parsedMessage) return;
      this.onMessage(parsedMessage);
    });

    socket.addEventListener('close', (event) => {
      if (this.socket === socket) {
        this.socket = null;
      }

      const detail = event.reason || 'The Codex bridge connection closed.';
      this.onLifecycleChange('disconnected', detail);
    });

    socket.addEventListener('error', () => {
      this.onLifecycleChange('error', 'Unable to reach the Codex bridge. Start `npm run dev:bridge` or `npm run dev:codex`.');
    });
  }

  public disconnect() {
    this.socket?.close(1000, 'Client disconnected');
    this.socket = null;
  }

  public sendInput(data: string) {
    this.send({
      type: 'input',
      data
    });
  }

  public resize(size: TerminalSize) {
    this.send({
      type: 'resize',
      cols: size.cols,
      rows: size.rows
    });
  }

  public restart(size: TerminalSize) {
    this.send({
      type: 'restart',
      cols: size.cols,
      rows: size.rows
    });
  }

  public interrupt() {
    this.send({
      type: 'interrupt'
    });
  }

  private send(message: CodexBridgeClientMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  private parseMessage(payload: string | ArrayBuffer | Blob) {
    if (typeof payload !== 'string') {
      return null;
    }

    try {
      return JSON.parse(payload) as CodexBridgeServerMessage;
    } catch {
      this.onLifecycleChange('error', 'The Codex bridge returned malformed JSON.');
      return null;
    }
  }

  private buildHttpUrl(pathname: string) {
    const configuredOrigin = import.meta.env.VITE_CODEX_BRIDGE_URL;
    const baseUrl = configuredOrigin ? new URL(configuredOrigin) : new URL(window.location.origin);
    baseUrl.pathname = pathname;
    baseUrl.search = '';
    return baseUrl.toString();
  }

  private buildWebSocketUrl() {
    const configuredOrigin = import.meta.env.VITE_CODEX_BRIDGE_URL;
    const socketUrl = configuredOrigin ? new URL(configuredOrigin) : new URL(window.location.origin);
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    socketUrl.pathname = TERMINAL_SOCKET_PATH;
    socketUrl.search = '';
    socketUrl.searchParams.set('sessionId', this.sessionId);
    return socketUrl.toString();
  }
}
