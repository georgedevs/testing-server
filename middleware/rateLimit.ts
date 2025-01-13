import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import ErrorHandler from '../utils/errorHandler';

// Rate limiter for registration
export const registrationLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 3, // Max 3 accounts per IP per day
    message: 'Too many accounts created from this IP, please try again after 24 hours',
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter for login attempts
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Max 5 login attempts per IP per 15 minutes
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
});
