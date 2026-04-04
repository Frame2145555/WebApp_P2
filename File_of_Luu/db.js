const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ quiet: true });

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'vote_system',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  enableKeepAlive: true
};

const pool = mysql.createPool(dbConfig);

async function verifyDatabaseConnection() {
  const connection = await pool.getConnection();

  try {
    await connection.ping();
    console.log(`✅ Connected to MySQL: ${dbConfig.database} is ready on ${dbConfig.host}:${dbConfig.port}`);
  } finally {
    connection.release();
  }
}

async function query(sql, params = []) {
  return pool.execute(sql, params);
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  verifyDatabaseConnection,
  closePool,
  dbConfig
};

if (require.main === module) {
  verifyDatabaseConnection()
    .catch((error) => {
      console.log('❌ DATABASE CONNECTION ERROR:');
      console.error('Error Name:', error.code || error.name);
      console.error('Message:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePool();
    });
}
