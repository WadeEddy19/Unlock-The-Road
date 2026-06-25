from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

from app import mongo
from app.models.location import (
    find_nearby_locations,
    find_unlockable_locations,
    get_locations_by_type,
    LOCATION_TYPES,
)
from app.models.user import find_user_by_id, award_xp
from app.utils.validators import validate_coordinates
from app.utils.serializers import serialize_location

locations_bp = Blueprint("locations", __name__)


@locations_bp.route("/nearby", methods=["GET"])
@jwt_required()
def nearby():
    """Find locations near the user's current position."""
    lat = request.args.get("latitude", type=float)
    lng = request.args.get("longitude", type=float)
    radius = request.args.get("radius", default=5000, type=int)

    errors = validate_coordinates({"latitude": lat, "longitude": lng})
    if errors:
        return jsonify({"errors": errors}), 400

    locations = find_nearby_locations(lng, lat, max_distance_m=radius)

    # Mark which ones the user has already unlocked
    user_id = get_jwt_identity()
    user = find_user_by_id(user_id)
    unlocked_ids = set(str(uid) for uid in user.get("unlocked_locations", []))

    result = []
    for loc in locations:
        serialized = serialize_location(loc)
        serialized["unlocked"] = serialized["id"] in unlocked_ids
        result.append(serialized)

    return jsonify({"locations": result}), 200


@locations_bp.route("/unlock", methods=["POST"])
@jwt_required()
def unlock():
    """Attempt to unlock a location based on proximity."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    location_id = data.get("location_id")
    lat = data.get("latitude")
    lng = data.get("longitude")

    if not location_id:
        return jsonify({"errors": ["location_id is required."]}), 400

    errors = validate_coordinates({"latitude": lat, "longitude": lng})
    if errors:
        return jsonify({"errors": errors}), 400

    # Check if location exists
    location = mongo.db.locations.find_one({"_id": ObjectId(location_id)})
    if not location:
        return jsonify({"errors": ["Location not found."]}), 404

    # Check if already unlocked
    user = find_user_by_id(user_id)
    unlocked_ids = [str(uid) for uid in user.get("unlocked_locations", [])]
    if location_id in unlocked_ids:
        return jsonify({"errors": ["Location already unlocked."]}), 409

    # Check proximity
    unlockable = find_unlockable_locations(float(lng), float(lat))
    unlockable_ids = [str(loc["_id"]) for loc in unlockable]

    if location_id not in unlockable_ids:
        return jsonify({
            "errors": ["You are not close enough to unlock this location."]
        }), 403

    # Unlock it!
    mongo.db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$push": {"unlocked_locations": location_id},
            "$set": {"updated_at": datetime.now(timezone.utc)},
            "$inc": {
                f"stats.{_stat_key(location['location_type'])}": 1,
            },
        },
    )

    # Increment the location's unlock counter
    mongo.db.locations.update_one(
        {"_id": ObjectId(location_id)},
        {"$inc": {"times_unlocked": 1}},
    )

    # Record unlock in active trip if there is one
    from app.models.trip import get_active_trip, record_trip_unlock
    active_trip = get_active_trip(user_id)
    if active_trip:
        record_trip_unlock(str(active_trip["_id"]), location_id, location["name"])
        
    # Award XP
    xp_result = award_xp(user_id, location["xp_reward"])

    # Check for new achievements
    from app.models.achievement import check_achievements, grant_achievements, ACHIEVEMENT_XP_BONUS
    updated_user = find_user_by_id(user_id)
    new_achievement_keys = check_achievements(updated_user)
    granted = grant_achievements(user_id, new_achievement_keys)

    # Award bonus XP for each achievement earned
    if granted:
        bonus_xp = len(granted) * ACHIEVEMENT_XP_BONUS
        bonus_result = award_xp(user_id, bonus_xp)
        xp_result["total_xp"] = bonus_result["total_xp"]
        xp_result["level"] = bonus_result["level"]
        xp_result["leveled_up"] = xp_result["leveled_up"] or bonus_result["leveled_up"]
        xp_result["achievement_bonus_xp"] = bonus_xp

    return jsonify({
        "message": f"Unlocked {location['name']}!",
        "location": serialize_location(location),
        "xp": xp_result,
        "achievements": granted,
    }), 200


@locations_bp.route("/types", methods=["GET"])
def list_types():
    """List all available location types and their XP rewards."""
    return jsonify({"types": LOCATION_TYPES}), 200


@locations_bp.route("/", methods=["GET"])
def list_locations():
    """List locations, optionally filtered by type."""
    location_type = request.args.get("type")
    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=20, type=int)

    if location_type and location_type not in LOCATION_TYPES:
        return jsonify({"errors": [f"Invalid type. Options: {list(LOCATION_TYPES.keys())}"]}), 400

    if location_type:
        locations = get_locations_by_type(location_type, page, per_page)
    else:
        skip = (page - 1) * per_page
        locations = list(mongo.db.locations.find().skip(skip).limit(per_page))

    return jsonify({
        "page": page,
        "count": len(locations),
        "locations": [serialize_location(loc) for loc in locations],
    }), 200


def _stat_key(location_type: str) -> str:
    """Map location type to the stats field name."""
    mapping = {
        "national_park": "parks_unlocked",
        "state_park": "parks_unlocked",
        "city_park": "parks_unlocked",
        "national_forest": "forests_unlocked",
    }
    return mapping.get(location_type, "poi_unlocked")