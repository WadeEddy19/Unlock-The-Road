from bson import ObjectId
from datetime import datetime


def serialize_doc(doc: dict, exclude: list = None) -> dict:
    """Convert a MongoDB document to a JSON-serializable dict.

    - Converts ObjectId to string
    - Converts datetime to ISO format
    - Optionally excludes specified fields (e.g., password_hash)
    """
    if doc is None:
        return None

    exclude = exclude or []
    result = {}

    for key, value in doc.items():
        if key in exclude:
            continue
        if key == "_id":
            result["id"] = str(value)
        elif isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, dict):
            result[key] = serialize_doc(value, exclude)
        elif isinstance(value, list):
            result[key] = [
                serialize_doc(item) if isinstance(item, dict) else
                str(item) if isinstance(item, ObjectId) else item
                for item in value
            ]
        else:
            result[key] = value

    return result


def serialize_user(user: dict) -> dict:
    """Serialize a user document, excluding sensitive fields."""
    return serialize_doc(user, exclude=["password_hash"])


def serialize_location(location: dict) -> dict:
    """Serialize a location document."""
    result = serialize_doc(location)

    # Flatten coordinates for easier frontend consumption
    if "coordinates" in result and "coordinates" in result["coordinates"]:
        coords = result["coordinates"]["coordinates"]
        result["longitude"] = coords[0]
        result["latitude"] = coords[1]

    return result