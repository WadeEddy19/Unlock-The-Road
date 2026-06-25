import os
import cloudinary
import cloudinary.uploader
from datetime import datetime, timezone
from bson import ObjectId
from app import mongo

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)


def save_photo(user_id: str, location_id: str, image_data: bytes, filename: str) -> dict:
    """Upload photo to Cloudinary and create a database record."""
    import base64

    # Upload to Cloudinary
    b64_string = base64.b64encode(image_data).decode("utf-8")
    ext = os.path.splitext(filename)[1].lower() or ".jpg"
    mime = "image/jpeg" if ext in [".jpg", ".jpeg"] else "image/png"
    data_uri = f"data:{mime};base64,{b64_string}"

    result = cloudinary.uploader.upload(
        data_uri,
        folder="unlock-the-road",
        resource_type="image",
        transformation={"quality": "auto", "fetch_format": "auto"},
    )

    photo_doc = {
        "user_id": user_id,
        "location_id": location_id,
        "url": result["secure_url"],
        "public_id": result["public_id"],
        "original_filename": filename,
        "created_at": datetime.now(timezone.utc),
    }

    insert_result = mongo.db.photos.insert_one(photo_doc)
    photo_doc["_id"] = insert_result.inserted_id
    return photo_doc


def get_photos_for_location(location_id: str, page: int = 1, per_page: int = 20) -> list:
    """Get all photos for a location with user info."""
    skip = (page - 1) * per_page
    photos = list(
        mongo.db.photos.find({"location_id": location_id})
        .sort("created_at", -1)
        .skip(skip)
        .limit(per_page)
    )

    for photo in photos:
        user = mongo.db.users.find_one(
            {"_id": ObjectId(photo["user_id"])},
            {"username": 1, "avatar": 1}
        )
        if user:
            photo["username"] = user.get("username", "Unknown")
            photo["avatar"] = user.get("avatar", "explorer")

    return photos


def get_photo_count_for_location(location_id: str) -> int:
    """Get total photo count for a location."""
    return mongo.db.photos.count_documents({"location_id": location_id})


def get_user_photos(user_id: str, page: int = 1, per_page: int = 20) -> list:
    """Get all photos uploaded by a user."""
    skip = (page - 1) * per_page
    return list(
        mongo.db.photos.find({"user_id": user_id})
        .sort("created_at", -1)
        .skip(skip)
        .limit(per_page)
    )


def delete_photo(photo_id: str, user_id: str) -> bool:
    """Delete a photo from Cloudinary and database."""
    photo = mongo.db.photos.find_one({
        "_id": ObjectId(photo_id),
        "user_id": user_id,
    })

    if not photo:
        return False

    # Delete from Cloudinary
    if photo.get("public_id"):
        try:
            cloudinary.uploader.destroy(photo["public_id"])
        except Exception:
            pass

    mongo.db.photos.delete_one({"_id": ObjectId(photo_id)})
    return True


def serialize_photo(photo: dict, base_url: str = "") -> dict:
    """Serialize a photo document for API response."""
    return {
        "id": str(photo["_id"]),
        "user_id": photo["user_id"],
        "username": photo.get("username", "Unknown"),
        "avatar": photo.get("avatar", "explorer"),
        "location_id": photo["location_id"],
        "url": photo.get("url", ""),
        "created_at": photo["created_at"].isoformat() if isinstance(photo["created_at"], datetime) else photo["created_at"],
    }