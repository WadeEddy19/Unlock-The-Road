"""
Seed script — fetches state parks and city parks from the Google Places API.

Usage:
    python seed_google_places.py

Requires GOOGLE_PLACES_API_KEY in your .env file.
Get a key at: https://console.cloud.google.com/apis/credentials
  → Enable "Places API (New)" in your Google Cloud project.

Options:
    python seed_google_places.py --clear     Clear Google-sourced locations before seeding
    python seed_google_places.py --preview   Preview what would be imported without saving
    python seed_google_places.py --states CA,TX,NY   Seed only specific states (comma-separated)
"""

import os
import sys
import time
import requests
from dotenv import load_dotenv
from app import create_app, mongo
from app.models.location import create_location, LOCATION_TYPES

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")
TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"

# All 50 US states + DC for comprehensive coverage
US_STATES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California",
    "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
    "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
    "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri",
    "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
    "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
    "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
    "District of Columbia",
]

# State abbreviation lookup (for metadata)
STATE_ABBREVIATIONS = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE",
    "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
    "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR",
    "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
    "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
    "District of Columbia": "DC",
}

# Search queries and how they map to your location types
SEARCH_QUERIES = [
    {"query": "state park in {state}", "location_type": "state_park"},
    {"query": "city park in {state}", "location_type": "city_park"},
    {"query": "public park in {state}", "location_type": "city_park"},
    {"query": "recreation area in {state}", "location_type": "state_park"},
]

# Google Places types → our location types (fallback mapping)
GOOGLE_TYPE_MAP = {
    "park": "city_park",
    "national_park": "national_park",
    "campground": "state_park",
    "tourist_attraction": "point_of_interest",
    "hiking_area": "scenic_viewpoint",
    "historical_landmark": "historic_site",
}


def search_places(query, page_token=None):
    """Search Google Places API (New) using Text Search."""
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": (
            "places.id,places.displayName,places.formattedAddress,"
            "places.location,places.types,places.editorialSummary,"
            "places.googleMapsUri,places.rating,places.userRatingCount,"
            "nextPageToken"
        ),
    }

    body = {
        "textQuery": query,
        "languageCode": "en",
        "maxResultCount": 20,
    }

    if page_token:
        body["pageToken"] = page_token

    response = requests.post(TEXT_SEARCH_URL, json=body, headers=headers)
    response.raise_for_status()
    return response.json()


def fetch_places_for_query(query):
    """Fetch all results for a query, handling pagination."""
    all_places = []
    page_token = None

    while True:
        data = search_places(query, page_token=page_token)
        places = data.get("places", [])
        all_places.extend(places)

        page_token = data.get("nextPageToken")
        if not page_token or len(all_places) >= 60:
            # Cap at 60 per query to avoid excessive API costs
            break

        # Google requires a short delay before using nextPageToken
        time.sleep(2)

    return all_places


def classify_place(place, default_type):
    """Determine our location_type from Google place types."""
    google_types = place.get("types", [])

    # If it looks like a national park, respect that
    if "national_park" in google_types:
        return "national_park"

    # Check name for stronger signals
    name = place.get("displayName", {}).get("text", "").lower()
    if "state park" in name or "state forest" in name:
        return "state_park"
    if "national forest" in name:
        return "national_forest"
    if "national monument" in name:
        return "national_monument"
    if "historic" in name or "historical" in name or "heritage" in name:
        return "historic_site"

    # Use Google type mapping as secondary signal
    for gtype in google_types:
        if gtype in GOOGLE_TYPE_MAP:
            mapped = GOOGLE_TYPE_MAP[gtype]
            # Only override default if it's a more specific match
            if mapped != "city_park":
                return mapped

    return default_type


