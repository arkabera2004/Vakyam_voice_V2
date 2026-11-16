import { createContext } from "react";
import type { Me } from "@/hooks/useOrg";
import type { ConsoleState } from "./state";

export type Ctx = {
  state: ConsoleState;
  /** The signed-in user: profile name and organisation role. */
  me: Me;
  /** Shallow-merge a patch, or compute one from the previous state. */
  update: (patch: Partial<ConsoleState> | ((s: ConsoleState) => Partial<ConsoleState>)) => void;
  /** Prepend an audit row, as every governed change must. */
  log: (change: string, version: string, who?: string) => void;
  reset: () => void;
};

export const ConsoleCtx = createContext<Ctx | null>(null);
