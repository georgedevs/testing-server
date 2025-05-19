import cron from 'node-cron';
import { Meeting } from '../models/bookingModel';
import { Client, Counselor } from '../models/userModel';
import { redis } from './redis';

export const initSessionCleanup = () => {
  // Run every 5 minutes to check for expired grace periods
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      console.log(`Running session cleanup at ${now.toISOString()}`);
      
      // Find sessions where grace period has expired
      const expiredGraceSessions = await Meeting.find({
        graceActive: true,
        graceEndTime: { $lt: now },
        status: 'confirmed'
      });

      for (const meeting of expiredGraceSessions) {
        console.log(`Processing expired grace period for meeting ${meeting._id}`);
        
        // Determine completion status based on participant activity
        let completionStatus: 'completed' | 'client_only' | 'counselor_only' | 'incomplete';
        
        if (meeting.clientJoined && meeting.counselorJoined) {
          completionStatus = 'completed';
        } else if (meeting.clientJoined && !meeting.counselorJoined) {
          completionStatus = 'client_only';
        } else if (!meeting.clientJoined && meeting.counselorJoined) {
          completionStatus = 'counselor_only';
        } else {
          completionStatus = 'incomplete';
        }

        // Update meeting status
        meeting.status = completionStatus;
        meeting.graceActive = false;
        await meeting.save();

        // Update client's session history if applicable
        if (completionStatus !== 'incomplete') {
          const client = await Client.findById(meeting.clientId);
          if (client) {
            // Check if session already exists in history to avoid duplicates
            const existingSession = client.sessionHistory.find(
              session => 
                session.counselorId.toString() === meeting.counselorId?.toString() &&
                session.sessionDate.toISOString() === meeting.meetingDate?.toISOString()
            );

            if (!existingSession) {
              client.sessionHistory.push({
                counselorId: meeting.counselorId!,
                sessionDate: meeting.meetingDate!,
                sessionType: meeting.meetingType,
                status: completionStatus === 'completed' ? 'completed' : 'cancelled',
                issueDescription: meeting.issueDescription
              });

              // Update current counselor if session was completed or client attended
              if (completionStatus === 'completed' || completionStatus === 'client_only') {
                client.currentCounselor = meeting.counselorId;
              }

              await client.save();
              
              // Clear client cache
              await redis.del(client._id.toString());
            }
          }
        }

        // Update counselor's statistics if they joined
        if (meeting.counselorJoined) {
          const counselor = await Counselor.findById(meeting.counselorId);
          if (counselor) {
            counselor.totalSessions += 1;
            
            if (completionStatus === 'completed') {
              counselor.completedSessions += 1;
            }
            
            // Update active clients count if this is a new client
            const existingSessions = counselor.totalSessions || 0;
            if (existingSessions === 1) {
              counselor.activeClients = (counselor.activeClients || 0) + 1;
            }

            await counselor.save();
            
            // Clear counselor cache
            await redis.del(counselor._id.toString());
          }
        }

        console.log(`Meeting ${meeting._id} marked as ${completionStatus}`);
      }

      // Also check for sessions that should have ended (more than 1 hour after scheduled time)
      const overdueSessions = await Meeting.find({
        status: 'confirmed',
        meetingDate: { $exists: true },
        meetingTime: { $exists: true },
        graceActive: { $ne: true }
      });

      for (const meeting of overdueSessions) {
        // Parse meeting datetime properly
        let meetingDateTime: Date;
        try {
          // First, check if meetingDate and meetingTime exist
          if (!meeting.meetingDate || !meeting.meetingTime) {
            console.error(`Meeting ${meeting._id} missing date or time`);
            continue;
          }

          if (typeof meeting.meetingDate === 'string') {
            const dateString = meeting.meetingDate as string; 
            const dateOnly = dateString.includes('T') 
              ? dateString.split('T')[0] 
              : dateString;
            meetingDateTime = new Date(`${dateOnly}T${meeting.meetingTime}`);
          } 
          // Handle Date object type
          else if (meeting.meetingDate instanceof Date) {
            const dateObj = meeting.meetingDate as Date; 
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            meetingDateTime = new Date(`${dateStr}T${meeting.meetingTime}`);
          } 
          // Handle unexpected type
          else {
            console.error(`Unexpected meetingDate type for meeting ${meeting._id}:`, typeof meeting.meetingDate);
            continue;
          }

          // Check if date is valid
          if (isNaN(meetingDateTime.getTime())) {
            console.error(`Invalid meeting date/time for meeting ${meeting._id}`);
            continue;
          }

          // Session should end 1 hour after start (with some buffer)
          const sessionEndTime = new Date(meetingDateTime.getTime() + (60 * 60 * 1000)); // 1 hour after start

          if (now > sessionEndTime) {
            console.log(`Processing overdue session ${meeting._id}`);
            
            // Mark as completed if both joined, otherwise as abandoned
            const completionStatus = (meeting.clientJoined && meeting.counselorJoined) 
              ? 'completed' 
              : 'abandoned';

            meeting.status = completionStatus;
            await meeting.save();

            // Update histories if completed
            if (completionStatus === 'completed') {
              // Update client's session history
              const client = await Client.findById(meeting.clientId);
              if (client) {
                const existingSession = client.sessionHistory.find(
                  session => 
                    session.counselorId.toString() === meeting.counselorId?.toString() &&
                    session.sessionDate.toISOString() === meeting.meetingDate?.toISOString()
                );

                if (!existingSession) {
                  client.sessionHistory.push({
                    counselorId: meeting.counselorId!,
                    sessionDate: meeting.meetingDate!,
                    sessionType: meeting.meetingType,
                    status: 'completed',
                    issueDescription: meeting.issueDescription
                  });

                  client.currentCounselor = meeting.counselorId;
                  await client.save();
                  await redis.del(client._id.toString());
                }
              }

              // Update counselor's statistics
              const counselor = await Counselor.findById(meeting.counselorId);
              if (counselor) {
                counselor.totalSessions += 1;
                counselor.completedSessions += 1;
                
                const existingSessions = counselor.totalSessions || 0;
                if (existingSessions === 1) {
                  counselor.activeClients = (counselor.activeClients || 0) + 1;
                }

                await counselor.save();
                await redis.del(counselor._id.toString());
              }
            }

            console.log(`Overdue meeting ${meeting._id} marked as ${completionStatus}`);
          }
        } catch (error) {
          console.error(`Error processing overdue meeting ${meeting._id}:`, error);
        }
      }

      console.log(`Session cleanup completed. Processed ${expiredGraceSessions.length} expired grace periods and checked ${overdueSessions.length} overdue sessions.`);

    } catch (error) {
      console.error('Error in session cleanup job:', error);
    }
  });

  console.log('Session cleanup cron job scheduled to run every 5 minutes');
};