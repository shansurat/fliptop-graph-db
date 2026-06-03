import { Redis } from '@upstash/redis';

// Only initialize if environment variables are present, this allows local dev to fallback gracefully
export const redis = 
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;
