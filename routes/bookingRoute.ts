import express from 'express';
import { isAdmin, isAuthenticated, isCounselor } from '../middleware/auth';
import { acceptMeeting, assignCounselor, cancelMeeting, completeMeeting, getActiveBooking, getAllFeedback, getAllMeetings, getAllSessionHistory, getAvailableTimeSlots, getClientSessionHistory, getCounselorActiveSession, getCounselorFeedback, getCounselorSessionHistory, getCounselorStatistics, getDashboardAnalytics, getMeetingToken, getSessionRatingStatus, initiateBooking, rateSession, reportNoShow, selectMeetingTime, participantJoined, participantLeft, getMeetingStatus, completeMeetingExtended } from '../controllers/bookingController';
import { Meeting } from '../models/bookingModel';

const bookingRouter = express.Router();

bookingRouter.post('/initiate', isAuthenticated, initiateBooking);
bookingRouter.post('/assign-counselor', isAuthenticated, isAdmin, assignCounselor);
bookingRouter.post('/select-time', isAuthenticated, selectMeetingTime);
bookingRouter.post('/accept', isAuthenticated, isCounselor, acceptMeeting);
bookingRouter.post('/cancel', isAuthenticated, cancelMeeting);
bookingRouter.post('/report-no-show', isAuthenticated, reportNoShow);
bookingRouter.get('/available-slots', isAuthenticated, getAvailableTimeSlots);

bookingRouter.get('/active-booking', isAuthenticated, getActiveBooking);
bookingRouter.get('/meetings/requests', isAuthenticated, isAdmin, async (req, res, next) => {
  try {
    const requests = await Meeting.find({ status: 'request_pending' })
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
  } catch (error) {
    next(error); // Pass any errors to the error handling middleware
  }
});
  bookingRouter.get('/counselor/meetings', isAuthenticated, isCounselor, async (req, res,next) => {
    try {
      const meetings = await Meeting.find({
        counselorId: req.user?._id,
        status: { $in: ['counselor_assigned', 'time_selected', 'confirmed'] }
      })
      .populate('clientId', 'fullName email avatar username')
      .sort({ createdAt: -1 });
      
      res.status(200).json({
        success: true,
        meetings
      });
    } catch (error) {
      next(error);
    }
  });
  
  bookingRouter.get('/counselor/pending', isAuthenticated, isCounselor, async (req, res,next) => {
    try {
      const meetings = await Meeting.find({
        counselorId: req.user?._id,
        status: 'time_selected'
      })
      .populate('clientId', 'fullName email avatar username')
      .sort({ createdAt: -1 });
      
      res.status(200).json({
        success: true,
        meetings
      });
    } catch (error) {
      next(error);
    }
  });
  
  bookingRouter.get('/counselor/active-session', isAuthenticated, isCounselor, getCounselorActiveSession)

  bookingRouter.get('/meeting-token/:meetingId', isAuthenticated, getMeetingToken);   
bookingRouter.post('/complete/:meetingId', isAuthenticated, completeMeeting);

bookingRouter.get('/client/history', isAuthenticated, getClientSessionHistory);
bookingRouter.get('/counselor/history', isAuthenticated, isCounselor, getCounselorSessionHistory);
bookingRouter.get('/counselor/statistics', isAuthenticated, isCounselor, getCounselorStatistics);

bookingRouter.post('/rate/:meetingId', isAuthenticated, rateSession);
bookingRouter.get('/rate/status/:meetingId', isAuthenticated, getSessionRatingStatus);

bookingRouter.get('/counselor/feedback',isAuthenticated, isCounselor, getCounselorFeedback)

bookingRouter.get('/meetings', isAuthenticated,isAdmin, getAllMeetings)

bookingRouter.get('/analytics', isAuthenticated,isAdmin, getDashboardAnalytics)

bookingRouter.get('/sessions', isAuthenticated,isAdmin, getAllSessionHistory)

bookingRouter.get('/feedback', isAuthenticated,isAdmin, getAllFeedback)

bookingRouter.post('/participant/:meetingId/join', isAuthenticated, participantJoined);
bookingRouter.post('/participant/:meetingId/leave', isAuthenticated, participantLeft);
bookingRouter.get('/session/:meetingId/status', isAuthenticated, getMeetingStatus);
bookingRouter.post('/complete-extended/:meetingId', isAuthenticated, completeMeetingExtended);
export default bookingRouter