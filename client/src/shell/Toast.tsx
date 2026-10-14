import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ToastFn = (message: string) => void;

const ToastContext = createContext<ToastFn>(() => {});

/** `const toast = useToast(); toast("Saved")` */
export const useToast = (): ToastFn => useContext(ToastContext);

const AUTO_DISMISS_MS = 2600;

export function ToastHost({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const toast = useCallback<ToastFn>((next) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setMessage(next);
    timerRef.current = window.setTimeout(() => setMessage(null), AUTO_DISMISS_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {message && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-card border border-line bg-surface-3 px-4 py-2.5 text-sm text-ink shadow-elev-2"
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
