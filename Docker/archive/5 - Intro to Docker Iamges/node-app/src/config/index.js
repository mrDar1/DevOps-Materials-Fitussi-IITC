module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.APP_ENV || 'development',
  appName: process.env.APP_NAME || 'docker-node-app',
  version: process.env.APP_VERSION || '1.0.0',
};
