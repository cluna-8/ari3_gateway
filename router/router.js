// router/router.js
const express = require('express');
const { authenticateApiKey } = require('../auth/app');
const AgentMessage = require('../agents/agent_msg');
const { processTriageRequest } = require('./router-triage-adapter');
const { verifyModelAccess } = require('../auth/permissions');
const { registerUsage } = require('../admin/usage');
const db = require('../db/connection');

// Crear router de Express
const router = express.Router();

// Crear instancia del agente de mensajes
const agentMessage = new AgentMessage();

// Middleware para procesar y validar la metadata
function processMetadata(req, res, next) {
  // Verificar si se ha proporcionado la metadata
  if (!req.body.metadata) {
    req.body.metadata = {
      agente: "agente_msg",
      type: "seguro"
    };
  }
  
  // Si no hay modelo especificado, asignar uno por defecto según el tipo
  if (!req.body.metadata.model) {
    if (req.body.metadata.type === "seguro") {
      req.body.metadata.model = "gpt-4.1-mini";
    } else {
      req.body.metadata.model = "gpt-4o-mini";
    }
  }
  
  next();
}

// Ruta para procesar consultas
router.post('/query', 
  authenticateApiKey,      // Autenticar la API key
  processMetadata,         // Procesar y validar la metadata
  verifyModelAccess,       // Verificar permisos en la BD
  async (req, res) => {
    try {
      const { prompt, action } = req.body;
      const { agente, type, model } = req.body.metadata;
      
      // Caso especial para el agente de triage
      if (agente === "agente_triaje") {
        return processTriageRequest(req, res);
      }
      
      // Para otros agentes, verificar prompt
      if (!prompt) {
        return res.status(400).json({ message: 'Se requiere un prompt' });
      }
      
      console.log(`Procesando solicitud para agente '${agente}' usando modelo '${model}'`);
      
      // Obtener systemPrompt desde la base de datos si existe
      let systemPrompt = "Eres un asistente útil que responde preguntas de manera clara y concisa.";
      try {
        const [prompts] = await db.execute(`
          SELECT sp.prompt 
          FROM system_prompts sp
          JOIN agentes a ON sp.agente_id = a.id
          JOIN tipos_seguridad ts ON sp.tipo_seguridad_id = ts.id
          WHERE a.nombre = ? AND ts.nombre = ?
        `, [agente, type]);
        
        if (prompts.length > 0) {
          systemPrompt = prompts[0].prompt;
        }
      } catch (error) {
        console.warn('Error obteniendo system prompt desde BD:', error);
        // Continuar con el prompt por defecto
      }
      
      // Usar agentMessage para procesar la solicitud
      const response = await agentMessage.sendMessage(prompt, {
        model: model,
        systemPrompt: systemPrompt,
        temperature: req.body.temperature || 0.7,
        maxTokens: req.body.maxTokens || 800,
        userId: req.apiKey.userId
      });
      
      // Registrar uso en la base de datos
      await registerUsage(
        req.apiKey.keyId,
        req.agenteId,
        req.modeloId,
        response.usage.input_tokens,
        response.usage.output_tokens
      );
      
      // Añadir metadata explícita en el formato solicitado
      response.metadata = {
        agente: agente,
        type: type,
        model: model,
        prompt: prompt
      };
      
      res.json(response);
      
    } catch (error) {
      console.error('Error procesando la solicitud:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor', 
        error: error.message 
      });
    }
  }
);

// Ruta para obtener las opciones disponibles para el cliente
router.get('/options', authenticateApiKey, async (req, res) => {
  try {
    // Obtener nombre de usuario
    const [usuarios] = await db.execute(
      'SELECT username FROM usuarios WHERE id = ?',
      [req.apiKey.userId]
    );
    
    // Obtener agentes permitidos
    const [agentes] = await db.execute(
      'SELECT DISTINCT a.nombre FROM cliente_permisos cp ' +
      'JOIN agentes a ON cp.agente_id = a.id ' +
      'WHERE cp.usuario_id = ? AND cp.habilitado = TRUE AND a.activo = TRUE',
      [req.apiKey.userId]
    );
    
    // Obtener modelos permitidos
    const [modelos] = await db.execute(
      'SELECT m.nombre, m.proveedor, ts.nombre AS tipo_seguridad FROM cliente_permisos cp ' +
      'JOIN modelos m ON cp.modelo_id = m.id ' +
      'JOIN tipos_seguridad ts ON m.tipo_seguridad_id = ts.id ' +
      'WHERE cp.usuario_id = ? AND cp.habilitado = TRUE AND m.activo = TRUE',
      [req.apiKey.userId]
    );
    
    // Dividir modelos según tipo de seguridad
    const modelosSeguros = modelos
      .filter(m => m.tipo_seguridad === 'seguro' || m.proveedor === 'azure')
      .map(m => m.nombre);
      
    const modelosNoSeguros = modelos
      .filter(m => m.tipo_seguridad === 'no_seguro' || m.proveedor === 'openai')
      .map(m => m.nombre);
    
    // Determinar tipos disponibles
    const tiposDisponibles = [];
    if (modelosSeguros.length > 0) tiposDisponibles.push('seguro');
    if (modelosNoSeguros.length > 0) tiposDisponibles.push('no_seguro');
    
    res.json({
      clientName: usuarios[0].username,
      clientId: req.apiKey.userId,
      availableAgents: agentes.map(a => a.nombre),
      availableTypes: tiposDisponibles,
      availableModels: {
        seguro: modelosSeguros,
        no_seguro: modelosNoSeguros
      },
      credito_disponible: req.apiKey.credito
    });
  } catch (error) {
    console.error('Error obteniendo opciones:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;