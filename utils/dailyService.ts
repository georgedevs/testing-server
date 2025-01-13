import axios from 'axios';
import { addMinutes, addDays } from 'date-fns';

class DailyService {
  private apiKey: string;
  private baseUrl: string = 'https://api.daily.co/v1';

  constructor() {
    this.apiKey = process.env.DAILY_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('DAILY_API_KEY is required');
    }
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async createRoom(meetingId: string, scheduledTime: Date, durationMinutes: number = 45) {
    try {
      // Convert scheduledTime to UTC timestamp
      const meetingStartTime = new Date(scheduledTime).getTime();
      
      // Calculate room expiration - 24 hours after scheduled meeting end time
      const meetingEndTime = addMinutes(new Date(meetingStartTime), durationMinutes);
      const roomExpiration = Math.floor(addDays(meetingEndTime, 1).getTime() / 1000);
      
      // Allow access 10 minutes before scheduled time
      const nbfTime = Math.floor(addMinutes(new Date(meetingStartTime), -10).getTime() / 1000);

      console.log('Creating room with times:', {
        scheduledTime: scheduledTime.toISOString(),
        nbfTime: new Date(nbfTime * 1000).toISOString(),
        expiration: new Date(roomExpiration * 1000).toISOString()
      });

      const response = await axios.post(
        `${this.baseUrl}/rooms`,
        {
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
        },
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      console.error('Error creating Daily.co room:', error);
      throw error;
    }
  }

  async createMeetingToken(roomName: string, isClient: boolean, scheduledTime: Date, durationMinutes: number = 45) {
    try {
      // Convert scheduledTime to UTC timestamp
      const meetingStartTime = new Date(scheduledTime).getTime();
      
      // Token expires 24 hours after meeting end time
      const meetingEndTime = addMinutes(new Date(meetingStartTime), durationMinutes);
      const tokenExpiration = Math.floor(addDays(meetingEndTime, 1).getTime() / 1000);
    
      // Allow access 10 minutes before meeting
      const tokenStartTime = Math.floor(addMinutes(new Date(meetingStartTime), -10).getTime() / 1000);

      console.log('Creating token with times:', {
        scheduledTime: scheduledTime.toISOString(),
        tokenStartTime: new Date(tokenStartTime * 1000).toISOString(),
        tokenExpiration: new Date(tokenExpiration * 1000).toISOString()
      });

      const response = await axios.post(
        `${this.baseUrl}/meeting-tokens`,
        {
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
        },
        { headers: this.getHeaders() }
      );

      return response.data.token;
    } catch (error) {
      console.error('Error creating Daily.co meeting token:', error);
      throw error;
    }
  }

  async deleteRoom(roomName: string) {
    try {
      await axios.delete(
        `${this.baseUrl}/rooms/${roomName}`,
        { headers: this.getHeaders() }
      );
    } catch (error) {
      console.error('Error deleting Daily.co room:', error);
      throw error;
    }
  }
}

export const dailyService = new DailyService();