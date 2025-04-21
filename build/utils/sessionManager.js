"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
// utils/sessionManager.ts (UPDATED)
const redis_1 = require("./redis");
class SessionManager {
    static async createSession(userId, deviceId) {
        if (!userId || !deviceId) {
            throw new Error('User ID and Device ID are required');
        }
        const sessionKey = `${this.SESSION_PREFIX}${userId}`;
        const deviceKey = `${this.DEVICE_PREFIX}${deviceId}`;
        // Check for existing session
        const existingSession = await redis_1.redis.get(sessionKey);
        if (existingSession) {
            const sessionInfo = JSON.parse(existingSession);
            // Force logout from previous device
            await redis_1.redis.del(`${this.DEVICE_PREFIX}${sessionInfo.deviceId}`);
        }
        // Create new session
        const sessionInfo = {
            deviceId,
            lastActive: Date.now()
        };
        await Promise.all([
            redis_1.redis.set(sessionKey, JSON.stringify(sessionInfo)),
            redis_1.redis.set(deviceKey, userId)
        ]);
    }
    static async validateSession(userId, deviceId) {
        if (!userId || !deviceId) {
            return false;
        }
        const sessionKey = `${this.SESSION_PREFIX}${userId}`;
        const sessionData = await redis_1.redis.get(sessionKey);
        if (!sessionData)
            return false;
        try {
            const sessionInfo = JSON.parse(sessionData);
            return sessionInfo.deviceId === deviceId;
        }
        catch {
            return false;
        }
    }
    static async updateLastActive(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }
        const sessionKey = `${this.SESSION_PREFIX}${userId}`;
        const sessionData = await redis_1.redis.get(sessionKey);
        if (sessionData) {
            const sessionInfo = JSON.parse(sessionData);
            sessionInfo.lastActive = Date.now();
            await redis_1.redis.set(sessionKey, JSON.stringify(sessionInfo));
        }
    }
    static async removeSession(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }
        const sessionKey = `${this.SESSION_PREFIX}${userId}`;
        const sessionData = await redis_1.redis.get(sessionKey);
        if (sessionData) {
            const sessionInfo = JSON.parse(sessionData);
            await Promise.all([
                redis_1.redis.del(sessionKey),
                redis_1.redis.del(`${this.DEVICE_PREFIX}${sessionInfo.deviceId}`)
            ]);
        }
    }
}
exports.SessionManager = SessionManager;
SessionManager.SESSION_PREFIX = 'session:';
SessionManager.DEVICE_PREFIX = 'device:';
