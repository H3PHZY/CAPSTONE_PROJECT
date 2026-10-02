import { InferenceClient } from "@huggingface/inference";
import sharp from "sharp";
import type { MaterialCategory } from "@/lib/types";

/** EcoLoop material categories used for listing + carbon math */
export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  "Plastic",
  "Glass",
  "Metal",
  "Biodegradable",
  "Rubber",
];

export type ClassifyScore = {
  label: MaterialCategory;
  score: number;
  pct: number;
};

export type ClassifyResult = {
  material: MaterialCategory;
  confidence: number;
  confidencePct: number;
  alternatives: ClassifyScore[];
  rawLabels: { label: string; score: number }[];
  modelId: string;
  lowConfidence: boolean;
};

const LABEL_MAP: Record<string, MaterialCategory> = {
  plastic: "Plastic",
  glass: "Glass",
  metal: "Metal",
  wood: "Biodegradable",
  cardboard: "Biodegradable",
  paper: "Biodegradable",
  biodegradable: "Biodegradable",
  organic: "Biodegradable",
  compost: "Biodegradable",
  trash: "Biodegradable",
  rubbish: "Biodegradable",
  waste: "Biodegradable",
  aluminium: "Metal",
  aluminum: "Metal",
  steel: "Metal",
  iron: "Metal",
  hdpe: "Plastic",
  pet: "Plastic",
  timber: "Biodegradable",
  lumber: "Biodegradable",
  log: "Biodegradable",
  logs: "Biodegradable",
  carton: "Biodegradable",
  rubber: "Rubber",
  tyre: "Rubber",
  tire: "Rubber",
  tires: "Rubber",
  tyres: "Rubber",
  wheel: "Rubber",
  wheels: "Rubber",
  hose: "Rubber",
  hoses: "Rubber",
  tube: "Rubber",
  tubes: "Rubber",
  tubing: "Rubber",
  gasket: "Rubber",
  foam: "Rubber",
  barrel: "Plastic",
  drum: "Plastic",
  jerrycan: "Plastic",
};

/** ImageNet / ViT object names → EcoLoop materials (Rubber checked before Metal) */
const IMAGENET_RULES: { re: RegExp; material: MaterialCategory }[] = [
  {
    re: /\b(car wheel|tire|tyre|tires|tyres|rubber eraser|balloon|rubber|wheel|wheels|unicycle|mountain bike|moped|go[- ]?kart|disk brake|disc brake|plunger|hose|hoses|tube|tubes|tubing|gasket|seal|foam|insulation)\b/i,
    material: "Rubber",
  },
  // Industrial drums / barrels are almost always HDPE plastic in this marketplace
  { re: /\b(barrel|drum|jerrycan|jerry can|water jug)\b/i, material: "Plastic" },
  { re: /\b(water bottle|pop bottle|pill bottle|plastic bag|lotion|soap dispenser)\b/i, material: "Plastic" },
  { re: /\b(beer bottle|wine bottle|vase|goblet|beer glass|shot glass|perfume|car mirror|sunglasses|loupe)\b/i, material: "Glass" },
  { re: /\b(tin can|beer can|oil filter|hook|chain|nail|screw|hard disc|cd player|stove|radiator|safe|cannon|revolver|assault rifle|hammer|hatchet|cleaver|can opener)\b/i, material: "Metal" },
  // Wood, cardboard, paper and organics share Biodegradable
  {
    re: /\b(carton|envelope|packet|book jacket|notebook|menu|paper towel|crossword|file|binder|crate|chest|wooden spoon|lumber|log|logs|timber|wood|wooden|cardboard|paper|ashcan|trash can|garbage|compost|banana|orange|apple|broccoli|mushroom|bolete|agaric|head cabbage|birdhouse|thatch|park bench|picket fence|worm fence)\b/i,
    material: "Biodegradable",
  },
];

const RUBBER_HINT =
  /\b(tire|tyre|tires|tyres|rubber|wheel|wheels|car wheel|disk brake|disc brake|plunger|hose|hoses|tube|tubes|tubing|gasket|foam|insulation)\b/i;

