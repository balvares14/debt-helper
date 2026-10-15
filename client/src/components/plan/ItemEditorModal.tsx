/**
 * Popup shell for adding or editing a debt, income item, or expense.
 */

import { useEffect, type ReactNode } from "react";

export function ItemEditorModal({
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
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-stretch justify-center overflow-y-auto bg-[rgba(15,23,42,0.28)] p-0 sm:items-start sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-editor-title"
        className="flex min-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-surface-1 shadow-elev-3 sm:min-h-0 sm:my-8 sm:rounded-lg sm:border sm:border-line"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 py-3 sm:px-4">
          <h2 id="item-editor-title" className="text-sm font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-xs px-1.5 py-0.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:max-h-[min(40rem,calc(100vh-8rem))] sm:p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
