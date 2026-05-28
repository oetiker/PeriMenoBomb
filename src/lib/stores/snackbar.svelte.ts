export interface SnackbarSpec {
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  durationMs?: number;
}

let current = $state<SnackbarSpec | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (timer) { clearTimeout(timer); timer = null; }
}

export const snackbar = {
  get current() { return current; },
  show(spec: SnackbarSpec) {
    clearTimer();
    current = spec;
    const d = spec.durationMs ?? 5000;
    // d <= 0 or Infinity → no auto-dismiss; user must invoke the action or
    // explicitly dismiss. Useful for SW „update verfügbar"-Toast.
    if (Number.isFinite(d) && d > 0) {
      timer = setTimeout(() => { current = null; timer = null; }, d);
    }
  },
  dismiss() {
    clearTimer();
    current = null;
  },
  async invokeAction() {
    const c = current;
    if (!c) return;
    try {
      await c.onAction?.();
    } finally {
      this.dismiss();
    }
  }
};
