// admin/usage.js
const db = require('../db/connection');

/**
 * Registra el uso de un modelo y actualiza el crédito disponible
 */
async function registerUsage(apiKeyId, agenteId, modeloId, tokensEntrada, tokensSalida) {
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // Obtener precios del modelo
    const [modelos] = await conn.execute(
      'SELECT precio_input, precio_output FROM modelos WHERE id = ?',
      [modeloId]
    );
    
    if (modelos.length === 0) {
      throw new Error(`Modelo con ID ${modeloId} no encontrado`);
    }
    
    const modelo = modelos[0];
    
    // Calcular costos
    const costoEntrada = tokensEntrada * modelo.precio_input;
    const costoSalida = tokensSalida * modelo.precio_output;
    const costoTotal = costoEntrada + costoSalida;
    
    // Registrar en costos_uso
    await conn.execute(
      'INSERT INTO costos_uso (api_key_id, agente_id, modelo_id, tokens_entrada, tokens_salida, ' +
      'costo_entrada, costo_salida, costo_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [apiKeyId, agenteId, modeloId, tokensEntrada, tokensSalida, costoEntrada, costoSalida, costoTotal]
    );
    
    // Actualizar crédito disponible
    await conn.execute(
      'UPDATE api_keys SET credito_disponible = credito_disponible - ? WHERE id = ?',
      [costoTotal, apiKeyId]
    );
    
    // Verificar si el crédito está bajo un umbral (por ejemplo, 10%)
    const [apiKeys] = await conn.execute(
      'SELECT credito_disponible, usuario_id FROM api_keys WHERE id = ?',
      [apiKeyId]
    );
    
    if (apiKeys.length === 0) {
      throw new Error(`API key con ID ${apiKeyId} no encontrada`);
    }
    
    const creditoActual = apiKeys[0].credito_disponible;
    const usuarioId = apiKeys[0].usuario_id;
    
    // Si crédito es menor a 5.0, registrar notificación
    if (creditoActual < 5.0) {
      // Verificar si ya existe una notificación no enviada
      const [notificaciones] = await conn.execute(
        'SELECT id FROM notificaciones_credito WHERE api_key_id = ? AND notificado = FALSE',
        [apiKeyId]
      );
      
      if (notificaciones.length === 0) {
        // Crear nueva notificación
        await conn.execute(
          'INSERT INTO notificaciones_credito (usuario_id, api_key_id, umbral_alcanzado) ' +
          'VALUES (?, ?, ?)',
          [usuarioId, apiKeyId, creditoActual]
        );
      }
    }
    
    await conn.commit();
    
    return {
      costoEntrada,
      costoSalida,
      costoTotal,
      creditoRestante: creditoActual
    };
  } catch (error) {
    await conn.rollback();
    console.error('Error registrando uso:', error);
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Obtiene estadísticas de uso agrupadas
 */
async function getUsageStats(filtros = {}) {
  try {
    let query = `
      SELECT 
        DATE(cu.timestamp) AS fecha,
        SUM(cu.tokens_entrada) AS total_tokens_entrada,
        SUM(cu.tokens_salida) AS total_tokens_salida,
        SUM(cu.costo_total) AS total_costo
      FROM costos_uso cu
    `;
    
    const condiciones = [];
    const params = [];
    
    if (filtros.desde) {
      condiciones.push('cu.timestamp >= ?');
      params.push(filtros.desde);
    }
    
    if (filtros.hasta) {
      condiciones.push('cu.timestamp <= ?');
      params.push(filtros.hasta);
    }
    
    if (filtros.usuarioId) {
      query += ' JOIN api_keys ak ON cu.api_key_id = ak.id';
      condiciones.push('ak.usuario_id = ?');
      params.push(filtros.usuarioId);
    }
    
    if (filtros.agenteId) {
      condiciones.push('cu.agente_id = ?');
      params.push(filtros.agenteId);
    }
    
    if (filtros.modeloId) {
      condiciones.push('cu.modelo_id = ?');
      params.push(filtros.modeloId);
    }
    
    // Añadir condiciones a la query
    if (condiciones.length > 0) {
      query += ' WHERE ' + condiciones.join(' AND ');
    }
    
    // Agrupar por fecha
    query += ' GROUP BY DATE(cu.timestamp) ORDER BY fecha DESC';
    
    const [stats] = await db.execute(query, params);
    
    return stats;
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    throw error;
  }
}

module.exports = { 
  registerUsage,
  getUsageStats
};