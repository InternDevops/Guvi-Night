import os
import secrets
import datetime
import json

import bcrypt
import jwt
import pymysql
import pymysql.cursors
import redis
from bson import ObjectId
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient

# ─────────────────────────────────────────
# Config
# ─────────────────────────────────────────
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

JWT_SECRET    = os.getenv("JWT_SECRET", "change_me_supersecret_key_123")
JWT_ALGO      = "HS256"
TOKEN_EXPIRY  = 60 * 60 * 24     # 24 hours in seconds


# ─────────────────────────────────────────
# MySQL connection factory
# ─────────────────────────────────────────
def get_mysql():
    return pymysql.connect(
        host     = os.getenv("MYSQL_HOST",     "localhost"),
        port     = int(os.getenv("MYSQL_PORT", "3306")),
        user     = os.getenv("MYSQL_USER",     "root"),
        password = os.getenv("MYSQL_PASSWORD", ""),
        db       = os.getenv("MYSQL_DB",       "nexus_db"),
        charset  = "utf8mb4",
        cursorclass = pymysql.cursors.DictCursor,
        autocommit  = False,
    )


# ─────────────────────────────────────────
# MongoDB
# ─────────────────────────────────────────
_mongo_client = None

def get_mongo_db():
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
    return _mongo_client[os.getenv("MONGO_DB", "nexus_db")]


# ─────────────────────────────────────────
# Redis
# ─────────────────────────────────────────
_redis_client = None

def get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(
            host     = os.getenv("REDIS_HOST",     "localhost"),
            port     = int(os.getenv("REDIS_PORT", "6379")),
            password = os.getenv("REDIS_PASSWORD") or None,
            db       = 0,
            decode_responses = True,
        )
    return _redis_client


# ─────────────────────────────────────────
# JWT helpers
# ─────────────────────────────────────────
def create_token(user_id: int, username: str) -> str:
    payload = {
        "sub":      str(user_id),
        "username": username,
        "iat":      datetime.datetime.utcnow(),
        "exp":      datetime.datetime.utcnow() + datetime.timedelta(seconds=TOKEN_EXPIRY),
        "jti":      secrets.token_hex(16),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def verify_token(token: str) -> dict | None:
    """Return decoded payload or None if invalid/expired."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        # Check Redis blacklist / session store
        r = get_redis()
        session_key = f"session:{payload['jti']}"
        if not r.exists(session_key):
            return None          
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_auth_payload():
    """Extract and verify bearer token from current request."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    return verify_token(auth[7:])


# ─────────────────────────────────────────
# DB initialisation helper (run once)
# ─────────────────────────────────────────
def init_mysql():
    """Create the users table if it doesn't exist."""
    conn = get_mysql()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    first_name VARCHAR(80)  NOT NULL,
                    last_name  VARCHAR(80)  NOT NULL,
                    email      VARCHAR(255) NOT NULL UNIQUE,
                    username   VARCHAR(60)  NOT NULL UNIQUE,
                    password   VARCHAR(255) NOT NULL,
                    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
        conn.commit()
    finally:
        conn.close()


# ─────────────────────────────────────────
# Routes
# ─────────────────────────────────────────

# ── Register ──────────────────────────────
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    first_name = (data.get("first_name") or "").strip()
    last_name  = (data.get("last_name")  or "").strip()
    email      = (data.get("email")      or "").strip().lower()
    username   = (data.get("username")   or "").strip().lower()
    password   = (data.get("password")   or "")

    # Basic validation
    if not all([first_name, last_name, email, username, password]):
        return jsonify(success=False, message="All fields are required."), 400
    if len(password) < 8:
        return jsonify(success=False, message="Password must be at least 8 characters."), 400
    if len(username) < 3:
        return jsonify(success=False, message="Username must be at least 3 characters."), 400

    # Hash password
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    conn = get_mysql()
    try:
        with conn.cursor() as cur:
            # Check duplicates — prepared statement
            cur.execute(
                "SELECT id FROM users WHERE email = %s OR username = %s LIMIT 1",
                (email, username)
            )
            if cur.fetchone():
                return jsonify(success=False, message="Email or username already taken."), 409

            # Insert — prepared statement
            cur.execute(
                """INSERT INTO users (first_name, last_name, email, username, password)
                   VALUES (%s, %s, %s, %s, %s)""",
                (first_name, last_name, email, username, hashed)
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        app.logger.error("Register DB error: %s", e)
        return jsonify(success=False, message="Database error. Please try again."), 500
    finally:
        conn.close()

    return jsonify(success=True, message="Account created successfully."), 201


# ── Login ──────────────────────────────────
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    identifier = (data.get("identifier") or "").strip().lower()
    password   = (data.get("password")   or "")

    if not identifier or not password:
        return jsonify(success=False, message="Identifier and password are required."), 400

    conn = get_mysql()
    try:
        with conn.cursor() as cur:
            # Prepared statement — find by email OR username
            cur.execute(
                """SELECT id, first_name, last_name, email, username, password
                   FROM users
                   WHERE email = %s OR username = %s
                   LIMIT 1""",
                (identifier, identifier)
            )
            user = cur.fetchone()
    except Exception as e:
        app.logger.error("Login DB error: %s", e)
        return jsonify(success=False, message="Database error."), 500
    finally:
        conn.close()

    if not user:
        return jsonify(success=False, message="Invalid credentials."), 401

    if not bcrypt.checkpw(password.encode(), user["password"].encode()):
        return jsonify(success=False, message="Invalid credentials."), 401

    # Create JWT
    token = create_token(user["id"], user["username"])

    # Decode to get jti so we can store in Redis
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])

    # Store session in Redis with TTL
    r = get_redis()
    session_key = f"session:{payload['jti']}"
    session_data = {
        "user_id":  str(user["id"]),
        "username": user["username"],
        "email":    user["email"],
    }
    r.setex(session_key, TOKEN_EXPIRY, json.dumps(session_data))

    return jsonify(
        success = True,
        token   = token,
        user    = {
            "id":         user["id"],
            "first_name": user["first_name"],
            "last_name":  user["last_name"],
            "email":      user["email"],
            "username":   user["username"],
        }
    ), 200


