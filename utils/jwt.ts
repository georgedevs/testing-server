// server/utils/jwt.ts
import { Response } from "express";
import { IUser } from "../models/userModel";
import { redis } from "./redis";
import jwt, { Secret } from "jsonwebtoken";
import { Types } from "mongoose";

interface ITokenResponse {
    accessToken: string;
    refreshToken: string;
    user: any;
}

// Token generation functions
export const generateAccessToken = (user: IUser): string => {
    return jwt.sign(
        { 
            id: user._id.toString(),
            role: user.role 
        },
        process.env.ACCESS_TOKEN_SECRET as Secret,
        { expiresIn: '15m' }
    );
};

export const generateRefreshToken = (user: IUser): string => {
    return jwt.sign(
        { 
            id: user._id.toString(),
            role: user.role
        },
        process.env.REFRESH_TOKEN_SECRET as Secret,
        { expiresIn: '7d' }
    );
};

// Modified sendToken function - now returns tokens in response body
export const sendToken = async (user: IUser, statusCode: number, res: Response): Promise<void> => {
    try {
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store session in Redis
        const sessionData = {
            user_id: user._id.toString(),
            role: user.role,
            email: user.email,
            lastActive: new Date(),
        };

        await redis.set(
            `user_${user._id.toString()}`,
            JSON.stringify(sessionData),
            'EX',
            7 * 24 * 60 * 60 // 7 days
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
    } catch (error) {
        throw new Error("Error in token generation: " + error);
    }
};

// Modified clearTokens function
export const clearTokens = async (userId: string | Types.ObjectId): Promise<void> => {
    try {
        const userIdString = userId.toString();
        await redis.del(`user_${userIdString}`);
    } catch (error) {
        throw new Error("Error clearing tokens: " + (error as Error).message);
    }
};