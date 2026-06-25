from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)
from app.models.user import (
    create_user,
    find_user_by_email,
    find_user_by_username,
    verify_password,
    find_user_by_id,
)
from app.utils.validators import validate_registration
from app.utils.serializers import serialize_user

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    """Register a new user."""
    data = request.get_json() or {}

    # Validate input
    errors = validate_registration(data)
    if errors:
        return jsonify({"errors": errors}), 400

    # Check for existing user
    if find_user_by_email(data["email"]):
        return jsonify({"errors": ["Email is already registered."]}), 409

    if find_user_by_username(data["username"]):
        return jsonify({"errors": ["Username is already taken."]}), 409

    # Create user
    user = create_user(
        username=data["username"].strip(),
        email=data["email"].strip(),
        password=data["password"],
    )

    # Generate tokens
    user_id = str(user["_id"])
    access_token = create_access_token(identity=user_id)
    refresh_token = create_refresh_token(identity=user_id)

    return jsonify({
        "message": "Account created successfully.",
        "user": serialize_user(user),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticate and return tokens."""
    data = request.get_json() or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"errors": ["Email and password are required."]}), 400

    user = find_user_by_email(email)
    if not user or not verify_password(user, password):
        return jsonify({"errors": ["Invalid email or password."]}), 401

    user_id = str(user["_id"])
    access_token = create_access_token(identity=user_id)
    refresh_token = create_refresh_token(identity=user_id)

    return jsonify({
        "user": serialize_user(user),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }), 200


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    """Get a new access token using a refresh token."""
    user_id = get_jwt_identity()
    access_token = create_access_token(identity=user_id)

    return jsonify({"access_token": access_token}), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """Get the current authenticated user's profile."""
    user_id = get_jwt_identity()
    user = find_user_by_id(user_id)

    if not user:
        return jsonify({"errors": ["User not found."]}), 404

    return jsonify({"user": serialize_user(user)}), 200