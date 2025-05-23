// admin/admin-routes.js
const express = require('express');
const db = require('../db/connection');
const bcrypt = require('bcrypt');
const { authenticateApiKey, authenticateJWT } = require('../auth/app');
const { isAdmin } = require('../auth/permissions');
const { getUsageStats } = require('../admin/usage');
const crypto = require('crypto');

const router = express.Router();
router.use(express.json());

// Middleware para permitir acceso por API key o JWT
function authenticate(req, res, next) {
  const hasApiKey = req.header('X-API-Key');
  
  if (hasApiKey) {
    return authenticateApiKey(req, res, next);
  } else {
    return authenticateJWT(req, res, next);
  }
}

// === RUTAS DE GESTIÓN DE USUARIOS ===

// GET /admin/usuarios - Listar todos los usuarios
router.get('/usuarios', authenticate, isAdmin, async (req, res) => {
  try {
    const [usuarios] = await db.execute(
      'SELECT u.id, u.username, u.email, u.activo, r.nombre AS rol, ' +
      'DATE_FORMAT(u.fecha_creacion, "%Y-%m-%d %H:%i:%s") AS fecha_creacion ' +
      'FROM usuarios u ' +
      'JOIN roles r ON u.role_id = r.id ' +
      'ORDER BY u.id'
    );
    
    res.json({ usuarios });
  } catch (error) {
    console.error('Error listando usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// GET /admin/usuarios/:id - Obtener un usuario
router.get('/usuarios/:id', authenticate, isAdmin, async (req, res) => {
  const userId = req.params.id;
  
  try {
    const [usuarios] = await db.execute(
      'SELECT u.id, u.username, u.email, u.activo, u.role_id, r.nombre AS rol, ' +
      'DATE_FORMAT(u.fecha_creacion, "%Y-%m-%d %H:%i:%s") AS fecha_creacion ' +
      'FROM usuarios u ' +
      'JOIN roles r ON u.role_id = r.id ' +
      'WHERE u.id = ?',
      [userId]
    );
    
    if (usuarios.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Obtener API keys del usuario
    const [keys] = await db.execute(
      'SELECT id, key_value, nombre, activo, credito_disponible, ' +
      'DATE_FORMAT(fecha_creacion, "%Y-%m-%d %H:%i:%s") AS fecha_creacion ' +
      'FROM api_keys WHERE usuario_id = ?',
      [userId]
    );
    
    // Por seguridad, solo mostramos parte de la key
    const safeKeys = keys.map(k => ({
      ...k,
      key_value: k.key_value.substring(0, 8) + '...' + k.key_value.slice(-4)
    }));
    
    res.json({
      usuario: usuarios[0],
      api_keys: safeKeys
    });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// POST /admin/usuarios - Crear usuario
router.post('/usuarios', authenticate, isAdmin, async (req, res) => {
  const { username, password, email, role_id } = req.body;
  
  if (!username || !password || !email || !role_id) {
    return res.status(400).json({ message: 'Datos incompletos' });
  }
  
  try {
    // Validar que el rol existe
    const [roles] = await db.execute(
      'SELECT * FROM roles WHERE id = ?',
      [role_id]
    );
    
    if (roles.length === 0) {
      return res.status(400).json({ message: 'El rol especificado no existe' });
    }
    
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insertar usuario
    const [result] = await db.execute(
      'INSERT INTO usuarios (username, password, email, role_id) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, email, role_id]
    );
    
    res.status(201).json({ 
      message: 'Usuario creado correctamente',
      id: result.insertId,
      username,
      email,
      role_id
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'El nombre de usuario o email ya existe' });
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// PUT /admin/usuarios/:id - Actualizar usuario
router.put('/usuarios/:id', authenticate, isAdmin, async (req, res) => {
  const userId = req.params.id;
  const { username, email, role_id, activo, password } = req.body;
  
  try {
    // Verificar que el usuario existe
    const [usuarios] = await db.execute(
      'SELECT * FROM usuarios WHERE id = ?',
      [userId]
    );
    
    if (usuarios.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Construir la query según los campos a actualizar
    let query = 'UPDATE usuarios SET ';
    const params = [];
    const updates = [];
    
    if (username) {
      updates.push('username = ?');
      params.push(username);
    }
    
    if (email) {
      updates.push('email = ?');
      params.push(email);
    }
    
    if (role_id) {
      updates.push('role_id = ?');
      params.push(role_id);
    }
    
    if (activo !== undefined) {
      updates.push('activo = ?');
      params.push(activo);
    }
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hashedPassword);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No se especificaron campos para actualizar' });
    }
    
    query += updates.join(', ') + ' WHERE id = ?';
    params.push(userId);
    
    // Ejecutar la actualización
    await db.execute(query, params);
    
    res.json({ 
      message: 'Usuario actualizado correctamente',
      id: parseInt(userId)
    });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'El nombre de usuario o email ya existe' });
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// DELETE /admin/usuarios/:id - Eliminar usuario (desactivar)
router.delete('/usuarios/:id', authenticate, isAdmin, async (req, res) => {
  const userId = req.params.id;
  
  try {
    // Verificar que el usuario existe
    const [usuarios] = await db.execute(
      'SELECT * FROM usuarios WHERE id = ?',
      [userId]
    );
    
    if (usuarios.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // No permitir eliminar al propio usuario administrador
    const adminId = req.apiKey?.userId || req.user.id;
    if (parseInt(userId) === adminId) {
      return res.status(400).json({ message: 'No puedes eliminar tu propio usuario' });
    }
    
    // Desactivar el usuario en lugar de eliminarlo
    await db.execute(
      'UPDATE usuarios SET activo = FALSE WHERE id = ?',
      [userId]
    );
    
    // Desactivar todas sus API keys
    await db.execute(
      'UPDATE api_keys SET activo = FALSE WHERE usuario_id = ?',
      [userId]
    );
    
    res.json({ 
      message: 'Usuario desactivado correctamente',
      id: parseInt(userId)
    });
  } catch (error) {
    console.error('Error desactivando usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// === RUTAS DE GESTIÓN DE API KEYS ===

// POST /admin/usuarios/:id/keys - Crear API key para usuario
router.post('/usuarios/:id/keys', authenticate, isAdmin, async (req, res) => {
  const userId = req.params.id;
  const { nombre, credito_inicial = 0 } = req.body;
  
  if (!nombre) {
    return res.status(400).json({ message: 'Se requiere un nombre para la API key' });
  }
  
  try {
    // Verificar que el usuario existe
    const [usuarios] = await db.execute(
      'SELECT * FROM usuarios WHERE id = ?',
      [userId]
    );
    
    if (usuarios.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Generar API key
    const apiKey = 'sk-' + crypto.randomBytes(24).toString('hex');
    
    // Insertar API key
    const [result] = await db.execute(
      'INSERT INTO api_keys (key_value, usuario_id, nombre, credito_disponible) VALUES (?, ?, ?, ?)',
      [apiKey, userId, nombre, credito_inicial]
    );
    
    res.status(201).json({
      message: 'API key creada correctamente',
      id: result.insertId,
      key: apiKey,
      nombre,
      credito_disponible: credito_inicial
    });
  } catch (error) {
    console.error('Error creando API key:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// GET /admin/keys - Listar todas las API keys
router.get('/keys', authenticate, isAdmin, async (req, res) => {
  try {
    const [keys] = await db.execute(
      'SELECT ak.id, ak.key_value, ak.nombre, ak.activo, ak.credito_disponible, ' +
      'ak.usuario_id, u.username, ' +
      'DATE_FORMAT(ak.fecha_creacion, "%Y-%m-%d %H:%i:%s") AS fecha_creacion ' +
      'FROM api_keys ak ' +
      'JOIN usuarios u ON ak.usuario_id = u.id ' +
      'ORDER BY ak.id DESC'
    );
    
    // Por seguridad, solo mostramos parte de la key
    const safeKeys = keys.map(k => ({
      ...k,
      key_value: k.key_value.substring(0, 8) + '...' + k.key_value.slice(-4)
    }));
    
    res.json({ keys: safeKeys });
  } catch (error) {
    console.error('Error listando API keys:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// GET /admin/keys/:id - Obtener una API key
router.get('/keys/:id', authenticate, isAdmin, async (req, res) => {
  const keyId = req.params.id;
  
  try {
    const [keys] = await db.execute(
      'SELECT ak.id, ak.key_value, ak.nombre, ak.activo, ak.credito_disponible, ' +
      'ak.usuario_id, u.username, ' +
      'DATE_FORMAT(ak.fecha_creacion, "%Y-%m-%d %H:%i:%s") AS fecha_creacion, ' +
      'DATE_FORMAT(ak.fecha_actualizacion, "%Y-%m-%d %H:%i:%s") AS fecha_actualizacion ' +
      'FROM api_keys ak ' +
      'JOIN usuarios u ON ak.usuario_id = u.id ' +
      'WHERE ak.id = ?',
      [keyId]
    );
    
    if (keys.length === 0) {
      return res.status(404).json({ message: 'API key no encontrada' });
    }
    
    // Obtener últimos 10 usos
    const [usos] = await db.execute(
      'SELECT cu.id, DATE_FORMAT(cu.timestamp, "%Y-%m-%d %H:%i:%s") AS fecha, ' +
      'a.nombre AS agente, m.nombre AS modelo, ' +
      'cu.tokens_entrada, cu.tokens_salida, cu.costo_total ' +
      'FROM costos_uso cu ' +
      'LEFT JOIN agentes a ON cu.agente_id = a.id ' +
      'JOIN modelos m ON cu.modelo_id = m.id ' +
      'WHERE cu.api_key_id = ? ' +
      'ORDER BY cu.timestamp DESC LIMIT 10',
      [keyId]
    );
    
    // Por seguridad, solo mostramos parte de la key
    const key = keys[0];
    key.key_value = key.key_value.substring(0, 8) + '...' + key.key_value.slice(-4);
    
    res.json({
      key,
      usos
    });
  } catch (error) {
    console.error('Error obteniendo API key:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// PUT /admin/keys/:id - Actualizar API key
router.put('/keys/:id', authenticate, isAdmin, async (req, res) => {
  const keyId = req.params.id;
  const { nombre, activo } = req.body;
  
  try {
    // Verificar que la API key existe
    const [keys] = await db.execute(
      'SELECT * FROM api_keys WHERE id = ?',
      [keyId]
    );
    
    if (keys.length === 0) {
      return res.status(404).json({ message: 'API key no encontrada' });
    }
    
    // Construir la query según los campos a actualizar
    let query = 'UPDATE api_keys SET ';
    const params = [];
    const updates = [];
    
    if (nombre) {
      updates.push('nombre = ?');
      params.push(nombre);
    }
    
    if (activo !== undefined) {
      updates.push('activo = ?');
      params.push(activo);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No se especificaron campos para actualizar' });
    }
    
    query += updates.join(', ') + ' WHERE id = ?';
    params.push(keyId);
    
    // Ejecutar la actualización
    await db.execute(query, params);
    
    res.json({ 
      message: 'API key actualizada correctamente',
      id: parseInt(keyId)
    });
  } catch (error) {
    console.error('Error actualizando API key:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// POST /admin/keys/:id/credito - Añadir crédito a una API key
router.post('/keys/:id/credito', authenticate, isAdmin, async (req, res) => {
  const keyId = req.params.id;
  const { monto } = req.body;
  
  if (!monto || isNaN(monto) || monto <= 0) {
    return res.status(400).json({ message: 'Se requiere un monto válido mayor a cero' });
  }
  
  try {
    // Actualizar crédito
    await db.execute(
      'UPDATE api_keys SET credito_disponible = credito_disponible + ? WHERE id = ?',
      [monto, keyId]
    );
    
    // Obtener crédito actualizado
    const [keys] = await db.execute(
      'SELECT id, credito_disponible FROM api_keys WHERE id = ?',
      [keyId]
    );
    
    if (keys.length === 0) {
      return res.status(404).json({ message: 'API key no encontrada' });
    }
    
    res.json({
      message: 'Crédito añadido correctamente',
      id: parseInt(keyId),
      monto_añadido: parseFloat(monto),
      credito_actual: parseFloat(keys[0].credito_disponible)
    });
  } catch (error) {
    console.error('Error añadiendo crédito:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// === RUTAS DE GESTIÓN DE PERMISOS ===

// GET /admin/permisos/:userId - Ver permisos de usuario
router.get('/permisos/:userId', authenticate, isAdmin, async (req, res) => {
  const userId = req.params.userId;
  
  try {
    // Verificar que el usuario existe
    const [usuarios] = await db.execute(
      'SELECT id, username FROM usuarios WHERE id = ?',
      [userId]
    );
    
    if (usuarios.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Obtener permisos existentes
    const [permisos] = await db.execute(
      'SELECT cp.id, cp.agente_id, a.nombre AS agente, cp.modelo_id, m.nombre AS modelo, ' +
      'cp.habilitado, DATE_FORMAT(cp.fecha_creacion, "%Y-%m-%d %H:%i:%s") AS fecha_creacion ' +
      'FROM cliente_permisos cp ' +
      'JOIN agentes a ON cp.agente_id = a.id ' +
      'JOIN modelos m ON cp.modelo_id = m.id ' +
      'WHERE cp.usuario_id = ?',
      [userId]
    );
    
    // Obtener todos los agentes disponibles
    const [agentes] = await db.execute(
      'SELECT id, nombre FROM agentes WHERE activo = TRUE'
    );
    
    // Obtener todos los modelos disponibles
    const [modelos] = await db.execute(
      'SELECT id, nombre, proveedor FROM modelos WHERE activo = TRUE'
    );
    
    res.json({
      usuario: usuarios[0],
      permisos,
      agentes_disponibles: agentes,
      modelos_disponibles: modelos
    });
  } catch (error) {
    console.error('Error obteniendo permisos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// POST /admin/permisos - Asignar nuevo permiso
router.post('/permisos', authenticate, isAdmin, async (req, res) => {
  const { usuario_id, agente_id, modelo_id, habilitado = true } = req.body;
  
  if (!usuario_id || !agente_id || !modelo_id) {
    return res.status(400).json({ message: 'Datos incompletos' });
  }
  
  try {
    // Verificar que el usuario, agente y modelo existen
    const [usuarios] = await db.execute(
      'SELECT id FROM usuarios WHERE id = ?',
      [usuario_id]
    );
    
    if (usuarios.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const [agentes] = await db.execute(
      'SELECT id FROM agentes WHERE id = ?',
      [agente_id]
    );
    
    if (agentes.length === 0) {
      return res.status(404).json({ message: 'Agente no encontrado' });
    }
    
    const [modelos] = await db.execute(
      'SELECT id FROM modelos WHERE id = ?',
      [modelo_id]
    );
    
    if (modelos.length === 0) {
      return res.status(404).json({ message: 'Modelo no encontrado' });
    }
    
    // Insertar o actualizar permiso
    await db.execute(
      'INSERT INTO cliente_permisos (usuario_id, agente_id, modelo_id, habilitado) ' +
      'VALUES (?, ?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE habilitado = VALUES(habilitado)',
      [usuario_id, agente_id, modelo_id, habilitado]
    );
    
    res.status(201).json({ 
      message: 'Permiso asignado correctamente',
      usuario_id: parseInt(usuario_id),
      agente_id: parseInt(agente_id),
      modelo_id: parseInt(modelo_id),
      habilitado
    });
  } catch (error) {
    console.error('Error asignando permiso:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// DELETE /admin/permisos/:id - Eliminar permiso
router.delete('/permisos/:id', authenticate, isAdmin, async (req, res) => {
  const permisoId = req.params.id;
  
  try {
    // Verificar que el permiso existe
    const [permisos] = await db.execute(
      'SELECT id FROM cliente_permisos WHERE id = ?',
      [permisoId]
    );
    
    if (permisos.length === 0) {
      return res.status(404).json({ message: 'Permiso no encontrado' });
    }
    
    // Eliminar permiso
    await db.execute(
      'DELETE FROM cliente_permisos WHERE id = ?',
      [permisoId]
    );
    
    res.json({ 
      message: 'Permiso eliminado correctamente',
      id: parseInt(permisoId)
    });
  } catch (error) {
    console.error('Error eliminando permiso:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// === RUTAS DE ESTADÍSTICAS DE USO ===

// GET /admin/uso - Ver estadísticas de uso
router.get('/uso', authenticate, isAdmin, async (req, res) => {
  const { desde, hasta, usuario_id, agente_id, modelo_id, limit = 100 } = req.query;
  
  try {
    let query = `
      SELECT cu.id, DATE_FORMAT(cu.timestamp, "%Y-%m-%d %H:%i:%s") AS fecha, 
      u.username, ak.nombre AS nombre_key, a.nombre AS agente, m.nombre AS modelo,
      cu.tokens_entrada, cu.tokens_salida, cu.costo_entrada, cu.costo_salida, cu.costo_total
      FROM costos_uso cu
      JOIN api_keys ak ON cu.api_key_id = ak.id
      JOIN usuarios u ON ak.usuario_id = u.id
      LEFT JOIN agentes a ON cu.agente_id = a.id
      JOIN modelos m ON cu.modelo_id = m.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Filtros opcionales
    if (desde) {
      query += ' AND cu.timestamp >= ?';
      params.push(desde);
    }
    
    if (hasta) {
      query += ' AND cu.timestamp <= ?';
      params.push(hasta);
    }
    
    if (usuario_id) {
      query += ' AND u.id = ?';
      params.push(usuario_id);
    }
    
    if (agente_id) {
      query += ' AND a.id = ?';
      params.push(agente_id);
    }
    
    if (modelo_id) {
      query += ' AND m.id = ?';
      params.push(modelo_id);
    }
    
    query += ' ORDER BY cu.timestamp DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const [registros] = await db.execute(query, params);
    
    // Obtener estadísticas agrupadas
    const stats = await getUsageStats({
      desde, hasta, usuarioId: usuario_id, agenteId: agente_id, modeloId: modelo_id
    });
    
    // Calcular totales
    const totales = {
      tokens_entrada: 0,
      tokens_salida: 0,
      costo_total: 0
    };
    
    registros.forEach(registro => {
      totales.tokens_entrada += registro.tokens_entrada;
      totales.tokens_salida += registro.tokens_salida;
      totales.costo_total += parseFloat(registro.costo_total);
    });
    
    res.json({
      registros,
      estadisticas: stats,
      totales,
      count: registros.length
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de uso:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// GET /admin/dashboard - Obtener datos para el dashboard
router.get('/dashboard', authenticate, isAdmin, async (req, res) => {
  try {
    // Obtener resumen de usuarios
    const [usuarios] = await db.execute(
      'SELECT COUNT(*) AS total, SUM(CASE WHEN activo = TRUE THEN 1 ELSE 0 END) AS activos ' +
      'FROM usuarios'
    );
    
    // Obtener resumen de API keys
    const [keys] = await db.execute(
      'SELECT COUNT(*) AS total, SUM(CASE WHEN activo = TRUE THEN 1 ELSE 0 END) AS activas, ' +
      'SUM(credito_disponible) AS credito_total ' +
      'FROM api_keys'
    );
    
    // Obtener solicitudes últimas 24 horas
    const [solicitudes24h] = await db.execute(
      'SELECT COUNT(*) AS total, SUM(tokens_entrada) AS tokens_entrada, ' +
      'SUM(tokens_salida) AS tokens_salida, SUM(costo_total) AS costo_total ' +
      'FROM costos_uso WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'
    );
    
    // Obtener solicitudes por modelo
    const [solicitudesModelo] = await db.execute(
      'SELECT m.nombre, COUNT(*) AS total, SUM(cu.costo_total) AS costo_total ' +
      'FROM costos_uso cu ' +
      'JOIN modelos m ON cu.modelo_id = m.id ' +
      'WHERE cu.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY) ' +
      'GROUP BY m.nombre ' +
      'ORDER BY total DESC'
    );
    
    // Obtener solicitudes por agente
    const [solicitudesAgente] = await db.execute(
      'SELECT COALESCE(a.nombre, "Sin Agente") AS nombre, COUNT(*) AS total ' +
      'FROM costos_uso cu ' +
      'LEFT JOIN agentes a ON cu.agente_id = a.id ' +
      'WHERE cu.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY) ' +
      'GROUP BY a.nombre ' +
      'ORDER BY total DESC'
    );
    
    // Obtener solicitudes por día (últimos 15 días)
    const [solicitudesDia] = await db.execute(
      'SELECT DATE_FORMAT(timestamp, "%Y-%m-%d") AS fecha, COUNT(*) AS total, ' +
      'SUM(tokens_entrada + tokens_salida) AS tokens_totales, SUM(costo_total) AS costo_total ' +
      'FROM costos_uso ' +
      'WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 15 DAY) ' +
      'GROUP BY DATE_FORMAT(timestamp, "%Y-%m-%d") ' +
      'ORDER BY fecha'
    );
    
    res.json({
      usuarios: usuarios[0],
      api_keys: keys[0],
      solicitudes_24h: solicitudes24h[0],
      solicitudes_por_modelo: solicitudesModelo,
      solicitudes_por_agente: solicitudesAgente,
      solicitudes_por_dia: solicitudesDia
    });
  } catch (error) {
    console.error('Error obteniendo datos del dashboard:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// === RUTAS DE GESTIÓN DE PATRONES DE PROMPTS ===

// GET /admin/patrones - Listar todos los patrones de prompts
router.get('/patrones', authenticate, isAdmin, async (req, res) => {
  try {
    const [patrones] = await db.execute(
      'SELECT pp.id, a.nombre AS agente, ts.nombre AS tipo_seguridad, ' +
      'pp.prompt_pattern, pp.descripcion, pp.activo, ' +
      'DATE_FORMAT(pp.fecha_creacion, "%Y-%m-%d %H:%i:%s") AS fecha_creacion ' +
      'FROM prompt_patterns pp ' +
      'JOIN agentes a ON pp.agente_id = a.id ' +
      'JOIN tipos_seguridad ts ON pp.tipo_seguridad_id = ts.id ' +
      'ORDER BY a.nombre, ts.nombre, pp.prompt_pattern'
    );
    
    // Para cada patrón, obtener modelos permitidos
    for (const patron of patrones) {
      const [modelos] = await db.execute(
        'SELECT m.id, m.nombre, m.proveedor ' +
        'FROM pattern_models pm ' +
        'JOIN modelos m ON pm.modelo_id = m.id ' +
        'WHERE pm.pattern_id = ? AND m.activo = TRUE',
        [patron.id]
      );
      
      patron.modelos_permitidos = modelos;
    }
    
    res.json({ patrones });
  } catch (error) {
    console.error('Error listando patrones:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// POST /admin/patrones - Crear un nuevo patrón
router.post('/patrones', authenticate, isAdmin, async (req, res) => {
  const { agente_id, tipo_seguridad_id, prompt_pattern, descripcion, modelos_ids } = req.body;
  
  if (!agente_id || !tipo_seguridad_id || !prompt_pattern || !modelos_ids || !Array.isArray(modelos_ids)) {
    return res.status(400).json({ message: 'Datos incompletos o inválidos' });
  }
  
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // Insertar el patrón
    const [resultPattern] = await conn.execute(
      'INSERT INTO prompt_patterns (agente_id, tipo_seguridad_id, prompt_pattern, descripcion) VALUES (?, ?, ?, ?)',
      [agente_id, tipo_seguridad_id, prompt_pattern, descripcion || null]
    );
    
    const patternId = resultPattern.insertId;
    
    // Insertar relaciones con modelos
    for (const modeloId of modelos_ids) {
      await conn.execute(
        'INSERT INTO pattern_models (pattern_id, modelo_id) VALUES (?, ?)',
        [patternId, modeloId]
      );
    }
    
    await conn.commit();
    
    res.status(201).json({
      message: 'Patrón creado correctamente',
      id: patternId,
      prompt_pattern,
      descripcion,
      modelos_ids
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error creando patrón:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
});

// GET /admin/patrones/:id - Obtener un patrón específico
router.get('/patrones/:id', authenticate, isAdmin, async (req, res) => {
  const patronId = req.params.id;
  
  try {
    const [patrones] = await db.execute(
      'SELECT pp.id, pp.agente_id, a.nombre AS agente, ' + 
      'pp.tipo_seguridad_id, ts.nombre AS tipo_seguridad, ' +
      'pp.prompt_pattern, pp.descripcion, pp.activo, ' +
      'DATE_FORMAT(pp.fecha_creacion, "%Y-%m-%d %H:%i:%s") AS fecha_creacion ' +
      'FROM prompt_patterns pp ' +
      'JOIN agentes a ON pp.agente_id = a.id ' +
      'JOIN tipos_seguridad ts ON pp.tipo_seguridad_id = ts.id ' +
      'WHERE pp.id = ?',
      [patronId]
    );
    
    if (patrones.length === 0) {
      return res.status(404).json({ message: 'Patrón no encontrado' });
    }
    
    const patron = patrones[0];
    
    // Obtener modelos permitidos
    const [modelos] = await db.execute(
      'SELECT m.id, m.nombre, m.proveedor ' +
      'FROM pattern_models pm ' +
      'JOIN modelos m ON pm.modelo_id = m.id ' +
      'WHERE pm.pattern_id = ?',
      [patronId]
    );
    
    patron.modelos_permitidos = modelos;
    
    res.json({ patron });
  } catch (error) {
    console.error('Error obteniendo patrón:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// PUT /admin/patrones/:id - Actualizar un patrón
router.put('/patrones/:id', authenticate, isAdmin, async (req, res) => {
  const patronId = req.params.id;
  const { prompt_pattern, descripcion, modelos_ids, activo } = req.body;
  
  if (!prompt_pattern && descripcion === undefined && !modelos_ids && activo === undefined) {
    return res.status(400).json({ message: 'No se especificaron campos para actualizar' });
  }
  
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // Verificar que el patrón existe
    const [patrones] = await conn.execute(
      'SELECT id FROM prompt_patterns WHERE id = ?',
      [patronId]
    );
    
    if (patrones.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Patrón no encontrado' });
    }
    
    // Actualizar campos del patrón
    if (prompt_pattern || descripcion !== undefined || activo !== undefined) {
      const updates = [];
      const params = [];
      
      if (prompt_pattern) {
        updates.push('prompt_pattern = ?');
        params.push(prompt_pattern);
      }
      
      if (descripcion !== undefined) {
        updates.push('descripcion = ?');
        params.push(descripcion);
      }
      
      if (activo !== undefined) {
        updates.push('activo = ?');
        params.push(activo);
      }
      
      if (updates.length > 0) {
        const query = `UPDATE prompt_patterns SET ${updates.join(', ')} WHERE id = ?`;
        params.push(patronId);
        await conn.execute(query, params);
      }
    }
    
    // Actualizar modelos permitidos
    if (modelos_ids && Array.isArray(modelos_ids)) {
      // Eliminar relaciones existentes
      await conn.execute(
        'DELETE FROM pattern_models WHERE pattern_id = ?',
        [patronId]
      );
      
      // Insertar nuevas relaciones
      for (const modeloId of modelos_ids) {
        await conn.execute(
          'INSERT INTO pattern_models (pattern_id, modelo_id) VALUES (?, ?)',
          [patronId, modeloId]
        );
      }
    }
    
    await conn.commit();
    
    res.json({
      message: 'Patrón actualizado correctamente',
      id: parseInt(patronId)
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error actualizando patrón:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
});

// DELETE /admin/patrones/:id - Eliminar un patrón (eliminación real)
router.delete('/patrones/:id', authenticate, isAdmin, async (req, res) => {
  const patronId = req.params.id;
  
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // Eliminar relaciones con modelos
    await conn.execute(
      'DELETE FROM pattern_models WHERE pattern_id = ?',
      [patronId]
    );
    
    // Eliminar el patrón
    const [result] = await conn.execute(
      'DELETE FROM prompt_patterns WHERE id = ?',
      [patronId]
    );
    
    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Patrón no encontrado' });
    }
    
    await conn.commit();
    
    res.json({
      message: 'Patrón eliminado correctamente',
      id: parseInt(patronId)
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error eliminando patrón:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
});

// GET /admin/agentes/:id/patrones - Obtener patrones para un agente específico
router.get('/agentes/:id/patrones', authenticate, isAdmin, async (req, res) => {
  const agenteId = req.params.id;
  
  try {
    // Verificar que el agente existe
    const [agentes] = await db.execute(
      'SELECT id, nombre FROM agentes WHERE id = ?',
      [agenteId]
    );
    
    if (agentes.length === 0) {
      return res.status(404).json({ message: 'Agente no encontrado' });
    }
    
    // Obtener patrones del agente
    const [patterns] = await db.execute(
      'SELECT pp.id, pp.tipo_seguridad_id, ts.nombre AS tipo_seguridad, ' +
      'pp.prompt_pattern, pp.descripcion, pp.activo, ' +
      'DATE_FORMAT(pp.fecha_creacion, "%Y-%m-%d %H:%i:%s") AS fecha_creacion ' +
      'FROM prompt_patterns pp ' +
      'JOIN tipos_seguridad ts ON pp.tipo_seguridad_id = ts.id ' +
      'WHERE pp.agente_id = ?',
      [agenteId]
    );
    
    // Para cada patrón, obtener los modelos permitidos
    const patternsWithModels = [];
    for (const pattern of patterns) {
      const [models] = await db.execute(
        'SELECT m.id, m.nombre, m.proveedor ' +
        'FROM pattern_models pm ' +
        'JOIN modelos m ON pm.modelo_id = m.id ' +
        'WHERE pm.pattern_id = ?',
        [pattern.id]
      );
      
      patternsWithModels.push({
        ...pattern,
        modelos_permitidos: models
      });
    }
    
    // Obtener todos los modelos disponibles para referencia
    const [modelos] = await db.execute(
      'SELECT id, nombre, proveedor FROM modelos WHERE activo = TRUE'
    );
    
    // Obtener todos los tipos de seguridad disponibles
    const [tiposSeguridad] = await db.execute(
      'SELECT id, nombre FROM tipos_seguridad'
    );
    
    res.json({
      agente: agentes[0],
      patrones: patternsWithModels,
      modelos_disponibles: modelos,
      tipos_seguridad: tiposSeguridad
    });
  } catch (error) {
    console.error('Error obteniendo patrones del agente:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// POST /admin/patrones/reload - Limpiar caché de patrones (útil después de cambios masivos)
router.post('/patrones/reload', authenticate, isAdmin, async (req, res) => {
  try {
    // No hay caché real que limpiar, pero podemos simular una respuesta
    res.json({
      message: 'Caché de patrones recargada correctamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error recargando caché de patrones:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// GET /admin/workflow/connections - Obtener todas las conexiones para el flujo de trabajo
router.get('/workflow/connections', authenticate, isAdmin, async (req, res) => {
  try {
    // Obtener todos los patrones con sus conexiones
    const [connections] = await db.execute(
      'SELECT pp.id, a.id AS agente_id, a.nombre AS agente_nombre, ' +
      'ts.id AS tipo_seguridad_id, ts.nombre AS tipo_seguridad, ' +
      'pp.prompt_pattern, pp.descripcion, pp.activo ' +
      'FROM prompt_patterns pp ' +
      'JOIN agentes a ON pp.agente_id = a.id ' +
      'JOIN tipos_seguridad ts ON pp.tipo_seguridad_id = ts.id ' +
      'WHERE pp.activo = TRUE'
    );
    
    // Para cada patrón, obtener los modelos conectados
    for (const conn of connections) {
      const [modelos] = await db.execute(
        'SELECT m.id, m.nombre, m.proveedor ' +
        'FROM pattern_models pm ' +
        'JOIN modelos m ON pm.modelo_id = m.id ' +
        'WHERE pm.pattern_id = ? AND m.activo = TRUE',
        [conn.id]
      );
      
      conn.modelos = modelos;
    }
    
    res.json({ connections });
  } catch (error) {
    console.error('Error obteniendo conexiones:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// POST /admin/workflow/connect - Crear una conexión entre agente y modelo
router.post('/workflow/connect', authenticate, isAdmin, async (req, res) => {
  const { agente_id, tipo_seguridad_id, modelo_id, prompt_pattern, descripcion } = req.body;
  
  if (!agente_id || !tipo_seguridad_id || !modelo_id) {
    return res.status(400).json({ message: 'Datos incompletos. Se requiere agente_id, tipo_seguridad_id y modelo_id' });
  }
  
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // Verificar si ya existe un patrón por defecto para este agente y tipo de seguridad
    let patternId;
    
    // Si no se proporciona un patrón específico, usar el patrón comodín ".*"
    const pattern = prompt_pattern || '.*';
    const desc = descripcion || 'Conexión creada desde la interfaz de flujo de trabajo';
    
    const [existingPatterns] = await conn.execute(
      'SELECT id FROM prompt_patterns ' +
      'WHERE agente_id = ? AND tipo_seguridad_id = ? AND prompt_pattern = ?',
      [agente_id, tipo_seguridad_id, pattern]
    );
    
    if (existingPatterns.length > 0) {
      // Usar el patrón existente
      patternId = existingPatterns[0].id;
    } else {
      // Crear un nuevo patrón
      const [result] = await conn.execute(
        'INSERT INTO prompt_patterns (agente_id, tipo_seguridad_id, prompt_pattern, descripcion) ' +
        'VALUES (?, ?, ?, ?)',
        [agente_id, tipo_seguridad_id, pattern, desc]
      );
      
      patternId = result.insertId;
    }
    
    // Verificar si la conexión ya existe
    const [existingConnections] = await conn.execute(
      'SELECT id FROM pattern_models ' +
      'WHERE pattern_id = ? AND modelo_id = ?',
      [patternId, modelo_id]
    );
    
    if (existingConnections.length === 0) {
      // Crear la conexión
      await conn.execute(
        'INSERT INTO pattern_models (pattern_id, modelo_id) VALUES (?, ?)',
        [patternId, modelo_id]
      );
    }
    
    await conn.commit();
    
    res.status(201).json({
      message: 'Conexión creada correctamente',
      pattern_id: patternId,
      modelo_id: modelo_id
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error creando conexión:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
});

// DELETE /admin/workflow/disconnect - Eliminar una conexión entre agente y modelo
router.delete('/workflow/disconnect', authenticate, isAdmin, async (req, res) => {
  const { agente_id, tipo_seguridad_id, modelo_id } = req.body;
  
  if (!agente_id || !tipo_seguridad_id || !modelo_id) {
    return res.status(400).json({ message: 'Datos incompletos. Se requiere agente_id, tipo_seguridad_id y modelo_id' });
  }
  
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // Encontrar el patrón
    const [patterns] = await conn.execute(
      'SELECT id FROM prompt_patterns ' +
      'WHERE agente_id = ? AND tipo_seguridad_id = ?',
      [agente_id, tipo_seguridad_id]
    );
    
    if (patterns.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'No se encontró la conexión' });
    }
    
    // Eliminar todas las conexiones para los patrones encontrados
    for (const pattern of patterns) {
      await conn.execute(
        'DELETE FROM pattern_models ' +
        'WHERE pattern_id = ? AND modelo_id = ?',
        [pattern.id, modelo_id]
      );
    }
    
    await conn.commit();
    
    res.json({
      message: 'Conexión eliminada correctamente',
      agente_id: agente_id,
      tipo_seguridad_id: tipo_seguridad_id,
      modelo_id: modelo_id
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error eliminando conexión:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
});

// GET /admin/workflow/nodes - Obtener todos los nodos para el flujo de trabajo
router.get('/workflow/nodes', authenticate, isAdmin, async (req, res) => {
  try {
    // Obtener agentes (nodos)
    const [agentes] = await db.execute(
      'SELECT id, nombre, script, descripcion, activo FROM agentes'
    );
    
    // Obtener tipos de seguridad
    const [tiposSeguridad] = await db.execute(
      'SELECT id, nombre, descripcion FROM tipos_seguridad'
    );
    
    // Obtener modelos
    const [modelos] = await db.execute(
      'SELECT id, nombre, proveedor, precio_input, precio_output, tipo_seguridad_id, activo FROM modelos'
    );
    
    res.json({
      agentes,
      tipos_seguridad: tiposSeguridad,
      modelos
    });
  } catch (error) {
    console.error('Error obteniendo nodos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// POST /admin/workflow/cliente-permisos - Crear permisos para un cliente basado en conexiones
router.post('/workflow/cliente-permisos', authenticate, isAdmin, async (req, res) => {
  const { usuario_id, conexiones } = req.body;
  
  if (!usuario_id || !conexiones || !Array.isArray(conexiones)) {
    return res.status(400).json({ message: 'Datos incompletos. Se requiere usuario_id y array de conexiones' });
  }
  
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // Verificar que el usuario existe
    const [usuarios] = await conn.execute(
      'SELECT id FROM usuarios WHERE id = ?',
      [usuario_id]
    );
    
    if (usuarios.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const resultados = [];
    
    // Crear permisos para cada conexión
    for (const conexion of conexiones) {
      const { agente_id, modelo_id } = conexion;
      
      if (!agente_id || !modelo_id) {
        continue; // Saltar conexiones incompletas
      }
      
      // Verificar si ya existe el permiso
      const [permisos] = await conn.execute(
        'SELECT id, habilitado FROM cliente_permisos ' +
        'WHERE usuario_id = ? AND agente_id = ? AND modelo_id = ?',
        [usuario_id, agente_id, modelo_id]
      );
      
      if (permisos.length > 0) {
        // Actualizar el permiso existente
        await conn.execute(
          'UPDATE cliente_permisos SET habilitado = TRUE WHERE id = ?',
          [permisos[0].id]
        );
        
        resultados.push({
          agente_id,
          modelo_id,
          accion: 'actualizado',
          id: permisos[0].id
        });
      } else {
        // Crear nuevo permiso
        const [result] = await conn.execute(
          'INSERT INTO cliente_permisos (usuario_id, agente_id, modelo_id, habilitado) ' +
          'VALUES (?, ?, ?, TRUE)',
          [usuario_id, agente_id, modelo_id]
        );
        
        resultados.push({
          agente_id,
          modelo_id,
          accion: 'creado',
          id: result.insertId
        });
      }
    }
    
    await conn.commit();
    
    res.status(201).json({
      message: 'Permisos de cliente creados/actualizados correctamente',
      usuario_id,
      resultados
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error creando permisos de cliente:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
});

// DELETE /admin/workflow/cliente-permisos - Deshabilitar permisos para un cliente
router.delete('/workflow/cliente-permisos', authenticate, isAdmin, async (req, res) => {
  const { usuario_id, conexiones } = req.body;
  
  if (!usuario_id || !conexiones || !Array.isArray(conexiones)) {
    return res.status(400).json({ message: 'Datos incompletos. Se requiere usuario_id y array de conexiones' });
  }
  
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    const resultados = [];
    
    // Deshabilitar permisos para cada conexión
    for (const conexion of conexiones) {
      const { agente_id, modelo_id } = conexion;
      
      if (!agente_id || !modelo_id) {
        continue; // Saltar conexiones incompletas
      }
      
      // Actualizar el permiso a deshabilitado
      const [result] = await conn.execute(
        'UPDATE cliente_permisos SET habilitado = FALSE ' +
        'WHERE usuario_id = ? AND agente_id = ? AND modelo_id = ?',
        [usuario_id, agente_id, modelo_id]
      );
      
      resultados.push({
        agente_id,
        modelo_id,
        afectados: result.affectedRows
      });
    }
    
    await conn.commit();
    
    res.json({
      message: 'Permisos de cliente deshabilitados correctamente',
      usuario_id,
      resultados
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error deshabilitando permisos de cliente:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
});

// POST /admin/workflow/sync - Sincronizar estado visual con permisos
router.post('/workflow/sync', authenticate, isAdmin, async (req, res) => {
  const { conexiones, usuario_id } = req.body;
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // 1. Limpiar todas las conexiones existentes
    // (Opcional: podrías mantener las existentes si hay alguna razón para ello)
    await conn.execute('DELETE FROM pattern_models');
    await conn.execute('DELETE FROM prompt_patterns');
    
    // 2. Crear nuevas conexiones según el estado visual
    const resultados = [];
    
    for (const conexion of conexiones) {
      const { agente_id, tipo_seguridad_id, modelo_id, prompt_pattern } = conexion;
      
      // Crear patrón
      const [resultPattern] = await conn.execute(
        'INSERT INTO prompt_patterns (agente_id, tipo_seguridad_id, prompt_pattern, descripcion) VALUES (?, ?, ?, ?)',
        [agente_id, tipo_seguridad_id, prompt_pattern || '.*', `Conexión creada desde el flujo de trabajo`]
      );
      
      const patternId = resultPattern.insertId;
      
      // Crear conexión con modelo
      await conn.execute(
        'INSERT INTO pattern_models (pattern_id, modelo_id) VALUES (?, ?)',
        [patternId, modelo_id]
      );
      
      resultados.push({ agente_id, tipo_seguridad_id, modelo_id, pattern_id: patternId });
    }
    
    // 3. Actualizar permisos de cliente si se especificó un usuario
    if (usuario_id) {
      // Primero desactivar todos los permisos del usuario
      await conn.execute(
        'UPDATE cliente_permisos SET habilitado = FALSE WHERE usuario_id = ?',
        [usuario_id]
      );
      
      // Luego activar solo los correspondientes a las conexiones actuales
      for (const conexion of conexiones) {
        const { agente_id, modelo_id } = conexion;
        
        // Verificar si ya existe el permiso
        const [permisos] = await conn.execute(
          'SELECT id FROM cliente_permisos WHERE usuario_id = ? AND agente_id = ? AND modelo_id = ?',
          [usuario_id, agente_id, modelo_id]
        );
        
        if (permisos.length > 0) {
          // Activar permiso existente
          await conn.execute(
            'UPDATE cliente_permisos SET habilitado = TRUE WHERE id = ?',
            [permisos[0].id]
          );
        } else {
          // Crear nuevo permiso
          await conn.execute(
            'INSERT INTO cliente_permisos (usuario_id, agente_id, modelo_id, habilitado) VALUES (?, ?, ?, TRUE)',
            [usuario_id, agente_id, modelo_id]
          );
        }
      }
    }
    
    await conn.commit();
    
    res.json({
      message: 'Estado visual sincronizado correctamente con permisos',
      conexiones_creadas: resultados.length,
      resultados
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error sincronizando estado:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
});

module.exports = router;