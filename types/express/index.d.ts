import { Types } from 'mongoose';
import { IUser } from '../../models/userModel';

declare global {
  namespace Express {
    interface Request {
      deviceId?: string;
      user?: IUser;
      cookies: {
        device_id?: string;
      };
    }

    interface Session {
      userId?: string;
      user?: {
        _id: Types.ObjectId;
        email: string;
        role: string;
        isVerified: boolean;
        isActive: boolean;
        avatar?: any;
        lastActive: Date;
        [key: string]: any;
      };
    }
  }
}

export {};