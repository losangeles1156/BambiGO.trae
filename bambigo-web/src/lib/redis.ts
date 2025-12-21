import { Redis } from '@upstash/redis'

const globalForRedis = global as unknown as { redis: Redis | null }

export const redis = globalForRedis.redis || (
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null
)

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

export default redis
