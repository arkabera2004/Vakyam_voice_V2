// Pure helper for Agent Studio's version naming. Separate from
// AgentStudio.tsx so it can be imported without breaking Fast Refresh
// (react-refresh/only-export-components) and unit-tested directly.

/** Next version string after the given list, e.g. v1..v9 -> v10. Falls back to v1 for the first version. */
export function nextVersion(existing: string[]): string {
  const numbers = existing.map((v) => Number(v.replace(/^v/i, ""))).filter((n) => Number.isFinite(n));
  return `v${numbers.length ? Math.max(...numbers) + 1 : 1}`;
}
