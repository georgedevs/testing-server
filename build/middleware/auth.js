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
const userController_1 = require("../controllers/userController");
const mongoose_1 = require("mongoose");
const getRedisKey = (userId) => {
    return `user_${userId.toString()}`;
};
exports.isAuthenticated = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const access_token = req.cookies.access_token;
        if (!access_token) {
            return next(new errorHandler_1.default("Please login to access this resource", 401));
        }
        const decoded = jsonwebtoken_1.default.verify(access_token, process.env.ACCESS_TOKEN_SECRET);
        if (!decoded || !decoded.id) {
            return next(new errorHandler_1.default("Access token is not valid", 401));
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
        // Convert session data to IUser format
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
            // Try to refresh the token
            try {
                await (0, userController_1.updateAccessToken)(req, res, next);
            }
            catch (refreshError) {
                return next(new errorHandler_1.default("Session expired. Please login again", 401));
            }
        }
        else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return next(new errorHandler_1.default("Invalid access token", 401));
        }
        else {
            return next(new errorHandler_1.default(`Authentication failed: ${error.message}`, 401));
        }
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
