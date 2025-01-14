"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyService = void 0;
const axios_1 = __importDefault(require("axios"));
const date_fns_1 = require("date-fns");
class DailyService {
    constructor() {
        this.baseUrl = 'https://api.daily.co/v1';
        this.apiKey = process.env.DAILY_API_KEY || '';
        if (!this.apiKey) {
            throw new Error('DAILY_API_KEY is required');
        }
    }
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
        };
    }
    adjustToServerTime(localDate) {
        // Convert local time to UTC time that matches the desired local time
        const year = localDate.getFullYear();
        const month = localDate.getMonth();
        const day = localDate.getDate();
        const hours = localDate.getHours();
        const minutes = localDate.getMinutes();
        const seconds = localDate.getSeconds();
        // Create a UTC date that will appear as the desired local time
        return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
    }
    async createRoom(meetingId, scheduledTime, durationMinutes = 45) {
        try {
            const dateObj = typeof scheduledTime === 'string' ? new Date(scheduledTime) : scheduledTime;
            const adjustedTime = this.adjustToServerTime(dateObj);
            // Calculate room expiration - 24 hours after scheduled meeting end time
            const meetingEndTime = (0, date_fns_1.addMinutes)(adjustedTime, durationMinutes);
            const roomExpiration = Math.floor((0, date_fns_1.addDays)(meetingEndTime, 1).getTime() / 1000);
            // Calculate when meeting should start (5 minutes before scheduled time)
            const nbfTime = Math.floor((0, date_fns_1.addMinutes)(adjustedTime, -5).getTime() / 1000);
            console.log('Creating room with times:', {
                scheduledTime: adjustedTime.toISOString(),
                nbfTime: new Date(nbfTime * 1000).toISOString(),
                expirationTime: new Date(roomExpiration * 1000).toISOString()
            });
            const response = await axios_1.default.post(`${this.baseUrl}/rooms`, {
                name: `meeting-${meetingId}`,
                privacy: 'private',
                properties: {
                    exp: roomExpiration,
                    nbf: nbfTime,
                    max_participants: 2,
                    enable_screenshare: false,
                    enable_chat: true,
                    enable_knocking: true,
                    start_video_off: true,
                    start_audio_off: false,
                    enable_recording: false,
                    eject_at_room_exp: true,
                    lang: 'en',
                },
            }, { headers: this.getHeaders() });
            return response.data;
        }
        catch (error) {
            console.error('Error creating Daily.co room:', error);
            throw error;
        }
    }
    async createMeetingToken(roomName, isClient, scheduledTime, durationMinutes = 45) {
        try {
            const dateObj = typeof scheduledTime === 'string' ? new Date(scheduledTime) : scheduledTime;
            const adjustedTime = this.adjustToServerTime(dateObj);
            // Token expires 24 hours after meeting end time
            const meetingEndTime = (0, date_fns_1.addMinutes)(adjustedTime, durationMinutes);
            const tokenExpiration = Math.floor((0, date_fns_1.addDays)(meetingEndTime, 1).getTime() / 1000);
            // Token becomes valid 5 minutes before meeting
            const tokenStartTime = Math.floor((0, date_fns_1.addMinutes)(adjustedTime, -5).getTime() / 1000);
            console.log('Creating token with times:', {
                scheduledTime: adjustedTime.toISOString(),
                tokenStartTime: new Date(tokenStartTime * 1000).toISOString(),
                tokenExpiration: new Date(tokenExpiration * 1000).toISOString()
            });
            const response = await axios_1.default.post(`${this.baseUrl}/meeting-tokens`, {
                properties: {
                    room_name: roomName,
                    user_name: isClient ? 'Anonymous Client' : 'Anonymous Counselor',
                    enable_screenshare: false,
                    start_video_off: true,
                    start_audio_off: false,
                    exp: tokenExpiration,
                    nbf: tokenStartTime,
                    is_owner: false,
                    enable_recording: false,
                    start_cloud_recording: false,
                },
            }, { headers: this.getHeaders() });
            return response.data.token;
        }
        catch (error) {
            console.error('Error creating Daily.co meeting token:', error);
            throw error;
        }
    }
    async deleteRoom(roomName) {
        try {
            await axios_1.default.delete(`${this.baseUrl}/rooms/${roomName}`, { headers: this.getHeaders() });
        }
        catch (error) {
            console.error('Error deleting Daily.co room:', error);
            throw error;
        }
    }
}
exports.dailyService = new DailyService();
