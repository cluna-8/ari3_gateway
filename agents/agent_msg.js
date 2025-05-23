// agent_msg.js - Módulo para enviar mensajes a diferentes proveedores de IA
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const AzureOpenAIClient = require('./models/azure-openai');
const OpenAIClient = require('./models/openai');

// Clase principal para gestionar mensajes de agentes
class AgentMessage {
  constructor() {
    this.config = this.loadConfig();
    this.clients = {}; // Cache de clientes para evitar crear múltiples instancias
  }
  
  // Cargar configuración desde models/config.yml
  loadConfig() {
    try {
      const configPath = path.join(__dirname, 'models', 'config.yml');
      const configFile = fs.readFileSync(configPath, 'utf8');
      return yaml.load(configFile);
    } catch (error) {
      console.error('Error cargando configuración:', error);
      return { models: {}, agents: {} };
    }
  }
  
  // Obtener cliente según el proveedor y modelo
  getClient(modelName) {
    // Verificar si ya existe el cliente en caché
    if (this.clients[modelName]) {
      return this.clients[modelName];
    }
    
    // Si no existe, crear nuevo cliente
    try {
      // Determinar el proveedor
      const provider = this.config.models[modelName]?.provider;
      
      if (!provider) {
        throw new Error(`No se encontró configuración para el modelo ${modelName}`);
      }
      
      // Crear cliente según el proveedor
      let client;
      if (provider === 'azure') {
        client = new AzureOpenAIClient(modelName);
      } else if (provider === 'openai') {
        client = new OpenAIClient(modelName);
      } else {
        throw new Error(`Proveedor no soportado: ${provider}`);
      }
      
      // Guardar en caché
      this.clients[modelName] = client;
      return client;
    } catch (error) {
      console.error(`Error al crear cliente para ${modelName}:`, error);
      throw error;
    }
  }
  
  // Enviar consulta a un modelo específico
  async sendMessage(message, options = {}) {
    // Determinar el modelo a usar
    let modelName = options.model;
    let systemPrompt = options.systemPrompt;
    let temperature = options.temperature;
    
    // Si se especificó un agente, obtener su configuración
    if (options.agent && this.config.agents[options.agent]) {
      const agentConfig = this.config.agents[options.agent];
      modelName = modelName || agentConfig.model;
      systemPrompt = systemPrompt || agentConfig.system_prompt;
      temperature = temperature || agentConfig.temperature;
    }
    
    // Usar modelo por defecto si no se especificó
    modelName = modelName || this.config.default_model;
    
    // Obtener cliente para el modelo
    const client = this.getClient(modelName);
    
    // Enviar consulta
    const result = await client.sendQuery(message, {
      systemPrompt: systemPrompt,
      temperature: temperature,
      maxTokens: options.maxTokens
    });
    
    // Agregar información adicional de seguimiento
    return {
      ...result,
      timestamp: new Date().toISOString(),
      agent: options.agent,
      userId: options.userId || 'anonymous'
    };
  }
  
  // Obtener lista de modelos disponibles
  getAvailableModels() {
    return Object.keys(this.config.models);
  }
  
  // Obtener lista de agentes disponibles
  getAvailableAgents() {
    return Object.keys(this.config.agents);
  }
}

module.exports = AgentMessage;

// Ejemplo de uso:
/*
const agent = new AgentMessage();

async function test() {
  try {
    // Ejemplo usando un modelo específico
    const openaiResult = await agent.sendMessage("¿Qué es la inteligencia artificial?", {
      model: "gpt-4o-mini"
    });
    console.log("Respuesta OpenAI:", openaiResult.message);
    
    // Ejemplo usando un agente configurado
    const agentResult = await agent.sendMessage("Explica cómo funciona un motor de combustión", {
      agent: "chat-technical-azure"
    });
    console.log("Respuesta Agente:", agentResult.message);
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
*/