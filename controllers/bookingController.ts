require ('dotenv').config();
import { Request, Response, NextFunction } from 'express';
import { IMeeting, Meeting } from '../models/bookingModel';
import { Client, Counselor, Admin, INotification, IClient, ICounselor } from '../models/userModel';
import { redis } from '../utils/redis';
import sendMail from '../utils/sendMail';
import { sendSMS } from '../utils/sendSMS';
import { startOfDay, endOfDay, addMinutes, addHours, format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import ErrorHandler from '../utils/errorHandler';
import { CatchAsyncError } from '../middleware/catchAsyncErrors';
import { dailyService } from '../utils/dailyService';
import mongoose, { PopulatedDoc } from 'mongoose';
// 1. Initial Meeting Request   
export const initiateBooking = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { meetingType, issueDescription, usePreviousCounselor = false } = req.body;
    const clientId = req.user?._id;

    // Get client to check for existing counselor
    const client = await Client.findById(clientId);
    if (!client) {
      return next(new ErrorHandler('Client not found', 404));
    }

    let meetingData: any = {
      clientId,
      meetingType,
      issueDescription,
      status: 'request_pending'
    };

    // If client has a current counselor and wants to use them
    if (usePreviousCounselor && client.currentCounselor) {
      // Verify counselor is still active
      const counselor = await Counselor.findOne({
        _id: client.currentCounselor,
        isActive: true,
        isAvailable: true
      });

      if (counselor) {
        meetingData = {
          ...meetingData,
          counselorId: counselor._id,
          status: 'counselor_assigned',
          autoAssigned: true
        };
      }
    }

    const meeting = await Meeting.create(meetingData);

    const socketEvents = req.app.get('socketEvents');

    // Emit event for admin dashboard update
    socketEvents.emitAdminUpdate({
      type: 'new_booking',
      meetingId: meeting._id,
      clientId
    });

    // If auto-assigned, also notify the counselor
    if (meetingData.counselorId) {
      socketEvents.emitCounselorAssigned(
        meetingData.counselorId.toString(),
        {
          title: 'New Client Assignment',
          message: 'A previous client has requested another session with you',
          type: 'new_assignment'
        }
      );

      // Send email to counselor
      const counselor = await Counselor.findById(meetingData.counselorId);
      if (counselor) {
        await sendMail({
          email: counselor.email,
          subject: 'New Client Assignment - Returning Client',
          template: 'counselorAssignment.ejs',
          data: {
            meetingType,
            issueDescription,
            isReturningClient: true
          }
        });
      }
    } else {
      // Regular admin notification for new requests
      const notification = {
        title: 'New Meeting Request',
        message: `New ${meetingType} meeting request from client`,
        type: 'meeting'
      };
      await redis.lpush('admin_notifications', JSON.stringify(notification));

      await sendMail({
        email: process.env.ADMIN_EMAIL || '',
        subject: 'New Meeting Request',
        template: 'newMeetingRequest.ejs',
        data: {
          meetingType,
          issueDescription
        }
      });

      await sendSMS(
        process.env.ADMIN_PHONE || '',
        `New ${meetingType} meeting request received. Please check dashboard.`
      );
    }

    res.status(201).json({
      success: true,
      meeting
    });
  }
);


// 2. Admin Assigns Counselor
export const assignCounselor = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { meetingId, counselorId } = req.body;
    const adminId = req.user?._id;
    
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return next(new ErrorHandler('Meeting not found', 404));
    }

    const counselor = await Counselor.findById(counselorId);
    if (!counselor) {
      return next(new ErrorHandler('Counselor not found', 404));
    }

    meeting.counselorId = counselorId;
    meeting.status = 'counselor_assigned';
    meeting.adminAssignedBy = adminId;
    meeting.adminAssignedAt = new Date();
    await meeting.save();

    const socketEvents = req.app.get('socketEvents');

    // Emit events for all relevant parties
    socketEvents.emitCounselorAssigned(
      meeting.clientId.toString(),
      counselorId,
      {
        meetingId: meeting._id,
        status: meeting.status,
        counselorId
      }
    );

    if (socketEvents) {
      // Notify client
      socketEvents.emitBookingUpdated(meeting.clientId.toString(), {
        title: 'Counselor Assigned',
        message: `A counselor has been assigned to your booking`,
        type: 'counselor_assigned'
      });

      // Notify counselor
      socketEvents.emitCounselorAssigned(counselorId, {
        title: 'New Client Assignment',
        message: `You have been assigned a new client`,
        type: 'new_assignment'
      });
    }




    // Notify counselor
    await sendMail({
      email: counselor.email,
      subject: 'New Client Assignment',
      template: 'counselorAssignment.ejs',
      data: {
        meetingType: meeting.meetingType,
        issueDescription: meeting.issueDescription
      }
    });

    // Notify client
    const client = await Client.findById(meeting.clientId);
    if (client) {
      await sendMail({
        email: client.email,
        subject: 'Counselor Assigned',
        template: 'counselorAssigned.ejs',
        data: {
          counselorName: counselor.fullName
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Counselor assigned successfully'
    });
  }
);

