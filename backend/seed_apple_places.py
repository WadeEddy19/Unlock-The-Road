"""
Seed script — fetches state parks and city parks from the Apple Maps Server API.

Usage:
    python seed_apple_places.py

Requires Apple Maps credentials in your .env file:
    APPLE_MAPS_TEAM_ID       — Your Apple Developer Team ID
    APPLE_MAPS_KEY_ID        — The Key ID for your MapKit private key
    APPLE_MAPS_PRIVATE_KEY   — Path to your .p8 private key file

Setup:
    1. Sign in at https://developer.apple.com/account
    2. Go to Certificates, Identifiers & Profiles → Keys
    3. Create a new key with "MapKit JS" enabled
    4. Download the .p8 file and note the Key ID
    5. Your Team ID is in the top-right of your developer account page

Options:
    python seed_apple_places.py --preview         Preview without saving
    python seed_apple_places.py --clear           Clear Apple-sourced locations before seeding
    python seed_apple_places.py --states CA,TX,NY Seed only specific states
"""

import os
import sys
import time
import requests
import jwt
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from app import create_app, mongo
from app.models.location import create_location, LOCATION_TYPES

load_dotenv()

APPLE_TEAM_ID = os.getenv("APPLE_MAPS_TEAM_ID")
APPLE_KEY_ID = os.getenv("APPLE_MAPS_KEY_ID")
APPLE_PRIVATE_KEY_PATH = os.getenv("APPLE_MAPS_PRIVATE_KEY", "AuthKey.p8")

MAPS_API_BASE = "https://maps-api.apple.com"
TOKEN_URL = f"{MAPS_API_BASE}/v1/token"
SEARCH_URL = f"{MAPS_API_BASE}/v1/search"

# All 50 US states + DC
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

# Apple PoiCategory → our location types
APPLE_CATEGORY_MAP = {
    "Park": "city_park",
    "NationalPark": "national_park",
    "Campground": "state_park",
    "Museum": "historic_site",
    "Landmark": "point_of_interest",
    "Beach": "scenic_viewpoint",
    "Marina": "scenic_viewpoint",
    "NationalMonument": "national_monument",
}


