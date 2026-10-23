-- Optional sample data. Safe to re-run: only inserts when the tables are empty.
--   psql "$DATABASE_URL" -f seed.sql
INSERT INTO item_types (type_name)
SELECT v FROM (VALUES ('Electronics'), ('Furniture'), ('Clothing'), ('Grocery'), ('Stationery')) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM item_types);

INSERT INTO items (name, purchase_date, stock_available, item_type_id, active)
SELECT * FROM (VALUES
    ('Laptop', DATE '2026-01-15', 10, 1, TRUE),
    ('Mouse',  DATE '2026-02-10', 20, 1, TRUE),
    ('Chair',  DATE '2026-03-05', 15, 2, TRUE)
) AS t(name, purchase_date, stock_available, item_type_id, active)
WHERE NOT EXISTS (SELECT 1 FROM items);
