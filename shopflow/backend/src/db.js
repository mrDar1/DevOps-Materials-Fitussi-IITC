const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "shopflow",
  user: process.env.DB_USER || "shopuser",
  password: process.env.DB_PASSWORD || "shoppass",
});

async function connectWithRetry(retries = 10, delay = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const client = await pool.connect();
      console.log("✅ Connected to PostgreSQL");
      client.release();
      return;
    } catch (err) {
      console.log(`⏳ DB not ready, retry ${i}/${retries}...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error("❌ Could not connect to PostgreSQL after retries");
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  const { rowCount } = await pool.query("SELECT 1 FROM products LIMIT 1");
  if (rowCount === 0) {
    await pool.query(`
      INSERT INTO products (name, price, stock) VALUES
        ('Laptop Pro 15"',   1299.99, 42),
        ('Wireless Mouse',      29.99, 150),
        ('USB-C Hub 7-in-1',    49.99, 88),
        ('Mechanical Keyboard', 89.99, 60),
        ('4K Monitor 27"',     399.99, 25);
    `);
    console.log("🌱 Seeded products table");
  }
}

module.exports = { pool, connectWithRetry, initDB };
