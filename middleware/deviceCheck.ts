import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import ErrorHandler from '../utils/errorHandler';

export const deviceCheck = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Get or create device ID
        let deviceId = req.cookies.device_id;
        
        if (!deviceId) {
            deviceId = uuidv4();
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
    } catch (error) {
        return next(new ErrorHandler('Device verification failed', 400));
    }
};