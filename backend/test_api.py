import requests

BASE = "http://localhost:5000/api"

# 1. Health check
r = requests.get(f"{BASE}/health")
print("Health:", r.json())

# 2. Register
r = requests.post(f"{BASE}/auth/register", json={
    "username": "testuser",
    "email": "test@example.com",
    "password": "testpass123"
})
print("Register:", r.json())
token = r.json().get("access_token")

# 3. Get profile
r = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"})
print("Profile:", r.json())

# 4. List locations
r = requests.get(f"{BASE}/locations/")
print("Locations:", r.json())

# 5. Nearby (Yellowstone area)
r = requests.get(f"{BASE}/locations/nearby",
    params={"latitude": 44.46, "longitude": -110.83, "radius": 50000},
    headers={"Authorization": f"Bearer {token}"})
print("Nearby:", r.json())