export interface SnackbarSpec {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
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
    timer = setTimeout(() => { current = null; timer = null; }, d);
  },
  dismiss() {
    clearTimer();
    current = null;
  },
  invokeAction() {
    const c = current;
    if (!c) return;
    c.onAction?.();
    this.dismiss();
  }
};
