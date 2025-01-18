import { Request, Response, NextFunction } from "express";
import { User, Client, Counselor, Admin, IUser, IAdmin, ICounselor, IClient } from "../models/userModel";
import ErrorHandler from "../utils/errorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import {clearTokens, generateAccessToken, generateRefreshToken, sendToken } from "../utils/jwt";
import { redis } from "../utils/redis";
import { Types } from "mongoose";
import { avatarOptions } from "../config/avatarOptions";
import { SessionManager } from "../utils/sessionManager";
import { getAvatarDetails, validateAvatarId } from "../utils/avatar";

const getRedisKey = (userId: Types.ObjectId | string): string => {
    return userId.toString();
  };

// Interfaces for registration
interface IRegistrationBody {
  email: string;
  password: string;
  role?: "client" | "admin" | "counselor";
  registrationToken?: string; // for counselor registration
  fullName?: string; // required for counselor and admin
}

interface IActivationToken {
  token: string;
  activationCode: string;
}

// Helper to create activation token
const createActivationToken = (user: IRegistrationBody): IActivationToken => {
  // Generate 6-digit activation code
  const activationCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  const token = jwt.sign(
    { user, activationCode },
    process.env.ACTIVATION_SECRET as Secret,
    { expiresIn: "5m" }
  );
  
  return { token, activationCode };
};


const validateCounselorToken = async (token: string): Promise<boolean> => {
  try {
    // Split token into its components
    const [tokenPart, expirationPart] = token.split('_');
    if (!tokenPart || !expirationPart) {
      return false;
    }

    // Convert expiration to number
    const expirationTime = parseInt(expirationPart);
    if (isNaN(expirationTime)) {
      return false;
    }

    // Check if token has expired
    if (Date.now() > expirationTime) {
      return false;
    }

    // Find token in admin's activity log
    const admin = await Admin.findOne({
      activityLog: {
        $elemMatch: {
          details: `${token}_unused`,
          action: "COUNSELOR_INVITATION"
        }
      }
    });

    if (!admin) {
      return false;
    }

    // Mark token as used
    await Admin.updateOne(
      { 
        "activityLog.details": `${token}_unused`,
        "activityLog.action": "COUNSELOR_INVITATION"
      },
      { 
        $set: { 
          "activityLog.$.details": `${token}_used` 
        } 
      }
    );

    return true;
  } catch (error) {
    console.error("Token validation error:", error);
    return false;
  }
};
// Main registration controller
export const userRegistration = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, role = "client", registrationToken, fullName }: IRegistrationBody = req.body;

      // Check if email exists
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return next(new ErrorHandler("Email already registered", 400));
      }

      // Validate role-specific requirements
      if (role === "counselor") {
        if (!registrationToken) {
          return next(new ErrorHandler("Registration token required for counselor registration", 400));
        }
        if (!fullName) {
          return next(new ErrorHandler("Full name required for counselor registration", 400));
        }
        
        const isValidToken = await validateCounselorToken(registrationToken);
        if (!isValidToken) {
          return next(new ErrorHandler("Invalid or expired registration token. Please request a new registration link.", 400));
        }
      }

      if (role === "admin" && !fullName) {
        return next(new ErrorHandler("Full name required for admin registration", 400));
      }

      // Create activation token
      const { token, activationCode } = createActivationToken({
        email,
        password,
        role,
        fullName
      });

      // Prepare email data
      const data = {
        user: {
          email,
          fullName: fullName || email.split("@")[0],
          role
        },
        activationCode
      };

      // Send activation email
      try {
        await sendMail({
          email,
          subject: "Activate Your MiCounselor Account",
          template: "activation-mail.ejs",
          data
        });

        // Send response
        res.status(201).json({
          success: true,
          message: `Please check your email: ${email} to activate your account!`,
          activationToken: token
        });
      } catch (error: any) {
        return next(new ErrorHandler(`Error sending activation email: ${error.message}`, 500));
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Activation controller
export const activateUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { activation_token, activation_code } = req.body;
  
        const newUser: { user: IRegistrationBody; activationCode: string } = jwt.verify(
          activation_token,
          process.env.ACTIVATION_SECRET as string
        ) as { user: IRegistrationBody; activationCode: string };
  
        if (!activation_code || activation_code.length !== 6) {
        return next(new ErrorHandler("Please provide a valid 6-digit activation code", 400));
      }

      if (activation_code !== newUser.activationCode) {
        return next(new ErrorHandler("Invalid activation code", 400));
      }
  
        const { email, password, role, fullName } = newUser.user; 
  
        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return next(new ErrorHandler("Email already registered", 400));
        }
  
        // Create user based on role with isVerified set to true
        let user;
        switch (role) {
          case "client":
            user = await Client.create({
              email,
              password,
              role,
              isVerified: true // Added this line
            });
            break;
  
          case "counselor":
            user = await Counselor.create({
              email,
              password,
              role,
              fullName,
              isVerified: true, // Added this line
              isActive: false // Requires admin approval
            });
            break;
  
          case "admin":
            user = await Admin.create({
              email,
              password,
              role,
              fullName,
              isVerified: true, // Added this line
              adminLevel: "regular"
            });
            break;
  
          default:
            return next(new ErrorHandler("Invalid role specified", 400));
        }
  
        // Send welcome email
        const welcomeData = {
          user: {
            email,
            fullName: fullName || email.split("@")[0],
            role
          }
        };
  
        try {
          await sendMail({
            email,
            subject: "Welcome to MiCounselor",
            template: "welcome-mail.ejs",
            data: welcomeData
          });
        } catch (error: any) {
          console.error("Welcome email failed:", error);
          // Don't return error as user is already created
        }
  
        res.status(201).json({
          success: true,
          message: "Account activated successfully"
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    }
  );