// 3. Client Selects Meeting Time
export const selectMeetingTime = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { meetingId, meetingDate, meetingTime } = req.body;
    const clientId = req.user?._id;

    const meeting = await Meeting.findOne({ _id: meetingId, clientId });
    if (!meeting) {
      return next(new ErrorHandler('Meeting not found', 404));
    }

    // Validate meeting date is at least next day
    const tomorrow = startOfDay(addMinutes(new Date(), 24 * 60));
    if (new Date(meetingDate) < tomorrow) {
      return next(new ErrorHandler('Meeting must be scheduled at least 24 hours in advance', 400));
    }

    // Check if time slot is available
    const counselor = await Counselor.findById(meeting.counselorId);
    if (!counselor) {
      return next(new ErrorHandler('Counselor not found', 404));
    }

    // Get working hours from counselor
    const startTime = counselor.workingHours?.start || "09:00";
    const endTime = counselor.workingHours?.end || "17:00";

    // Validate if selected time is within working hours
    const selectedTimeDate = new Date(`1970-01-01T${meetingTime}`);
    const workStartTime = new Date(`1970-01-01T${startTime}`);
    const workEndTime = new Date(`1970-01-01T${endTime}`);

    if (selectedTimeDate < workStartTime || selectedTimeDate >= workEndTime) {
      return next(new ErrorHandler('Selected time is outside counselor working hours', 400));
    }

    // Check if counselor is unavailable on this date
    if (counselor.unavailableDates?.some(d => 
      d.toDateString() === new Date(meetingDate).toDateString()
    )) {
      return next(new ErrorHandler('Counselor is not available on this date', 400));
    }

    // Check for existing meetings at the same time
    const existingMeeting = await Meeting.findOne({
      counselorId: counselor._id,
      meetingDate: {
        $gte: startOfDay(new Date(meetingDate)),
        $lt: endOfDay(new Date(meetingDate))
      },
      meetingTime: meetingTime,
      status: { $in: ['confirmed', 'time_selected'] }
    });

    if (existingMeeting) {
      return next(new ErrorHandler('This time slot is already booked', 400));
    }

    // Update meeting
    meeting.meetingDate = new Date(meetingDate);
    meeting.meetingTime = meetingTime;
    meeting.status = 'time_selected';
    meeting.counselorResponseDeadline = addHours(new Date(), 15);
    meeting.autoExpireAt = addHours(new Date(), 15);
    await meeting.save();

    // Notify counselor
    await sendMail({
      email: counselor.email,
      subject: 'Meeting Time Selected',
      template: 'meetingTimeSelected.ejs',
      data: {
        meetingDate,
        meetingTime
      }
    });

    res.status(200).json({
      success: true,
      meeting
    });
  }
);

// 4. Counselor Accepts Meeting
const generateMeetingInstructions = (isClient: boolean) => `
1. Click the meeting link 5 minutes before the scheduled time
2. Allow browser access to your microphone
3. Your name will appear as ${isClient ? 'Anonymous Client' : 'Anonymous Counselor'}
4. Audio will be enabled by default, but video will be disabled
5. The chat feature is available if needed
6. The session will automatically end after 45 minutes
7. Please ensure you're in a quiet, private space
8. If you experience technical issues, use the chat feature to communicate
`;


export const acceptMeeting = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { meetingId } = req.body;
    const counselorId = req.user?._id;

    const meeting = await Meeting.findOne({
      _id: meetingId,
      counselorId,
      status: 'time_selected'
    });

    if (!meeting) {
      return next(new ErrorHandler('Meeting not found or invalid status', 404));
    }

    if (!meeting.meetingDate || !meeting.meetingTime) {
      return next(new ErrorHandler('Meeting time not properly set', 400));
    }

    // Create meeting datetime
    const meetingDateTime = new Date(`${meeting.meetingDate.toISOString().split('T')[0]}T${meeting.meetingTime}`);

    // Create Daily.co room
    if (meeting.meetingType === 'virtual') {
      try {
        const room = await dailyService.createRoom(
          meeting._id.toString(),
          meetingDateTime,
          meeting.meetingDuration
        );
        meeting.dailyRoomName = room.name;
        meeting.dailyRoomUrl = room.url;
      } catch (error) {
        return next(new ErrorHandler('Failed to create virtual meeting room', 500));
      }
    }

    meeting.status = 'confirmed';
    await meeting.save();

    // Prepare meeting details
    const meetingDate = format(new Date(meeting.meetingDate!), 'MMMM dd, yyyy');
    const meetingTime = meeting.meetingTime;

    const socketEvents = req.app.get('socketEvents');
    if (socketEvents) {
      // Notify client
      socketEvents.emitBookingUpdated(meeting.clientId.toString(), {
        title: 'Meeting Confirmed',
        message: `Your meeting has been confirmed`,
        type: 'meeting_confirmed'
      });

      // Notify admin
      socketEvents.emitAdminUpdate({
        title: 'Meeting Confirmed',
        message: `A meeting has been confirmed`,
        type: 'meeting_confirmed'
      });
    }
    // 1. Notify Client
    const client = await Client.findById(meeting.clientId);
    if (client) {
      // Email notification
      await sendMail({
        email: client.email,
        subject: 'Meeting Confirmed - Access Instructions',
        template: 'meetingConfirmed.ejs',
        data: {
          meetingDate,
          meetingTime,
          meetingType: meeting.meetingType,
          instructions: generateMeetingInstructions(true),
        }
      });

      // In-app notification
      const clientNotification: INotification = {
        title: 'Meeting Confirmed',
        message: `Your meeting is scheduled for ${meetingDate} at ${meetingTime}`,
        type: 'meeting',
        read: false,
        createdAt: new Date()
      };
      
      client.notifications.push(clientNotification);
      await client.save();

    }

    // 2. Notify Counselor
    const counselor = await Counselor.findById(counselorId);
    if (counselor) {
      // Email notification
      await sendMail({
        email: counselor.email,
        subject: 'Meeting Confirmed - Access Instructions',
        template: 'counselorMeetingConfirmed.ejs',
        data: {
          meetingDate,
          meetingTime,
          meetingType: meeting.meetingType,
          instructions: generateMeetingInstructions(false),
        }
      });

      // In-app notification
      const counselorNotification: INotification = {
        title: 'Meeting Confirmed',
        message: `You have a meeting scheduled for ${meetingDate} at ${meetingTime}`,
        type: 'meeting',
        read: false,
        createdAt: new Date()
      };
      
      counselor.notifications.push(counselorNotification);
      await counselor.save();
    }

    // 3. Notify Admin
    const adminNotification: INotification = {
      title: 'Meeting Confirmed',
      message: `A ${meeting.meetingType} meeting has been confirmed for ${meetingDate} at ${meetingTime}`,
      type: 'meeting',
      read: false,
      createdAt: new Date()
    };

    await redis.lpush('admin_notifications', JSON.stringify(adminNotification));

    // Email to admin
    await sendMail({
      email: process.env.ADMIN_EMAIL || '',
      subject: 'Meeting Confirmed',
      template: 'adminMeetingConfirmed.ejs',
      data: {
        meetingId: meeting._id,
        meetingDate,
        meetingTime,
        meetingType: meeting.meetingType
      }
    });


    res.status(200).json({
      success: true,
      message: 'Meeting confirmed successfully'
    });
  }
);
// 5. Cancel Meeting
export const cancelMeeting = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { meetingId, cancellationReason } = req.body;
    const userId = req.user?._id;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return next(new ErrorHandler('Meeting not found', 404));
    }

    meeting.status = 'cancelled';
    meeting.cancellationReason = cancellationReason;
    await meeting.save();

    const client = await Client.findById(meeting.clientId);
    if (client) {
      await sendMail({
        email: client.email,
        subject: 'Meeting Cancelled',
        template: 'meetingCancelled.ejs',
        data: {
          cancellationReason,
          meetingDate: meeting.meetingDate,
          meetingTime: meeting.meetingTime
        }
      });
    }

    // Notify admin
    await sendMail({
      email: process.env.ADMIN_EMAIL || '',
      subject: 'Meeting Cancelled',
      template: 'adminMeetingCancelled.ejs',
      data: {
        meetingId: meeting._id,
        cancellationReason,
        cancelledBy: userId
      }
    });

    res.status(200).json({
      success: true,
      message: 'Meeting cancelled successfully'
    });
  }
);

