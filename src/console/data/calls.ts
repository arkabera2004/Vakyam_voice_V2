export type Sentiment = "Positive" | "Neutral" | "Frustrated";

export type LiveCall = {
  id: number;
  name: string;
  tier: "Platinum" | "Gold" | "Silver";
  lang: string;
  elapsed: string;
  hi: number; // Hindi share of the call, 0..100
  step: string;
  stepHot?: boolean;
  sentiment: Sentiment;
};

export const LIVE_CALLS: LiveCall[] = [
  { id: 4812, name: "Rohan Mehta", tier: "Platinum", lang: "Hindi lean", elapsed: "06:48", hi: 35, step: "handoff, waiting approval", stepHot: true, sentiment: "Frustrated" },
  { id: 4815, name: "Meenal Joshi", tier: "Silver", lang: "Hindi", elapsed: "09:02", hi: 50, step: "warm transfer to Asha", stepHot: true, sentiment: "Frustrated" },
  { id: 4821, name: "Priya Sharma", tier: "Gold", lang: "prefers Hindi", elapsed: "04:12", hi: 80, step: "check_availability, Lonavala 1BR", sentiment: "Positive" },
  { id: 4822, name: "Anita Iyer", tier: "Gold", lang: "mixes both", elapsed: "03:05", hi: 55, step: "place_hold, Goa 2BR", sentiment: "Neutral" },
  { id: 4823, name: "Neha Kulkarni", tier: "Silver", lang: "Hindi", elapsed: "01:22", hi: 90, step: "lookup_caller", sentiment: "Positive" },
  { id: 4824, name: "Imran Qureshi", tier: "Gold", lang: "English lean", elapsed: "07:30", hi: 20, step: "create_case, billing query", sentiment: "Neutral" },
  { id: 4825, name: "Sunil Deshmukh", tier: "Silver", lang: "Hindi", elapsed: "02:41", hi: 60, step: "check_availability, Mussoorie", sentiment: "Positive" },
  { id: 4826, name: "Kavya Nair", tier: "Platinum", lang: "English", elapsed: "05:17", hi: 30, step: "answering cancellation policy", sentiment: "Neutral" },
  { id: 4827, name: "Arjun Bhatt", tier: "Gold", lang: "Hindi", elapsed: "00:48", hi: 75, step: "lookup_caller", sentiment: "Neutral" },
  { id: 4828, name: "Farhan Sheikh", tier: "Gold", lang: "English lean", elapsed: "03:36", hi: 40, step: "place_hold, Kumbhalgarh", sentiment: "Positive" },
  { id: 4829, name: "Lata Menon", tier: "Silver", lang: "Hindi", elapsed: "02:09", hi: 85, step: "check_availability, Goa", sentiment: "Neutral" },
  { id: 4830, name: "Vikram Rao", tier: "Gold", lang: "mixes both", elapsed: "04:55", hi: 45, step: "place_hold, Lonavala", sentiment: "Positive" },
];

export type Turn = { t: string; who: string; text: string; langs: ("HI" | "EN")[]; live?: boolean; tool?: string };

export const CALL_4821_TRANSCRIPT: Turn[] = [
  { t: "00:06", who: "Meera", langs: ["HI"], text: "Namaste, Club Mahindra se Meera bol rahi hoon, ek AI sahayak. Yeh call record ho sakti hai. Aap theek hain?" },
  { t: "00:19", who: "Priya", langs: ["HI", "EN"], text: "Haan theek hai. Mujhe Lonavala mein ek 1BR chahiye, last week of December." },
  { t: "00:31", who: "Meera", langs: ["HI"], text: "Zaroor Priya ji. Main Lonavala ki availability check karti hoon, ek second." },
  { t: "01:04", who: "Meera", langs: ["EN", "HI"], text: "I have a 1BR from 26 to 30 December, and a Studio on 27 December. Kaunsa better rahega?" },
  { t: "01:22", who: "Priya", langs: ["HI", "EN"], text: "1BR hi chahiye. Please hold it for me, I will confirm with my husband." },
  { t: "01:25", who: "Meera is speaking", langs: [], text: "Bilkul, main 1BR ko 24 ghante ke liye hold karti hoon. Ek minute", live: true },
];

export const CALL_4821_TOOLS: { name: string; detail: string; state: "done" | "running" | "queued" }[] = [
  { name: "lookup_caller", detail: "Member 20418, Gold, Hindi. 212 ms", state: "done" },
  { name: "check_availability", detail: "Lonavala, 1BR, 26 to 30 Dec. 2 options. 640 ms", state: "done" },
  { name: "place_hold, running", detail: "Lonavala 1BR, expires in 24 h, no payment taken", state: "running" },
  { name: "log_call", detail: "Queued for end of call", state: "queued" },
];
