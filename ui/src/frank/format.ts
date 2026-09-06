/** Small display helpers. Pure, so they are tested directly. */

/** "45s", "3m 05s", "2h 07m", "3d 4h" — compact enough for a status line. */
export function formatUptime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "unknown";
  }

  const seconds = Math.floor(totalSeconds);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;

  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** An ISO timestamp shown in the reader's own locale, or the raw value. */
export function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleString();
}

/** Reduce anything thrown into a sentence the console can show. */
export function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") return error.message;
  if (typeof error === "string" && error.trim() !== "") return error;
  return "Frank could not be reached.";
}

/** Pretty-print a tool result for display. */
export function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}
