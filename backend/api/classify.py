import io
import re
import base64
import requests
from typing import Dict, Any, List, Optional, Tuple
from PIL import Image
from django.conf import settings

MATERIAL_CATEGORIES = [
    "Plastic",
    "Glass",
    "Metal",
    "Biodegradable",
    "Rubber",
]

LABEL_MAP: Dict[str, str] = {
    "plastic": "Plastic",
    "glass": "Glass",
    "metal": "Metal",
    "wood": "Biodegradable",
    "cardboard": "Biodegradable",
    "paper": "Biodegradable",
    "biodegradable": "Biodegradable",
    "organic": "Biodegradable",
    "compost": "Biodegradable",
    "trash": "Biodegradable",
    "rubbish": "Biodegradable",
    "waste": "Biodegradable",
    "aluminium": "Metal",
    "aluminum": "Metal",
    "steel": "Metal",
    "iron": "Metal",
    "hdpe": "Plastic",
    "pet": "Plastic",
    "timber": "Biodegradable",
    "lumber": "Biodegradable",
    "log": "Biodegradable",
    "logs": "Biodegradable",
    "carton": "Biodegradable",
    "rubber": "Rubber",
    "tyre": "Rubber",
    "tire": "Rubber",
    "tires": "Rubber",
    "tyres": "Rubber",
    "wheel": "Rubber",
    "wheels": "Rubber",
    "hose": "Rubber",
    "hoses": "Rubber",
    "tube": "Rubber",
    "tubes": "Rubber",
    "tubing": "Rubber",
    "gasket": "Rubber",
    "foam": "Rubber",
    "barrel": "Plastic",
    "drum": "Plastic",
    "jerrycan": "Plastic",
}

IMAGENET_RULES: List[Tuple[re.Pattern, str]] = [
    (
        re.compile(
            r"\b(car wheel|tire|tyre|tires|tyres|rubber eraser|balloon|rubber|wheel|wheels|unicycle|mountain bike|moped|go[- ]?kart|disk brake|disc brake|plunger|hose|hoses|tube|tubes|tubing|gasket|seal|foam|insulation)\b",
            re.IGNORECASE,
        ),
        "Rubber",
    ),
    (
        re.compile(r"\b(barrel|drum|jerrycan|jerry can|water jug)\b", re.IGNORECASE),
        "Plastic",
    ),
    (
        re.compile(r"\b(water bottle|pop bottle|pill bottle|plastic bag|lotion|soap dispenser)\b", re.IGNORECASE),
        "Plastic",
    ),
    (
        re.compile(r"\b(beer bottle|wine bottle|vase|goblet|beer glass|shot glass|perfume|car mirror|sunglasses|loupe)\b", re.IGNORECASE),
        "Glass",
    ),
    (
        re.compile(r"\b(tin can|beer can|oil filter|hook|chain|nail|screw|hard disc|cd player|stove|radiator|safe|cannon|revolver|assault rifle|hammer|hatchet|cleaver|can opener)\b", re.IGNORECASE),
        "Metal",
    ),
    (
        re.compile(
            r"\b(carton|envelope|packet|book jacket|notebook|menu|paper towel|crossword|file|binder|crate|chest|wooden spoon|lumber|log|logs|timber|wood|wooden|cardboard|paper|ashcan|trash can|garbage|compost|banana|orange|apple|broccoli|mushroom|bolete|agaric|head cabbage|birdhouse|thatch|park bench|picket fence|worm fence)\b",
            re.IGNORECASE,
        ),
        "Biodegradable",
    ),
]

RUBBER_HINT = re.compile(
    r"\b(tire|tyre|tires|tyres|rubber|wheel|wheels|car wheel|disk brake|disc brake|plunger|hose|hoses|tube|tubes|tubing|gasket|foam|insulation)\b",
    re.IGNORECASE,
)

PLASTIC_HINT = re.compile(
    r"\b(barrel|drum|jerrycan|jerry can|water bottle|pop bottle|pill bottle|plastic bag|soap dispenser)\b",
    re.IGNORECASE,
)

BIO_HINT = re.compile(
    r"\b(wood|wooden|timber|lumber|log|logs|bark|cardboard|carton|paper|crate|pallet|pallets|compost|organic|leaf|leaves|grass|mushroom|bolete|agaric|birdhouse|thatch|worm fence|picket fence|park bench|chopping|firewood|sawdust)\b",
    re.IGNORECASE,
)

LOW_CONFIDENCE = 0.60

def normalize_label(raw: str) -> Optional[str]:
    cleaned = raw.strip().lower().replace("_", " ").replace("-", " ")
    if cleaned in LABEL_MAP:
        return LABEL_MAP[cleaned]

    for key, value in LABEL_MAP.items():
        if len(key) < 3:
            continue
        if re.search(rf"\b{re.escape(key)}\b", cleaned, re.IGNORECASE):
            return value

    for cat in MATERIAL_CATEGORIES:
        if cleaned == cat.lower():
            return cat

    for pattern, material in IMAGENET_RULES:
        if pattern.search(cleaned):
            return material

    return None

