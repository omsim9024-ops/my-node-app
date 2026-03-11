const mysql = require('mysql2/promise');
require('dotenv').config();

const controlPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ratings',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

controlPool.on('error', err => {
    console.error('Unexpected error on idle control DB client', err);
});

module.exports = controlPool;


