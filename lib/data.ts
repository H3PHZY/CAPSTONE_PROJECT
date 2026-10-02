import type {
  ActivityItem,
  ChartPoint,
  Faq,
  HeroStat,
  HowStep,
  MaterialCategory,
  ChatMessage,
  PipelineStage,
  PulseItem,
  RadiusOption,
  SellerStat,
  StreamPoint,
  Thread,
  TodoItem,
  Txn,
} from "./types";

export const CATS: MaterialCategory[] = [
  "Plastic",
  "Glass",
  "Metal",
  "Biodegradable",
  "Rubber",
];

export const RADII: Record<RadiusOption, number> = {
  "Within 5 km": 5,
  "Within 10 km": 10,
  "Within 25 km": 25,
  "All Lagos State": 999,
};

export const FAQS: Faq[] = [
  {
    q: "Is it free to list?",
    a: "Yes. Listing, classification and messaging are free for the full six-week pilot. There is no commission. Buyers and sellers agree price and share bank details or payment proof in chat.",
  },
  {
    q: "How accurate is the AI classification?",
    a: "The model targets at least 75% accuracy on locally sourced industrial waste images across five categories (Plastic, Glass, Metal, Rubber, Biodegradable — including wood and cardboard). Every result shows its confidence score, anything below 60% is flagged for review, and you can override the classification manually before publishing.",
  },
  {
    q: "Who arranges transport?",
    a: "The buyer does, in almost every exchange. You agree a pickup window in chat and share the exact address once you accept the enquiry — EcoLoop does not move material itself during the pilot.",
  },
  {
    q: "How is the carbon figure calculated?",
    a: "Each completed exchange multiplies the recovered weight by an LCA reference emission factor for that material versus virgin extraction. These are estimates for feedback, not certified offsets, and are labelled as such everywhere they appear.",
  },
  {
    q: "Is this a research pilot?",
    a: "Yes — EcoLoop is being deployed as part of a BSE capstone study in the Ogba–Ikeja cluster. Platform activity is analysed anonymously with your written consent, no data is shared with regulators, and you can withdraw at any time.",
  },
];

export const HERO_STATS: HeroStat[] = [
  { v: "18.4", unit: "tonnes CO₂e", k: "diverted from landfill since February" },
  { v: "147", unit: "exchanges", k: "completed between cluster SMEs" },
  { v: "36.8", unit: "tonnes", k: "material kept out of dump sites" },
];

export const HOW_STEPS: HowStep[] = [
  {
    n: "01",
    t: "Photograph the pile",
    d: "One clear shot is enough. EcoLoop classifies the stream and suggests a category you can override.",
    meta: "~15 seconds",
  },
  {
    n: "02",
    t: "Publish nearby",
    d: "Add weight, asking price and pickup zone. Verified buyers in the cluster see it instantly.",
    meta: "Under 60 seconds total",
  },
  {
    n: "03",
    t: "Agree & track impact",
    d: "Message in-app, reserve the lot, complete the exchange, and see the CO₂e you diverted.",
    meta: "Pilot · free messaging",
  },
];

export const ACTIVITY: ActivityItem[] = [
  {
    t: "New enquiry on aluminium offcuts",
    s: "Loop Recyclers asked about tomorrow pickup",
    time: "12:14",
    dot: "oklch(0.62 0.14 155)",
  },
  {
    t: "Listing viewed 18 times",
    s: "HDPE drums · last 24 hours",
    time: "11:02",
    dot: "oklch(0.72 0.12 85)",
  },
  {
    t: "Exchange marked complete",
    s: "Carton bales · +264 kg CO₂e logged",
    time: "09:40",
    dot: "oklch(0.55 0.02 150)",
  },
];

export const TODOS: TodoItem[] = [
  {
    t: "Reply to Loop Recyclers",
    s: "They want to collect 180 kg tomorrow morning",
    cta: "Open chat",
    href: "/messages",
  },
  {
    t: "Confirm steel swarf weight",
    s: "Buyer asked if 50 kg can be held until Friday",
    cta: "Respond",
    href: "/messages",
  },
  {
    t: "List surplus from this week",
    s: "Photo, classify and publish in under a minute",
    cta: "New listing",
    href: "/listings/new",
  },
];

export const PULSE: PulseItem[] = [
  { label: "Metal", note: "High demand", pct: 82 },
  { label: "Plastic", note: "Steady", pct: 64 },
  { label: "Rubber", note: "Tyres & scrap", pct: 47 },
  { label: "Biodegradable", note: "Wood · paper · organics", pct: 52 },
];

