import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Btn } from "./ui";

/** Small centred dialog. Closes on Escape, backdrop click or the X. */
export function Modal({ title, hint, onClose, children, footer }: { title: string; hint?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    box.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm text-zinc-800">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = "h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400";

export function ModalActions({ onCancel, onOk, okLabel = "Save", okDisabled, danger }: { onCancel: () => void; onOk: () => void; okLabel?: string; okDisabled?: boolean; danger?: boolean }) {
  return (
    <>
      <Btn size="sm" onClick={onCancel}>Cancel</Btn>
      <Btn size="sm" variant={danger ? "dark" : "primary"} onClick={onOk} disabled={okDisabled}>{okLabel}</Btn>
    </>
  );
}
