"use client";

import { useEffect, useState } from 'react';
import { BellIcon } from './Icons';

const ADD_TOAST_EVENT = 'add-toast';

export type Toast = {
  id: number;
  icon: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  closing: boolean;
};

type ToastPayload = Omit<Toast, 'id' | 'closing'>;
type AddToastEvent = CustomEvent<ToastPayload>;

declare global {
  interface WindowEventMap {
    'add-toast': AddToastEvent;
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleAdd = (event: AddToastEvent) => {
      const id = Date.now() + Math.random();
      const newToast: Toast = { ...event.detail, id, closing: false };

      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.map((toast) => (toast.id === id ? { ...toast, closing: true } : toast)));
        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 300);
      }, 3000);
    };

    window.addEventListener(ADD_TOAST_EVENT, handleAdd);
    return () => window.removeEventListener(ADD_TOAST_EVENT, handleAdd);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div id="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type} ${toast.closing ? 'toast-out' : ''}`}>
          {toast.icon === "notification" ? (
            <span className="toast-icon" aria-hidden="true">
              <BellIcon className="toast-icon-svg" />
            </span>
          ) : (
            <span className="toast-icon" aria-hidden="true">{toast.icon}</span>
          )}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

export function showToast(
  icon: string,
  message: string,
  type: 'success' | 'info' | 'warning' | 'error' = 'info',
) {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<ToastPayload>(ADD_TOAST_EVENT, { detail: { icon, message, type } });
    window.dispatchEvent(event);
  }
}
