const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'publictransportdb',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkSchema() {
    try {
        console.log(`Connecting to ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME} as ${process.env.DB_USER}`);

        // Check which schema the table belongs to
        const tables = await pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'routes'");
        console.log("Tables found:");
        tables.rows.forEach(t => console.log(`- Schema: ${t.table_schema}, Table: ${t.table_name}`));

        const result = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'routes'");
        console.log("Columns in 'routes' table (Node.js):");
        result.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type})`);
        });
    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}

checkSchema();
