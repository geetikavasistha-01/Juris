import { buildServer } from './server.js';
import { config } from './config.js';
import { logger } from './logger.js';

const app = buildServer();

async function start() {
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    logger.info(
      `Juris API service started on http://0.0.0.0:${config.PORT} with role ${config.ROLE}`,
    );
  } catch (err) {
    logger.error({ err }, 'Failed to start Juris API server');
    process.exit(1);
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  start();
}

export { app };
