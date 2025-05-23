// triage-standalone.js - Aplicación independiente para conectar con Azure Health Bot
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Crear aplicación Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Obtener variables de entorno o valores por defecto
const WEBCHAT_SECRET = process.env.WEBCHAT_SECRET || '2eJ3rs4zIPXLkcIBlgaeIQ2is5qA2BB6F6j0fL4hZEO23U5ZFdQeJQQJ99BEACL93NaAArohAAABAZBS34Lr.3GoytqJ5hsYCdLLgYilznvqK2HHm9V45u1PtMgoAr9LZBzVSMerEJQQJ99BEACL93NaAArohAAABAZBS2Vky';
const BOT_NAME = process.env.BOT_NAME || 'ar1-healthcare-w1qo2sx';
const PORT = process.env.PORT || 5000;

// Endpoint para obtener el token DirectLine
app.get('/api/direct-token', async (req, res) => {
  try {
    // Generar un ID único para el usuario
    const userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Endpoint de DirectLine
    const tokenEndpoint = "https://directline.botframework.com/v3/directline/tokens/generate";
    
    // Datos para la solicitud
    const payload = {
      user: { id: userId }
    };
    
    console.log("Solicitando token DirectLine con secret:", WEBCHAT_SECRET.substring(0, 10) + "...");
    
    // Realizar la solicitud para obtener el token
    const response = await axios.post(tokenEndpoint, payload, {
      headers: {
        'Authorization': `Bearer ${WEBCHAT_SECRET}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log("Token obtenido con éxito");
    
    // Devolver el token al cliente
    return res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo token:", error.message);
    
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
    
    // Si falla, devolver un error
    return res.status(500).json({
      error: 'Error obteniendo token',
      message: error.message
    });
  }
});

// Servir la página principal
app.get('/', (req, res) => {
  try {
    // Ruta al archivo webchat_direct.html
    const filePath = path.join(__dirname, 'webchat_direct.html');
    
    // Verificar si existe el archivo
    if (fs.existsSync(filePath)) {
      // Leer el contenido del archivo
      let htmlContent = fs.readFileSync(filePath, 'utf8');
      
      // Reemplazar el nombre del bot
      htmlContent = htmlContent.replace('{{ bot_name }}', BOT_NAME);
      
      // Enviar la página con las variables reemplazadas
      res.send(htmlContent);
    } else {
      // Si no existe el archivo, enviar un error
      res.status(404).send(`Archivo no encontrado: ${filePath}`);
    }
  } catch (error) {
    console.error('Error sirviendo webchat_direct.html:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Aplicación de triage ejecutándose en http://localhost:${PORT}`);
  console.log(`Usando BOT_NAME: ${BOT_NAME}`);
  console.log(`WEBCHAT_SECRET: ${WEBCHAT_SECRET.substring(0, 10)}...`);
});
