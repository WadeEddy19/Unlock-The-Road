import re


def validate_registration(data: dict) -> list:
    """Validate registration input. Returns list of error messages."""
    errors = []

    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    # Username
    if not username:
        errors.append("Username is required.")
    elif len(username) < 3 or len(username) > 30:
        errors.append("Username must be 3-30 characters.")
    elif not re.match(r"^[a-zA-Z0-9_]+$", username):
        errors.append("Username can only contain letters, numbers, and underscores.")

    # Email
    if not email:
        errors.append("Email is required.")
    elif not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        errors.append("Invalid email format.")

    # Password
    if not password:
        errors.append("Password is required.")
    elif len(password) < 8:
        errors.append("Password must be at least 8 characters.")

    return errors


def validate_coordinates(data: dict) -> list:
    """Validate latitude/longitude input."""
    errors = []

    lat = data.get("latitude")
    lng = data.get("longitude")

    if lat is None or lng is None:
        errors.append("Latitude and longitude are required.")
    else:
        try:
            lat = float(lat)
            lng = float(lng)
            if not (-90 <= lat <= 90):
                errors.append("Latitude must be between -90 and 90.")
            if not (-180 <= lng <= 180):
                errors.append("Longitude must be between -180 and 180.")
        except (TypeError, ValueError):
            errors.append("Latitude and longitude must be numbers.")

    return errors