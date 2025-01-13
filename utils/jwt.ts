require('dotenv').config();
import { Response } from "express";
import { IUser } from "../models/userModel";
import { redis } from "./redis";
import jwt, { Secret } from "jsonwebtoken";
import { Document, Types } from "mongoose";

// Token interfaces
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

interface IUserSession {
    user_id: string;
    role: string;
    email: string;
    lastActive: Date;
}



// Default token expiration times (in minutes)
const DEFAULT_ACCESS_TOKEN_EXPIRE = 60; // 1 hour
const DEFAULT_REFRESH_TOKEN_EXPIRE = 10080; // 7 days

// Parse environment variables with fallback values
const accessTokenExpire = parseInt(process.env.ACCESS_TOKEN_EXPIRE || `${DEFAULT_ACCESS_TOKEN_EXPIRE}`, 10);
const refreshTokenExpire = parseInt(process.env.REFRESH_TOKEN_EXPIRE || `${DEFAULT_REFRESH_TOKEN_EXPIRE}`, 10);

// Token configuration options
export const accessTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + accessTokenExpire * 60 * 1000),
    maxAge: accessTokenExpire * 60 * 1000,
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    
};

export const refreshTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + refreshTokenExpire * 60 * 1000),
    maxAge: refreshTokenExpire * 60 * 1000,
    httpOnly: true,
    sameSite: 'none',
    secure: true,
};

// Token generation functions
export const generateAccessToken = (user: IUser): string => {
    return jwt.sign(
        { 
            id: user._id.toString(),
            role: user.role 
        },
        process.env.ACCESS_TOKEN_SECRET as Secret,
        { expiresIn: `${accessTokenExpire}m` }
    );
};

export const generateRefreshToken = (user: IUser): string => {
    return jwt.sign(
        { 
            id: user._id.toString(),
            role: user.role
        },
        process.env.REFRESH_TOKEN_SECRET as Secret,
        { expiresIn: `${refreshTokenExpire}m` }
    );
};

// Token verification functions
export const verifyAccessToken = async (token: string): Promise<IDecodedToken> => {
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as Secret) as IDecodedToken;
};

export const verifyRefreshToken = async (token: string): Promise<IDecodedToken> => {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET as Secret) as IDecodedToken;
};

// Main token handling function
export const sendToken = async (user: IUser, statusCode: number, res: Response) => {
    try {
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Create session data
        const sessionData: IUserSession = {
            user_id: user._id.toString(),
            role: user.role,
            email: user.email,
            lastActive: new Date(),
        };

        // Store user session in Redis with proper type handling
        await redis.set(
            `user_${user._id.toString()}`,
            JSON.stringify(sessionData),
            'EX',
            refreshTokenExpire * 60
        );

        // Set secure cookies
        res.cookie("access_token", accessToken, accessTokenOptions);
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

        res.status(statusCode).json({
            success: true,
            user: userResponse,
            accessToken,
        });
    } catch (error) {
        throw new Error("Error in token generation: " + error);
    }
};

// Refresh token function
export const refreshAccessToken = async (refreshToken: string): Promise<string> => {
    try {
        const decoded = await verifyRefreshToken(refreshToken);
        const userSession = await redis.get(`user_${decoded.id}`);

        if (!userSession) {
            throw new Error("Invalid refresh token");
        }

        const sessionData = JSON.parse(userSession) as IUserSession;
        
        // Create a minimal user object with required properties
        const user = {
            _id: new Types.ObjectId(sessionData.user_id),
            role: sessionData.role,
            email: sessionData.email,
        } as IUser;

        return generateAccessToken(user);
    } catch (error) {
        throw new Error("Error refreshing access token: " + error);
    }
};

// Token cleanup function
export const clearTokens = async (userId: string | Types.ObjectId, res: Response) => {
    try {
        const userIdString = userId.toString();
        // Clear Redis session
        await redis.del(`user_${userIdString}`);

        const cookieOptions = {
            httpOnly: true,
            secure: true,
            sameSite: 'none' as 'none',
            path: '/',
            domain: process.env.NODE_ENV === 'production' ? '.vercel.app' : undefined,
            maxAge: 0
        };
        
        // Clear cookies
        res.cookie("access_token", "", { maxAge: 1 });
        res.cookie("refresh_token", "", { maxAge: 1 }); 
    } catch (error) {
        throw new Error("Error clearing tokens: " + error);
    }
};