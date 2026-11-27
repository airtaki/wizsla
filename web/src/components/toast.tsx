import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from './ui';

interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
}

type Notify = (message: string, tone?: Toast['tone']) => void;

const ToastContext = createContext<Notify>(() => {});

const SHOW_MS = 4_000;

/** Short messages above the tab bar; the same message is shown once. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const notify = useCallback<Notify>((message, tone = 'info') => {
    const id = nextId.current++;
    setToasts((list) => [
      ...list.filter((t) => t.message !== message),
      { id, message, tone },
    ]);
    setTimeout(
      () => setToasts((list) => list.filter((t) => t.id !== id)),
      SHOW_MS,
    );
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((toast) => (
          <p
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : undefined}
            className={cn(
              'max-w-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg',
              toast.tone === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900',
            )}
          >
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Notify {
  return useContext(ToastContext);
}