const PLASTIC_HINT =
  /\b(barrel|drum|jerrycan|jerry can|water bottle|pop bottle|pill bottle|plastic bag|soap dispenser)\b/i;

const BIO_HINT =
  /\b(wood|wooden|timber|lumber|log|logs|bark|cardboard|carton|paper|crate|pallet|pallets|compost|organic|leaf|leaves|grass|mushroom|bolete|agaric|birdhouse|thatch|worm fence|picket fence|park bench|chopping|firewood|sawdust)\b/i;

const LOW_CONFIDENCE = 0.6;

const VIT_MODEL =
  process.env.HF_VIT_MODEL?.trim() || "google/vit-base-patch16-224";

function normalizeLabel(raw: string): MaterialCategory | null {
  const cleaned = raw.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (LABEL_MAP[cleaned]) return LABEL_MAP[cleaned];

  // Whole-word match only — avoids "pet" matching inside unrelated labels
  for (const [key, value] of Object.entries(LABEL_MAP)) {
    if (key.length < 3) continue;
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(cleaned)) return value;
  }

  for (const cat of MATERIAL_CATEGORIES) {
    if (cleaned === cat.toLowerCase()) return cat;
  }

  for (const rule of IMAGENET_RULES) {
    if (rule.re.test(cleaned)) return rule.material;
  }
  return null;
}

function boostFromHint(
  raw: { label: string; score: number }[],
  hint: RegExp,
  floor = 0.55
): number {
  const hits = raw.filter((r) => hint.test(r.label));
  if (hits.length === 0) return 0;
  return Math.max(floor, ...hits.map((r) => r.score));
}

function mapPredictions(
  raw: { label: string; score: number }[],
  modelId: string
): ClassifyResult {
  const byMaterial = new Map<MaterialCategory, number>();

  // Use MAX per category — summing lets background wood/grass beat the main object
  for (const item of raw) {
    const material = normalizeLabel(item.label);
    if (!material) continue;
    const prev = byMaterial.get(material) ?? 0;
    byMaterial.set(material, Math.max(prev, item.score));
  }

  const joined = raw.map((r) => r.label).join(" ");

  // Plastic drums / barrels (and bottles) — don't let yard wood win
  if (PLASTIC_HINT.test(joined)) {
    const score = boostFromHint(raw, PLASTIC_HINT, 0.6);
    byMaterial.set("Plastic", Math.max(byMaterial.get("Plastic") ?? 0, score));
  }

  if (RUBBER_HINT.test(joined)) {
    const score = boostFromHint(raw, RUBBER_HINT, 0.55);
    byMaterial.set("Rubber", Math.max(byMaterial.get("Rubber") ?? 0, score));
  }

  if (BIO_HINT.test(joined)) {
    const score = boostFromHint(raw, BIO_HINT, 0.72);
    byMaterial.set(
      "Biodegradable",
      Math.max(byMaterial.get("Biodegradable") ?? 0, score)
    );
    // Timber photos often pick up hatchet/cleaver → Metal; keep Metal from beating wood
    const metal = byMaterial.get("Metal") ?? 0;
    if (metal > 0 && metal < 0.9) {
      byMaterial.set("Metal", Math.min(metal, 0.3));
    }
    const plastic = byMaterial.get("Plastic") ?? 0;
    if (plastic > 0 && plastic < 0.9 && !PLASTIC_HINT.test(joined)) {
      byMaterial.set("Plastic", Math.min(plastic, 0.25));
    }
  }

  // Trust the top ImageNet label when it's a clear hit
  const topRaw = raw[0];
  if (topRaw) {
    const topMat = normalizeLabel(topRaw.label);
    if (topMat && topRaw.score >= 0.15) {
      byMaterial.set(topMat, Math.max(byMaterial.get(topMat) ?? 0, topRaw.score));
    }
  }

  // If wood/biomass is clearly in the photo, don't let the empty Plastic fallback win
  if (BIO_HINT.test(joined) && (byMaterial.get("Biodegradable") ?? 0) >= 0.4) {
    byMaterial.set(
      "Biodegradable",
      Math.max(byMaterial.get("Biodegradable") ?? 0, 0.7)
    );
  }

  let ranked: ClassifyScore[] = [...byMaterial.entries()]
    .map(([label, score]) => ({
      label,
      score,
      pct: Math.round(score * 100),
    }))
    .sort((a, b) => b.score - a.score);

  const unmapped = ranked.length === 0;
  if (unmapped) {
    ranked = [
      { label: "Biodegradable", score: 0.35, pct: 35 },
      { label: "Metal", score: 0.25, pct: 25 },
      { label: "Plastic", score: 0.2, pct: 20 },
      { label: "Rubber", score: 0.15, pct: 15 },
    ];
  }

  const finalTop = ranked[0];
  return {
    material: finalTop.label,
    confidence: finalTop.score,
    confidencePct: finalTop.pct,
    alternatives: ranked.slice(1, 4),
    rawLabels: raw.slice(0, 6),
    modelId,
    lowConfidence: finalTop.score < LOW_CONFIDENCE || unmapped,
  };
}

