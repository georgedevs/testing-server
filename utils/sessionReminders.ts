import cron from 'node-cron';
import { Session } from '../models/sessionModel';
import { Client, Counselor } from '../models/userModel';
import sendMail from '../utils/sendMail';
import { subHours } from 'date-fns';

export const setupSessionReminders = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      // Find sessions starting in the next hour that haven't sent reminders
      const upcomingSessions = await Session.find({
        status: 'scheduled',
        startTime: {
          $gt: new Date(),
          $lte: new Date(Date.now() + 60 * 60 * 1000) // Next hour
        }
      }).populate('clientId counselorId');

      for (const session of upcomingSessions) {
        // Send email to client
        const client = session.clientId as any;
        await sendMail({
          email: client.email,
          subject: 'Upcoming Session Reminder',
          template: 'sessionReminder.ejs',
          data: {
            startTime: session.startTime,
            type: 'client'
          }
        });

        // Send email to counselor
        const counselor = session.counselorId as any;
        await sendMail({
          email: counselor.email,
          subject: 'Upcoming Session Reminder',
          template: 'sessionReminder.ejs',
          data: {
            startTime: session.startTime,
            type: 'counselor'
          }
        });
      }
    } catch (error) {
      console.error('Error sending session reminders:', error);
    }
  });
};