// 6. Report No Show
export const reportNoShow = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { meetingId, noShowReason } = req.body;
    const userId = req.user?._id;
    const userRole = req.user?.role;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return next(new ErrorHandler('Meeting not found', 404));
    }

    meeting.status = 'abandoned';
    meeting.noShowReason = noShowReason;
    meeting.noShowReportedBy = userRole === 'client' ? 'client' : 'counselor';
    await meeting.save();

    // Notify admin
    await sendMail({
      email: process.env.ADMIN_EMAIL || '',
      subject: 'Meeting No-Show Reported',
      template: 'noShowReport.ejs',
      data: {
        meetingId: meeting._id,
        noShowReason,
        reportedBy: userRole
      }
    });

    res.status(200).json({
      success: true,
      message: 'No-show reported successfully'
    });
  }
);

// 7. Get Available Time Slots
export const getAvailableTimeSlots = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { date, counselorId } = req.query;
    
    if (!date || !counselorId) {
      return next(new ErrorHandler('Date and counselor ID are required', 400));
    }
    
    const requestedDate = new Date(date as string);

    // Check if date is in the past
    if (requestedDate < new Date()) {
      return res.status(200).json({
        success: true,
        availableSlots: []
      });
    }

    const counselor = await Counselor.findById(counselorId);
    if (!counselor) {
      return next(new ErrorHandler('Counselor not found', 404));
    }

    // Check if date is in unavailable dates
    if (counselor.unavailableDates?.some(d => d.toDateString() === requestedDate.toDateString())) {
      return res.status(200).json({
        success: true,
        availableSlots: []
      });
    }

    // Get working hours
    const startTime = counselor.workingHours?.start || "09:00";
    const endTime = counselor.workingHours?.end || "17:00";

    // Get existing meetings for that date
    const existingMeetings = await Meeting.find({
      counselorId,
      meetingDate: {
        $gte: startOfDay(requestedDate),
        $lt: endOfDay(requestedDate)
      },
      status: { $in: ['confirmed', 'time_selected'] }
    });

    // Generate all available time slots
    const slots = generateTimeSlots(
      startTime,
      endTime,
      60, // 1-hour sessions by default
      existingMeetings.map(m => m.meetingTime || '')
    );

    res.status(200).json({
      success: true,
      availableSlots: slots
    });
  }
);

// Helper function to generate time slots
function generateTimeSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number,
  bookedTimes: string[]
): string[] {
  const slots: string[] = [];
  const start = new Date(`1970-01-01T${startTime}`);
  const end = new Date(`1970-01-01T${endTime}`);

  while (start < end) {
    const timeString = start.toTimeString().slice(0, 5);
    if (!bookedTimes.includes(timeString)) {
      slots.push(timeString);
    }
    start.setMinutes(start.getMinutes() + intervalMinutes);
  }

  return slots;
}