def parse_place(place, default_type, state_name):
    """Parse a Google Places result into our location format."""
    location = place.get("location", {})
    lat = location.get("latitude")
    lng = location.get("longitude")

    if lat is None or lng is None:
        return None

    if lat == 0 and lng == 0:
        return None

    display_name = place.get("displayName", {})
    name = display_name.get("text", "Unknown")

    # Get description from editorial summary if available
    summary = place.get("editorialSummary", {})
    description = summary.get("text", "")

    location_type = classify_place(place, default_type)

    return {
        "name": name,
        "location_type": location_type,
        "latitude": lat,
        "longitude": lng,
        "description": description,
        "metadata": {
            "source": "google_places",
            "google_place_id": place.get("id", ""),
            "address": place.get("formattedAddress", ""),
            "state": STATE_ABBREVIATIONS.get(state_name, ""),
            "google_maps_url": place.get("googleMapsUri", ""),
            "rating": place.get("rating"),
            "rating_count": place.get("userRatingCount"),
            "google_types": place.get("types", []),
        },
    }


def seed_google_places(clear=False, preview=False, states=None):
    """Main seeding function."""
    if not GOOGLE_API_KEY:
        print("Error: GOOGLE_PLACES_API_KEY not found in .env file.")
        print("Get a key at: https://console.cloud.google.com/apis/credentials")
        print("Make sure 'Places API (New)' is enabled in your project.")
        sys.exit(1)

    target_states = states if states else US_STATES

    app = create_app()
    with app.app_context():
        if clear and not preview:
            # Only clear locations that came from Google Places
            count = mongo.db.locations.count_documents(
                {"metadata.source": "google_places"}
            )
            mongo.db.locations.delete_many({"metadata.source": "google_places"})
            print(f"Cleared {count} existing Google Places locations.")

        # Build set of existing location names for deduplication
        existing_names = set()
        for doc in mongo.db.locations.find({}, {"name": 1}):
            existing_names.add(doc["name"])

        all_locations = []
        seen_place_ids = set()  # Deduplicate across queries

        print(f"Searching Google Places for parks in {len(target_states)} states...")
        print(f"Queries per state: {len(SEARCH_QUERIES)}")
        print()

        for i, state in enumerate(target_states, 1):
            state_count = 0

            for search in SEARCH_QUERIES:
                query = search["query"].format(state=state)
                default_type = search["location_type"]

                try:
                    places = fetch_places_for_query(query)
                except requests.exceptions.HTTPError as e:
                    print(f"  ✗ API error for '{query}': {e}")
                    continue

                for place in places:
                    place_id = place.get("id", "")

                    # Skip if we've already seen this place
                    if place_id and place_id in seen_place_ids:
                        continue
                    seen_place_ids.add(place_id)

                    parsed = parse_place(place, default_type, state)
                    if parsed:
                        all_locations.append(parsed)
                        state_count += 1

                # Brief pause between queries to be polite to the API
                time.sleep(0.5)

            print(f"  [{i}/{len(target_states)}] {state}: {state_count} parks found")

        print(f"\nTotal unique locations found: {len(all_locations)}")

        # Count by type
        type_counts = {}
        for loc in all_locations:
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

        # Insert new locations (skip duplicates by name)
        added = 0
        dupes = 0
        for loc in all_locations:
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


def parse_state_arg(arg):
    """Parse --states CA,TX,NY into full state names."""
    abbrev_to_name = {v: k for k, v in STATE_ABBREVIATIONS.items()}
    codes = [s.strip().upper() for s in arg.split(",")]
    states = []
    for code in codes:
        if code in abbrev_to_name:
            states.append(abbrev_to_name[code])
        else:
            # Maybe they passed full name
            matching = [s for s in US_STATES if s.upper() == code]
            if matching:
                states.append(matching[0])
            else:
                print(f"Warning: Unknown state '{code}', skipping.")
    return states


if __name__ == "__main__":
    clear = "--clear" in sys.argv
    preview = "--preview" in sys.argv

    # Parse --states argument
    states = None
    for arg in sys.argv[1:]:
        if arg.startswith("--states"):
            if "=" in arg:
                states = parse_state_arg(arg.split("=", 1)[1])
            else:
                idx = sys.argv.index(arg)
                if idx + 1 < len(sys.argv):
                    states = parse_state_arg(sys.argv[idx + 1])
            break

    seed_google_places(clear=clear, preview=preview, states=states)