# ── Logout ─────────────────────────────────
@app.route("/api/logout", methods=["POST"])
def logout():
    payload = get_auth_payload()
    if payload:
        r = get_redis()
        r.delete(f"session:{payload['jti']}")
    return jsonify(success=True, message="Logged out."), 200


# ── Get Profile ────────────────────────────
@app.route("/api/profile", methods=["GET"])
def get_profile():
    payload = get_auth_payload()
    if not payload:
        return jsonify(success=False, message="Unauthorized."), 401

    user_id = payload["sub"]
    mdb = get_mongo_db()

    profile_doc = mdb.profiles.find_one({"user_id": user_id})

    if profile_doc:
        profile_doc["_id"] = str(profile_doc["_id"])
    else:
        profile_doc = {}

    return jsonify(success=True, profile=profile_doc), 200


# ── Update Profile ──────────────────────────
@app.route("/api/profile", methods=["PUT"])
def update_profile():
    payload = get_auth_payload()
    if not payload:
        return jsonify(success=False, message="Unauthorized."), 401

    data    = request.get_json(silent=True) or {}
    user_id = payload["sub"]

    # Whitelist allowed fields
    allowed = {"age", "dob", "contact", "gender", "address", "bio", "occupation", "website"}
    update_data = {k: v for k, v in data.items() if k in allowed}
    update_data["updated_at"] = datetime.datetime.utcnow().isoformat()

    mdb = get_mongo_db()
    mdb.profiles.update_one(
        {"user_id": user_id},
        {
            "$set":         update_data,
            "$setOnInsert": {
                "user_id":    user_id,
                "created_at": datetime.datetime.utcnow().isoformat(),
            }
        },
        upsert=True
    )

    return jsonify(success=True, message="Profile updated."), 200


# ─────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────
if __name__ == "__main__":
    try:
        init_mysql()
        print("✅  MySQL table ready.")
    except Exception as e:
        print(f"⚠️  MySQL init warning: {e}")

    app.run(
        host  = "0.0.0.0",
        port  = 5000,
        debug = os.getenv("FLASK_ENV") == "development",
    )
