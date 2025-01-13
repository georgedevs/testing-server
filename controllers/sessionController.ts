import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from '../middleware/catchAsyncErrors';
import ErrorHandler from '../utils/errorHandler';
import { Session } from '../models/sessionModel';
import { Meeting } from '../models/bookingModel';
import twilioClient from '../utils/twilioClient';
import { Client, Counselor } from '../models/userModel';
import sendMail from '../utils/sendMail';
import { startOfDay, addMinutes } from 'date-fns';

// Create session from confirmed meeting
export const createSession = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { meetingId } = req.body;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting || meeting.status !== 'confirmed') {
      return next(new ErrorHandler('Meeting not found or not confirmed', 404));
    }

    // Create Twilio conversation
    const conversation = await twilioClient.conversations.v1.conversations.create({
      uniqueName: `session-${meetingId}`,
      friendlyName: `Session for meeting ${meetingId}`
    });

    const session = await Session.create({
      meetingId: meeting._id,
      clientId: meeting.clientId,
      counselorId: meeting.counselorId,
      startTime: new Date(`${meeting.meetingDate?.toISOString().split('T')[0]}T${meeting.meetingTime}`),
      twilioConversationSid: conversation.sid,
      status: 'scheduled'
    });

    res.status(201).json({
      success: true,
      session
    });
  }
);

// Start session
export const startSession = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const userId = req.user?._id;

    const session = await Session.findById(sessionId);
    if (!session) {
      return next(new ErrorHandler('Session not found', 404));
    }

    if (session.status !== 'scheduled') {
      return next(new ErrorHandler('Session already started or completed', 400));
    }

    // Create Twilio video room
    const room = await twilioClient.video.v1.rooms.create({
      uniqueName: `session-${sessionId}`,
      type: 'group',
      maxParticipants: 2
    });

    session.status = 'active';
    session.twilioRoomSid = room.sid;
    await session.save();

    // Generate Twilio access token for the user
    const AccessToken = require('twilio').jwt.AccessToken;
    const { VideoGrant, ChatGrant } = AccessToken;

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY!,
      process.env.TWILIO_API_SECRET!
    );


    // Grant access to Video
    const videoGrant = new VideoGrant({
      room: `session-${sessionId}`
    });
    token.addGrant(videoGrant);

    // Grant access to Chat
    const chatGrant = new ChatGrant({
      serviceSid: process.env.TWILIO_CHAT_SERVICE_SID
    });
    token.addGrant(chatGrant);

    res.status(200).json({
      success: true,
      session,
      twilioToken: token.toJwt()
    });
  }
);

// End session
export const endSession = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return next(new ErrorHandler('Session not found', 404));
    }

    if (session.status !== 'active') {
      return next(new ErrorHandler('Session not active', 400));
    }

    // End Twilio video room
    if (session.twilioRoomSid) {
      await twilioClient.video.v1.rooms(session.twilioRoomSid)
        .update({ status: 'completed' });
    }

    session.status = 'completed';
    session.endTime = new Date();
    await session.save();

    // Update meeting status
    await Meeting.findByIdAndUpdate(session.meetingId, {
      status: 'completed'
    });

    res.status(200).json({
      success: true,
      message: 'Session ended successfully'
    });
  }
);

// Submit session feedback
export const submitSessionFeedback = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const { rating, feedback } = req.body;

    const session = await Session.findById(sessionId);
    if (!session) {
      return next(new ErrorHandler('Session not found', 404));
    }

    session.rating = rating;
    session.feedback = feedback;
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Feedback submitted successfully'
    });
  }
);