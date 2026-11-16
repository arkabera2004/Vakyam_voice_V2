import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useOrg } from "@/hooks/useOrg";
import { DEFAULT_STATE, KEY, nowLabel, type ConsoleState } from "./state";
import { ConsoleCtx, type Ctx } from "./context";

function load(): ConsoleState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConsoleState>(load);
  const me = useOrg();

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* private mode: demo still works for this tab */
    }
  }, [state]);

  const update = useCallback<Ctx["update"]>((patch) => setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) })), []);
  const log = useCallback<Ctx["log"]>((change, version, who = me.name) => update((s) => ({ audit: [{ when: nowLabel(), who, change, version }, ...s.audit] })), [update, me.name]);
  const reset = useCallback(() => setState(DEFAULT_STATE), []);

  const value = useMemo(() => ({ state, me, update, log, reset }), [state, me, update, log, reset]);
  return <ConsoleCtx.Provider value={value}>{children}</ConsoleCtx.Provider>;
}
