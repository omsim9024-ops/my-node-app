const pool = require('../db');

/**
 * Migration script to create registration_codes table
 * This enables the invite-code system for teacher registration
 */

const migrationSQL = `
-- Create registration_codes table if it doesn't exist
CREATE TABLE IF NOT EXISTS registration_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'used', 'revoked', 'expired')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    used_at TIMESTAMP,
    used_by INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (used_by) REFERENCES teachers(id) ON DELETE SET NULL
);

-- Create index on code for fast lookups
CREATE INDEX IF NOT EXISTS idx_registration_codes_code ON registration_codes(code);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_registration_codes_status ON registration_codes(status);

-- Create index on used_at for finding available codes
CREATE INDEX IF NOT EXISTS idx_registration_codes_used ON registration_codes(used_at);

-- Create index on expires_at for cleaning up expired codes
CREATE INDEX IF NOT EXISTS idx_registration_codes_expires ON registration_codes(expires_at);
`;

async function runMigration() {
    try {
        console.log('Starting migration: creating registration_codes table...');
        
        const result = await pool.query(migrationSQL);
        
        console.log('✓ Migration completed successfully');
        console.log('✓ Registration codes table is ready');
        
        process.exit(0);
    } catch (err) {
        console.error('✗ Migration failed:', err.message);
        process.exit(1);
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    runMigration();
}

module.exports = { migrationSQL, runMigration };

