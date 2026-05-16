import 'dotenv/config';

const required = (key: string, fallback?: string): string => {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing env var: ${key}`);
  return v;
};

const nodeEnv = required('NODE_ENV', 'DEV').toUpperCase();

const mongoUser = required('MONGO_USER', 'admin');
const mongoPass = required('MONGO_PASS', 'secret');
const mongoHost = required('MONGO_HOST', 'localhost:27017');
const mongoDb = required('MONGO_DB', 'express-app');

// Build the connection URI dynamically from the parts
const mongoUri = `mongodb+srv://${encodeURIComponent(mongoUser)}:${encodeURIComponent(
  mongoPass,
)}@${mongoHost}/${mongoDb}?appName=Cluster0`;

export const config = {
  nodeEnv, // 'DEV' or 'TEST'
  port: Number(required('PORT', '3000')),
  logLevel: 'info',
  corsOrigin: '*',
  mongo: {
    user: mongoUser,
    host: mongoHost,
    db: mongoDb,
    uri: mongoUri,
  },
  isDev: nodeEnv === 'DEV',
  isTest: nodeEnv === 'TEST',
};
