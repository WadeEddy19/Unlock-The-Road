from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

from app import mongo
from app.models.user import find_user_by_id, find_user_by_username
from app.utils.serializers import serialize_user

users_bp = Blueprint("users", __name__)


@users_bp.route("/profile", methods=["PATCH"])
@jwt_required()
def update_profile():
    """Update the current user's avatar or title."""
    user_id = get_jwt_identity()
    user = find_user_by_id(user_id)

    if not user:
        return jsonify({"errors": ["User not found."]}), 404

    data = request.get_json() or {}
    updates = {}

    # Update avatar if provided
    avatar = data.get("avatar")
    if avatar:
        if avatar not in user.get("unlocked_avatars", []):
            return jsonify({"errors": ["Avatar not unlocked."]}), 403
        updates["avatar"] = avatar

    # Update title if provided
    title = data.get("title")
    if title:
        if title not in user.get("unlocked_titles", []):
            return jsonify({"errors": ["Title not unlocked."]}), 403
        updates["title"] = title

    if not updates:
        return jsonify({"errors": ["No valid fields to update."]}), 400

    updates["updated_at"] = datetime.now(timezone.utc)
    mongo.db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})

    updated_user = find_user_by_id(user_id)
    return jsonify({"user": serialize_user(updated_user)}), 200


@users_bp.route("/<username>", methods=["GET"])
def get_public_profile(username):
    """View another user's public profile."""
    user = find_user_by_username(username)

    if not user:
        return jsonify({"errors": ["User not found."]}), 404

    # Return limited public info
    public_data = {
        "username": user["username"],
        "level": user["level"],
        "avatar": user["avatar"],
        "title": user["title"],
        "stats": user.get("stats", {}),
        "created_at": user["created_at"].isoformat(),
    }

    return jsonify({"user": public_data}), 200


@users_bp.route("/unlocks", methods=["GET"])
@jwt_required()
def get_unlocked_locations():
    """Get the current user's unlocked locations."""
    user_id = get_jwt_identity()
    user = find_user_by_id(user_id)

    if not user:
        return jsonify({"errors": ["User not found."]}), 404

    unlocked_ids = user.get("unlocked_locations", [])

    # Fetch the actual location documents
    locations = list(
        mongo.db.locations.find({"_id": {"$in": [ObjectId(lid) for lid in unlocked_ids]}})
    )

    from app.utils.serializers import serialize_location
    return jsonify({
        "count": len(locations),
        "locations": [serialize_location(loc) for loc in locations],
    }), 200

@users_bp.route("/achievements", methods=["GET"])
@jwt_required()
def get_achievements():
    """Get all achievements with earned status."""
    user_id = get_jwt_identity()
    user = find_user_by_id(user_id)

    if not user:
        return jsonify({"errors": ["User not found."]}), 404

    from app.models.achievement import get_all_achievements
    achievements = get_all_achievements(user)

    earned_count = sum(1 for a in achievements if a["earned"])

    return jsonify({
        "total": len(achievements),
        "earned": earned_count,
        "achievements": achievements,
    }), 200