const mysql = require('mysql2');

const connection = mysql.createConnection ({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'AppMessage',
    port: 3306
});

const pool = mysql.createPool ({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'AppMessage',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool.promise();