## Phase 1

# Travel Unlocked — API

A gamified travel tracking API built with Flask and MongoDB. Track road trips, unlock locations by visiting them, and level up your explorer profile.

## Tech Stack

- **Flask** — lightweight Python web framework
- **MongoDB** — document database with geospatial indexing
- **JWT** — token-based authentication
- **Bcrypt** — password hashing

## Quick Start

### Prerequisites

- Python 3.10+
- MongoDB running locally (default: `localhost:27017`)

### Setup

```bash
# Clone and enter the project
cd travel-app-api

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file
cp .env.example .env
# Edit .env with your own secret keys

# Seed sample locations
python seed.py

# Run the dev server
python run.py
```

The API will be available at `http://localhost:5000`.

## API Endpoints

### Auth
| Method | Endpoint            | Description              | Auth     |
|--------|---------------------|--------------------------|----------|
| POST   | `/api/auth/register`| Create a new account     | No       |
| POST   | `/api/auth/login`   | Login, get tokens        | No       |
| POST   | `/api/auth/refresh` | Refresh access token     | Refresh  |
| GET    | `/api/auth/me`      | Get current user profile | Bearer   |

### Users
| Method | Endpoint                | Description                | Auth   |
|--------|-------------------------|----------------------------|--------|
| PATCH  | `/api/users/profile`    | Update avatar or title     | Bearer |
| GET    | `/api/users/<username>` | View public profile        | No     |
| GET    | `/api/users/unlocks`    | List your unlocked places  | Bearer |

### Locations
| Method | Endpoint              | Description                          | Auth   |
|--------|-----------------------|--------------------------------------|--------|
| GET    | `/api/locations/`     | List locations (filter by type)      | No     |
| GET    | `/api/locations/nearby`| Find locations near coordinates     | Bearer |
| POST   | `/api/locations/unlock`| Unlock a location by proximity      | Bearer |
| GET    | `/api/locations/types` | List location types & XP rewards    | No     |

### Health
| Method | Endpoint       | Description   |
|--------|----------------|---------------|
| GET    | `/api/health`  | Health check  |

## Example Requests

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "trailboss", "email": "trail@example.com", "password": "securepass123"}'
```

### Unlock a Location
```bash
curl -X POST http://localhost:5000/api/locations/unlock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer " \
  -d '{"location_id": "", "latitude": 44.4605, "longitude": -110.8281}'
```

## Project Structure

```
travel-app-api/
├── app/
│   ├── __init__.py          # App factory, extensions, indexes
│   ├── models/
│   │   ├── user.py          # User model, XP/leveling logic
│   │   └── location.py      # Location model, geospatial queries
│   ├── routes/
│   │   ├── auth.py          # Register, login, refresh, me
│   │   ├── users.py         # Profile updates, public profiles
│   │   └── locations.py     # Nearby, unlock, list
│   └── utils/
│       ├── serializers.py   # MongoDB → JSON conversion
│       └── validators.py    # Input validation
├── config/
│   └── settings.py          # App configuration
├── .env.example             # Environment variables template
├── requirements.txt
├── run.py                   # Entry point
├── seed.py                  # Database seeder
└── README.md
```

## Next Steps

- [ ] Seed locations from the [NPS API](https://developer.nps.gov/)
- [ ] Add trip tracking (GPS breadcrumb recording)
- [ ] Build the Expo React Native frontend
- [ ] Add achievement/badge system
- [ ] Implement leaderboards

## Current Testing Setup:
- Start python app from backend/ python run.py
- Start development server from mobile/ npx expo start --dev-client --tunnel
- Start ngrok server on ngrok http 5000
- For location unlock with dev location run backend/ python test_unlock.py 33.84070 -118.37339
- 
