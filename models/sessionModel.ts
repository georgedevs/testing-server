import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  meetingId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  counselorId: mongoose.Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  status: 'scheduled' | 'active' | 'completed' | 'missed';
  twilioRoomSid?: string;
  twilioConversationSid?: string;
  notes?: string;
  rating?: number;
  feedback?: string;
}

const sessionSchema = new Schema({
  meetingId: {
    type: Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true
  },
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  counselorId: {
    type: Schema.Types.ObjectId,
    ref: 'Counselor',
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: Date,
  status: {
    type: String,
    enum: ['scheduled', 'active', 'completed', 'missed'],
    default: 'scheduled'
  },
  twilioRoomSid: String,
  twilioConversationSid: String,
  notes: String,
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: String
}, {
  timestamps: true
});

export const Session = mongoose.model<ISession>('Session', sessionSchema);