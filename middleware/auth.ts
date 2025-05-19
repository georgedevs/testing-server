import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "./catchAsyncErrors";
import ErrorHandler from "../utils/errorHandler";
import { IUser } from "../models/userModel";
import { Types } from "mongoose";

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
      // Check if user is authenticated via session
      if (!req.session || !req.session.userId) {
        return next(new ErrorHandler("Please login to access this resource", 401));
      }

      // Get user from session
      const userId = req.session.userId;
      
      // Set user in request
      if (req.session.user) {
        // Create user object from session data, avoiding property overwriting
        const sessionUser = req.session.user;
        
        req.user = {
          // Set the important properties with proper types
          _id: new Types.ObjectId(userId),
          // Include other required properties without duplication
          email: sessionUser.email,
          role: sessionUser.role,
          isVerified: true,
          isActive: true,
          lastActive: new Date(),
          // Spread remaining properties that aren't explicitly set above
          ...(Object.keys(sessionUser)
            .filter(key => !['_id', 'email', 'role'].includes(key))
            .reduce((obj, key) => ({ ...obj, [key]: sessionUser[key] }), {}))
        } as IUser;
      } else {
        return next(new ErrorHandler("User data not found in session", 401));
      }

      next();
    } catch (error: any) {
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