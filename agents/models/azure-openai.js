// models/azure-openai.js - Cliente para Azure OpenAI que carga configuración de models/config.yml
const { OpenAI } = require('openai');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

class AzureOpenAIClient {
  constructor(modelName) {
    // Cargar configuración desde config.yml
    this.config = this.loadConfig(modelName);
    
    if (!this.config) {
      throw new Error(`No se encontró configuración para el modelo ${modelName} en models/config.yml o no es un modelo de Azure`);
    }
    
    // Inicializar cliente de OpenAI para Azure
    this.client = new OpenAI({
      apiKey: this.config.api_key,
      baseURL: `${this.config.endpoint}openai/deployments/${this.config.deployment_id}`,
      defaultQuery: { 'api-version': this.config.api_version },
      defaultHeaders: { 'api-key': this.config.api_key }
    });
    
    this.modelName = modelName;
  }
  
  // Cargar configuración desde config.yml
  loadConfig(modelName) {
    try {
      const configPath = path.join(__dirname, 'config.yml');
      const configFile = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(configFile);
      
      // Verificar si existe el modelo y es de Azure
      if (config.models[modelName] && config.models[modelName].provider === 'azure') {
        return config.models[modelName];
      }
      
      // Si se pide un modelo general de Azure, buscar el primero disponible
      if (modelName === 'azure') {
        for (const [name, model] of Object.entries(config.models)) {
          if (model.provider === 'azure') {
            console.log(`Usando modelo Azure por defecto: ${name}`);
            return model;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error cargando configuración:', error);
      return null;
    }
  }
  
  // Formatear mensajes para Azure OpenAI
  formatMessages(messages) {
    return messages.map(message => {
      // Si ya tiene el formato correcto, devolverlo tal cual
      if (message.content && Array.isArray(message.content) && 
          message.content.length > 0 && message.content[0].type === 'text') {
        return message;
      }
      
      // Convertir al formato de Azure
      return {
        role: message.role,
        content: [
          {
            type: "text",
            text: typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
          }
        ]
      };
    });
  }
  
  // Enviar consulta a Azure OpenAI
  async sendQuery(message, options = {}) {
    const systemPrompt = options.systemPrompt || "Eres un asistente útil y preciso.";
    const temperature = options.temperature || this.config.temperature || 0.7;
    const maxTokens = options.maxTokens || 800;
    
    try {
      // Preparar mensajes
      let messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ];
      
      // Formatear mensajes para Azure
      messages = this.formatMessages(messages);
      
      // Hacer la llamada a la API
      const response = await this.client.chat.completions.create({
        model: this.config.deployment_id,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });
      
      // Extraer la respuesta
      let completion;
      const assistantMessage = response.choices[0].message;
      
      // Puede ser un string o un array con formato
      if (typeof assistantMessage.content === 'string') {
        completion = assistantMessage.content;
      } else if (Array.isArray(assistantMessage.content)) {
        // Extraer texto de cada parte de content
        completion = assistantMessage.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join(' ');
      } else {
        completion = JSON.stringify(assistantMessage.content);
      }
      
      // Calcular costos según la configuración
      const inputTokens = response.usage.prompt_tokens || 0;
      const outputTokens = response.usage.completion_tokens || 0;
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
        model: this.config.deployment_id
      };
    } catch (error) {
      console.error('Error al enviar consulta a Azure OpenAI:', error);
      throw error;
    }
  }
}

module.exports = AzureOpenAIClient;