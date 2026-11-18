import { create } from "zustand";

export interface Toast {
  id: string;
  message: string;
  type: "error" | "warning" | "info" | "success";
  /** Auto-dismiss after ms (default: 5000, 0 = persistent) */
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  /** Convenience: show an error toast */
  showError: (message: string) => void;
  /** Convenience: show a warning toast */
  showWarning: (message: string) => void;
  /** Convenience: show an info toast */
  showInfo: (message: string) => void;
  /** Convenience: show a success toast */
  showSuccess: (message: string) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++nextId}`;
    const duration = toast.duration ?? 5000;
    // Same message twice in a row (e.g. hammering Ctrl+S) should refresh the
    // existing toast instead of stacking copies
    const others = get().toasts.filter(
      (t) => !(t.message === toast.message && t.type === toast.type),
    );
    set({ toasts: [...others, { ...toast, id }] });
    if (duration > 0) {
      setTimeout(() => get().removeToast(id), duration);
    }
  },

  removeToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  showError: (message) => get().addToast({ message, type: "error", duration: 8000 }),
  showWarning: (message) => get().addToast({ message, type: "warning", duration: 6000 }),
  showInfo: (message) => get().addToast({ message, type: "info" }),
  showSuccess: (message) => get().addToast({ message, type: "success" }),
}));
