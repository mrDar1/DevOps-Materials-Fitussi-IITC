const router = require('express').Router();
const config = require('../config');

router.get('/', (req, res) => {
  res.json({
    app: config.appName,
    version: config.version,
    env: config.env,
    routes: [
      'GET /',
      'GET /health',
      'GET /users',
      'GET /users/:id',
    ],
  });
});

module.exports = router;