// Update this section in your bookingController.ts
export const getMeetingToken = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { meetingId } = req.params;
    const userId = req.user?._id;

    // Early return if no user ID
    if (!userId) {
      return next(new ErrorHandler('Authentication required', 401));
    }

    console.log('Getting token for meeting:', meetingId);
    try {
      const meeting = await Meeting.findOne({
        _id: meetingId,
        status: 'confirmed',
        $or: [
          { clientId: userId },
          { counselorId: userId }
        ]
      });

      if (!meeting) {
        console.log('Meeting not found or not confirmed');
        return next(new ErrorHandler('Meeting not found or not confirmed', 404));
      }

      if (!meeting.dailyRoomName || !meeting.dailyRoomUrl) {
        console.log('Meeting room not configured');
        return next(new ErrorHandler('Meeting room not properly configured', 400));
      }

      if (!meeting.meetingDate || !meeting.meetingTime) {
        return next(new ErrorHandler('Meeting time not properly set', 400));
      }

      // Properly parse the meeting date and time
// Properly parse the meeting date and time
let meetingDateTime: Date;
try {
  // First, explicitly cast meeting.meetingDate to unknown and then to string or Date to avoid the 'never' type issue
  const meetingDate: unknown = meeting.meetingDate;
  
  // Handle string date
  if (meetingDate && typeof meetingDate === 'string') {
    if (meetingDate.includes('T')) {
      // It's already an ISO string, extract just the date part
      const datePart = meetingDate.split('T')[0];
      meetingDateTime = new Date(`${datePart}T${meeting.meetingTime}`);
    } else {
      // It's a date string without time
      meetingDateTime = new Date(`${meetingDate}T${meeting.meetingTime}`);
    }
  } 
  // Handle Date object
  else if (meetingDate && meetingDate instanceof Date) {
    const year = meetingDate.getFullYear();
    const month = String(meetingDate.getMonth() + 1).padStart(2, '0');
    const day = String(meetingDate.getDate()).padStart(2, '0');
    const datePart = `${year}-${month}-${day}`;
    meetingDateTime = new Date(`${datePart}T${meeting.meetingTime}`);
  } else {
    throw new Error('Invalid meeting date format');
  }

  if (isNaN(meetingDateTime.getTime())) {
    throw new Error('Invalid meeting date/time');
  }
} catch (error) {
  console.error('Error parsing meeting date/time:', error);
  return next(new ErrorHandler('Invalid meeting date/time format', 400));
}

      // Check if meeting time is valid (within 5 minutes before start time)
      const currentTime = new Date();
      const timeDifference = meetingDateTime.getTime() - currentTime.getTime();
      const minutesBeforeMeeting = timeDifference / (1000 * 60);

      // Add more detailed logging
      console.log('Meeting datetime:', meetingDateTime);
      console.log('Current time:', currentTime);
      console.log('Minutes before meeting:', minutesBeforeMeeting);

      if (minutesBeforeMeeting > 5) {
        return next(new ErrorHandler('Meeting room is not yet available. Please join 5 minutes before the scheduled time.', 400));
      }

      if (minutesBeforeMeeting < -meeting.meetingDuration) {
        return next(new ErrorHandler('Meeting has already ended', 400));
      }

      const isClient = meeting.clientId.toString() === userId.toString();
      
      try {
        // Create meeting token with anonymous identity
        const token = await dailyService.createMeetingToken(
          meeting.dailyRoomName!,
          isClient,
          meetingDateTime,
          meeting.meetingDuration
        );

        // Return meeting access details
        res.status(200).json({
          success: true,
          token,
          roomUrl: meeting.dailyRoomUrl,
          joinAs: isClient ? 'Anonymous Client' : 'Anonymous Counselor',
          meetingDuration: meeting.meetingDuration,
          meetingDateTime: meetingDateTime,
          meetingInstructions: {
            1: "Join 5 minutes before the scheduled time",
            2: "Ensure you're in a quiet, private space",
            3: "Your audio will be enabled by default",
            4: "Video will remain disabled for anonymity",
            5: "Chat feature is available if needed",
            6: "Session will automatically end after 45 minutes",
            7: "If you experience technical issues, use the chat feature",
          }
        });
      } catch (error) {
        console.error('Failed to create meeting token:', error);
        return next(new ErrorHandler('Failed to create meeting token', 500));
      }
    } catch (error) {
      console.error('Error in getMeetingToken:', error);
      return next(new ErrorHandler('An unexpected error occurred', 500));
    }
  }
);


// Helper function to validate meeting time
export const validateMeetingTime = (meetingDate: Date | undefined, meetingTime: string | undefined): boolean => {
  if (!meetingDate || !meetingTime) return false;
  
  const meetingDateTime = new Date(`${meetingDate.toDateString()} ${meetingTime}`);
  return meetingDateTime > new Date();
};


