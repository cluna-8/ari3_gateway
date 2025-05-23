// index.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const { router: authRouter } = require('./auth/app');
const routerModule = require('./router/router');
const adminRouter = require('./admin/admin-routes');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Crear aplicación Express
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Puerto para el servidor
const PORT = process.env.PORT || 3000;

// Middleware para logging básico
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Montar el módulo de autenticación
app.use('/auth', authRouter);

// Montar el módulo de enrutamiento
app.use('/api', routerModule);

// Montar el módulo de administración
app.use('/admin', adminRouter);

// Servir archivos estáticos del frontend (si existe)
//app.use(express.static(path.join(__dirname, 'frontend/build')));
// Endpoint para estadísticas básicas
app.get('/api/stats', (req, res) => {
  res.json({
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    serverTime: new Date().toISOString()
  });
});


// Ruta principal
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API Gateway funcionando',
    version: '1.0.0',
    fecha: new Date().toISOString(),
    endpoints: {
      auth: '/auth',
      api: '/api/query',
      admin: '/admin'
    }
  });
});

// Ruta para manejar cualquier otra solicitud (SPA frontend)
//app.get('*', (req, res) => {
//  res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
//});
// Middleware para manejar rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({
    message: 'Endpoint no encontrado',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'production' ? null : err.message
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`API Gateway iniciado en puerto ${PORT}`);
  console.log(`Fecha de inicio: ${new Date().toISOString()}`);
  console.log('----------------------------------------');
  console.log('Rutas disponibles:');
  console.log('- POST /auth/login - Iniciar sesión');
  console.log('- GET /auth/validate-key - Validar API key');
  console.log('- POST /api/query - Enviar consulta');
  console.log('- GET /api/options - Ver opciones disponibles');
  console.log('- Rutas de administración en /admin');
  console.log('----------------------------------------');
});

// Manejar señales de terminación
process.on('SIGTERM', () => {
  console.log('Servidor terminando...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Servidor interrumpido...');
  process.exit(0);
});