def boost_from_hint(raw: List[Dict[str, Any]], hint: re.Pattern, floor: float = 0.55) -> float:
    hits = [r["score"] for r in raw if hint.search(r["label"])]
    if not hits:
        return 0.0
    return max([floor] + hits)

def map_predictions(raw: List[Dict[str, Any]], model_id: str) -> Dict[str, Any]:
    by_material: Dict[str, float] = {}

    for item in raw:
        mat = normalize_label(item["label"])
        if not mat:
            continue
        score = float(item["score"])
        by_material[mat] = max(by_material.get(mat, 0.0), score)

    joined = " ".join([r["label"] for r in raw])

    if PLASTIC_HINT.search(joined):
        score = boost_from_hint(raw, PLASTIC_HINT, 0.60)
        by_material["Plastic"] = max(by_material.get("Plastic", 0.0), score)

    if RUBBER_HINT.search(joined):
        score = boost_from_hint(raw, RUBBER_HINT, 0.55)
        by_material["Rubber"] = max(by_material.get("Rubber", 0.0), score)

    if BIO_HINT.search(joined):
        score = boost_from_hint(raw, BIO_HINT, 0.72)
        by_material["Biodegradable"] = max(by_material.get("Biodegradable", 0.0), score)
        # Suppress tools beating biomass
        metal = by_material.get("Metal", 0.0)
        if 0 < metal < 0.9:
            by_material["Metal"] = min(metal, 0.30)
        plastic = by_material.get("Plastic", 0.0)
        if 0 < plastic < 0.9 and not PLASTIC_HINT.search(joined):
            by_material["Plastic"] = min(plastic, 0.25)

    if raw:
        top_raw = raw[0]
        top_mat = normalize_label(top_raw["label"])
        if top_mat and float(top_raw["score"]) >= 0.15:
            by_material[top_mat] = max(by_material.get(top_mat, 0.0), float(top_raw["score"]))

    if BIO_HINT.search(joined) and by_material.get("Biodegradable", 0.0) >= 0.4:
        by_material["Biodegradable"] = max(by_material.get("Biodegradable", 0.0), 0.70)

    ranked = [
        {"label": mat, "score": score, "pct": round(score * 100)}
        for mat, score in by_material.items()
    ]
    ranked.sort(key=lambda x: x["score"], reverse=True)

    unmapped = len(ranked) == 0
    if unmapped:
        ranked = [
            {"label": "Biodegradable", "score": 0.35, "pct": 35},
            {"label": "Metal", "score": 0.25, "pct": 25},
            {"label": "Plastic", "score": 0.20, "pct": 20},
            {"label": "Rubber", "score": 0.15, "pct": 15},
        ]

    top = ranked[0]
    return {
        "material": top["label"],
        "confidence": top["score"],
        "confidencePct": top["pct"],
        "alternatives": ranked[1:4],
        "rawLabels": raw[:6],
        "modelId": model_id,
        "lowConfidence": top["score"] < LOW_CONFIDENCE or unmapped,
    }

def prepare_image_bytes(image_bytes: bytes) -> bytes:
    """Downscale large images to max 768px JPEG (85% quality) to prevent HF timeout."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = img.convert("RGB")
        img.thumbnail((768, 768), Image.Resampling.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=85)
        return out.getvalue()
    except Exception:
        return image_bytes

def classify_image_bytes(image_bytes: bytes) -> Dict[str, Any]:
    """Execute classification through Hugging Face Inference API."""
    token = settings.HF_TOKEN
    if not token:
        raise ValueError("HF_TOKEN is not configured in settings or environment.")

    prepared = prepare_image_bytes(image_bytes)
    model_id = settings.HF_VIT_MODEL or "google/vit-base-patch16-224"
    url = f"https://router.huggingface.co/hf-inference/models/{model_id}"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "image/jpeg",
    }

    try:
        res = requests.post(url, headers=headers, data=prepared, timeout=25)
        if res.status_code == 200:
            json_data = res.json()
            if isinstance(json_data, list):
                raw = [
                    {"label": str(row.get("label", "")), "score": float(row.get("score", 0.0))}
                    for row in json_data
                    if "label" in row and "score" in row
                ]
                raw.sort(key=lambda x: x["score"], reverse=True)
                return map_predictions(raw, f"{model_id} (ImageNet → EcoLoop)")
    except Exception as e:
        pass

    # Fallback to base64 JSON payload
    try:
        b64_img = base64.b64encode(prepared).decode("utf-8")
        res = requests.post(
            url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"inputs": b64_img},
            timeout=25
        )
        if res.status_code == 200:
            json_data = res.json()
            if isinstance(json_data, list):
                raw = [
                    {"label": str(row.get("label", "")), "score": float(row.get("score", 0.0))}
                    for row in json_data
                ]
                return map_predictions(raw, model_id)
    except Exception:
        pass

    # Fallback response for offline or provider downtime
    return {
        "material": "Biodegradable",
        "confidence": 0.45,
        "confidencePct": 45,
        "alternatives": [
            {"label": "Metal", "pct": 25, "score": 0.25},
            {"label": "Plastic", "pct": 20, "score": 0.20},
            {"label": "Rubber", "pct": 10, "score": 0.10},
        ],
        "rawLabels": [],
        "modelId": "manual-fallback",
        "lowConfidence": True,
    }

