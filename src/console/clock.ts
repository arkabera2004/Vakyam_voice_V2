/** Wall-clock labels in India Standard Time, where the desk is. Pure, so they can be tested. */
const IST = "Asia/Kolkata";

export function todayLabel(now = new Date()): string {
  const date = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: IST });
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: IST });
  return `${date}, ${time} IST`;
}

export function istHour(now = new Date()): number {
  return Number(now.toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: IST }).slice(0, 2));
}

export function greeting(now = new Date()): string {
  const h = istHour(now);
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** "14:10" in IST. */
export function istClock(now = new Date()): string {
  return now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: IST });
}
