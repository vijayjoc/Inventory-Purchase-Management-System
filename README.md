# Inventory & Purchase Management System

![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql&logoColor=white)
![Deploy](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=white)

A full-stack web application for managing inventory and purchase orders. It provides a REST API built with **Node.js, Express and PostgreSQL**, and a lightweight single-page interface written in **vanilla JavaScript**. Purchases are processed as atomic, row-locked database transactions, so stock can never be oversold or go negative.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Deployment on Render](#deployment-on-render)
- [Project Structure](#project-structure)
- [Design Decisions](#design-decisions)

## Features

- **Item categories:** create and list classifications such as Electronics, Furniture and Grocery.
- **Item master:** add, edit, list and deactivate items, with live stock levels and availability badges (*In Stock*, *Low Stock*, *Out of Stock*).
- **Multi-item purchase orders:** place one order containing several items; duplicate lines are merged automatically.
- **Automatic stock control:** stock is deducted inside an ACID transaction using `SELECT ... FOR UPDATE` row locks, which prevents race conditions and overselling.
- **Editable orders:** updating a purchase adjusts inventory by the difference (new quantity minus old quantity) and validates that stock never drops below zero.
- **Referential integrity:** items that appear in purchase history cannot be deleted; they can be marked inactive instead.
- **Audit trail:** purchases are never deleted, so the full order history is always available.
- **Zero-setup schema:** tables are created automatically on first start, so a fresh database works without manual SQL.

## Tech Stack

| Layer     | Technology                                           |
| --------- | ---------------------------------------------------- |
| Backend   | Node.js 20+, Express 5                               |
| Database  | PostgreSQL 14+ via the `pg` connection pool          |
| Frontend  | HTML5, CSS3, vanilla JavaScript (Fetch API)          |
| Config    | `dotenv`, `cors`                                     |
| Hosting   | Render (web service and managed PostgreSQL)          |

## Architecture

```
┌──────────────┐   HTTP / JSON   ┌────────────────────┐    SQL (pg pool)    ┌──────────────┐
│   Browser    │ ──────────────▶ │  Express REST API  │ ──────────────────▶ │  PostgreSQL  │
│ (public/ SPA)│ ◀────────────── │     server.js      │ ◀────────────────── │              │
└──────────────┘                 └────────────────────┘                     └──────────────┘
```

Express serves the static frontend from `public/` and exposes the JSON API under `/api`. All database access goes through a single shared connection pool defined in `db.js`.

## Database Schema

```mermaid
erDiagram
    item_types ||--o{ items : classifies
    items ||--o{ purchase_items : "appears in"
    purchases ||--|{ purchase_items : contains

    item_types {
        int id PK
        varchar type_name UK
    }
    items {
        int id PK
        varchar name
        date purchase_date
        int stock_available
        int item_type_id FK
        boolean active
        timestamp created_at
        timestamp updated_at
    }
    purchases {
        int id PK
        varchar order_id UK
        date purchase_date
        timestamp created_at
        timestamp updated_at
    }
    purchase_items {
        int id PK
        int purchase_id FK
        int item_id FK
        int quantity
        timestamp created_at
    }
```

`updated_at` columns are maintained by database triggers. `stock_available` has a `CHECK (stock_available >= 0)` constraint as a final safety net.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or higher
- [PostgreSQL](https://www.postgresql.org/) 14 or higher

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>

# 2. Install dependencies
npm install

# 3. Create the database
createdb -U postgres inventory_db

# 4. Configure environment variables
cp .env.example .env
# then edit .env and set your PostgreSQL password

# 5. Start the server
npm start
```

Open **http://localhost:3000** in your browser.

Tables are created automatically on startup. To load optional sample data (categories and items):

```bash
psql -U postgres -d inventory_db -f seed.sql
```

## Environment Variables

Create a `.env` file in the project root (never commit it).

| Variable       | Required | Default        | Description                                                            |
| -------------- | -------- | -------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL` | Yes*     | none           | Full PostgreSQL connection string. Takes priority over `DB_*` values.  |
| `DB_HOST`      | No       | `localhost`    | Database host (used when `DATABASE_URL` is not set).                   |
| `DB_PORT`      | No       | `5432`         | Database port.                                                         |
| `DB_USER`      | No       | `postgres`     | Database user.                                                         |
| `DB_PASSWORD`  | No       | empty          | Database password.                                                     |
| `DB_NAME`      | No       | `inventory_db` | Database name.                                                         |
| `DB_SSL`       | No       | auto           | `true` / `false` to force SSL on or off. Auto-enabled for remote hosts. |
| `PORT`         | No       | `3000`         | HTTP port. Render sets this automatically.                             |

\* Either `DATABASE_URL` or the `DB_*` variables must be provided.

Example `.env`:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/inventory_db
PORT=3000
```

## API Reference

Base path: `/api`. All request and response bodies are JSON.

### Item Types

| Method | Endpoint           | Description                                             |
| ------ | ------------------ | ------------------------------------------------------- |
| GET    | `/item-types`      | List all categories.                                    |
| POST   | `/item-types`      | Create a category. Returns `409` if the name exists.    |

### Items

| Method | Endpoint      | Description                                                              |
| ------ | ------------- | ------------------------------------------------------------------------ |
| GET    | `/items`      | List all items with category and computed availability.                  |
| GET    | `/items/:id`  | Get a single item.                                                       |
| POST   | `/items`      | Create an item.                                                          |
| PUT    | `/items/:id`  | Update an item.                                                          |
| DELETE | `/items/:id`  | Delete an item. Returns `409` if it is referenced by any purchase.       |

### Purchases

| Method | Endpoint                  | Description                                                                          |
| ------ | ------------------------- | ------------------------------------------------------------------------------------ |
| GET    | `/purchases`              | List all purchases with item and unit totals.                                        |
| GET    | `/purchases/:identifier`  | Purchase details with line items. Accepts the numeric `id` or the `order_id`.        |
| POST   | `/purchases`              | Create a purchase and deduct stock atomically.                                       |
| PUT    | `/purchases/:id`          | Change a purchase's date and items; stock is adjusted by the difference.             |

There is intentionally no `DELETE /purchases` endpoint, to preserve the audit trail.

### Example: create a purchase

```http
POST /api/purchases
Content-Type: application/json

{
  "order_id": "ORD-1001",
  "purchase_date": "2026-10-05",
  "items": [
    { "item_id": 1, "quantity": 2 },
    { "item_id": 2, "quantity": 5 }
  ]
}
```

**201 Created**

```json
{ "message": "Purchase placed successfully", "order_id": "ORD-1001" }
```

**400 Bad Request** (for example, insufficient stock)

```json
{ "error": "Insufficient stock for 'Laptop'. Available: 7, Requested: 999" }
```

### Status codes

| Code | Meaning                                                    |
| ---- | ---------------------------------------------------------- |
| 200  | Success                                                    |
| 201  | Resource created                                           |
| 400  | Validation error (missing field, insufficient stock, etc.) |
| 404  | Resource not found                                         |
| 409  | Conflict (duplicate name, or item has purchase history)    |
| 500  | Unexpected server error                                    |

## Deployment on Render

The app and its database are both hosted on [Render](https://render.com). The application reads a single `DATABASE_URL` variable, so the same code runs locally and in production.

### Option A: Blueprint (fastest)

1. Push the repository to GitHub.
2. In Render, choose **New → Blueprint** and select the repository.
3. Render reads [`render.yaml`](render.yaml), creates the PostgreSQL database and the web service, and injects `DATABASE_URL` automatically.

### Option B: Manual setup

1. **Create the database:** *New → PostgreSQL*. Choose a name and a region.
2. **Create the web service:** *New → Web Service*, connect the repository, and choose the **same region** as the database.
   - Build command: `npm install`
   - Start command: `npm start`
3. **Connect them:** in the web service open **Environment** and add:

   | Key            | Value                                                          |
   | -------------- | -------------------------------------------------------------- |
   | `DATABASE_URL` | The database's **Internal Database URL**                       |
   | `NODE_ENV`     | `production`                                                   |

4. **Deploy.** On startup the app connects to the database and creates any missing tables.
5. **Verify:** the service logs should show `Database schema ready` followed by `Server listening on port ...`.

### Internal vs. external database URL

- **Internal URL:** use for the deployed web service (same region only; private and faster).
- **External URL:** use from your own machine for tools such as `psql` or DBeaver. SSL is required and is enabled automatically.

### Troubleshooting

| Symptom                                   | Likely cause                                          |
| ----------------------------------------- | ----------------------------------------------------- |
| `ECONNREFUSED 127.0.0.1:5432`             | `DATABASE_URL` is not set on the service              |
| `ENOTFOUND dpg-...` or connection timeout | Database and web service are in different regions     |
| SSL or `no pg_hba.conf entry` error       | External URL used without SSL; set `DB_SSL=true`      |
| Service exits immediately after starting  | Database unreachable; check the logs for the cause    |

> Free-tier PostgreSQL instances on Render expire after a limited period. Use a paid plan for data you need to keep.

## Project Structure

```
.
├── public/
│   ├── index.html       # Single-page interface
│   ├── style.css        # Styling and status badges
│   └── app.js           # Client-side API calls and DOM rendering
├── db.js                # PostgreSQL pool, type parsers, startup schema init
├── server.js            # Express app and REST API routes
├── schema.sql           # Idempotent database schema and triggers
├── seed.sql             # Optional sample data
├── render.yaml          # Render Blueprint (web service and database)
├── .env.example         # Environment variable template
├── package.json
└── README.md
```

## Design Decisions

- **Row-level locking:** purchase creation and editing lock the affected item rows with `SELECT ... FOR UPDATE` inside a transaction, so concurrent orders cannot both consume the same stock.
- **Defence in depth:** the application validates stock before deducting, and the database enforces `CHECK (stock_available >= 0)` and foreign keys regardless.
- **Immutable history:** purchases have no delete route, and items with history cannot be deleted; deactivation is used instead.
- **Idempotent schema:** `schema.sql` uses `IF NOT EXISTS` and can run on every startup, which removes any manual migration step for new environments.
- **Parameterized queries:** every query uses `$1, $2, ...` placeholders, which protects against SQL injection.

## License

Add a license of your choice (for example, MIT) and reference it here.
