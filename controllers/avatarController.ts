import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from '../middleware/catchAsyncErrors';
import ErrorHandler from '../utils/errorHandler';
import { avatarOptions } from '../config/avatarOptions';
import { getAvatarsByCategory } from '../utils/avatar';

export const getAvailableAvatars = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { category } = req.query;
        
        let avatars;
        if (category && ['male', 'female', 'neutral'].includes(category as string)) {
          // Use the utility function to get avatars by category
          avatars = getAvatarsByCategory(category as 'male' | 'female' | 'neutral');
        } else {
          // Get all avatars using utility function
          avatars = {
            male: avatarOptions.male,
            female: avatarOptions.female,
            neutral: avatarOptions.neutral
          };
        }
  
        res.status(200).json({
          success: true,
          avatars
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    }
  );
  