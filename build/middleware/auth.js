"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOwnerOrAdmin = exports.isCounselor = exports.isAdmin = exports.authorizeRoles = exports.isAuthenticated = void 0;
require('dotenv').config();
const catchAsyncErrors_1 = require("./catchAsyncErrors");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_1 = require("../utils/redis");
const mongoose_1 = require("mongoose");
const getRedisKey = (userId) => {
    return `user_${userId.toString()}`;
};
exports.isAuthenticated = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        const accessToken = authHeader?.startsWith('Bearer ')
            ? authHeader.substring(7)
            : null;
        if (!accessToken) {
            return next(new errorHandler_1.default("Please login to access this resource", 401));
        }
        // Verify access token
        const decoded = jsonwebtoken_1.default.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
        if (!decoded || !decoded.id) {
            return next(new errorHandler_1.default("Invalid access token", 401));
        }
        // Get user from Redis using consistent key format
        const redisKey = getRedisKey(decoded.id);
        const userSession = await redis_1.redis.get(redisKey);
        if (!userSession) {
            return next(new errorHandler_1.default("Please login to access this resource", 401));
        }
        const userData = JSON.parse(userSession);
        // Ensure the user data has required fields
        if (!userData.user_id || !userData.role || !userData.email) {
            return next(new errorHandler_1.default("Invalid session data", 401));
        }
        // Set user data in request
        req.user = {
            _id: new mongoose_1.Types.ObjectId(userData.user_id),
            role: userData.role,
            email: userData.email,
            lastActive: new Date(),
            isVerified: true,
            isActive: true
        };
        // Update last active in Redis
        userData.lastActive = new Date();
        await redis_1.redis.set(redisKey, JSON.stringify(userData));
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return next(new errorHandler_1.default("Access token expired", 401));
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return next(new errorHandler_1.default("Invalid access token", 401));
        }
        return next(new errorHandler_1.default(`Authentication failed: ${error.message}`, 401));
    }
});
// Role authorization middleware
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new errorHandler_1.default(`Role (${req.user?.role}) is not allowed to access this resource`, 403));
        }
        next();
    };
};
exports.authorizeRoles = authorizeRoles;
// Admin check middleware
exports.isAdmin = (0, exports.authorizeRoles)("admin");
// Counselor check middleware
exports.isCounselor = (0, exports.authorizeRoles)("counselor");
// Resource ownership verification
exports.isOwnerOrAdmin = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    const resourceId = req.params.id;
    if (!req.user) {
        return next(new errorHandler_1.default("Authentication required", 401));
    }
    if (req.user.role === "admin") {
        return next();
    }
    if (req.user._id.toString() !== resourceId) {
        return next(new errorHandler_1.default("You are not authorized to access this resource", 403));
    }
    next();
});
