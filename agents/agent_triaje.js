// agents/agent_triaje.js - Agente para gestionar el triage médico on-demand
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Configuración por defecto del triage
const DEFAULT_CONFIG = {
  port: 5000,
  domain: 'localhost',
  botName: process.env.BOT_NAME || 'ar1-healthcare-w1qo2sx',
  webchatSecret: process.env.WEBCHAT_SECRET || '2eJ3rs4zIPXLkcIBlgaeIQ2is5qA2BB6F6j0fL4hZEO23U5ZFdQeJQQJ99BEACL93NaAArohAAABAZBS34Lr.3GoytqJ5hsYCdLLgYilznvqK2HHm9V45u1PtMgoAr9LZBzVSMerEJQQJ99BEACL93NaAArohAAABAZBS2Vky'
};

// Estado del servicio de triage
let triageProcess = null;
let triageConfig = { ...DEFAULT_CONFIG };
let sessionCounter = 0;
let sessionData = {};
let triageStartTime = null;

// Descripción del agente
const description = 'Agente de triage médico on-demand que permite evaluar síntomas iniciales';

// Indica que este agente tiene interfaz web
const hasInterface = true;

// Función de configuración del agente
function setup(gateway) {
  console.log('Configurando agente de triage...');
  // Cualquier configuración inicial puede ir aquí
  
  // Cargar configuración desde archivo si existe
  const configPath = path.join(process.cwd(), 'agents', 'triage_config.json');
  if (fs.existsSync(configPath)) {
    try {
      const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      triageConfig = { ...DEFAULT_CONFIG, ...savedConfig };
      console.log('Configuración de triage cargada:', triageConfig);
    } catch (error) {
      console.error('Error cargando configuración de triage:', error);
    }
  }
}

// Guardar la configuración en un archivo
function saveConfig() {
  const configPath = path.join(process.cwd(), 'agents', 'triage_config.json');
  try {
    fs.writeFileSync(configPath, JSON.stringify(triageConfig, null, 2), 'utf8');
    console.log('Configuración de triage guardada');
    return true;
  } catch (error) {
    console.error('Error guardando configuración de triage:', error);
    return false;
  }
}

