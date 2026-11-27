import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';

/** Open sheets, the topmost last: Escape closes only that one. */
const openSheets: symbol[] = [];

/**
 * A modal panel: slides up from the bottom on phones, centred on wider
 * screens. Escape, the backdrop and the back gesture's button close it.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const self = Symbol('sheet');
    openSheets.push(self);
    const returnTo = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-backdrop])',
    );
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openSheets.at(-1) === self) close.current();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      openSheets.splice(openSheets.indexOf(self), 1);
      document.body.style.overflow = overflow;
      returnTo?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        data-backdrop
        tabIndex={-1}
        aria-label="Bezárás"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px]"
      />
      <div
        ref={panel}
        // Not <dialog>: jsdom (tests) has no showModal(), and this needs
        // nothing from it that the effect above does not already do.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-zinc-50 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl dark:bg-zinc-900"
      >
        <h2 id={titleId} className="mb-4 text-lg font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel: string;
}

/**
 * Asks before something that cannot be undone. Render the returned element
 * once; `confirm()` resolves to `true` when the user agrees.
 */
export function useConfirm() {
  const [request, setRequest] = useState<{
    options: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setRequest({ options, resolve })),
    [],
  );

  const finish = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  const element = (
    <Sheet
      open={request !== null}
      title={request?.options.title ?? ''}
      onClose={() => finish(false)}
    >
      <div className="text-[15px] text-zinc-600 dark:text-zinc-300">
        {request?.options.message}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => finish(false)}>
          Mégse
        </Button>
        <Button variant="danger" onClick={() => finish(true)}>
          {request?.options.confirmLabel}
        </Button>
      </div>
    </Sheet>
  );

  return [element, confirm] as const;
}
