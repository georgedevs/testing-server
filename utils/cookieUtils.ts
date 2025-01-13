import { Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface ICookieOptions {
    expires: Date;
    maxAge: number;
    httpOnly: boolean;
    sameSite: 'lax' | 'strict' | 'none' | undefined;
    secure?: boolean;
}

const NOISE_COOKIE_COUNT = 5; // Number of noise cookies to generate
const NOISE_PREFIXES = ['SEC_', 'AUTH_', 'SES_', 'TKN_', 'KEY_'];
const TOKEN_LENGTH = 192; // Length of noise tokens

// Generate a random token that looks similar to JWT
const generateNoiseCookie = (): string => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const randomBytes = crypto.randomBytes(TOKEN_LENGTH);
    const payload = randomBytes.toString('base64').replace(/=/g, '');
    const signature = crypto.randomBytes(32).toString('base64').replace(/=/g, '');
    
    return `${header}.${payload}.${signature}`;
};

// Generate a random cookie name with prefix
const generateNoiseCookieName = (index: number): string => {
    const prefix = NOISE_PREFIXES[index % NOISE_PREFIXES.length];
    const randomString = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `${prefix}${randomString}`;
};

// Set noise cookies with varying expiration times
const setNoiseCookies = (res: Response, baseOptions: ICookieOptions) => {
    for (let i = 0; i < NOISE_COOKIE_COUNT; i++) {
        const cookieName = generateNoiseCookieName(i);
        const noiseToken = generateNoiseCookie();
        
        // Vary expiration times slightly around the base maxAge
        const variance = Math.floor(Math.random() * 3600000); // ±1 hour
        const adjustedMaxAge = baseOptions.maxAge + variance;
        
        res.cookie(cookieName, noiseToken, {
            ...baseOptions,
            maxAge: adjustedMaxAge,
        });
    }
};

// Enhanced cookie setter that includes noise cookies
export const setSecureCookies = (
    res: Response,
    accessToken: string,
    refreshToken: string,
    accessTokenOptions: ICookieOptions,
    refreshTokenOptions: ICookieOptions
) => {
    // Set actual authentication cookies
    res.cookie('access_token', accessToken, accessTokenOptions);
    res.cookie('refresh_token', refreshToken, refreshTokenOptions);
    
    // Set access token noise cookies
    setNoiseCookies(res, accessTokenOptions);
    
    // Set refresh token noise cookies
    setNoiseCookies(res, refreshTokenOptions);
    
    // Set additional session integrity cookie
    const sessionIntegrity = crypto.randomBytes(32).toString('hex');
    res.cookie('session_integrity', sessionIntegrity, {
        ...accessTokenOptions,
        maxAge: Math.min(accessTokenOptions.maxAge, refreshTokenOptions.maxAge)
    });
};

// Clear all security cookies
export const clearSecureCookies = (res: Response) => {
    // Clear actual tokens
    res.cookie('access_token', '', { maxAge: 1 });
    res.cookie('refresh_token', '', { maxAge: 1 });
    res.cookie('session_integrity', '', { maxAge: 1 });
    
    // Clear potential noise cookies
    NOISE_PREFIXES.forEach(prefix => {
        for (let i = 0; i < 10; i++) {
            const possibleName = `${prefix}${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
            res.cookie(possibleName, '', { maxAge: 1 });
        }
    });
};

// Verify session integrity
export const verifySessionIntegrity = (cookies: { [key: string]: string }): boolean => {
    return !!(cookies.access_token && cookies.refresh_token && cookies.session_integrity);
};

// Validate token format without verifying signature
export const isValidTokenFormat = (token: string): boolean => {
    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => {
        try {
            return Buffer.from(part, 'base64').length > 0;
        } catch {
            return false;
        }
    });
};