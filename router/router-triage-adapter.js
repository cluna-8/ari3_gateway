// router/router-triage-adapter.js - Adaptador para integrar el agente de triage con el sistema actual
const fs = require('fs');
const path = require('path');

// Variable para almacenar el módulo de triage
let triageAgent = null;

// Función para cargar el módulo de triage bajo demanda
function loadTriageModule() {
  if (triageAgent) return triageAgent;
  
  try {
    // Verificar primero si el archivo existe
    const triagePath = path.join(__dirname, '..', 'agents', 'agent_triaje.js');
    if (!fs.existsSync(triagePath)) {
      console.warn(`Archivo agent_triaje.js no encontrado en ${triagePath}`);
      return null;
    }
    
    // Intentar cargar el módulo
    triageAgent = require('../agents/agent_triaje');
    console.log('Módulo de triage cargado correctamente');
    return triageAgent;
  } catch (error) {
    console.error('Error cargando módulo de triage:', error);
    return null;
  }
}

// Objeto con funciones mock para cuando el agente no está disponible
const mockTriageAgent = {
  startTriageService: async () => ({ 
    success: false, 
    message: 'Módulo de triage no disponible',
    error: 'Módulo no cargado'
  }),
  stopTriageService: () => ({ 
    success: false, 
    message: 'Módulo de triage no disponible',
    error: 'Módulo no cargado'
  }),
  getTriageInfo: () => ({ 
    triageAppRunning: false,
    error: 'Módulo de triage no disponible'
  }),
  processMedicalQuery: async () => ({
    answer: 'Lo siento, el servicio de triage no está disponible en este momento.',
    error: 'Módulo de triage no disponible'
  }),
  updateTriageConfig: () => ({
    success: false,
    message: 'No se pudo actualizar la configuración',
    error: 'Módulo de triage no disponible'
  })
};

// Función para procesar solicitudes de triage
async function processTriageRequest(req, res) {
  try {
    // Intentar cargar el módulo de triage
    const agent = loadTriageModule() || mockTriageAgent;

    // Extraer información de la solicitud
    const { metadata, action = 'info', prompt } = req.body;
    const userId = req.apiKey?.userId || 'anonymous';

    console.log(`Procesando solicitud de triage: ${action}`);

    // Procesar según la acción solicitada
    switch (action.toLowerCase()) {
      case 'start':
        // Iniciar el servicio de triage
        const startResult = await agent.startTriageService();
        return res.json({
          status: startResult.success ? 'success' : 'error',
          message: startResult.message || startResult.error,
          url: startResult.url,
          running: startResult.success
        });

      case 'stop':
        // Detener el servicio de triage
        const stopResult = await agent.stopTriageService();
        return res.json({
          status: stopResult.success ? 'success' : 'error',
          message: stopResult.message || stopResult.error,
          running: false
        });

      case 'info':
        // Obtener información del servicio
        const info = agent.getTriageInfo();
        return res.json({
          status: info.error ? 'error' : 'success',
          ...info
        });

      case 'query':
        // Procesar consulta médica
        if (!prompt) {
          return res.status(400).json({
            status: 'error',
            message: 'Se requiere un prompt para procesar consulta médica'
          });
        }

        const queryResult = await agent.processMedicalQuery(prompt, { userId });
        return res.json({
          status: queryResult.error ? 'error' : 'success',
          message: queryResult.answer,
          redirectUrl: queryResult.redirectUrl,
          sessionId: queryResult.sessionId,
          error: queryResult.error
        });

      case 'config':
        // Actualizar configuración
        const { port, domain, botName, webchatSecret } = req.body.config || {};
        
        const newConfig = {};
        if (port) newConfig.port = parseInt(port);
        if (domain) newConfig.domain = domain;
        if (botName) newConfig.botName = botName;
        if (webchatSecret) newConfig.webchatSecret = webchatSecret;
        
        const configResult = agent.updateTriageConfig(newConfig);
        return res.json({
          status: configResult.success ? 'success' : 'error',
          message: configResult.message || configResult.error,
          config: configResult.config
        });

      default:
        return res.status(400).json({
          status: 'error',
          message: `Acción desconocida: ${action}`
        });
    }
  } catch (error) {
    console.error('Error procesando solicitud de triage:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

module.exports = {
  processTriageRequest
};