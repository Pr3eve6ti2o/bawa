// toast.tsx — minimal toast store (Lane C, token-verify programme).
//
// The app shows exactly one toast ('Watch-only wallet added.', from
// import-wallet.tsx), so the 32 KB sonner library was replaced with this
// ~1 KB store + the Toaster in sonner.tsx. Same behaviour for that call
// site: a toast appears top-right and dismisses itself after 4 seconds
// (sonner's default duration). The API mirrors the sonner surface the
// app used (toast(), toast.success/error/info/warning(), toast.dismiss())
// so call sites do not change.
import { useSyncExternalStore } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning' | 'normal';

type ToastItem = {
  id: number;
  message: string;
  kind: ToastKind;
};

/** Auto-dismiss delay in ms (sonner's default). */
const TOAST_DURATION_MS = 4000;

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function push(kind: ToastKind, message: string): number {
  const id = nextId++;
  items = [...items, { id, message, kind }];
  emit();
  window.setTimeout(() => {
    items = items.filter((item) => item.id !== id);
    emit();
  }, TOAST_DURATION_MS);
  return id;
}

function dismissAll(): void {
  items = [];
  emit();
}

export const toast = Object.assign(
  (message: string): number => push('normal', message),
  {
    success: (message: string): number => push('success', message),
    error: (message: string): number => push('error', message),
    info: (message: string): number => push('info', message),
    warning: (message: string): number => push('warning', message),
    dismiss: (): void => dismissAll(),
  },
);

/** The live toast list, for the Toaster component. */
export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, () => items);
}
