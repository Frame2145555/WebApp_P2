//

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: 'localhost', // check the port!
    user: 'root', // in reality, never use root!
    password: '', // check the password!
    database: 'vote_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;