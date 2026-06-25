"""
Test the full unlock flow:
1. Login
2. Create a test location at given coordinates
3. Find nearby locations
4. Unlock the test location
5. Check profile for XP gain

Usage:
    python test_unlock.py <latitude> <longitude>

Example (Times Square):
    python test_unlock.py 40.7580 -73.9855
"""

import sys
import requests

BASE = "http://localhost:5000/api"


def test_unlock(lat, lng):
    # 1. Login (use existing test account)
    print("1. Logging in...")
    r = requests.post(f"{BASE}/auth/login", json={
        "email": "test@example.com",
        "password": "testpass123",
    })

    if r.status_code != 200:
        print("   Login failed. Creating account...")
        r = requests.post(f"{BASE}/auth/register", json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpass123",
        })

    data = r.json()
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"   ✓ Logged in as {data['user']['username']} (Level {data['user']['level']}, {data['user']['xp']} XP)")

    # 2. Create a test location at our coordinates
    print(f"\n2. Creating test location at ({lat}, {lng})...")
    r = requests.post(f"{BASE}/dev/create-nearby", json={
        "latitude": lat,
        "longitude": lng,
        "name": "Dev Test Spot",
        "location_type": "point_of_interest",
    }, headers=headers)

    if r.status_code == 201:
        location = r.json()["location"]
        location_id = location["id"]
        print(f"   ✓ Created '{location['name']}' ({location['xp_reward']} XP, {location['unlock_radius']}m radius)")
    else:
        print(f"   ✗ Failed: {r.json()}")
        return

    # 3. Check nearby locations
    print(f"\n3. Searching for nearby locations...")
    r = requests.get(f"{BASE}/locations/nearby", params={
        "latitude": lat,
        "longitude": lng,
        "radius": 5000,
    }, headers=headers)
    nearby = r.json()["locations"]
    print(f"   ✓ Found {len(nearby)} locations nearby")
    for loc in nearby[:5]:
        status = "🔓 unlocked" if loc["unlocked"] else "🔒 locked"
        print(f"     - {loc['name']} ({status})")

    # 4. Unlock the test location
    print(f"\n4. Attempting to unlock '{location['name']}'...")
    r = requests.post(f"{BASE}/locations/unlock", json={
        "location_id": location_id,
        "latitude": lat,
        "longitude": lng,
    }, headers=headers)

    if r.status_code == 200:
        result = r.json()
        xp = result["xp"]
        print(f"   ✓ {result['message']}")
        print(f"   ✓ +{xp['xp_gained']} XP (Total: {xp['total_xp']})")
        if xp["leveled_up"]:
            print(f"   🎉 LEVEL UP! Now Level {xp['level']}!")
        if xp["new_titles"]:
            print(f"   🏆 New titles: {', '.join(xp['new_titles'])}")
    else:
        print(f"   ✗ Failed: {r.json()}")
        return

    # 5. Verify profile updated
    print(f"\n5. Checking updated profile...")
    r = requests.get(f"{BASE}/auth/me", headers=headers)
    user = r.json()["user"]
    print(f"   ✓ Level: {user['level']}")
    print(f"   ✓ XP: {user['xp']}")
    print(f"   ✓ Title: {user['title']}")
    print(f"   ✓ Locations unlocked: {len(user['unlocked_locations'])}")
    print(f"   ✓ POI unlocked: {user['stats']['poi_unlocked']}")

    # 6. Try to unlock again (should fail)
    print(f"\n6. Attempting duplicate unlock (should fail)...")
    r = requests.post(f"{BASE}/locations/unlock", json={
        "location_id": location_id,
        "latitude": lat,
        "longitude": lng,
    }, headers=headers)
    if r.status_code == 409:
        print(f"   ✓ Correctly rejected: {r.json()['errors'][0]}")
    else:
        print(f"   ✗ Unexpected response: {r.status_code} {r.json()}")

    # 7. Try to unlock from far away (should fail)
    print(f"\n7. Attempting unlock from far away (should fail)...")
    r = requests.post(f"{BASE}/locations/unlock", json={
        "location_id": location_id,
        "latitude": lat + 1,  # ~111km away
        "longitude": lng,
    }, headers=headers)
    if r.status_code == 403:
        print(f"   ✓ Correctly rejected: {r.json()['errors'][0]}")
    else:
        print(f"   ✗ Unexpected response: {r.status_code} {r.json()}")

    print("\n✅ All tests passed!")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python test_unlock.py <latitude> <longitude>")
        print("Example: python test_unlock.py 40.7580 -73.9855")
        sys.exit(1)

    lat = float(sys.argv[1])
    lng = float(sys.argv[2])
    test_unlock(lat, lng)