from datetime import datetime, timezone
from app import mongo


# Location types and their XP rewards
LOCATION_TYPES = {
    "national_park": {"label": "National Park", "xp": 100},
    "national_forest": {"label": "National Forest", "xp": 75},
    "state_park": {"label": "State Park", "xp": 50},
    "national_monument": {"label": "National Monument", "xp": 80},
    "point_of_interest": {"label": "Point of Interest", "xp": 25},
    "city_park": {"label": "City/Local Park", "xp": 15},
    "historic_site": {"label": "Historic Site", "xp": 60},
    "scenic_viewpoint": {"label": "Scenic Viewpoint", "xp": 30},
}

# Default unlock radius in meters
DEFAULT_UNLOCK_RADIUS = 500

def find_location_by_id(location_id: str) -> dict | None:
    """Find a location by its ID."""
    from bson import ObjectId
    return mongo.db.locations.find_one({"_id": ObjectId(location_id)})

def create_location(
    name: str,
    location_type: str,
    longitude: float,
    latitude: float,
    description: str = "",
    unlock_radius: int = DEFAULT_UNLOCK_RADIUS,
    metadata: dict = None,
) -> dict:
    """Create a new location document."""
    if location_type not in LOCATION_TYPES:
        raise ValueError(f"Invalid location type: {location_type}")

    location_doc = {
        "name": name,
        "location_type": location_type,
        "description": description,
        "coordinates": {
            "type": "Point",
            "coordinates": [longitude, latitude],  # GeoJSON: [lng, lat]
        },
        "unlock_radius": unlock_radius,
        "xp_reward": LOCATION_TYPES[location_type]["xp"],
        "metadata": metadata or {},
        "times_unlocked": 0,
        "created_at": datetime.now(timezone.utc),
    }

    result = mongo.db.locations.insert_one(location_doc)
    location_doc["_id"] = result.inserted_id
    return location_doc


def find_nearby_locations(longitude: float, latitude: float, max_distance_m: int = 5000) -> list:
    """Find locations within max_distance meters of a point."""
    return list(
        mongo.db.locations.find({
            "coordinates": {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [longitude, latitude],
                    },
                    "$maxDistance": max_distance_m,
                }
            }
        })
    )


def find_unlockable_locations(longitude: float, latitude: float) -> list:
    """Find locations the user is close enough to unlock.

    Each location has its own unlock_radius; we query with a generous
    max distance first, then filter by each location's specific radius.
    """
    # Query with a generous radius, then refine
    candidates = find_nearby_locations(longitude, latitude, max_distance_m=2000)

    unlockable = []
    from math import radians, cos, sin, asin, sqrt

    for loc in candidates:
        loc_lng, loc_lat = loc["coordinates"]["coordinates"]
        dist = _haversine(latitude, longitude, loc_lat, loc_lng)
        if dist <= loc["unlock_radius"]:
            loc["distance_m"] = round(dist)
            unlockable.append(loc)

    return unlockable


def get_locations_by_type(location_type: str, page: int = 1, per_page: int = 20) -> list:
    """Get paginated locations filtered by type."""
    skip = (page - 1) * per_page
    return list(
        mongo.db.locations.find({"location_type": location_type})
        .skip(skip)
        .limit(per_page)
    )


def _haversine(lat1, lon1, lat2, lon2) -> float:
    """Calculate distance in meters between two GPS points."""
    from math import radians, cos, sin, asin, sqrt

    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 6371000 * 2 * asin(sqrt(a))  # Earth radius in meters