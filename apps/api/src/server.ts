import 'dotenv/config';

import { createApp } from './app.js';
import { parseEnv } from './config/env.js';

const env = parseEnv(process.env);
const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}, shutting down`);
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
