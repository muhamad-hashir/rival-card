// src/services/errorToastService.ts - Global Error & Network Toast Notification Service
export type ToastType = 'warning' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastPayload {
  id: string;
  message: string;
  type: ToastType;
  durationMs?: number; // 0 or undefined for persistent until dismissed or reconnected
  countdownSeconds?: number;
  action?: ToastAction;
}

type ToastListener = (toast: ToastPayload | null) => void;

class ErrorToastService {
  private currentToast: ToastPayload | null = null;
  private listeners: Set<ToastListener> = new Set();
  private autoDismissTimer: NodeJS.Timeout | null = null;

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener(this.currentToast);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentToast);
      } catch (err) {
        console.warn('Toast listener error:', err);
      }
    }
  }

  public show(payload: Omit<ToastPayload, 'id'>): void {
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }

    this.currentToast = {
      ...payload,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    };
    this.notify();

    if (payload.durationMs && payload.durationMs > 0) {
      this.autoDismissTimer = setTimeout(() => {
        this.hide();
      }, payload.durationMs);
    }
  }

  public showWarning(message: string, durationMs = 4000, action?: ToastAction): void {
    this.show({ message, type: 'warning', durationMs, action });
  }

  public showError(message: string, durationMs = 5000, action?: ToastAction): void {
    this.show({ message, type: 'error', durationMs, action });
  }

  public hide(): void {
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
    this.currentToast = null;
    this.notify();
  }

  public getCurrentToast(): ToastPayload | null {
    return this.currentToast;
  }
}

export const errorToastService = new ErrorToastService();
