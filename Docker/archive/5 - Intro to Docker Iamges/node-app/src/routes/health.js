const router = require('express').Router();
const config = require('../config');

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    env: config.env,
    version: config.version,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
