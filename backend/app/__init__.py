import os
from flask import Flask
from flask_pymongo import PyMongo
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_cors import CORS

from config.settings import config_by_name



# Extensions (initialized without app, bound in create_app)
mongo = PyMongo()
jwt = JWTManager()
bcrypt = Bcrypt()


def create_app(config_name=None):
    """Application factory."""
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    # Initialize extensions
    mongo.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    CORS(app)

    # Create MongoDB indexes
    with app.app_context():
        _ensure_indexes()

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.users import users_bp
    from app.routes.locations import locations_bp
    from app.routes.trips import trips_bp
    from app.routes.photos import photos_bp

    app.register_blueprint(photos_bp, url_prefix="/api/photos")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(locations_bp, url_prefix="/api/locations")
    app.register_blueprint(trips_bp, url_prefix="/api/trips")


    from app.routes.dev import dev_bp
    app.register_blueprint(dev_bp, url_prefix="/api/dev")

    # Health check
    @app.route("/api/health")
    def health():
        return {"status": "ok"}, 200

    return app


def _ensure_indexes():
    """Create necessary MongoDB indexes."""
    db = mongo.db

    # Users: unique email, unique username
    db.users.create_index("email", unique=True)
    db.users.create_index("username", unique=True)

    # Locations: geospatial index for proximity queries
    db.locations.create_index([("coordinates", "2dsphere")])
    db.locations.create_index("location_type")

    # Trips: user lookup, time-based sorting
    db.trips.create_index("user_id")
    db.trips.create_index([("user_id", 1), ("created_at", -1)])