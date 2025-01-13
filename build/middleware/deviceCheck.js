"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceCheck = void 0;
const uuid_1 = require("uuid");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const deviceCheck = async (req, res, next) => {
    try {
        // Get or create device ID
        let deviceId = req.cookies.device_id;
        if (!deviceId) {
            deviceId = (0, uuid_1.v4)();
            res.cookie('device_id', deviceId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
            });
        }
        // Safely assign deviceId to the request object
        req.deviceId = deviceId;
        next();
    }
    catch (error) {
        return next(new errorHandler_1.default('Device verification failed', 400));
    }
};
exports.deviceCheck = deviceCheck;