function isRealEndpointUrl(url: string | undefined): url is string {
  if (!url) return false;
  if (url.includes("xxxxxxxx") || url.includes("YOUR-ENDPOINT")) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function getHfConfig() {
  const token = process.env.HF_TOKEN?.trim();
  const endpointUrl = process.env.HF_ENDPOINT_URL?.trim().replace(/\/$/, "");
  const modelId =
    process.env.HF_MODEL_ID?.trim() ||
    "yangy50/garbage-classification";

  if (!token) {
    throw new Error(
      "Missing HF_TOKEN. Add your Hugging Face access token to .env.local."
    );
  }

  return {
    token,
    endpointUrl: isRealEndpointUrl(endpointUrl) ? endpointUrl : null,
    modelId,
  };
}

function toRawScores(
  output: { label?: string; score?: number }[] | unknown
): { label: string; score: number }[] {
  return (Array.isArray(output) ? output : [])
    .map((row) => ({
      label: String((row as { label?: string }).label ?? ""),
      score: Number((row as { score?: number }).score ?? 0),
    }))
    .filter((row) => row.label && Number.isFinite(row.score))
    .sort((a, b) => b.score - a.score);
}

function mimeFromUrl(url: string, headerType: string | null): string {
  const fromHeader = headerType?.split(";")[0]?.trim();
  if (fromHeader && fromHeader.startsWith("image/")) return fromHeader;
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".gif")) return "image/gif";
  return "image/jpeg";
}

/** Downscale large photos (wood stock images often timeout HF) */
async function prepareImageBytes(
  bytes: Uint8Array,
  mime: string
): Promise<{ bytes: Uint8Array; mime: string; blob: Blob }> {
  try {
    const resized = await sharp(Buffer.from(bytes))
      .rotate()
      .resize({
        width: 768,
        height: 768,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    const out = new Uint8Array(resized);
    return {
      bytes: out,
      mime: "image/jpeg",
      blob: new Blob([out], { type: "image/jpeg" }),
    };
  } catch {
    return { bytes, mime, blob: toImageBlob(bytes, mime) };
  }
}

function toImageBlob(bytes: Uint8Array, mime: string): Blob {
  // Copy into a plain ArrayBuffer so Blob gets a typed body with a real MIME type
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: mime });
}

/** Direct router call with explicit Content-Type (avoids SDK “no content type” failures) */
async function classifyViaRouterBinary(
  token: string,
  model: string,
  blob: Blob
): Promise<{ label: string; score: number }[]> {
  const url = `https://router.huggingface.co/hf-inference/models/${model}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": blob.type || "image/jpeg",
    },
    body: blob,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`HF router returned non-JSON (${res.status}): ${text.slice(0, 160)}`);
  }
  if (!res.ok) {
    const errObj = json as { error?: string; message?: string };
    throw new Error(errObj.error || errObj.message || `HF router ${res.status}`);
  }
  return toRawScores(json);
}

/** JSON base64 body — works when binary Content-Type is rejected */
async function classifyViaRouterBase64(
  token: string,
  model: string,
  bytes: Uint8Array
): Promise<{ label: string; score: number }[]> {
  const url = `https://router.huggingface.co/hf-inference/models/${model}`;
  const b64 = Buffer.from(bytes).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: b64 }),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`HF router returned non-JSON (${res.status}): ${text.slice(0, 160)}`);
  }
  if (!res.ok) {
    const errObj = json as { error?: string; message?: string };
    throw new Error(errObj.error || errObj.message || `HF router ${res.status}`);
  }
  return toRawScores(json);
}

