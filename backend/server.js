const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'data.json');

// ============ Middleware ============
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ============ Data Persistence ============
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading data:', e.message);
  }
  return { clients: [], trash: [] };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving data:', e.message);
  }
}

let store = loadData();

// ============ Health Check ============
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ Clients - GET All ============
app.get('/api/clients', (req, res) => {
  try {
    res.json(store.clients);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Clients - GET Single ============
app.get('/api/clients/:id', (req, res) => {
  try {
    const client = store.clients.find(c => c.id === req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Clients - CREATE ============
app.post('/api/clients', (req, res) => {
  try {
    const { company, owner, phone, email, status, plan, expiry, deviceLimit, devices, payment, amount, lastLogin, paymentDate, notes } = req.body;

    if (!company || !owner || !phone || !expiry) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newClient = {
      id: req.body.id || `CL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      company: company.trim(),
      owner: owner.trim(),
      phone,
      email: email?.trim() || '',
      status: status || 'Active',
      plan: plan || 'Monthly',
      expiry,
      deviceLimit: Number(deviceLimit) || 1,
      devices: Array.isArray(devices) ? devices : [],
      payment: payment || 'Pending',
      amount: Number(amount) || 0,
      lastLogin: lastLogin || '',
      paymentDate: paymentDate || '',
      notes: notes?.trim() || '',
      paymentHistory: req.body.paymentHistory || [],
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    store.clients.push(newClient);
    saveData(store);

    res.status(201).json(newClient);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Clients - UPDATE ============
app.put('/api/clients/:id', (req, res) => {
  try {
    const clientIndex = store.clients.findIndex(c => c.id === req.params.id);
    if (clientIndex === -1) return res.status(404).json({ error: 'Client not found' });

    const client = store.clients[clientIndex];
    const updates = {
      company: req.body.company !== undefined ? req.body.company.trim() : client.company,
      owner: req.body.owner !== undefined ? req.body.owner.trim() : client.owner,
      phone: req.body.phone !== undefined ? req.body.phone : client.phone,
      email: req.body.email !== undefined ? req.body.email.trim() : client.email,
      status: req.body.status !== undefined ? req.body.status : client.status,
      plan: req.body.plan !== undefined ? req.body.plan : client.plan,
      expiry: req.body.expiry !== undefined ? req.body.expiry : client.expiry,
      deviceLimit: req.body.deviceLimit !== undefined ? Number(req.body.deviceLimit) : client.deviceLimit,
      devices: req.body.devices !== undefined ? (Array.isArray(req.body.devices) ? req.body.devices : []) : client.devices,
      payment: req.body.payment !== undefined ? req.body.payment : client.payment,
      amount: req.body.amount !== undefined ? Number(req.body.amount) : client.amount,
      lastLogin: req.body.lastLogin !== undefined ? req.body.lastLogin : client.lastLogin,
      paymentDate: req.body.paymentDate !== undefined ? req.body.paymentDate : client.paymentDate,
      notes: req.body.notes !== undefined ? req.body.notes.trim() : client.notes,
      paymentHistory: req.body.paymentHistory !== undefined ? req.body.paymentHistory : client.paymentHistory,
      updatedAt: new Date().toISOString()
    };

    store.clients[clientIndex] = { ...client, ...updates };
    saveData(store);

    res.json(store.clients[clientIndex]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Clients - DELETE (Soft Delete to Trash) ============
app.delete('/api/clients/:id', (req, res) => {
  try {
    const clientIndex = store.clients.findIndex(c => c.id === req.params.id);
    if (clientIndex === -1) return res.status(404).json({ error: 'Client not found' });

    const client = store.clients[clientIndex];
    client.deletedAt = new Date().toISOString();

    store.trash.unshift(client);
    store.clients.splice(clientIndex, 1);
    saveData(store);

    res.json({ message: 'Client moved to trash' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Trash - GET All ============
app.get('/api/trash', (req, res) => {
  try {
    res.json(store.trash);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Trash - RESTORE ============
app.post('/api/clients/:id/restore', (req, res) => {
  try {
    const trashIndex = store.trash.findIndex(c => c.id === req.params.id);
    if (trashIndex === -1) return res.status(404).json({ error: 'Client not found in trash' });

    const client = store.trash[trashIndex];
    delete client.deletedAt;
    client.updatedAt = new Date().toISOString();

    store.clients.unshift(client);
    store.trash.splice(trashIndex, 1);
    saveData(store);

    res.json(client);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Trash - PERMANENT DELETE ============
app.delete('/api/clients/:id/permanent', (req, res) => {
  try {
    const trashIndex = store.trash.findIndex(c => c.id === req.params.id);
    if (trashIndex === -1) return res.status(404).json({ error: 'Client not found in trash' });

    store.trash.splice(trashIndex, 1);
    saveData(store);

    res.json({ message: 'Client permanently deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Root Route ============
app.get('/', (req, res) => {
  res.json({
    name: 'VasoolBook Admin API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /api/health',
      clients: {
        list: 'GET /api/clients',
        get: 'GET /api/clients/:id',
        create: 'POST /api/clients',
        update: 'PUT /api/clients/:id',
        delete: 'DELETE /api/clients/:id'
      },
      trash: {
        list: 'GET /api/trash',
        restore: 'POST /api/clients/:id/restore',
        permanent_delete: 'DELETE /api/clients/:id/permanent'
      }
    }
  });
});

// ============ 404 Handler ============
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ============ Error Handler ============
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============ Start Server ============
app.listen(PORT, () => {
  console.log(`🚀 VasoolBook Admin API running on http://localhost:${PORT}`);
  console.log(`📊 Data file: ${DATA_FILE}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
});
