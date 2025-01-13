import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { CookieOptions } from 'express';

// Cookie name generator
const generateCookieName = (baseName: string): string => {
    const secret = process.env.COOKIE_NAME_SECRET || 'default-secret';
    return crypto
        .createHash('sha256')
        .update(baseName + secret)
        .digest('hex')
        .slice(0, 16);
};

// Cookie names (ensure these are consistent across frontend and backend)
export const COOKIE_NAMES = {
    ACCESS_TOKEN: generateCookieName('access_token'),
    REFRESH_TOKEN: generateCookieName('refresh_token'),
    DEVICE_ID: generateCookieName('device_id'),
};

// Base cookie options
export const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Changed from 'strict' to 'lax' for better cross-site functionality
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
};

// Security cookie generator with consistent names
export const setSecurityCookies = (res: any) => {
    const securityCookies = [
        { 
            name: `sec_${generateCookieName('noise1')}`, 
            value: crypto.randomBytes(32).toString('hex'),
            options: { ...cookieOptions, maxAge: 86400000 } // 24 hours
        },
        { 
            name: 'XSRF-TOKEN', 
            value: uuidv4(),
            options: { ...cookieOptions, maxAge: 7200000 } // 2 hours
        },
        { 
            name: '_Host-session', 
            value: crypto.randomBytes(32).toString('hex'),
            options: { ...cookieOptions, maxAge: 3600000 } // 1 hour
        },
        { 
            name: '_Host-visitor', 
            value: uuidv4(),
            options: { ...cookieOptions, maxAge: 86400000 * 30 } // 30 days
        },
        { 
            name: '_Secure-theme', 
            value: 'light',
            options: { ...cookieOptions, maxAge: 86400000 * 365 } // 1 year
        },
        { 
            name: '_Secure-prefs', 
            value: crypto.randomBytes(16).toString('hex'),
            options: { ...cookieOptions, maxAge: 86400000 * 7 } // 7 days
        }
    ];

    securityCookies.forEach(cookie => {
        res.cookie(cookie.name, cookie.value, cookie.options);
    });
};