// types/express-session.d.ts
import 'express-session';
import { Types } from 'mongoose';

// Augment express-session with custom properties
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