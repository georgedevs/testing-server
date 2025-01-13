import { Types } from 'mongoose';
import { IUser } from '../../models/userModel';

declare global {
  namespace Express {
    interface Request {
      deviceId?: string;
      user?: IUser;
      cookies: {
        access_token?: string;
        refresh_token?: string;
        device_id?: string;
      };
    }
  }
}

export {};