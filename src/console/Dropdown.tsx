import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Btn } from "./ui";

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  prefix,
  className,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  /** Shown before the value, e.g. "Sort: ". */
  prefix?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Btn size="sm" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {prefix}
        {value} <ChevronDown className="h-3.5 w-3.5" />
      </Btn>
      {open && (
        <ul role="listbox" className="absolute right-0 z-20 mt-1 min-w-[200px] rounded-lg border border-zinc-200 bg-white p-1 shadow-lg">
          {options.map((o) => (
            <li key={o}>
              <button
                type="button"
                role="option"
                aria-selected={o === value}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-zinc-100", o === value && "font-medium")}
              >
                {o}
                {o === value && <Check className="h-3.5 w-3.5 text-[#E2703A]" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
