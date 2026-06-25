from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.trip import (
    start_trip,
    add_waypoint,
    add_batch_waypoints,
    end_trip,
    get_active_trip,
    get_trip_by_id,
    get_user_trips,
)
from app.utils.serializers import serialize_doc

trips_bp = Blueprint("trips", __name__)


@trips_bp.route("/start", methods=["POST"])
@jwt_required()
def start():
    """Start a new trip."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    name = data.get("name")

    try:
        trip = start_trip(user_id, name)
        return jsonify({
            "message": "Trip started!",
            "trip": serialize_doc(trip),
        }), 201
    except ValueError as e:
        return jsonify({"errors": [str(e)]}), 409


@trips_bp.route("/active", methods=["GET"])
@jwt_required()
def active():
    """Get the current active trip."""
    user_id = get_jwt_identity()
    trip = get_active_trip(user_id)

    if not trip:
        return jsonify({"trip": None}), 200

    return jsonify({"trip": serialize_doc(trip)}), 200


@trips_bp.route("/<trip_id>/waypoint", methods=["POST"])
@jwt_required()
def waypoint(trip_id):
    """Add a single waypoint to an active trip."""
    data = request.get_json() or {}
    lat = data.get("latitude")
    lng = data.get("longitude")

    if lat is None or lng is None:
        return jsonify({"errors": ["Latitude and longitude are required."]}), 400

    try:
        result = add_waypoint(trip_id, float(lat), float(lng))
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"errors": [str(e)]}), 400


@trips_bp.route("/<trip_id>/waypoints/batch", methods=["POST"])
@jwt_required()
def batch_waypoints(trip_id):
    """Add multiple waypoints at once (for offline sync)."""
    data = request.get_json() or {}
    waypoints = data.get("waypoints", [])

    if not waypoints:
        return jsonify({"errors": ["Waypoints array is required."]}), 400

    try:
        result = add_batch_waypoints(trip_id, waypoints)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"errors": [str(e)]}), 400


@trips_bp.route("/<trip_id>/end", methods=["POST"])
@jwt_required()
def end(trip_id):
    """End an active trip."""
    user_id = get_jwt_identity()

    try:
        trip = end_trip(trip_id, user_id)
        return jsonify({
            "message": "Trip completed!",
            "trip": serialize_doc(trip),
        }), 200
    except ValueError as e:
        return jsonify({"errors": [str(e)]}), 400


@trips_bp.route("/history", methods=["GET"])
@jwt_required()
def history():
    """Get the user's trip history."""
    user_id = get_jwt_identity()
    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=10, type=int)

    trips = get_user_trips(user_id, page, per_page)

    # Don't send full waypoints array in list view (too heavy)
    trip_summaries = []
    for trip in trips:
        summary = serialize_doc(trip)
        summary["waypoint_count"] = len(trip.get("waypoints", []))
        summary.pop("waypoints", None)
        trip_summaries.append(summary)

    return jsonify({
        "page": page,
        "count": len(trip_summaries),
        "trips": trip_summaries,
    }), 200


@trips_bp.route("/<trip_id>", methods=["GET"])
@jwt_required()
def get_trip(trip_id):
    """Get full trip details including waypoints."""
    trip = get_trip_by_id(trip_id)

    if not trip:
        return jsonify({"errors": ["Trip not found."]}), 404

    return jsonify({"trip": serialize_doc(trip)}), 200


@trips_bp.route("/<trip_id>", methods=["DELETE"])
@jwt_required()
def delete_trip(trip_id):
    """Delete a trip."""
    from bson import ObjectId
    from app import mongo

    user_id = get_jwt_identity()

    trip = mongo.db.trips.find_one({
        "_id": ObjectId(trip_id),
        "user_id": user_id,
    })

    if not trip:
        return jsonify({"errors": ["Trip not found."]}), 404

    mongo.db.trips.delete_one({"_id": ObjectId(trip_id)})

    return jsonify({"message": "Trip deleted."}), 200