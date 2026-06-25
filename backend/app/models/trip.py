from datetime import datetime, timezone
from math import radians, cos, sin, asin, sqrt
from bson import ObjectId
from app import mongo


def start_trip(user_id: str, name: str = None) -> dict:
    """Start a new trip for a user."""
    # Check if user already has an active trip
    active = get_active_trip(user_id)
    if active:
        raise ValueError("You already have an active trip.")

    trip_doc = {
        "user_id": user_id,
        "name": name or f"Trip {datetime.now(timezone.utc).strftime('%b %d, %Y')}",
        "status": "active",
        "waypoints": [],
        "total_distance_km": 0,
        "unlocks_during_trip": [],
        "started_at": datetime.now(timezone.utc),
        "ended_at": None,
        "updated_at": datetime.now(timezone.utc),
    }

    result = mongo.db.trips.insert_one(trip_doc)
    trip_doc["_id"] = result.inserted_id
    return trip_doc


def add_waypoint(trip_id: str, latitude: float, longitude: float) -> dict:
    """Add a GPS waypoint to an active trip."""
    trip = mongo.db.trips.find_one({"_id": ObjectId(trip_id)})

    if not trip:
        raise ValueError("Trip not found.")
    if trip["status"] != "active":
        raise ValueError("Trip is not active.")

    waypoint = {
        "latitude": latitude,
        "longitude": longitude,
        "timestamp": datetime.now(timezone.utc),
    }

    # Calculate distance from last waypoint
    distance_added = 0
    if trip["waypoints"]:
        last = trip["waypoints"][-1]
        distance_added = haversine_km(
            last["latitude"], last["longitude"],
            latitude, longitude
        )

    mongo.db.trips.update_one(
        {"_id": ObjectId(trip_id)},
        {
            "$push": {"waypoints": waypoint},
            "$inc": {"total_distance_km": distance_added},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )

    return {
        "waypoint": waypoint,
        "distance_added_km": round(distance_added, 3),
        "total_distance_km": round(trip["total_distance_km"] + distance_added, 3),
    }


def add_batch_waypoints(trip_id: str, waypoints: list) -> dict:
    """Add multiple waypoints at once (for batch uploads after offline periods)."""
    trip = mongo.db.trips.find_one({"_id": ObjectId(trip_id)})

    if not trip:
        raise ValueError("Trip not found.")
    if trip["status"] != "active":
        raise ValueError("Trip is not active.")

    formatted = []
    total_new_distance = 0
    last_point = trip["waypoints"][-1] if trip["waypoints"] else None

    for wp in waypoints:
        point = {
            "latitude": wp["latitude"],
            "longitude": wp["longitude"],
            "timestamp": wp.get("timestamp", datetime.now(timezone.utc)),
        }

        if last_point:
            total_new_distance += haversine_km(
                last_point["latitude"], last_point["longitude"],
                point["latitude"], point["longitude"]
            )

        last_point = point
        formatted.append(point)

    mongo.db.trips.update_one(
        {"_id": ObjectId(trip_id)},
        {
            "$push": {"waypoints": {"$each": formatted}},
            "$inc": {"total_distance_km": total_new_distance},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )

    return {
        "waypoints_added": len(formatted),
        "distance_added_km": round(total_new_distance, 3),
        "total_distance_km": round(trip["total_distance_km"] + total_new_distance, 3),
    }


def end_trip(trip_id: str, user_id: str) -> dict:
    """End an active trip and update user stats."""
    trip = mongo.db.trips.find_one({
        "_id": ObjectId(trip_id),
        "user_id": user_id,
    })

    if not trip:
        raise ValueError("Trip not found.")
    if trip["status"] != "active":
        raise ValueError("Trip is already ended.")

    mongo.db.trips.update_one(
        {"_id": ObjectId(trip_id)},
        {
            "$set": {
                "status": "completed",
                "ended_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
        },
    )

    # Update user stats
    mongo.db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$inc": {
                "stats.total_trips": 1,
                "stats.total_distance_km": trip["total_distance_km"],
            },
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )

    trip["status"] = "completed"
    trip["ended_at"] = datetime.now(timezone.utc)
    return trip


def get_active_trip(user_id: str) -> dict | None:
    """Get the user's currently active trip, if any."""
    return mongo.db.trips.find_one({
        "user_id": user_id,
        "status": "active",
    })


def get_trip_by_id(trip_id: str) -> dict | None:
    """Get a trip by its ID."""
    return mongo.db.trips.find_one({"_id": ObjectId(trip_id)})


def get_user_trips(user_id: str, page: int = 1, per_page: int = 10) -> list:
    """Get paginated trip history for a user."""
    skip = (page - 1) * per_page
    return list(
        mongo.db.trips.find({"user_id": user_id})
        .sort("started_at", -1)
        .skip(skip)
        .limit(per_page)
    )


def record_trip_unlock(trip_id: str, location_id: str, location_name: str):
    """Record a location unlock that happened during a trip."""
    mongo.db.trips.update_one(
        {"_id": ObjectId(trip_id)},
        {
            "$push": {
                "unlocks_during_trip": {
                    "location_id": location_id,
                    "location_name": location_name,
                    "unlocked_at": datetime.now(timezone.utc),
                }
            }
        },
    )


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    """Calculate distance in kilometers between two GPS points."""
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 6371 * 2 * asin(sqrt(a))