export type MaterialCategory =
  | "Plastic"
  | "Glass"
  | "Metal"
  | "Biodegradable"
  | "Rubber";

export type Role = "Buyer" | "Seller";

export type ListingStatus = "Live" | "Reserved" | "Sold" | "Draft";

export type SortOption =
  | "Nearest first"
  | "Heaviest first"
  | "Lowest price";

export type RadiusOption =
  | "Within 5 km"
  | "Within 10 km"
  | "Within 25 km"
  | "All Lagos State";

export interface Listing {
  id: string;
  title: string;
  material: MaterialCategory;
  weight: number;
  price: string;
  distance: number;
  seller: string;
  verified: boolean;
  conf: number;
  zone: string;
  /** Label or remote photo URL */
  photo: string;
  photoUrl?: string | null;
  /** Cover + additional product photos */
  photoUrls?: string[];
  status?: ListingStatus;
  views?: number;
  createdAt?: string;
}

export interface MyListing {
  id: string;
  title: string;
  ref: string;
  date: string;
  material: MaterialCategory;
  weight: number;
  price: string;
  status: ListingStatus;
  views: number;
  photoUrl?: string | null;
  photoUrls?: string[];
}

export interface Faq {
  q: string;
  a: string;
}

export interface HeroStat {
  v: string;
  unit: string;
  k: string;
}

export interface HowStep {
  n: string;
  t: string;
  d: string;
  meta: string;
}

export interface Thread {
  name: string;
  subject: string;
  time: string;
  preview: string;
}

export interface ChatMessage {
  id?: string;
  me: boolean;
  text: string;
  time: string;
  createdAt?: string;
  replyToId?: string | null;
  replyText?: string | null;
  imageUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
}

export interface PipelineItem {
  t: string;
  s: string;
}

export interface PipelineStage {
  stage: string;
  count: number;
  items: PipelineItem[];
}

export interface Txn {
  material: string;
  party: string;
  weight: number;
  value: string;
  co2: number;
  date: string;
}

export interface SellerStat {
  k: string;
  v: string;
  sub: string;
}

export interface ActivityItem {
  t: string;
  s: string;
  time: string;
  /** Dot accent color */
  dot: string;
}

export interface TodoItem {
  t: string;
  s: string;
  cta: string;
  href: string;
}

export interface PulseItem {
  label: string;
  note: string;
  pct: number;
}

export interface NavLink {
  href: string;
  label: string;
}

/** [month, achieved kg, target kg] */
export type ChartPoint = [string, number, number];

/** [label, kg] */
export type StreamPoint = [string, number];
