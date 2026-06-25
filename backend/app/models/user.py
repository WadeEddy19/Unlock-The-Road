from datetime import datetime, timezone
from app import mongo, bcrypt


# XP thresholds for each level
LEVEL_THRESHOLDS = [
    0,      # Level 1
    100,    # Level 2
    300,    # Level 3
    600,    # Level 4
    1000,   # Level 5
    1500,   # Level 6
    2100,   # Level 7
    2800,   # Level 8
    3600,   # Level 9
    4500,   # Level 10
    5500,   # Level 11
    6600,   # Level 12
    7800,   # Level 13
    9100,   # Level 14
    10500,  # Level 15
]

# Default avatars available to all users
DEFAULT_AVATARS = ["explorer", "hiker", "camper"]

# Titles unlocked at specific levels
LEVEL_TITLES = {
    1: "Newcomer",
    3: "Trailblazer",
    5: "Pathfinder",
    7: "Ranger",
    10: "Adventurer",
    13: "Wayfarer",
    15: "Legend",
}


def calculate_level(xp: int) -> int:
    """Calculate user level from XP."""
    level = 1
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if xp >= threshold:
            level = i + 1
        else:
            break
    return level


def get_unlocked_titles(level: int) -> list:
    """Get all titles unlocked at or below the given level."""
    return [
        title for lvl, title in LEVEL_TITLES.items() if lvl <= level
    ]


def create_user(username: str, email: str, password: str) -> dict:
    """Create a new user document and insert into MongoDB."""
    hashed_pw = bcrypt.generate_password_hash(password).decode("utf-8")

    user_doc = {
        "username": username,
        "email": email.lower(),
        "password_hash": hashed_pw,
        "xp": 0,
        "level": 1,
        "avatar": "explorer",
        "title": "Newcomer",
        "unlocked_avatars": DEFAULT_AVATARS.copy(),
        "unlocked_titles": ["Newcomer"],
        "unlocked_locations": [],
        "stats": {
            "total_trips": 0,
            "total_distance_km": 0,
            "parks_unlocked": 0,
            "forests_unlocked": 0,
            "poi_unlocked": 0,
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    result = mongo.db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return user_doc


def find_user_by_email(email: str) -> dict | None:
    """Find a user by email."""
    return mongo.db.users.find_one({"email": email.lower()})


def find_user_by_id(user_id) -> dict | None:
    """Find a user by ObjectId."""
    from bson import ObjectId
    return mongo.db.users.find_one({"_id": ObjectId(user_id)})


def find_user_by_username(username: str) -> dict | None:
    """Find a user by username."""
    return mongo.db.users.find_one({"username": username})


def verify_password(user: dict, password: str) -> bool:
    """Check a plaintext password against the stored hash."""
    return bcrypt.check_password_hash(user["password_hash"], password)


def award_xp(user_id, xp_amount: int) -> dict:
    """Award XP to a user and handle level-ups."""
    from bson import ObjectId

    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    new_xp = user["xp"] + xp_amount
    new_level = calculate_level(new_xp)
    new_titles = get_unlocked_titles(new_level)

    update = {
        "$set": {
            "xp": new_xp,
            "level": new_level,
            "unlocked_titles": new_titles,
            "updated_at": datetime.now(timezone.utc),
        }
    }

    mongo.db.users.update_one({"_id": ObjectId(user_id)}, update)

    leveled_up = new_level > user["level"]
    return {
        "xp_gained": xp_amount,
        "total_xp": new_xp,
        "level": new_level,
        "leveled_up": leveled_up,
        "new_titles": [t for t in new_titles if t not in user.get("unlocked_titles", [])],
    }