// Interface for login request
interface ILoginRequest {
  email: string;
  password: string;
}

export const loginUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILoginRequest;
      
      if (!req.deviceId) {
        return next(new ErrorHandler("Device ID not found", 400));
      }

      // Validation
      if (!email || !password) {
        return next(new ErrorHandler("Please enter email and password", 400));
      }

      // Find user and include password field
      const user = await User.findOne({ email })
        .select("+password")
        .exec();

      if (!user) {
        return next(new ErrorHandler("Invalid email or password", 401));
      }

      // Check if user is verified
      if (!user.isVerified) {
        return next(new ErrorHandler("Please verify your email first", 401));
      }

      if (!user.isActive && user.role !== "counselor") {
        return next(new ErrorHandler("Your account has been deactivated", 401));
      }

      // Compare password
      const isPasswordMatch = await user.comparePassword(password);

      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid email or password", 401));
      }

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Create session
      await SessionManager.createSession(user._id.toString(), req.deviceId);
      
      // Update last active timestamp
      user.lastActive = new Date();

      // For admin users, update last login
      if (user.role === "admin") {
        await User.findByIdAndUpdate(user._id, {
          $set: { lastLogin: new Date() },
          $push: {
            activityLog: {
              action: "login",
              timestamp: new Date(),
              details: `Login from ${req.ip} with device ${req.deviceId}`,
            },
          },
        });
      }

      // Send login notification
      user.notifications.push({
        title: "New Login",
        message: `New login detected from ${req.ip} with device ${req.deviceId}`,
        type: "system",
        read: false,
        createdAt: new Date(),
      });

      // Store session in Redis
      await redis.set(
        `user_${user._id.toString()}`,
        JSON.stringify({
          user_id: user._id.toString(),
          role: user.role,
          email: user.email,
          lastActive: new Date(),
        }),
        'EX',
        7 * 24 * 60 * 60 // 7 days
      );

      await user.save();

      // Send response with tokens
      res.status(200).json({
        success: true,
        user: {
          _id: user._id,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          isActive: user.isActive,
          avatar: user.avatar,
          lastActive: user.lastActive,
        },
        accessToken,
        refreshToken,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (user) {
        // Remove session
        await SessionManager.removeSession(user._id.toString());
        
        // For admin users, log the logout action
        if (user.role === "admin") {
          await User.findByIdAndUpdate(user._id, {
            $push: {
              activityLog: {
                action: "logout",
                timestamp: new Date(),
                details: `Logout from ${req.ip}`,
              },
            },
          });
        }

        // Update last active timestamp
        await User.findByIdAndUpdate(user._id, {
          lastActive: new Date()
        });

        // Clear Redis session
        await redis.del(`user_${user._id.toString()}`);
      }

      res.status(200).json({
        success: true,
        message: "Logged out successfully"
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

 // Update access token controller
 export const updateAccessToken = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
      try {
          const refresh_token = req.cookies.refresh_token;
          
          if (!refresh_token) {
              return next(new ErrorHandler("No refresh token available", 401));
          }

          const decoded = jwt.verify(
              refresh_token,
              process.env.REFRESH_TOKEN_SECRET as string
          ) as JwtPayload;

          if (!decoded) {
              return next(new ErrorHandler("Invalid refresh token", 401));
          }

          // Get user from Redis using string key
          const redisKey = getRedisKey(decoded.id);
          const user = await redis.get(redisKey);
          
          if (!user) {
              return next(new ErrorHandler("Please login to access this resource", 401));
          }

          const userData = JSON.parse(user);

          // Create new tokens
          const accessToken = generateAccessToken(userData);
          const refreshToken = generateRefreshToken(userData);

          // Update Redis session with 7 days expiry (same as refresh token)
          await redis.set(
              redisKey,
              JSON.stringify({ ...userData }),
              'EX',
              7 * 24 * 60 * 60 // 7 days in seconds
          );


          res.status(200).json({
              success: true,
              accessToken,
              user: userData
          });
      } catch (error: any) {
          if (error instanceof jwt.TokenExpiredError) {
              return next(new ErrorHandler("Refresh token expired", 401));
          }
          if (error instanceof jwt.JsonWebTokenError) {
              return next(new ErrorHandler("Invalid refresh token", 401));
          }
          return next(new ErrorHandler(error.message, 500));
      }
  }
);
  // Get user info controller
  export const getUserInfo = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?._id;
        
        if (!userId) {
          return next(new ErrorHandler("User not authenticated", 401));
        }
  
        // Convert ObjectId to string for Redis key
        const redisKey = getRedisKey(userId);
  
        // Try to get user from Redis first
        const cachedUser = await redis.get(redisKey);
        
        if (cachedUser) {
          const userData = JSON.parse(cachedUser);
          return res.status(200).json({
            success: true,
            user: userData
          });
        }
  
        // If not in Redis, get from DB and cache it
        const user = await User.findById(userId).select("-password");
        
        if (!user) {
          return next(new ErrorHandler("User not found", 404));
        }
  
        // Cache user data in Redis using string key
        await redis.set(redisKey, JSON.stringify(user), 'EX', 3600); // Cache for 1 hour
  
        res.status(200).json({
          success: true,
          user
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    }
  );


  interface IGoogleAuthRequest extends Request {
    body: {
      email: string;
    };
  }
  
  export const googleAuth = CatchAsyncError(
    async (req: IGoogleAuthRequest, res: Response, next: NextFunction) => {
      try {
        const { email } = req.body;
  
        if (!email) {
          return next(new ErrorHandler("Email is required", 400));
        }
  
        // Check if user exists
        let user = await Client.findOne({ email });
  
        if (!user) {
          // Create new client following the same pattern as regular signup
          user = await Client.create({
            email,
            password: `google_${Math.random().toString(36).slice(-8)}`, // Random password for Google users
            role: "client",
            isVerified: true // Google users are pre-verified
          });
  
          // Send welcome email
          try {
            await sendMail({
              email,
              subject: "Welcome to MiCounselor",
              template: "welcome-mail.ejs",
              data: {
                user: {
                  email,
                  fullName: email.split("@")[0],
                  role: "client"
                }
              }
            });
          } catch (error) {
            console.error("Welcome email failed:", error);
            // Don't return error as user is already created
          }
        }
  
        // Send authentication token
        sendToken(user, user ? 200 : 201, res);
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    }
  );

  // Interface for password update request
interface IPasswordUpdate {
    oldPassword: string;
    newPassword: string;
  }
  
  // Interface for forgot password request
  interface IForgotPassword {
    email: string;
  }
  
  // Interface for reset password request
  interface IResetPassword {
    resetToken: string;
    newPassword: string;
  }
  
  // Update password for logged-in user
  export const updatePassword = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { oldPassword, newPassword } = req.body as IPasswordUpdate;
        
        if (!oldPassword || !newPassword) {
          return next(new ErrorHandler("Please provide old and new password", 400));
        }
  
        // Get user with password field
        const user = await User.findById(req.user?._id).select("+password");
        
        if (!user) {
          return next(new ErrorHandler("User not found", 404));
        }
  
        // Validate old password
        const isPasswordMatch = await user.comparePassword(oldPassword);
        if (!isPasswordMatch) {
          return next(new ErrorHandler("Old password is incorrect", 400));
        }
  
        // Update password
        user.password = newPassword;
        await user.save();
  
        // Clear Redis cache
        await redis.del(user._id.toString());
  
        // Send password change notification email
        try {
            await sendMail({
                email: user.email,
                subject: "Password Changed Successfully",
                template: "password-changed.ejs",
                data: { user }
            });
            
        } catch (error) {
          console.error("Password change notification email failed:", error);
        }
  
        res.status(200).json({
          success: true,
          message: "Password updated successfully"
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    }
  );
  
  // Generate OTP for password reset
  const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };
  
  // Forgot password - send OTP
  export const forgotPassword = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email } = req.body as IForgotPassword;
  
        const user = await User.findOne({ email });
        if (!user) {
          return next(new ErrorHandler("User not found", 404));
        }
  
        // Generate OTP
        const otp = generateOTP();
        
        // Create reset token
        const resetToken = jwt.sign(
          { email, otp },
          process.env.RESET_TOKEN_SECRET as string,
          { expiresIn: "15m" }
        );
  
        // Store reset token in Redis with 15min expiry
        const resetKey = `reset:${user._id}`;
        await redis.set(resetKey, resetToken, 'EX', 900); // 15 minutes
  
        // Send OTP email
        try {
            await sendMail({
                email: user.email,
                subject: "Password Reset OTP",
                template: "reset-password.ejs",
                data: { user: { email: user.email, otp } }
            });
  
          res.status(200).json({
            success: true,
            message: "Password reset OTP sent to your email",
            resetToken
          });
        } catch (error: any) {
          await redis.del(resetKey);
          return next(new ErrorHandler("Error sending reset email", 500));
        }
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    }
  );
  
  // Verify OTP and reset password
  export const resetPassword = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { resetToken, newPassword } = req.body as IResetPassword;
  
        // Verify reset token
        const decoded = jwt.verify(
          resetToken,
          process.env.RESET_TOKEN_SECRET as string
        ) as { email: string; otp: string };
  
        const user = await User.findOne({ email: decoded.email });
        if (!user) {
          return next(new ErrorHandler("User not found", 404));
        }
  
        // Check if reset token exists in Redis
        const resetKey = `reset:${user._id}`;
        const storedToken = await redis.get(resetKey);
  
        if (!storedToken || storedToken !== resetToken) {
          return next(new ErrorHandler("Invalid or expired reset token", 400));
        }
  
        // Update password
        user.password = newPassword;
        await user.save();
  
        // Clear reset token from Redis
        await redis.del(resetKey);
  
        // Clear user cache
        await redis.del(user._id.toString());
  
        // Send confirmation email
        try {
            await sendMail({
                email: user.email,
                subject: "Password Reset Successful",
                template: "reset-success.ejs",
                data: { user }
            });
        } catch (error) {
          console.error("Password reset confirmation email failed:", error);
        }
  
        res.status(200).json({
          success: true,
          message: "Password reset successful"
        });
      } catch (error: any) {
        if (error instanceof jwt.TokenExpiredError) {
          return next(new ErrorHandler("Reset token has expired", 400));
        }
        if (error instanceof jwt.JsonWebTokenError) {
          return next(new ErrorHandler("Invalid reset token", 400));
        }
        return next(new ErrorHandler(error.message, 500));
      }
    }
  );


  
  
