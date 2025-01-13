"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidTokenFormat = exports.verifySessionIntegrity = exports.clearSecureCookies = exports.setSecureCookies = void 0;
const crypto_1 = __importDefault(require("crypto"));
const NOISE_COOKIE_COUNT = 5; // Number of noise cookies to generate
const NOISE_PREFIXES = ['SEC_', 'AUTH_', 'SES_', 'TKN_', 'KEY_'];
const TOKEN_LENGTH = 192; // Length of noise tokens
// Generate a random token that looks similar to JWT
const generateNoiseCookie = () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const randomBytes = crypto_1.default.randomBytes(TOKEN_LENGTH);
    const payload = randomBytes.toString('base64').replace(/=/g, '');
    const signature = crypto_1.default.randomBytes(32).toString('base64').replace(/=/g, '');
    return `${header}.${payload}.${signature}`;
};
// Generate a random cookie name with prefix
const generateNoiseCookieName = (index) => {
    const prefix = NOISE_PREFIXES[index % NOISE_PREFIXES.length];
    const randomString = crypto_1.default.randomBytes(8).toString('hex').toUpperCase();
    return `${prefix}${randomString}`;
};
// Set noise cookies with varying expiration times
const setNoiseCookies = (res, baseOptions) => {
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
const setSecureCookies = (res, accessToken, refreshToken, accessTokenOptions, refreshTokenOptions) => {
    // Set actual authentication cookies
    res.cookie('access_token', accessToken, accessTokenOptions);
    res.cookie('refresh_token', refreshToken, refreshTokenOptions);
    // Set access token noise cookies
    setNoiseCookies(res, accessTokenOptions);
    // Set refresh token noise cookies
    setNoiseCookies(res, refreshTokenOptions);
    // Set additional session integrity cookie
    const sessionIntegrity = crypto_1.default.randomBytes(32).toString('hex');
    res.cookie('session_integrity', sessionIntegrity, {
        ...accessTokenOptions,
        maxAge: Math.min(accessTokenOptions.maxAge, refreshTokenOptions.maxAge)
    });
};
exports.setSecureCookies = setSecureCookies;
// Clear all security cookies
const clearSecureCookies = (res) => {
    // Clear actual tokens
    res.cookie('access_token', '', { maxAge: 1 });
    res.cookie('refresh_token', '', { maxAge: 1 });
    res.cookie('session_integrity', '', { maxAge: 1 });
    // Clear potential noise cookies
    NOISE_PREFIXES.forEach(prefix => {
        for (let i = 0; i < 10; i++) {
            const possibleName = `${prefix}${crypto_1.default.randomBytes(8).toString('hex').toUpperCase()}`;
            res.cookie(possibleName, '', { maxAge: 1 });
        }
    });
};
exports.clearSecureCookies = clearSecureCookies;
// Verify session integrity
const verifySessionIntegrity = (cookies) => {
    return !!(cookies.access_token && cookies.refresh_token && cookies.session_integrity);
};
exports.verifySessionIntegrity = verifySessionIntegrity;
// Validate token format without verifying signature
const isValidTokenFormat = (token) => {
    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => {
        try {
            return Buffer.from(part, 'base64').length > 0;
        }
        catch {
            return false;
        }
    });
};
exports.isValidTokenFormat = isValidTokenFormat;
