import base64
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.photo import (
    save_photo,
    get_photos_for_location,
    get_photo_count_for_location,
    delete_photo,
    serialize_photo,
)
from app.models.location import find_location_by_id
from app.models.user import find_user_by_id

photos_bp = Blueprint("photos", __name__)


def get_base_url():
    return request.host_url.rstrip("/")


@photos_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_photo():
    """Upload a photo for a location. User must be at the location."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    location_id = data.get("location_id")
    image_base64 = data.get("image")
    filename = data.get("filename", "photo.jpg")
    if not location_id or not image_base64:
        return jsonify({"errors": ["Location ID and image are required."]}), 400

    # Check location exists
    location = find_location_by_id(location_id)
    if not location:
        return jsonify({"errors": ["Location not found."]}), 404

    # Check user has unlocked this location
    user = find_user_by_id(user_id)
    if location_id not in [str(loc) for loc in user.get("unlocked_locations", [])]:
        return jsonify({"errors": ["You must unlock this location first."]}), 403


    # Decode and save
    try:
        image_data = base64.b64decode(image_base64)
    except Exception:
        return jsonify({"errors": ["Invalid image data."]}), 400

    photo = save_photo(user_id, location_id, image_data, filename)

    return jsonify({
        "message": "Photo uploaded!",
        "photo": serialize_photo(photo, get_base_url()),
    }), 201


@photos_bp.route("/location/<location_id>", methods=["GET"])
@jwt_required()
def location_photos(location_id):
    """Get photos for a location."""
    page = request.args.get("page", default=1, type=int)

    photos = get_photos_for_location(location_id, page)
    total = get_photo_count_for_location(location_id)
    base_url = get_base_url()

    return jsonify({
        "total": total,
        "page": page,
        "photos": [serialize_photo(p, base_url) for p in photos],
    }), 200





@photos_bp.route("/<photo_id>", methods=["DELETE"])
@jwt_required()
def remove_photo(photo_id):
    """Delete a photo (owner only)."""
    user_id = get_jwt_identity()

    if delete_photo(photo_id, user_id):
        return jsonify({"message": "Photo deleted."}), 200
    else:
        return jsonify({"errors": ["Photo not found or not yours."]}), 404