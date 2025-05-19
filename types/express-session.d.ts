import 'express-session';
import { Types } from 'mongoose';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    user: {
      _id?: string | Types.ObjectId;
      email: string;
      role: 'client' | 'admin' | 'counselor';
      isVerified?: boolean;
      isActive?: boolean;
      avatar?: {
        avatarId: string;
        imageUrl: string;
      };
      lastActive?: Date;
      tourViewed?: boolean;
      [key: string]: any;
    };
  }
}