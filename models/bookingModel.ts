
import mongoose, { Schema, Document } from 'mongoose';
import { Types } from 'mongoose';

export interface IMeeting extends Document {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  counselorId?: Types.ObjectId;
  meetingType: 'virtual' | 'physical';
  issueDescription: string;
  meetingDate?: Date;
  meetingTime?: string;
  status: 'request_pending' | 'counselor_assigned' | 'time_selected' | 'confirmed' | 'cancelled' | 'completed' | 'abandoned';
  autoAssigned?: boolean;
  cancellationReason?: string;
  noShowReason?: string;
  noShowReportedBy?: 'client' | 'counselor';
  adminAssignedBy?: Types.ObjectId;
  adminAssignedAt?: Date;
  counselorResponseDeadline?: Date;
  createdAt: Date;
  updatedAt: Date;
  autoExpireAt?: Date;
  dailyRoomName?: string;
  dailyRoomUrl?: string;
  dailyToken?: string;
  meetingDuration: number;
}
const meetingSchema = new Schema({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  counselorId: {
    type: Schema.Types.ObjectId,
    ref: 'Counselor'
  },
  meetingType: {
    type: String,
    enum: ['virtual', 'physical'],
    required: true
  },
  issueDescription: {
    type: String,
    required: true
  },
  meetingDate: {
    type: Date
  },
  meetingTime: {
    type: String
  },
  status: {
    type: String,
    enum: ['request_pending', 'counselor_assigned', 'time_selected', 'confirmed', 'cancelled', 'completed', 'abandoned'],
    default: 'request_pending'
  },
  autoAssigned: {
    type: Boolean,
    default: false
  },
  cancellationReason: String,
  noShowReason: String,
  noShowReportedBy: {
    type: String,
    enum: ['client', 'counselor']
  },
  adminAssignedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin'
  },
  adminAssignedAt: Date,
  counselorResponseDeadline: Date,
  autoExpireAt: {
    type: Date,
    index: { expires: 0 }
  },
  dailyRoomName: {
    type: String,
  },
  dailyRoomUrl: {
    type: String,
  },
  dailyToken: {
    type: String,
  },
  meetingDuration: {
    type: Number,
    default: 45 
  }
}, {
  timestamps: true
});

export const Meeting = mongoose.model<IMeeting>('Meeting', meetingSchema);