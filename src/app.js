const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Endpoint de prueba ("Health Check")
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Futcamedic API Backend is running!',
    timestamp: new Date().toISOString()
  });
});

// TODO: Importar e inyectar el resto de rutas (students, attendance, etc.)

module.exports = app;
