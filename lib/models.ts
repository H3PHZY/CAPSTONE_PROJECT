/**
 * Database row shapes returned by the EcoLoop Django REST API.
 */

export type MaterialCategory =
  | "Plastic"
  | "Glass"
  | "Metal"
  | "Biodegradable"
  | "Rubber";

export type ListingStatus = "Draft" | "Live" | "Reserved" | "Sold";

export type TransactionStatus = "Interest" | "Reserved" | "Completed" | "Cancelled";

export type ProfileRow = {
  id: string;
  business_name: string;
  phone: string | null;
  cluster: string;
  zone: string | null;
  address: string;
  sells: boolean;
  buys: boolean;
  carbon_impact: boolean;
  research_consent: boolean;
  verified: boolean;
  avatar_url?: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
};

export type ListingRow = {
  id: string;
  seller_id: string;
  title: string;
  material: MaterialCategory;
  weight_kg: number;
  price_ngn: number | null;
  status: ListingStatus;
  photo_url: string | null;
  /** Extra gallery images; cover remains photo_url. Optional until migration 008. */
  photo_urls?: string[];
  zone: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  views: number;
  created_at: string;
  updated_at: string;
};

export type ClassificationRow = {
  id: string;
  listing_id: string;
  predicted_material: MaterialCategory;
  confidence: number;
  overridden: boolean;
  final_material: MaterialCategory;
  model_id: string | null;
  raw_labels: Record<string, number> | null;
  created_at: string;
  updated_at: string;
};

export type TransactionRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: TransactionStatus;
  completed_at: string | null;
  payment_ref?: string | null;
  paid_at?: string | null;
  pending_payment_ref?: string | null;
  pending_payment_expires_at?: string | null;
  deal_price_ngn?: number | null;
  amount_ngn: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type CarbonRecordRow = {
  id: string;
  transaction_id: string;
  material: MaterialCategory;
  weight_kg: number;
  co2e_kg: number;
  factor_kg_per_kg: number;
  notes: string | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  listing_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  reply_to: string | null;
  image_url: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  created_at: string;
};