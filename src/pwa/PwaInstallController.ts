type InstallChoiceOutcome = 'accepted' | 'dismissed';

interface DeferredInstallPromptEvent extends Event {
  readonly platforms?: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: InstallChoiceOutcome; platform: string }>;
}

export interface PwaInstallUiState {
  buttonLabel: string;
  buttonDisabled: boolean;
  helpVisible: boolean;
  helpTitle: string;
  helpBody: string;
  helpSteps: string[];
}

type InstallUiListener = (state: PwaInstallUiState) => void;

export class PwaInstallController {
  private deferredPrompt: DeferredInstallPromptEvent | null = null;
  private helpVisible = false;
  private readonly listeners = new Set<InstallUiListener>();
  private readonly standaloneQuery: MediaQueryList;
  private readonly currentWindow: Window;

  constructor(currentWindow: Window = window) {
    this.currentWindow = currentWindow;
    this.standaloneQuery = this.currentWindow.matchMedia('(display-mode: standalone)');
    this.currentWindow.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt as EventListener);
    this.currentWindow.addEventListener('appinstalled', this.handleAppInstalled);

    if (typeof this.standaloneQuery.addEventListener === 'function') {
      this.standaloneQuery.addEventListener('change', this.handleStandaloneChange);
    } else if (typeof this.standaloneQuery.addListener === 'function') {
      this.standaloneQuery.addListener(this.handleStandaloneChange);
    }
  }

  public subscribe(listener: InstallUiListener) {
    this.listeners.add(listener);
    listener(this.getUiState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  public async requestInstall() {
    if (this.isStandalone()) {
      this.helpVisible = false;
      this.emit();
      return;
    }

    if (this.deferredPrompt) {
      this.helpVisible = false;
      this.emit();

      const promptEvent = this.deferredPrompt;
      this.deferredPrompt = null;

      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice.catch(() => null);
        this.helpVisible = choice?.outcome === 'dismissed';
      } catch {
        this.deferredPrompt = promptEvent;
        this.helpVisible = true;
      }

      this.emit();
      return;
    }

    this.helpVisible = true;
    this.emit();
  }

  public dismissHelp() {
    this.helpVisible = false;
    this.emit();
  }

  private readonly handleBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    this.deferredPrompt = event as DeferredInstallPromptEvent;
    this.emit();
  };

  private readonly handleAppInstalled = () => {
    this.deferredPrompt = null;
    this.helpVisible = false;
    this.emit();
  };

  private readonly handleStandaloneChange = () => {
    if (this.isStandalone()) {
      this.deferredPrompt = null;
      this.helpVisible = false;
    }
    this.emit();
  };

  private emit() {
    const state = this.getUiState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  private getUiState(): PwaInstallUiState {
    if (this.isStandalone()) {
      return {
        buttonLabel: 'INSTALLED',
        buttonDisabled: true,
        helpVisible: false,
        helpTitle: 'Already Installed',
        helpBody: 'This app is already running like an installed app on your device.',
        helpSteps: []
      };
    }

    const help = this.getHelpContent();

    return {
      buttonLabel: help.buttonLabel,
      buttonDisabled: false,
      helpVisible: this.helpVisible,
      helpTitle: help.title,
      helpBody: help.body,
      helpSteps: help.steps
    };
  }

  private getHelpContent() {
    if (this.isIOS()) {
      if (!this.isSafari()) {
        return {
          buttonLabel: 'OPEN IN SAFARI',
          title: 'Open In Safari',
          body: 'On iPhone and iPad, Add to Home Screen is easiest from Safari.',
          steps: [
            'Open this page in Safari.',
            'Tap the Share button.',
            'Scroll down and tap Add to Home Screen.',
            'Tap Add.'
          ]
        };
      }

      return {
        buttonLabel: 'ADD TO HOME SCREEN',
        title: 'Add To Home Screen',
        body: 'Save Guitar Tabs to your iPhone or iPad home screen from Safari.',
        steps: [
          'Tap the Share button in Safari.',
          'Scroll down and tap Add to Home Screen.',
          'Tap Add.'
        ]
      };
    }

    if (this.deferredPrompt) {
      return {
        buttonLabel: 'ADD TO HOME SCREEN',
        title: 'Install This App',
        body: 'Your browser is ready to install Guitar Tabs like an app.',
        steps: [
          'Tap Add To Home Screen below.',
          'Accept the browser install prompt.'
        ]
      };
    }

    return {
      buttonLabel: 'INSTALL HELP',
      title: 'Install This App',
      body: 'If the browser does not show an install prompt automatically, you can still install it from the browser menu.',
      steps: [
        'Open the browser menu.',
        'Choose Install app or Add to Home screen.',
        'Confirm the install.'
      ]
    };
  }

  private isStandalone() {
    return this.standaloneQuery.matches || (this.currentWindow.navigator as Navigator & { standalone?: boolean }).standalone === true;
  }

  private isIOS() {
    const { userAgent, platform, maxTouchPoints } = this.currentWindow.navigator;
    return /iPhone|iPad|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  }

  private isSafari() {
    const userAgent = this.currentWindow.navigator.userAgent;
    return /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(userAgent);
  }
}
