let currentItems = [];
let pendingCart = [];

document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadInventory();
  loadPurchaseHistory();

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('item-purchase-date').value = today;
  document.getElementById('purchase-date').value = today;

  document.getElementById('item-form').addEventListener('submit', onSaveItem);
  document.getElementById('type-form').addEventListener('submit', onSaveCategory);
  document.getElementById('purchase-form').addEventListener('submit', onSubmitPurchase);
});

function showToast(msg, isError = false) {
  const toast = document.getElementById('alert-box');
  toast.innerText = msg;
  toast.className = `alert ${isError ? 'error' : 'success'}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4500);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  document.getElementById(tabId).classList.add('active');
  const targetBtn = Array.from(document.querySelectorAll('.nav-btn')).find(b => b.getAttribute('onclick').includes(tabId));
  if (targetBtn) targetBtn.classList.add('active');

  if (tabId === 'items-tab') loadInventory();
  if (tabId === 'purchases-tab') loadPurchaseHistory();
}

// Categories / Types
async function loadCategories() {
  try {
    const res = await fetch('/api/item-types');
    const types = await res.json();

    const select = document.getElementById('item-type');
    const list = document.getElementById('types-list');

    select.innerHTML = '<option value="">-- Choose Category --</option>';
    list.innerHTML = '';

    types.forEach(t => {
      select.innerHTML += `<option value="${t.id}">${t.type_name}</option>`;
      list.innerHTML += `<span class="pill">${t.type_name}</span>`;
    });
  } catch (err) {
    showToast('Failed to load categories', true);
  }
}

async function onSaveCategory(e) {
  e.preventDefault();
  const input = document.getElementById('type-name');
  try {
    const res = await fetch('/api/item-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type_name: input.value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast('Category created');
    input.value = '';
    loadCategories();
  } catch (err) {
    showToast(err.message, true);
  }
}

// Items Master   
async function loadInventory() {
  try {
    const res = await fetch('/api/items');
    currentItems = await res.json();

    const tbody = document.getElementById('items-table-body');
    const orderSelect = document.getElementById('select-purchase-item');

    tbody.innerHTML = '';
    orderSelect.innerHTML = '<option value="">-- Select Available Item --</option>';

    currentItems.forEach(item => {
      const badgeClass = item.availability.toLowerCase().replace(/\s+/g, '-');
      tbody.innerHTML += `
        <tr>
          <td>${item.id}</td>
          <td><strong>${item.name}</strong></td>
          <td>${item.type_name}</td>
          <td>${item.purchase_date}</td>
          <td>${item.stock_available}</td>
          <td><span class="badge ${badgeClass}">${item.availability}</span></td>
          <td><span class="badge ${item.active ? 'active' : 'inactive'}">${item.active ? 'Active' : 'Inactive'}</span></td>
          <td>
            <button class="btn sm secondary" onclick="editItem(${item.id})">Edit</button>
            <button class="btn sm danger" onclick="deleteItem(${item.id})">Delete</button>
          </td>
        </tr>
      `;

      if (item.active && item.stock_available > 0) {
        orderSelect.innerHTML += `<option value="${item.id}">${item.name} (${item.type_name}) - Stock: ${item.stock_available}</option>`;
      }
    });
  } catch (err) {
    showToast('Failed to fetch inventory items', true);
  }
}

async function onSaveItem(e) {
  e.preventDefault();
  const id = document.getElementById('item-id').value;
  const payload = {
    name: document.getElementById('item-name').value,
    item_type_id: parseInt(document.getElementById('item-type').value, 10),
    purchase_date: document.getElementById('item-purchase-date').value,
    stock_available: parseInt(document.getElementById('item-stock').value, 10),
    active: document.getElementById('item-status').value === '1'
  };

  try {
    const res = await fetch(id ? `/api/items/${id}` : '/api/items', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(data.message || 'Item details saved');
    resetItemForm();
    loadInventory();
  } catch (err) {
    showToast(err.message, true);
  }
}

function editItem(id) {
  const target = currentItems.find(i => i.id === id);
  if (!target) return;

  document.getElementById('item-id').value = target.id;
  document.getElementById('item-name').value = target.name;
  document.getElementById('item-type').value = target.item_type_id;
  document.getElementById('item-purchase-date').value = target.purchase_date;
  document.getElementById('item-stock').value = target.stock_available;
  document.getElementById('item-status').value = target.active ? '1' : '0';
  document.getElementById('item-form-title').innerText = `Edit Item #${target.id}`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetItemForm() {
  document.getElementById('item-id').value = '';
  document.getElementById('item-form').reset();
  document.getElementById('item-form-title').innerText = 'Create / Edit Item';
}

