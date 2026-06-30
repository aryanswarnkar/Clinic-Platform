// src/server.js – Application entry point
require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { connectRedis } = require('./config/redis');
const { startScheduledJobs } = require('./jobs/scheduler');

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  try {
    // Connect Redis (used by Bull queues)
    await connectRedis();
    logger.info('Redis connected');

    // Start cron jobs (reminders, cleanup)
    startScheduledJobs();
    logger.info('Scheduled jobs started');

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error('Bootstrap failed', err);
    process.exit(1);
  }
}

bootstrap();
