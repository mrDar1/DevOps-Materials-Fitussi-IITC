const express = require('express');
const config = require('./src/config');
const logger = require('./src/middleware/logger');

const app = express();

app.use(express.json());
app.use(logger);

app.use('/', require('./src/routes/index'));
app.use('/health', require('./src/routes/health'));
app.use('/users', require('./src/routes/users'));

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(config.port, () => {
  console.log(`[${config.env}] ${config.appName} v${config.version} running on port ${config.port}`);
});