interface ISessionDetails {
  duration: number;
  startTime: Date;
  endTime: Date;
  meetingType: 'virtual' | 'physical';
  issueDescription: string;
  status: 'completed' | 'no_show' | 'cancelled';
}
// Update completeMeeting to handle room cleanup
export const completeMeeting = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { meetingId } = req.params;
    const { sessionDetails } = req.body;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return next(new ErrorHandler('Meeting not found', 404));
    }

    // Calculate session duration and details
    const sessionData: ISessionDetails = {
      duration: sessionDetails?.duration || 0, // Duration in minutes
      startTime: meeting.meetingDate!,
      endTime: new Date(),
      meetingType: meeting.meetingType,
      issueDescription: meeting.issueDescription,
      status: sessionDetails?.status || 'completed'
    };

    // Update client's session history
    const client = await Client.findById(meeting.clientId);
    if (client) {
      // Add to session history
      client.sessionHistory.push({
        counselorId: meeting.counselorId!,
        sessionDate: meeting.meetingDate!,
        sessionType: meeting.meetingType,
        status: 'completed',
        issueDescription: meeting.issueDescription
      });

      // Update current counselor if not set
      if (!client.currentCounselor) {
        client.currentCounselor = meeting.counselorId;
      }

      await client.save();

      await redis.del(client._id.toString());
    }

    // Update counselor's statistics
    const counselor = await Counselor.findById(meeting.counselorId);
    if (counselor) {
      counselor.totalSessions += 1;
      counselor.completedSessions += 1;
      
      // Update active clients count if this is a new client
      const existingSessions = counselor.totalSessions || 0;
      if (existingSessions === 1) {
        counselor.activeClients = (counselor.activeClients || 0) + 1;
      }

      await counselor.save();
      await redis.del(counselor._id.toString());
    }

    // Clean up virtual meeting room if applicable
    if (meeting.meetingType === 'virtual' && meeting.dailyRoomName) {
      try {
        await dailyService.deleteRoom(meeting.dailyRoomName);
      } catch (error) {
        console.error('Failed to delete Daily.co room:', error);
      }
    }

    // Update meeting status
    meeting.status = 'completed';
    await meeting.save();

    // Create detailed session record
    await createSessionRecord(meeting, sessionData);

    res.status(200).json({
      success: true,
      message: 'Meeting completed and history updated successfully'
    });
  }
);
async function createSessionRecord(meeting: any, sessionDetails: ISessionDetails) {
  const SessionRecord = mongoose.model('SessionRecord', new mongoose.Schema({
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      required: true
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true
    },
    counselorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counselor',
      required: true
    },
    sessionDate: {
      type: Date,
      required: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    },
    duration: {
      type: Number,
      required: true
    },
    meetingType: {
      type: String,
      enum: ['virtual', 'physical'],
      required: true
    },
    issueDescription: String,
    status: {
      type: String,
      enum: ['completed', 'no_show', 'cancelled'],
      required: true
    },
    notes: String,
    feedback: {
      rating: Number,
      comment: String,
      submittedAt: Date
    }
  }, { timestamps: true }));

  await SessionRecord.create({
    meetingId: meeting._id,
    clientId: meeting.clientId,
    counselorId: meeting.counselorId,
    sessionDate: meeting.meetingDate,
    ...sessionDetails
  });
}

interface IPopulatedMeeting extends Omit<IMeeting, 'counselorId' | 'clientId'> {
  counselorId: PopulatedDoc<ICounselor & Document>;
  clientId: PopulatedDoc<IClient & Document>;
}


// Get session history for client
export const getClientSessionHistory = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.user?._id;
    
    const sessionHistory = await Meeting.find({
      clientId,
      status: { $in: ['completed', 'cancelled', 'abandoned'] }
    })
    .populate<IPopulatedMeeting>('counselorId', 'fullName avatar rating')
    .sort({ meetingDate: -1 });

    const formattedHistory = sessionHistory.map(session => ({
      id: session._id,
      counselorName: session.counselorId instanceof mongoose.Types.ObjectId 
        ? 'Unknown'
        : session.counselorId?.fullName || 'Unknown',
      counselorAvatar: session.counselorId instanceof mongoose.Types.ObjectId 
        ? undefined 
        : session.counselorId?.avatar?.imageUrl,
      counselorRating: session.counselorId instanceof mongoose.Types.ObjectId 
        ? undefined 
        : session.counselorId?.rating,
      date: session.meetingDate ? format(new Date(session.meetingDate), 'PPP') : 'N/A',
      time: session.meetingTime,
      type: session.meetingType,
      status: session.status,
      issue: session.issueDescription
    }));

    res.status(200).json({
      success: true,
      history: formattedHistory
    });
  }
);

// Get session history for counselor
export const getCounselorSessionHistory = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const counselorId = req.user?._id;
    
    const sessionHistory = await Meeting.find({
      counselorId,
      status: { $in: ['completed', 'cancelled', 'abandoned'] }
    })
    .populate<IPopulatedMeeting>('clientId', 'username avatar age marriageYears')
    .sort({ meetingDate: -1 });

    const formattedHistory = sessionHistory.map(session => ({
      id: session._id,
      clientUsername: session.clientId instanceof mongoose.Types.ObjectId 
        ? 'Anonymous' 
        : session.clientId?.username || 'Anonymous',
      clientAvatar: session.clientId instanceof mongoose.Types.ObjectId 
        ? undefined 
        : session.clientId?.avatar?.imageUrl,
      clientAge: session.clientId instanceof mongoose.Types.ObjectId 
        ? undefined 
        : session.clientId?.age,
      clientMarriageYears: session.clientId instanceof mongoose.Types.ObjectId 
        ? undefined 
        : session.clientId?.marriageYears,
      date: session.meetingDate ? format(new Date(session.meetingDate), 'PPP') : 'N/A',
      time: session.meetingTime,
      type: session.meetingType,
      status: session.status,
      issue: session.issueDescription
    }));

    res.status(200).json({
      success: true,
      history: formattedHistory
    });
  }
);

