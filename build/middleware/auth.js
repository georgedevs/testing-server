"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOwnerOrAdmin = exports.isCounselor = exports.isAdmin = exports.authorizeRoles = exports.isAuthenticated = void 0;
const catchAsyncErrors_1 = require("./catchAsyncErrors");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const mongoose_1 = require("mongoose");
exports.isAuthenticated = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        // Check if user is authenticated via session
        if (!req.session || !req.session.userId) {
            return next(new errorHandler_1.default("Please login to access this resource", 401));
        }
        // Get user from session
        const userId = req.session.userId;
        // Set user in request
        if (req.session.user) {
            // Create user object from session data, avoiding property overwriting
            const sessionUser = req.session.user;
            req.user = {
                // Set the important properties with proper types
                _id: new mongoose_1.Types.ObjectId(userId),
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
            };
        }
        else {
            return next(new errorHandler_1.default("User data not found in session", 401));
        }
        next();
    }
    catch (error) {
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
