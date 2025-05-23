// db/connection.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool de conexiones
const pool = mysql.createPool({
  host: process.env.DB_HOST || '141.227.128.125',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'gateway_user',
  password: process.env.DB_PASSWORD || 'gateway_password',
  database: process.env.DB_NAME || 'complete_gateway',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Función para verificar la conexión al iniciar
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Conexión a base de datos establecida con éxito.');
    connection.release();
  } catch (error) {
    console.error('Error conectando a la base de datos:', error);
  }
}

testConnection();

module.exports = pool;