// Get detailed session statistics for counselor
export const getCounselorStatistics = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const counselorId = req.user?._id;
    
    const counselor = await Counselor.findById(counselorId);
    if (!counselor) {
      return next(new ErrorHandler('Counselor not found', 404));
    }

    const recentSessions = await Meeting.find({
      counselorId,
      status: 'completed'
    })
    .sort({ meetingDate: -1 })
    .limit(5)
    .populate<IPopulatedMeeting>('clientId', 'username');

    const formattedRecentSessions = recentSessions.map(session => ({
      id: session._id,
      clientUsername: session.clientId instanceof mongoose.Types.ObjectId 
        ? 'Anonymous' 
        : session.clientId?.username || 'Anonymous',
      date: session.meetingDate ? format(new Date(session.meetingDate), 'PPP') : 'N/A',
      type: session.meetingType
    }));

    const statistics = {
      totalSessions: counselor.totalSessions,
      completedSessions: counselor.completedSessions,
      cancelledSessions: counselor.cancelledSessions,
      activeClients: counselor.activeClients,
      averageRating: counselor.totalRatings ? counselor.averageRating : 'N/A',
      totalRatings: counselor.totalRatings || 0,
      recentSessions: formattedRecentSessions
    };

    res.status(200).json({
      success: true,
      statistics
    });
  }
);


export const getCounselorActiveSession = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const counselorId = req.user?._id;

    // Find active meeting for counselor without date restriction
    const activeSession = await Meeting.findOne({
      counselorId,
      status: 'confirmed',
    }).populate('clientId', 'fullName email avatar username age marriageYears preferredCounselorGender');

    if (!activeSession) {
      return res.status(200).json({
        success: true,
        booking: null
      });
    }

    res.status(200).json({
      success: true,
      booking: activeSession
    });
  }
);

interface IRatingBody {
  rating: number;
  feedback?: string;
}

export const rateSession = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { meetingId } = req.params;
    const { rating, feedback }: IRatingBody = req.body;
    const clientId = req.user?._id;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return next(new ErrorHandler('Please provide a valid rating between 1 and 5', 400));
    }

    // Find the meeting
    const meeting = await Meeting.findOne({
      _id: meetingId,
      clientId,
      status: 'completed'
    });

    if (!meeting) {
      return next(new ErrorHandler('Meeting not found or not eligible for rating', 404));
    }

    // Check if meeting was already rated
    const client = await Client.findById(clientId);
    if (!client) {
      return next(new ErrorHandler('Client not found', 404));
    }

    const sessionIndex = client.sessionHistory.findIndex(
      session => session.counselorId.toString() === meeting.counselorId?.toString() &&
      session.sessionDate.toISOString() === meeting.meetingDate?.toISOString()
    );

    if (sessionIndex === -1) {
      return next(new ErrorHandler('Session record not found', 404));
    }

    if (client.sessionHistory[sessionIndex].rating) {
      return next(new ErrorHandler('Session has already been rated', 400));
    }

    // Update session history in client record
    client.sessionHistory[sessionIndex].rating = rating;
    client.sessionHistory[sessionIndex].feedback = feedback;
    await client.save();

    // Update counselor's rating
    const counselor = await Counselor.findById(meeting.counselorId);
    if (!counselor) {
      return next(new ErrorHandler('Counselor not found', 404));
    }

    // Calculate new average rating
    counselor.totalRatings = (counselor.totalRatings || 0) + 1;
    
    if (counselor.averageRating) {
      const oldRatingTotal = counselor.averageRating * (counselor.totalRatings - 1);
      counselor.averageRating = (oldRatingTotal + rating) / counselor.totalRatings;
    } else {
      counselor.averageRating = rating;
    }
    
    await counselor.save();

    // Notify counselor of new rating
    await sendMail({
      email: counselor.email,
      subject: 'New Session Rating Received',
      template: 'sessionRating.ejs',
      data: {
        rating,
        feedback,
        sessionDate: meeting.meetingDate,
        averageRating: counselor.averageRating
      }
    });

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Session rated successfully',
      data: {
        rating,
        feedback,
        counselorNewRating: counselor.averageRating
      }
    });
  }
);

// Get session rating status
export const getSessionRatingStatus = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { meetingId } = req.params;
    const clientId = req.user?._id;

    const meeting = await Meeting.findOne({
      _id: meetingId,
      clientId,
      status: 'completed'
    });

    if (!meeting) {
      return next(new ErrorHandler('Meeting not found or not completed', 404));
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return next(new ErrorHandler('Client not found', 404));
    }

    const session = client.sessionHistory.find(
      session => session.counselorId.toString() === meeting.counselorId?.toString() &&
      session.sessionDate.toISOString() === meeting.meetingDate?.toISOString()
    );

    res.status(200).json({
      success: true,
      data: {
        isRated: !!session?.rating,
        rating: session?.rating || null,
        feedback: session?.feedback || null
      }
    });
  }
);

interface IFeedback {
  sessionId: string;
  clientUsername: string;
  sessionDate: string;
  sessionTime: string;
  meetingType: string;
  rating: number;
  feedback?: string;
  issueDescription: string;
}