// Update user avatar
export const updateAvatar = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { avatarId } = req.body;
      const userId = req.user?._id;

      console.log('Update avatar request:', { avatarId, userId }); // Debug log

      if (!userId) {
        return next(new ErrorHandler('User not authenticated', 401));
      }

      if (!avatarId) {
        return next(new ErrorHandler('Avatar ID is required', 400));
      }

      // Validate avatar using the utility function
      const isValidAvatar = await validateAvatarId(avatarId);
      if (!isValidAvatar) {
        return next(new ErrorHandler('Invalid avatar selection', 400));
      }

      // Get avatar details
      const avatarDetails = getAvatarDetails(avatarId);
      if (!avatarDetails) {
        return next(new ErrorHandler('Avatar details not found', 400));
      }

      const user = await User.findById(userId);
      if (!user) {
        return next(new ErrorHandler('User not found', 404));
      }

      // Update user's avatar
      user.avatar = {
        avatarId,
        imageUrl: avatarDetails.imageUrl
      };

      await user.save();

      // Update redis cache
      await redis.set(userId.toString(), JSON.stringify(user));

      res.status(200).json({
        success: true,
        user
      });
    } catch (error: any) {
      console.error('Update avatar error:', error); // Debug log
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
  

  // Update client profile
  export const updateClientProfile = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          username,  
          marriageYears,
          age,
          issuesExperienced,
          preferredCounselorGender,
          preferredLanguages,
          timezone,
        } = req.body;
  
        const userId = req.user?._id;
  
        if (!userId) {
          return next(new ErrorHandler('User not authenticated', 401));
        }
  
        const client = await Client.findById(userId);
        if (!client) {
          return next(new ErrorHandler('Client not found', 404));
        }
  
        // Check if username exists and is different from current username
        if (username && username !== client.username) {
          // Check if new username is already taken
          const existingUsername = await Client.findOne({ username });
          if (existingUsername) {
            return next(new ErrorHandler('Username already taken', 400));
          }
          client.username = username;
        }
  
        // Update optional fields if provided
        if (marriageYears) client.marriageYears = marriageYears;
        if (age) client.age = age;
        if (issuesExperienced) client.issuesExperienced = issuesExperienced;
        if (preferredCounselorGender) client.preferredCounselorGender = preferredCounselorGender;
        if (preferredLanguages) client.preferredLanguages = preferredLanguages;
        if (timezone) client.timezone = timezone;
  
        await client.save();
  
        // Convert ObjectId to string for Redis key
        const userIdString = userId.toString();
        await redis.set(userIdString, JSON.stringify(client));
  
        res.status(200).json({
          success: true,
          client
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    }
  );
  
  // Update counselor profile
  export const updateCounselorProfile = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          fullName,
          specializations,
          marriageYears,
          preferredAgeGroups,
          gender,
          languages,
          availability,
          unavailableDates,
          maxDailyMeetings,
          isAvailable,
          workingHours,
          meetingPreferences
        } = req.body;
  
        const userId = req.user?._id;
  
        if (!userId) {
          return next(new ErrorHandler('User not authenticated', 401));
        }
  
        const counselor = await Counselor.findById(userId);
        if (!counselor) {
          return next(new ErrorHandler('Counselor not found', 404));
        }
  
  
        // Update basic information
        if (fullName) counselor.fullName = fullName;
        if (gender) counselor.gender = gender;
  
        // Update professional details
        if (specializations) counselor.specializations = specializations;
        if (marriageYears) counselor.marriageYears = marriageYears;
        if (preferredAgeGroups) counselor.preferredAgeGroups = preferredAgeGroups;
        if (languages) counselor.languages = languages;
  
        // Update availability settings
        if (availability) {
          // Validate availability format
          const isValidAvailability = availability.every((slot: any) => 
            slot.dayOfWeek >= 0 && 
            slot.dayOfWeek <= 6 &&
            slot.startTime &&
            slot.endTime &&
            typeof slot.isRecurring === 'boolean'
          );
  
          if (!isValidAvailability) {
            return next(new ErrorHandler('Invalid availability format', 400));
          }
        }
  
        if (unavailableDates) {
          // Validate and convert date strings to Date objects
          const parsedDates = unavailableDates.map((date: string) => new Date(date));
          if (parsedDates.some((date: Date) => isNaN(date.getTime()))) {
            return next(new ErrorHandler('Invalid date format in unavailableDates', 400));
          }
          counselor.unavailableDates = parsedDates;
        }
  
        // Update working preferences
        if (maxDailyMeetings) {
          if (maxDailyMeetings < 1 || maxDailyMeetings > 20) {
            return next(new ErrorHandler('maxDailyMeetings must be between 1 and 20', 400));
          }
          counselor.maxDailyMeetings = maxDailyMeetings;
        }
  
        if (typeof isAvailable === 'boolean') {
          counselor.isAvailable = isAvailable;
        }
  
        if (workingHours) {
          // Validate working hours format
          if (!workingHours.start || !workingHours.end || !workingHours.timezone) {
            return next(new ErrorHandler('Invalid working hours format', 400));
          }
          counselor.workingHours = workingHours;
        }
  
        if (meetingPreferences) {
          if (
            meetingPreferences.maxConsecutiveMeetings &&
            (meetingPreferences.maxConsecutiveMeetings < 1 || 
             meetingPreferences.maxConsecutiveMeetings > 10)
          ) {
            return next(new ErrorHandler('maxConsecutiveMeetings must be between 1 and 10', 400));
          }
          counselor.meetingPreferences = meetingPreferences;
        }
  
        // Save the updated counselor profile
        await counselor.save();
  
        // Update Redis cache
        const userIdString = userId.toString();
        await redis.set(userIdString, JSON.stringify(counselor));
  
        res.status(200).json({
          success: true,
          message: 'Profile updated successfully',
          counselor
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    }
  );

  export const deleteAccount = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?._id;
        const { password } = req.body;
  
        if (!userId) {
          return next(new ErrorHandler("User not authenticated", 401));
        }
  
        // Find user and include password field for verification
        const user = await User.findById(userId).select("+password");
  
        if (!user) {
          return next(new ErrorHandler("User not found", 404));
        }
  
        // Verify password before proceeding with deletion
        if (password) {
          const isPasswordValid = await user.comparePassword(password);
          if (!isPasswordValid) {
            return next(new ErrorHandler("Invalid password", 401));
          }
        }
  
        // Perform role-specific cleanup
        switch (user.role) {
          case "client": {
            // Cast user to IClient type for client-specific properties
            const clientUser = await Client.findById(userId) as IClient;
            if (clientUser?.currentCounselor) {
              await Counselor.findByIdAndUpdate(clientUser.currentCounselor, {
                $inc: { activeClients: -1 }
              });
            }
            break;
          }
  
          case "counselor": {
            // Update clients who have this counselor assigned
            await Client.updateMany(
              { currentCounselor: userId },
              { $unset: { currentCounselor: 1 } }
            );
            break;
          }
  
          case "admin": {
            // Cast user to IAdmin type for admin-specific properties
            const adminUser = await Admin.findById(userId) as IAdmin;
            if (adminUser?.adminLevel === "super") {
              const superAdminCount = await Admin.countDocuments({
                adminLevel: "super",
                _id: { $ne: userId }
              });
              if (superAdminCount === 0) {
                return next(
                  new ErrorHandler(
                    "Cannot delete the last super admin account",
                    400
                  )
                );
              }
            }
            break;
          }
        }
  
        // Clear user sessions
        const redisKey = userId.toString();
        await redis.del(redisKey);
        await clearTokens(userId);

           await SessionManager.removeSession(userId.toString());
  
        // Delete the user account
        await User.findByIdAndDelete(userId);
  
        res.status(200).json({
          success: true,
          message: "Account deleted successfully"
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    }
  );

export const updateTourStatus = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
      try {
          const userId = req.user?._id;

          if (!userId) {
              return next(new ErrorHandler("User not authenticated", 401));
          }

          const user = await User.findById(userId);
          if (!user) {
              return next(new ErrorHandler("User not found", 404));
          }

          user.tourViewed = true;
          await user.save();

          // Update Redis cache
          const redisKey = getRedisKey(userId);
          await redis.set(redisKey, JSON.stringify(user));

          res.status(200).json({
              success: true,
              message: "Tour status updated successfully"
          });
      } catch (error: any) {
          return next(new ErrorHandler(error.message, 500));
      }
  }
);