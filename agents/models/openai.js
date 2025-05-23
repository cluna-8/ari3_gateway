// models/openai.js - Cliente para OpenAI que carga configuración de models/config.yml
const { OpenAI } = require('openai');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

class OpenAIClient {
  constructor(modelName) {
    // Cargar configuración desde config.yml
    this.config = this.loadConfig(modelName);
    
    if (!this.config) {
      throw new Error(`No se encontró configuración para el modelo ${modelName} en models/config.yml o no es un modelo de OpenAI`);
    }
    
    // Inicializar cliente de OpenAI
    this.client = new OpenAI({ 
      apiKey: this.config.api_key 
    });
    
    this.modelName = modelName;
  }
  
  // Cargar configuración desde config.yml
  loadConfig(modelName) {
    try {
      const configPath = path.join(__dirname, 'config.yml');
      const configFile = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(configFile);
      
      // Verificar si existe el modelo y es de OpenAI
      if (config.models[modelName] && config.models[modelName].provider === 'openai') {
        return config.models[modelName];
      }
      
      // Si se pide un modelo general de OpenAI, buscar el primero disponible
      if (modelName === 'openai') {
        for (const [name, model] of Object.entries(config.models)) {
          if (model.provider === 'openai') {
            console.log(`Usando modelo OpenAI por defecto: ${name}`);
            return { ...model, name };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error cargando configuración:', error);
      return null;
    }
  }
  
  // Enviar consulta a OpenAI
  async sendQuery(message, options = {}) {
    const model = this.modelName;
    const systemPrompt = options.systemPrompt || "Eres un asistente útil y preciso.";
    const temperature = options.temperature || this.config.temperature || 0.7;
    const maxTokens = options.maxTokens || 800;
    
    try {
      // Preparar mensajes
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ];
      
      // Hacer la llamada a la API
      const response = await this.client.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });
      
      // Extraer respuesta
      const completion = response.choices[0].message.content;
      
      // Calcular costos según la configuración
      const inputTokens = response.usage.prompt_tokens;
      const outputTokens = response.usage.completion_tokens;
      const inputCost = inputTokens * this.config.pricing.input;
      const outputCost = outputTokens * this.config.pricing.output;
      
      return {
        message: completion,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: response.usage.total_tokens,
          input_cost: inputCost.toFixed(6),
          output_cost: outputCost.toFixed(6),
          total_cost: (inputCost + outputCost).toFixed(6)
        },
        model: model
      };
    } catch (error) {
      console.error('Error al enviar consulta a OpenAI:', error);
      throw error;
    }
  }
}

module.exports = OpenAIClient;