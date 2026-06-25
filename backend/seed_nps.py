"""
Seed script — fetches real location data from the National Park Service API.

Usage:
    python seed_nps.py

Requires NPS_API_KEY in your .env file.
Get a free key at: https://developer.nps.gov/get-started

Options:
    python seed_nps.py --clear     Clear existing locations before seeding
    python seed_nps.py --preview   Preview what would be imported without saving
"""

import os
import sys
import requests
from dotenv import load_dotenv
from app import create_app, mongo
from app.models.location import create_location, LOCATION_TYPES

load_dotenv()

NPS_API_KEY = os.getenv("NPS_API_KEY")
NPS_BASE_URL = "https://developer.nps.gov/api/v1"

# Map NPS designation strings to our location types
DESIGNATION_MAP = {
    "National Park": "national_park",
    "National Parks": "national_park",
    "National Park & Preserve": "national_park",
    "National and State Parks": "national_park",
    "National Monument": "national_monument",
    "National Monument & Preserve": "national_monument",
    "National Historic Site": "historic_site",
    "National Historical Park": "historic_site",
    "National Historical Park and Ecological Preserve": "historic_site",
    "National Historic Park": "historic_site",
    "National Battlefield": "historic_site",
    "National Battlefield Park": "historic_site",
    "National Military Park": "historic_site",
    "National Memorial": "historic_site",
    "National Scenic Trail": "scenic_viewpoint",
    "National Scenic River": "scenic_viewpoint",
    "National Scenic Riverway": "scenic_viewpoint",
    "National Seashore": "scenic_viewpoint",
    "National Lakeshore": "scenic_viewpoint",
    "National Recreation Area": "state_park",
    "National Preserve": "national_forest",
    "National Reserve": "national_forest",
    "National River": "scenic_viewpoint",
    "National Wild and Scenic River": "scenic_viewpoint",
    "National Parkway": "scenic_viewpoint",
    "Park": "city_park",
    "Parkway": "scenic_viewpoint",
}


def fetch_parks(limit=50, start=0):
    """Fetch a page of parks from the NPS API."""
    response = requests.get(
        f"{NPS_BASE_URL}/parks",
        params={
            "api_key": NPS_API_KEY,
            "limit": limit,
            "start": start,
            "fields": "designation",
        },
    )
    response.raise_for_status()
    return response.json()


def fetch_all_parks():
    """Fetch all parks from the NPS API with pagination."""
    all_parks = []
    start = 0
    limit = 50

    print("Fetching parks from NPS API...")

    while True:
        data = fetch_parks(limit=limit, start=start)
        parks = data.get("data", [])
        total = int(data.get("total", 0))

        all_parks.extend(parks)
        print(f"  Fetched {len(all_parks)} / {total} parks...")

        if len(all_parks) >= total or len(parks) == 0:
            break

        start += limit

    return all_parks


def map_designation(designation):
    """Map an NPS designation to our location type."""
    # Try exact match first
    if designation in DESIGNATION_MAP:
        return DESIGNATION_MAP[designation]

    # Try partial matching for designations we haven't mapped exactly
    designation_lower = designation.lower()
    if "national park" in designation_lower:
        return "national_park"
    if "national monument" in designation_lower:
        return "national_monument"
    if "historic" in designation_lower or "memorial" in designation_lower:
        return "historic_site"
    if "battlefield" in designation_lower or "military" in designation_lower:
        return "historic_site"
    if "scenic" in designation_lower or "seashore" in designation_lower:
        return "scenic_viewpoint"
    if "forest" in designation_lower or "preserve" in designation_lower:
        return "national_forest"
    if "recreation" in designation_lower:
        return "state_park"

    # Default to point of interest
    return "point_of_interest"


def parse_park(park):
    """Parse an NPS park object into our location format."""
    lat = park.get("latitude", "")
    lng = park.get("longitude", "")

    # Skip parks without valid coordinates
    if not lat or not lng:
        return None

    try:
        lat = float(lat)
        lng = float(lng)
    except (ValueError, TypeError):
        return None

    # Skip invalid coordinates
    if lat == 0 and lng == 0:
        return None

    designation = park.get("designation", "")
    location_type = map_designation(designation)

    return {
        "name": park.get("fullName", park.get("name", "Unknown")),
        "location_type": location_type,
        "latitude": lat,
        "longitude": lng,
        "description": park.get("description", ""),
        "metadata": {
            "nps_park_code": park.get("parkCode", ""),
            "designation": designation,
            "states": park.get("states", ""),
            "url": park.get("url", ""),
        },
    }


def seed_nps(clear=False, preview=False):
    """Main seeding function."""
    if not NPS_API_KEY:
        print("Error: NPS_API_KEY not found in .env file.")
        print("Get a free key at: https://developer.nps.gov/get-started")
        sys.exit(1)

    app = create_app()
    with app.app_context():
        if clear and not preview:
            count = mongo.db.locations.count_documents({})
            mongo.db.locations.delete_many({})
            print(f"Cleared {count} existing locations.")

        # Fetch all parks from NPS
        parks = fetch_all_parks()
        print(f"\nTotal parks from NPS: {len(parks)}")

        # Parse and filter
        locations = []
        skipped = 0
        for park in parks:
            parsed = parse_park(park)
            if parsed:
                locations.append(parsed)
            else:
                skipped += 1

        print(f"Valid locations: {len(locations)}")
        print(f"Skipped (no coordinates): {skipped}")

        # Count by type
        type_counts = {}
        for loc in locations:
            t = loc["location_type"]
            type_counts[t] = type_counts.get(t, 0) + 1

        print("\nBreakdown by type:")
        for loc_type, count in sorted(type_counts.items(), key=lambda x: -x[1]):
            label = LOCATION_TYPES[loc_type]["label"]
            xp = LOCATION_TYPES[loc_type]["xp"]
            print(f"  {label}: {count} ({xp} XP each)")

        if preview:
            print("\n[Preview mode — nothing was saved]")
            return

        # Check for duplicates by name
        existing_names = set()
        for doc in mongo.db.locations.find({}, {"name": 1}):
            existing_names.add(doc["name"])

        # Insert new locations
        added = 0
        dupes = 0
        for loc in locations:
            if loc["name"] in existing_names:
                dupes += 1
                continue

            create_location(**loc)
            existing_names.add(loc["name"])
            added += 1

        print(f"\n✓ Added {added} new locations")
        if dupes:
            print(f"  Skipped {dupes} duplicates (already in database)")

        total = mongo.db.locations.count_documents({})
        print(f"  Total locations in database: {total}")


if __name__ == "__main__":
    clear = "--clear" in sys.argv
    preview = "--preview" in sys.argv
    seed_nps(clear=clear, preview=preview)