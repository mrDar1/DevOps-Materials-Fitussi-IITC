const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const { createClient } = require("redis");

let redisClient;
async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({
      url: `redis://${process.env.REDIS_HOST || "localhost"}:6379`,
    });
    redisClient.on("error", (err) =>
      console.warn("Redis error (non-fatal):", err.message)
    );
    await redisClient.connect().catch(() => {
      console.warn("⚠️  Redis unavailable – running without cache");
      redisClient = null;
    });
  }
  return redisClient;
}

router.get("/", async (req, res) => {
  const redis = await getRedis();
  const CACHE_KEY = "products:all";
  const CACHE_TTL = 60;
  try {
    if (redis) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        console.log("🔵 Cache HIT");
        return res.json({ source: "cache", data: JSON.parse(cached) });
      }
      console.log("🟡 Cache MISS");
    }
    const { rows } = await pool.query("SELECT * FROM products ORDER BY id");
    if (redis) await redis.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(rows));
    res.json({ source: "db", data: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

router.patch("/:id/stock", async (req, res) => {
  const { delta } = req.body;
  if (typeof delta !== "number") return res.status(400).json({ error: "delta must be a number" });
  try {
    const { rows } = await pool.query(
      `UPDATE products SET stock = GREATEST(0, stock + $1) WHERE id = $2 RETURNING *`,
      [delta, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    const redis = await getRedis();
    if (redis) await redis.del("products:all");
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update stock" });
  }
});

module.exports = router;
