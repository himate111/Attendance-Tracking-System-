// ---------------- LOAD ENV ----------------
require('dotenv').config(); // Load .env variables

const mysql = require("mysql2");

// Use credentials from .env
const db = mysql.createConnection({
  host: process.env.DB_HOST,       // e.g., localhost
  user: process.env.DB_USER,       // e.g., root
  password: process.env.DB_PASS,   // e.g., Siva@mysql10#
  database: process.env.DB_NAME    // e.g., attendance_db
});

db.connect((err) => {
  if (err) {
    console.error("❌ DB connection error:", err.message);
    return;
  }
  console.log("✅ Connected to MySQL database");
});

module.exports = db;
