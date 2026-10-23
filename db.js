const { Pool, types } = require('pg');
require('dotenv').config();

types.setTypeParser(1082, (val) => val);


types.setTypeParser(20, (val) => parseInt(val, 10));   
types.setTypeParser(1700, (val) => parseFloat(val));   


const connectionString = process.env.DATABASE_URL;


const useSsl =
  process.env.DB_SSL !== undefined
    ? process.env.DB_SSL === 'true'
    : !!connectionString && !/localhost|127\.0\.0\.1|@dpg-[^.]+(\/|$)/.test(connectionString);

const pool = new Pool(
  connectionString
    ? { connectionString, ssl: useSsl ? { rejectUnauthorized: false } : false, max: 10 }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'inventory_db',
        max: 10
      }
);

pool.on('error', (err) => console.error('Unexpected idle DB client error', err));

module.exports = pool;


module.exports.initSchema = async () => {
  const fs = require('fs');
  const path = require('path');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Database schema ready');
};
