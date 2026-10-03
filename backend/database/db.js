const mysql = require('mysql2/promise');

module.exports = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dental_clinic',
  dateStrings: true,     // dates come back as 'YYYY-MM-DD' strings (no timezone surprises)
  decimalNumbers: true,  // DECIMAL columns come back as numbers
  waitForConnections: true,
  connectionLimit: 10,
});
