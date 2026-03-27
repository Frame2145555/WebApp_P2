const mysql = require("mysql2");

const con = mysql.createConnection({
    host: 'localhost', // check the port!
    user: 'root', // in reality, never use root!
    password: '', // check the password!
    database: 'web_test_p2'
});

module.exports = con;