// utils/sessionManager.ts (UPDATED)
import { redis } from './redis';

interface SessionInfo {
    deviceId: string;
    lastActive: number;
}

export class SessionManager {
    private static readonly SESSION_PREFIX = 'session:';
    private static readonly DEVICE_PREFIX = 'device:';
    
    static async createSession(userId: string, deviceId: string): Promise<void> {
        if (!userId || !deviceId) {
            throw new Error('User ID and Device ID are required');
        }

        const sessionKey = `${this.SESSION_PREFIX}${userId}`;
        const deviceKey = `${this.DEVICE_PREFIX}${deviceId}`;
        
        // Check for existing session
        const existingSession = await redis.get(sessionKey);
        if (existingSession) {
            const sessionInfo: SessionInfo = JSON.parse(existingSession);
            // Force logout from previous device
            await redis.del(`${this.DEVICE_PREFIX}${sessionInfo.deviceId}`);
        }
        
        // Create new session
        const sessionInfo: SessionInfo = {
            deviceId,
            lastActive: Date.now()
        };
        
        await Promise.all([
            redis.set(sessionKey, JSON.stringify(sessionInfo)),
            redis.set(deviceKey, userId)
        ]);
    }
    
    static async validateSession(userId: string, deviceId: string): Promise<boolean> {
        if (!userId || !deviceId) {
            return false;
        }

        const sessionKey = `${this.SESSION_PREFIX}${userId}`;
        const sessionData = await redis.get(sessionKey);
        
        if (!sessionData) return false;
        
        try {
            const sessionInfo: SessionInfo = JSON.parse(sessionData);
            return sessionInfo.deviceId === deviceId;
        } catch {
            return false;
        }
    }
    
    static async updateLastActive(userId: string): Promise<void> {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const sessionKey = `${this.SESSION_PREFIX}${userId}`;
        const sessionData = await redis.get(sessionKey);
        
        if (sessionData) {
            const sessionInfo: SessionInfo = JSON.parse(sessionData);
            sessionInfo.lastActive = Date.now();
            await redis.set(sessionKey, JSON.stringify(sessionInfo));
        }
    }
    
    static async removeSession(userId: string): Promise<void> {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const sessionKey = `${this.SESSION_PREFIX}${userId}`;
        const sessionData = await redis.get(sessionKey);
        
        if (sessionData) {
            const sessionInfo: SessionInfo = JSON.parse(sessionData);
            await Promise.all([
                redis.del(sessionKey),
                redis.del(`${this.DEVICE_PREFIX}${sessionInfo.deviceId}`)
            ]);
        }
    }
}