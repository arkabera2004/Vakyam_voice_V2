/** Inbound rules in the order Meera checks them. Pure, so it can be tested and simulated. */
export type SimInput = { tier: "Platinum" | "Gold" | "Silver"; hour: number; lang: "Hindi" | "English" | "Mixed"; queueWait: number; intent: "Booking or hold" | "Refund over 25,000" | "Upgrade" | "Billing" | "Complaint" };

export type SimResult = { rule: number; route: string; why: string; thenHuman?: string };

export function routeCall(i: SimInput): SimResult {
  const afterHours = i.hour >= 21 || i.hour < 8;
  const needsHuman = i.intent === "Refund over 25,000" || i.intent === "Upgrade";
  const human = needsHuman ? `Rule 5: ${i.intent.toLowerCase()} always ends in a warm transfer to a human once Meera has the details.` : undefined;
  if (i.tier === "Platinum") return { rule: 1, route: "Meera, concierge prompt", why: "Platinum members skip the queue.", thenHuman: human };
  if (afterHours) return { rule: 3, route: "Meera, with a callback task at 08:30", why: `It is ${String(i.hour).padStart(2, "0")}:00, after hours. The morning desk finishes anything Meera cannot.`, thenHuman: human };
  if (i.queueWait > 20) return { rule: 4, route: "Human queue, summary attached", why: `Wait is ${i.queueWait} s, over the 20 s overflow limit.` };
  return { rule: 2, route: `Meera, opens in ${i.lang === "Mixed" ? "Hindi and follows the switch" : i.lang}`, why: "Language detected in the first 6 seconds.", thenHuman: human };
}
