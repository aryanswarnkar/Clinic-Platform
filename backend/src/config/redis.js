// src/config/redis.js – Redis/IORedis client supporting Upstash TLS
const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient;

function getRedisConfig() {
  const url = process.env.REDIS_URL;
  if (url) {
    // Upstash uses rediss:// (TLS). IORedis needs tls option for that.
    if (url.startsWith('rediss://')) {
      return {
        connectionString: url,
        tls: { rejectUnauthorized: false },
      };
    }
    return url;
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

async function connectRedis() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  // Build IORedis options for Upstash TLS
  const options = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  };

  if (url.startsWith('rediss://')) {
    options.tls = { rejectUnauthorized: false };
  }

  redisClient = new Redis(url, options);

  return new Promise((resolve) => {
    redisClient.on('ready', () => {
      logger.info('Redis connected');
      resolve(redisClient);
    });
    redisClient.on('error', (err) => {
      logger.error('Redis connection error (non-fatal, queues will be degraded)', err.message);
      resolve(redisClient); // Don't crash – app still works without queues
    });
    // Resolve after 3s even if not connected (for startup resilience)
    setTimeout(() => resolve(redisClient), 3000);
  });
}

function getRedisClient() {
  return redisClient;
}

// Returns config object for Bull queues
function getRedisConfig() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  if (url.startsWith('rediss://')) {
    return { url, tls: { rejectUnauthorized: false } };
  }
  return { url };
}

module.exports = { connectRedis, getRedisClient, getRedisConfig };
