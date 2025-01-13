require ('dotenv').config();
import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const sendSMS = async (to: string, message: string): Promise<void> => {
  try {
    await twilioClient.messages.create({
      body: message,
      to,
      from: process.env.TWILIO_PHONE_NUMBER
    });
  } catch (error: any) {
    console.error('SMS sending failed:', error.message);
  }
};