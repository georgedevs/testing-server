import session from 'express-session';
import connectRedis from 'connect-redis';
import { redis } from './redis';
import { v4 as uuidv4 } from 'uuid';

// Create Redis store
const RedisStore = connectRedis(session);

// Create store instance
const redisStore = new RedisStore({
  client: redis,
  prefix: 'sess:'
});

export const sessionConfig = {
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'fallback_secret_do_not_use_in_production',
  resave: false,
  saveUninitialized: false,
  store: redisStore,
  genid: (req: any) => uuidv4(),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
};