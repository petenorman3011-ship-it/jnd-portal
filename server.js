const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ customers: [], orders: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
}

// ── CUSTOMERS ──────────────────────────────────────────────
app.get('/api/customers', (req, res) => {
  const data = loadData();
  res.json(data.customers);
});

app.post('/api/customers', (req, res) => {
  const data = loadData();
  const { name, businessName, phone, address, type } = req.body;
  const customer = {
    id: genId(),
    name, businessName, phone, address, type,
    createdAt: new Date().toISOString()
  };
  data.customers.push(customer);
  saveData(data);
  res.json(customer);
});

app.delete('/api/customers/:id', (req, res) => {
  const data = loadData();
  data.customers = data.customers.filter(c => c.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// ── ORDERS ─────────────────────────────────────────────────
app.get('/api/orders', (req, res) => {
  const data = loadData();
  res.json(data.orders);
});

app.post('/api/orders', (req, res) => {
  const data = loadData();
  const { customerId, items, notes } = req.body;
  const customer = data.customers.find(c => c.id === customerId);
  const order = {
    id: genId(),
    customerId,
    customerName: customer ? customer.businessName || customer.name : 'Unknown',
    items,
    notes: notes || '',
    status: 'new',
    createdAt: new Date().toISOString(),
    deliveredAt: null
  };
  data.orders.push(order);
  saveData(data);
  res.json(order);
});

app.patch('/api/orders/:id/status', (req, res) => {
  const data = loadData();
  const order = data.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  order.status = req.body.status;
  if (req.body.status === 'delivered') order.deliveredAt = new Date().toISOString();
  saveData(data);
  res.json(order);
});

app.delete('/api/orders/:id', (req, res) => {
  const data = loadData();
  data.orders = data.orders.filter(o => o.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// ── WHATSAPP WEBHOOK (for bot) ──────────────────────────────
app.post('/api/whatsapp-order', (req, res) => {
  const data = loadData();
  const { phone, name, businessName, address, type, items, notes } = req.body;

  // Find or create customer
  let customer = data.customers.find(c => c.phone === phone);
  if (!customer) {
    customer = {
      id: genId(),
      name, businessName, phone, address,
      type: type || 'Other',
      createdAt: new Date().toISOString()
    };
    data.customers.push(customer);
  }

  // Create order
  const order = {
    id: genId(),
    customerId: customer.id,
    customerName: customer.businessName || customer.name,
    items,
    notes: notes || '',
    status: 'new',
    source: 'whatsapp',
    createdAt: new Date().toISOString(),
    deliveredAt: null
  };
  data.orders.push(order);
  saveData(data);
  res.json({ customer, order });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`JND Portal running on port ${PORT} (0.0.0.0)`);
});
server.on('error', (err) => { console.error('Server error:', err); process.exit(1); });
