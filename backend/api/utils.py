import math
from decimal import Decimal
from typing import Dict, Tuple, Optional

ZONE_COORDS: Dict[str, Tuple[float, float]] = {
    'Ogba': (6.6325, 3.337),
    'Ogba Industrial Estate': (6.6325, 3.337),
    'Ikeja': (6.6018, 3.3515),
    'Ikeja Industrial Estate': (6.6018, 3.3515),
    'Isolo': (6.535, 3.322),
    'Apapa': (6.4474, 3.359),
}

VIEWER_DEFAULT = ZONE_COORDS['Ogba']

# LCA factors (kg CO2e saved per kg waste recycled vs virgin material)
CO2_FACTORS: Dict[str, Decimal] = {
    'Metal': Decimal('4.2'),
    'Plastic': Decimal('1.9'),
    'Glass': Decimal('0.6'),
    'Biodegradable': Decimal('0.9'),
    'Rubber': Decimal('2.4'),
}

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points in kilometers."""
    R = 6371.0  # Earth radius in kilometers
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2 +
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 1)

def get_coords_for_zone(zone: Optional[str]) -> Tuple[float, float]:
    """Retrieve latitude and longitude for a given Lagos cluster zone."""
    if not zone:
        return VIEWER_DEFAULT
    return ZONE_COORDS.get(zone, VIEWER_DEFAULT)

def calculate_co2_kg(weight_kg: Decimal, material: str) -> Decimal:
    """Calculates estimated kg CO2e diverted using LCA benchmark factors."""
    factor = CO2_FACTORS.get(material, Decimal('1.0'))
    return (weight_kg * factor).quantize(Decimal('1'))

def is_pilot_verified(business_name: str, phone: Optional[str], sells: bool, buys: bool) -> bool:
    """
    EcoLoop Pilot Trust Model:
    A business profile is verified if it has a non-empty business name, phone number,
    and has selected at least one operational role (sells or buys).
    """
    b_name = (business_name or '').strip()
    p_num = (phone or '').strip()
    return bool(b_name and p_num and (sells or buys))

