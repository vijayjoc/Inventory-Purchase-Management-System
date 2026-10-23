CREATE TABLE IF NOT EXISTS item_types (
    id SERIAL PRIMARY KEY,
    type_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    purchase_date DATE NOT NULL,
    stock_available INT NOT NULL DEFAULT 0 CHECK (stock_available >= 0),
    item_type_id INT NOT NULL REFERENCES item_types(id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL UNIQUE,
    purchase_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id SERIAL PRIMARY KEY,
    purchase_id INT NOT NULL REFERENCES purchases(id),
    item_id INT NOT NULL REFERENCES items(id),
    quantity INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS items_set_updated_at ON items;
CREATE TRIGGER items_set_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS purchases_set_updated_at ON purchases;
CREATE TRIGGER purchases_set_updated_at BEFORE UPDATE ON purchases
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Default categories (only inserted when the table is empty)
INSERT INTO item_types (type_name)
SELECT v FROM (VALUES ('Electronics'), ('Furniture'), ('Clothing'), ('Grocery'), ('Stationery')) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM item_types);
