const { Pool } = require('pg');
require('dotenv').config();

// First, connect to default 'postgres' database to create our database
const adminPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: 'postgres',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function setupDatabase() {
    try {
        console.log('Checking if database exists...');
        
        // Check if database exists
        const checkDb = await adminPool.query(
            "SELECT datname FROM pg_catalog.pg_database WHERE datname = $1",
            [process.env.DB_NAME]
        );

        if (checkDb.rows.length === 0) {
            console.log(`Creating database: ${process.env.DB_NAME}...`);
            // Quote identifier safely to allow hyphens or unusual characters in DB name
            const safeName = String(process.env.DB_NAME).replace(/"/g, '""');
            await adminPool.query(`CREATE DATABASE "${safeName}"`);
            console.log('✓ Database created successfully');
        } else {
            console.log('✓ Database already exists');
        }

        await adminPool.end();
        console.log('\nDatabase setup complete!');
        process.exit(0);
    } catch (err) {
        console.error('Error setting up database:', err.message);
        process.exit(1);
    }
}

setupDatabase();

