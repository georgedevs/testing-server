"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const bookingController_1 = require("../controllers/bookingController");
const bookingModel_1 = require("../models/bookingModel");
const bookingRouter = express_1.default.Router();
bookingRouter.post('/initiate', auth_1.isAuthenticated, bookingController_1.initiateBooking);
bookingRouter.post('/assign-counselor', auth_1.isAuthenticated, auth_1.isAdmin, bookingController_1.assignCounselor);
bookingRouter.post('/select-time', auth_1.isAuthenticated, bookingController_1.selectMeetingTime);
bookingRouter.post('/accept', auth_1.isAuthenticated, auth_1.isCounselor, bookingController_1.acceptMeeting);
bookingRouter.post('/cancel', auth_1.isAuthenticated, bookingController_1.cancelMeeting);
bookingRouter.post('/report-no-show', auth_1.isAuthenticated, bookingController_1.reportNoShow);
bookingRouter.get('/available-slots', auth_1.isAuthenticated, bookingController_1.getAvailableTimeSlots);
bookingRouter.get('/active-booking', auth_1.isAuthenticated, bookingController_1.getActiveBooking);
bookingRouter.get('/meetings/requests', auth_1.isAuthenticated, auth_1.isAdmin, async (req, res, next) => {
    try {
        const requests = await bookingModel_1.Meeting.find({ status: 'request_pending' })
            .populate('clientId', 'fullName email avatar username age marriageYears preferredCounselorGender')
            .sort({ createdAt: -1 });
        // Get socket events instance
        const socketEvents = req.app.get('socketEvents');
        // If socket events exist and we have a user ID, emit update
        if (socketEvents && req.user?._id) {
            socketEvents.emitAdminUpdate({
                type: 'meeting_requests_fetched',
                userId: req.user._id
            });
        }
        res.status(200).json({
            success: true,
            requests
        });
    }
    catch (error) {
        next(error); // Pass any errors to the error handling middleware
    }
});
bookingRouter.get('/counselor/meetings', auth_1.isAuthenticated, auth_1.isCounselor, async (req, res, next) => {
    try {
        const meetings = await bookingModel_1.Meeting.find({
            counselorId: req.user?._id,
            status: { $in: ['counselor_assigned', 'time_selected', 'confirmed'] }
        })
            .populate('clientId', 'fullName email avatar username')
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            meetings
        });
    }
    catch (error) {
        next(error);
    }
});
bookingRouter.get('/counselor/pending', auth_1.isAuthenticated, auth_1.isCounselor, async (req, res, next) => {
    try {
        const meetings = await bookingModel_1.Meeting.find({
            counselorId: req.user?._id,
            status: 'time_selected'
        })
            .populate('clientId', 'fullName email avatar username')
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            meetings
        });
    }
    catch (error) {
        next(error);
    }
});
bookingRouter.get('/counselor/active-session', auth_1.isAuthenticated, auth_1.isCounselor, bookingController_1.getCounselorActiveSession);
bookingRouter.get('/meeting-token/:meetingId', auth_1.isAuthenticated, bookingController_1.getMeetingToken);
bookingRouter.post('/complete/:meetingId', auth_1.isAuthenticated, bookingController_1.completeMeeting);
bookingRouter.get('/client/history', auth_1.isAuthenticated, bookingController_1.getClientSessionHistory);
bookingRouter.get('/counselor/history', auth_1.isAuthenticated, auth_1.isCounselor, bookingController_1.getCounselorSessionHistory);
bookingRouter.get('/counselor/statistics', auth_1.isAuthenticated, auth_1.isCounselor, bookingController_1.getCounselorStatistics);
bookingRouter.post('/rate/:meetingId', auth_1.isAuthenticated, bookingController_1.rateSession);
bookingRouter.get('/rate/status/:meetingId', auth_1.isAuthenticated, bookingController_1.getSessionRatingStatus);
bookingRouter.get('/counselor/feedback', auth_1.isAuthenticated, auth_1.isCounselor, bookingController_1.getCounselorFeedback);
bookingRouter.get('/meetings', auth_1.isAuthenticated, auth_1.isAdmin, bookingController_1.getAllMeetings);
bookingRouter.get('/analytics', auth_1.isAuthenticated, auth_1.isAdmin, bookingController_1.getDashboardAnalytics);
bookingRouter.get('/sessions', auth_1.isAuthenticated, auth_1.isAdmin, bookingController_1.getAllSessionHistory);
bookingRouter.get('/feedback', auth_1.isAuthenticated, auth_1.isAdmin, bookingController_1.getAllFeedback);
exports.default = bookingRouter;
