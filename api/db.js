// Conexion compartida a la base de la plataforma (PostgreSQL).
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'plataforma',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = pool;
