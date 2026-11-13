/** Answers a policy question the way Meera would, against the live gates. Pure, so it can be tested. */
export type PolicyAnswer = { verdict: "Allowed, no handoff" | "Needs a human" | "Not allowed"; say: string; source: string; gate?: string };

export function answerPolicy(question: string, gates: Record<string, boolean>): PolicyAnswer {
  const q = question.toLowerCase();
  const gated = (gate: string, say: string, source: string, allowSay: string): PolicyAnswer =>
    gates[gate]
      ? { verdict: "Needs a human", say, source, gate }
      : { verdict: "Allowed, no handoff", say: allowSay, source, gate };

  if (/refund|paisa wapas|money back/.test(q)) {
    const amounts = (q.match(/\d[\d,]*/g) ?? []).map((x) => Number(x.replace(/,/g, "")));
    const big = amounts.some((n) => n >= 25000) || /lakh|full|poora/.test(q);
    return big
      ? gated("Refund above 25,000 rupees", "Ji, ₹25,000 se upar ka refund mere senior colleague approve karte hain. Main case bana kar unhe abhi connect karti hoon.", "Booking and cancellation, article 9, Refund limits", "Ji bilkul, refund original card par 5 se 7 din mein aa jayega. Main process kar rahi hoon.")
      : { verdict: "Allowed, no handoff", say: "Ji bilkul, yeh refund main abhi process kar sakti hoon. Original card par 5 se 7 din mein aa jayega.", source: "Booking and cancellation, article 9, Refund limits" };
  }
  if (/upgrade|bigger room|2br|bada kamra/.test(q)) return gated("Upgrade room type", "Upgrade ke liye approval chahiye hoti hai. Main request note kar ke apne colleague ko bhejti hoon, 5 minute mein jawab milega.", "Member benefits, article 6, Room upgrades", "Ji, availability ho toh main abhi upgrade kar sakti hoon. Ek second, check karti hoon.");
  if (/waive|fee|charge maaf|penalty/.test(q)) return gated("Waive cancellation fee", "Cancellation fee waive karne ka decision ek senior colleague lete hain. Main unhe abhi connect karti hoon.", "Booking and cancellation, article 11, Fee waivers", "Ji, is case mein fee waive ho sakti hai. Main abhi kar deti hoon.");
  if (/extend.*hold|hold.*(extend|badha|longer|48)/.test(q)) return gated("Hold extension beyond 24 h", "24 ghante se zyada hold ke liye approval lagti hai. Main request bhej rahi hoon.", "Booking and cancellation, article 15, Holds", "Ji, main hold 24 ghante aur badha deti hoon.");
  if (/move|reschedule|shift|change.*(date|booking)|next (week|weekend|month)|dates/.test(q)) {
    const inside48 = /today|tomorrow|kal|aaj|48/.test(q);
    if (inside48) return gated("Reschedule inside 48 h", "Check in 48 ghante ke andar hai, isliye reschedule ke liye ek colleague se confirm karna hoga. Main abhi poochti hoon.", "Booking and cancellation, article 14, Reschedule rules", "Ji bilkul, ek baar free reschedule ho sakta hai. Kaun si date dekhun?");
    return { verdict: "Allowed, no handoff", say: "Ji bilkul, aapki booking 48 ghante se pehle hai isliye main ek baar free reschedule kar sakti hoon. Kaun si date dekhun?", source: "Booking and cancellation, article 14, Reschedule rules" };
  }
  if (/cancel/.test(q)) return { verdict: "Allowed, no handoff", say: "Ji, cancellation main kar sakti hoon. 7 din se pehle cancel karne par poori nights wapas aati hain. Confirm karun?", source: "Booking and cancellation, article 9" };
  if (/pet|dog|cat/.test(q)) return { verdict: "Not allowed", say: "Maaf kijiye, resorts mein pets allowed nahi hain, service animals ke alawa.", source: "Resort amenities, article 22, Pets" };
  if (/bill|invoice|charge|payment/.test(q)) return { verdict: "Allowed, no handoff", say: "Ji, main aapka invoice dekh kar bata sakti hoon. Agar koi galat charge hai toh billing case bana doongi.", source: "Billing, article 3, Disputes" };
  return { verdict: "Allowed, no handoff", say: "Ji, main yeh check kar ke batati hoon. Ek second.", source: "No specific article matched, Meera answers from the live lookup" };
}
