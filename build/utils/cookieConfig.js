"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeviceCookieConfig = exports.getCookieConfig = void 0;
const getCookieConfig = (isDevelopment = false) => ({
    httpOnly: true,
    secure: true, // Always true in production
    sameSite: 'none',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {})
});
exports.getCookieConfig = getCookieConfig;
const getDeviceCookieConfig = (isDevelopment = false) => ({
    ...(0, exports.getCookieConfig)(isDevelopment),
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year for device ID
});
exports.getDeviceCookieConfig = getDeviceCookieConfig;
