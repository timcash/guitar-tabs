export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface CodexBridgeHealth {
  ok: boolean;
  platform: string;
  cwd: string;
  executablePath: string | null;
  commandLabel: string | null;
  error?: string;
}

export type CodexBridgeStatusPhase = 'starting' | 'connected' | 'reconnected' | 'exited';

export type CodexBridgeClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'restart'; cols: number; rows: number }
  | { type: 'interrupt' };

export type CodexBridgeServerMessage =
  | {
      type: 'ready';
      sessionId: string;
      cwd: string;
      commandLabel: string;
      backlog: string;
      isNewSession: boolean;
      isRunning: boolean;
    }
  | { type: 'output'; data: string }
  | { type: 'status'; phase: CodexBridgeStatusPhase; detail: string }
  | { type: 'exit'; exitCode: number | null; signal: number | null }
  | { type: 'error'; message: string };
