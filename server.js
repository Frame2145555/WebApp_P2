const { startServer } = require('./index');
const { closePool } = require('./db');

if (require.main === module) {
  startServer().catch(async (error) => {
    console.error('Unable to start server:', error.message);
    await closePool();
    process.exit(1);
  });
}

module.exports = {
  startServer
};