// Iniciar el servicio de triage
async function startTriageService() {
  if (triageProcess) {
    console.log('El servicio de triage ya está en ejecución');
    return {
      success: true,
      message: 'El servicio de triage ya está en ejecución',
      url: getTriageUrl()
    };
  }
  
  try {
    // Ruta al script standalone
    const triagePath = path.join(process.cwd(), 'triage-standalone.js');
    
    // Verificar que existe el script
    if (!fs.existsSync(triagePath)) {
      throw new Error(`Script de triage no encontrado: ${triagePath}`);
    }
    
    // Variables de entorno para el proceso
    const env = {
      ...process.env,
      PORT: triageConfig.port,
      BOT_NAME: triageConfig.botName,
      WEBCHAT_SECRET: triageConfig.webchatSecret
    };
    
    // Iniciar el proceso
    console.log(`Iniciando servicio de triage en puerto ${triageConfig.port}...`);
    triageProcess = spawn('node', [triagePath], { 
      env: env,
      detached: false
    });
    
    // Gestionar salida del proceso
    triageProcess.stdout.on('data', (data) => {
      console.log(`[Triage] ${data}`);
    });
    
    triageProcess.stderr.on('data', (data) => {
      console.error(`[Triage Error] ${data}`);
    });
    
    // Gestionar cierre del proceso
    triageProcess.on('close', (code) => {
      console.log(`Proceso de triage finalizado con código ${code}`);
      triageProcess = null;
      triageStartTime = null;
    });
    
    // Guardar tiempo de inicio
    triageStartTime = Date.now();
    
    // Esperar un momento para que el servicio se inicie
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Servicio de triage iniciado correctamente');
    
    return {
      success: true,
      message: 'Servicio de triage iniciado correctamente',
      url: getTriageUrl()
    };
  } catch (error) {
    console.error('Error iniciando servicio de triage:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Detener el servicio de triage
function stopTriageService() {
  if (!triageProcess) {
    console.log('El servicio de triage no está en ejecución');
    return {
      success: true,
      message: 'El servicio de triage no está en ejecución'
    };
  }
  
  try {
    // Detener el proceso
    triageProcess.kill();
    
    // También matar el proceso en el puerto para asegurarnos
    exec(`fuser -k ${triageConfig.port}/tcp`, (error) => {
      if (error) {
        console.log('No se pudo matar el proceso del puerto, probablemente ya estaba cerrado');
      }
    });
    
    console.log('Servicio de triage detenido correctamente');
    
    // Limpiar variables
    triageProcess = null;
    triageStartTime = null;
    
    return {
      success: true,
      message: 'Servicio de triage detenido correctamente'
    };
  } catch (error) {
    console.error('Error deteniendo servicio de triage:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Obtener URL del servicio de triage
function getTriageUrl() {
  const protocol = triageConfig.domain === 'localhost' ? 'http' : 'https';
  const port = triageConfig.port !== 80 && triageConfig.port !== 443 ? `:${triageConfig.port}` : '';
  return `${protocol}://${triageConfig.domain}${port}`;
}

// Verificar si el servicio de triage está en ejecución
function isTriageRunning() {
  return triageProcess !== null;
}

// Obtener tiempo de ejecución del servicio de triage
function getTriageUptime() {
  if (!triageStartTime) return 0;
  return Math.floor((Date.now() - triageStartTime) / 1000);
}

// Registrar sesión de triage
function registerTriageSession(userId) {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  sessionData[sessionId] = {
    userId: userId,
    startTime: Date.now(),
    active: true
  };
  
  sessionCounter++;
  
  return {
    sessionId: sessionId,
    url: getTriageUrl()
  };
}

// Finalizar sesión de triage
function endTriageSession(sessionId) {
  if (sessionData[sessionId]) {
    sessionData[sessionId].active = false;
    sessionData[sessionId].endTime = Date.now();
    
    return {
      success: true,
      sessionId: sessionId
    };
  }
  
  return {
    success: false,
    error: 'Sesión no encontrada'
  };
}

// Obtener información del servicio de triage
function getTriageInfo() {
  // Contar sesiones activas
  const activeSessions = Object.values(sessionData).filter(session => session.active).length;
  
  return {
    triageAppRunning: isTriageRunning(),
    triageAppUrl: getTriageUrl(),
    activeSessions: activeSessions,
    sessionCount: sessionCounter,
    uptime: getTriageUptime(),
    config: {
      port: triageConfig.port,
      domain: triageConfig.domain,
      botName: triageConfig.botName,
      // No incluir webchatSecret por seguridad
    }
  };
}

// Actualizar configuración del servicio de triage
function updateTriageConfig(newConfig) {
  // Guardar configuración anterior
  const previousConfig = { ...triageConfig };
  
  // Actualizar configuración
  triageConfig = {
    ...triageConfig,
    ...newConfig
  };
  
  // Guardar nueva configuración
  saveConfig();
  
  // Si ha cambiado el puerto o el dominio y el servicio está en ejecución, reiniciarlo
  if (triageProcess && (
    previousConfig.port !== triageConfig.port ||
    previousConfig.botName !== triageConfig.botName || 
    previousConfig.webchatSecret !== triageConfig.webchatSecret
  )) {
    console.log('Configuración cambió, reiniciando servicio de triage...');
    stopTriageService();
    setTimeout(() => {
      startTriageService();
    }, 1000);
  }
  
  return {
    success: true,
    message: 'Configuración de triage actualizada',
    config: {
      port: triageConfig.port,
      domain: triageConfig.domain,
      botName: triageConfig.botName
      // No incluir webchatSecret por seguridad
    }
  };
}

// Función para procesar mensajes de consulta médica
async function processMedicalQuery(message, options = {}) {
  // Obtener opciones
  const userId = options.userId || 'anonymous';
  
  try {
    // Verificar si el servicio de triage está en ejecución
    if (!isTriageRunning()) {
      // Intentar iniciar el servicio
      console.log('Servicio de triage no está ejecutándose, iniciándolo...');
      await startTriageService();
      
      // Si aun así no funciona, devolver error
      if (!isTriageRunning()) {
        throw new Error('No se pudo iniciar el servicio de triage');
      }
    }
    
    // Registrar nueva sesión
    const session = registerTriageSession(userId);
    
    // Devolver respuesta con redirección
    return {
      answer: `Para realizar una evaluación de tus síntomas, te redirigiremos a nuestro sistema de triage. Por favor, haz clic en el enlace para continuar: ${session.url}`,
      redirectUrl: session.url,
      sessionId: session.sessionId
    };
  } catch (error) {
    console.error('Error procesando consulta médica:', error);
    return {
      answer: "Lo siento, en este momento no podemos procesar tu consulta médica. Por favor, intenta más tarde o contacta directamente con un profesional de la salud si es urgente.",
      error: error.message
    };
  }
}

// Registrar endpoints para el agente
function registerEndpoints(router, gateway) {
  // Endpoint para procesar mensajes
  router.post('/api/message', async (req, res) => {
    try {
      const { message, userId, temperature } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Se requiere un mensaje' });
      }
      
      // Procesar mensaje
      const response = await processMedicalQuery(message, {
        userId: userId || 'anonymous',
        temperature: temperature || 0.3
      });
      
      return res.json(response);
    } catch (error) {
      console.error('Error procesando mensaje de triage:', error);
      return res.status(500).json({ 
        error: 'Error procesando mensaje',
        details: error.message
      });
    }
  });
  
  // Endpoint para obtener información del servicio
  router.get('/api/info', (req, res) => {
    try {
      const info = getTriageInfo();
      return res.json(info);
    } catch (error) {
      console.error('Error obteniendo información del triage:', error);
      return res.status(500).json({ 
        error: 'Error obteniendo información',
        details: error.message
      });
    }
  });
  
  // Endpoint para iniciar el servicio
  router.post('/api/start', async (req, res) => {
    try {
      const result = await startTriageService();
      return res.json(result);
    } catch (error) {
      console.error('Error iniciando servicio de triage:', error);
      return res.status(500).json({ 
        error: 'Error iniciando servicio',
        details: error.message
      });
    }
  });
  
  // Endpoint para detener el servicio
  router.post('/api/stop', (req, res) => {
    try {
      const result = stopTriageService();
      return res.json(result);
    } catch (error) {
      console.error('Error deteniendo servicio de triage:', error);
      return res.status(500).json({ 
        error: 'Error deteniendo servicio',
        details: error.message
      });
    }
  });
  
  // Endpoint para actualizar configuración
  router.post('/api/config', (req, res) => {
    try {
      const { port, domain, botName, webchatSecret } = req.body;
      
      const newConfig = {};
      if (port) newConfig.port = parseInt(port);
      if (domain) newConfig.domain = domain;
      if (botName) newConfig.botName = botName;
      if (webchatSecret) newConfig.webchatSecret = webchatSecret;
      
      const result = updateTriageConfig(newConfig);
      return res.json(result);
    } catch (error) {
      console.error('Error actualizando configuración:', error);
      return res.status(500).json({ 
        error: 'Error actualizando configuración',
        details: error.message
      });
    }
  });
  
  // Endpoint para finalizar sesión
  router.post('/api/session/end', (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Se requiere sessionId' });
      }
      
      const result = endTriageSession(sessionId);
      return res.json(result);
    } catch (error) {
      console.error('Error finalizando sesión:', error);
      return res.status(500).json({ 
        error: 'Error finalizando sesión',
        details: error.message
      });
    }
  });
  
  // Interfaz web simple (en caso de acceder a /agents/triage directamente)
  router.get('/', (req, res) => {
    const info = getTriageInfo();
    
    // HTML para la página principal
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Triage Médico On-Demand</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f5f5f5;
            }
            
            .container {
                max-width: 800px;
                margin: 0 auto;
                background-color: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            
            h1 {
                color: #0078d4;
                margin-top: 0;
            }
            
            .status {
                margin: 20px 0;
                padding: 15px;
                border-radius: 5px;
                background-color: #f0f0f0;
            }
            
            .status.running {
                background-color: #e6ffed;
                border-left: 4px solid #28a745;
            }
            
            .status.stopped {
                background-color: #fff5f5;
                border-left: 4px solid #dc3545;
            }
            
            .actions {
                margin: 20px 0;
            }
            
            .button {
                display: inline-block;
                padding: 10px 15px;
                background-color: #0078d4;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 10px;
                text-decoration: none;
            }
            
            .button.stop {
                background-color: #dc3545;
            }
            
            .button:hover {
                opacity: 0.9;
            }
            
            .config {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
            }
            
            .config form {
                margin-top: 15px;
            }
            
            .form-group {
                margin-bottom: 15px;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
            }
            
            .form-group input {
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Triage Médico On-Demand</h1>
            
            <div class="status ${info.triageAppRunning ? 'running' : 'stopped'}">
                <h3>Estado del Servicio</h3>
                <p><strong>Estado:</strong> ${info.triageAppRunning ? 'En ejecución' : 'Detenido'}</p>
                ${info.triageAppRunning ? `
                <p><strong>URL:</strong> <a href="${info.triageAppUrl}" target="_blank">${info.triageAppUrl}</a></p>
                <p><strong>Sesiones activas:</strong> ${info.activeSessions}</p>
                <p><strong>Total de sesiones:</strong> ${info.sessionCount}</p>
                <p><strong>Tiempo activo:</strong> ${Math.floor(info.uptime / 60)} minutos ${info.uptime % 60} segundos</p>
                ` : ''}
            </div>
            
            <div class="actions">
                ${info.triageAppRunning ? 
                  `<button class="button stop" onclick="stopService()">Detener Servicio</button>` : 
                  `<button class="button" onclick="startService()">Iniciar Servicio</button>`}
            </div>
            
            <div class="config">
                <h3>Configuración del Servicio</h3>
                
                <form id="config-form">
                    <div class="form-group">
                        <label for="port">Puerto:</label>
                        <input type="number" id="port" name="port" value="${info.config.port}" min="1" max="65535" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="domain">Dominio:</label>
                        <input type="text" id="domain" name="domain" value="${info.config.domain}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="botName">Nombre del Bot:</label>
                        <input type="text" id="botName" name="botName" value="${info.config.botName}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="webchatSecret">Secret (dejar en blanco para mantener el actual):</label>
                        <input type="password" id="webchatSecret" name="webchatSecret" placeholder="Introducir nuevo secret...">
                    </div>
                    
                    <button type="submit" class="button">Guardar Configuración</button>
                </form>
            </div>
        </div>
        
        <script>
            function startService() {
                fetch('/agents/triage/api/start', {
                    method: 'POST',
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Servicio iniciado correctamente');
                        window.location.reload();
                    } else {
                        alert('Error iniciando servicio: ' + (data.error || 'Error desconocido'));
                    }
                })
                .catch(error => {
                    alert('Error: ' + error.message);
                });
            }
            
            function stopService() {
                fetch('/agents/triage/api/stop', {
                    method: 'POST',
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Servicio detenido correctamente');
                        window.location.reload();
                    } else {
                        alert('Error deteniendo servicio: ' + (data.error || 'Error desconocido'));
                    }
                })
                .catch(error => {
                    alert('Error: ' + error.message);
                });
            }
            
            document.getElementById('config-form').addEventListener('submit', function(event) {
                event.preventDefault();
                
                const formData = new FormData(this);
                const config = {
                    port: parseInt(formData.get('port')),
                    domain: formData.get('domain'),
                    botName: formData.get('botName')
                };
                
                // Incluir webchatSecret solo si se proporcionó uno nuevo
                const secret = formData.get('webchatSecret');
                if (secret) {
                    config.webchatSecret = secret;
                }
                
                fetch('/agents/triage/api/config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(config)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Configuración actualizada correctamente');
                        window.location.reload();
                    } else {
                        alert('Error actualizando configuración: ' + (data.error || 'Error desconocido'));
                    }
                })
                .catch(error => {
                    alert('Error: ' + error.message);
                });
            });
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
  });
}

// Exportar el agente
module.exports = {
  setup,
  registerEndpoints,
  description,
  hasInterface,
  processMedicalQuery,
  startTriageService,
  stopTriageService,
  getTriageInfo,
  updateTriageConfig
};