export const getCounselorFeedback = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const counselorId = req.user?._id;
    
    if (!counselorId) {
      return next(new ErrorHandler('Counselor ID not found', 401));
    }

    const { page = 1, limit = 10, sortBy = 'date', order = 'desc' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Define interface for populated client
    interface IPopulatedClient {
      _id: mongoose.Types.ObjectId;
      username: string;
      sessionHistory: Array<{
        counselorId: mongoose.Types.ObjectId;
        sessionDate: Date;
        rating?: number;
        feedback?: string;
      }>;
    }

    // Define interface for populated meeting
    interface IPopulatedMeeting extends Omit<IMeeting, 'clientId'> {
      clientId: IPopulatedClient;
      meetingDate?: Date;
      meetingTime?: string;
      meetingType: 'virtual' | 'physical';
      issueDescription: string;
    }

    // Find all completed meetings for the counselor with populated client data
    const completedMeetings = await Meeting.find({
      counselorId,
      status: 'completed'
    })
    .populate<{ clientId: IPopulatedClient }>('clientId', 'username sessionHistory')
    .sort({ meetingDate: order === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(limitNum);

    // Process meetings to get feedback
    const feedbackList: IFeedback[] = [];
    const processedSessionIds = new Set();

    for (const meeting of completedMeetings) {
      if (!meeting.clientId || !mongoose.isValidObjectId(meeting.clientId._id)) continue;
      
      const client = meeting.clientId as IPopulatedClient;

      // Find corresponding session in client's history
      const session = client.sessionHistory?.find(
        s => s.counselorId.toString() === counselorId.toString() &&
        s.sessionDate.toISOString() === meeting.meetingDate?.toISOString()
      );

      // Only include sessions that have ratings and haven't been processed yet
      const sessionId = meeting._id.toString();
      if (session?.rating && !processedSessionIds.has(sessionId)) {
        processedSessionIds.add(sessionId);
        feedbackList.push({
          sessionId,
          clientUsername: client.username || 'Anonymous',
          sessionDate: meeting.meetingDate ? format(new Date(meeting.meetingDate), 'PPP') : 'N/A',
          sessionTime: meeting.meetingTime || 'N/A',
          meetingType: meeting.meetingType,
          rating: session.rating,
          feedback: session.feedback,
          issueDescription: meeting.issueDescription
        });
      }
    }

    // Calculate statistics
    const totalRatings = feedbackList.length;
    const averageRating = totalRatings > 0
      ? feedbackList.reduce((sum, item) => sum + item.rating, 0) / totalRatings
      : 0;
    
    const ratingDistribution = {
      5: feedbackList.filter(f => f.rating === 5).length,
      4: feedbackList.filter(f => f.rating === 4).length,
      3: feedbackList.filter(f => f.rating === 3).length,
      2: feedbackList.filter(f => f.rating === 2).length,
      1: feedbackList.filter(f => f.rating === 1).length
    };

    // Get total count for pagination
    const total = await Meeting.countDocuments({
      counselorId,
      status: 'completed'
    });

    res.status(200).json({
      success: true,
      data: {
        feedback: feedbackList,
        statistics: {
          totalRatings,
          averageRating: averageRating.toFixed(1),
          ratingDistribution
        },
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum
        }
      }
    });
  }
);

// Get all meetings with detailed information
export const getAllMeetings = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { 
      page = 1, 
      limit = 10, 
      status,
      startDate,
      endDate,
      meetingType
    } = req.query;

    const queryFilter: any = {};

    // Apply filters if provided
    if (status) queryFilter.status = status;
    if (meetingType) queryFilter.meetingType = meetingType;
    if (startDate && endDate) {
      queryFilter.meetingDate = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string)
      };
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const meetings = await Meeting.find(queryFilter)
      .populate('clientId', 'username email avatar')
      .populate('counselorId', 'fullName email avatar')
      .sort({ meetingDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Meeting.countDocuments(queryFilter);

    res.status(200).json({
      success: true,
      data: {
        meetings,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum
        }
      }
    });
  }
);

// Get detailed analytics for admin dashboard
export const getDashboardAnalytics = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    // Get current date and start of month
    const currentDate = new Date();
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const lastMonthStart = startOfMonth(subMonths(currentDate, 1));
    const lastMonthEnd = endOfMonth(subMonths(currentDate, 1));

    // Overall statistics
    const totalMeetings = await Meeting.countDocuments();
    const completedMeetings = await Meeting.countDocuments({ status: 'completed' });
    const cancelledMeetings = await Meeting.countDocuments({ status: 'cancelled' });
    const noShowMeetings = await Meeting.countDocuments({ status: 'abandoned' });

    // Current month statistics
    const currentMonthMeetings = await Meeting.countDocuments({
      meetingDate: { $gte: monthStart, $lte: monthEnd }
    });

    // Last month statistics for comparison
    const lastMonthMeetings = await Meeting.countDocuments({
      meetingDate: { $gte: lastMonthStart, $lte: lastMonthEnd }
    });

    // Get meeting type distribution
    const virtualMeetings = await Meeting.countDocuments({ meetingType: 'virtual' });
    const physicalMeetings = await Meeting.countDocuments({ meetingType: 'physical' });

    // Get counselor performance metrics
    const counselors = await Counselor.find().select('fullName averageRating totalSessions');
    
    // Calculate monthly growth
    const monthlyGrowth = lastMonthMeetings > 0 
      ? ((currentMonthMeetings - lastMonthMeetings) / lastMonthMeetings) * 100 
      : 100;

    // Get completion rate
    const completionRate = totalMeetings > 0 
      ? (completedMeetings / totalMeetings) * 100 
      : 0;

    res.status(200).json({
      success: true,
      analytics: {
        overview: {
          totalMeetings,
          completedMeetings,
          cancelledMeetings,
          noShowMeetings,
          completionRate: completionRate.toFixed(2) + '%'
        },
        growth: {
          currentMonthMeetings,
          lastMonthMeetings,
          monthlyGrowth: monthlyGrowth.toFixed(2) + '%'
        },
        distribution: {
          virtualMeetings,
          physicalMeetings,
          virtualPercentage: ((virtualMeetings / totalMeetings) * 100).toFixed(2) + '%',
          physicalPercentage: ((physicalMeetings / totalMeetings) * 100).toFixed(2) + '%'
        },
        counselorMetrics: counselors
      }
    });
  }
);