class AppleMapsClient:
    """Handles Apple Maps Server API authentication and requests."""

    def __init__(self, team_id, key_id, private_key_path):
        self.team_id = team_id
        self.key_id = key_id
        self.private_key_path = private_key_path
        self._access_token = None
        self._token_expiry = None

    def _load_private_key(self):
        """Load the .p8 private key file."""
        key_path = os.path.abspath(self.private_key_path)
        if not os.path.exists(key_path):
            raise FileNotFoundError(
                f"Private key not found: {key_path}\n"
                "Download your .p8 key from https://developer.apple.com/account"
            )
        with open(key_path, "r") as f:
            return f.read()

    def _generate_auth_token(self):
        """Generate a Maps auth token (JWT) signed with the private key."""
        private_key = self._load_private_key()
        now = datetime.now(timezone.utc)

        headers = {
            "alg": "ES256",
            "kid": self.key_id,
            "typ": "JWT",
        }

        payload = {
            "iss": self.team_id,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=30)).timestamp()),
        }

        return jwt.encode(payload, private_key, algorithm="ES256", headers=headers)

    def _get_access_token(self):
        """Exchange auth token for a Maps access token via /v1/token."""
        now = datetime.now(timezone.utc)

        # Reuse token if still valid (with 2-minute buffer)
        if self._access_token and self._token_expiry:
            if now < self._token_expiry - timedelta(minutes=2):
                return self._access_token

        auth_token = self._generate_auth_token()
        response = requests.get(
            TOKEN_URL,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        response.raise_for_status()

        data = response.json()
        self._access_token = data["accessToken"]
        # Access tokens are valid for 30 minutes
        self._token_expiry = now + timedelta(minutes=28)

        return self._access_token

    def search(self, query, lang="en-US", result_type_filter=None):
        """Search for places using the /v1/search endpoint."""
        token = self._get_access_token()

        params = {
            "q": query,
            "lang": lang,
        }

        if result_type_filter:
            params["resultTypeFilter"] = result_type_filter

        response = requests.get(
            SEARCH_URL,
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        response.raise_for_status()
        return response.json()


def classify_place(place, default_type):
    """Determine our location_type from an Apple Maps place."""
    # Check Apple's PoiCategory first
    poi_category = place.get("poiCategory", "")
    if poi_category in APPLE_CATEGORY_MAP:
        mapped = APPLE_CATEGORY_MAP[poi_category]
        if mapped != "city_park":  # More specific than default
            return mapped

    # Check name for stronger signals
    name = place.get("name", "").lower()
    if "state park" in name or "state forest" in name or "state recreation" in name:
        return "state_park"
    if "national park" in name:
        return "national_park"
    if "national forest" in name:
        return "national_forest"
    if "national monument" in name:
        return "national_monument"
    if "historic" in name or "historical" in name or "heritage" in name:
        return "historic_site"

    # If Apple says it's a Park, that's probably a city/local park
    if poi_category == "Park":
        return "city_park"

    return default_type


def parse_place(place, default_type, state_name):
    """Parse an Apple Maps place result into our location format."""
    # Apple returns coordinate as { latitude, longitude }
    coordinate = place.get("coordinate", {})
    lat = coordinate.get("latitude")
    lng = coordinate.get("longitude")

    if lat is None or lng is None:
        return None

    if lat == 0 and lng == 0:
        return None

    name = place.get("name", "Unknown")

    # Build address from structured address fields
    address_lines = place.get("formattedAddressLines", [])
    address = ", ".join(address_lines) if address_lines else ""

    location_type = classify_place(place, default_type)

    return {
        "name": name,
        "location_type": location_type,
        "latitude": lat,
        "longitude": lng,
        "description": "",  # Apple Search API doesn't return descriptions
        "metadata": {
            "source": "apple_maps",
            "apple_place_id": place.get("placecardUrl", ""),
            "address": address,
            "state": STATE_ABBREVIATIONS.get(state_name, ""),
            "country": place.get("country", ""),
            "poi_category": place.get("poiCategory", ""),
            "phone": place.get("telephone", ""),
            "url": place.get("urls", [""])[0] if place.get("urls") else "",
        },
    }


def seed_apple_places(clear=False, preview=False, states=None):
    """Main seeding function."""
    # Validate config
    missing = []
    if not APPLE_TEAM_ID:
        missing.append("APPLE_MAPS_TEAM_ID")
    if not APPLE_KEY_ID:
        missing.append("APPLE_MAPS_KEY_ID")
    if missing:
        print(f"Error: Missing env variables: {', '.join(missing)}")
        print("\nSetup instructions:")
        print("  1. Go to https://developer.apple.com/account")
        print("  2. Certificates, Identifiers & Profiles → Keys")
        print("  3. Create a key with 'MapKit JS' enabled")
        print("  4. Download the .p8 file, note the Key ID")
        print("  5. Add to .env:")
        print("     APPLE_MAPS_TEAM_ID=your-team-id")
        print("     APPLE_MAPS_KEY_ID=your-key-id")
        print("     APPLE_MAPS_PRIVATE_KEY=path/to/AuthKey.p8")
        sys.exit(1)

    client = AppleMapsClient(APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY_PATH)
    target_states = states if states else US_STATES

    app = create_app()
    with app.app_context():
        if clear and not preview:
            count = mongo.db.locations.count_documents(
                {"metadata.source": "apple_maps"}
            )
            mongo.db.locations.delete_many({"metadata.source": "apple_maps"})
            print(f"Cleared {count} existing Apple Maps locations.")

        # Build set of existing location names for deduplication
        existing_names = set()
        for doc in mongo.db.locations.find({}, {"name": 1}):
            existing_names.add(doc["name"])

        all_locations = []
        seen_names = set()  # Deduplicate across queries within this run

        print(f"Searching Apple Maps for parks in {len(target_states)} states...")
        print(f"Queries per state: {len(SEARCH_QUERIES)}")
        print()

        for i, state in enumerate(target_states, 1):
            state_count = 0

            for search in SEARCH_QUERIES:
                query = search["query"].format(state=state)
                default_type = search["location_type"]

                try:
                    data = client.search(query)
                except requests.exceptions.HTTPError as e:
                    print(f"  ✗ API error for '{query}': {e}")
                    if e.response is not None and e.response.status_code == 401:
                        print("    → Check your Team ID, Key ID, and .p8 file")
                    continue
                except FileNotFoundError as e:
                    print(f"  ✗ {e}")
                    sys.exit(1)

                results = data.get("results", [])

                for place in results:
                    name = place.get("name", "")

                    # Skip if we've already seen this name
                    if name in seen_names:
                        continue
                    seen_names.add(name)

                    parsed = parse_place(place, default_type, state)
                    if parsed:
                        all_locations.append(parsed)
                        state_count += 1

                # Brief pause between queries to stay within rate limits
                time.sleep(0.3)

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
            matching = [s for s in US_STATES if s.upper() == code]
            if matching:
                states.append(matching[0])
            else:
                print(f"Warning: Unknown state '{code}', skipping.")
    return states


if __name__ == "__main__":
    clear = "--clear" in sys.argv
    preview = "--preview" in sys.argv

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

    seed_apple_places(clear=clear, preview=preview, states=states)
