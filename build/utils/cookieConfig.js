"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSecurityCookies = exports.cookieOptions = exports.COOKIE_NAMES = void 0;
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
// Cookie name generator
const generateCookieName = (baseName) => {
    const secret = process.env.COOKIE_NAME_SECRET || 'default-secret';
    return crypto_1.default
        .createHash('sha256')
        .update(baseName + secret)
        .digest('hex')
        .slice(0, 16);
};
// Cookie names (ensure these are consistent across frontend and backend)
exports.COOKIE_NAMES = {
    ACCESS_TOKEN: generateCookieName('access_token'),
    REFRESH_TOKEN: generateCookieName('refresh_token'),
    DEVICE_ID: generateCookieName('device_id'),
};
// Base cookie options
exports.cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Changed from 'strict' to 'lax' for better cross-site functionality
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
};
// Security cookie generator with consistent names
const setSecurityCookies = (res) => {
    const securityCookies = [
        {
            name: `sec_${generateCookieName('noise1')}`,
            value: crypto_1.default.randomBytes(32).toString('hex'),
            options: { ...exports.cookieOptions, maxAge: 86400000 } // 24 hours
        },
        {
            name: 'XSRF-TOKEN',
            value: (0, uuid_1.v4)(),
            options: { ...exports.cookieOptions, maxAge: 7200000 } // 2 hours
        },
        {
            name: '_Host-session',
            value: crypto_1.default.randomBytes(32).toString('hex'),
            options: { ...exports.cookieOptions, maxAge: 3600000 } // 1 hour
        },
        {
            name: '_Host-visitor',
            value: (0, uuid_1.v4)(),
            options: { ...exports.cookieOptions, maxAge: 86400000 * 30 } // 30 days
        },
        {
            name: '_Secure-theme',
            value: 'light',
            options: { ...exports.cookieOptions, maxAge: 86400000 * 365 } // 1 year
        },
        {
            name: '_Secure-prefs',
            value: crypto_1.default.randomBytes(16).toString('hex'),
            options: { ...exports.cookieOptions, maxAge: 86400000 * 7 } // 7 days
        }
    ];
    securityCookies.forEach(cookie => {
        res.cookie(cookie.name, cookie.value, cookie.options);
    });
};
exports.setSecurityCookies = setSecurityCookies;
