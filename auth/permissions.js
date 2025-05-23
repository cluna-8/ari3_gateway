// auth/permissions.js
const db = require('../db/connection');

/**
 * Buscar patrones de prompts para un agente y tipo de seguridad
 */
async function getPromptPatterns(agenteId, tipoSeguridadId) {
  try {
    // Obtener patrones
    const [patterns] = await db.execute(
      'SELECT pp.id, pp.prompt_pattern, pp.descripcion ' +
      'FROM prompt_patterns pp ' +
      'WHERE pp.agente_id = ? AND pp.tipo_seguridad_id = ? AND pp.activo = TRUE',
      [agenteId, tipoSeguridadId]
    );
    
    // Para cada patrón, obtener modelos permitidos
    const result = [];
    for (const pattern of patterns) {
      const [models] = await db.execute(
        'SELECT m.id, m.nombre ' +
        'FROM pattern_models pm ' +
        'JOIN modelos m ON pm.modelo_id = m.id ' +
        'WHERE pm.pattern_id = ? AND m.activo = TRUE',
        [pattern.id]
      );
      
      result.push({
        ...pattern,
        allowed_models: models.map(m => ({ id: m.id, nombre: m.nombre }))
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error obteniendo patrones de prompt:', error);
    return [];
  }
}

/**
 * Validar si un prompt puede usarse con un modelo específico
 */
async function validatePromptForModel(agenteId, tipoSeguridadId, prompt, modeloId) {
  try {
    // Obtener patrones
    const patterns = await getPromptPatterns(agenteId, tipoSeguridadId);
    
    // Si no hay patrones, permitir por defecto
    if (patterns.length === 0) {
      return { valid: true };
    }
    
    // Buscar patrón que coincida con el prompt
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.prompt_pattern);
      
      if (regex.test(prompt)) {
        // Verificar si el modelo está permitido para este patrón
        const modeloPermitido = pattern.allowed_models.some(m => m.id === modeloId);
        
        if (modeloPermitido) {
          return { valid: true };
        } else {
          // Si el modelo no está permitido, sugerir modelos permitidos
          return {
            valid: false,
            message: `El modelo seleccionado no está permitido para este tipo de prompt. Modelos permitidos: ${pattern.allowed_models.map(m => m.nombre).join(', ')}`,
            suggestedModels: pattern.allowed_models
          };
        }
      }
    }
    
    // Si no coincide con ningún patrón, permitir por defecto
    return { valid: true };
  } catch (error) {
    console.error('Error validando prompt:', error);
    return { valid: true };
  }
}

/**
 * Middleware para verificar si el usuario tiene acceso al modelo y agente solicitados
 * y además validar que el prompt pueda usarse con el modelo seleccionado
 */
async function verifyModelAccess(req, res, next) {
  const { agente, type, model } = req.body.metadata || {};
  const prompt = req.body.prompt;
  const action = req.body.action; // Para el agente de triaje
  
  if (!agente || !model) {
    return res.status(400).json({ message: 'Metadatos incompletos. Se requiere agente y modelo.' });
  }
  
  try {
    // Buscar IDs de agente y modelo
    const [agentes] = await db.execute(
      'SELECT id FROM agentes WHERE nombre = ? AND activo = TRUE',
      [agente]
    );
    
    const [modelos] = await db.execute(
      'SELECT id FROM modelos WHERE nombre = ? AND activo = TRUE',
      [model]
    );
    
    // Determinar el tipo de seguridad
    const [tipoSeguridad] = await db.execute(
      'SELECT id FROM tipos_seguridad WHERE nombre = ?',
      [type === 'seguro' ? 'api_key' : 'oauth']
    );
    
    if (agentes.length === 0) {
      return res.status(404).json({ message: `Agente "${agente}" no encontrado o no activo` });
    }
    
    if (modelos.length === 0) {
      return res.status(404).json({ message: `Modelo "${model}" no encontrado o no activo` });
    }
    
    if (tipoSeguridad.length === 0) {
      return res.status(404).json({ message: `Tipo de seguridad no encontrado` });
    }
    
    const agenteId = agentes[0].id;
    const modeloId = modelos[0].id;
    const tipoSeguridadId = tipoSeguridad[0].id;
    
    // === VERIFICACIÓN 1: PERMISOS DE CLIENTE ===
    // Verificar permisos en la tabla cliente_permisos
    const [permisos] = await db.execute(
      'SELECT * FROM cliente_permisos WHERE usuario_id = ? AND agente_id = ? AND modelo_id = ? AND habilitado = TRUE',
      [req.apiKey.userId, agenteId, modeloId]
    );
    
    if (permisos.length === 0) {
      return res.status(403).json({ 
        message: `No tienes acceso al agente "${agente}" con modelo "${model}"` 
      });
    }
    
    // === VERIFICACIÓN 2: CONEXIÓN EN FLUJO DE TRABAJO ===
    // Verificar si existe la conexión en el flujo de trabajo visual
    const [conexiones] = await db.execute(
      'SELECT pp.id FROM prompt_patterns pp ' +
      'JOIN pattern_models pm ON pp.id = pm.pattern_id ' +
      'WHERE pp.agente_id = ? AND pp.tipo_seguridad_id = ? AND pm.modelo_id = ? AND pp.activo = TRUE',
      [agenteId, tipoSeguridadId, modeloId]
    );
    
    if (conexiones.length === 0) {
      return res.status(403).json({ 
        message: `La combinación de agente "${agente}" con modelo "${model}" no está configurada en el flujo de trabajo` 
      });
    }
    
    // Caso especial para agente_triaje
    if (agente === 'agente_triaje' && type !== 'seguro') {
      return res.status(400).json({
        message: `El agente de triage solo puede usarse en modo seguro`
      });
    }
    
    // === VERIFICACIÓN 3: VALIDACIÓN DE PATRONES DE PROMPT ===
    // Validar el prompt o action según patrones configurados
    if (prompt && agente !== 'agente_triaje') {
      // Obtener todos los patrones disponibles para esta combinación
      const [patterns] = await db.execute(
        'SELECT pp.id, pp.prompt_pattern ' +
        'FROM prompt_patterns pp ' +
        'JOIN pattern_models pm ON pp.id = pm.pattern_id ' +
        'WHERE pp.agente_id = ? AND pp.tipo_seguridad_id = ? AND pm.modelo_id = ? AND pp.activo = TRUE',
        [agenteId, tipoSeguridadId, modeloId]
      );
      
      let promptValido = false;
      
      // Verificar si el prompt coincide con alguno de los patrones
      for (const pattern of patterns) {
        try {
          const regex = new RegExp(pattern.prompt_pattern);
          if (regex.test(prompt)) {
            promptValido = true;
            break;
          }
        } catch (regexError) {
          console.error(`Error en patrón regex '${pattern.prompt_pattern}':`, regexError);
          // Si hay un error en la expresión regular, continuamos con el siguiente patrón
        }
      }
      
      if (!promptValido && patterns.length > 0) {
        return res.status(400).json({ 
          message: `El prompt no coincide con ningún patrón permitido para esta combinación de agente y modelo`,
          patron_requerido: patterns.map(p => p.prompt_pattern).join(' o ')
        });
      }
    } else if (agente === 'agente_triaje' && action === 'query' && prompt) {
      // Validación especial para triaje con action query
      const [patterns] = await db.execute(
        'SELECT pp.id, pp.prompt_pattern ' +
        'FROM prompt_patterns pp ' +
        'JOIN pattern_models pm ON pp.id = pm.pattern_id ' +
        'WHERE pp.agente_id = ? AND pp.tipo_seguridad_id = ? AND pm.modelo_id = ? AND pp.activo = TRUE',
        [agenteId, tipoSeguridadId, modeloId]
      );
      
      let promptValido = false;
      
      // Verificar si el prompt coincide con alguno de los patrones
      for (const pattern of patterns) {
        try {
          const regex = new RegExp(pattern.prompt_pattern);
          if (regex.test(prompt)) {
            promptValido = true;
            break;
          }
        } catch (regexError) {
          console.error(`Error en patrón regex '${pattern.prompt_pattern}':`, regexError);
        }
      }
      
      if (!promptValido && patterns.length > 0) {
        return res.status(400).json({ 
          message: `El prompt no coincide con ningún patrón permitido para el triage médico`,
          patron_requerido: patterns.map(p => p.prompt_pattern).join(' o ')
        });
      }
    }
    
    // Todas las verificaciones pasaron correctamente
    // Adjuntar IDs a la request para uso posterior
    req.agenteId = agenteId;
    req.modeloId = modeloId;
    req.tipoSeguridadId = tipoSeguridadId;
    
    next();
  } catch (error) {
    console.error('Error verificando permisos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}


/**
 * Middleware para verificar si el usuario es administrador
 */
async function isAdmin(req, res, next) {
  if (!req.apiKey && !req.user) {
    return res.status(401).json({ message: 'No autenticado' });
  }
  
  const userId = req.apiKey?.userId || req.user.id;
  
  try {
    const [users] = await db.execute(
      'SELECT role_id FROM usuarios WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    if (users[0].role_id !== 1) {
      return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador' });
    }
    
    next();
  } catch (error) {
    console.error('Error verificando rol de administrador:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = { 
  verifyModelAccess,
  isAdmin,
  getPromptPatterns,
  validatePromptForModel
};