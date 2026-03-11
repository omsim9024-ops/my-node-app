const mysql = require('mysql2/promise');
require('dotenv').config();

// Connect to MySQL server (no default database) and ensure the target DB exists
async function setupDatabase() {
    let conn;
    try {
        console.log('Checking if database exists (MySQL)...');
        conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        const dbName = process.env.DB_NAME || 'ratings';
        const safeName = dbName.replace(/`/g, '');
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${safeName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log(`✓ Database ensured: ${safeName}`);

        await conn.end();
        console.log('\nDatabase setup complete!');
        process.exit(0);
    } catch (err) {
        console.error('Error setting up MySQL database:', err.message || err);
        try { if (conn) await conn.end(); } catch(e){}
        process.exit(1);
    }
}

setupDatabase();

