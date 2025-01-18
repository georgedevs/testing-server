"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearTokens = exports.sendToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
const redis_1 = require("./redis");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Token generation functions
const generateAccessToken = (user) => {
    return jsonwebtoken_1.default.sign({
        id: user._id.toString(),
        role: user.role
    }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (user) => {
    return jsonwebtoken_1.default.sign({
        id: user._id.toString(),
        role: user.role
    }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
};
exports.generateRefreshToken = generateRefreshToken;
// Modified sendToken function - now returns tokens in response body
const sendToken = async (user, statusCode, res) => {
    try {
        const accessToken = (0, exports.generateAccessToken)(user);
        const refreshToken = (0, exports.generateRefreshToken)(user);
        // Store session in Redis
        const sessionData = {
            user_id: user._id.toString(),
            role: user.role,
            email: user.email,
            lastActive: new Date(),
        };
        await redis_1.redis.set(`user_${user._id.toString()}`, JSON.stringify(sessionData), 'EX', 7 * 24 * 60 * 60 // 7 days
        );
        // Remove sensitive information from user object
        const userResponse = {
            _id: user._id,
            email: user.email,
            role: user.role,
            isVerified: user.isVerified,
            isActive: user.isActive,
            avatar: user.avatar,
            lastActive: user.lastActive,
        };
        // Send both tokens in response body
        res.status(statusCode).json({
            success: true,
            user: userResponse,
            accessToken,
            refreshToken
        });
    }
    catch (error) {
        throw new Error("Error in token generation: " + error);
    }
};
exports.sendToken = sendToken;
// Modified clearTokens function
const clearTokens = async (userId) => {
    try {
        const userIdString = userId.toString();
        await redis_1.redis.del(`user_${userIdString}`);
    }
    catch (error) {
        throw new Error("Error clearing tokens: " + error.message);
    }
};
exports.clearTokens = clearTokens;
