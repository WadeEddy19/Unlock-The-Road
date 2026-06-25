from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.location import create_location
from app.utils.serializers import serialize_location

dev_bp = Blueprint("dev", __name__)


@dev_bp.route("/create-nearby", methods=["POST"])
@jwt_required()
def create_nearby_location():
    """DEV ONLY: Create a test location at given coordinates.

    Use this to test unlocking without traveling to a real park.
    Remove this route before deploying to production.
    """
    data = request.get_json() or {}

    lat = data.get("latitude")
    lng = data.get("longitude")
    name = data.get("name", "Test Location")
    location_type = data.get("location_type", "point_of_interest")

    if lat is None or lng is None:
        return jsonify({"errors": ["Latitude and longitude are required."]}), 400

    location = create_location(
        name=name,
        location_type=location_type,
        longitude=float(lng),
        latitude=float(lat),
        description="Dev test location — delete before production.",
        unlock_radius=1000,  # 1km radius for easy testing
    )

    return jsonify({
        "message": f"Created test location '{name}' at your position.",
        "location": serialize_location(location),
    }), 201