# Nexus — Full-Stack Auth App

## Folder Structure

```
project/
├── assets/               # Images, icons, etc.
├── css/
│   ├── style.css         # Auth pages (register, login)
│   └── profile.css       # Profile page
├── js/
│   ├── register.js       # jQuery AJAX — registration
│   ├── login.js          # jQuery AJAX — login + localStorage
│   └── profile.js        # jQuery AJAX — profile load/update
├── python/
│   ├── app.py            # Flask backend (all API routes)
│   ├── requirements.txt  # Python dependencies
│   ├── schema.sql        # MySQL database setup
│   └── .env              # Environment variables (copy & fill)
├── index.html            # Smart redirect
├── login.html
├── register.html
└── profile.html
```

---

## Tech Stack

| Layer       | Technology                                      |
|-------------|------------------------------------------------|
| Frontend    | HTML5 · Bootstrap 5 · Custom CSS               |
| JS          | jQuery AJAX (no form submissions)              |
| Backend     | Python · Flask · Flask-CORS                    |
| Auth DB     | MySQL with **prepared statements** only        |
| Profile DB  | MongoDB (upsert per user)                      |
| Sessions    | Redis (server-side) + **localStorage** (client)|
| Passwords   | bcrypt hashing                                 |
| Tokens      | JWT (HS256)                                    |

---

## Prerequisites

- Python 3.10+
- MySQL 8.x
- MongoDB 6.x (running locally or Atlas URI)
- Redis 7.x

---

## Setup

### 1. MySQL

```bash
mysql -u root -p < python/schema.sql
```

### 2. Python environment

```bash
cd python
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment variables

```bash
cp python/.env python/.env.local
# Edit .env.local with your DB credentials
```
Or export them directly:
```bash
export MYSQL_PASSWORD=yourpass
export JWT_SECRET=a_very_long_random_string
```

### 4. Start the backend

```bash
cd python
python app.py
# Server runs at http://localhost:5000
```

### 5. Serve the frontend

Use any static server from the project root:

```bash
# Python (simplest)
python -m http.server 8080

# OR Node
npx serve .
```

Then open **http://localhost:8080** in your browser.

---

## API Endpoints

| Method | Path           | Auth      | Description              |
|--------|----------------|-----------|--------------------------|
| POST   | /api/register  | —         | Create new user (MySQL)  |
| POST   | /api/login     | —         | Login → JWT + Redis      |
| POST   | /api/logout    | Bearer    | Destroy Redis session    |
| GET    | /api/profile   | Bearer    | Fetch profile (MongoDB)  |
| PUT    | /api/profile   | Bearer    | Save profile (MongoDB)   |

---

## Flow

```
Register → MySQL (bcrypt password)
  ↓
Login → MySQL lookup → JWT created → Redis session stored → token to localStorage
  ↓
Profile page → localStorage token → Bearer header → Redis verified → MongoDB data
  ↓
Logout → Redis session deleted → localStorage cleared
```

---

## Key Design Decisions

- **No PHP sessions** — session state is kept in Redis (keyed by JWT `jti` claim) with a 24-hour TTL.
- **No form submissions** — every request goes through jQuery AJAX (`$.ajax`).
- **Prepared statements only** — every MySQL query uses `%s` placeholders via PyMySQL.
- **Separation of concerns** — HTML, CSS, JS and Python are strictly in separate files; no inline code.
