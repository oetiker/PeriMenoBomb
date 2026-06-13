import { browser } from '$app/environment';

/** The non-standard event Chromium fires when the app meets the installability
    criteria. Not in the TS DOM lib, so we declare the bits we use. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function computeStandalone(): boolean {
  if (!browser) return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes its own non-standard flag.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// The deferred prompt event (null until Chromium offers it). `installed` flips
// once the app is added; `standalone` is true when already launched installed.
let deferred = $state<BeforeInstallPromptEvent | null>(null);
let installed = $state(false);
const standalone = computeStandalone();

// Register as early as the module is imported so we don't miss the event, which
// can fire shortly after load. Idempotent via the module-scope guard.
if (browser) {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Stop Chromium's own mini-infobar; we drive installation from our button.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
  });
}

export const pwaInstall = {
  /** True only on browsers that gave us a usable install prompt (Chrome/Edge/
      Android). iOS Safari never sets this — installation there is manual. */
  get canInstall() {
    return deferred !== null && !standalone && !installed;
  },
  /** True when running as an installed app, or installed during this session. */
  get isInstalled() {
    return standalone || installed;
  },
  async promptInstall() {
    if (!deferred) return;
    const e = deferred;
    deferred = null; // a prompt can only be used once
    await e.prompt();
    await e.userChoice;
  }
};
