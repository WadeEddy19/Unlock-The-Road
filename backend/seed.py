"""
Seed script — populates the database with sample locations.

Usage:
    python seed.py

For production, consider fetching from the NPS API:
    https://developer.nps.gov/api/v1/parks
"""

from app import create_app, mongo
from app.models.location import create_location

SAMPLE_LOCATIONS = [
    # National Parks
    {
        "name": "Yellowstone National Park",
        "location_type": "national_park",
        "latitude": 44.4280,
        "longitude": -110.5885,
        "description": "The world's first national park, known for geothermal features and wildlife.",
    },
    {
        "name": "Grand Canyon National Park",
        "location_type": "national_park",
        "latitude": 36.1069,
        "longitude": -112.1129,
        "description": "Immense canyon carved by the Colorado River over millions of years.",
    },
    {
        "name": "Yosemite National Park",
        "location_type": "national_park",
        "latitude": 37.8651,
        "longitude": -119.5383,
        "description": "Iconic granite cliffs, waterfalls, and giant sequoia groves.",
    },
    {
        "name": "Zion National Park",
        "location_type": "national_park",
        "latitude": 37.2982,
        "longitude": -113.0263,
        "description": "Stunning red cliffs and narrow slot canyons in southern Utah.",
    },
    {
        "name": "Great Smoky Mountains National Park",
        "location_type": "national_park",
        "latitude": 35.6118,
        "longitude": -83.4895,
        "description": "America's most visited national park, straddling the TN/NC border.",
    },
    # National Forests
    {
        "name": "Tongass National Forest",
        "location_type": "national_forest",
        "latitude": 57.0500,
        "longitude": -135.3300,
        "description": "The largest national forest in the US, a temperate rainforest in Alaska.",
    },
    {
        "name": "White Mountain National Forest",
        "location_type": "national_forest",
        "latitude": 44.1000,
        "longitude": -71.5000,
        "description": "Popular forest in New Hampshire with the Appalachian Trail running through.",
    },
    # State Parks
    {
        "name": "Niagara Falls State Park",
        "location_type": "state_park",
        "latitude": 43.0828,
        "longitude": -79.0742,
        "description": "America's oldest state park, home to the famous Niagara Falls.",
    },
    # Points of Interest
    {
        "name": "Old Faithful Geyser",
        "location_type": "point_of_interest",
        "latitude": 44.4605,
        "longitude": -110.8281,
        "description": "The most famous geyser in Yellowstone, erupting approximately every 90 minutes.",
    },
    {
        "name": "Half Dome",
        "location_type": "point_of_interest",
        "latitude": 37.7459,
        "longitude": -119.5332,
        "description": "Yosemite's iconic granite dome, a classic challenge for hikers.",
    },
    # Historic Sites
    {
        "name": "Gettysburg National Military Park",
        "location_type": "historic_site",
        "latitude": 39.8109,
        "longitude": -77.2305,
        "description": "Site of the pivotal Civil War battle in 1863.",
    },
    # Scenic Viewpoints
    {
        "name": "Mather Point (Grand Canyon)",
        "location_type": "scenic_viewpoint",
        "latitude": 36.0618,
        "longitude": -112.1074,
        "description": "One of the most popular and accessible viewpoints on the South Rim.",
    },
]


def seed():
    app = create_app()
    with app.app_context():
        existing = mongo.db.locations.count_documents({})
        if existing > 0:
            print(f"Database already has {existing} locations. Skipping seed.")
            print("Drop the 'locations' collection first if you want to re-seed.")
            return

        for loc_data in SAMPLE_LOCATIONS:
            loc = create_location(**loc_data)
            print(f"  ✓ {loc['name']} ({loc['location_type']})")

        print(f"\nSeeded {len(SAMPLE_LOCATIONS)} locations.")


if __name__ == "__main__":
    seed()