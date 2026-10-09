const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Item Types Routes ---

//get endpoint
app.get('/api/item-types', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM item_types ORDER BY id ASC');
    res.json(rows);  
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});
//create new item category
app.post('/api/item-types', async (req, res) => {
  const { type_name } = req.body;
  if (!type_name || !type_name.trim()) {
    return res.status(400).json({ error: 'Item type name is required' });
  }

  try {
    const [result] = await db.query('INSERT INTO item_types (type_name) VALUES (?)', [type_name.trim()]);
    res.status(201).json({ id: result.insertId, type_name: type_name.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create item type' });
  }
});

// --- Items Routes  ---

//get all inventory items
app.get('/api/items', async (req, res) => {
  try {
    // Demonstration of SQL JOIN between items and item_types
    const query = `
      SELECT 
        i.id, 
        i.name, 
        i.purchase_date, 
        i.stock_available, 
        i.active,
        it.id AS item_type_id,
        it.type_name,
        CASE 
          WHEN i.stock_available = 0 THEN 'Out of Stock'
          WHEN i.stock_available <= 5 THEN 'Low Stock'
          ELSE 'In Stock'
        END AS availability
      FROM items i
      JOIN item_types it ON i.item_type_id = it.id
      ORDER BY i.id DESC
          `;
    const [items] = await db.query(query);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error loading inventory items' });
  }
});

app.get('/api/items/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT i.*, it.type_name 
       FROM items i 
       JOIN item_types it ON i.item_type_id = it.id 
       WHERE i.id = ?`, //retrives items and its category
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error retrieving item' });
  }
});

//create an inventory items
app.post('/api/items', async (req, res) => {
  const { name, item_type_id, purchase_date, stock_available, active } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: 'Item name is required' });
  if (!item_type_id) return res.status(400).json({ error: 'Invalid item type' });
  if (!purchase_date) return res.status(400).json({ error: 'Purchase date is required' });
  if (stock_available === undefined || stock_available < 0) {
    return res.status(400).json({ error: 'Stock cannot be negative' });
  }

  try {
    const [typeCheck] = await db.query('SELECT id FROM item_types WHERE id = ?', [item_type_id]);
    if (typeCheck.length === 0) {
      return res.status(400).json({ error: 'Invalid item type' });
    }

    const [result] = await db.query(
      'INSERT INTO items (name, item_type_id, purchase_date, stock_available, active) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), item_type_id, purchase_date, stock_available, active ? 1 : 0]
    );

    res.status(201).json({ message: 'Item saved', itemId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

app.put('/api/items/:id', async (req, res) => {
  const { name, item_type_id, purchase_date, stock_available, active } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: 'Item name is required' });
  if (!item_type_id) return res.status(400).json({ error: 'Invalid item type' });
  if (!purchase_date) return res.status(400).json({ error: 'Purchase date is required' });
  if (stock_available === undefined || stock_available < 0) {
    return res.status(400).json({ error: 'Stock cannot be negative' });
  }

  try {
    const [result] = await db.query(
      'UPDATE items SET name = ?, item_type_id = ?, purchase_date = ?, stock_available = ?, active = ? WHERE id = ?',
      [name.trim(), item_type_id, purchase_date, stock_available, active ? 1 : 0, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  const itemId = req.params.id;
  try {
    // Business Rule: Check if item is already tied to purchases
    const [orders] = await db.query('SELECT id FROM purchase_items WHERE item_id = ? LIMIT 1', [itemId]);
    if (orders.length > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete: Item is linked to existing purchase history. Mark it Inactive instead.' 
      });
    }

    const [delResult] = await db.query('DELETE FROM items WHERE id = ?', [itemId]);
    if (delResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Item removed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting item' });
  }
});

// --- Purchases Routes (Transactions & Stock Updates) ---

app.get('/api/purchases', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id, 
        p.order_id, 
        p.purchase_date, 
        COUNT(pi.id) AS total_items, 
        COALESCE(SUM(pi.quantity), 0) AS total_units
      FROM purchases p
      LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
      GROUP BY p.id, p.order_id, p.purchase_date
      ORDER BY p.id DESC
    `;
    const [orders] = await db.query(query);
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load purchases' });
  }
});

app.get('/api/purchases/:identifier', async (req, res) => {
  const param = req.params.identifier;
  try {
    // Demonstration of 4-table SQL JOIN: purchases + purchase_items + items + item_types
    const query = `
      SELECT 
        p.id AS purchase_id, 
        p.order_id, 
        p.purchase_date, 
        pi.id AS order_item_id, 
        pi.quantity, 
        i.id AS item_id, 
        i.name AS item_name, 
        i.stock_available, 
        it.type_name
      FROM purchases p
      JOIN purchase_items pi ON p.id = pi.purchase_id
      JOIN items i ON pi.item_id = i.id
      JOIN item_types it ON i.item_type_id = it.id
      WHERE p.order_id = ? OR p.id = ?
    `;
    const [rows] = await db.query(query, [param, param]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Purchase record not found' });
    }

    const details = {
      purchase_id: rows[0].purchase_id,
      order_id: rows[0].order_id,
      purchase_date: rows[0].purchase_date,
      items: rows.map(r => ({
        id: r.item_id,
        name: r.item_name,
        type: r.type_name,
        quantity: r.quantity,
        stock_remaining: r.stock_available
      }))
    };

    res.json(details);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching order details' });
  }
});

