// Barrel so pages keep importing from "@/console/store" while the provider
// (a component) and the hook live in separate files for Fast Refresh.
export * from "./state";
export { ConsoleProvider } from "./provider";
export { useConsole } from "./useConsole";