// Get detailed session history
export const getAllSessionHistory = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { 
      page = 1, 
      limit = 10,
      counselorId,
      startDate,
      endDate 
    } = req.query;

    const queryFilter: any = {
      status: 'completed'
    };

    if (counselorId) queryFilter.counselorId = counselorId;
    if (startDate && endDate) {
      queryFilter.meetingDate = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string)
      };
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const sessions = await Meeting.find(queryFilter)
      .populate('clientId', 'username email avatar age marriageYears')
      .populate('counselorId', 'fullName email avatar rating')
      .sort({ meetingDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Meeting.countDocuments(queryFilter);

    // Get session details including ratings from client's history
    const detailedSessions = await Promise.all(
      sessions.map(async (session) => {
        const client = await Client.findById(session.clientId);
        const sessionRating = client?.sessionHistory.find(
          (h) => h.counselorId.toString() === session.counselorId?.toString() &&
                 h.sessionDate.toISOString() === session.meetingDate?.toISOString()
        );

        return {
          ...session.toObject(),
          rating: sessionRating?.rating || null,
          feedback: sessionRating?.feedback || null
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        sessions: detailedSessions,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum
        }
      }
    });
  }
);


interface ISessionHistoryItem {
  counselorId: mongoose.Types.ObjectId;
  sessionDate: Date;
  sessionType: string;
  status: string;
  rating?: number;
  feedback?: string;
}

interface IClientWithSession {
  _id: mongoose.Types.ObjectId;
  username: string;
  sessionHistory: ISessionHistoryItem[];
}

interface ICounselorPopulated {
  _id: mongoose.Types.ObjectId;
  fullName: string;
  email: string;
  avatar?: {
    imageUrl: string;
  };
}

type ClientDocument = Document & IClientWithSession;

// Get all feedback for admin review
export const getAllFeedback = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { 
      page = 1, 
      limit = 10,
      minRating,
      maxRating,
      counselorId 
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Find all clients with session history
    const clients = await Client.find({
      'sessionHistory.rating': { $exists: true }
    }).lean() as IClientWithSession[];

    // Extract all rated sessions
    let allFeedback: any[] = [];
    for (const client of clients) {
      const ratedSessions = client.sessionHistory.filter(session => session.rating);
      
      for (const session of ratedSessions) {
        if (counselorId && session.counselorId.toString() !== counselorId) continue;
        if (minRating && session.rating && session.rating < parseInt(minRating as string)) continue;
        if (maxRating && session.rating && session.rating > parseInt(maxRating as string)) continue;

        const meeting = await Meeting.findOne({
          clientId: client._id,
          counselorId: session.counselorId,
          meetingDate: session.sessionDate
        }).populate<{ counselorId: ICounselorPopulated }>('counselorId', 'fullName email avatar');

        if (meeting) {
          allFeedback.push({
            sessionId: meeting._id,
            clientUsername: client.username,
            counselorName: meeting.counselorId instanceof mongoose.Types.ObjectId 
              ? 'Unknown'
              : (meeting.counselorId as ICounselorPopulated).fullName || 'Unknown',
            counselorEmail: meeting.counselorId instanceof mongoose.Types.ObjectId
              ? 'Unknown'
              : (meeting.counselorId as ICounselorPopulated).email || 'Unknown',
            sessionDate: format(session.sessionDate, 'PPP'),
            meetingType: meeting.meetingType,
            rating: session.rating,
            feedback: session.feedback || 'No feedback provided',
            issueDescription: meeting.issueDescription
          });
        }
      }
    }

    // Sort feedback by date (newest first)
    allFeedback.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());

    // Apply pagination
    const paginatedFeedback = allFeedback.slice(skip, skip + limitNum);

    // Calculate statistics
    const totalRatings = allFeedback.length;
    const averageRating = totalRatings > 0
      ? allFeedback.reduce((sum, item) => sum + (item.rating || 0), 0) / totalRatings
      : 0;

    const ratingDistribution = {
      5: allFeedback.filter(f => f.rating && f.rating === 5).length,
      4: allFeedback.filter(f => f.rating && f.rating === 4).length,
      3: allFeedback.filter(f => f.rating && f.rating === 3).length,
      2: allFeedback.filter(f => f.rating && f.rating === 2).length,
      1: allFeedback.filter(f => f.rating && f.rating === 1).length
    };

    res.status(200).json({
      success: true,
      data: {
        feedback: paginatedFeedback,
        statistics: {
          totalRatings,
          averageRating: averageRating.toFixed(1),
          ratingDistribution
        },
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(allFeedback.length / limitNum),
          totalItems: allFeedback.length,
          itemsPerPage: limitNum
        }
      }
    });
  }
);

export const getActiveBooking = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const booking = await Meeting.findOne({
        clientId: req.user?._id,
        status: { 
          $in: ['request_pending', 'counselor_assigned', 'time_selected', 'confirmed'] 
        }
      }).populate('counselorId', 'fullName email avatar');
      
      res.status(200).json({
        success: true,
        booking
      });
    } catch (error) {
      next(error);
    }
  }
);
