"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitSessionFeedback = exports.endSession = exports.startSession = exports.createSession = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const sessionModel_1 = require("../models/sessionModel");
const bookingModel_1 = require("../models/bookingModel");
const twilioClient_1 = __importDefault(require("../utils/twilioClient"));
// Create session from confirmed meeting
exports.createSession = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    const { meetingId } = req.body;
    const meeting = await bookingModel_1.Meeting.findById(meetingId);
    if (!meeting || meeting.status !== 'confirmed') {
        return next(new errorHandler_1.default('Meeting not found or not confirmed', 404));
    }
    // Create Twilio conversation
    const conversation = await twilioClient_1.default.conversations.v1.conversations.create({
        uniqueName: `session-${meetingId}`,
        friendlyName: `Session for meeting ${meetingId}`
    });
    const session = await sessionModel_1.Session.create({
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
});
// Start session
exports.startSession = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    const { sessionId } = req.params;
    const userId = req.user?._id;
    const session = await sessionModel_1.Session.findById(sessionId);
    if (!session) {
        return next(new errorHandler_1.default('Session not found', 404));
    }
    if (session.status !== 'scheduled') {
        return next(new errorHandler_1.default('Session already started or completed', 400));
    }
    // Create Twilio video room
    const room = await twilioClient_1.default.video.v1.rooms.create({
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
    const token = new AccessToken(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_API_KEY, process.env.TWILIO_API_SECRET);
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
});
// End session
exports.endSession = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    const { sessionId } = req.params;
    const session = await sessionModel_1.Session.findById(sessionId);
    if (!session) {
        return next(new errorHandler_1.default('Session not found', 404));
    }
    if (session.status !== 'active') {
        return next(new errorHandler_1.default('Session not active', 400));
    }
    // End Twilio video room
    if (session.twilioRoomSid) {
        await twilioClient_1.default.video.v1.rooms(session.twilioRoomSid)
            .update({ status: 'completed' });
    }
    session.status = 'completed';
    session.endTime = new Date();
    await session.save();
    // Update meeting status
    await bookingModel_1.Meeting.findByIdAndUpdate(session.meetingId, {
        status: 'completed'
    });
    res.status(200).json({
        success: true,
        message: 'Session ended successfully'
    });
});
// Submit session feedback
exports.submitSessionFeedback = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    const { sessionId } = req.params;
    const { rating, feedback } = req.body;
    const session = await sessionModel_1.Session.findById(sessionId);
    if (!session) {
        return next(new errorHandler_1.default('Session not found', 404));
    }
    session.rating = rating;
    session.feedback = feedback;
    await session.save();
    res.status(200).json({
        success: true,
        message: 'Feedback submitted successfully'
    });
});
