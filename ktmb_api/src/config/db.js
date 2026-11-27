const { Pool } = require('pg');
require('dotenv').config();

const host = process.env.DB_HOST || 'localhost';
// A host starting with "/" is a Unix socket (e.g. /cloudsql/project:region:instance
// from Cloud Run's Cloud SQL connector). The socket is already encrypted and
// authenticated by the connector and does not accept SSL negotiation.
const isUnixSocket = host.startsWith('/');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host,
    database: process.env.DB_NAME || 'ktmbdb',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    ssl: isUnixSocket ? false : {
        rejectUnauthorized: false
    }
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
