// utils/cookieConfig.ts
interface CookieOptions {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'none' | 'lax' | 'strict';
    domain?: string;
    path: string;
    maxAge: number;
  }
  
  export const getCookieConfig = (isDevelopment: boolean = false): CookieOptions => ({
    httpOnly: true,
    secure: true, // Always true in production
    sameSite: 'none',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {})
  });
  
  export const getDeviceCookieConfig = (isDevelopment: boolean = false): CookieOptions => ({
    ...getCookieConfig(isDevelopment),
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year for device ID
  });