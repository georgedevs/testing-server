"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearTokens = exports.refreshAccessToken = exports.sendToken = exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateRefreshToken = exports.generateAccessToken = exports.refreshTokenOptions = exports.accessTokenOptions = void 0;
require('dotenv').config();
const redis_1 = require("./redis");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = require("mongoose");
// Default token expiration times (in minutes)
const DEFAULT_ACCESS_TOKEN_EXPIRE = 60; // 1 hour
const DEFAULT_REFRESH_TOKEN_EXPIRE = 10080; // 7 days
// Parse environment variables with fallback values
const accessTokenExpire = parseInt(process.env.ACCESS_TOKEN_EXPIRE || `${DEFAULT_ACCESS_TOKEN_EXPIRE}`, 10);
const refreshTokenExpire = parseInt(process.env.REFRESH_TOKEN_EXPIRE || `${DEFAULT_REFRESH_TOKEN_EXPIRE}`, 10);
// Token configuration options
exports.accessTokenOptions = {
    expires: new Date(Date.now() + accessTokenExpire * 60 * 1000),
    maxAge: accessTokenExpire * 60 * 1000,
    httpOnly: true,
    sameSite: 'none',
    secure: process.env.NODE_ENV === 'production',
};
exports.refreshTokenOptions = {
    expires: new Date(Date.now() + refreshTokenExpire * 60 * 1000),
    maxAge: refreshTokenExpire * 60 * 1000,
    httpOnly: true,
    sameSite: 'none',
    secure: process.env.NODE_ENV === 'production',
};
// Token generation functions
const generateAccessToken = (user) => {
    return jsonwebtoken_1.default.sign({
        id: user._id.toString(),
        role: user.role
    }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: `${accessTokenExpire}m` });
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (user) => {
    return jsonwebtoken_1.default.sign({
        id: user._id.toString(),
        role: user.role
    }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: `${refreshTokenExpire}m` });
};
exports.generateRefreshToken = generateRefreshToken;
// Token verification functions
const verifyAccessToken = async (token) => {
    return jsonwebtoken_1.default.verify(token, process.env.ACCESS_TOKEN_SECRET);
};
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = async (token) => {
    return jsonwebtoken_1.default.verify(token, process.env.REFRESH_TOKEN_SECRET);
};
exports.verifyRefreshToken = verifyRefreshToken;
// Main token handling function
const sendToken = async (user, statusCode, res) => {
    try {
        const accessToken = (0, exports.generateAccessToken)(user);
        const refreshToken = (0, exports.generateRefreshToken)(user);
        // Create session data
        const sessionData = {
            user_id: user._id.toString(),
            role: user.role,
            email: user.email,
            lastActive: new Date(),
        };
        // Store user session in Redis with proper type handling
        await redis_1.redis.set(`user_${user._id.toString()}`, JSON.stringify(sessionData), 'EX', refreshTokenExpire * 60);
        // Set secure cookies
        res.cookie("access_token", accessToken, exports.accessTokenOptions);
        res.cookie("refresh_token", refreshToken, exports.refreshTokenOptions);
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
        res.status(statusCode).json({
            success: true,
            user: userResponse,
            accessToken,
        });
    }
    catch (error) {
        throw new Error("Error in token generation: " + error);
    }
};
exports.sendToken = sendToken;
// Refresh token function
const refreshAccessToken = async (refreshToken) => {
    try {
        const decoded = await (0, exports.verifyRefreshToken)(refreshToken);
        const userSession = await redis_1.redis.get(`user_${decoded.id}`);
        if (!userSession) {
            throw new Error("Invalid refresh token");
        }
        const sessionData = JSON.parse(userSession);
        // Create a minimal user object with required properties
        const user = {
            _id: new mongoose_1.Types.ObjectId(sessionData.user_id),
            role: sessionData.role,
            email: sessionData.email,
        };
        return (0, exports.generateAccessToken)(user);
    }
    catch (error) {
        throw new Error("Error refreshing access token: " + error);
    }
};
exports.refreshAccessToken = refreshAccessToken;
// Token cleanup function
const clearTokens = async (userId, res) => {
    try {
        const userIdString = userId.toString();
        // Clear Redis session
        await redis_1.redis.del(`user_${userIdString}`);
        // Clear cookies
        res.cookie("access_token", "", { maxAge: 1 });
        res.cookie("refresh_token", "", { maxAge: 1 });
    }
    catch (error) {
        throw new Error("Error clearing tokens: " + error);
    }
};
exports.clearTokens = clearTokens;
