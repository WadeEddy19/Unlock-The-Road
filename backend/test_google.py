import os
import requests
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("GOOGLE_PLACES_API_KEY")
print(f"Key found: {bool(key)}")
if key:
    print(f"Key starts with: {key[:10]}...")

r = requests.post(
    "https://places.googleapis.com/v1/places:searchText",
    json={"textQuery": "park in California", "maxResultCount": 1},
    headers={
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName",
    },
)
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:500]}")