// Create Purchase (Atomic Transaction)
app.post('/api/purchases', async (req, res) => {
  const { order_id, purchase_date, items } = req.body;

  if (!order_id || !order_id.trim()) return res.status(400).json({ error: 'Order ID is required' });
  if (!purchase_date) return res.status(400).json({ error: 'Purchase date is required' });
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required in the purchase' });
  }

  // Combine duplicates in same order
  const orderLines = {};
  for (const item of items) {
    const qty = parseInt(item.quantity, 10);
    if (!qty || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than zero' });
    }
    orderLines[item.item_id] = (orderLines[item.item_id] || 0) + qty;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [exists] = await conn.query('SELECT id FROM purchases WHERE order_id = ?', [order_id.trim()]);
    if (exists.length > 0) {
      await conn.rollback();
      return res.status(400).json({ error: `Order ID '${order_id}' already exists` });
    }

    // Lock and validate each item
    for (const [id, reqQty] of Object.entries(orderLines)) {
      const [stockRows] = await conn.query('SELECT id, name, stock_available, active FROM items WHERE id = ? FOR UPDATE', [id]);
      
      if (stockRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: `Item not found` });
      }

      const currentItem = stockRows[0];
      if (!currentItem.active) {
        await conn.rollback();
        return res.status(400).json({ error: `Item '${currentItem.name}' is inactive and cannot be purchased` });
      }

      if (currentItem.stock_available < reqQty) {
        await conn.rollback();
        return res.status(400).json({ 
          error: `Insufficient stock for '${currentItem.name}'. Available: ${currentItem.stock_available}, Requested: ${reqQty}` 
        });
      }
    }

    // Insert order header
    const [purchaseRes] = await conn.query(
      'INSERT INTO purchases (order_id, purchase_date) VALUES (?, ?)',
      [order_id.trim(), purchase_date]
    );
    const purchaseId = purchaseRes.insertId;

    // Insert order lines & deduct inventory
    for (const [id, reqQty] of Object.entries(orderLines)) {
      await conn.query(
        'INSERT INTO purchase_items (purchase_id, item_id, quantity) VALUES (?, ?, ?)',
        [purchaseId, id, reqQty]
      );
      await conn.query(
        'UPDATE items SET stock_available = stock_available - ? WHERE id = ?',
        [reqQty, id]
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'Purchase placed successfully', order_id });
  } catch (err) {
    await conn.rollback();
    console.error('Purchase creation failed:', err);
    res.status(500).json({ error: 'Failed to complete transaction' });
  } finally {
    conn.release();
  }
});

// Update Purchase and Adjust Stock deltas
app.put('/api/purchases/:id', async (req, res) => {
  const purchaseId = req.params.id;
  const { purchase_date, items } = req.body;

  if (!purchase_date) return res.status(400).json({ error: 'Purchase date is required' });
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [purchase] = await conn.query('SELECT id FROM purchases WHERE id = ?', [purchaseId]);
    if (purchase.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Purchase record not found' });
    }

    const [oldItems] = await conn.query('SELECT item_id, quantity FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
    const oldQty = {};
    oldItems.forEach(i => { oldQty[i.item_id] = i.quantity; });

    const newQty = {};
    for (const line of items) {
      const q = parseInt(line.quantity, 10);
      if (!q || q <= 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Quantity must be greater than zero' });
      }
      newQty[line.item_id] = (newQty[line.item_id] || 0) + q;
    }

    const allItemIds = Array.from(new Set([...Object.keys(oldQty), ...Object.keys(newQty)]));

    // Validate that stock won't go negative
    for (const itemId of allItemIds) {
      const prev = oldQty[itemId] || 0;
      const next = newQty[itemId] || 0;
      const diff = next - prev;

      if (diff > 0) {
        const [rows] = await conn.query('SELECT name, stock_available FROM items WHERE id = ? FOR UPDATE', [itemId]);
        if (rows.length === 0) {
          await conn.rollback();
          return res.status(404).json({ error: 'Item not found' });
        }
        if (rows[0].stock_available < diff) {
          await conn.rollback();
          return res.status(400).json({
            error: `Cannot update: '${rows[0].name}' needs ${diff} more units, only ${rows[0].stock_available} in stock.`
          });
        }
      }
    }

    // Apply adjustments
    for (const itemId of allItemIds) {
      const diff = (newQty[itemId] || 0) - (oldQty[itemId] || 0);
      if (diff !== 0) {
        await conn.query('UPDATE items SET stock_available = stock_available - ? WHERE id = ?', [diff, itemId]);
      }
    }

    await conn.query('UPDATE purchases SET purchase_date = ? WHERE id = ?', [purchase_date, purchaseId]);
    await conn.query('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId]);

    for (const [itemId, qty] of Object.entries(newQty)) {
      await conn.query(
        'INSERT INTO purchase_items (purchase_id, item_id, quantity) VALUES (?, ?, ?)',
        [purchaseId, itemId, qty]
      );
    }

    await conn.commit();
    res.json({ message: 'Purchase and inventory updated successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to update purchase' });
  } finally {
    conn.release();
  }
});

// NOTE: Requirement says Purchases MUST NOT be deleted (Audit Trail)
// No DELETE /api/purchases endpoint is provided.

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});