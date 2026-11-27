// toast.tsx — minimal toast store (Lane C, token-verify programme).
//
// The app shows exactly one toast ('Watch-only wallet added.', from
// import-wallet.tsx), so the 32 KB sonner library was replaced with this
// ~1 KB store + the Toaster in sonner.tsx. Same behaviour for that call
// site: a toast appears top-right and dismisses itself after 4 seconds
// (sonner's default duration). The API mirrors the sonner surface the
// app used (toast(), toast.success/error/info/warning(), toast.dismiss())
// so call sites do not change.
//
// Lane P2-B (M4): the transaction lifecycle needs more than a
// fire-and-forget message — one toast per transaction, updated in
// place across its stages, with an explorer link and per-stage
// auto-dismiss times. The store gains exactly that, and nothing
// else: an optional action link and duration per toast, update(id)
// that rewrites a toast in place (resetting its timer), and
// dismiss(id) for one toast. push() without options behaves exactly
// as before, so the existing call site is untouched.
import { useSyncExternalStore } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning' | 'normal';

export type ToastAction = {
  label: string;
  href: string;
};

export type ToastItem = {
  id: number;
  message: string;
  kind: ToastKind;
  action?: ToastAction;
  /** Auto-dismiss delay in ms. 0 means the toast stays until dismissed or updated. */
  durationMs: number;
};

export type ToastOptions = {
  action?: ToastAction;
  /** Auto-dismiss delay in ms. Defaults to 4000 (sonner's default). 0 stays. */
  durationMs?: number;
};

/** Auto-dismiss delay in ms (sonner's default). */
const TOAST_DURATION_MS = 4000;

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function clearTimer(id: number): void {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

function scheduleDismiss(id: number, durationMs: number): void {
  clearTimer(id);
  if (durationMs <= 0) return;
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      items = items.filter((item) => item.id !== id);
      emit();
    }, durationMs),
  );
}

function push(kind: ToastKind, message: string, options?: ToastOptions): number {
  const id = nextId++;
  const durationMs = options?.durationMs ?? TOAST_DURATION_MS;
  items = [
    ...items,
    {
      id,
      message,
      kind,
      action: options?.action,
      durationMs,
    },
  ];
  emit();
  scheduleDismiss(id, durationMs);
  return id;
}

/** Rewrite a toast in place — same id, new stage — and restart its timer. */
function update(
  id: number,
  patch: {
    message?: string;
    kind?: ToastKind;
    action?: ToastAction | null;
    durationMs?: number;
  },
): void {
  const existing = items.find((item) => item.id === id);
  if (existing === undefined) return;
  const durationMs = patch.durationMs ?? existing.durationMs;
  items = items.map((item) =>
    item.id === id
      ? {
          ...item,
          message: patch.message ?? item.message,
          kind: patch.kind ?? item.kind,
          action: patch.action === undefined ? item.action : (patch.action ?? undefined),
          durationMs,
        }
      : item,
  );
  emit();
  scheduleDismiss(id, durationMs);
}

function dismiss(id?: number): void {
  if (id === undefined) {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    items = [];
  } else {
    clearTimer(id);
    items = items.filter((item) => item.id !== id);
  }
  emit();
}

/** True while the toast is still on screen — the lifecycle poll stops when it is not. */
function exists(id: number): boolean {
  return items.some((item) => item.id === id);
}

export const toast = Object.assign(
  (message: string, options?: ToastOptions): number => push('normal', message, options),
  {
    success: (message: string, options?: ToastOptions): number =>
      push('success', message, options),
    error: (message: string, options?: ToastOptions): number =>
      push('error', message, options),
    info: (message: string, options?: ToastOptions): number =>
      push('info', message, options),
    warning: (message: string, options?: ToastOptions): number =>
      push('warning', message, options),
    update,
    dismiss,
    exists,
  },
);

/** The live toast list, for the Toaster component. */
export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, () => items);
}
