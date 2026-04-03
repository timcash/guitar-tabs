export interface HandTestState {
  finger: string | null;
  stringNum: number | null;
  x: number | null;
  y: number | null;
  z: number | null;
  curl: number | null;
}

export interface RuntimeTestState {
  elapsedTime: number;
  activeString: number | null;
  note0Z: number | null;
  noteCount: number;
  hand: HandTestState;
}

declare global {
  interface Window {
    __TABS_TEST_STATE__?: RuntimeTestState;
  }
}

export class RuntimeTestBridge {
  public publish(state: RuntimeTestState) {
    window.__TABS_TEST_STATE__ = state;
  }
}
