require('dotenv').config()
import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "./catchAsyncErrors";
import ErrorHandler from "../utils/errorHandler";
import jwt, { JwtPayload } from "jsonwebtoken";
import { redis } from "../utils/redis";
import { IUser } from "../models/userModel";
import { updateAccessToken } from "../controllers/userController";
import { Types } from "mongoose";


const getRedisKey = (userId: Types.ObjectId | string): string => {
    return `user_${userId.toString()}`;
};

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}
export const isAuthenticated = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
      try {
          // Get token from Authorization header
          const authHeader = req.headers.authorization;
          const accessToken = authHeader?.startsWith('Bearer ') 
              ? authHeader.substring(7) 
              : null;

          if (!accessToken) {
              return next(new ErrorHandler("Please login to access this resource", 401));
          }

          // Verify access token
          const decoded = jwt.verify(
              accessToken,
              process.env.ACCESS_TOKEN_SECRET as string
          ) as JwtPayload;

          if (!decoded || !decoded.id) {
              return next(new ErrorHandler("Invalid access token", 401));
          }

          // Get user from Redis using consistent key format
          const redisKey = getRedisKey(decoded.id);
          const userSession = await redis.get(redisKey);

          if (!userSession) {
              return next(new ErrorHandler("Please login to access this resource", 401));
          }

          const userData = JSON.parse(userSession);

          // Ensure the user data has required fields
          if (!userData.user_id || !userData.role || !userData.email) {
              return next(new ErrorHandler("Invalid session data", 401));
          }

          // Set user data in request
          req.user = {
              _id: new Types.ObjectId(userData.user_id),
              role: userData.role,
              email: userData.email,
              lastActive: new Date(),
              isVerified: true,
              isActive: true
          } as IUser;

          // Update last active in Redis
          userData.lastActive = new Date();
          await redis.set(redisKey, JSON.stringify(userData));

          next();
      } catch (error: any) {
          if (error instanceof jwt.TokenExpiredError) {
              return next(new ErrorHandler("Access token expired", 401));
          }
          if (error instanceof jwt.JsonWebTokenError) {
              return next(new ErrorHandler("Invalid access token", 401));
          }
          return next(new ErrorHandler(`Authentication failed: ${error.message}`, 401));
      }
  }
);


// Role authorization middleware
export const authorizeRoles = (...roles: Array<"client" | "admin" | "counselor">) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(
          `Role (${req.user?.role}) is not allowed to access this resource`,
          403
        )
      );
    }
    next();
  };
};

// Admin check middleware
export const isAdmin = authorizeRoles("admin");

// Counselor check middleware
export const isCounselor = authorizeRoles("counselor");

// Resource ownership verification
export const isOwnerOrAdmin = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const resourceId = req.params.id;
    
    if (!req.user) {
      return next(new ErrorHandler("Authentication required", 401));
    }

    if (req.user.role === "admin") {
      return next();
    }

    if (req.user._id.toString() !== resourceId) {
      return next(
        new ErrorHandler("You are not authorized to access this resource", 403)
      );
    }

    next();
  }
);