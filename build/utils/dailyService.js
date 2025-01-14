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
    ensureUTCDate(date) {
        const parsedDate = typeof date === 'string'
            ? new Date(date)
            : date;
        // Create a new Date object in UTC
        return new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), parsedDate.getUTCHours(), parsedDate.getUTCMinutes(), parsedDate.getUTCSeconds()));
    }
    async createRoom(meetingId, scheduledTime, durationMinutes = 45) {
        try {
            const utcScheduledTime = this.ensureUTCDate(scheduledTime);
            // Calculate room expiration - 24 hours after scheduled meeting end time
            const meetingEndTime = (0, date_fns_1.addMinutes)(utcScheduledTime, durationMinutes);
            const roomExpiration = Math.floor((0, date_fns_1.addDays)(meetingEndTime, 1).getTime() / 1000);
            // Calculate when meeting should start (5 minutes before scheduled time)
            const nbfTime = Math.floor((0, date_fns_1.addMinutes)(utcScheduledTime, -5).getTime() / 1000);
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
            const utcScheduledTime = this.ensureUTCDate(scheduledTime);
            // Token expires 24 hours after meeting end time
            const meetingEndTime = (0, date_fns_1.addMinutes)(utcScheduledTime, durationMinutes);
            const tokenExpiration = Math.floor((0, date_fns_1.addDays)(meetingEndTime, 1).getTime() / 1000);
            // Token becomes valid 5 minutes before meeting
            const tokenStartTime = Math.floor((0, date_fns_1.addMinutes)(utcScheduledTime, -5).getTime() / 1000);
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
