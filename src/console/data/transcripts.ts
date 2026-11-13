import { CALL_4821_TOOLS, CALL_4821_TRANSCRIPT, type LiveCall, type Turn } from "./calls";

export type ToolRow = { name: string; detail: string; state: "done" | "running" | "queued" };

const first = (c: LiveCall) => c.name.split(" ")[0];
const resort = (c: LiveCall) => c.step.match(/Lonavala|Goa|Kumbhalgarh|Mussoorie/)?.[0] ?? "Goa";
const room = (c: LiveCall) => c.step.match(/Studio|1BR|2BR/)?.[0] ?? "1BR";

/**
 * Builds a believable transcript and tool trace for every live call from its
 * current step and sentiment. Call 4821 keeps its hand-written script.
 */
export function transcriptFor(c: LiveCall): { turns: Turn[]; tools: ToolRow[]; next: string } {
  if (c.id === 4821) return { turns: CALL_4821_TRANSCRIPT, tools: CALL_4821_TOOLS, next: `Confirm the hold, read back dates, offer a callback if Priya's husband needs to confirm. No policy gate on this request.` };

  const f = first(c);
  const hi = c.hi >= 50;
  const open: Turn[] = [
    { t: "00:05", who: "Meera", langs: ["HI"], text: "Namaste, Club Mahindra se Meera bol rahi hoon, ek AI sahayak. Yeh call record ho sakti hai. Aap theek hain?" },
  ];
  const lookup: ToolRow = { name: "lookup_caller", detail: `Member ${20000 + c.id}, ${c.tier}, ${hi ? "Hindi" : "English"}. ${180 + (c.id % 7) * 11} ms`, state: "done" };

  if (c.step.startsWith("lookup_caller")) {
    return {
      turns: [...open, { t: "00:17", who: f, langs: hi ? ["HI"] : ["EN"], text: hi ? "Haan theek hai. Mujhe apni booking ke baare mein poochna tha." : "Yes, fine. I want to ask about my booking." }, { t: "00:24", who: "Meera is speaking", langs: [], text: hi ? "Zaroor, ek second, main aapka account dekh rahi hoon" : "Of course, one second while I pull up your account", live: true }],
      tools: [{ ...lookup, state: "running", detail: `Looking up +91 98XXX XX${String(c.id).slice(-3)}` }, { name: "log_call", detail: "Queued for end of call", state: "queued" }],
      next: `Greet ${f} by name once the lookup returns, then ask what they need.`,
    };
  }
  if (c.step.startsWith("check_availability")) {
    const r = resort(c), rm = room(c);
    return {
      turns: [...open, { t: "00:19", who: f, langs: hi ? ["HI", "EN"] : ["EN"], text: hi ? `Mujhe ${r} mein ek ${rm} chahiye, next month.` : `I am looking for a ${rm} in ${r} next month.` }, { t: "00:31", who: "Meera", langs: ["HI"], text: `Zaroor ${f} ji. Main ${r} ki availability check karti hoon.` }, { t: "00:52", who: "Meera is speaking", langs: [], text: `${r} mein ${rm} do options ke saath available hai, main dates padhti hoon`, live: true }],
      tools: [lookup, { name: "check_availability", detail: `${r}, ${rm}, next month. 2 options. ${600 + (c.id % 5) * 30} ms`, state: "done" }, { name: "log_call", detail: "Queued for end of call", state: "queued" }],
      next: `Read back both options, offer a 24 hour hold on the one ${f} prefers. No policy gate.`,
    };
  }
  if (c.step.startsWith("place_hold")) {
    const r = resort(c), rm = room(c);
    return {
      turns: [...open, { t: "00:21", who: f, langs: hi ? ["HI", "EN"] : ["EN"], text: hi ? `${r} ka ${rm} hold kar dijiye please.` : `Please hold the ${rm} in ${r} for me.` }, { t: "00:30", who: "Meera", langs: ["EN", "HI"], text: `Sure. Main ${rm} ko 24 ghante ke liye hold karti hoon, koi payment abhi nahi lagegi.` }, { t: "00:44", who: f, langs: ["EN"], text: "Yes please, go ahead." }, { t: "00:46", who: "Meera is speaking", langs: [], text: "Ho gaya. Hold kal is time tak valid hai", live: true }],
      tools: [lookup, { name: "check_availability", detail: `${r}, ${rm}. 1 option. 640 ms`, state: "done" }, { name: "place_hold", detail: `${r} ${rm}, expires in 24 h, no payment taken`, state: "running" }, { name: "log_call", detail: "Queued for end of call", state: "queued" }],
      next: `Confirm the expiry time and offer to send the payment link. Hold is inside the ${c.tier} limit.`,
    };
  }
  if (c.step.startsWith("create_case")) {
    return {
      turns: [...open, { t: "00:18", who: f, langs: ["EN"], text: "My last invoice has a charge I do not recognise, 2,400 rupees for a club fee." }, { t: "00:29", who: "Meera", langs: ["EN"], text: "I am sorry about that. I will raise a billing case so the accounts team reviews it within two working days." }, { t: "00:41", who: f, langs: ["EN", "HI"], text: "Okay. Aur mujhe iska reference number chahiye." }, { t: "00:43", who: "Meera is speaking", langs: [], text: "Bilkul, case ban raha hai, ek second", live: true }],
      tools: [lookup, { name: "create_case", detail: "Billing, 2,400 rupee club fee query, priority normal", state: "running" }, { name: "log_call", detail: "Queued for end of call", state: "queued" }],
      next: `Read the case number back digit by digit. Billing disputes do not need a human unless ${f} asks for one.`,
    };
  }
  if (c.step.startsWith("answering")) {
    return {
      turns: [...open, { t: "00:16", who: f, langs: ["EN"], text: "What is the cancellation policy if I cancel ten days before check in?" }, { t: "00:27", who: "Meera", langs: ["EN"], text: "For a cancellation more than seven days before check in, the full nights are returned to your account with no fee." }, { t: "00:40", who: f, langs: ["EN"], text: "And inside seven days?" }, { t: "00:42", who: "Meera is speaking", langs: [], text: "Inside seven days, half the nights are returned, and a full refund needs a review", live: true }],
      tools: [lookup, { name: "knowledge_lookup", detail: "Booking and cancellation, article 9. 140 ms", state: "done" }, { name: "log_call", detail: "Queued for end of call", state: "queued" }],
      next: "Cite the article, do not promise a waiver. Waivers are a policy gate.",
    };
  }
  if (c.step.startsWith("warm transfer")) {
    return {
      turns: [...open, { t: "06:40", who: f, langs: ["HI"], text: "Mujhe kisi insaan se baat karni hai, abhi." }, { t: "06:48", who: "Meera", langs: ["HI", "EN"], text: `Samajh gayi ${f} ji. Main aapko Asha ji se connect karti hoon, unhe sab pata hoga.` }, { t: "08:50", who: "Meera is speaking", langs: [], text: "Please hold, Asha ji 30 second mein line par aa rahi hain", live: true }],
      tools: [lookup, { name: "create_case", detail: "Complaint, housekeeping at Goa, priority high", state: "done" }, { name: "handoff", detail: "Warm transfer to Asha Nair, summary attached, ringing", state: "running" }],
      next: `Hand over as soon as Asha accepts. ${f} asked for a person twice; do not re-ask questions.`,
    };
  }
  // handoff, waiting approval (Rohan)
  return {
    turns: [...open, { t: "05:41", who: "Meera", langs: ["HI", "EN"], text: "Rohan ji, ₹38,400 ka refund meri limit se upar hai. Main aapko ek senior colleague se connect karti hoon." }, { t: "05:52", who: f, langs: ["HI", "EN"], text: "Theek hai, par mujhe dobara sab kuch explain nahi karna. Refund card mein hi chahiye." }, { t: "06:03", who: "Meera", langs: ["HI", "EN"], text: "Bilkul nahi. Maine sab kuch case #5521 mein likh diya hai. Please hold, Asha ji line par aa rahi hain." }, { t: "06:45", who: "Meera is speaking", langs: [], text: "Thoda aur hold kijiye, approval aa raha hai", live: true }],
    tools: [lookup, { name: "check_availability", detail: "Kumbhalgarh, Studio, Jan. 3 options. 702 ms", state: "done" }, { name: "create_case #5521, draft", detail: "Refund ₹38,400, awaiting human approval", state: "running" }, { name: "handoff", detail: "Warm transfer to Asha Nair, ringing", state: "running" }],
    next: "Nothing more for Meera to say. The refund is a policy gate; approve it on the Warm transfers screen.",
  };
}