export const SELLER_STATS: SellerStat[] = [
  { k: "LIVE", v: "3", sub: "visible in marketplace" },
  { k: "RESERVED", v: "1", sub: "buyer hold" },
  { k: "SOLD", v: "4", sub: "completed exchanges" },
  { k: "VIEWS", v: "246", sub: "across your listings" },
];

export const PIPELINE: PipelineStage[] = [
  {
    stage: "Interest",
    count: 2,
    items: [
      { t: "Aluminium offcuts", s: "Loop Recyclers" },
      { t: "PET flake", s: "GreenWay Collect" },
    ],
  },
  {
    stage: "Reserved",
    count: 1,
    items: [{ t: "Steel swarf", s: "Alafia Packaging" }],
  },
  {
    stage: "Completed",
    count: 3,
    items: [
      { t: "Carton bales", s: "Kola Print · 231 kg CO₂e" },
      { t: "HDPE drums", s: "Loop Recyclers · 182 kg CO₂e" },
      { t: "Pallet wood", s: "Sunrise · 279 kg CO₂e" },
    ],
  },
];

export const THREADS: Thread[] = [
  {
    name: "Loop Recyclers",
    subject: "ECL-0141 · Aluminium offcuts",
    time: "12:12",
    preview: "Agreed. Sending the transfer reference now…",
  },
  {
    name: "Alafia Packaging",
    subject: "ECL-0138 · Steel swarf",
    time: "10:41",
    preview: "Can you hold 50 kg until Friday?",
  },
  {
    name: "Gari Mills Ltd",
    subject: "ECL-0129 · Pallet timber",
    time: "Yesterday",
    preview: "What is the moisture level on the timber?",
  },
  {
    name: "Bola Bottling Co.",
    subject: "ECL-0126 · Glass rejects",
    time: "Mon",
    preview: "We collect weekly from Ogba, happy to add you.",
  },
];

export const INITIAL_MSGS: ChatMessage[] = [
  {
    me: false,
    text: "Good afternoon. I saw your aluminium offcuts listing — is the full 180 kg still available?",
    time: "12:04",
  },
  {
    me: true,
    text: "Yes, all 180 kg is available. Mixed gauge, mostly 1.5–3 mm sheet, dry and free of paint.",
    time: "12:06",
  },
  {
    me: false,
    text: "Perfect. We are on Acme Road, about 1.4 km from you. Can we collect tomorrow morning with our own truck?",
    time: "12:09",
  },
  {
    me: true,
    text: "That works. Gate opens 8am, ask for Tunde at the loading bay. Payment on collection by transfer.",
    time: "12:11",
  },
  {
    me: false,
    text: "Agreed. Sending the transfer reference now — please mark the listing as reserved for us.",
    time: "12:12",
  },
];

export const CHART_DATA: ChartPoint[] = [
  ["Feb", 1200, 1800],
  ["Mar", 1680, 2000],
  ["Apr", 2100, 2200],
  ["May", 2460, 2500],
  ["Jun", 2800, 2800],
  ["Jul", 3100, 3000],
  ["Aug", 3400, 3200],
  ["Sep", 3600, 3400],
];

export const STREAM_DATA: StreamPoint[] = [
  ["Metal", 7200],
  ["Plastic", 4100],
  ["Biodegradable", 5600],
  ["Glass", 1400],
  ["Rubber", 2100],
];

export const TXNS: Txn[] = [
  {
    material: "Metal",
    party: "Loop Recyclers",
    weight: 180,
    value: "52,000",
    co2: 756,
    date: "4 Sep",
  },
  {
    material: "Plastic",
    party: "Alafia Packaging",
    weight: 96,
    value: "31,500",
    co2: 182,
    date: "2 Sep",
  },
  {
    material: "Biodegradable",
    party: "Kola Print & Pack",
    weight: 240,
    value: "18,000",
    co2: 264,
    date: "28 Aug",
  },
];

export const QUICK_REPLIES = [
  "Still available",
  "Send pickup address",
  "Here are my transfer details",
  "Payment proof attached",
] as const;

export const PICKUP_LOCATIONS = [
  "Ogba Industrial Estate",
  "Ikeja Industrial Estate",
  "Isolo",
  "Apapa",
] as const;

export const SORT_OPTIONS = [
  "Nearest first",
  "Heaviest first",
  "Lowest price",
] as const;

export const RADIUS_OPTIONS = Object.keys(RADII) as RadiusOption[];