async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this item?')) return;
  try {
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(data.message);
    loadInventory();
  } catch (err) {
    showToast(err.message, true);
  }
}

// Purchase / Order Logic
function addPurchaseLine() {
  const select = document.getElementById('select-purchase-item');
  const qtyInput = document.getElementById('purchase-qty');
  const itemId = select.value;
  const qty = parseInt(qtyInput.value, 10);

  if (!itemId) return alert('Please choose an item');
  if (!qty || qty <= 0) return alert('Enter a valid quantity');

  const chosen = currentItems.find(i => i.id == itemId);
  if (qty > chosen.stock_available) {
    return alert(`Not enough stock. Available: ${chosen.stock_available}`);
  }

  const found = pendingCart.find(i => i.item_id == itemId);
  if (found) {
    if (found.quantity + qty > chosen.stock_available) {
      return alert(`Total quantity exceeds available stock (${chosen.stock_available})`);
    }
    found.quantity += qty;
  } else {
    pendingCart.push({
      item_id: chosen.id,
      name: chosen.name,
      quantity: qty
    });
  }

  qtyInput.value = '';
  renderCart();
}

function removeCartLine(index) {
  pendingCart.splice(index, 1);
  renderCart();
}

function renderCart() {
  const tbody = document.getElementById('purchase-lines-body');
  tbody.innerHTML = '';
  pendingCart.forEach((line, idx) => {
    tbody.innerHTML += `
      <tr>
        <td>${line.name}</td>
        <td>${line.quantity}</td>
        <td><button type="button" class="btn sm danger" onclick="removeCartLine(${idx})">Remove</button></td>
      </tr>
    `;
  });
}

async function onSubmitPurchase(e) {
  e.preventDefault();
  if (pendingCart.length === 0) {
    return alert('Please add at least one item to this order');
  }

  const payload = {
    order_id: document.getElementById('order-id').value,
    purchase_date: document.getElementById('purchase-date').value,
    items: pendingCart.map(i => ({ item_id: i.item_id, quantity: i.quantity }))
  };

  try {
    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast('Purchase recorded successfully');
    document.getElementById('purchase-form').reset();
    pendingCart = [];
    renderCart();
    loadInventory();
    switchTab('purchases-tab');
  } catch (err) {
    showToast(err.message, true);
  }
}

async function loadPurchaseHistory() {
  try {
    const res = await fetch('/api/purchases');
    const orders = await res.json();
    const tbody = document.getElementById('purchases-table-body');
    tbody.innerHTML = '';

    orders.forEach(o => {
      tbody.innerHTML += `
        <tr>
          <td><strong>${o.order_id}</strong></td>
          <td>${o.purchase_date}</td>
          <td>${o.total_items}</td>
          <td>${o.total_units}</td>
          <td>
            <button class="btn sm primary" onclick="showOrderDetails('${o.order_id}')">View Details</button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    showToast('Failed to load purchase history', true);
  }
}

async function showOrderDetails(orderId) {
  try {
    const res = await fetch(`/api/purchases/${orderId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    document.getElementById('details-order-id').innerText = `Order: ${data.order_id}`;
    document.getElementById('details-date').innerText = data.purchase_date;

    const tbody = document.getElementById('details-table-body');
    tbody.innerHTML = '';
    data.items.forEach(it => {
      tbody.innerHTML += `
        <tr>
          <td>${it.name}</td>
          <td>${it.type}</td>
          <td>${it.quantity}</td>
          <td>${it.stock_remaining}</td>
        </tr>
      `;
    });

    const card = document.getElementById('purchase-details-card');
    card.classList.remove('hidden');
    card.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showToast(err.message, true);
  }
}

function hideDetails() {
  document.getElementById('purchase-details-card').classList.add('hidden');
}