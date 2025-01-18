"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearTokens = exports.sendToken = exports.generateRefreshToken = exports.generateAccessToken = exports.refreshTokenOptions = void 0;
const redis_1 = require("./redis");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Only refresh token gets cookie options now
exports.refreshTokenOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'none',
    secure: true,
};
// Token generation functions remain similar
const generateAccessToken = (user) => {
    return jsonwebtoken_1.default.sign({
        id: user._id.toString(),
        role: user.role
    }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' } // Shorter expiry for access token
    );
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (user) => {
    return jsonwebtoken_1.default.sign({
        id: user._id.toString(),
        role: user.role
    }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
};
exports.generateRefreshToken = generateRefreshToken;
// Modified sendToken function
const sendToken = async (user, statusCode, res) => {
    try {
        const accessToken = (0, exports.generateAccessToken)(user);
        const refreshToken = (0, exports.generateRefreshToken)(user);
        // Store user session in Redis
        const sessionData = {
            user_id: user._id.toString(),
            role: user.role,
            email: user.email,
            lastActive: new Date(),
        };
        await redis_1.redis.set(`user_${user._id.toString()}`, JSON.stringify(sessionData), 'EX', 7 * 24 * 60 * 60 // 7 days
        );
        // Set only refresh token in HTTP-only cookie
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
        // Send access token in response body
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
// Modified token cleanup function
const clearTokens = async (userId, res) => {
    try {
        const userIdString = userId.toString();
        // Clear Redis session
        await redis_1.redis.del(`user_${userIdString}`);
        // Clear only refresh token cookie
        res.cookie("refresh_token", "", {
            maxAge: 1,
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            expires: new Date(0)
        });
        return true;
    }
    catch (error) {
        throw new Error("Error clearing tokens: " + error.message);
    }
};
exports.clearTokens = clearTokens;
