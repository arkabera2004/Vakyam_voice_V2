import { useContext } from "react";
import { ConsoleCtx } from "./context";

export function useConsole() {
  const ctx = useContext(ConsoleCtx);
  if (!ctx) throw new Error("useConsole must be used inside ConsoleProvider");
  return ctx;
}