/**
 * Free serverless path: Google ViT (ImageNet) via hf-inference, then map
 * object labels → EcoLoop materials. yangy50/CLIP often have no free Provider.
 */
async function classifyWithVit(
  client: InferenceClient,
  token: string,
  blob: Blob,
  bytes: Uint8Array
): Promise<ClassifyResult> {
  const attempts: Array<() => Promise<{ label: string; score: number }[]>> = [
    () => classifyViaRouterBinary(token, VIT_MODEL, blob),
    () => classifyViaRouterBase64(token, VIT_MODEL, bytes),
    async () => {
      const output = await client.imageClassification({
        model: VIT_MODEL,
        provider: "hf-inference",
        data: blob,
      });
      return toRawScores(output);
    },
  ];

  let lastError = "ViT classify failed";
  for (const attempt of attempts) {
    try {
      const raw = await attempt();
      if (raw.length > 0) {
        return mapPredictions(raw, `${VIT_MODEL} (ImageNet → EcoLoop map)`);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastError);
}

/**
 * Classify a listing photo with Hugging Face.
 *
 * Order:
 * 1. HF_ENDPOINT_URL (dedicated yangy50 / custom endpoint)
 * 2. HF_MODEL_ID image-classification (yangy50 — often no free Provider)
 * 3. google/vit-base-patch16-224 via hf-inference + ImageNet→material mapping
 *
 * Env: HF_TOKEN, HF_MODEL_ID, HF_ENDPOINT_URL?, HF_VIT_MODEL?
 */
export async function classifyListingImage(
  imageUrl: string
): Promise<ClassifyResult> {
  const { token, endpointUrl, modelId } = getHfConfig();

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Could not fetch listing photo (${imageRes.status})`);
  }
  const bytes = new Uint8Array(await imageRes.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("Listing photo was empty");
  }
  const mime = mimeFromUrl(imageUrl, imageRes.headers.get("content-type"));
  const prepared = await prepareImageBytes(bytes, mime);
  const blob = prepared.blob;
  const sendBytes = prepared.bytes;

  if (endpointUrl) {
    const client = new InferenceClient(token).endpoint(endpointUrl);
    const output = await client.imageClassification({ data: blob });
    const raw = toRawScores(output);
    if (raw.length === 0) throw new Error("Endpoint returned no classification scores");
    return mapPredictions(raw, modelId);
  }

  const client = new InferenceClient(token);
  const errors: string[] = [];

  // Skip specialist model when it has no provider — go straight to warm ViT
  try {
    return await classifyWithVit(client, token, blob, sendBytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`${VIT_MODEL}: ${msg}`);
  }

  // Optional: try preferred model id if ViT failed
  try {
    const output = await client.imageClassification({
      model: modelId,
      data: blob,
    });
    const raw = toRawScores(output);
    if (raw.length > 0) return mapPredictions(raw, modelId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`${modelId}: ${msg}`);
  }

  // Provider default image-classification model
  try {
    const output = await client.imageClassification({
      provider: "hf-inference",
      data: blob,
    });
    const raw = toRawScores(output);
    if (raw.length > 0) {
      return mapPredictions(raw, "hf-inference default image-classification");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`default: ${msg}`);
  }

  throw new Error(
    `AI classify unavailable. ${errors[errors.length - 1] || "Unknown error"}. Check HF_TOKEN (Inference Providers permission) at huggingface.co/settings/tokens, then restart npm run dev.`
  );
}
