from datetime import datetime, timezone
from app import mongo


# Achievement definitions
ACHIEVEMENTS = {
    # Location-based achievements
    "first_unlock": {
        "name": "First Steps",
        "description": "Unlock your first location.",
        "emoji": "👣",
        "category": "exploration",
        "condition": {"type": "total_unlocks", "count": 1},
    },
    "unlock_5": {
        "name": "Getting Started",
        "description": "Unlock 5 locations.",
        "emoji": "🗺️",
        "category": "exploration",
        "condition": {"type": "total_unlocks", "count": 5},
    },
    "unlock_25": {
        "name": "Trailblazer",
        "description": "Unlock 25 locations.",
        "emoji": "🥾",
        "category": "exploration",
        "condition": {"type": "total_unlocks", "count": 25},
    },
    "unlock_50": {
        "name": "Road Warrior",
        "description": "Unlock 50 locations.",
        "emoji": "🛣️",
        "category": "exploration",
        "condition": {"type": "total_unlocks", "count": 50},
    },
    "unlock_100": {
        "name": "Century Club",
        "description": "Unlock 100 locations.",
        "emoji": "💯",
        "category": "exploration",
        "condition": {"type": "total_unlocks", "count": 100},
    },

    # Type-specific achievements
    "first_park": {
        "name": "Park Ranger",
        "description": "Unlock your first National Park.",
        "emoji": "🏞️",
        "category": "parks",
        "condition": {"type": "parks_unlocked", "count": 1},
    },
    "parks_5": {
        "name": "Park Enthusiast",
        "description": "Unlock 5 National Parks.",
        "emoji": "⛰️",
        "category": "parks",
        "condition": {"type": "parks_unlocked", "count": 5},
    },
    "parks_15": {
        "name": "Park Master",
        "description": "Unlock 15 National Parks.",
        "emoji": "🏔️",
        "category": "parks",
        "condition": {"type": "parks_unlocked", "count": 15},
    },
    "first_forest": {
        "name": "Into the Woods",
        "description": "Unlock your first National Forest.",
        "emoji": "🌲",
        "category": "forests",
        "condition": {"type": "forests_unlocked", "count": 1},
    },
    "forests_5": {
        "name": "Forest Guardian",
        "description": "Unlock 5 National Forests.",
        "emoji": "🌳",
        "category": "forests",
        "condition": {"type": "forests_unlocked", "count": 5},
    },
    "first_historic": {
        "name": "History Buff",
        "description": "Unlock your first Historic Site.",
        "emoji": "🏛️",
        "category": "historic",
        "condition": {"type": "poi_unlocked", "count": 1},
    },

    # Level-based achievements
    "level_5": {
        "name": "Rising Star",
        "description": "Reach Level 5.",
        "emoji": "⭐",
        "category": "leveling",
        "condition": {"type": "level", "count": 5},
    },
    "level_10": {
        "name": "Seasoned Explorer",
        "description": "Reach Level 10.",
        "emoji": "🌟",
        "category": "leveling",
        "condition": {"type": "level", "count": 10},
    },
    "level_15": {
        "name": "Living Legend",
        "description": "Reach Level 15.",
        "emoji": "👑",
        "category": "leveling",
        "condition": {"type": "level", "count": 15},
    },

    # XP milestones
    "xp_1000": {
        "name": "XP Hunter",
        "description": "Earn 1,000 total XP.",
        "emoji": "🎯",
        "category": "xp",
        "condition": {"type": "xp", "count": 1000},
    },
    "xp_5000": {
        "name": "XP Machine",
        "description": "Earn 5,000 total XP.",
        "emoji": "🔥",
        "category": "xp",
        "condition": {"type": "xp", "count": 5000},
    },
    "xp_10000": {
        "name": "XP Legend",
        "description": "Earn 10,000 total XP.",
        "emoji": "💎",
        "category": "xp",
        "condition": {"type": "xp", "count": 10000},
    },
}

# Bonus XP for earning an achievement
ACHIEVEMENT_XP_BONUS = 50


def check_achievements(user) -> list:
    """Check which new achievements the user has earned.

    Returns a list of newly earned achievement keys.
    """
    earned = user.get("achievements", [])
    stats = user.get("stats", {})
    total_unlocks = len(user.get("unlocked_locations", []))

    new_achievements = []

    for key, achievement in ACHIEVEMENTS.items():
        if key in earned:
            continue

        condition = achievement["condition"]
        condition_type = condition["type"]
        required = condition["count"]

        met = False

        if condition_type == "total_unlocks":
            met = total_unlocks >= required
        elif condition_type == "parks_unlocked":
            met = stats.get("parks_unlocked", 0) >= required
        elif condition_type == "forests_unlocked":
            met = stats.get("forests_unlocked", 0) >= required
        elif condition_type == "poi_unlocked":
            met = stats.get("poi_unlocked", 0) >= required
        elif condition_type == "level":
            met = user.get("level", 1) >= required
        elif condition_type == "xp":
            met = user.get("xp", 0) >= required

        if met:
            new_achievements.append(key)

    return new_achievements


def grant_achievements(user_id, achievement_keys: list) -> list:
    """Grant achievements to a user and return their details."""
    from bson import ObjectId

    if not achievement_keys:
        return []

    granted = []
    for key in achievement_keys:
        achievement = ACHIEVEMENTS[key]

        mongo.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$push": {
                    "achievements": key,
                    "achievement_log": {
                        "key": key,
                        "earned_at": datetime.now(timezone.utc),
                    },
                },
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
        )

        granted.append({
            "key": key,
            "name": achievement["name"],
            "description": achievement["description"],
            "emoji": achievement["emoji"],
            "category": achievement["category"],
            "xp_bonus": ACHIEVEMENT_XP_BONUS,
        })

    return granted


def get_all_achievements(user) -> list:
    """Get all achievements with earned status for a user."""
    earned = set(user.get("achievements", []))
    achievement_log = {
        entry["key"]: entry["earned_at"]
        for entry in user.get("achievement_log", [])
    }

    result = []
    for key, achievement in ACHIEVEMENTS.items():
        result.append({
            "key": key,
            "name": achievement["name"],
            "description": achievement["description"],
            "emoji": achievement["emoji"],
            "category": achievement["category"],
            "earned": key in earned,
            "earned_at": achievement_log.get(key, None),
        })

    return result