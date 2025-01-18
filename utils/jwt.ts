// server/utils/jwt.ts
import { Response } from "express";
import { IUser } from "../models/userModel";
import { redis } from "./redis";
import jwt, { Secret } from "jsonwebtoken";
import { Types } from "mongoose";

// Token interfaces remain the same
interface ITokenOptions {
    expires: Date;
    maxAge: number;
    httpOnly: boolean;
    sameSite: 'lax' | 'strict' | 'none' | undefined;
    secure?: boolean;
}

interface IDecodedToken {
    id: string;
    role?: string;
    iat?: number;
    exp?: number;
}

// Only refresh token gets cookie options now
export const refreshTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
};

// Token generation functions remain similar
export const generateAccessToken = (user: IUser): string => {
    return jwt.sign(
        { 
            id: user._id.toString(),
            role: user.role 
        },
        process.env.ACCESS_TOKEN_SECRET as Secret,
        { expiresIn: '15m' } // Shorter expiry for access token
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

// Modified sendToken function
export const sendToken = async (user: IUser, statusCode: number, res: Response) => {
    try {
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store user session in Redis
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

        // Set only refresh token in HTTP-only cookie
        res.cookie("refresh_token", refreshToken, refreshTokenOptions);

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
    } catch (error) {
        throw new Error("Error in token generation: " + error);
    }
};

// Modified token cleanup function
export const clearTokens = async (userId: string | Types.ObjectId, res: Response) => {
    try {
        const userIdString = userId.toString();
        
        // Clear Redis session
        await redis.del(`user_${userIdString}`);
        
        // Clear only refresh token cookie
        res.cookie("refresh_token", "", {
            maxAge: 1,
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            expires: new Date(0)
        });

        return true;
    } catch (error) {
        throw new Error("Error clearing tokens: " + (error as Error).message);
    }
};