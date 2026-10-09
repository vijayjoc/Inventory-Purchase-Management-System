# Inventory & Purchase Management System

A full-stack Inventory and Purchase Management web application built with Node.js, Express, MySQL, and vanilla JavaScript. The system manages items, categories, and handles transactional purchase orders with automatic stock deduction and relational data integrity.

---

## Features

- **Item Categories**: Manage classifications (Electronics, Furniture, etc.).
- **Item Master**: Add, edit, list, and soft-delete/deactivate items with real-time stock levels and availability indicators (In Stock, Low Stock, Out of Stock).
- **Purchase Orders**: Support for multi-item orders in a single purchase transaction.
- **Stock Automation**: Real-time stock decrement using atomic MySQL transactions (ACID compliant) to prevent overselling and negative inventory.
- **Referential Integrity**: Prevents accidental deletion of items that have existing purchase records.
- **Audit History**: View complete historical purchase logs and item breakdowns without deletion access.

---

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL 8.0 (`mysql2/promise` connection pool)
- **Frontend**: HTML5, CSS3, JavaScript (Fetch API)
- **Configuration**: `dotenv`, `cors`

---

## Project Structure

```text
├── public/
│   ├── index.html       # Single-page interface layout
│   ├── style.css        # Clean UI styling and badges
│   └── app.js           # Client-side API calls and DOM rendering
├── .env                 # Environment variables
├── db.js                # MySQL connection pool configuration
├── package.json         # Project metadata and dependencies
├── schema.sql           # Database schema and initial seed data
├── server.js            # Express server and REST API routes
└── README.md            # Project documentation and setup instructions


Getting Started & Local Setup

​1. Prerequisites
​Node.js (v16.x or higher)
​MySQL Server (v8.0 or higher) and MySQL Workbench or MySQL CLI

​2. Clone / Extract Project
​Navigate to the root directory in your terminal: cd inventory-system

3. Install Dependencies
​Install all required Node.js packages: npm install

4. Database Setup
1. Open MySQL Workbench or MySQL Command Line Client.
2. Run the script in schema.sql: mysql -u root -p < schema.sql
(Or copy and paste the contents of schema.sql directly into a MySQL Workbench query tab and execute).
3. This creates the inventory_db database, sets up foreign keys, and inserts initial seed data.

5. Environment Configuration
​Create a .env file in the root folder with the following configuration:
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=inventory_db
PORT=3000
​Note: Replace your_mysql_password with your local MySQL root password.

​6. Run the Application
​Start the development server: node server.js
Open your browser and navigate to: http://localhost:3000

API Documentation
​Categories
​GET /api/item-types — Fetch all item categories.
​POST /api/item-types — Add a new category.
​Items
​GET /api/items — Get all items with calculated stock availability.
​GET /api/items/:id — Get item details by ID.
​POST /api/items — Add a new item to inventory.
​PUT /api/items/:id — Update existing item details.
​DELETE /api/items/:id — Delete item (restricted if referenced in purchase orders).
​Purchases
​GET /api/purchases — Get summary of all purchase orders.
​GET /api/purchases/:id — Get detailed purchase order breakdown with JOINs.
​POST /api/purchases — Create a new multi-item purchase order and update inventory stock.

